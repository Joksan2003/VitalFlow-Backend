// backend/src/utils/generative.js
// Robust wrapper for calling a generative model (Gemini / @google/generative-ai).
// Tries multiple signatures and prompt shapes, and extracts text from many response shapes.

let GoogleGenerativeAI;
try {
  GoogleGenerativeAI = require('@google/generative-ai').GoogleGenerativeAI;
} catch (e) {
  GoogleGenerativeAI = null;
}

const util = require('util');

async function extractTextFromResponse(resp) {
  try {
    if (!resp) return null;

    // axios-like envelope
    if (resp.data) resp = resp.data;

    // resp.response.text() may be function returning Promise
    if (resp.response && typeof resp.response.text === 'function') {
      const maybe = resp.response.text();
      if (maybe && typeof maybe.then === 'function') return (await maybe);
      return String(maybe);
    }

    if (resp.response && typeof resp.response.text === 'string') return resp.response.text;

    // Typical fields
    if (typeof resp.outputText === 'string') return resp.outputText;
    if (typeof resp.text === 'string') return resp.text;
    if (typeof resp.generated_text === 'string') return resp.generated_text;

    // Gemini-like output array
    if (Array.isArray(resp.output) && resp.output.length) {
      const first = resp.output[0];
      if (first.content) {
        if (Array.isArray(first.content)) {
          const txtParts = first.content.map(block => {
            if (typeof block === 'string') return block;
            if (block && typeof block.text === 'string') return block.text;
            if (block && block.type === 'output_text' && typeof block.text === 'string') return block.text;
            return '';
          });
          return txtParts.join('\n').trim();
        }
        if (typeof first.content === 'string') return first.content;
      }
      if (typeof first.text === 'string') return first.text;
    }

    // candidates (other SDKs)
    if (Array.isArray(resp.candidates) && resp.candidates[0]) {
      const c = resp.candidates[0];
      if (typeof c.output === 'string') return c.output;
      if (typeof c.content === 'string') return c.content;
      if (typeof c.text === 'string') return c.text;
      if (c.message && typeof c.message === 'string') return c.message;
      if (c.delta && typeof c.delta === 'string') return c.delta;
    }

    // openai-like choices
    if (Array.isArray(resp.choices) && resp.choices[0]) {
      const ch = resp.choices[0];
      if (typeof ch.text === 'string') return ch.text;
      if (ch.message && ch.message.content && typeof ch.message.content === 'string') return ch.message.content;
    }

    if (typeof resp === 'string') return resp;

    // fallback to inspected JSON
    return JSON.stringify(resp);
  } catch (err) {
    return null;
  }
}

function buildPromptVariants(prompt, modelName, temperature, maxOutputTokens) {
  // Return different shapes to try with the SDK
  const variants = [];

  // raw string
  variants.push(prompt);

  // object shapes
  variants.push({ prompt });
  variants.push({ input: prompt });
  variants.push({ request: prompt });
  variants.push({ text: prompt });
  variants.push({ model: modelName, prompt, temperature, maxOutputTokens });
  variants.push({ model: modelName, input: prompt, temperature, maxOutputTokens });
  variants.push({ model: modelName, request: { input: prompt }, temperature, maxOutputTokens });
  variants.push({ model: modelName, request: { messages: [{ role: 'user', content: prompt }] }, temperature, maxOutputTokens });

  // messages array shapes
  variants.push({ messages: [{ role: 'user', content: prompt }] });
  variants.push([{ type: 'text', text: prompt }]);
  variants.push([{ role: 'user', content: prompt }]);
  variants.push({ messages: [{ type: 'text', text: prompt }] });

  return variants;
}

async function callModel(prompt, opts = {}) {
  const API_KEY = process.env.GENERATIVE_API_KEY;
  if (!API_KEY) throw new Error('Generative API key not configured. Set GENERATIVE_API_KEY or GOOGLE_API_KEY in .env.');

  if (!GoogleGenerativeAI) throw new Error('El paquete @google/generative-ai no está instalado. Ejecuta: npm install @google/generative-ai');

  // instantiate client (try multiple constructor signatures)
  let client = null;
  let lastInstErr = null;
  try { client = new GoogleGenerativeAI(API_KEY); } catch (e) { lastInstErr = e; }
  if (!client) {
    try { client = new GoogleGenerativeAI({ apiKey: API_KEY }); } catch (e) { lastInstErr = e; }
  }
  if (!client) {
    try {
      const mod = require('@google/generative-ai');
      const Klass = mod.default || mod.GoogleGenerativeAI || mod.Generative;
      client = new Klass(API_KEY || { apiKey: API_KEY });
    } catch (e) {
      throw new Error('No se pudo instanciar GoogleGenerativeAI. Revisa la versión del paquete. Errores: ' + (lastInstErr ? lastInstErr.message + ' | ' : '') + e.message);
    }
  }

  const modelName = opts.modelName || process.env.GENERATIVE_MODEL || 'gemini-2.5-flash';
  let model = null;
  try {
    if (typeof client.getGenerativeModel === 'function') model = client.getGenerativeModel({ model: modelName });
    else if (typeof client.getModel === 'function') model = client.getModel({ model: modelName });
    else if (typeof client.model === 'function') model = client.model(modelName);
    else model = client;
  } catch (err) {
    model = client; // fallback
  }
  if (!model) throw new Error('No se obtuvo un objeto model válido desde el cliente generativo.');

  const temperature = typeof opts.temperature === 'number' ? opts.temperature : 0.2;
  const maxOutputTokens = typeof opts.maxOutputTokens === 'number' ? opts.maxOutputTokens : 1500;

  const promptVariants = buildPromptVariants(prompt, modelName, temperature, maxOutputTokens);

  // method names to try (order matters)
  const methodNames = [
    'generateContent',
    'generate',
    'call',
    'create',
    'predict',
    'stream', // in case some SDK exposes it
  ];

  let lastError = null;
  let response = null;

  // Try combinations of method names and prompt variants
  for (const method of methodNames) {
    for (const variant of promptVariants) {
      try {
        if (typeof model[method] === 'function') {
          // prepare argument: if variant is string -> pass directly, else pass object
          let arg = variant;
          if (typeof arg === 'object') {
            // make shallow copy and add common options if not present
            arg = Object.assign({}, arg);
            if (!('temperature' in arg)) arg.temperature = temperature;
            if (!('maxOutputTokens' in arg)) arg.maxOutputTokens = maxOutputTokens;
            // if top-level model not present, add
            if (!arg.model) arg.model = modelName;
          }
          const maybe = model[method].call(model, arg);
          response = maybe && typeof maybe.then === 'function' ? await maybe : maybe;
        }
      } catch (err) {
        lastError = err;
        // Special-case: if SDK complains "request is not iterable", try next variant
        if (err && err.message && err.message.includes('request is not iterable')) {
          continue;
        }
      }
      if (response) break;
    }
    if (response) break;
  }

  // Last-resort: try calling model as a function
  if (!response) {
    try {
      if (typeof model === 'function') {
        const maybe = model(prompt);
        response = maybe && typeof maybe.then === 'function' ? await maybe : maybe;
      }
    } catch (err) {
      lastError = err;
    }
  }

  if (!response) {
    throw new Error('Error llamando al modelo generativo: no se obtuvo respuesta válida. Último error: ' + (lastError ? lastError.message : 'none'));
  }

  // extract textual response
  const text = await extractTextFromResponse(response);
  if (!text) {
    throw new Error('No se pudo extraer texto de la respuesta del modelo. Respuesta completa: ' + util.inspect(response, { depth: 3 }));
  }

  return String(text).trim();
}

module.exports = { callModel, extractTextFromResponse };
// backend/src/utils/generative.js
// Versión estable para llamar a Gemini en Render (Node 18/20/22)

const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * Llama al modelo generativo y devuelve SIEMPRE un string de texto.
 * @param {string} prompt
 * @param {object} opts  { modelName?: string, temperature?: number, maxOutputTokens?: number }
 */
async function callModel(prompt, opts = {}) {
  const API_KEY =
    process.env.GENERATIVE_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GEN_AI_KEY;

  if (!API_KEY) {
    throw new Error(
      'Generative API key not configured. Define GENERATIVE_API_KEY en Render.'
    );
  }

  const genAI = new GoogleGenerativeAI(API_KEY);

  const modelName =
    opts.modelName || process.env.GENERATIVE_MODEL || 'gemini-2.5-flash';

  const temperature =
    typeof opts.temperature === 'number' ? opts.temperature : 0.2;
  const maxOutputTokens =
    typeof opts.maxOutputTokens === 'number' ? opts.maxOutputTokens : 1500;

  try {
    const model = genAI.getGenerativeModel({ model: modelName });

    // Forma recomendada para Gemini 1.5 / 2.5
    const response = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: String(prompt) }],
        },
      ],
      generationConfig: {
        temperature,
        maxOutputTokens,
      },
    });

    // En los SDK nuevos, el texto viene aquí:
    if (
      response &&
      response.response &&
      typeof response.response.text === 'function'
    ) {
      return String(await response.response.text()).trim();
    }

    // Fallback simple
    if (response && typeof response.text === 'function') {
      return String(await response.text()).trim();
    }

    if (typeof response === 'string') return response.trim();

    return JSON.stringify(response);
  } catch (err) {
    console.error('❌ Error en callModel:', err);
    throw new Error(
      'Error llamando al modelo generativo: ' + (err.message || String(err))
    );
  }
}

// Dejo un helper vacío para no romper imports antiguos, por si acaso.
function extractTextFromResponse(resp) {
  if (!resp) return null;
  if (
    resp.response &&
    typeof resp.response.text === 'function'
  ) {
    return resp.response.text();
  }
  return null;
}

module.exports = { callModel, extractTextFromResponse };
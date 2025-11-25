// backend/src/Controllers/planController.js
const Plan = require('../models/Plan');
const User = require('../models/user');
const Recipe = require('../models/Recipe');
const { callModel } = require('../utils/generative');

function buildPrompt(user, userPreferences = {}, localDataSnippet = '') {
  const persona = {
    name: user.name || '',
    birthDate: user.birthDate || null,
    age: user.birthDate ? Math.floor((Date.now() - new Date(user.birthDate).getTime()) / (365.25*24*3600*1000)) : null,
    weightKg: user.weightKg || null,
    heightCm: user.heightCm || null,
    activityLevel: user.activityLevel || null,
    diets: user.diets || [],
    allergies: user.allergies || [],
    dislikes: user.dislikes || [],
    favouriteIngredients: user.favouriteIngredients || [],
    goal: user.goal || null,
    targetWeightKg: user.targetWeightKg || null,
    locale: user.locale || 'es-MX',
  };

  return `
Eres un generador de planes alimenticios. Devuélveme estrictamente JSON con la estructura EXACTA:
{
  "nombre_persona": "...",
  "meta": { "objetivo": "...", "dieta": "...", "calorias_diarias_recomendadas": 1234, "alergias": [] },
  "dias": [
    { "dia": 1,
      "comidas": [
        { "tipo": "Desayuno", "calorias_aprox": 450,
          "receta": {
            "title": "...",
            "summary": "...",
            "kcal": 300,
            "prepTimeMin": 10,
            "servings": 1,
            "tags": ["tag1"],
            "imagePrompt": "...",
            "ingredients": [{ "name": "...", "quantity": 150, "unit": "g" }],
            "steps": ["Paso 1","Paso 2"]
          }
        }
      ]
    }
  ]
}

Reglas:
- Devuelve únicamente JSON válido (sin texto extra).
- Genera 7 días y 3 comidas por día (Desayuno/Almuerzo/Cena). Meriendas opcionales.
- Prioriza ingredientes locales y los que están en favouriteIngredients del usuario.
- Nunca uses ingredientes que estén en allergies o dislikes.
- Si no tienes un campo, devuelve null.
Usuario: ${JSON.stringify(persona, null, 2)}
Preferencias explícitas: ${JSON.stringify(userPreferences || {}, null, 2)}
Recetas de ejemplo (resumen): ${localDataSnippet}
`.trim();
}

exports.generatePlan = async (req, res, next) => {
  try {
    const uid = req.user.uid;
    const user = await User.findById(uid).lean();
    if (!user) return res.status(404).json({ ok: false, msg: 'Usuario no encontrado' });

    const prefs = req.body.preferences || {};

    // snippet para estilo (ayuda al modelo a generar títulos coherentes)
    const snippetRecipes = await Recipe.find({ status: 'approved' }).limit(30).lean();
    const localSnippet = JSON.stringify(snippetRecipes.map(r => ({ title: r.title, kcal: r.kcal })));

    const prompt = buildPrompt(user, prefs, localSnippet);
    const outputText = await callModel(prompt, { modelName: process.env.GENERATIVE_MODEL });

    // parse robusto del JSON devuelto por la IA
    let parsed;
    try {
      parsed = JSON.parse(outputText);
    } catch (err) {
      const match = outputText.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
      else throw new Error('No se pudo parsear JSON desde el modelo');
    }

    if (!parsed || !Array.isArray(parsed.dias) || !parsed.nombre_persona) {
      return res.status(500).json({ ok: false, msg: 'Respuesta de IA no tiene la estructura esperada' });
    }

    // intentar mapear títulos a recetas existentes
    const titleCandidates = new Set();
    parsed.dias.forEach(d => (d.comidas || []).forEach(c => {
      if (!c) return;
      if (typeof c.receta === 'string') titleCandidates.add(c.receta);
      if (c.receta && typeof c.receta === 'object' && c.receta.title) titleCandidates.add(c.receta.title);
    }));
    const titlesArr = Array.from(titleCandidates);

    const titleToId = {};
    if (titlesArr.length) {
      const recipesFound = await Recipe.find({ title: { $in: titlesArr } }).lean();
      recipesFound.forEach(r => { titleToId[r.title] = r._id; });
    }

    const suggestedRecipes = [];
    const planDoc = new Plan({
      userId: uid,
      nombre_persona: parsed.nombre_persona,
      meta: parsed.meta || {},
      dias: [],
      suggestedRecipes: [],
      source: 'ai',
      status: 'pending_review'
    });

    // por cada día y comida: normalizar y crear receta-draft si la IA entregó objeto
    for (const d of parsed.dias) {
      const dayObj = { dia: d.dia || 0, comidas: [] };
      for (const c of (d.comidas || [])) {
        const mealName = c.tipo || c.nombre || 'Comida';
        const meal = {
          nombre: mealName,
          calorias_aprox: typeof c.calorias_aprox === 'number' ? c.calorias_aprox : (c.calorias ? Number(c.calorias) : 0),
          recetaId: null,
          recetaTitle: '',
          receta: null
        };

        // si la IA devolvió solo título y coincide con receta existente
        if (typeof c.receta === 'string' && titleToId[c.receta]) {
          meal.recetaId = titleToId[c.receta];
          meal.recetaTitle = c.receta;
          suggestedRecipes.push(titleToId[c.receta]);
        } else if (c.receta && typeof c.receta === 'object' && (c.receta.title || c.receta.ingredients || c.receta.steps)) {
          // Creamos una receta DRAFT con la info que IA proporcionó
          const r = c.receta;
          const ingredients = Array.isArray(r.ingredients)
            ? r.ingredients.map(i => ({
                name: i.name || i.ingredient || '',
                quantity: i.quantity != null
                  ? Number(i.quantity)
                  : (i.amount != null ? Number(i.amount) : null),
                unit: i.unit || ''
              }))
            : [];

          const steps = Array.isArray(r.steps) ? r.steps : (typeof r.steps === 'string' ? r.steps.split(/\n+/).map(s => s.trim()).filter(Boolean) : []);

          const recDoc = new Recipe({
            title: r.title || (typeof c.receta === 'string' ? c.receta : 'Receta generada'),
            summary: r.summary || r.description || '',
            description: r.description || r.summary || '',
            imageUrl: r.imageUrl || '',
            imagePrompt: r.imagePrompt || '',
            prepTimeMin: r.prepTimeMin || r.durationMin || 0,
            servings: r.servings || 1,
            kcal: typeof r.kcal === 'number' ? r.kcal : (r.kcal ? Number(r.kcal) : 0),
            diets: Array.isArray(r.diets) ? r.diets : [],
            categories: Array.isArray(r.categories) ? r.categories : [],
            tags: Array.isArray(r.tags) ? r.tags : [],
            ingredients,
            steps,
            source: 'ai',
            author: uid,
            createdBy: uid,
            local: false,
            status: 'draft' // draft para que nutriologo revise
          });

          await recDoc.save();
          meal.recetaId = recDoc._id;
          meal.recetaTitle = recDoc.title;
          
          
          meal.receta = {
            title: recDoc.title,
            kcal: recDoc.kcal,
            imageUrl: recDoc.imageUrl || '',
            ingredients,
            steps
          };
          suggestedRecipes.push(recDoc._id);
        } else if (typeof c.receta === 'string') {
          // si la IA devolvió título pero no lo encontramos, lo dejamos como título
          meal.recetaTitle = c.receta;
        }

        dayObj.comidas.push(meal);
      }
      planDoc.dias.push(dayObj);
    }

    planDoc.suggestedRecipes = [...new Set(suggestedRecipes.map(String))];
    await planDoc.save();

    // popular información mínima de recetas sugeridas
    const planPop = planDoc.toObject();
    if (planPop.suggestedRecipes && planPop.suggestedRecipes.length) {
      const recs = await Recipe.find({ _id: { $in: planPop.suggestedRecipes } }).select('title kcal imageUrl status').lean();
      const map = recs.reduce((acc, r) => { acc[String(r._id)] = r; return acc; }, {});
      planPop.suggestedRecipes = planPop.suggestedRecipes.map(id => map[String(id)] || null);
    }

    return res.status(201).json({ ok: true, plan: planPop });
  } catch (err) {
    console.error('Error en generatePlan:', err);
    next(err);
  }
};

exports.getMyPlans = async (req, res, next) => {
  try {
    const uid = req.user.uid;
    const plans = await Plan.find({ userId: uid }).sort({ createdAt: -1 }).lean();
    res.json({ ok: true, data: plans });
  } catch (err) { next(err); }
};

exports.approvePlan = async (req, res, next) => {
  try {
    const id = req.params.id;
    const plan = await Plan.findById(id);
    if (!plan) return res.status(404).json({ ok: false, msg: 'Plan no encontrado' });

    // Marcar plan como aprobado
    plan.status = 'approved';
    plan.nutriReviewer = req.user.uid;
    plan.reviewerNotes = req.body.notes || '';
    await plan.save();

    // Extraer todas las recetas usadas en el plan
    const recipeIds = [];
    (plan.dias || []).forEach(d => {
      (d.comidas || []).forEach(m => {
        if (m.recetaId) {
          recipeIds.push(m.recetaId);
        }
      });
    });

    // Aprobar también esas recetas (si estaban en borrador/pending)
    if (recipeIds.length) {
      await Recipe.updateMany(
        { _id: { $in: recipeIds }, status: { $in: ['draft', 'pending'] } },
        {
          $set: {
            status: 'approved',
            nutriReviewer: req.user.uid,
            reviewerNotes: req.body.notes || ''
          }
        }
      );
    }

    // Opcional: devolver el plan actualizado
    const refreshed = await Plan.findById(id).lean();
    res.json({ ok: true, plan: refreshed });
  } catch (err) {
    next(err);
  }
};

exports.getAllPlans = async (req, res, next) => {
  try {
    const plans = await Plan.find().populate('userId', 'name email role').sort({ createdAt: -1 });
    res.json({ ok: true, plans });
  } catch (err) { console.error('Error al obtener planes:', err); res.status(500).json({ ok: false, msg: 'Error al obtener los planes' }); }
};
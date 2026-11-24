require("dotenv").config();
const mongoose = require("mongoose");
const { Concern, Ingredient } = require("./models/SkinKnowledge");

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const MODEL = "gemini-2.5-flash";

// High-traffic skincare topics to build authority around
const CONCERNS_TO_GENERATE = [
  { slug: "adult-hormonal-acne", title: "Adult Hormonal Acne" },
  { slug: "dry-flaky-skin", title: "Dry & Flaky Skin" },
  { slug: "fine-lines-and-wrinkles", title: "Fine Lines & Wrinkles" },
  { slug: "redness-and-rosacea-prone-skin", title: "Redness & Rosacea-Prone Skin" },
  { slug: "enlarged-pores-and-oily-skin", title: "Enlarged Pores & Oily Skin" },
  { slug: "dull-uneven-skin-texture", title: "Dull & Uneven Skin Texture" },
  { slug: "under-eye-dark-circles-puffiness", title: "Under-Eye Dark Circles & Puffiness" },
  { slug: "sensitive-reactive-skin", title: "Sensitive & Reactive Skin" }
];

const INGREDIENTS_TO_GENERATE = [
  { slug: "retinol", name: "Retinol" },
  { slug: "vitamin-c", name: "Vitamin C" },
  { slug: "salicylic-acid", name: "Salicylic Acid" },
  { slug: "ceramides", name: "Ceramides" },
  { slug: "peptides", name: "Peptides" },
  { slug: "azelaic-acid", name: "Azelaic Acid" },
  { slug: "squalane", name: "Squalane" },
  { slug: "glycolic-acid", name: "Glycolic Acid" }
];

async function askGeminiJson(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.4
      }
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API Error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Empty response from Gemini");
  return JSON.parse(text);
}

async function generateConcern({ slug, title }) {
  const prompt = `
You are writing an authoritative, practical skincare guide for Susan's Beauty Consulting (founded by Susan Coke, a 5-time Regional Sales Associate of the Year beauty consultant).
Write a helpful, non-medical, easy-to-understand skincare protocol for: "${title}".

Return ONLY valid JSON with these exact keys:
{
  "answerCapsule": "2-3 sentence direct answer summarizing what causes it and the best first step.",
  "overview": "1 short paragraph explaining how this skin concern behaves.",
  "commonTriggers": ["trigger 1", "trigger 2", "trigger 3"],
  "routineGuidance": {
    "amSteps": ["step 1", "step 2", "step 3"],
    "pmSteps": ["step 1", "step 2", "step 3"],
    "avoidList": ["what to avoid 1", "what to avoid 2"]
  },
  "recommendedIngredientSlugs": ["niacinamide", "hyaluronic-acid", "ceramides"],
  "faqs": [
    { "question": "Common search question 1?", "answer": "Clear 2-sentence answer." },
    { "question": "Common search question 2?", "answer": "Clear 2-sentence answer." },
    { "question": "Common search question 3?", "answer": "Clear 2-sentence answer." }
  ]
}
Keep recommendedIngredientSlugs lowercase with hyphens (e.g., "salicylic-acid", "retinol", "vitamin-c", "ceramides", "niacinamide", "hyaluronic-acid", "peptides", "azelaic-acid", "squalane", "glycolic-acid").
`;

  const generated = await askGeminiJson(prompt);
  await Concern.updateOne(
    { slug },
    {
      $set: {
        slug,
        title,
        ...generated,
        authoredBy: "Susan Coke",
        isPublished: true
      }
    },
    { upsert: true }
  );
  console.log(`[CONCERN SAVED] /concerns/${slug}`);
}

async function generateIngredient({ slug, name }) {
  const prompt = `
You are writing an authoritative skincare ingredient breakdown for Susan's Beauty Consulting (founded by beauty consultant Susan Coke).
Write a clear, practical guide for the skincare ingredient: "${name}".

Return ONLY valid JSON with these exact keys:
{
  "inciName": "Official INCI name(s)",
  "answerCapsule": "2-3 sentence direct answer explaining what it is and who it helps most.",
  "whatItDoes": "1 short paragraph explaining how it works on the skin.",
  "bestForConcerns": ["skin-barrier-repair", "dry-flaky-skin"],
  "usageTips": ["tip 1", "tip 2", "tip 3"],
  "pairingNotes": {
    "pairsWellWith": ["ingredient 1", "ingredient 2"],
    "cautionWith": ["caution 1", "caution 2"]
  },
  "faqs": [
    { "question": "Common search question 1?", "answer": "Clear 2-sentence answer." },
    { "question": "Common search question 2?", "answer": "Clear 2-sentence answer." },
    { "question": "Common search question 3?", "answer": "Clear 2-sentence answer." }
  ]
}
Keep bestForConcerns lowercase with hyphens matching concern slugs.
`;

  const generated = await askGeminiJson(prompt);
  await Ingredient.updateOne(
    { slug },
    {
      $set: {
        slug,
        name,
        ...generated,
        authoredBy: "Susan Coke",
        isPublished: true
      }
    },
    { upsert: true }
  );
  console.log(`[INGREDIENT SAVED] /ingredients/${slug}`);
}

async function run() {
  if (!MONGO_URI) throw new Error("Missing MONGO_URI in .env");
  if (!GEMINI_API_KEY) throw new Error("Missing GEMINI_API_KEY in .env");

  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB. Generating authority hub with Gemini...\n");

  for (const item of CONCERNS_TO_GENERATE) {
    try {
      await generateConcern(item);
    } catch (err) {
      console.error(`[ERROR] ${item.slug}:`, err.message);
    }
  }

  for (const item of INGREDIENTS_TO_GENERATE) {
    try {
      await generateIngredient(item);
    } catch (err) {
      console.error(`[ERROR] ${item.slug}:`, err.message);
    }
  }

  console.log("\n✅ Authority Hub generation complete!");
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

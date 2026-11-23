/**
 * Susan's Beauty Consulting — Organic Growth Engine Patch Installer
 * Installs:
 *  - Step 1: E-E-A-T Person & Organization JSON-LD
 *  - Step 2: Dynamic /sitemap.xml with LastMod & Caching
 *  - Step 3: MongoDB Concern & Ingredient Models + Idempotent Seeder
 *  - Step 4: Bot Interceptor for /concerns/:slug and /ingredients/:slug
 *  - Step 5: React Internal Link Mesh & AI Diagnostic Bridge Components
 */

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();

// Auto-detect React src directory (supports /client/src or /src)
const reactSrcDir = fs.existsSync(path.join(ROOT, "client", "src"))
  ? path.join("client", "src")
  : "src";

function writeFileSafe(relativePath, content) {
  const fullPath = path.join(ROOT, relativePath);
  const dir = path.dirname(fullPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (fs.existsSync(fullPath)) {
    fs.copyFileSync(fullPath, `${fullPath}.bak`);
    console.log(`[BACKUP] Existing file backed up to ${relativePath}.bak`);
  }

  fs.writeFileSync(fullPath, content.trimStart(), "utf8");
  console.log(`[CREATED] ${relativePath}`);
}

// ============================================================================
// 1. MongoDB Models (Step 3)
// ============================================================================
const skinKnowledgeModel = `
const mongoose = require("mongoose");

const faqItemSchema = new mongoose.Schema(
  {
    question: { type: String, required: true, trim: true },
    answer: { type: String, required: true, trim: true }
  },
  { _id: false }
);

const concernSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    title: { type: String, required: true, trim: true },
    answerCapsule: { type: String, required: true, trim: true },
    overview: { type: String, required: true, trim: true },
    commonTriggers: [{ type: String, trim: true }],
    routineGuidance: {
      amSteps: [{ type: String, trim: true }],
      pmSteps: [{ type: String, trim: true }],
      avoidList: [{ type: String, trim: true }]
    },
    recommendedIngredientSlugs: [{ type: String, lowercase: true, trim: true }],
    relatedProductSlugs: [{ type: String, trim: true }],
    faqs: { type: [faqItemSchema], default: [] },
    authoredBy: { type: String, default: "Susan Coke", trim: true },
    isPublished: { type: Boolean, default: true, index: true }
  },
  { timestamps: true }
);

const ingredientSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    name: { type: String, required: true, trim: true },
    inciName: { type: String, trim: true },
    answerCapsule: { type: String, required: true, trim: true },
    whatItDoes: { type: String, required: true, trim: true },
    bestForConcerns: [{ type: String, lowercase: true, trim: true }],
    usageTips: [{ type: String, trim: true }],
    pairingNotes: {
      pairsWellWith: [{ type: String, trim: true }],
      cautionWith: [{ type: String, trim: true }]
    },
    relatedProductSlugs: [{ type: String, trim: true }],
    faqs: { type: [faqItemSchema], default: [] },
    authoredBy: { type: String, default: "Susan Coke", trim: true },
    isPublished: { type: Boolean, default: true, index: true }
  },
  { timestamps: true }
);

const Concern = mongoose.models.Concern || mongoose.model("Concern", concernSchema);
const Ingredient = mongoose.models.Ingredient || mongoose.model("Ingredient", ingredientSchema);

module.exports = { Concern, Ingredient };
`;

// ============================================================================
// 2. Idempotent Seeder (Step 3)
// ============================================================================
const skinKnowledgeSeeder = `
require("dotenv").config();
const mongoose = require("mongoose");
const { Concern, Ingredient } = require("../models/SkinKnowledge");

const SEED_CONCERNS = [
  {
    slug: "skin-barrier-repair",
    title: "Skin Barrier Repair",
    answerCapsule:
      "A compromised skin barrier often shows up as tightness, stinging, flaking, redness, or sudden sensitivity. Restoring it starts with pausing harsh exfoliants, using a gentle non-stripping cleanser, and layering barrier-supporting humectants and moisturizers consistently.",
    overview:
      "The outermost layer of your skin (the stratum corneum) protects against moisture loss and outside irritants. Over-exfoliating, dry weather, or harsh cleansers can leave skin feeling reactive and dehydrated.",
    commonTriggers: [
      "Overusing strong acids or retinoids without recovery days",
      "Hot water or foaming cleansers that strip natural oils",
      "Dry indoor air, wind, or skipping daily sunscreen"
    ],
    routineGuidance: {
      amSteps: [
        "Rinse or cleanse gently with lukewarm water",
        "Apply a hydrating or barrier-calming serum on slightly damp skin",
        "Seal with a nourishing moisturizer and broad-spectrum SPF"
      ],
      pmSteps: [
        "Cleanse gently without harsh scrubbing",
        "Apply a soothing barrier serum or cream",
        "Lock in hydration with a rich moisturizer"
      ],
      avoidList: [
        "Physical scrubs and multiple exfoliating acids at once",
        "Fragrance-heavy or drying treatments until stinging stops"
      ]
    },
    recommendedIngredientSlugs: ["niacinamide", "hyaluronic-acid"],
    relatedProductSlugs: [],
    faqs: [
      {
        question: "How long does it take to repair a damaged skin barrier?",
        answer: "Mild irritation often improves within a few days to two weeks of keeping your routine simple and consistent, while deeper barrier recovery can take three to four weeks."
      },
      {
        question: "Should I stop all active ingredients while repairing my barrier?",
        answer: "Yes—pause exfoliating acids, retinoids, and strong treatments until redness, tightness, and stinging settle down, then reintroduce actives slowly."
      }
    ],
    authoredBy: "Susan Coke",
    isPublished: true
  },
  {
    slug: "hyperpigmentation-dark-spots",
    title: "Hyperpigmentation & Dark Spots",
    answerCapsule:
      "Hyperpigmentation happens when excess melanin builds up in patches after breakouts, irritation, or sun exposure. Consistent daily sun protection paired with targeted brightening ingredients like niacinamide helps fade dark spots evenly.",
    overview:
      "Uneven tone and post-blemish marks linger when UV rays stimulate pigment-producing cells. Patience and daily SPF are essential so fading progress isn't undone by sunlight.",
    commonTriggers: [
      "Unprotected sun exposure on healing blemishes or spots",
      "Picking or squeezing breakouts and dry patches",
      "Post-inflammatory marks after irritation"
    ],
    routineGuidance: {
      amSteps: [
        "Gentle cleanse",
        "Apply a tone-evening serum such as niacinamide",
        "Finish with daily broad-spectrum sunscreen"
      ],
      pmSteps: [
        "Cleanse gently",
        "Apply targeted treatment or hydrating serum",
        "Moisturize thoroughly overnight"
      ],
      avoidList: [
        "Picking blemishes",
        "Skipping sunscreen on cloudy days"
      ]
    },
    recommendedIngredientSlugs: ["niacinamide"],
    relatedProductSlugs: [],
    faqs: [
      {
        question: "Why do dark spots get darker in the sun?",
        answer: "Sunlight triggers melanin production to protect skin cells, which deepens existing pigment spots and makes post-acne marks last longer."
      }
    ],
    authoredBy: "Susan Coke",
    isPublished: true
  }
];

const SEED_INGREDIENTS = [
  {
    slug: "niacinamide",
    name: "Niacinamide",
    inciName: "Niacinamide",
    answerCapsule:
      "Niacinamide is a form of vitamin B3 widely used in skincare to support skin barrier comfort, help balance visible oiliness, and improve the look of uneven tone and enlarged-looking pores.",
    whatItDoes:
      "Supports healthy surface lipids, calms the look of redness, and promotes a smoother, more balanced-looking complexion without heavy greasiness.",
    bestForConcerns: ["skin-barrier-repair", "hyperpigmentation-dark-spots"],
    usageTips: [
      "Apply once or twice daily after cleansing and before heavier creams.",
      "If your skin is sensitive, start with a gentle 2% to 5% formula."
    ],
    pairingNotes: {
      pairsWellWith: ["Hyaluronic Acid", "Ceramides", "Daily SPF"],
      cautionWith: ["Layering multiple strong acids at the same time if skin is sensitive"]
    },
    relatedProductSlugs: [],
    faqs: [
      {
        question: "Can I use niacinamide every day?",
        answer: "Yes, niacinamide is generally well-suited for daily morning and evening routines once patch-tested."
      }
    ],
    authoredBy: "Susan Coke",
    isPublished: true
  },
  {
    slug: "hyaluronic-acid",
    name: "Hyaluronic Acid",
    inciName: "Hydrolyzed Hyaluronic Acid / Sodium Hyaluronate",
    answerCapsule:
      "Hyaluronic acid is a humectant ingredient that attracts and holds water near the skin's surface to plump the look of fine dehydration lines and relieve tightness.",
    whatItDoes:
      "Boosts surface hydration and cushion so skin feels softer and more supple without clogging pores.",
    bestForConcerns: ["skin-barrier-repair"],
    usageTips: [
      "Apply onto slightly damp skin rather than bone-dry skin.",
      "Follow with a moisturizer so hydration stays locked in."
    ],
    pairingNotes: {
      pairsWellWith: ["Niacinamide", "Moisturizers", "Sunscreen"],
      cautionWith: ["Applying in very dry air without a moisturizer layer on top"]
    },
    relatedProductSlugs: [],
    faqs: [
      {
        question: "Does hyaluronic acid replace moisturizer?",
        answer: "No—hyaluronic acid binds water, while a moisturizer helps seal that hydration in and supports the skin barrier."
      }
    ],
    authoredBy: "Susan Coke",
    isPublished: true
  }
];

async function seedSkinKnowledge() {
  for (const concern of SEED_CONCERNS) {
    await Concern.updateOne({ slug: concern.slug }, { $set: concern }, { upsert: true });
  }
  for (const ingredient of SEED_INGREDIENTS) {
    await Ingredient.updateOne({ slug: ingredient.slug }, { $set: ingredient }, { upsert: true });
  }
  return { concerns: SEED_CONCERNS.length, ingredients: SEED_INGREDIENTS.length };
}

if (require.main === module) {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("Missing MONGODB_URI environment variable.");
    process.exit(1);
  }
  mongoose.connect(uri).then(async () => {
    const res = await seedSkinKnowledge();
    console.log("Seeded Skin Knowledge:", res);
    await mongoose.disconnect();
    process.exit(0);
  }).catch((err) => {
    console.error("Seeding error:", err);
    process.exit(1);
  });
}

module.exports = { seedSkinKnowledge };
`;

// ============================================================================
// 3. Unified Express Engine (Steps 1, 2, & 4)
// ============================================================================
const organicGrowthMiddleware = `
const { Concern, Ingredient } = require("../models/SkinKnowledge");

const BASE_URL = "https://susansbeautyconsulting.com";
const SITEMAP_CACHE_TTL_MS = 10 * 60 * 1000;
let cachedSitemapXml = null;
let sitemapCachedAt = 0;

function buildEeatJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": ["Organization", "BeautySalon", "OnlineStore"],
        "@id": \`\${BASE_URL}/#organization\`,
        name: "Susan's Beauty Consulting",
        url: BASE_URL,
        description: "Personalized skincare guidance, curated beauty formulations, and AI-assisted skin diagnostics led by beauty consultant Susan Coke in Salina, Kansas.",
        areaServed: { "@type": "Place", name: "Salina, Kansas and United States" },
        founder: { "@id": \`\${BASE_URL}/#susan-coke\` },
        employee: { "@id": \`\${BASE_URL}/#susan-coke\` },
        sameAs: [BASE_URL, "https://github.com/susans-beauty-11/Susans-Beauty"]
      },
      {
        "@type": "Person",
        "@id": \`\${BASE_URL}/#susan-coke\`,
        name: "Susan Coke",
        jobTitle: "Beauty Consultant & Founder",
        worksFor: { "@id": \`\${BASE_URL}/#organization\` },
        homeLocation: { "@type": "Place", name: "Salina, Kansas" },
        award: "Regional Sales Associate of the Year (5 consecutive years)",
        knowsAbout: ["Skincare routines", "Skin barrier care", "Cosmetic ingredients", "Personalized beauty consulting", "Skin diagnostics"],
        url: BASE_URL
      }
    ]
  };
}

function escapeXml(val = "") {
  return String(val).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function escapeHtml(str = "") {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function toIsoDate(dateInput, fallback = new Date()) {
  const d = dateInput ? new Date(dateInput) : fallback;
  return Number.isNaN(d.getTime()) ? fallback.toISOString() : d.toISOString();
}

function toSlugSegment(val = "") {
  return encodeURIComponent(String(val).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""));
}

function buildUrlNode({ loc, lastmod, changefreq = "weekly", priority = "0.7" }) {
  return [
    "  <url>",
    \`    <loc>\${escapeXml(loc)}</loc>\`,
    \`    <lastmod>\${escapeXml(toIsoDate(lastmod))}</lastmod>\`,
    \`    <changefreq>\${escapeXml(changefreq)}</changefreq>\`,
    \`    <priority>\${escapeXml(priority)}</priority>\`,
    "  </url>"
  ].join("\\n");
}

function isBotRequest(ua = "") {
  return /googlebot|bingbot|yandex|baiduspider|duckduckbot|slurp|twitterbot|facebookexternalhit|linkedinbot|applebot|semrushbot|ahrefsbot|gptbot|chatgpt-user|claudebot|anthropic-ai|perplexitybot|cohere-ai/i.test(ua);
}

function buildHubJsonLd({ title, description, url, faqs = [], dateModified }) {
  const graph = [
    ...buildEeatJsonLd()["@graph"],
    {
      "@type": "Article",
      "@id": \`\${url}#article\`,
      headline: title,
      description,
      url,
      dateModified: toIsoDate(dateModified),
      author: { "@id": \`\${BASE_URL}/#susan-coke\` },
      publisher: { "@id": \`\${BASE_URL}/#organization\` },
      inLanguage: "en-US"
    }
  ];

  if (faqs.length > 0) {
    graph.push({
      "@type": "FAQPage",
      "@id": \`\${url}#faq\`,
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.question,
        acceptedAnswer: { "@type": "Answer", text: f.answer }
      }))
    });
  }

  return { "@context": "https://schema.org", "@graph": graph };
}

function renderBotPage({ title, subtitle, capsule, bodyHtml, url, faqs, dateModified }) {
  const jsonLd = JSON.stringify(buildHubJsonLd({ title, description: capsule, url, faqs, dateModified })).replace(/</g, "\\\\u003c");
  return \`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>\${escapeHtml(title)} | Susan's Beauty Consulting</title>
  <meta name="description" content="\${escapeHtml(capsule)}" />
  <link rel="canonical" href="\${url}" />
  <meta name="robots" content="index, follow" />
  <script type="application/ld+json">\${jsonLd}</script>
</head>
<body>
  <article>
    <header>
      <h1>\${escapeHtml(title)}</h1>
      <p>\${escapeHtml(subtitle)}</p>
    </header>
    <section><strong>Quick Answer:</strong> <p>\${escapeHtml(capsule)}</p></section>
    \${bodyHtml}
  </article>
</body>
</html>\`;
}

function registerOrganicGrowthEngine(app, ProductModel) {
  // Dynamic XML Sitemap
  app.get("/sitemap.xml", async (req, res) => {
    try {
      if (cachedSitemapXml && Date.now() - sitemapCachedAt < SITEMAP_CACHE_TTL_MS) {
        res.set("Content-Type", "application/xml; charset=utf-8");
        return res.status(200).send(cachedSitemapXml);
      }

      const now = new Date();
      const nodes = [
        buildUrlNode({ loc: \`\${BASE_URL}/\`, lastmod: now, changefreq: "daily", priority: "1.0" }),
        buildUrlNode({ loc: \`\${BASE_URL}/concerns\`, lastmod: now, changefreq: "weekly", priority: "0.8" }),
        buildUrlNode({ loc: \`\${BASE_URL}/ingredients\`, lastmod: now, changefreq: "weekly", priority: "0.8" })
      ];

      const [concerns, ingredients, products] = await Promise.all([
        Concern.find({ isPublished: true }, { slug: 1, updatedAt: 1 }).lean(),
        Ingredient.find({ isPublished: true }, { slug: 1, updatedAt: 1 }).lean(),
        ProductModel ? ProductModel.find({}, { slug: 1, category: 1, updatedAt: 1, createdAt: 1 }).lean() : Promise.resolve([])
      ]);

      for (const c of concerns) {
        nodes.push(buildUrlNode({ loc: \`\${BASE_URL}/concerns/\${c.slug}\`, lastmod: c.updatedAt, priority: "0.9" }));
      }
      for (const i of ingredients) {
        nodes.push(buildUrlNode({ loc: \`\${BASE_URL}/ingredients/\${i.slug}\`, lastmod: i.updatedAt, priority: "0.9" }));
      }

      const catSet = new Set();
      for (const p of products) {
        const slugOrId = p.slug ? encodeURIComponent(p.slug) : String(p._id);
        nodes.push(buildUrlNode({ loc: \`\${BASE_URL}/product/\${slugOrId}\`, lastmod: p.updatedAt || p.createdAt, priority: "0.8" }));
        if (p.category) catSet.add(String(p.category).trim());
      }
      for (const cat of catSet) {
        nodes.push(buildUrlNode({ loc: \`\${BASE_URL}/category/\${toSlugSegment(cat)}\`, lastmod: now, priority: "0.7" }));
      }

      const xml = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ...nodes,
        "</urlset>"
      ].join("\\n");

      cachedSitemapXml = xml;
      sitemapCachedAt = Date.now();
      res.set("Content-Type", "application/xml; charset=utf-8");
      res.set("Cache-Control", "public, max-age=600");
      return res.status(200).send(xml);
    } catch (err) {
      console.error("Sitemap error:", err);
      return res.status(500).type("application/xml").send("<error>Sitemap generation failed</error>");
    }
  });

  // Bot Interceptor: Concerns
  app.get("/concerns/:slug", async (req, res, next) => {
    if (!isBotRequest(req.headers["user-agent"])) return next();
    try {
      const concern = await Concern.findOne({ slug: req.params.slug.toLowerCase().trim(), isPublished: true }).lean();
      if (!concern) return res.status(404).send("Concern not found");

      const bodyHtml = \`
        <section><h2>Overview</h2><p>\${escapeHtml(concern.overview)}</p></section>
        \${(concern.faqs || []).map((f) => \`<div><h3>\${escapeHtml(f.question)}</h3><p>\${escapeHtml(f.answer)}</p></div>\`).join("")}
      \`;

      const html = renderBotPage({
        title: concern.title,
        subtitle: "Consultant Protocol by Susan Coke | Salina, Kansas",
        capsule: concern.answerCapsule,
        bodyHtml,
        url: \`\${BASE_URL}/concerns/\${concern.slug}\`,
        faqs: concern.faqs,
        dateModified: concern.updatedAt
      });

      res.set("Content-Type", "text/html; charset=utf-8");
      return res.status(200).send(html);
    } catch (err) {
      console.error("Bot concern SSR error:", err);
      return next();
    }
  });

  // Bot Interceptor: Ingredients
  app.get("/ingredients/:slug", async (req, res, next) => {
    if (!isBotRequest(req.headers["user-agent"])) return next();
    try {
      const ing = await Ingredient.findOne({ slug: req.params.slug.toLowerCase().trim(), isPublished: true }).lean();
      if (!ing) return res.status(404).send("Ingredient not found");

      const bodyHtml = \`
        <section><h2>How It Works</h2><p>\${escapeHtml(ing.whatItDoes)}</p></section>
        \${(ing.faqs || []).map((f) => \`<div><h3>\${escapeHtml(f.question)}</h3><p>\${escapeHtml(f.answer)}</p></div>\`).join("")}
      \`;

      const html = renderBotPage({
        title: ing.name,
        subtitle: "Formulation Notes by Susan Coke | Susan's Beauty Consulting",
        capsule: ing.answerCapsule,
        bodyHtml,
        url: \`\${BASE_URL}/ingredients/\${ing.slug}\`,
        faqs: ing.faqs,
        dateModified: ing.updatedAt
      });

      res.set("Content-Type", "text/html; charset=utf-8");
      return res.status(200).send(html);
    } catch (err) {
      console.error("Bot ingredient SSR error:", err);
      return next();
    }
  });
}

module.exports = { registerOrganicGrowthEngine, buildEeatJsonLd };
`;

// ============================================================================
// 4. React Components (Step 5)
// ============================================================================
const skinTagBadgeJsx = `
import React from "react";

export default function SkinTagBadge({ type = "ingredient", slug, label, onClick }) {
  const path = type === "ingredient" ? \`/ingredients/\${slug}\` : \`/concerns/\${slug}\`;
  const styles =
    type === "ingredient"
      ? "bg-stone-100 text-stone-800 border-stone-300 hover:bg-stone-200"
      : "bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100";

  return (
    <a
      href={path}
      onClick={(e) => {
        if (onClick) {
          e.preventDefault();
          onClick({ type, slug });
        }
      }}
      className={\`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border transition-colors mr-2 mb-2 \${styles}\`}
    >
      <span className="mr-1">{type === "ingredient" ? "🧪" : "✨"}</span>
      {label}
    </a>
  );
}
`;

const productKnowledgeBridgeJsx = `
import React from "react";
import SkinTagBadge from "./SkinTagBadge";

export default function ProductKnowledgeBridge({ product, onNavigateTag, onOpenDiagnostic }) {
  if (!product) return null;
  const { activeIngredients = [], targetConcerns = [], seoAnswerCapsule } = product;

  return (
    <div className="mt-6 border-t border-stone-200 pt-5 space-y-4">
      {targetConcerns.length > 0 && (
        <div>
          <span className="block text-xs font-semibold uppercase tracking-wider text-stone-500 mb-1.5">
            Formulated For Concerns
          </span>
          <div className="flex flex-wrap">
            {targetConcerns.map((c) => (
              <SkinTagBadge key={c.slug} type="concern" slug={c.slug} label={c.name || c.slug.replace(/-/g, " ")} onClick={onNavigateTag} />
            ))}
          </div>
        </div>
      )}

      {activeIngredients.length > 0 && (
        <div>
          <span className="block text-xs font-semibold uppercase tracking-wider text-stone-500 mb-1.5">
            Key Active Ingredients
          </span>
          <div className="flex flex-wrap">
            {activeIngredients.map((i) => (
              <SkinTagBadge key={i.slug} type="ingredient" slug={i.slug} label={i.name || i.slug.replace(/-/g, " ")} onClick={onNavigateTag} />
            ))}
          </div>
        </div>
      )}

      {seoAnswerCapsule && (
        <div className="rounded-lg bg-stone-50 p-3.5 border border-stone-200 text-sm text-stone-700">
          <strong className="block text-stone-900 font-medium mb-1">Susan's Formulation Insight:</strong>
          {seoAnswerCapsule}
        </div>
      )}

      <div className="bg-rose-50/60 rounded-lg p-3 text-xs text-rose-900 flex items-center justify-between">
        <span>Not sure if this matches your current skin barrier state?</span>
        <button type="button" onClick={onOpenDiagnostic} className="font-semibold underline ml-2 hover:text-rose-700 shrink-0">
          Take Skin Diagnostic →
        </button>
      </div>
    </div>
  );
}
`;

// ============================================================================
// Execute Patch
// ============================================================================
console.log("\\nApplying Susan's Beauty Consulting Organic Growth Patch...\\n");

writeFileSafe(path.join("models", "SkinKnowledge.js"), skinKnowledgeModel);
writeFileSafe(path.join("seeds", "seedSkinKnowledge.js"), skinKnowledgeSeeder);
writeFileSafe(path.join("middleware", "organicGrowthEngine.js"), organicGrowthMiddleware);
writeFileSafe(path.join(reactSrcDir, "components", "SkinTagBadge.jsx"), skinTagBadgeJsx);
writeFileSafe(path.join(reactSrcDir, "components", "ProductKnowledgeBridge.jsx"), productKnowledgeBridgeJsx);

console.log("\\n✅ Patch files installed successfully!");
console.log("\\nNEXT STEPS:");
console.log("1. Add these 2 lines to server.js (BEFORE any catch-all SPA route):");
console.log('   const { registerOrganicGrowthEngine } = require("./middleware/organicGrowthEngine");');
console.log("   registerOrganicGrowthEngine(app, Product); // Replace Product with your Mongoose model");
console.log("\\n2. Seed your MongoDB knowledge hub:");
console.log("   node seeds/seedSkinKnowledge.js\\n");

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
        "@id": `${BASE_URL}/#organization`,
        name: "Susan's Beauty Consulting",
        url: BASE_URL,
        description: "Personalized skincare guidance, curated beauty formulations, and AI-assisted skin diagnostics led by beauty consultant Susan Coke in Salina, Kansas.",
        areaServed: { "@type": "Place", name: "Salina, Kansas and United States" },
        founder: { "@id": `${BASE_URL}/#susan-coke` },
        employee: { "@id": `${BASE_URL}/#susan-coke` },
        sameAs: [BASE_URL, "https://github.com/susans-beauty-11/Susans-Beauty"]
      },
      {
        "@type": "Person",
        "@id": `${BASE_URL}/#susan-coke`,
        name: "Susan Coke",
        jobTitle: "Beauty Consultant & Founder",
        worksFor: { "@id": `${BASE_URL}/#organization` },
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
    `    <loc>${escapeXml(loc)}</loc>`,
    `    <lastmod>${escapeXml(toIsoDate(lastmod))}</lastmod>`,
    `    <changefreq>${escapeXml(changefreq)}</changefreq>`,
    `    <priority>${escapeXml(priority)}</priority>`,
    "  </url>"
  ].join("\n");
}

function isBotRequest(ua = "") {
  return /googlebot|bingbot|yandex|baiduspider|duckduckbot|slurp|twitterbot|facebookexternalhit|linkedinbot|applebot|semrushbot|ahrefsbot|gptbot|chatgpt-user|claudebot|anthropic-ai|perplexitybot|cohere-ai/i.test(ua);
}

function buildHubJsonLd({ title, description, url, faqs = [], dateModified }) {
  const graph = [
    ...buildEeatJsonLd()["@graph"],
    {
      "@type": "Article",
      "@id": `${url}#article`,
      headline: title,
      description,
      url,
      dateModified: toIsoDate(dateModified),
      author: { "@id": `${BASE_URL}/#susan-coke` },
      publisher: { "@id": `${BASE_URL}/#organization` },
      inLanguage: "en-US"
    }
  ];

  if (faqs.length > 0) {
    graph.push({
      "@type": "FAQPage",
      "@id": `${url}#faq`,
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
  const jsonLd = JSON.stringify(buildHubJsonLd({ title, description: capsule, url, faqs, dateModified })).replace(/</g, "\\u003c");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)} | Susan's Beauty Consulting</title>
  <meta name="description" content="${escapeHtml(capsule)}" />
  <link rel="canonical" href="${url}" />
  <meta name="robots" content="index, follow" />
  <script type="application/ld+json">${jsonLd}</script>
</head>
<body>
  <article>
    <header>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(subtitle)}</p>
    </header>
    <section><strong>Quick Answer:</strong> <p>${escapeHtml(capsule)}</p></section>
    ${bodyHtml}
  </article>
</body>
</html>`;
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
        buildUrlNode({ loc: `${BASE_URL}/`, lastmod: now, changefreq: "daily", priority: "1.0" }),
        buildUrlNode({ loc: `${BASE_URL}/concerns`, lastmod: now, changefreq: "weekly", priority: "0.8" }),
        buildUrlNode({ loc: `${BASE_URL}/ingredients`, lastmod: now, changefreq: "weekly", priority: "0.8" })
      ];

      const [concerns, ingredients, products] = await Promise.all([
        Concern.find({ isPublished: true }, { slug: 1, updatedAt: 1 }).lean(),
        Ingredient.find({ isPublished: true }, { slug: 1, updatedAt: 1 }).lean(),
        ProductModel ? ProductModel.find({}, { slug: 1, category: 1, updatedAt: 1, createdAt: 1 }).lean() : Promise.resolve([])
      ]);

      for (const c of concerns) {
        nodes.push(buildUrlNode({ loc: `${BASE_URL}/concerns/${c.slug}`, lastmod: c.updatedAt, priority: "0.9" }));
      }
      for (const i of ingredients) {
        nodes.push(buildUrlNode({ loc: `${BASE_URL}/ingredients/${i.slug}`, lastmod: i.updatedAt, priority: "0.9" }));
      }

      const catSet = new Set();
      for (const p of products) {
        const slugOrId = p.slug ? encodeURIComponent(p.slug) : String(p._id);
        nodes.push(buildUrlNode({ loc: `${BASE_URL}/product/${slugOrId}`, lastmod: p.updatedAt || p.createdAt, priority: "0.8" }));
        if (p.category) catSet.add(String(p.category).trim());
      }
      for (const cat of catSet) {
        nodes.push(buildUrlNode({ loc: `${BASE_URL}/category/${toSlugSegment(cat)}`, lastmod: now, priority: "0.7" }));
      }

      const xml = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ...nodes,
        "</urlset>"
      ].join("\n");

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

      const bodyHtml = `
        <section><h2>Overview</h2><p>${escapeHtml(concern.overview)}</p></section>
        ${(concern.faqs || []).map((f) => `<div><h3>${escapeHtml(f.question)}</h3><p>${escapeHtml(f.answer)}</p></div>`).join("")}
      `;

      const html = renderBotPage({
        title: concern.title,
        subtitle: "Consultant Protocol by Susan Coke | Salina, Kansas",
        capsule: concern.answerCapsule,
        bodyHtml,
        url: `${BASE_URL}/concerns/${concern.slug}`,
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

      const bodyHtml = `
        <section><h2>How It Works</h2><p>${escapeHtml(ing.whatItDoes)}</p></section>
        ${(ing.faqs || []).map((f) => `<div><h3>${escapeHtml(f.question)}</h3><p>${escapeHtml(f.answer)}</p></div>`).join("")}
      `;

      const html = renderBotPage({
        title: ing.name,
        subtitle: "Formulation Notes by Susan Coke | Susan's Beauty Consulting",
        capsule: ing.answerCapsule,
        bodyHtml,
        url: `${BASE_URL}/ingredients/${ing.slug}`,
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

#!/usr/bin/env node
/**
 * apply_cj_phase5_scaling_hardening.js
 *
 * Phase 5 (Final Phase) of the Uncapped CJ Dropshipping Skincare & Beauty Plan.
 * Safely and idempotently patches `server.js` to:
 *  1. Convert `GET /llms-full.txt` to a memory-safe MongoDB `.cursor({ batchSize: 200 })`
 *     stream using `res.write()` and lean minimal projections so AI crawlers never
 *     spike Render RAM even with 5,000+ uncapped skincare SKUs.
 *  2. Convert `GET /sitemap.xml` to a memory-safe MongoDB `.cursor({ batchSize: 250 })`
 *     stream (capped at 45,000 product URLs to stay strictly under Google's 50,000-URL
 *     sitemap protocol limit) with HTTP caching headers.
 *  3. Harden the daily `3:00 AM CST` (`America/Chicago`) cron job so it guards against
 *     overlapping crawls (`isCjSyncRunning`), runs the uncapped multi-page crawler, and
 *     persists any unexpected cron error cleanly into `CatalogSyncState`.
 *
 * Usage:
 *   node apply_cj_phase5_scaling_hardening.js
 *   node apply_cj_phase5_scaling_hardening.js path/to/server.js
 */

const fs = require('fs');
const path = require('path');

// ---------------- FILE DISCOVERY & IO HELPERS ---------------- //

const findFirstExistingFile = (candidates = []) => {
  for (const relPath of candidates) {
    if (!relPath) continue;
    const resolved = path.resolve(process.cwd(), relPath);
    if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
      return resolved;
    }
  }
  return null;
};

const readNormalized = (filePath) => {
  const raw = fs.readFileSync(filePath, 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  return {
    text: raw.replace(/\r\n/g, '\n'),
    eol
  };
};

const writeWithOriginalEol = (filePath, normalizedText, eol) => {
  const backupPath = `${filePath}.cj_phase5_${Date.now()}.bak`;
  fs.copyFileSync(filePath, backupPath);
  const output = eol === '\r\n' ? normalizedText.replace(/\n/g, '\r\n') : normalizedText;
  fs.writeFileSync(filePath, output, 'utf8');
  return backupPath;
};

// ---------------- PHASE 5 SERVER.JS PATCHER ---------------- //

const patchServerPhase5 = (serverPath) => {
  console.log(`\n🔧 Applying CJ Phase 5 (SEO/GEO Cursor Streaming & Cron Hardening) to: ${serverPath}`);
  let { text, eol } = readNormalized(serverPath);
  let changesApplied = 0;

  // ---- BLOCK 1: Stream /llms-full.txt via MongoDB .cursor() ---- //
  const llmsStartAnchor = '// 2. /llms-full.txt (Dynamic Full Product Corpus in Clean Markdown)';
  const llmsEndAnchor = '// 3. /robots.txt (Allows Public SEO Pages, Protects Member Dashboards & /api/)';

  const llmsStartIdx = text.indexOf(llmsStartAnchor);
  const llmsEndIdx = text.indexOf(llmsEndAnchor);

  const llmsStreamedBlock = [
    '// 2. /llms-full.txt (Phase 5: Cursor-Streamed Full Product Corpus in Clean Markdown)',
    "app.get('/llms-full.txt', async (req, res) => {",
    '  try {',
    '    const dbReady = mongoose.connection.readyState === 1;',
    '    const totalCount = dbReady ? await Product.countDocuments().catch(() => 0) : 0;',
    '',
    '    res.status(200).set({',
    "      'Content-Type': 'text/markdown; charset=utf-8',",
    "      'Cache-Control': 'public, max-age=1800, stale-while-revalidate=3600'",
    '    });',
    '',
    '    res.write(',
    '      `# Susan\'s Beauty Consulting - Full Catalog Corpus\\n\\n` +',
    '      `> Personalized beauty guidance, skincare education, and ongoing membership support.\\n\\n` +',
    '      `## Complete Boutique Inventory (${totalCount.toLocaleString()} Active Skincare & Beauty Items)\\n\\n`',
    '    );',
    '',
    '    if (dbReady && totalCount > 0) {',
    '      const cursor = Product.find({})',
    "        .select('_id title price variants.price ritualStep skinTypes skinConcerns keyActives sensitivityLabel seoAnswerCapsule description')",
    '        .sort({ purchaseCount: -1, viewCount: -1, _id: 1 })',
    '        .lean()',
    '        .cursor({ batchSize: 200 });',
    '',
    '      for await (const p of cursor) {',
    '        if (res.writableEnded || req.aborted) break;',
    '        const price = p.variants?.[0]?.price ?? p.price ?? 0;',
    "        const step = p.ritualStep || 'Step 3: Serum & Essence';",
    "        const skinTypes = Array.isArray(p.skinTypes) && p.skinTypes.length > 0 ? p.skinTypes.join(', ') : 'All Skin Types';",
    "        const concerns = Array.isArray(p.skinConcerns) && p.skinConcerns.length > 0 ? p.skinConcerns.join(', ') : 'Hydration';",
    "        const actives = Array.isArray(p.keyActives) && p.keyActives.length > 0 ? p.keyActives.join(', ') : 'Botanical Complex';",
    "        const sensitivity = p.sensitivityLabel || 'Gentle • High-Sensitivity Safe';",
    "        const geoSummary = typeof stripHtmlAndMarkdown === 'function'",
    "          ? stripHtmlAndMarkdown(p.seoAnswerCapsule || p.description || '')",
    "          : String(p.seoAnswerCapsule || p.description || '').replace(/<[^>]*>?/gm, ' ').replace(/\\s+/g, ' ').trim();",
    '',
    '        const entry =',
    "          `### ${p.title || 'Boutique Essential'}\\n` +",
    '          `- **URL:** ${BASE_SEO_URL}/?tab=Boutique&productId=${p._id}\\n` +',
    '          `- **Price:** $${Number(price).toFixed(2)}\\n` +',
    '          `- **Ritual Step:** ${step}\\n` +',
    '          `- **Best For Skin Types:** ${skinTypes}\\n` +',
    '          `- **Target Skin Concerns:** ${concerns}\\n` +',
    '          `- **Key Actives:** ${actives}\\n` +',
    '          `- **Sensitivity Profile:** ${sensitivity}\\n` +',
    "          `- **GEO Answer Capsule:** ${geoSummary || 'Curated skincare essential.'}\\n\\n`;",
    '',
    '        if (!res.write(entry)) {',
    "          await new Promise((resolve) => res.once('drain', resolve));",
    '        }',
    '      }',
    '    }',
    '',
    '    if (!res.writableEnded) {',
    '      res.end();',
    '    }',
    '  } catch (error) {',
    "    console.error('⚠️ Error streaming /llms-full.txt corpus:', error.message);",
    '    if (!res.headersSent) {',
    "      res.status(500).set('Content-Type', 'text/plain; charset=utf-8').send('Error generating LLM catalog corpus.');",
    '    } else if (!res.writableEnded) {',
    '      res.end();',
    '    }',
    '  }',
    '});',
    ''
  ].join('\n');

  if (text.includes('// 2. /llms-full.txt (Phase 5: Cursor-Streamed Full Product Corpus in Clean Markdown)')) {
    console.log('  ✓ [Block 1] /llms-full.txt already cursor-streamed (skipped)');
  } else if (llmsStartIdx !== -1 && llmsEndIdx > llmsStartIdx) {
    text = text.slice(0, llmsStartIdx) + llmsStreamedBlock + '\n' + text.slice(llmsEndIdx);
    changesApplied++;
    console.log('  ✅ [Block 1] Upgraded /llms-full.txt to 200-doc cursor stream with backpressure handling');
  } else {
    throw new Error('[Block 1] Could not locate /llms-full.txt -> /robots.txt range.');
  }

  // ---- BLOCK 2: Stream /sitemap.xml via MongoDB .cursor() ---- //
  const sitemapStartAnchor = '// 4. /sitemap.xml (Includes All 9 Public SEO Routes + Dynamic Boutique Products)';
  const sitemapStartIdx = text.indexOf(sitemapStartAnchor);

  const sitemapEndCandidates = [
    '// ---------------- LIVE STRIPE BALANCE, CJ WALLET & ORDER PIPELINE ENGINE ---------------- //',
    '// ============================================================================\n// UNIFIED GEO ENGINE:'
  ];

  let sitemapEndIdx = -1;
  if (sitemapStartIdx !== -1) {
    for (const cand of sitemapEndCandidates) {
      const idx = text.indexOf(cand, sitemapStartIdx);
      if (idx !== -1 && (sitemapEndIdx === -1 || idx < sitemapEndIdx)) {
        sitemapEndIdx = idx;
      }
    }
  }

  const sitemapStreamedBlock = [
    '// 4. /sitemap.xml (Phase 5: Cursor-Streamed XML 0.9 Sitemap — 9 Public SEO Routes + Up to 45,000 SKUs)',
    "app.get('/sitemap.xml', async (req, res) => {",
    '  try {',
    '    const todayIso = new Date().toISOString();',
    '',
    '    res.status(200).set({',
    "      'Content-Type': 'application/xml; charset=utf-8',",
    "      'X-Content-Type-Options': 'nosniff',",
    "      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=7200'",
    '    });',
    '',
    '    res.write(',
    "      '<?xml version=\"1.0\" encoding=\"UTF-8\"?>\\n' +",
    "      '<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\\n'",
    '    );',
    '',
    '    // Stream all 9 Nationwide Public SEO Pages first',
    '    for (const page of Object.values(PUBLIC_SEO_PAGES)) {',
    '      res.write(',
    "        '  <url>\\n' +",
    '        `    <loc>${BASE_SEO_URL}${page.path}</loc>\\n` +',
    '        `    <lastmod>${todayIso}</lastmod>\\n` +',
    '        `    <changefreq>${page.changefreq}</changefreq>\\n` +',
    '        `    <priority>${page.priority}</priority>\\n` +',
    "        '  </url>\\n'",
    '      );',
    '    }',
    '',
    '    // Stream Dynamic Product Pages via MongoDB cursor (capped at 45,000 for Google 50k XML protocol compliance)',
    '    if (mongoose.connection.readyState === 1) {',
    '      const cursor = Product.find({})',
    "        .select('_id lastSyncedAt')",
    '        .sort({ purchaseCount: -1, viewCount: -1, _id: 1 })',
    '        .limit(45000)',
    '        .lean()',
    '        .cursor({ batchSize: 250 });',
    '',
    '      for await (const p of cursor) {',
    '        if (res.writableEnded || req.aborted) break;',
    '        const lastMod = p.lastSyncedAt ? new Date(p.lastSyncedAt).toISOString() : todayIso;',
    '        const chunk =',
    "          '  <url>\\n' +",
    '          `    <loc>${BASE_SEO_URL}/?tab=Boutique&amp;productId=${p._id}</loc>\\n` +',
    '          `    <lastmod>${lastMod}</lastmod>\\n` +',
    "          '    <changefreq>daily</changefreq>\\n' +",
    "          '    <priority>0.6</priority>\\n' +",
    "          '  </url>\\n';",
    '        if (!res.write(chunk)) {',
    "          await new Promise((resolve) => res.once('drain', resolve));",
    '        }',
    '      }',
    '    }',
    '',
    '    if (!res.writableEnded) {',
    "      res.write('</urlset>');",
    '      res.end();',
    '    }',
    '  } catch (error) {',
    "    console.error('⚠️ Error streaming /sitemap.xml:', error.message);",
    '    if (!res.headersSent) {',
    "      res.status(500).set('Content-Type', 'application/xml; charset=utf-8').send(",
    "        '<?xml version=\"1.0\" encoding=\"UTF-8\"?><urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\"></urlset>'",
    '      );',
    '    } else if (!res.writableEnded) {',
    "      res.write('</urlset>');",
    '      res.end();',
    '    }',
    '  }',
    '});',
    ''
  ].join('\n');

  if (text.includes('// 4. /sitemap.xml (Phase 5: Cursor-Streamed XML 0.9 Sitemap')) {
    console.log('  ✓ [Block 2] /sitemap.xml already cursor-streamed (skipped)');
  } else if (sitemapStartIdx !== -1 && sitemapEndIdx > sitemapStartIdx) {
    text = text.slice(0, sitemapStartIdx) + sitemapStreamedBlock + '\n' + text.slice(sitemapEndIdx);
    changesApplied++;
    console.log('  ✅ [Block 2] Upgraded /sitemap.xml to 250-doc cursor stream with backpressure handling');
  } else {
    throw new Error('[Block 2] Could not locate /sitemap.xml route range.');
  }

  // ---- BLOCK 3: Harden the Daily 3:00 AM CST Uncapped CJ Sync Cron Job ---- //
  const cronOldBlock = [
    '    cron.schedule(',
    "      '0 3 * * *',",
    '      () => {',
    "        console.log('⏰ Running scheduled daily CJ Beauty & Skincare full sync and MongoDB sanitization at 3:00 AM CST...');",
    '        syncCJCatalog({ fullCatalog: true, sanitizeAfter: true }).catch((error) => {',
    "          console.error('❌ Scheduled 3:00 AM CST CJ catalog sync failure:', error?.response?.data || error.message);",
    '        });',
    '      },',
    "      { timezone: 'America/Chicago' }",
    '    );'
  ].join('\n');

  const cronNewBlock = [
    '    cron.schedule(',
    "      '0 3 * * *',",
    '      () => {',
    '        if (isCjSyncRunning) {',
    "          console.log('⏰ 3:00 AM CST cron skipped — an uncapped CJ Skincare & Beauty crawl is already running.');",
    '          return;',
    '        }',
    "        console.log('⏰ Running scheduled daily UNCAPPED CJ Skincare & Beauty crawl and MongoDB sanitization at 3:00 AM CST...');",
    '        syncCJCatalog({ fullCatalog: true, sanitizeAfter: true }).catch(async (error) => {',
    '          const errMsg = error?.response?.data?.message || error.message || String(error);',
    "          console.error('❌ Scheduled 3:00 AM CST CJ catalog sync failure:', errMsg);",
    "          if (typeof saveCatalogTelemetrySafe === 'function') {",
    '            await saveCatalogTelemetrySafe({',
    '              lastSyncAt: new Date().toISOString(),',
    "              lastSyncStatus: 'ERROR',",
    "              syncPhase: 'ERROR',",
    '              lastError: errMsg',
    '            }).catch(() => {});',
    '          }',
    '        });',
    '      },',
    "      { timezone: 'America/Chicago' }",
    '    );'
  ].join('\n');

  if (text.includes('3:00 AM CST cron skipped — an uncapped CJ Skincare & Beauty crawl is already running.')) {
    console.log('  ✓ [Block 3] Daily 3:00 AM CST cron job already hardened (skipped)');
  } else if (text.includes(cronOldBlock)) {
    text = text.replace(cronOldBlock, cronNewBlock);
    changesApplied++;
    console.log('  ✅ [Block 3] Hardened daily 3:00 AM CST uncapped CJ cron job with overlap guard & telemetry persistence');
  } else {
    console.log('  ℹ️ [Block 3] 3:00 AM CST cron block already customized (skipped)');
  }

  if (changesApplied > 0) {
    const backupPath = writeWithOriginalEol(serverPath, text, eol);
    console.log(`  💾 Saved ${serverPath} (${changesApplied} change(s) applied). Backup: ${path.basename(backupPath)}`);
  } else {
    console.log(`  ℹ️ No changes needed for ${serverPath}.`);
  }
};

// ---------------- MAIN EXECUTION ---------------- //

try {
  const cliServerArg = process.argv[2];
  const serverPath = findFirstExistingFile([
    cliServerArg,
    'server.js',
    'server_2.js'
  ]);

  if (!serverPath) {
    throw new Error('Could not locate server.js. Pass it explicitly: node apply_cj_phase5_scaling_hardening.js path/to/server.js');
  }

  patchServerPhase5(serverPath);

  console.log('\n🎉 All 5 Phases of the Uncapped CJ Skincare & Beauty Integration are complete!');
  console.log('Final verification commands:');
  console.log(`  1. Syntax-check backend:   node --check "${serverPath}"`);
  console.log('  2. Build React frontend:   cd client && npm run build');
  console.log('  3. Commit & push to Render, then run the Post-Deploy Verification Checklist!');
} catch (err) {
  console.error('\n❌ Phase 5 patch failed:', err.message);
  process.exit(1);
}
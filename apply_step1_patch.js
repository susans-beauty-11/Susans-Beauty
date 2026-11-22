#!/usr/bin/env node
/**
 * apply_step1_patch.js
 *
 * Safely and idempotently applies all Step 1 storefront description cleanup
 * and GEO Answer Capsule isolation changes to `server.js` and `App.js`.
 *
 * Features:
 *  - Auto-detects server.js / server_2.js and client/src/App.js / src/App.js / App.js / App_2.js
 *  - Accepts optional CLI path overrides:
 *      node apply_step1_patch.js path/to/server.js path/to/App.js
 *  - Preserves original line endings (CRLF or LF)
 *  - Creates timestamped .bak backups before modifying any file
 *  - Safe to run multiple times (skips already-applied edits)
 */

const fs = require('fs');
const path = require('path');

// ---------------- FILE DISCOVERY HELPERS ---------------- //

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
  const backupPath = `${filePath}.step1_${Date.now()}.bak`;
  fs.copyFileSync(filePath, backupPath);
  const output = eol === '\r\n' ? normalizedText.replace(/\n/g, '\r\n') : normalizedText;
  fs.writeFileSync(filePath, output, 'utf8');
  return backupPath;
};

// ---------------- PART A: SERVER.JS PATCHER ---------------- //

const patchServerFile = (serverPath) => {
  console.log(`\n🔧 Patching server file: ${serverPath}`);
  let { text, eol } = readNormalized(serverPath);
  let changesApplied = 0;

  // 1. Add seoAnswerCapsule to productSchema
  const schemaOld = [
    '  lastSyncedAt: { type: Date, default: null },',
    '  description: String,',
    '  imageUrl: String,'
  ].join('\n');

  const schemaNew = [
    '  lastSyncedAt: { type: Date, default: null },',
    '  description: String,',
    "  seoAnswerCapsule: { type: String, default: '' },",
    '  imageUrl: String,'
  ].join('\n');

  if (text.includes("seoAnswerCapsule: { type: String, default: '' },")) {
    console.log('  ✓ [A.1] productSchema.seoAnswerCapsule already present (skipped)');
  } else if (text.includes(schemaOld)) {
    text = text.replace(schemaOld, schemaNew);
    changesApplied++;
    console.log('  ✅ [A.1] Added seoAnswerCapsule to productSchema');
  } else {
    throw new Error('[A.1] Could not find productSchema anchor in server file.');
  }

  // 2. Add Safe Description Cleaner & Startup Migration Helper (with clean line breaks)
  const helperAnchor = '// Backfills structured Blueprint labels onto all existing products in MongoDB';
  const cleanerHelperBlock = [
    '// ---------------- STOREFRONT DESCRIPTION CLEANER & GEO CAPSULE ISOLATOR ---------------- //',
    'const SEMANTIC_CAPSULE_PREFIX_REGEX = /(?:\\*\\*)?\\s*Semantic\\s+AI\\s+Answer\\s+Capsule\\s*:?\\s*(?:\\*\\*)?\\s*/gi;',
    'const SEMANTIC_CAPSULE_BLOCK_REGEX = /(?:\\*\\*)?\\s*Semantic\\s+AI\\s+Answer\\s+Capsule\\s*:?\\s*(?:\\*\\*)?[\\s\\S]*?(?=\\n\\n|$)/gi;',
    '',
    "const stripHtmlAndMarkdown = (raw = '') =>",
    "  String(raw || '')",
    "    .replace(/<[^>]*>?/gm, ' ')",
    "    .replace(/\\*\\*([^*]+)\\*\\*/g, '$1')",
    "    .replace(/__([^_]+)__/g, '$1')",
    "    .replace(/[#*_`~]/g, '')",
    "    .replace(/\\s+/g, ' ')",
    '    .trim();',
    '',
    'const buildCleanCustomerFallbackDescription = (prod = {}) => {',
    "  const step = String(prod.ritualStep || 'Skincare Essential').replace(/^Step\\s*\\d+:\\s*/i, '').trim();",
    '  const actives = Array.isArray(prod.keyActives) && prod.keyActives.length > 0',
    "    ? prod.keyActives.slice(0, 2).join(' and ')",
    "    : 'hydrating botanicals';",
    '  const skinTypes = Array.isArray(prod.skinTypes) && prod.skinTypes.length > 0',
    "    ? prod.skinTypes.slice(0, 2).join(' and ')",
    "    : 'all';",
    '  const concern = Array.isArray(prod.skinConcerns) && prod.skinConcerns.length > 0',
    '    ? prod.skinConcerns[0].toLowerCase()',
    "    : 'daily radiance';",
    '',
    '  return `A gentle ${step.toLowerCase()} formulated with ${actives} to support ${concern} for ${skinTypes.toLowerCase()} skin.`;',
    '};',
    '',
    'const extractAndCleanProductDescription = (prod = {}) => {',
    "  const currentDesc = String(prod.description || '');",
    "  const rawCjDesc = String(prod.rawCjData?.description || prod.rawCjData?.productDescription || '');",
    "  let seoAnswerCapsule = String(prod.seoAnswerCapsule || '').trim();",
    '',
    '  // 1. Extract any Semantic AI Answer Capsule out of description into seoAnswerCapsule',
    '  const capsuleMatches = currentDesc.match(SEMANTIC_CAPSULE_BLOCK_REGEX);',
    '  if (capsuleMatches && capsuleMatches.length > 0 && !seoAnswerCapsule) {',
    '    seoAnswerCapsule = stripHtmlAndMarkdown(',
    "      capsuleMatches.join(' ').replace(SEMANTIC_CAPSULE_PREFIX_REGEX, '')",
    '    );',
    '  }',
    '',
    '  // 2. Remove capsule text and raw Markdown/HTML from customer-facing description',
    '  let cleanDesc = stripHtmlAndMarkdown(',
    '    currentDesc',
    "      .replace(SEMANTIC_CAPSULE_BLOCK_REGEX, '')",
    "      .replace(SEMANTIC_CAPSULE_PREFIX_REGEX, '')",
    '  );',
    '',
    '  // 3. Fall back to cleaned CJ description if customer description is now empty',
    '  if (!cleanDesc && rawCjDesc) {',
    '    cleanDesc = stripHtmlAndMarkdown(',
    '      rawCjDesc',
    "        .replace(SEMANTIC_CAPSULE_BLOCK_REGEX, '')",
    "        .replace(SEMANTIC_CAPSULE_PREFIX_REGEX, '')",
    '    );',
    '  }',
    '',
    '  // 4. Final clean boutique fallback (no AI capsule wording)',
    '  if (!cleanDesc) {',
    '    cleanDesc = buildCleanCustomerFallbackDescription(prod);',
    '  }',
    '',
    '  // 5. Ensure GEO growth engine always has a capsule stored in seoAnswerCapsule',
    '  if (!seoAnswerCapsule) {',
    "    const skinTypes = Array.isArray(prod.skinTypes) && prod.skinTypes.length > 0 ? prod.skinTypes.join(', ') : 'All Skin Types';",
    "    const concerns = Array.isArray(prod.skinConcerns) && prod.skinConcerns.length > 0 ? prod.skinConcerns.join(', ') : 'Hydration';",
    "    const actives = Array.isArray(prod.keyActives) && prod.keyActives.length > 0 ? prod.keyActives.join(' and ') : 'Hydrating Botanical Complex';",
    "    const step = prod.ritualStep || 'Skincare Essential';",
    '    seoAnswerCapsule = `Curated by Susan for ${skinTypes} seeking ${concerns}. This ${step.toLowerCase()} features ${actives} to support ${concerns.toLowerCase()} while respecting the skin barrier.`;',
    '  }',
    '',
    '  return {',
    '    description: cleanDesc,',
    '    seoAnswerCapsule',
    '  };',
    '};',
    '',
    '// One-time & on-demand safe migration: isolates Semantic AI Answer Capsules into seoAnswerCapsule',
    'const migrateSemanticAnswerCapsules = async (forceAll = false) => {',
    '  try {',
    '    const query = forceAll',
    '      ? {}',
    '      : {',
    '          $or: [',
    '            { description: /Semantic\\s+AI\\s+Answer\\s+Capsule/i },',
    '            { seoAnswerCapsule: { $exists: false } },',
    "            { seoAnswerCapsule: '' }",
    '          ]',
    '        };',
    '',
    '    const productsToClean = await Product.find(query)',
    "      .select('_id title description seoAnswerCapsule rawCjData.description rawCjData.productDescription ritualStep skinTypes skinConcerns keyActives')",
    '      .lean();',
    '',
    '    if (!productsToClean.length) {',
    '      return { migratedCount: 0, totalCount: await Product.countDocuments() };',
    '    }',
    '',
    '    const bulkOps = [];',
    '    for (const prod of productsToClean) {',
    '      const cleaned = extractAndCleanProductDescription(prod);',
    "      if (cleaned.description !== prod.description || cleaned.seoAnswerCapsule !== (prod.seoAnswerCapsule || '')) {",
    '        bulkOps.push({',
    '          updateOne: {',
    '            filter: { _id: prod._id },',
    '            update: {',
    '              $set: {',
    '                description: cleaned.description,',
    '                seoAnswerCapsule: cleaned.seoAnswerCapsule',
    '              }',
    '            }',
    '          }',
    '        });',
    '      }',
    '    }',
    '',
    '    if (bulkOps.length > 0) {',
    '      await Product.bulkWrite(bulkOps);',
    '      console.log(`✨ Isolated GEO capsules and cleaned customer descriptions on ${bulkOps.length} product(s).`);',
    '    }',
    '',
    '    return {',
    '      migratedCount: bulkOps.length,',
    '      totalCount: await Product.countDocuments()',
    '    };',
    '  } catch (err) {',
    "    console.error('⚠️ Error migrating semantic answer capsules:', err.message);",
    '    return { migratedCount: 0, totalCount: 0, error: err.message };',
    '  }',
    '};',
    ''
  ].join('\n');

  if (text.includes('const migrateSemanticAnswerCapsules = async')) {
    console.log('  ✓ [A.2] Description cleaner & migration helper already present (skipped)');
  } else if (text.includes(helperAnchor)) {
    text = text.replace(helperAnchor, `${cleanerHelperBlock}\n${helperAnchor}`);
    changesApplied++;
    console.log('  ✅ [A.2] Inserted description cleaner & migration helper');
  } else {
    throw new Error('[A.2] Could not find backfillProductBlueprintLabels comment anchor.');
  }

  // 3a. Point /llms-full.txt to seoAnswerCapsule
  const llmsOld = [
    "      const rawDesc = String(p.description || '').replace(/<[^>]*>?/gm, '').trim();",
    '',
    "      markdown += `### ${p.title || 'Boutique Essential'}\\n`;",
    '      markdown += `- **URL:** ${BASE_SEO_URL}/?tab=Boutique&productId=${p._id}\\n`;',
    '      markdown += `- **Price:** $${Number(price).toFixed(2)}\\n`;',
    '      markdown += `- **Ritual Step:** ${step}\\n`;',
    '      markdown += `- **Best For Skin Types:** ${skinTypes}\\n`;',
    '      markdown += `- **Target Skin Concerns:** ${concerns}\\n`;',
    '      markdown += `- **Key Actives:** ${actives}\\n`;',
    '      markdown += `- **Sensitivity Profile:** ${sensitivity}\\n`;',
    "      markdown += `- **Description:** ${rawDesc || 'Curated skincare essential.'}\\n\\n`;"
  ].join('\n');

  const llmsNew = [
    "      const geoSummary = stripHtmlAndMarkdown(p.seoAnswerCapsule || p.description || '');",
    '',
    "      markdown += `### ${p.title || 'Boutique Essential'}\\n`;",
    '      markdown += `- **URL:** ${BASE_SEO_URL}/?tab=Boutique&productId=${p._id}\\n`;',
    '      markdown += `- **Price:** $${Number(price).toFixed(2)}\\n`;',
    '      markdown += `- **Ritual Step:** ${step}\\n`;',
    '      markdown += `- **Best For Skin Types:** ${skinTypes}\\n`;',
    '      markdown += `- **Target Skin Concerns:** ${concerns}\\n`;',
    '      markdown += `- **Key Actives:** ${actives}\\n`;',
    '      markdown += `- **Sensitivity Profile:** ${sensitivity}\\n`;',
    "      markdown += `- **GEO Answer Capsule:** ${geoSummary || 'Curated skincare essential.'}\\n\\n`;"
  ].join('\n');

  if (text.includes('- **GEO Answer Capsule:** ${geoSummary')) {
    console.log('  ✓ [A.3a] /llms-full.txt already outputs GEO Answer Capsule (skipped)');
  } else if (text.includes(llmsOld)) {
    text = text.replace(llmsOld, llmsNew);
    changesApplied++;
    console.log('  ✅ [A.3a] Updated /llms-full.txt to output seoAnswerCapsule');
  } else {
    throw new Error('[A.3a] Could not find /llms-full.txt description lines.');
  }

  // 3b. Remove shadowed duplicate UNIFIED GEO ENGINE block
  const dupStartMarker = [
    '// ============================================================================',
    '// UNIFIED GEO ENGINE: BOT SSR INTERCEPTOR, LLMS.TXT, ROBOTS.TXT & SITEMAP.XML'
  ].join('\n');
  const dupEndMarker = '// ---------------- LIVE STRIPE BALANCE, CJ WALLET & ORDER PIPELINE ENGINE ---------------- //';

  const startIdx = text.indexOf(dupStartMarker);
  const endIdx = text.indexOf(dupEndMarker);

  if (startIdx === -1) {
    console.log('  ✓ [A.3b] Duplicate UNIFIED GEO ENGINE block already removed (skipped)');
  } else if (endIdx > startIdx) {
    text = text.slice(0, startIdx) + text.slice(endIdx);
    changesApplied++;
    console.log('  ✅ [A.3b] Removed shadowed duplicate UNIFIED GEO ENGINE block');
  } else {
    throw new Error('[A.3b] Found UNIFIED GEO ENGINE start marker but could not locate end marker.');
  }

  // 4a. Add Admin cleanup endpoint above /api/admin/products/reclassify-labels
  const reclassifyAnchor = "app.post('/api/admin/products/reclassify-labels', authenticateToken, requireAdmin, async (req, res) => {";
  const cleanRouteBlock = [
    "app.post('/api/admin/products/clean-descriptions', authenticateToken, requireAdmin, async (req, res) => {",
    '  try {',
    '    const forceAll = req.body?.forceAll !== undefined ? Boolean(req.body.forceAll) : true;',
    '    const result = await migrateSemanticAnswerCapsules(forceAll);',
    '    res.status(200).json({',
    '      message: `Cleaned customer descriptions and isolated GEO capsules on ${result.migratedCount || 0} product(s) (${result.totalCount || 0} total active) ✧`,',
    '      ...result',
    '    });',
    '  } catch (error) {',
    "    console.error('Clean Product Descriptions Error:', error);",
    "    res.status(500).json({ error: error.message || 'Failed to clean product descriptions.' });",
    '  }',
    '});',
    ''
  ].join('\n');

  if (text.includes("app.post('/api/admin/products/clean-descriptions'")) {
    console.log('  ✓ [A.4a] /api/admin/products/clean-descriptions route already present (skipped)');
  } else if (text.includes(reclassifyAnchor)) {
    text = text.replace(reclassifyAnchor, `${cleanRouteBlock}\n${reclassifyAnchor}`);
    changesApplied++;
    console.log('  ✅ [A.4a] Added POST /api/admin/products/clean-descriptions route');
  } else {
    throw new Error('[A.4a] Could not find /api/admin/products/reclassify-labels anchor.');
  }

  // 4b. Hook migrateSemanticAnswerCapsules(false) into startDatabaseAndBackgroundServices
  const startupOld = [
    '        await backfillProductBlueprintLabels(false);',
    '        await backfillProductShippingAndCustomLabelMeta(false);'
  ].join('\n');

  const startupNew = [
    '        await backfillProductBlueprintLabels(false);',
    '        await migrateSemanticAnswerCapsules(false);',
    '        await backfillProductShippingAndCustomLabelMeta(false);'
  ].join('\n');

  if (text.includes('await migrateSemanticAnswerCapsules(false);')) {
    console.log('  ✓ [A.4b] Startup migration hook already present (skipped)');
  } else if (text.includes(startupOld)) {
    text = text.replace(startupOld, startupNew);
    changesApplied++;
    console.log('  ✅ [A.4b] Hooked migrateSemanticAnswerCapsules(false) into startup');
  } else {
    throw new Error('[A.4b] Could not find startup backfillProductBlueprintLabels(false) anchor.');
  }

  if (changesApplied > 0) {
    const backupPath = writeWithOriginalEol(serverPath, text, eol);
    console.log(`  💾 Saved ${serverPath} (${changesApplied} change(s) applied). Backup: ${path.basename(backupPath)}`);
  } else {
    console.log(`  ℹ️ No changes needed for ${serverPath}.`);
  }
};

// ---------------- PART B: APP.JS PATCHER ---------------- //

const patchAppFile = (appPath) => {
  console.log(`\n🔧 Patching frontend file: ${appPath}`);
  let { text, eol } = readNormalized(appPath);
  let changesApplied = 0;

  // 1a. Insert formatCustomerProductDescription above ProductDetailModal
  const modalAnchor = 'const ProductDetailModal = ({ product, onClose, onAddToCart, userBlueprint, hasCompletedQuiz }) => {';
  const formatterHelper = [
    'const formatCustomerProductDescription = (product = {}) => {',
    '  const candidates = [product?.description, product?.rawCjData?.description];',
    '  for (const candidate of candidates) {',
    "    if (typeof candidate !== 'string' || !candidate.trim()) continue;",
    '    const cleaned = candidate',
    "      .replace(/(?:\\*\\*)?\\s*Semantic\\s+AI\\s+Answer\\s+Capsule\\s*:?\\s*(?:\\*\\*)?[\\s\\S]*?(?=\\n\\n|$)/gi, '')",
    "      .replace(/(?:\\*\\*)?\\s*Semantic\\s+AI\\s+Answer\\s+Capsule\\s*:?\\s*(?:\\*\\*)?/gi, '')",
    "      .replace(/<[^>]*>?/gm, ' ')",
    "      .replace(/\\*\\*([^*]+)\\*\\*/g, '$1')",
    "      .replace(/__([^_]+)__/g, '$1')",
    "      .replace(/[#*_`~]/g, '')",
    "      .replace(/\\s+/g, ' ')",
    '      .trim();',
    '    if (cleaned) return cleaned;',
    '  }',
    "  return '';",
    '};',
    ''
  ].join('\n');

  if (text.includes('const formatCustomerProductDescription = (product = {}) => {')) {
    console.log('  ✓ [B.1a] formatCustomerProductDescription helper already present (skipped)');
  } else if (text.includes(modalAnchor)) {
    text = text.replace(modalAnchor, `${formatterHelper}\n${modalAnchor}`);
    changesApplied++;
    console.log('  ✅ [B.1a] Added formatCustomerProductDescription helper');
  } else {
    throw new Error('[B.1a] Could not find ProductDetailModal anchor in App.js.');
  }

  // 1b & 2. Replace rawInfo / unformattedInfo in ProductDetailModal and ProductCard
  const oldDescLines = [
    "  const rawInfo = product.rawCjData?.description || product.description || '';",
    "  const unformattedInfo = typeof rawInfo === 'string' ? rawInfo.replace(/<[^>]*>?/gm, '') : '';"
  ].join('\n');

  const newDescLine = '  const unformattedInfo = formatCustomerProductDescription(product);';

  const occurrences = text.split(oldDescLines).length - 1;
  if (occurrences === 0 && text.includes(newDescLine)) {
    console.log('  ✓ [B.1b & B.2] ProductDetailModal and ProductCard already updated (skipped)');
  } else if (occurrences > 0) {
    text = text.split(oldDescLines).join(newDescLine);
    changesApplied += occurrences;
    console.log(`  ✅ [B.1b & B.2] Updated ${occurrences} description block(s) in ProductDetailModal & ProductCard`);
  } else {
    throw new Error('[B.1b/B.2] Could not find rawInfo/unformattedInfo lines in ProductDetailModal or ProductCard.');
  }

  if (changesApplied > 0) {
    const backupPath = writeWithOriginalEol(appPath, text, eol);
    console.log(`  💾 Saved ${appPath} (${changesApplied} change(s) applied). Backup: ${path.basename(backupPath)}`);
  } else {
    console.log(`  ℹ️ No changes needed for ${appPath}.`);
  }
};

// ---------------- MAIN EXECUTION ---------------- //

try {
  const cliServerArg = process.argv[2];
  const cliAppArg = process.argv[3];

  const serverPath = findFirstExistingFile([
    cliServerArg,
    'server.js',
    'server_2.js'
  ]);

  const appPath = findFirstExistingFile([
    cliAppArg,
    'client/src/App.js',
    'src/App.js',
    'App.js',
    'App_2.js'
  ]);

  if (!serverPath) {
    throw new Error('Could not locate server.js. Pass it explicitly: node apply_step1_patch.js path/to/server.js path/to/App.js');
  }
  if (!appPath) {
    throw new Error('Could not locate App.js. Pass it explicitly: node apply_step1_patch.js path/to/server.js path/to/App.js');
  }

  patchServerFile(serverPath);
  patchAppFile(appPath);

  console.log('\n✨ All Step 1 changes applied successfully!');
  console.log('Next steps:');
  console.log(`  1. Syntax-check backend:  node --check "${serverPath}"`);
  console.log('  2. Rebuild frontend & deploy, then check Render logs for:');
  console.log('     ✨ Isolated GEO capsules and cleaned customer descriptions on X product(s).');
} catch (err) {
  console.error('\n❌ Patch failed:', err.message);
  process.exit(1);
}
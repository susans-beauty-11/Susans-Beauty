#!/usr/bin/env node
/**
 * apply_step3_patch.js
 *
 * Safely and idempotently applies all Step 3 MongoDB indexing, `.lean()` query
 * optimization, lightweight storefront projection, HTTP caching, and optional
 * pagination upgrades to `server.js`.
 *
 * Features:
 *  - Auto-detects server.js / server_2.js or accepts an explicit CLI path:
 *      node apply_step3_patch.js path/to/server.js
 *  - Preserves original line endings (CRLF or LF)
 *  - Creates a timestamped `.bak` backup before writing changes
 *  - Safe to run multiple times (skips already-applied edits)
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
  const backupPath = `${filePath}.step3_${Date.now()}.bak`;
  fs.copyFileSync(filePath, backupPath);
  const output = eol === '\r\n' ? normalizedText.replace(/\n/g, '\r\n') : normalizedText;
  fs.writeFileSync(filePath, output, 'utf8');
  return backupPath;
};

// ---------------- STEP 3 SERVER.JS PATCHER ---------------- //

const patchServerStep3 = (serverPath) => {
  console.log(`\n🔧 Applying Step 3 patch to: ${serverPath}`);
  let { text, eol } = readNormalized(serverPath);
  let changesApplied = 0;

  // ---- BLOCK 1: Add Compound & Sort Indexes on productSchema ---- //
  const block1Old = "const Product = mongoose.model('Product', productSchema);";
  const block1New = [
    '// Compound & sort indexes for fast DB-backed Boutique queries and 3:00 AM stale-item pruning',
    'productSchema.index({ skinTypes: 1, skinConcerns: 1, ritualStep: 1 });',
    'productSchema.index({ purchaseCount: -1, viewCount: -1, _id: 1 });',
    'productSchema.index({ lastSyncedAt: -1 });',
    "const Product = mongoose.model('Product', productSchema);"
  ].join('\n');

  if (
    text.includes('productSchema.index({ skinTypes: 1, skinConcerns: 1, ritualStep: 1 });') &&
    text.includes('productSchema.index({ purchaseCount: -1, viewCount: -1, _id: 1 });')
  ) {
    console.log('  ✓ [Block 1] productSchema compound & sort indexes already present (skipped)');
  } else if (text.includes(block1Old)) {
    text = text.replace(block1Old, block1New);
    changesApplied++;
    console.log('  ✅ [Block 1] Added compound & sort indexes to productSchema');
  } else {
    throw new Error("[Block 1] Could not find `const Product = mongoose.model('Product', productSchema);` anchor.");
  }

  // ---- BLOCK 2: Optimize GET /api/products with .lean(), Projection, Caching & Optional Pagination ---- //
  const block2StartAnchor = "app.get('/api/products', async (req, res) => {";
  const block2EndAnchor = '// ---------------- PASSWORD RESET & AUTH ROUTES ---------------- //';

  const block2New = [
    "app.get('/api/products', async (req, res) => {",
    '  try {',
    '    const {',
    '      category,',
    '      skinType,',
    '      skinConcern,',
    '      ritualStep,',
    '      search,',
    '      sort,',
    '      page,',
    '      limit,',
    '      paginated,',
    '      includeAdminFields,',
    '      full',
    '    } = req.query;',
    '',
    '    const filter = {};',
    "    if (category && category !== 'All') {",
    "      filter.tags = new RegExp(`^${escapeRegex(category)}$`, 'i');",
    '    }',
    "    if (skinType && skinType !== 'All') {",
    "      filter.skinTypes = { $in: [new RegExp(`^${escapeRegex(skinType)}$`, 'i'), 'All Skin Types'] };",
    '    }',
    "    if (skinConcern && skinConcern !== 'All') {",
    "      filter.skinConcerns = new RegExp(`^${escapeRegex(skinConcern)}$`, 'i');",
    '    }',
    "    if (ritualStep && ritualStep !== 'All') {",
    "      filter.ritualStep = new RegExp(escapeRegex(ritualStep), 'i');",
    '    }',
    '    if (search && String(search).trim()) {',
    "      const searchRegex = new RegExp(escapeRegex(String(search).trim()), 'i');",
    '      filter.$or = [',
    '        { title: searchRegex },',
    '        { description: searchRegex },',
    '        { tags: searchRegex },',
    '        { keyActives: searchRegex }',
    '      ];',
    '    }',
    '',
    '    // Default popularity sort uses the { purchaseCount: -1, viewCount: -1, _id: 1 } index',
    '    let sortSpec = { purchaseCount: -1, viewCount: -1, _id: 1 };',
    "    if (sort === 'price_asc') sortSpec = { price: 1, _id: 1 };",
    "    else if (sort === 'price_desc') sortSpec = { price: -1, _id: 1 };",
    "    else if (sort === 'newest') sortSpec = { lastSyncedAt: -1, _id: 1 };",
    '',
    '    // Admin requests can opt in to full raw CJ / logistics / GEO fields; storefront gets a lightweight payload',
    "    const isAdminPayload = includeAdminFields === 'true' || full === 'true';",
    '    const projection = isAdminPayload',
    "      ? '-__v'",
    "      : '-rawCjData -availableLogistics -seoAnswerCapsule -__v';",
    '',
    '    if (isAdminPayload) {',
    "      res.set('Cache-Control', 'no-store');",
    '    } else {',
    "      res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');",
    '    }',
    '',
    '    // Backward-compatible optional pagination: returns { products, pagination } only when explicitly requested',
    "    const wantsPagination = paginated === 'true' || page !== undefined;",
    '    if (wantsPagination) {',
    '      const parsedPage = Math.max(1, parseInt(page, 10) || 1);',
    '      const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 24));',
    '      const skip = (parsedPage - 1) * parsedLimit;',
    '',
    '      const [products, total] = await Promise.all([',
    '        Product.find(filter)',
    '          .select(projection)',
    '          .sort(sortSpec)',
    '          .skip(skip)',
    '          .limit(parsedLimit)',
    '          .lean(),',
    '        Product.countDocuments(filter)',
    '      ]);',
    '',
    '      const totalPages = Math.max(1, Math.ceil(total / parsedLimit));',
    "      res.set('X-Total-Count', String(total));",
    '      return res.status(200).json({',
    '        products,',
    '        pagination: {',
    '          page: parsedPage,',
    '          limit: parsedLimit,',
    '          total,',
    '          totalPages,',
    '          hasMore: parsedPage < totalPages',
    '        }',
    '      });',
    '    }',
    '',
    '    // Default array response for full backward compatibility with existing frontend callers',
    '    const query = Product.find(filter).select(projection).sort(sortSpec);',
    '    if (limit !== undefined) {',
    '      const parsedLimit = Math.min(500, Math.max(1, parseInt(limit, 10) || 300));',
    '      query.limit(parsedLimit);',
    '    }',
    '',
    '    const products = await query.lean();',
    "    res.set('X-Total-Count', String(products.length));",
    '    return res.status(200).json(products);',
    '  } catch (error) {',
    "    console.error('Error fetching products:', error);",
    "    return res.status(500).json({ error: 'Failed to fetch products' });",
    '  }',
    '});',
    ''
  ].join('\n');

  const b2StartIdx = text.indexOf(block2StartAnchor);
  const b2EndIdx = text.indexOf(block2EndAnchor);

  if (
    text.includes("'-rawCjData -availableLogistics -seoAnswerCapsule -__v'") &&
    text.includes("res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');")
  ) {
    console.log('  ✓ [Block 2] GET /api/products optimization already present (skipped)');
  } else if (b2StartIdx !== -1 && b2EndIdx > b2StartIdx) {
    text = text.slice(0, b2StartIdx) + block2New + '\n' + text.slice(b2EndIdx);
    changesApplied++;
    console.log('  ✅ [Block 2] Upgraded GET /api/products with .lean(), projection, Cache-Control & optional pagination');
  } else {
    throw new Error('[Block 2] Could not locate GET /api/products -> PASSWORD RESET & AUTH ROUTES range.');
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
    throw new Error('Could not locate server.js. Pass it explicitly: node apply_step3_patch.js path/to/server.js');
  }

  patchServerStep3(serverPath);

  console.log('\n✨ All Step 3 changes applied successfully!');
  console.log('Next steps:');
  console.log(`  1. Syntax-check backend:  node --check "${serverPath}"`);
  console.log('  2. Commit & push, then verify:');
  console.log('     - GET /api/products  (lightweight payload + Cache-Control header)');
  console.log('     - GET /api/products?page=1&limit=24  (paginated response)');
  console.log('     - GET /api/products?includeAdminFields=true&limit=5  (full admin payload + no-store)');
} catch (err) {
  console.error('\n❌ Step 3 patch failed:', err.message);
  process.exit(1);
}
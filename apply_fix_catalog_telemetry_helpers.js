#!/usr/bin/env node
/**
 * apply_fix_catalog_telemetry_helpers.js
 *
 * Restores `persistCatalogSyncTelemetry` and `loadCatalogSyncTelemetry` (and
 * ensures `CatalogSyncState` exists with all Phase 2 live progress fields) in
 * `server.js` after Phase 1's anchor range inadvertently overwrote them.
 *
 * Usage:
 *   node apply_fix_catalog_telemetry_helpers.js
 *   node apply_fix_catalog_telemetry_helpers.js path/to/server.js
 */

const fs = require('fs');
const path = require('path');

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
  const backupPath = `${filePath}.fix_telemetry_${Date.now()}.bak`;
  fs.copyFileSync(filePath, backupPath);
  const output = eol === '\r\n' ? normalizedText.replace(/\n/g, '\r\n') : normalizedText;
  fs.writeFileSync(filePath, output, 'utf8');
  return backupPath;
};

const patchServerTelemetryHelpers = (serverPath) => {
  console.log(`\n🔧 Restoring CatalogSyncState telemetry helpers in: ${serverPath}`);
  let { text, eol } = readNormalized(serverPath);
  let changesApplied = 0;

  // 1. Ensure CatalogSyncState Mongoose model exists
  const productModelAnchor = "const Product = mongoose.model('Product', productSchema);";
  if (!text.includes('const CatalogSyncState =')) {
    if (!text.includes(productModelAnchor)) {
      throw new Error("Could not find `const Product = mongoose.model('Product', productSchema);` anchor.");
    }
    const schemaBlock = [
      productModelAnchor,
      '',
      '// Persists CJ Catalog Sync & Sanitization telemetry across Render restarts',
      'const catalogSyncStateSchema = new mongoose.Schema({',
      "  key: { type: String, default: 'primary', unique: true },",
      '  lastSyncAt: { type: Date, default: null },',
      "  lastSyncStatus: { type: String, default: 'IDLE' },",
      '  lastSyncedCount: { type: Number, default: 0 },',
      '  lastNewAddedCount: { type: Number, default: 0 },',
      '  lastUpdatedCount: { type: Number, default: 0 },',
      '  lastSanitizedAt: { type: Date, default: null },',
      '  lastDuplicatesPurgedCount: { type: Number, default: 0 },',
      '  lastNonBeautyPurgedCount: { type: Number, default: 0 },',
      '  lastExcessCapPrunedCount: { type: Number, default: 0 },',
      '  lastStalePrunedCount: { type: Number, default: 0 },',
      '  maxCatalogCap: { type: Number, default: 0 },',
      '  activeCatalogTotal: { type: Number, default: 0 },',
      "  lastError: { type: String, default: '' },",
      "  syncPhase: { type: String, default: 'IDLE' },",
      "  currentSourceLabel: { type: String, default: '' },",
      '  pagesFetched: { type: Number, default: 0 },',
      '  itemsProcessed: { type: Number, default: 0 },',
      '  startedAt: { type: Date, default: null },',
      '  cancelRequested: { type: Boolean, default: false },',
      '  updatedAt: { type: Date, default: Date.now }',
      '});',
      "const CatalogSyncState = mongoose.models.CatalogSyncState || mongoose.model('CatalogSyncState', catalogSyncStateSchema);"
    ].join('\n');

    text = text.replace(productModelAnchor, schemaBlock);
    changesApplied++;
    console.log('  ✅ [1] Added CatalogSyncState Mongoose schema & model');
  } else {
    console.log('  ✓ [1] CatalogSyncState model already present (skipped)');
  }

  // 2. Restore persistCatalogSyncTelemetry & loadCatalogSyncTelemetry right above cleanupPrunedProductReferences
  const hasPersist = text.includes('const persistCatalogSyncTelemetry = async');
  const hasLoad = text.includes('const loadCatalogSyncTelemetry = async');

  if (hasPersist && hasLoad) {
    console.log('  ✓ [2] persistCatalogSyncTelemetry & loadCatalogSyncTelemetry already present (skipped)');
  } else {
    const insertAnchors = [
      '// Removes foreign-key references across InboxItem, User.recommendedProducts, and MemberMonthlyBox for pruned products',
      'const cleanupPrunedProductReferences = async (prunedIds = []) => {',
      'const saveCatalogTelemetrySafe = async (updates = {}) => {'
    ];

    let targetAnchor = null;
    for (const anchor of insertAnchors) {
      if (text.includes(anchor)) {
        targetAnchor = anchor;
        break;
      }
    }

    if (!targetAnchor) {
      throw new Error('Could not find insertion anchor (`cleanupPrunedProductReferences` or `saveCatalogTelemetrySafe`).');
    }

    const helpersBlock = [
      '// Persists & hydrates CJ Catalog Sync telemetry in MongoDB (CatalogSyncState)',
      'const persistCatalogSyncTelemetry = async (updates = {}) => {',
      '  cjCatalogSyncTelemetry = {',
      '    ...cjCatalogSyncTelemetry,',
      '    ...updates',
      '  };',
      '  try {',
      '    if (mongoose.connection.readyState !== 1) return cjCatalogSyncTelemetry;',
      '    await CatalogSyncState.findOneAndUpdate(',
      "      { key: 'primary' },",
      '      {',
      '        $set: {',
      '          lastSyncAt: cjCatalogSyncTelemetry.lastSyncAt ? new Date(cjCatalogSyncTelemetry.lastSyncAt) : null,',
      "          lastSyncStatus: String(cjCatalogSyncTelemetry.lastSyncStatus || 'IDLE'),",
      '          lastSyncedCount: Number(cjCatalogSyncTelemetry.lastSyncedCount || 0),',
      '          lastNewAddedCount: Number(cjCatalogSyncTelemetry.lastNewAddedCount || 0),',
      '          lastUpdatedCount: Number(cjCatalogSyncTelemetry.lastUpdatedCount || 0),',
      '          lastSanitizedAt: cjCatalogSyncTelemetry.lastSanitizedAt ? new Date(cjCatalogSyncTelemetry.lastSanitizedAt) : null,',
      '          lastDuplicatesPurgedCount: Number(cjCatalogSyncTelemetry.lastDuplicatesPurgedCount || 0),',
      '          lastNonBeautyPurgedCount: Number(cjCatalogSyncTelemetry.lastNonBeautyPurgedCount || 0),',
      '          lastExcessCapPrunedCount: Number(cjCatalogSyncTelemetry.lastExcessCapPrunedCount || 0),',
      '          lastStalePrunedCount: Number(cjCatalogSyncTelemetry.lastStalePrunedCount || 0),',
      '          maxCatalogCap: Number(cjCatalogSyncTelemetry.maxCatalogCap || 0),',
      '          activeCatalogTotal: Number(cjCatalogSyncTelemetry.activeCatalogTotal || 0),',
      "          lastError: String(cjCatalogSyncTelemetry.lastError || ''),",
      "          syncPhase: String(cjCatalogSyncTelemetry.syncPhase || 'IDLE'),",
      "          currentSourceLabel: String(cjCatalogSyncTelemetry.currentSourceLabel || ''),",
      '          pagesFetched: Number(cjCatalogSyncTelemetry.pagesFetched || 0),',
      '          itemsProcessed: Number(cjCatalogSyncTelemetry.itemsProcessed || 0),',
      '          startedAt: cjCatalogSyncTelemetry.startedAt ? new Date(cjCatalogSyncTelemetry.startedAt) : null,',
      '          cancelRequested: Boolean(cjCatalogSyncTelemetry.cancelRequested),',
      '          updatedAt: new Date()',
      '        }',
      '      },',
      '      { upsert: true }',
      '    );',
      '  } catch (err) {',
      "    console.warn('⚠️ Failed to persist CatalogSyncState:', err.message);",
      '  }',
      '  return cjCatalogSyncTelemetry;',
      '};',
      '',
      'const loadCatalogSyncTelemetry = async () => {',
      '  try {',
      '    if (mongoose.connection.readyState !== 1) return cjCatalogSyncTelemetry;',
      "    const saved = await CatalogSyncState.findOne({ key: 'primary' }).lean();",
      '    if (saved) {',
      '      cjCatalogSyncTelemetry = {',
      '        ...cjCatalogSyncTelemetry,',
      '        lastSyncAt: saved.lastSyncAt ? new Date(saved.lastSyncAt).toISOString() : null,',
      "        lastSyncStatus: saved.lastSyncStatus || 'IDLE',",
      '        lastSyncedCount: Number(saved.lastSyncedCount || 0),',
      '        lastNewAddedCount: Number(saved.lastNewAddedCount || 0),',
      '        lastUpdatedCount: Number(saved.lastUpdatedCount || 0),',
      '        lastSanitizedAt: saved.lastSanitizedAt ? new Date(saved.lastSanitizedAt).toISOString() : null,',
      '        lastDuplicatesPurgedCount: Number(saved.lastDuplicatesPurgedCount || 0),',
      '        lastNonBeautyPurgedCount: Number(saved.lastNonBeautyPurgedCount || 0),',
      '        lastExcessCapPrunedCount: Number(saved.lastExcessCapPrunedCount || 0),',
      '        lastStalePrunedCount: Number(saved.lastStalePrunedCount || 0),',
      '        maxCatalogCap: Number(saved.maxCatalogCap || 0),',
      '        activeCatalogTotal: Number(saved.activeCatalogTotal || 0),',
      "        lastError: saved.lastError || '',",
      "        syncPhase: isCjSyncRunning ? (saved.syncPhase || 'RUNNING') : (['RUNNING', 'PRE_SANITIZING', 'CATEGORIES', 'KEYWORDS'].includes(saved.syncPhase) ? 'IDLE' : (saved.syncPhase || 'IDLE')),",
      "        currentSourceLabel: isCjSyncRunning ? (saved.currentSourceLabel || '') : '',",
      '        pagesFetched: Number(saved.pagesFetched || 0),',
      '        itemsProcessed: Number(saved.itemsProcessed || 0),',
      '        startedAt: saved.startedAt ? new Date(saved.startedAt).toISOString() : null,',
      '        cancelRequested: false',
      '      };',
      '    }',
      '  } catch (err) {',
      "    console.warn('⚠️ Failed to load CatalogSyncState:', err.message);",
      '  }',
      '  return cjCatalogSyncTelemetry;',
      '};',
      ''
    ].join('\n');

    text = text.replace(targetAnchor, `${helpersBlock}\n${targetAnchor}`);
    changesApplied++;
    console.log('  ✅ [2] Restored persistCatalogSyncTelemetry & loadCatalogSyncTelemetry');
  }

  if (changesApplied > 0) {
    const backupPath = writeWithOriginalEol(serverPath, text, eol);
    console.log(`  💾 Saved ${serverPath} (${changesApplied} change(s) applied). Backup: ${path.basename(backupPath)}`);
  } else {
    console.log(`  ℹ️ No changes needed for ${serverPath}.`);
  }
};

try {
  const cliServerArg = process.argv[2];
  const serverPath = findFirstExistingFile([
    cliServerArg,
    'server.js',
    'server_2.js'
  ]);

  if (!serverPath) {
    throw new Error('Could not locate server.js. Pass it explicitly: node apply_fix_catalog_telemetry_helpers.js path/to/server.js');
  }

  patchServerTelemetryHelpers(serverPath);

  console.log('\n✨ Telemetry helpers restored successfully!');
  console.log(`  1. Syntax-check:  node --check "${serverPath}"`);
  console.log('  2. Commit & push to Render — startup backfills and persisted CJ telemetry will now run cleanly.');
} catch (err) {
  console.error('\n❌ Fix failed:', err.message);
  process.exit(1);
}
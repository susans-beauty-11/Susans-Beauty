#!/usr/bin/env node
/**
 * apply_step5_patch.js
 *
 * Safely and idempotently applies all Step 5 changes to `server.js` and `App.js`:
 *  - Part A (server.js):
 *      1. Adds the `CatalogSyncState` Mongoose schema & model
 *      2. Adds `persistCatalogSyncTelemetry` & `loadCatalogSyncTelemetry` helpers
 *      3. Persists telemetry inside `sanitizeAndDeduplicateCatalog` and `syncCJCatalog`
 *      4. Hydrates telemetry on startup (`startDatabaseAndBackgroundServices`) and in
 *         `GET /api/admin/products/sync-status`
 *  - Part B (App.js):
 *      1. Adds `lastSyncStatus` & `lastStalePrunedCount` to `syncStatusTelemetry` state
 *      2. Upgrades the `AdminInventory` Catalog Sync & Telemetry Command Bar with the
 *         live Cap selector (150/200/300/500) and persisted status pills
 *
 * Usage:
 *   node apply_step5_patch.js
 *   node apply_step5_patch.js path/to/server.js path/to/App.js
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
  const backupPath = `${filePath}.step5_${Date.now()}.bak`;
  fs.copyFileSync(filePath, backupPath);
  const output = eol === '\r\n' ? normalizedText.replace(/\n/g, '\r\n') : normalizedText;
  fs.writeFileSync(filePath, output, 'utf8');
  return backupPath;
};

// ---------------- PART A: SERVER.JS PATCHER ---------------- //

const patchServerStep5 = (serverPath) => {
  console.log(`\n🔧 Applying Step 5 (Part A) to: ${serverPath}`);
  let { text, eol } = readNormalized(serverPath);
  let changesApplied = 0;

  // ---- A.1: Add CatalogSyncState Schema ---- //
  const productModelAnchor = "const Product = mongoose.model('Product', productSchema);";
  const catalogSyncSchemaBlock = [
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
    '  maxCatalogCap: { type: Number, default: 300 },',
    '  activeCatalogTotal: { type: Number, default: 0 },',
    "  lastError: { type: String, default: '' },",
    '  updatedAt: { type: Date, default: Date.now }',
    '});',
    "const CatalogSyncState = mongoose.models.CatalogSyncState || mongoose.model('CatalogSyncState', catalogSyncStateSchema);"
  ].join('\n');

  if (text.includes('const CatalogSyncState =')) {
    console.log('  ✓ [A.1] CatalogSyncState schema already present (skipped)');
  } else if (text.includes(productModelAnchor)) {
    text = text.replace(productModelAnchor, catalogSyncSchemaBlock);
    changesApplied++;
    console.log('  ✅ [A.1] Added CatalogSyncState Mongoose schema & model');
  } else {
    throw new Error("[A.1] Could not find `const Product = mongoose.model('Product', productSchema);` anchor.");
  }

  // ---- A.2: Add persistCatalogSyncTelemetry & loadCatalogSyncTelemetry Helpers ---- //
  const cleanupAnchor = 'const cleanupPrunedProductReferences = async (prunedIds = []) => {';
  const telemetryHelpersBlock = [
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
    '          maxCatalogCap: Number(cjCatalogSyncTelemetry.maxCatalogCap || CJ_DEFAULT_CATALOG_CAP),',
    '          activeCatalogTotal: Number(cjCatalogSyncTelemetry.activeCatalogTotal || 0),',
    "          lastError: String(cjCatalogSyncTelemetry.lastError || ''),",
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
    '        maxCatalogCap: Number(saved.maxCatalogCap || CJ_DEFAULT_CATALOG_CAP),',
    '        activeCatalogTotal: Number(saved.activeCatalogTotal || 0),',
    "        lastError: saved.lastError || ''",
    '      };',
    '    }',
    '  } catch (err) {',
    "    console.warn('⚠️ Failed to load CatalogSyncState:', err.message);",
    '  }',
    '  return cjCatalogSyncTelemetry;',
    '};',
    ''
  ].join('\n');

  if (text.includes('const persistCatalogSyncTelemetry = async')) {
    console.log('  ✓ [A.2] persistCatalogSyncTelemetry & loadCatalogSyncTelemetry already present (skipped)');
  } else if (text.includes(cleanupAnchor)) {
    text = text.replace(cleanupAnchor, `${telemetryHelpersBlock}\n${cleanupAnchor}`);
    changesApplied++;
    console.log('  ✅ [A.2] Added persistCatalogSyncTelemetry & loadCatalogSyncTelemetry helpers');
  } else {
    throw new Error('[A.2] Could not find `cleanupPrunedProductReferences` anchor (ensure Step 2 was applied first).');
  }

  // ---- A.3: Persist Telemetry Inside sanitizeAndDeduplicateCatalog & syncCJCatalog (3 blocks) ---- //
  // 3.1: sanitizeAndDeduplicateCatalog
  const sanitizeTeleOld = [
    '    cjCatalogSyncTelemetry = {',
    '      ...cjCatalogSyncTelemetry,',
    '      lastSanitizedAt: nowIso,',
    '      lastDuplicatesPurgedCount: duplicatesPurged,',
    '      lastNonBeautyPurgedCount: nonBeautyPurgedCount,',
    '      lastExcessCapPrunedCount: excessPrunedCount,',
    '      maxCatalogCap: effectiveCap,',
    '      activeCatalogTotal',
    '    };'
  ].join('\n');

  const sanitizeTeleNew = [
    '    await persistCatalogSyncTelemetry({',
    '      lastSanitizedAt: nowIso,',
    '      lastDuplicatesPurgedCount: duplicatesPurged,',
    '      lastNonBeautyPurgedCount: nonBeautyPurgedCount,',
    '      lastExcessCapPrunedCount: excessPrunedCount,',
    '      maxCatalogCap: effectiveCap,',
    '      activeCatalogTotal',
    '    });'
  ].join('\n');

  if (text.includes(sanitizeTeleNew)) {
    console.log('  ✓ [A.3.1] sanitizeAndDeduplicateCatalog already persists telemetry (skipped)');
  } else if (text.includes(sanitizeTeleOld)) {
    text = text.replace(sanitizeTeleOld, sanitizeTeleNew);
    changesApplied++;
    console.log('  ✅ [A.3.1] Persisted telemetry in sanitizeAndDeduplicateCatalog');
  } else {
    throw new Error('[A.3.1] Could not find cjCatalogSyncTelemetry block in sanitizeAndDeduplicateCatalog.');
  }

  // 3.2: syncCJCatalog (success block)
  const syncSuccessOld = [
    '    cjCatalogSyncTelemetry = {',
    '      ...cjCatalogSyncTelemetry,',
    '      lastSyncAt: new Date().toISOString(),',
    "      lastSyncStatus: 'COMPLETED',",
    '      lastSyncedCount: totalProcessed,',
    '      lastNewAddedCount: newProductsAdded,',
    '      lastUpdatedCount: updatedProductsCount,',
    '      lastSanitizedAt: postSanitize?.sanitizedAt || new Date().toISOString(),',
    '      lastDuplicatesPurgedCount: totalDuplicatesPurged,',
    '      lastNonBeautyPurgedCount: totalNonBeautyPurged,',
    '      lastExcessCapPrunedCount: totalExcessPruned,',
    '      lastStalePrunedCount: stalePrunedCount,',
    '      maxCatalogCap: effectiveCap,',
    '      activeCatalogTotal: totalInDb,',
    "      nextScheduledSync: 'Daily at 3:00 AM CST (America/Chicago)'",
    '    };'
  ].join('\n');

  const syncSuccessNew = [
    '    await persistCatalogSyncTelemetry({',
    '      lastSyncAt: new Date().toISOString(),',
    "      lastSyncStatus: 'COMPLETED',",
    '      lastSyncedCount: totalProcessed,',
    '      lastNewAddedCount: newProductsAdded,',
    '      lastUpdatedCount: updatedProductsCount,',
    '      lastSanitizedAt: postSanitize?.sanitizedAt || new Date().toISOString(),',
    '      lastDuplicatesPurgedCount: totalDuplicatesPurged,',
    '      lastNonBeautyPurgedCount: totalNonBeautyPurged,',
    '      lastExcessCapPrunedCount: totalExcessPruned,',
    '      lastStalePrunedCount: stalePrunedCount,',
    '      maxCatalogCap: effectiveCap,',
    '      activeCatalogTotal: totalInDb,',
    "      lastError: '',",
    "      nextScheduledSync: 'Daily at 3:00 AM CST (America/Chicago)'",
    '    });'
  ].join('\n');

  if (text.includes(syncSuccessNew)) {
    console.log('  ✓ [A.3.2] syncCJCatalog (success) already persists telemetry (skipped)');
  } else if (text.includes(syncSuccessOld)) {
    text = text.replace(syncSuccessOld, syncSuccessNew);
    changesApplied++;
    console.log('  ✅ [A.3.2] Persisted telemetry in syncCJCatalog (success)');
  } else {
    throw new Error('[A.3.2] Could not find cjCatalogSyncTelemetry success block in syncCJCatalog.');
  }

  // 3.3: syncCJCatalog (catch block)
  const syncErrorOld = [
    '    cjCatalogSyncTelemetry = {',
    '      ...cjCatalogSyncTelemetry,',
    '      lastSyncAt: new Date().toISOString(),',
    "      lastSyncStatus: 'ERROR',",
    '      lastError: error?.response?.data?.message || error.message',
    '    };'
  ].join('\n');

  const syncErrorNew = [
    '    await persistCatalogSyncTelemetry({',
    '      lastSyncAt: new Date().toISOString(),',
    "      lastSyncStatus: 'ERROR',",
    '      lastError: error?.response?.data?.message || error.message',
    '    });'
  ].join('\n');

  if (text.includes(syncErrorNew)) {
    console.log('  ✓ [A.3.3] syncCJCatalog (error) already persists telemetry (skipped)');
  } else if (text.includes(syncErrorOld)) {
    text = text.replace(syncErrorOld, syncErrorNew);
    changesApplied++;
    console.log('  ✅ [A.3.3] Persisted telemetry in syncCJCatalog (error)');
  } else {
    throw new Error('[A.3.3] Could not find cjCatalogSyncTelemetry catch block in syncCJCatalog.');
  }

  // ---- A.4A: Hydrate Persisted Telemetry on Startup ---- //
  const startupAnchorOld = [
    '        await ensureDefaultOdieMemories();',
    "        await seedFounding50PromoCodes().catch((err) => console.warn('⚠️ Founding 50 startup seed notice:', err.message));"
  ].join('\n');

  const startupAnchorNew = [
    '        await loadCatalogSyncTelemetry();',
    '        await ensureDefaultOdieMemories();',
    "        await seedFounding50PromoCodes().catch((err) => console.warn('⚠️ Founding 50 startup seed notice:', err.message));"
  ].join('\n');

  if (text.includes(startupAnchorNew)) {
    console.log('  ✓ [A.4A] Startup loadCatalogSyncTelemetry() hook already present (skipped)');
  } else if (text.includes(startupAnchorOld)) {
    text = text.replace(startupAnchorOld, startupAnchorNew);
    changesApplied++;
    console.log('  ✅ [A.4A] Hooked loadCatalogSyncTelemetry() into startDatabaseAndBackgroundServices');
  } else {
    throw new Error('[A.4A] Could not find startup `await ensureDefaultOdieMemories();` block.');
  }

  // ---- A.4B: Hydrate Persisted Telemetry in GET /api/admin/products/sync-status ---- //
  const syncStatusOld = [
    "app.get('/api/admin/products/sync-status', authenticateToken, requireAdmin, async (req, res) => {",
    '  try {',
    '    const activeTotal = await Product.countDocuments();',
    '    cjCatalogSyncTelemetry.activeCatalogTotal = activeTotal;',
    '    res.status(200).json({',
    '      ...cjCatalogSyncTelemetry,',
    '      isSyncRunning: isCjSyncRunning,',
    '      isSanitizeRunning: isCatalogSanitizeRunning',
    '    });',
    '  } catch (error) {',
    "    res.status(500).json({ error: 'Failed to read catalog sync status.' });",
    '  }',
    '});'
  ].join('\n');

  const syncStatusNew = [
    "app.get('/api/admin/products/sync-status', authenticateToken, requireAdmin, async (req, res) => {",
    '  try {',
    '    if (!cjCatalogSyncTelemetry.lastSyncAt && !cjCatalogSyncTelemetry.lastSanitizedAt) {',
    '      await loadCatalogSyncTelemetry();',
    '    }',
    '    const activeTotal = await Product.countDocuments();',
    '    cjCatalogSyncTelemetry.activeCatalogTotal = activeTotal;',
    '    res.status(200).json({',
    '      ...cjCatalogSyncTelemetry,',
    '      isSyncRunning: isCjSyncRunning,',
    '      isSanitizeRunning: isCatalogSanitizeRunning',
    '    });',
    '  } catch (error) {',
    "    res.status(500).json({ error: 'Failed to read catalog sync status.' });",
    '  }',
    '});'
  ].join('\n');

  if (text.includes(syncStatusNew)) {
    console.log('  ✓ [A.4B] GET /api/admin/products/sync-status already hydrates telemetry (skipped)');
  } else if (text.includes(syncStatusOld)) {
    text = text.replace(syncStatusOld, syncStatusNew);
    changesApplied++;
    console.log('  ✅ [A.4B] Updated GET /api/admin/products/sync-status to hydrate CatalogSyncState');
  } else {
    throw new Error('[A.4B] Could not find GET /api/admin/products/sync-status route block.');
  }

  if (changesApplied > 0) {
    const backupPath = writeWithOriginalEol(serverPath, text, eol);
    console.log(`  💾 Saved ${serverPath} (${changesApplied} change(s) applied). Backup: ${path.basename(backupPath)}`);
  } else {
    console.log(`  ℹ️ No changes needed for ${serverPath}.`);
  }
};

// ---------------- PART B: APP.JS PATCHER ---------------- //

const patchAppStep5 = (appPath) => {
  console.log(`\n🔧 Applying Step 5 (Part B) to: ${appPath}`);
  let { text, eol } = readNormalized(appPath);
  let changesApplied = 0;

  // ---- B.1: Add lastStalePrunedCount & lastSyncStatus to syncStatusTelemetry state ---- //
  const stateOld = [
    '  const [syncStatusTelemetry, setSyncStatusTelemetry] = useState({',
    '    lastSyncAt: null,',
    '    lastSanitizedAt: null,',
    '    lastDuplicatesPurgedCount: 0,',
    '    lastNonBeautyPurgedCount: 0,',
    '    lastExcessCapPrunedCount: 0,',
    '    maxCatalogCap: 300,',
    '    activeCatalogTotal: 0,',
    "    nextScheduledSync: 'Daily at 3:00 AM CST (America/Chicago)'",
    '  });'
  ].join('\n');

  const stateNew = [
    '  const [syncStatusTelemetry, setSyncStatusTelemetry] = useState({',
    '    lastSyncAt: null,',
    "    lastSyncStatus: 'IDLE',",
    '    lastSanitizedAt: null,',
    '    lastDuplicatesPurgedCount: 0,',
    '    lastNonBeautyPurgedCount: 0,',
    '    lastExcessCapPrunedCount: 0,',
    '    lastStalePrunedCount: 0,',
    '    maxCatalogCap: 300,',
    '    activeCatalogTotal: 0,',
    "    nextScheduledSync: 'Daily at 3:00 AM CST (America/Chicago)'",
    '  });'
  ].join('\n');

  if (text.includes(stateNew)) {
    console.log('  ✓ [B.1] syncStatusTelemetry already includes lastSyncStatus & lastStalePrunedCount (skipped)');
  } else if (text.includes(stateOld)) {
    text = text.replace(stateOld, stateNew);
    changesApplied++;
    console.log('  ✅ [B.1] Added lastSyncStatus & lastStalePrunedCount to syncStatusTelemetry state');
  } else {
    throw new Error('[B.1] Could not find syncStatusTelemetry useState block in App.js.');
  }

  // ---- B.2: Upgrade AdminInventory Catalog Sync & Telemetry Command Bar ---- //
  const barStartAnchor = '      {/* Strict Uncapped Skincare & Beauty Catalog Sync & Perfume Purge Command Bar */}';
  const barEndAnchor = '      {/* Global CJ Shipping & Custom Label Control Bar */}';

  const barNew = [
    '      {/* Curated Skincare & Beauty Catalog Sync, Cap & Telemetry Command Bar */}',
    "      <div style={{ backgroundColor: '#FFFFFF', padding: '22px 26px', borderRadius: '20px', border: '2px solid #B38B8F', boxShadow: '0 8px 25px rgba(179, 139, 143, 0.18)', display: 'flex', flexDirection: 'column', gap: '14px' }}>",
    "        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px' }}>",
    '          <div>',
    "            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>",
    "              <h2 style={{ fontFamily: \"'Cormorant Garamond', serif\", fontSize: '1.95rem', color: '#5C5454', margin: 0 }}>",
    '                ✨ Curated Skincare & Beauty Catalog Sync & Sanitization',
    '              </h2>',
    "              <span style={{ backgroundColor: '#F6FBF7', color: '#2E7D32', border: '1px solid #A5D6A7', padding: '4px 12px', borderRadius: '14px', fontSize: '0.78rem', fontWeight: 'bold', fontFamily: 'sans-serif' }}>",
    '                🚫 Perfume, Hair, Nail & Oral Blocked • ⏰ 3:00 AM CST Sync',
    '              </span>',
    '            </div>',
    "            <p style={{ margin: '5px 0 0 0', fontSize: '0.88rem', color: '#8A797A', fontFamily: 'sans-serif', lineHeight: '1.45' }}>",
    '              Maintains a fast, curated <strong>Skincare & Facial/Cosmetic Beauty</strong> catalog capped at <strong>{selectedMaxCatalogCap}</strong> products (plus locked custom items), automatically prunes stale discontinued CJ listings, and merges multi-size seller clones.',
    '            </p>',
    '          </div>',
    '',
    "          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>",
    "            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontFamily: 'sans-serif', color: '#5C5454', backgroundColor: '#FFF9F9', border: '1px solid #E8C5C8', padding: '6px 10px', borderRadius: '16px' }}>",
    '              <span>Cap:</span>',
    '              <select',
    '                value={selectedMaxCatalogCap}',
    '                onChange={(e) => setSelectedMaxCatalogCap(Number(e.target.value) || 300)}',
    "                style={{ border: 'none', background: 'transparent', color: '#5C5454', fontWeight: 'bold', fontSize: '0.82rem', outline: 'none', cursor: 'pointer' }}",
    '              >',
    '                <option value={150}>150</option>',
    '                <option value={200}>200</option>',
    '                <option value={300}>300</option>',
    '                <option value={500}>500</option>',
    '              </select>',
    '            </label>',
    '            <button',
    '              type="button"',
    '              disabled={isSyncingAndSanitizing || isSanitizingOnly}',
    '              onClick={() => handleFullSyncAndSanitize(false)}',
    "              style={{ backgroundColor: '#F2D4D7', border: '1px solid #B38B8F', color: '#5C5454', padding: '10px 18px', borderRadius: '22px', fontFamily: \"'Cormorant Garamond', serif\", fontSize: '1.08rem', fontWeight: 'bold', cursor: (isSyncingAndSanitizing || isSanitizingOnly) ? 'not-allowed' : 'pointer', boxShadow: '0 4px 12px rgba(179, 139, 143, 0.25)' }}",
    '            >',
    "              {isSyncingAndSanitizing ? '⏳ Syncing Curated Catalog...' : '✨ Sync Skincare & Beauty'}",
    '            </button>',
    '            <button',
    '              type="button"',
    '              disabled={isSyncingAndSanitizing || isSanitizingOnly}',
    '              onClick={() => handleFullSyncAndSanitize(true)}',
    "              style={{ backgroundColor: '#FFF0F2', border: '1px solid #B38B8F', color: '#5C5454', padding: '10px 16px', borderRadius: '22px', fontFamily: \"'Cormorant Garamond', serif\", fontSize: '1.02rem', fontWeight: 'bold', cursor: (isSyncingAndSanitizing || isSanitizingOnly) ? 'not-allowed' : 'pointer' }}",
    '            >',
    "              {isSanitizingOnly ? '⏳ Sanitizing & Capping...' : '🧹 Purge & Enforce Cap Now'}",
    '            </button>',
    '          </div>',
    '        </div>',
    '',
    '        {/* Live Persisted Telemetry Status Bar */}',
    "        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', backgroundColor: '#FFF9F9', padding: '10px 14px', borderRadius: '12px', border: '1px solid #E8C5C8', fontFamily: 'sans-serif', fontSize: '0.8rem', color: '#5C5454' }}>",
    "          <span style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8C5C8', borderRadius: '10px', padding: '4px 10px', fontWeight: 'bold' }}>",
    "            📦 Active Catalog: <strong style={{ color: '#B38B8F' }}>{inventory.length} / {syncStatusTelemetry.maxCatalogCap || selectedMaxCatalogCap}</strong>",
    '          </span>',
    "          <span style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8C5C8', borderRadius: '10px', padding: '4px 10px' }}>",
    "            🕒 Last CJ Sync:{' '}",
    '            <strong>',
    '              {syncStatusTelemetry.lastSyncAt',
    '                ? new Date(syncStatusTelemetry.lastSyncAt).toLocaleString()',
    "                : 'Awaiting Next 3:00 AM CST Sync'}",
    '            </strong>',
    "            {syncStatusTelemetry.lastSyncStatus && syncStatusTelemetry.lastSyncStatus !== 'IDLE' ? ` (${syncStatusTelemetry.lastSyncStatus})` : ''}",
    '          </span>',
    "          <span style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8C5C8', borderRadius: '10px', padding: '4px 10px' }}>",
    "            ✂️ Over-Cap Pruned: <strong style={{ color: '#B26A00' }}>{syncStatusTelemetry.lastExcessCapPrunedCount || 0}</strong>",
    '          </span>',
    "          <span style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8C5C8', borderRadius: '10px', padding: '4px 10px' }}>",
    "            🗑️ Stale Pruned: <strong style={{ color: '#736A6A' }}>{syncStatusTelemetry.lastStalePrunedCount || 0}</strong>",
    '          </span>',
    "          <span style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8C5C8', borderRadius: '10px', padding: '4px 10px' }}>",
    "            🚫 Non-Skincare Purged: <strong style={{ color: '#C62828' }}>{syncStatusTelemetry.lastNonBeautyPurgedCount || 0}</strong>",
    '          </span>',
    "          <span style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8C5C8', borderRadius: '10px', padding: '4px 10px' }}>",
    "            ♻️ Duplicates Merged: <strong style={{ color: '#2E7D32' }}>{syncStatusTelemetry.lastDuplicatesPurgedCount || 0}</strong>",
    '          </span>',
    "          <span style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8C5C8', borderRadius: '10px', padding: '4px 10px' }}>",
    "            🧹 Last Sanitized:{' '}",
    '            <strong>',
    '              {syncStatusTelemetry.lastSanitizedAt',
    '                ? new Date(syncStatusTelemetry.lastSanitizedAt).toLocaleString()',
    "                : 'Verified on Startup'}",
    '            </strong>',
    '          </span>',
    '        </div>',
    '      </div>',
    ''
  ].join('\n');

  const barStartIdx = text.indexOf(barStartAnchor);
  const barEndIdx = text.indexOf(barEndAnchor);

  if (text.includes('{/* Curated Skincare & Beauty Catalog Sync, Cap & Telemetry Command Bar */}')) {
    console.log('  ✓ [B.2] AdminInventory command bar already upgraded (skipped)');
  } else if (barStartIdx !== -1 && barEndIdx > barStartIdx) {
    text = text.slice(0, barStartIdx) + barNew + '\n' + text.slice(barEndIdx);
    changesApplied++;
    console.log('  ✅ [B.2] Upgraded AdminInventory command bar with Cap selector & persisted telemetry pills');
  } else {
    throw new Error('[B.2] Could not locate AdminInventory Catalog Sync command bar anchors.');
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
    throw new Error('Could not locate server.js. Pass it explicitly: node apply_step5_patch.js path/to/server.js path/to/App.js');
  }
  if (!appPath) {
    throw new Error('Could not locate App.js. Pass it explicitly: node apply_step5_patch.js path/to/server.js path/to/App.js');
  }

  patchServerStep5(serverPath);
  patchAppStep5(appPath);

  console.log('\n✨ All Step 5 changes applied successfully!');
  console.log('Final verification commands:');
  console.log(`  1. Syntax-check backend:   node --check "${serverPath}"`);
  console.log('  2. Build React frontend:   cd client && npm run build');
  console.log('  3. Commit & push to Render, then verify the End-to-End Checklist!');
} catch (err) {
  console.error('\n❌ Step 5 patch failed:', err.message);
  process.exit(1);
}
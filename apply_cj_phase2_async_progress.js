#!/usr/bin/env node
/**
 * apply_cj_phase2_async_progress.js
 *
 * Phase 2 of the Uncapped CJ Dropshipping Skincare & Beauty Integration Plan.
 * Safely and idempotently patches `server.js` and `App.js` to:
 *
 *  Part A — server.js:
 *    1. Extend `CatalogSyncState` schema, `cjCatalogSyncTelemetry`, and
 *       `persistCatalogSyncTelemetry` / `loadCatalogSyncTelemetry` with live
 *       crawl progress fields (`syncPhase`, `currentSourceLabel`, `pagesFetched`,
 *       `itemsProcessed`, `startedAt`, `cancelRequested`).
 *    2. Add `cjSyncCancelRequested` support and live per-page progress updates
 *       inside `syncCJCatalog` (persisting checkpoints to MongoDB every 5 pages
 *       and skipping stale-item pruning if a crawl is stopped early).
 *    3. Convert `POST /api/admin/products/sync-and-sanitize` and
 *       `POST /api/admin/cj-sync` to launch full crawls asynchronously in the
 *       background and return `202 Accepted` immediately (preventing Render HTTP
 *       502/504 timeouts), while keeping `sanitizeOnly` / `purgeOnly` fast & synchronous.
 *    4. Add `POST /api/admin/products/sync-stop` to gracefully stop an active crawl.
 *
 *  Part B — App.js (AdminInventory):
 *    1. Extend `syncStatusTelemetry` state with live progress fields.
 *    2. Handle `202 Accepted` background sync responses, add `handleStopCjSync`,
 *       and auto-poll `GET /api/admin/products/sync-status` every 5 seconds while
 *       a crawl is running (auto-refreshing the inventory list upon completion).
 *    3. Upgrade the `AdminInventory` Command Bar to remove the 150/200/300/500 Cap
 *       dropdown, display an "∞ Uncapped — All CJ Skincare & Beauty" badge, show
 *       a live progress panel while syncing, and provide a "⏹️ Stop Sync" button.
 *
 * Usage:
 *   node apply_cj_phase2_async_progress.js
 *   node apply_cj_phase2_async_progress.js path/to/server.js path/to/App.js
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
  const backupPath = `${filePath}.cj_phase2_${Date.now()}.bak`;
  fs.copyFileSync(filePath, backupPath);
  const output = eol === '\r\n' ? normalizedText.replace(/\n/g, '\r\n') : normalizedText;
  fs.writeFileSync(filePath, output, 'utf8');
  return backupPath;
};

// ---------------- PART A: SERVER.JS PATCHER ---------------- //

const patchServerPhase2 = (serverPath) => {
  console.log(`\n🔧 Applying CJ Phase 2 (Part A — Background Sync & Live Progress) to: ${serverPath}`);
  let { text, eol } = readNormalized(serverPath);
  let changesApplied = 0;

  // ---- A.1: Extend CatalogSyncState Schema with live progress fields ---- //
  const schemaOldLine = "  lastError: { type: String, default: '' },\n  updatedAt: { type: Date, default: Date.now }";
  const schemaNewLines = [
    "  lastError: { type: String, default: '' },",
    "  syncPhase: { type: String, default: 'IDLE' },",
    "  currentSourceLabel: { type: String, default: '' },",
    '  pagesFetched: { type: Number, default: 0 },',
    '  itemsProcessed: { type: Number, default: 0 },',
    '  startedAt: { type: Date, default: null },',
    '  cancelRequested: { type: Boolean, default: false },',
    '  updatedAt: { type: Date, default: Date.now }'
  ].join('\n');

  if (text.includes("syncPhase: { type: String, default: 'IDLE' },")) {
    console.log('  ✓ [A.1] CatalogSyncState schema already has live progress fields (skipped)');
  } else if (text.includes(schemaOldLine)) {
    text = text.replace(schemaOldLine, schemaNewLines);
    changesApplied++;
    console.log('  ✅ [A.1] Added live progress fields to CatalogSyncState schema');
  } else {
    console.log('  ℹ️ [A.1] CatalogSyncState schema not found or already customized (will still update in-memory telemetry)');
  }

  // ---- A.2: Add cjSyncCancelRequested & Live Progress Fields to cjCatalogSyncTelemetry ---- //
  const flagsOld = [
    'let isCjSyncRunning = false;',
    'let isCatalogSanitizeRunning = false;'
  ].join('\n');

  const flagsNew = [
    'let isCjSyncRunning = false;',
    'let isCatalogSanitizeRunning = false;',
    'let cjSyncCancelRequested = false;'
  ].join('\n');

  if (text.includes('let cjSyncCancelRequested = false;')) {
    console.log('  ✓ [A.2a] cjSyncCancelRequested flag already present (skipped)');
  } else if (text.includes(flagsOld)) {
    text = text.replace(flagsOld, flagsNew);
    changesApplied++;
    console.log('  ✅ [A.2a] Added cjSyncCancelRequested flag');
  } else {
    throw new Error('[A.2a] Could not find `isCjSyncRunning` / `isCatalogSanitizeRunning` declarations.');
  }

  const teleEndOld = [
    "  nextScheduledSync: 'Daily at 3:00 AM CST (America/Chicago)',",
    "  timezone: 'America/Chicago'",
    '};'
  ].join('\n');

  const teleEndNew = [
    "  syncPhase: 'IDLE',",
    "  currentSourceLabel: '',",
    '  pagesFetched: 0,',
    '  itemsProcessed: 0,',
    '  startedAt: null,',
    '  cancelRequested: false,',
    "  lastError: '',",
    "  nextScheduledSync: 'Daily at 3:00 AM CST (America/Chicago)',",
    "  timezone: 'America/Chicago'",
    '};'
  ].join('\n');

  if (text.includes("  syncPhase: 'IDLE',\n  currentSourceLabel: '',")) {
    console.log('  ✓ [A.2b] cjCatalogSyncTelemetry already includes live progress defaults (skipped)');
  } else if (text.includes(teleEndOld)) {
    text = text.replace(teleEndOld, teleEndNew);
    changesApplied++;
    console.log('  ✅ [A.2b] Added live progress defaults to cjCatalogSyncTelemetry');
  } else {
    throw new Error('[A.2b] Could not find cjCatalogSyncTelemetry closing fields.');
  }

  // ---- A.3: Persist & Load Live Progress Fields in persistCatalogSyncTelemetry / loadCatalogSyncTelemetry ---- //
  const persistOld = [
    "          lastError: String(cjCatalogSyncTelemetry.lastError || ''),",
    '          updatedAt: new Date()'
  ].join('\n');

  const persistNew = [
    "          lastError: String(cjCatalogSyncTelemetry.lastError || ''),",
    "          syncPhase: String(cjCatalogSyncTelemetry.syncPhase || 'IDLE'),",
    "          currentSourceLabel: String(cjCatalogSyncTelemetry.currentSourceLabel || ''),",
    '          pagesFetched: Number(cjCatalogSyncTelemetry.pagesFetched || 0),',
    '          itemsProcessed: Number(cjCatalogSyncTelemetry.itemsProcessed || 0),',
    '          startedAt: cjCatalogSyncTelemetry.startedAt ? new Date(cjCatalogSyncTelemetry.startedAt) : null,',
    '          cancelRequested: Boolean(cjCatalogSyncTelemetry.cancelRequested),',
    '          updatedAt: new Date()'
  ].join('\n');

  if (text.includes("syncPhase: String(cjCatalogSyncTelemetry.syncPhase || 'IDLE'),")) {
    console.log('  ✓ [A.3a] persistCatalogSyncTelemetry already saves live progress fields (skipped)');
  } else if (text.includes(persistOld)) {
    text = text.replace(persistOld, persistNew);
    changesApplied++;
    console.log('  ✅ [A.3a] Updated persistCatalogSyncTelemetry to persist live progress fields');
  }

  const loadOld = [
    '        activeCatalogTotal: Number(saved.activeCatalogTotal || 0),',
    "        lastError: saved.lastError || ''"
  ].join('\n');

  const loadNew = [
    '        activeCatalogTotal: Number(saved.activeCatalogTotal || 0),',
    "        lastError: saved.lastError || '',",
    "        syncPhase: isCjSyncRunning ? (saved.syncPhase || 'RUNNING') : (saved.syncPhase === 'RUNNING' || saved.syncPhase === 'CATEGORIES' || saved.syncPhase === 'KEYWORDS' ? 'IDLE' : (saved.syncPhase || 'IDLE')),",
    "        currentSourceLabel: isCjSyncRunning ? (saved.currentSourceLabel || '') : '',",
    '        pagesFetched: Number(saved.pagesFetched || 0),',
    '        itemsProcessed: Number(saved.itemsProcessed || 0),',
    '        startedAt: saved.startedAt ? new Date(saved.startedAt).toISOString() : null,',
    '        cancelRequested: false'
  ].join('\n');

  if (text.includes('pagesFetched: Number(saved.pagesFetched || 0),')) {
    console.log('  ✓ [A.3b] loadCatalogSyncTelemetry already hydrates live progress fields (skipped)');
  } else if (text.includes(loadOld)) {
    text = text.replace(loadOld, loadNew);
    changesApplied++;
    console.log('  ✅ [A.3b] Updated loadCatalogSyncTelemetry to hydrate live progress fields');
  }

  // ---- A.4: Wire Live Progress Checkpointing & Graceful Stop into syncCJCatalog ---- //
  // Verify Phase 1 crawler is installed
  if (!text.includes('// UNCAPPED MULTI-PAGE CJ SKINCARE & BEAUTY CRAWLER:')) {
    throw new Error('[A.4] Phase 1 uncapped crawler not found in server.js. Run `node apply_cj_phase1_uncapped_crawler.js` first.');
  }

  // 4a. Initialize live progress at start of syncCJCatalog
  const initOld = [
    '  isCjSyncRunning = true;',
    '  const fullCatalog = options.fullCatalog !== undefined ? Boolean(options.fullCatalog) : true;'
  ].join('\n');

  const initNew = [
    '  isCjSyncRunning = true;',
    '  cjSyncCancelRequested = false;',
    '  const fullCatalog = options.fullCatalog !== undefined ? Boolean(options.fullCatalog) : true;'
  ].join('\n');

  if (text.includes('  isCjSyncRunning = true;\n  cjSyncCancelRequested = false;')) {
    console.log('  ✓ [A.4a] syncCJCatalog cancel reset already present (skipped)');
  } else if (text.includes(initOld)) {
    text = text.replace(initOld, initNew);
    changesApplied++;
    console.log('  ✅ [A.4a] Added cancel flag reset at start of syncCJCatalog');
  } else {
    throw new Error('[A.4a] Could not find `isCjSyncRunning = true;` inside syncCJCatalog.');
  }

  // 4b. Emit PRE_SANITIZING live telemetry before preSanitize
  const preSanOld = [
    '  try {',
    '    // 1. Pre-sanitize existing catalog (removes non-skincare/perfume items & duplicates; no cap)',
    '    const preSanitize = await sanitizeAndDeduplicateCatalog();'
  ].join('\n');

  const preSanNew = [
    '  try {',
    '    await saveCatalogTelemetrySafe({',
    "      syncPhase: 'PRE_SANITIZING',",
    "      lastSyncStatus: 'RUNNING',",
    "      currentSourceLabel: 'Pre-sanitizing existing MongoDB catalog...',",
    '      pagesFetched: 0,',
    '      itemsProcessed: 0,',
    '      lastNewAddedCount: 0,',
    '      lastUpdatedCount: 0,',
    '      startedAt: new Date().toISOString(),',
    '      cancelRequested: false,',
    "      lastError: ''",
    '    });',
    '',
    '    // 1. Pre-sanitize existing catalog (removes non-skincare/perfume items & duplicates; no cap)',
    '    const preSanitize = await sanitizeAndDeduplicateCatalog();'
  ].join('\n');

  if (text.includes("syncPhase: 'PRE_SANITIZING',")) {
    console.log('  ✓ [A.4b] PRE_SANITIZING live progress update already present (skipped)');
  } else if (text.includes(preSanOld)) {
    text = text.replace(preSanOld, preSanNew);
    changesApplied++;
    console.log('  ✅ [A.4b] Added PRE_SANITIZING live progress update');
  } else {
    throw new Error('[A.4b] Could not find preSanitize anchor inside syncCJCatalog.');
  }

  // 4c. Live progress + cancelRequested check inside crawlPaginatedSource
  const crawlLoopOld = [
    '      for (let pageNum = 1; pageNum <= maxPagesPerSource; pageNum++) {',
    '        if (maxPages > 0 && pagesFetched >= maxPages) break;',
    '        if (maxProducts > 0 && totalProcessed >= maxProducts) break;',
    '',
    '        pagesFetched++;',
    '        const url = buildUrl(pageNum);',
    '        const pageRes = await fetchCjProductPage(url);'
  ].join('\n');

  const crawlLoopNew = [
    '      for (let pageNum = 1; pageNum <= maxPagesPerSource; pageNum++) {',
    '        if (cjSyncCancelRequested) break;',
    '        if (maxPages > 0 && pagesFetched >= maxPages) break;',
    '        if (maxProducts > 0 && totalProcessed >= maxProducts) break;',
    '',
    '        pagesFetched++;',
    '        cjCatalogSyncTelemetry = {',
    '          ...cjCatalogSyncTelemetry,',
    '          currentSourceLabel: `${sourceLabel} (page ${pageNum})`,',
    '          pagesFetched,',
    '          itemsProcessed: totalProcessed,',
    '          lastNewAddedCount: newProductsAdded,',
    '          lastUpdatedCount: updatedProductsCount,',
    '          cancelRequested: cjSyncCancelRequested',
    '        };',
    '        const url = buildUrl(pageNum);',
    '        const pageRes = await fetchCjProductPage(url);'
  ].join('\n');

  if (text.includes('if (cjSyncCancelRequested) break;\n        if (maxPages > 0 && pagesFetched >= maxPages) break;')) {
    console.log('  ✓ [A.4c] crawlPaginatedSource live progress & cancel check already present (skipped)');
  } else if (text.includes(crawlLoopOld)) {
    text = text.replace(crawlLoopOld, crawlLoopNew);
    changesApplied++;
    console.log('  ✅ [A.4c] Added live per-page progress & cancel check in crawlPaginatedSource');
  } else {
    throw new Error('[A.4c] Could not find crawlPaginatedSource loop anchor.');
  }

  const afterBatchOld = [
    '        const saved = await processCjBatch(list, fromBeautySource, sourceLabel);',
    '        sourceSavedTotal += saved;'
  ].join('\n');

  const afterBatchNew = [
    '        const saved = await processCjBatch(list, fromBeautySource, sourceLabel);',
    '        sourceSavedTotal += saved;',
    '        cjCatalogSyncTelemetry = {',
    '          ...cjCatalogSyncTelemetry,',
    '          pagesFetched,',
    '          itemsProcessed: totalProcessed,',
    '          lastNewAddedCount: newProductsAdded,',
    '          lastUpdatedCount: updatedProductsCount',
    '        };',
    '        if (pagesFetched % 5 === 0) {',
    '          const liveCount = await Product.countDocuments().catch(() => cjCatalogSyncTelemetry.activeCatalogTotal || 0);',
    '          await saveCatalogTelemetrySafe({',
    '            pagesFetched,',
    '            itemsProcessed: totalProcessed,',
    '            lastNewAddedCount: newProductsAdded,',
    '            lastUpdatedCount: updatedProductsCount,',
    '            activeCatalogTotal: liveCount',
    '          });',
    '        }'
  ].join('\n');

  if (text.includes('if (pagesFetched % 5 === 0) {')) {
    console.log('  ✓ [A.4d] Periodic MongoDB checkpointing already present (skipped)');
  } else if (text.includes(afterBatchOld)) {
    text = text.replace(afterBatchOld, afterBatchNew);
    changesApplied++;
    console.log('  ✅ [A.4d] Added periodic 5-page MongoDB telemetry checkpointing');
  } else {
    throw new Error('[A.4d] Could not find `sourceSavedTotal += saved;` anchor.');
  }

  // 4e. Stage A & Stage B phase updates + cancel check
  const stageAOld = [
    '    // Stage A: Multi-page crawl of ALL discovered CJ Skincare & Beauty leaf categories',
    '    const beautyCategories = await fetchCjBeautyCategoryIds(headers);',
    '    for (const cat of beautyCategories) {',
    '      if (maxPages > 0 && pagesFetched >= maxPages) break;'
  ].join('\n');

  const stageANew = [
    '    // Stage A: Multi-page crawl of ALL discovered CJ Skincare & Beauty leaf categories',
    '    await saveCatalogTelemetrySafe({',
    "      syncPhase: 'CATEGORIES',",
    "      currentSourceLabel: 'Discovering CJ Skincare & Beauty categories...'",
    '    });',
    '    const beautyCategories = await fetchCjBeautyCategoryIds(headers);',
    '    for (const cat of beautyCategories) {',
    '      if (cjSyncCancelRequested) break;',
    '      if (maxPages > 0 && pagesFetched >= maxPages) break;'
  ].join('\n');

  if (text.includes("syncPhase: 'CATEGORIES',")) {
    console.log('  ✓ [A.4e] Stage A phase & cancel check already present (skipped)');
  } else if (text.includes(stageAOld)) {
    text = text.replace(stageAOld, stageANew);
    changesApplied++;
    console.log('  ✅ [A.4e] Added CATEGORIES phase & cancel check to Stage A');
  } else {
    throw new Error('[A.4e] Could not find Stage A anchor in syncCJCatalog.');
  }

  const stageBOld = [
    '    // Stage B: Multi-page sweep of strictly curated Skincare & Facial/Cosmetic Beauty keyword queries',
    '    for (const query of CJ_BEAUTY_SEARCH_QUERIES) {',
    '      if (maxPages > 0 && pagesFetched >= maxPages) break;'
  ].join('\n');

  const stageBNew = [
    '    // Stage B: Multi-page sweep of strictly curated Skincare & Facial/Cosmetic Beauty keyword queries',
    '    if (!cjSyncCancelRequested) {',
    '      await saveCatalogTelemetrySafe({',
    "        syncPhase: 'KEYWORDS',",
    "        currentSourceLabel: 'Sweeping CJ Skincare & Beauty keywords...'",
    '      });',
    '    }',
    '    for (const query of CJ_BEAUTY_SEARCH_QUERIES) {',
    '      if (cjSyncCancelRequested) break;',
    '      if (maxPages > 0 && pagesFetched >= maxPages) break;'
  ].join('\n');

  if (text.includes("syncPhase: 'KEYWORDS',")) {
    console.log('  ✓ [A.4f] Stage B phase & cancel check already present (skipped)');
  } else if (text.includes(stageBOld)) {
    text = text.replace(stageBOld, stageBNew);
    changesApplied++;
    console.log('  ✅ [A.4f] Added KEYWORDS phase & cancel check to Stage B');
  } else {
    throw new Error('[A.4f] Could not find Stage B anchor in syncCJCatalog.');
  }

  // 4g. Guard Stage C stale pruning against cjSyncCancelRequested and update final status/phase
  const stageCOld = [
    '    const isCompleteUncappedSweep =',
    '      fullCatalog && crawlErrorCount === 0 && maxPages === 0 && maxProducts === 0 && totalProcessed >= 50;'
  ].join('\n');

  const stageCNew = [
    '    const isCompleteUncappedSweep =',
    '      !cjSyncCancelRequested && fullCatalog && crawlErrorCount === 0 && maxPages === 0 && maxProducts === 0 && totalProcessed >= 50;'
  ].join('\n');

  if (text.includes('!cjSyncCancelRequested && fullCatalog && crawlErrorCount === 0')) {
    console.log('  ✓ [A.4g] Stage C stale pruning already guarded against stop/cancel (skipped)');
  } else if (text.includes(stageCOld)) {
    text = text.replace(stageCOld, stageCNew);
    changesApplied++;
    console.log('  ✅ [A.4g] Guarded Stage C stale pruning against graceful stop/cancel');
  } else {
    throw new Error('[A.4g] Could not find `isCompleteUncappedSweep` anchor in Stage C.');
  }

  const finalStatusOld = [
    '    await saveCatalogTelemetrySafe({',
    '      lastSyncAt: new Date().toISOString(),',
    "      lastSyncStatus: crawlErrorCount > 0 ? 'COMPLETED_WITH_WARNINGS' : 'COMPLETED',",
    '      lastSyncedCount: totalProcessed,'
  ].join('\n');

  const finalStatusNew = [
    "    const finalStatus = cjSyncCancelRequested",
    "      ? 'STOPPED'",
    "      : crawlErrorCount > 0",
    "      ? 'COMPLETED_WITH_WARNINGS'",
    "      : 'COMPLETED';",
    '    await saveCatalogTelemetrySafe({',
    '      lastSyncAt: new Date().toISOString(),',
    '      lastSyncStatus: finalStatus,',
    '      syncPhase: finalStatus,',
    "      currentSourceLabel: '',",
    '      pagesFetched,',
    '      itemsProcessed: totalProcessed,',
    '      cancelRequested: false,',
    '      lastSyncedCount: totalProcessed,'
  ].join('\n');

  if (text.includes("const finalStatus = cjSyncCancelRequested")) {
    console.log('  ✓ [A.4h] Final syncPhase/STOPPED telemetry already present (skipped)');
  } else if (text.includes(finalStatusOld)) {
    text = text.replace(finalStatusOld, finalStatusNew);
    changesApplied++;
    console.log('  ✅ [A.4h] Updated final telemetry block to record STOPPED/COMPLETED phase cleanly');
  } else {
    throw new Error('[A.4h] Could not find final `saveCatalogTelemetrySafe` block in syncCJCatalog.');
  }

  const catchStatusOld = [
    '    await saveCatalogTelemetrySafe({',
    '      lastSyncAt: new Date().toISOString(),',
    "      lastSyncStatus: 'ERROR',",
    '      lastError: error?.response?.data?.message || error.message',
    '    });'
  ].join('\n');

  const catchStatusNew = [
    '    await saveCatalogTelemetrySafe({',
    '      lastSyncAt: new Date().toISOString(),',
    "      lastSyncStatus: 'ERROR',",
    "      syncPhase: 'ERROR',",
    "      currentSourceLabel: '',",
    '      cancelRequested: false,',
    '      lastError: error?.response?.data?.message || error.message',
    '    });'
  ].join('\n');

  if (text.includes("syncPhase: 'ERROR',")) {
    console.log('  ✓ [A.4i] Error catch syncPhase already present (skipped)');
  } else if (text.includes(catchStatusOld)) {
    text = text.replace(catchStatusOld, catchStatusNew);
    changesApplied++;
    console.log('  ✅ [A.4i] Updated catch block telemetry to reset syncPhase/cancelRequested');
  }

  const finallyOld = [
    '  } finally {',
    '    isCjSyncRunning = false;',
    '  }'
  ].join('\n');

  const finallyNew = [
    '  } finally {',
    '    isCjSyncRunning = false;',
    '    cjSyncCancelRequested = false;',
    '  }'
  ].join('\n');

  if (text.includes('    isCjSyncRunning = false;\n    cjSyncCancelRequested = false;')) {
    console.log('  ✓ [A.4j] finally block already resets cjSyncCancelRequested (skipped)');
  } else if (text.includes(finallyOld)) {
    text = text.replace(finallyOld, finallyNew);
    changesApplied++;
    console.log('  ✅ [A.4j] Updated finally block to reset cjSyncCancelRequested');
  }

  // ---- A.5: Upgrade Admin CJ Sync Routes to Non-Blocking 202 Background Jobs + Stop Endpoint ---- //
  const routesStartAnchor = '// ---------------- ADMIN CJ SYNC & CLEANUP ROUTE ---------------- //';
  const routesEndAnchor = '// ---------------- MANUAL INVENTORY & BLUEPRINT LABELING ROUTES ---------------- //';

  const rStartIdx = text.indexOf(routesStartAnchor);
  const rEndIdx = text.indexOf(routesEndAnchor);

  const asyncRoutesBlock = [
    '// ---------------- ADMIN CJ SYNC & CLEANUP ROUTE ---------------- //',
    '',
    "app.post('/api/admin/cj-sync', authenticateToken, requireAdmin, async (req, res) => {",
    '  try {',
    '    const { purgeOnly, sanitizeOnly, maxPages, maxProducts } = req.body || {};',
    '    if (purgeOnly || sanitizeOnly) {',
    '      const sanitizeRes = await sanitizeAndDeduplicateCatalog();',
    "      const products = await Product.find({}).sort({ _id: -1 }).limit(300).lean();",
    '      return res.status(200).json({',
    '        message: `🧹 Strict Skincare & Beauty Purge Complete: removed ${sanitizeRes.nonBeautyPurgedCount || 0} perfume/non-skincare items and ${sanitizeRes.duplicatesPurged || 0} duplicates (${sanitizeRes.activeCatalogTotal || 0} unique Skincare & Beauty products active — uncapped) ✧`,',
    '        purgedCount: sanitizeRes.nonBeautyPurgedCount || 0,',
    '        duplicatesPurged: sanitizeRes.duplicatesPurged || 0,',
    '        excessPrunedCount: 0,',
    '        syncedCount: 0,',
    '        activeTotal: sanitizeRes.activeCatalogTotal || products.length,',
    '        syncTelemetry: cjCatalogSyncTelemetry,',
    '        products',
    '      });',
    '    }',
    '',
    '    if (isCjSyncRunning) {',
    '      return res.status(202).json({',
    "        status: 'already_running',",
    '        started: false,',
    '        isSyncRunning: true,',
    "        message: '⏳ An uncapped CJ Skincare & Beauty crawl is already running in the background. Live progress updates every 5 seconds.',",
    '        syncTelemetry: cjCatalogSyncTelemetry',
    '      });',
    '    }',
    '',
    '    // Fire-and-forget background execution so Render never hits HTTP 502/504 timeouts',
    '    setImmediate(() => {',
    '      syncCJCatalog({ fullCatalog: true, sanitizeAfter: true, maxPages, maxProducts }).catch((err) => {',
    "        console.error('❌ Background CJ sync error:', err?.message || err);",
    '      });',
    '    });',
    '',
    '    return res.status(202).json({',
    "      status: 'started',",
    '      started: true,',
    '      isSyncRunning: true,',
    "      message: '🚀 Uncapped CJ Skincare & Beauty crawl started in the background! Live progress will refresh automatically every 5 seconds ✧',",
    '      syncTelemetry: {',
    '        ...cjCatalogSyncTelemetry,',
    "        lastSyncStatus: 'RUNNING',",
    "        syncPhase: 'PRE_SANITIZING',",
    '        isSyncRunning: true',
    '      }',
    '    });',
    '  } catch (error) {',
    "    console.error('Admin CJ Sync Error:', error);",
    "    res.status(500).json({ error: error.message || 'Failed to run CJ Skincare & Beauty sync.' });",
    '  }',
    '});',
    '',
    '// POST /api/admin/products/sync-and-sanitize — Synchronous for sanitizeOnly; Async 202 Background Crawl for full CJ pull',
    "app.post('/api/admin/products/sync-and-sanitize', authenticateToken, requireAdmin, async (req, res) => {",
    '  try {',
    '    const { sanitizeOnly, maxPages, maxProducts } = req.body || {};',
    '    if (sanitizeOnly) {',
    '      const sanitizeResult = await sanitizeAndDeduplicateCatalog();',
    '      const activeTotal = sanitizeResult.activeCatalogTotal || (await Product.countDocuments());',
    '      return res.status(200).json({',
    '        message: `🧹 Strict Skincare & Beauty Sanitization Complete (Uncapped)! Purged ${sanitizeResult.nonBeautyPurgedCount || 0} perfume/non-skincare items and merged ${sanitizeResult.groupsMerged || 0} duplicate groups (${sanitizeResult.duplicatesPurged || 0} duplicates removed) → ${activeTotal} unique Skincare & Beauty products active ✧`,',
    '        sanitizeResult,',
    '        duplicatesPurged: sanitizeResult.duplicatesPurged || 0,',
    '        purgedCount: sanitizeResult.nonBeautyPurgedCount || 0,',
    '        excessPrunedCount: 0,',
    '        activeTotal,',
    '        syncTelemetry: cjCatalogSyncTelemetry',
    '      });',
    '    }',
    '',
    '    if (isCjSyncRunning) {',
    '      return res.status(202).json({',
    "        status: 'already_running',",
    '        started: false,',
    '        isSyncRunning: true,',
    "        message: '⏳ An uncapped CJ Skincare & Beauty crawl is already running in the background. Live progress updates automatically.',",
    '        syncTelemetry: cjCatalogSyncTelemetry',
    '      });',
    '    }',
    '',
    '    // Start uncapped multi-page crawl asynchronously to prevent HTTP proxy timeouts',
    '    setImmediate(() => {',
    '      syncCJCatalog({ fullCatalog: true, sanitizeAfter: true, maxPages, maxProducts }).catch((err) => {',
    "        console.error('❌ Background sync-and-sanitize error:', err?.message || err);",
    '      });',
    '    });',
    '',
    '    return res.status(202).json({',
    "      status: 'started',",
    '      started: true,',
    '      isSyncRunning: true,',
    "      message: '🚀 Uncapped CJ Skincare & Beauty crawl started in the background! Watching live progress every 5 seconds ✧',",
    '      syncTelemetry: {',
    '        ...cjCatalogSyncTelemetry,',
    "        lastSyncStatus: 'RUNNING',",
    "        syncPhase: 'PRE_SANITIZING',",
    '        isSyncRunning: true',
    '      }',
    '    });',
    '  } catch (error) {',
    "    console.error('Sync and Sanitize Error:', error);",
    "    res.status(500).json({ error: error.message || 'Failed to sync and sanitize beauty catalog.' });",
    '  }',
    '});',
    '',
    '// POST /api/admin/products/sync-stop — Gracefully stops an active background CJ crawl after the current page',
    "app.post('/api/admin/products/sync-stop', authenticateToken, requireAdmin, async (req, res) => {",
    '  try {',
    '    if (!isCjSyncRunning) {',
    '      return res.status(200).json({',
    "        status: 'idle',",
    '        isSyncRunning: false,',
    "        message: 'No CJ crawl is currently running.',",
    '        syncTelemetry: cjCatalogSyncTelemetry',
    '      });',
    '    }',
    '',
    '    cjSyncCancelRequested = true;',
    '    await saveCatalogTelemetrySafe({ cancelRequested: true });',
    '    console.log("⏹️ Admin requested graceful stop for active CJ Skincare & Beauty crawl.");',
    '',
    '    return res.status(200).json({',
    "      status: 'stopping',",
    '      isSyncRunning: true,',
    '      cancelRequested: true,',
    "      message: '⏹️ Stop requested — finishing the current CJ page and saving all synced products cleanly...',",
    '      syncTelemetry: cjCatalogSyncTelemetry',
    '    });',
    '  } catch (error) {',
    "    res.status(500).json({ error: error.message || 'Failed to stop CJ sync.' });",
    '  }',
    '});',
    '',
    '// POST /api/admin/products/deduplicate & POST /api/admin/products/strict-skincare-purge — Uncapped strict purge & deduplication',
    "app.post(['/api/admin/products/deduplicate', '/api/admin/products/strict-skincare-purge'], authenticateToken, requireAdmin, async (req, res) => {",
    '  try {',
    '    const sanitizeResult = await sanitizeAndDeduplicateCatalog();',
    '    const activeTotal = sanitizeResult.activeCatalogTotal || (await Product.countDocuments());',
    '    res.status(200).json({',
    '      message: `🧹 Strict Skincare & Beauty Purge Complete (Uncapped)! Removed ${sanitizeResult.nonBeautyPurgedCount || 0} perfume/non-skincare items and ${sanitizeResult.duplicatesPurged || 0} duplicates (${activeTotal} unique Skincare & Beauty products active) ✧`,',
    '      ...sanitizeResult,',
    '      activeTotal,',
    '      syncTelemetry: cjCatalogSyncTelemetry',
    '    });',
    '  } catch (error) {',
    "    console.error('Deduplicate Catalog Error:', error);",
    "    res.status(500).json({ error: error.message || 'Failed to deduplicate catalog.' });",
    '  }',
    '});',
    '',
    '// GET /api/admin/products/sync-status — Returns live background crawl progress & persisted telemetry',
    "app.get('/api/admin/products/sync-status', authenticateToken, requireAdmin, async (req, res) => {",
    '  try {',
    "    if (!cjCatalogSyncTelemetry.lastSyncAt && !cjCatalogSyncTelemetry.lastSanitizedAt && typeof loadCatalogSyncTelemetry === 'function') {",
    '      await loadCatalogSyncTelemetry();',
    '    }',
    '    const activeTotal = await Product.countDocuments();',
    '    cjCatalogSyncTelemetry.activeCatalogTotal = activeTotal;',
    '    res.status(200).json({',
    '      ...cjCatalogSyncTelemetry,',
    '      isSyncRunning: isCjSyncRunning,',
    '      isSanitizeRunning: isCatalogSanitizeRunning,',
    '      cancelRequested: cjSyncCancelRequested',
    '    });',
    '  } catch (error) {',
    "    res.status(500).json({ error: 'Failed to read catalog sync status.' });",
    '  }',
    '});',
    ''
  ].join('\n');

  if (text.includes("app.post('/api/admin/products/sync-stop'")) {
    console.log('  ✓ [A.5] Async 202 sync routes & /sync-stop endpoint already present (skipped)');
  } else if (rStartIdx !== -1 && rEndIdx > rStartIdx) {
    text = text.slice(0, rStartIdx) + asyncRoutesBlock + '\n' + text.slice(rEndIdx);
    changesApplied++;
    console.log('  ✅ [A.5] Converted Admin CJ sync routes to non-blocking 202 background jobs & added /sync-stop');
  } else {
    throw new Error('[A.5] Could not locate ADMIN CJ SYNC & CLEANUP ROUTE section.');
  }

  if (changesApplied > 0) {
    const backupPath = writeWithOriginalEol(serverPath, text, eol);
    console.log(`  💾 Saved ${serverPath} (${changesApplied} change(s) applied). Backup: ${path.basename(backupPath)}`);
  } else {
    console.log(`  ℹ️ No changes needed for ${serverPath}.`);
  }
};

// ---------------- PART B: APP.JS PATCHER ---------------- //

const patchAppPhase2 = (appPath) => {
  console.log(`\n🔧 Applying CJ Phase 2 (Part B — AdminInventory Live Polling & Uncapped UI) to: ${appPath}`);
  let { text, eol } = readNormalized(appPath);
  let changesApplied = 0;

  // ---- B.1: Extend syncStatusTelemetry state & add isStoppingSync state ---- //
  const teleStateRegex = /  const \[syncStatusTelemetry, setSyncStatusTelemetry\] = useState\(\{[\s\S]*?\}\);/;
  const teleStateNew = [
    '  const [isStoppingSync, setIsStoppingSync] = useState(false);',
    '  const [syncStatusTelemetry, setSyncStatusTelemetry] = useState({',
    '    lastSyncAt: null,',
    "    lastSyncStatus: 'IDLE',",
    "    syncPhase: 'IDLE',",
    "    currentSourceLabel: '',",
    '    pagesFetched: 0,',
    '    itemsProcessed: 0,',
    '    startedAt: null,',
    '    cancelRequested: false,',
    '    isSyncRunning: false,',
    '    isSanitizeRunning: false,',
    '    lastSanitizedAt: null,',
    '    lastDuplicatesPurgedCount: 0,',
    '    lastNonBeautyPurgedCount: 0,',
    '    lastExcessCapPrunedCount: 0,',
    '    lastStalePrunedCount: 0,',
    '    maxCatalogCap: 0,',
    '    activeCatalogTotal: 0,',
    "    nextScheduledSync: 'Daily at 3:00 AM CST (America/Chicago)'",
    '  });'
  ].join('\n');

  if (text.includes('const [isStoppingSync, setIsStoppingSync] = useState(false);')) {
    console.log('  ✓ [B.1] AdminInventory live progress state already present (skipped)');
  } else if (teleStateRegex.test(text)) {
    text = text.replace(teleStateRegex, teleStateNew);
    changesApplied++;
    console.log('  ✅ [B.1] Extended syncStatusTelemetry state with live progress & stop state');
  } else {
    throw new Error('[B.1] Could not find syncStatusTelemetry useState block in AdminInventory.');
  }

  // ---- B.2: Upgrade fetchCatalogSyncStatus, handleFullSyncAndSanitize, add handleStopCjSync & 5s polling ---- //
  const handlersStartAnchor = '  const fetchCatalogSyncStatus = async () => {';
  const handlersEndAnchor = '  const toggleSelectionInArray = (arr = [], item) => {';

  const hStartIdx = text.indexOf(handlersStartAnchor);
  const hEndIdx = text.indexOf(handlersEndAnchor);

  const handlersNew = [
    '  const fetchCatalogSyncStatus = async () => {',
    '    try {',
    "      const token = localStorage.getItem('token');",
    '      const res = await fetch(`${API_BASE_URL}/api/admin/products/sync-status`, {',
    "        headers: { 'Authorization': `Bearer ${token}` }",
    '      });',
    '      if (res.ok) {',
    '        const data = await res.json();',
    '        setSyncStatusTelemetry(prev => ({ ...prev, ...data }));',
    '        if (data.isSyncRunning) {',
    '          setIsSyncingAndSanitizing(true);',
    '        }',
    '        return data;',
    '      }',
    '    } catch (err) {',
    "      console.error('Failed to fetch catalog sync status:', err);",
    '    }',
    '    return null;',
    '  };',
    '',
    '  const handleStopCjSync = async () => {',
    "    const token = localStorage.getItem('token');",
    '    setIsStoppingSync(true);',
    '    try {',
    '      const res = await fetch(`${API_BASE_URL}/api/admin/products/sync-stop`, {',
    "        method: 'POST',",
    '        headers: {',
    "          'Content-Type': 'application/json',",
    "          'Authorization': `Bearer ${token}`",
    '        }',
    '      });',
    '      const data = await res.json().catch(() => ({}));',
    '      if (data.syncTelemetry) {',
    '        setSyncStatusTelemetry(prev => ({ ...prev, ...data.syncTelemetry, cancelRequested: true }));',
    '      }',
    '      setOpsBanner({',
    "        type: res.ok ? 'success' : 'error',",
    "        text: data.message || data.error || 'Stop requested for active CJ sync.'",
    '      });',
    '    } catch (err) {',
    "      setOpsBanner({ type: 'error', text: 'Network error while requesting CJ sync stop.' });",
    '    }',
    '    setIsStoppingSync(false);',
    '  };',
    '',
    '  const handleFullSyncAndSanitize = async (sanitizeOnly = false) => {',
    "    const token = localStorage.getItem('token');",
    '    if (sanitizeOnly) setIsSanitizingOnly(true);',
    '    else setIsSyncingAndSanitizing(true);',
    "    setOpsBanner({ type: '', text: '' });",
    '',
    '    try {',
    '      const res = await fetch(`${API_BASE_URL}/api/admin/products/sync-and-sanitize`, {',
    "        method: 'POST',",
    '        headers: {',
    "          'Content-Type': 'application/json',",
    "          'Authorization': `Bearer ${token}`",
    '        },',
    '        body: JSON.stringify({',
    '          sanitizeOnly: Boolean(sanitizeOnly)',
    '        })',
    '      });',
    '      const data = await res.json().catch(() => ({}));',
    '      if (res.status === 202 || data.status === \'started\' || data.status === \'already_running\') {',
    '        setSyncStatusTelemetry(prev => ({',
    '          ...prev,',
    '          ...(data.syncTelemetry || {}),',
    '          isSyncRunning: true,',
    "          lastSyncStatus: 'RUNNING'",
    '        }));',
    '        setOpsBanner({',
    "          type: 'success',",
    "          text: data.message || '🚀 Uncapped CJ Skincare & Beauty crawl started in the background! Watching live progress...'",
    '        });',
    '        return;',
    '      }',
    '      if (res.ok) {',
    '        if (Array.isArray(data.products)) {',
    '          setInventory(data.products);',
    '          if (onCatalogUpdated) onCatalogUpdated(data.products);',
    '        } else {',
    '          await fetchInventory();',
    '        }',
    '        if (data.syncTelemetry) {',
    '          setSyncStatusTelemetry(prev => ({ ...prev, ...data.syncTelemetry }));',
    '        } else {',
    '          await fetchCatalogSyncStatus();',
    '        }',
    '        setOpsBanner({',
    "          type: 'success',",
    '          text:',
    '            data.message ||',
    '            (sanitizeOnly',
    "              ? '🧹 MongoDB catalog sanitized and deduplicated (uncapped)! ✧'",
    "              : '✨ Uncapped CJ Skincare & Beauty sync complete! ✧')",
    '        });',
    '      } else {',
    '        setOpsBanner({',
    "          type: 'error',",
    "          text: data.error || 'Failed to sync and sanitize beauty catalog.'",
    '        });',
    '        setIsSyncingAndSanitizing(false);',
    '      }',
    '    } catch (err) {',
    "      console.error('Full sync & sanitize error:', err);",
    '      setOpsBanner({',
    "        type: 'error',",
    "        text: 'Network error while running Uncapped Skincare Sync & Sanitization.'",
    '      });',
    '      setIsSyncingAndSanitizing(false);',
    '    }',
    '    if (sanitizeOnly) setIsSanitizingOnly(false);',
    '  };',
    '',
    '  useEffect(() => {',
    '    fetchInventory();',
    '    fetchCatalogSyncStatus();',
    '    // eslint-disable-next-line',
    '  }, []);',
    '',
    '  // Poll /api/admin/products/sync-status every 5s while an uncapped background CJ crawl is running',
    '  useEffect(() => {',
    '    if (!isSyncingAndSanitizing && !syncStatusTelemetry.isSyncRunning) return undefined;',
    '    const pollTimer = setInterval(async () => {',
    '      const live = await fetchCatalogSyncStatus();',
    '      if (live && !live.isSyncRunning) {',
    '        setIsSyncingAndSanitizing(false);',
    '        setIsStoppingSync(false);',
    '        await fetchInventory();',
    "        const finalState = String(live.lastSyncStatus || 'COMPLETED');",
    '        setOpsBanner({',
    "          type: finalState === 'ERROR' ? 'error' : 'success',",
    '          text:',
    "            finalState === 'ERROR'",
    "              ? `⚠️ CJ sync ended with error: ${live.lastError || 'Check Render logs.'}`",
    "              : finalState === 'STOPPED'",
    '              ? `⏹️ CJ sync stopped cleanly after ${live.pagesFetched || 0} page(s). ${live.activeCatalogTotal || 0} Skincare & Beauty products active.`',
    '              : `✨ Uncapped CJ Skincare & Beauty crawl complete! ${live.pagesFetched || 0} page(s) crawled, ${live.activeCatalogTotal || 0} unique Skincare & Beauty products active ✧`',
    '        });',
    '      }',
    '    }, 5000);',
    '    return () => clearInterval(pollTimer);',
    '    // eslint-disable-next-line',
    '  }, [isSyncingAndSanitizing, syncStatusTelemetry.isSyncRunning]);',
    ''
  ].join('\n');

  if (text.includes('const handleStopCjSync = async () => {')) {
    console.log('  ✓ [B.2] AdminInventory async handlers & 5s polling already present (skipped)');
  } else if (hStartIdx !== -1 && hEndIdx > hStartIdx) {
    text = text.slice(0, hStartIdx) + handlersNew + '\n' + text.slice(hEndIdx);
    changesApplied++;
    console.log('  ✅ [B.2] Added 202 Accepted handling, handleStopCjSync, and 5-second live progress polling');
  } else {
    throw new Error('[B.2] Could not locate fetchCatalogSyncStatus -> toggleSelectionInArray section in AdminInventory.');
  }

  // ---- B.3: Upgrade AdminInventory Command Bar to Uncapped + Live Progress + Stop Button ---- //
  const barStartCandidates = [
    '      {/* Curated Skincare & Beauty Catalog Sync, Cap & Telemetry Command Bar */}',
    '      {/* Strict Uncapped Skincare & Beauty Catalog Sync & Perfume Purge Command Bar */}'
  ];
  let barStartIdx = -1;
  for (const cand of barStartCandidates) {
    const idx = text.indexOf(cand);
    if (idx !== -1) {
      barStartIdx = idx;
      break;
    }
  }
  const barEndAnchor = '      {/* Global CJ Shipping & Custom Label Control Bar */}';
  const barEndIdx = text.indexOf(barEndAnchor);

  const barPhase2New = [
    '      {/* Uncapped CJ Skincare & Beauty Background Crawler & Live Progress Command Bar */}',
    "      <div style={{ backgroundColor: '#FFFFFF', padding: '22px 26px', borderRadius: '20px', border: '2px solid #B38B8F', boxShadow: '0 8px 25px rgba(179, 139, 143, 0.18)', display: 'flex', flexDirection: 'column', gap: '14px' }}>",
    "        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px' }}>",
    '          <div>',
    "            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>",
    "              <h2 style={{ fontFamily: \"'Cormorant Garamond', serif\", fontSize: '1.95rem', color: '#5C5454', margin: 0 }}>",
    '                ✨ Uncapped CJ Skincare & Beauty Catalog Crawler',
    '              </h2>',
    "              <span style={{ backgroundColor: '#F6FBF7', color: '#2E7D32', border: '1px solid #A5D6A7', padding: '4px 12px', borderRadius: '14px', fontSize: '0.78rem', fontWeight: 'bold', fontFamily: 'sans-serif' }}>",
    '                ∞ Uncapped — All CJ Skincare & Beauty • 🚫 Non-Beauty Blocked',
    '              </span>',
    '            </div>',
    "            <p style={{ margin: '5px 0 0 0', fontSize: '0.88rem', color: '#8A797A', fontFamily: 'sans-serif', lineHeight: '1.45' }}>",
    '              Crawls <strong>every page</strong> of every CJ <strong>Skincare & Facial/Cosmetic Beauty</strong> category and keyword in the background (no 300/500 cap, zero HTTP timeouts), blocks perfume, hair, nail, and oral care, and auto-syncs daily at 3:00 AM CST.',
    '            </p>',
    '          </div>',
    '',
    "          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>",
    '            <button',
    '              type="button"',
    '              disabled={isSyncingAndSanitizing || syncStatusTelemetry.isSyncRunning || isSanitizingOnly}',
    '              onClick={() => handleFullSyncAndSanitize(false)}',
    "              style={{ backgroundColor: '#F2D4D7', border: '1px solid #B38B8F', color: '#5C5454', padding: '10px 18px', borderRadius: '22px', fontFamily: \"'Cormorant Garamond', serif\", fontSize: '1.08rem', fontWeight: 'bold', cursor: (isSyncingAndSanitizing || syncStatusTelemetry.isSyncRunning || isSanitizingOnly) ? 'not-allowed' : 'pointer', boxShadow: '0 4px 12px rgba(179, 139, 143, 0.25)' }}",
    '            >',
    "              {(isSyncingAndSanitizing || syncStatusTelemetry.isSyncRunning) ? '⏳ Crawling All CJ Skincare...' : '✨ Sync All CJ Skincare & Beauty'}",
    '            </button>',
    '            {(isSyncingAndSanitizing || syncStatusTelemetry.isSyncRunning) && (',
    '              <button',
    '                type="button"',
    '                disabled={isStoppingSync || syncStatusTelemetry.cancelRequested}',
    '                onClick={handleStopCjSync}',
    "                style={{ backgroundColor: '#FFF5F5', border: '1px solid #C62828', color: '#C62828', padding: '10px 16px', borderRadius: '22px', fontFamily: \"'Cormorant Garamond', serif\", fontSize: '1.02rem', fontWeight: 'bold', cursor: (isStoppingSync || syncStatusTelemetry.cancelRequested) ? 'not-allowed' : 'pointer' }}",
    '              >',
    "                {syncStatusTelemetry.cancelRequested ? '⏳ Stopping After Current Page...' : '⏹️ Stop Sync'}",
    '              </button>',
    '            )}',
    '            <button',
    '              type="button"',
    '              disabled={isSyncingAndSanitizing || syncStatusTelemetry.isSyncRunning || isSanitizingOnly}',
    '              onClick={() => handleFullSyncAndSanitize(true)}',
    "              style={{ backgroundColor: '#FFF0F2', border: '1px solid #B38B8F', color: '#5C5454', padding: '10px 16px', borderRadius: '22px', fontFamily: \"'Cormorant Garamond', serif\", fontSize: '1.02rem', fontWeight: 'bold', cursor: (isSyncingAndSanitizing || syncStatusTelemetry.isSyncRunning || isSanitizingOnly) ? 'not-allowed' : 'pointer' }}",
    '            >',
    "              {isSanitizingOnly ? '⏳ Purging Non-Skincare & Duplicates...' : '🧹 Purge Non-Skincare & Deduplicate'}",
    '            </button>',
    '          </div>',
    '        </div>',
    '',
    '        {/* Live Background Crawl Progress Banner */}',
    '        {(isSyncingAndSanitizing || syncStatusTelemetry.isSyncRunning) && (',
    "          <div style={{ backgroundColor: '#FFF0F2', border: '1px solid #B38B8F', borderRadius: '12px', padding: '12px 16px', fontFamily: 'sans-serif', fontSize: '0.84rem', color: '#5C5454', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>",
    '            <div>',
    "              <strong style={{ color: '#8E6268' }}>🔄 Live Background Crawl ({syncStatusTelemetry.syncPhase || 'RUNNING'})</strong>",
    "              {syncStatusTelemetry.currentSourceLabel ? ` — ${syncStatusTelemetry.currentSourceLabel}` : ' — Connecting to CJ Dropshipping...'}",
    '            </div>',
    "            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', fontWeight: 'bold' }}>",
    '              <span>📄 Pages: {syncStatusTelemetry.pagesFetched || 0}</span>',
    '              <span>✅ Processed: {syncStatusTelemetry.itemsProcessed || 0}</span>',
    '              <span>🆕 New: {syncStatusTelemetry.lastNewAddedCount || 0}</span>',
    '              <span>📦 DB Active: {syncStatusTelemetry.activeCatalogTotal || inventory.length}</span>',
    '            </div>',
    '          </div>',
    '        )}',
    '',
    '        {/* Live Persisted Telemetry Status Bar */}',
    "        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', backgroundColor: '#FFF9F9', padding: '10px 14px', borderRadius: '12px', border: '1px solid #E8C5C8', fontFamily: 'sans-serif', fontSize: '0.8rem', color: '#5C5454' }}>",
    "          <span style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8C5C8', borderRadius: '10px', padding: '4px 10px', fontWeight: 'bold' }}>",
    "            📦 Active Skincare & Beauty: <strong style={{ color: '#B38B8F' }}>{syncStatusTelemetry.activeCatalogTotal || inventory.length} (Uncapped)</strong>",
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
    "            📄 Last Pages Crawled: <strong style={{ color: '#5C5454' }}>{syncStatusTelemetry.pagesFetched || 0}</strong>",
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

  if (text.includes('{/* Uncapped CJ Skincare & Beauty Background Crawler & Live Progress Command Bar */}')) {
    console.log('  ✓ [B.3] AdminInventory uncapped live-progress command bar already present (skipped)');
  } else if (barStartIdx !== -1 && barEndIdx > barStartIdx) {
    text = text.slice(0, barStartIdx) + barPhase2New + '\n' + text.slice(barEndIdx);
    changesApplied++;
    console.log('  ✅ [B.3] Upgraded AdminInventory command bar with Uncapped badge, Live Progress banner & Stop button');
  } else {
    throw new Error('[B.3] Could not locate AdminInventory command bar anchors.');
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
    throw new Error('Could not locate server.js. Pass it explicitly: node apply_cj_phase2_async_progress.js path/to/server.js path/to/App.js');
  }
  if (!appPath) {
    throw new Error('Could not locate App.js. Pass it explicitly: node apply_cj_phase2_async_progress.js path/to/server.js path/to/App.js');
  }

  patchServerPhase2(serverPath);
  patchAppPhase2(appPath);

  console.log('\n✨ Phase 2 (Non-Blocking Background CJ Sync & Live Progress Polling) applied successfully!');
  console.log('Next steps:');
  console.log(`  1. Syntax-check backend:  node --check "${serverPath}"`);
  console.log('  2. Build React frontend:  cd client && npm run build');
  console.log('  3. Ready for Phase 3 (strict Skincare/Beauty purity audit & memory-safe .cursor() backfills)!');
} catch (err) {
  console.error('\n❌ Phase 2 patch failed:', err.message);
  process.exit(1);
}
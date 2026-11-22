#!/usr/bin/env node
/**
 * apply_step4_patch.js
 *
 * Safely and idempotently applies all Step 4 frontend performance, memoization,
 * true loading state, 24-item "Load More" pagination, and AdminInventory
 * `?includeAdminFields=true` upgrades to `App.js`.
 *
 * Safeguards built in:
 *  - Auto-detects client/src/App.js, src/App.js, App.js, or App_2.js
 *    (or accepts an explicit CLI path: `node apply_step4_patch.js path/to/App.js`)
 *  - Scopes ProductCard and AdminInventory edits cleanly so other components
 *    (like ProductDetailModal and the public storefront fetch) stay untouched
 *  - Wraps the paginated grid + Load More button in a React Fragment (`<>...</>`)
 *    so the ternary branch in BoutiqueSmartFilterSection compiles cleanly
 *  - Updates both Public Boutique and Member Sanctuary Boutique instances of
 *    `<BoutiqueSmartFilterSection />`
 *  - Preserves original line endings (CRLF or LF) and creates a timestamped `.bak` backup
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
  const backupPath = `${filePath}.step4_${Date.now()}.bak`;
  fs.copyFileSync(filePath, backupPath);
  const output = eol === '\r\n' ? normalizedText.replace(/\n/g, '\r\n') : normalizedText;
  fs.writeFileSync(filePath, output, 'utf8');
  return backupPath;
};

// ---------------- STEP 4 APP.JS PATCHER ---------------- //

const patchAppStep4 = (appPath) => {
  console.log(`\n🔧 Applying Step 4 patch to: ${appPath}`);
  let { text, eol } = readNormalized(appPath);
  let changesApplied = 0;

  // ---- BLOCK 1: Import useMemo ---- //
  const importOld = "import React, { useState, useEffect } from 'react';";
  const importNew = "import React, { useState, useEffect, useMemo } from 'react';";

  if (text.includes(importNew)) {
    console.log('  ✓ [Block 1] useMemo already imported (skipped)');
  } else if (text.includes(importOld)) {
    text = text.replace(importOld, importNew);
    changesApplied++;
    console.log('  ✅ [Block 1] Added useMemo to React import');
  } else {
    throw new Error("[Block 1] Could not find `import React, { useState, useEffect } from 'react';` anchor.");
  }

  // ---- BLOCK 2: Avoid Double Blueprint Scoring in ProductCard ---- //
  const pcStartAnchor = 'const ProductCard = ({ product, onAddToCart, onCardClick, userBlueprint, hasCompletedQuiz';
  const pcEndAnchor = 'const ElegantInput = ({';

  const pcStartIdx = text.indexOf(pcStartAnchor);
  const pcEndIdx = text.indexOf(pcEndAnchor);

  if (pcStartIdx === -1 || pcEndIdx <= pcStartIdx) {
    throw new Error('[Block 2] Could not locate ProductCard -> ElegantInput section.');
  }

  let pcSection = text.slice(pcStartIdx, pcEndIdx);
  let pcChanged = false;

  const pcSigOld = 'const ProductCard = ({ product, onAddToCart, onCardClick, userBlueprint, hasCompletedQuiz }) => {';
  const pcSigNew = 'const ProductCard = ({ product, onAddToCart, onCardClick, userBlueprint, hasCompletedQuiz, precomputedMatch = null }) => {';

  if (pcSection.includes(pcSigNew)) {
    console.log('  ✓ [Block 2a] ProductCard precomputedMatch prop already present (skipped)');
  } else if (pcSection.includes(pcSigOld)) {
    pcSection = pcSection.replace(pcSigOld, pcSigNew);
    pcChanged = true;
    console.log('  ✅ [Block 2a] Added precomputedMatch prop to ProductCard');
  } else {
    throw new Error('[Block 2a] Could not find ProductCard signature.');
  }

  const pcMatchOld = '  const bpMatch = evaluateBlueprintMatch(product, userBlueprint, hasCompletedQuiz);';
  const pcMatchNew = [
    '  const bpMatch = useMemo(',
    '    () => precomputedMatch || evaluateBlueprintMatch(product, userBlueprint, hasCompletedQuiz),',
    '    [precomputedMatch, product, userBlueprint, hasCompletedQuiz]',
    '  );'
  ].join('\n');

  if (pcSection.includes('precomputedMatch || evaluateBlueprintMatch(product, userBlueprint, hasCompletedQuiz)')) {
    console.log('  ✓ [Block 2b] ProductCard bpMatch already memoized (skipped)');
  } else if (pcSection.includes(pcMatchOld)) {
    pcSection = pcSection.replace(pcMatchOld, pcMatchNew);
    pcChanged = true;
    console.log('  ✅ [Block 2b] Memoized bpMatch inside ProductCard');
  } else {
    throw new Error('[Block 2b] Could not find `const bpMatch = evaluateBlueprintMatch(...)` inside ProductCard.');
  }

  if (pcChanged) {
    text = text.slice(0, pcStartIdx) + pcSection + text.slice(pcEndIdx);
    changesApplied++;
  }

  // ---- BLOCK 3: BoutiqueSmartFilterSection Loading, Memoization & 24-Item Load More ---- //
  const bsfStartAnchor = 'const BoutiqueSmartFilterSection = ({';
  const bsfEndAnchor = 'const MembershipUpgradeModal = ({';

  const bsfStartIdx = text.indexOf(bsfStartAnchor);
  const bsfEndIdx = text.indexOf(bsfEndAnchor);

  if (bsfStartIdx === -1 || bsfEndIdx <= bsfStartIdx) {
    throw new Error('[Block 3] Could not locate BoutiqueSmartFilterSection -> MembershipUpgradeModal section.');
  }

  let bsfSection = text.slice(bsfStartIdx, bsfEndIdx);
  let bsfChanged = false;

  // 3A: Add isLoadingProducts prop
  const bsfPropsOld = [
    'const BoutiqueSmartFilterSection = ({',
    '  products = [],',
    '  quizAnswers = {},'
  ].join('\n');

  const bsfPropsNew = [
    'const BoutiqueSmartFilterSection = ({',
    '  products = [],',
    '  isLoadingProducts = false,',
    '  quizAnswers = {},'
  ].join('\n');

  if (bsfSection.includes('isLoadingProducts = false,')) {
    console.log('  ✓ [Block 3A] isLoadingProducts prop already present in BoutiqueSmartFilterSection (skipped)');
  } else if (bsfSection.includes(bsfPropsOld)) {
    bsfSection = bsfSection.replace(bsfPropsOld, bsfPropsNew);
    bsfChanged = true;
    console.log('  ✅ [Block 3A] Added isLoadingProducts prop to BoutiqueSmartFilterSection');
  } else {
    throw new Error('[Block 3A] Could not find BoutiqueSmartFilterSection props anchor.');
  }

  // 3B: Memoize decoratedProducts and add visibleCount pagination state
  const decoratedRegex = /  const decoratedProducts = products\.map\(prod => \(\{\s*product: prod,\s*match: evaluateBlueprintMatch\(prod, quizAnswers, hasCompletedQuiz\)\s*\}\)\);/;
  const decoratedNew = [
    '  const BOUTIQUE_PAGE_SIZE = 24;',
    '  const [visibleCount, setVisibleCount] = useState(BOUTIQUE_PAGE_SIZE);',
    '',
    '  useEffect(() => {',
    '    setVisibleCount(BOUTIQUE_PAGE_SIZE);',
    '  }, [boutiqueFilters]);',
    '',
    '  const decoratedProducts = useMemo(',
    '    () => products.map(prod => ({ product: prod, match: evaluateBlueprintMatch(prod, quizAnswers, hasCompletedQuiz) })),',
    '    [products, quizAnswers, hasCompletedQuiz]',
    '  );'
  ].join('\n');

  if (bsfSection.includes('const BOUTIQUE_PAGE_SIZE = 24;') && bsfSection.includes('const decoratedProducts = useMemo(')) {
    console.log('  ✓ [Block 3B] decoratedProducts memoization & visibleCount already present (skipped)');
  } else if (decoratedRegex.test(bsfSection)) {
    bsfSection = bsfSection.replace(decoratedRegex, decoratedNew);
    bsfChanged = true;
    console.log('  ✅ [Block 3B] Added BOUTIQUE_PAGE_SIZE, visibleCount reset, and useMemo(decoratedProducts)');
  } else {
    throw new Error('[Block 3B] Could not find `decoratedProducts = products.map(...)` inside BoutiqueSmartFilterSection.');
  }

  // 3C: Replace "Fetching live boutique inventory..." with true loading/empty copy
  const loadingTextOld = 'Fetching live boutique inventory...';
  const loadingTextNew = [
    '{isLoadingProducts',
    '            ? "Loading Susan\'s curated boutique..."',
    '            : "Our curated skincare boutique is being refreshed. Please check back in a moment."}'
  ].join('\n');

  if (bsfSection.includes("Loading Susan's curated boutique...")) {
    console.log('  ✓ [Block 3C] True loading/empty boutique text already present (skipped)');
  } else if (bsfSection.includes(loadingTextOld)) {
    bsfSection = bsfSection.replace(loadingTextOld, loadingTextNew);
    bsfChanged = true;
    console.log('  ✅ [Block 3C] Replaced "Fetching live boutique inventory..." with isLoadingProducts copy');
  } else {
    throw new Error('[Block 3C] Could not find "Fetching live boutique inventory..." inside BoutiqueSmartFilterSection.');
  }

  // 3D: Slice grid to visibleCount, pass precomputedMatch={match}, and add rose-gold "Load More" button
  const gridOld = [
    "        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '20px' }}>",
    '          {filteredList.map(({ product }) => (',
    '            <ProductCard',
    '              key={product._id || product.title}',
    '              product={product}',
    '              onAddToCart={onAddToCart}',
    '              onCardClick={onCardClick}',
    '              userBlueprint={quizAnswers}',
    '              hasCompletedQuiz={hasCompletedQuiz}',
    '            />',
    '          ))}',
    '        </div>'
  ].join('\n');

  const gridNew = [
    '        <>',
    "          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '20px' }}>",
    '            {filteredList.slice(0, visibleCount).map(({ product, match }) => (',
    '              <ProductCard',
    '                key={product._id || product.title}',
    '                product={product}',
    '                onAddToCart={onAddToCart}',
    '                onCardClick={onCardClick}',
    '                userBlueprint={quizAnswers}',
    '                hasCompletedQuiz={hasCompletedQuiz}',
    '                precomputedMatch={match}',
    '              />',
    '            ))}',
    '          </div>',
    '',
    '          {filteredList.length > visibleCount && (',
    "            <div style={{ textAlign: 'center', marginTop: '32px' }}>",
    "              <p style={{ fontSize: '0.88rem', color: '#7A6365', marginBottom: '12px' }}>",
    '                Showing {Math.min(visibleCount, filteredList.length)} of {filteredList.length} curated products',
    '              </p>',
    '              <button',
    '                type="button"',
    '                onClick={() => setVisibleCount(prev => prev + BOUTIQUE_PAGE_SIZE)}',
    '                style={{',
    "                  backgroundColor: '#FFF9F9',",
    "                  color: '#8E6268',",
    "                  border: '1px solid #B38B8F',",
    "                  borderRadius: '999px',",
    "                  padding: '12px 28px',",
    "                  fontFamily: \"'Cormorant Garamond', Georgia, serif\",",
    "                  fontSize: '1.05rem',",
    '                  fontWeight: 600,',
    "                  letterSpacing: '0.04em',",
    "                  cursor: 'pointer'",
    '                }}',
    '              >',
    '                Load More Products ({filteredList.length - visibleCount} remaining)',
    '              </button>',
    '            </div>',
    '          )}',
    '        </>'
  ].join('\n');

  if (bsfSection.includes('filteredList.slice(0, visibleCount).map(') && bsfSection.includes('Load More Products (')) {
    console.log('  ✓ [Block 3D] 24-item pagination & Load More button already present (skipped)');
  } else if (bsfSection.includes(gridOld)) {
    bsfSection = bsfSection.replace(gridOld, gridNew);
    bsfChanged = true;
    console.log('  ✅ [Block 3D] Sliced grid to visibleCount, passed precomputedMatch, and added Load More button');
  } else {
    throw new Error('[Block 3D] Could not find product grid `filteredList.map(...)` block inside BoutiqueSmartFilterSection.');
  }

  if (bsfChanged) {
    text = text.slice(0, bsfStartIdx) + bsfSection + text.slice(bsfEndIdx);
    changesApplied++;
  }

  // ---- BLOCK 4: Track isLoadingProducts in App() ---- //
  // 4A: Add loading state
  const stateOld = '  const [backendProducts, setBackendProducts] = useState([]);';
  const stateNew = [
    '  const [backendProducts, setBackendProducts] = useState([]);',
    '  const [isLoadingProducts, setIsLoadingProducts] = useState(true);'
  ].join('\n');

  if (text.includes('const [isLoadingProducts, setIsLoadingProducts] = useState(true);')) {
    console.log('  ✓ [Block 4A] isLoadingProducts state already present in App() (skipped)');
  } else if (text.includes(stateOld)) {
    text = text.replace(stateOld, stateNew);
    changesApplied++;
    console.log('  ✅ [Block 4A] Added isLoadingProducts state in App()');
  } else {
    throw new Error('[Block 4A] Could not find `const [backendProducts, setBackendProducts] = useState([]);` in App().');
  }

  // 4B: Set and clear loading state in // General Boot Sequence
  const bootOld = [
    '  // General Boot Sequence',
    '  useEffect(() => {',
    '    const fetchBackendData = async () => {',
    '      try {',
    '        const response = await fetch(`${API_BASE_URL}/api/products`);',
    '        if (response.ok) {',
    '          const data = await response.json();',
    '          setBackendProducts(data);',
    '        }',
    '      } catch (error) {',
    "        console.error('Failed to connect to backend data:', error);",
    '      }',
    '    };',
    '    fetchBackendData();',
    '  }, []);'
  ].join('\n');

  const bootNew = [
    '  // General Boot Sequence',
    '  useEffect(() => {',
    '    const fetchBackendData = async () => {',
    '      setIsLoadingProducts(true);',
    '      try {',
    '        const response = await fetch(`${API_BASE_URL}/api/products`);',
    '        if (response.ok) {',
    '          const data = await response.json();',
    '          setBackendProducts(data);',
    '        }',
    '      } catch (error) {',
    "        console.error('Failed to connect to backend data:', error);",
    '      } finally {',
    '        setIsLoadingProducts(false);',
    '      }',
    '    };',
    '    fetchBackendData();',
    '  }, []);'
  ].join('\n');

  if (text.includes('setIsLoadingProducts(true);') && text.includes('setIsLoadingProducts(false);')) {
    console.log('  ✓ [Block 4B] General Boot Sequence already manages isLoadingProducts (skipped)');
  } else if (text.includes(bootOld)) {
    text = text.replace(bootOld, bootNew);
    changesApplied++;
    console.log('  ✅ [Block 4B] Updated General Boot Sequence with try/finally isLoadingProducts state');
  } else {
    throw new Error('[Block 4B] Could not find General Boot Sequence `fetchBackendData` block.');
  }

  // 4C: Pass isLoadingProducts={isLoadingProducts} to BOTH <BoutiqueSmartFilterSection /> usages
  const usageRegex = /(<BoutiqueSmartFilterSection\n([ \t]+)products=\{backendProducts\}\n)(?!\2isLoadingProducts=)/g;
  const usageMatches = text.match(usageRegex);

  if (usageMatches && usageMatches.length > 0) {
    text = text.replace(usageRegex, '$1$2isLoadingProducts={isLoadingProducts}\n');
    changesApplied += usageMatches.length;
    console.log(`  ✅ [Block 4C] Passed isLoadingProducts={isLoadingProducts} to ${usageMatches.length} <BoutiqueSmartFilterSection /> instance(s)`);
  } else if (text.includes('isLoadingProducts={isLoadingProducts}')) {
    console.log('  ✓ [Block 4C] All <BoutiqueSmartFilterSection /> instances already receive isLoadingProducts (skipped)');
  } else {
    throw new Error('[Block 4C] Could not find `<BoutiqueSmartFilterSection` JSX usage.');
  }

  // ---- BLOCK 5: Opt AdminInventory Into Full Admin Fields ---- //
  const adminInvStartAnchor = 'const AdminInventory = ({';
  const adminInvEndAnchor = 'const AdminTestLab = ({';

  const aiStartIdx = text.indexOf(adminInvStartAnchor);
  const aiEndIdx = text.indexOf(adminInvEndAnchor);

  if (aiStartIdx === -1 || aiEndIdx <= aiStartIdx) {
    throw new Error('[Block 5] Could not locate AdminInventory -> AdminTestLab section.');
  }

  let adminInvSection = text.slice(aiStartIdx, aiEndIdx);
  const adminFetchOld = 'const res = await fetch(`${API_BASE_URL}/api/products`);';
  const adminFetchNew = 'const res = await fetch(`${API_BASE_URL}/api/products?includeAdminFields=true`);';

  if (adminInvSection.includes(adminFetchNew)) {
    console.log('  ✓ [Block 5] AdminInventory already fetches `?includeAdminFields=true` (skipped)');
  } else if (adminInvSection.includes(adminFetchOld)) {
    adminInvSection = adminInvSection.replace(adminFetchOld, adminFetchNew);
    text = text.slice(0, aiStartIdx) + adminInvSection + text.slice(aiEndIdx);
    changesApplied++;
    console.log('  ✅ [Block 5] Updated AdminInventory fetch to `/api/products?includeAdminFields=true`');
  } else {
    throw new Error('[Block 5] Could not find `fetch(`${API_BASE_URL}/api/products`)` inside AdminInventory.');
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
  const cliAppArg = process.argv[2];
  const appPath = findFirstExistingFile([
    cliAppArg,
    'client/src/App.js',
    'src/App.js',
    'App.js',
    'App_2.js'
  ]);

  if (!appPath) {
    throw new Error('Could not locate App.js. Pass it explicitly: node apply_step4_patch.js path/to/App.js');
  }

  patchAppStep4(appPath);

  console.log('\n✨ All Step 4 changes applied successfully!');
  console.log('Next steps:');
  console.log('  1. Build frontend to verify zero JSX/compile errors:  cd client && npm run build');
  console.log('  2. Commit & push, then verify:');
  console.log('     - Boutique shows "Loading Susan\'s curated boutique..." while fetching, then renders 24 cards + "Load More Products"');
  console.log('     - Applying any filter resets visibleCount back to 24');
  console.log('     - Admin Inventory tab requests /api/products?includeAdminFields=true');
} catch (err) {
  console.error('\n❌ Step 4 patch failed:', err.message);
  process.exit(1);
}
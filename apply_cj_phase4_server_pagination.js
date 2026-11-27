#!/usr/bin/env node
/**
 * apply_cj_phase4_server_pagination.js
 *
 * Phase 4 of the Uncapped CJ Dropshipping Skincare & Beauty Integration Plan.
 * Safely and idempotently patches `server.js` and `App.js` to:
 *
 *  Part A — server.js:
 *    1. Upgrade `GET /api/products` to support full server-side filtering & sorting:
 *       - `onlySensitiveSafe=true`
 *       - `blueprintOnly=true` (`blueprintSkinType`, `blueprintGoal`, `blueprintSensitivity`)
 *       - `excludeRawCj=true` (gives AdminInventory `availableLogistics`, `cjPid`, `cjSku`,
 *         and `seoAnswerCapsule` without heavy `rawCjData` blobs)
 *       - Extended `search` across title, description, tags, keyActives, cjPid, cjSku, variants.sku
 *       - Extended `sort` (`price_asc`, `price_desc`, `newest`, `shipping_desc`, `title_asc`)
 *       - Returns `pagination.catalogTotal` alongside `total`, `page`, `totalPages`, `hasMore`
 *
 *  Part B — App.js:
 *    1. Cap `App()` General Boot Sequence initial fetch to `/api/products?limit=200` so
 *       opening the site never downloads 5,000+ SKUs into memory on initial load.
 *    2. Refactor `BoutiqueSmartFilterSection` to fetch pages of 24 products directly from
 *       `GET /api/products?paginated=true&page=N&limit=24&...` on filter/search changes and
 *       append page N+1 when clicking "Load More Products".
 *    3. Refactor `AdminInventory` to use true server-side pagination
 *       (`GET /api/products?includeAdminFields=true&excludeRawCj=true&paginated=true&page=N&limit=25`)
 *       with debounced search, ritual-step filtering, sorting, and Previous / Next controls.
 *
 * Usage:
 *   node apply_cj_phase4_server_pagination.js
 *   node apply_cj_phase4_server_pagination.js path/to/server.js path/to/App.js
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
  const backupPath = `${filePath}.cj_phase4_${Date.now()}.bak`;
  fs.copyFileSync(filePath, backupPath);
  const output = eol === '\r\n' ? normalizedText.replace(/\n/g, '\r\n') : normalizedText;
  fs.writeFileSync(filePath, output, 'utf8');
  return backupPath;
};

// ---------------- PART A: SERVER.JS PATCHER ---------------- //

const patchServerPhase4 = (serverPath) => {
  console.log(`\n🔧 Applying CJ Phase 4 (Part A — Server-Side Filtered & Paginated /api/products) to: ${serverPath}`);
  let { text, eol } = readNormalized(serverPath);
  let changesApplied = 0;

  const routeStartAnchor = "app.get('/api/products', async (req, res) => {";
  const routeEndAnchor = '// ---------------- PASSWORD RESET & AUTH ROUTES ---------------- //';

  const startIdx = text.indexOf(routeStartAnchor);
  const endIdx = text.indexOf(routeEndAnchor);

  const upgradedProductsRoute = [
    '// Phase 4: True Server-Side Filtered, Sorted & Paginated Product Endpoint (supports 5,000+ SKUs)',
    "app.get('/api/products', async (req, res) => {",
    '  try {',
    '    const {',
    '      category,',
    '      skinType,',
    '      skinConcern,',
    '      ritualStep,',
    '      onlySensitiveSafe,',
    '      blueprintOnly,',
    '      blueprintSkinType,',
    '      blueprintGoal,',
    '      blueprintSensitivity,',
    '      search,',
    '      sort,',
    '      page,',
    '      limit,',
    '      paginated,',
    '      includeAdminFields,',
    '      excludeRawCj,',
    '      full',
    '    } = req.query;',
    '',
    '    const andClauses = [];',
    '',
    "    if (category && category !== 'All') {",
    "      andClauses.push({ tags: new RegExp(`^${escapeRegex(category)}$`, 'i') });",
    '    }',
    "    if (skinType && skinType !== 'All') {",
    "      andClauses.push({ skinTypes: { $in: [new RegExp(`^${escapeRegex(skinType)}$`, 'i'), 'All Skin Types'] } });",
    '    }',
    "    if (skinConcern && skinConcern !== 'All') {",
    "      andClauses.push({ skinConcerns: new RegExp(`^${escapeRegex(skinConcern)}$`, 'i') });",
    '    }',
    "    if (ritualStep && ritualStep !== 'All' && ritualStep !== 'ALL') {",
    "      andClauses.push({ ritualStep: new RegExp(escapeRegex(ritualStep), 'i') });",
    '    }',
    "    if (onlySensitiveSafe === 'true') {",
    '      andClauses.push({ sensitivitySafe: { $ne: false } });',
    '    }',
    "    if (blueprintOnly === 'true') {",
    '      const bpOr = [];',
    '      if (blueprintGoal && String(blueprintGoal).trim()) {',
    "        bpOr.push({ skinConcerns: new RegExp(`^${escapeRegex(String(blueprintGoal).trim())}$`, 'i') });",
    '      }',
    '      if (blueprintSkinType && String(blueprintSkinType).trim()) {',
    "        bpOr.push({ skinTypes: new RegExp(`^${escapeRegex(String(blueprintSkinType).trim())}$`, 'i') });",
    '      }',
    "      if (String(blueprintSensitivity || '').toLowerCase() === 'high') {",
    '        andClauses.push({ sensitivitySafe: { $ne: false } });',
    '      }',
    '      if (bpOr.length > 0) {',
    '        andClauses.push({ $or: bpOr });',
    '      }',
    '    }',
    '    if (search && String(search).trim()) {',
    "      const searchRegex = new RegExp(escapeRegex(String(search).trim()), 'i');",
    '      andClauses.push({',
    '        $or: [',
    '          { title: searchRegex },',
    '          { description: searchRegex },',
    '          { tags: searchRegex },',
    '          { keyActives: searchRegex },',
    '          { cjPid: searchRegex },',
    '          { cjSku: searchRegex },',
    "          { 'variants.sku': searchRegex },",
    '          { ritualStep: searchRegex },',
    '          { skinTypes: searchRegex },',
    '          { skinConcerns: searchRegex }',
    '        ]',
    '      });',
    '    }',
    '',
    '    const filter = andClauses.length === 0',
    '      ? {}',
    '      : andClauses.length === 1',
    '      ? andClauses[0]',
    '      : { $and: andClauses };',
    '',
    '    // Default popularity sort uses the { purchaseCount: -1, viewCount: -1, _id: 1 } index',
    '    let sortSpec = { purchaseCount: -1, viewCount: -1, _id: 1 };',
    "    if (sort === 'price_asc') sortSpec = { price: 1, _id: 1 };",
    "    else if (sort === 'price_desc') sortSpec = { price: -1, _id: 1 };",
    "    else if (sort === 'newest') sortSpec = { lastSyncedAt: -1, _id: 1 };",
    "    else if (sort === 'shipping_desc') sortSpec = { shippingCostUsd: -1, _id: 1 };",
    "    else if (sort === 'title_asc') sortSpec = { title: 1, _id: 1 };",
    '',
    '    // Admin requests can opt in to logistics/GEO fields while still stripping heavy rawCjData via excludeRawCj=true',
    "    const isAdminPayload = includeAdminFields === 'true' || full === 'true';",
    '    const projection = isAdminPayload',
    "      ? (excludeRawCj === 'true' ? '-rawCjData -__v' : '-__v')",
    "      : '-rawCjData -availableLogistics -seoAnswerCapsule -__v';",
    '',
    '    if (isAdminPayload) {',
    "      res.set('Cache-Control', 'no-store');",
    '    } else {',
    "      res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');",
    '    }',
    '',
    '    // Paginated response: returns { products, pagination: { page, limit, total, totalPages, hasMore, catalogTotal } }',
    "    const wantsPagination = paginated === 'true' || page !== undefined;",
    '    if (wantsPagination) {',
    '      const parsedPage = Math.max(1, parseInt(page, 10) || 1);',
    '      const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 24));',
    '      const skip = (parsedPage - 1) * parsedLimit;',
    '',
    '      const [products, total, catalogTotal] = await Promise.all([',
    '        Product.find(filter)',
    '          .select(projection)',
    '          .sort(sortSpec)',
    '          .skip(skip)',
    '          .limit(parsedLimit)',
    '          .lean(),',
    '        Product.countDocuments(filter),',
    '        Object.keys(filter).length === 0 ? Promise.resolve(null) : Product.countDocuments({})',
    '      ]);',
    '',
    '      const resolvedCatalogTotal = catalogTotal === null ? total : catalogTotal;',
    '      const totalPages = Math.max(1, Math.ceil(total / parsedLimit));',
    "      res.set('X-Total-Count', String(total));",
    '      return res.status(200).json({',
    '        products,',
    '        pagination: {',
    '          page: parsedPage,',
    '          limit: parsedLimit,',
    '          total,',
    '          catalogTotal: resolvedCatalogTotal,',
    '          totalPages,',
    '          hasMore: parsedPage < totalPages',
    '        }',
    '      });',
    '    }',
    '',
    '    // Default array response for legacy callers (capped safely at 500 max if limit is omitted)',
    '    const query = Product.find(filter).select(projection).sort(sortSpec);',
    '    const parsedLimit = limit !== undefined',
    '      ? Math.min(500, Math.max(1, parseInt(limit, 10) || 200))',
    '      : 300;',
    '    query.limit(parsedLimit);',
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

  if (text.includes('// Phase 4: True Server-Side Filtered, Sorted & Paginated Product Endpoint')) {
    console.log('  ✓ [A.1] GET /api/products already upgraded for Phase 4 server-side pagination (skipped)');
  } else if (startIdx !== -1 && endIdx > startIdx) {
    text = text.slice(0, startIdx) + upgradedProductsRoute + '\n' + text.slice(endIdx);
    changesApplied++;
    console.log('  ✅ [A.1] Upgraded GET /api/products with blueprint/sensitivity/SKU filtering, excludeRawCj & catalogTotal');
  } else {
    throw new Error('[A.1] Could not locate GET /api/products -> PASSWORD RESET & AUTH ROUTES range.');
  }

  if (changesApplied > 0) {
    const backupPath = writeWithOriginalEol(serverPath, text, eol);
    console.log(`  💾 Saved ${serverPath} (${changesApplied} change(s) applied). Backup: ${path.basename(backupPath)}`);
  } else {
    console.log(`  ℹ️ No changes needed for ${serverPath}.`);
  }
};

// ---------------- PART B: APP.JS PATCHER ---------------- //

const patchAppPhase4 = (appPath) => {
  console.log(`\n🔧 Applying CJ Phase 4 (Part B — Server-Side Paginated Boutique & AdminInventory) to: ${appPath}`);
  let { text, eol } = readNormalized(appPath);
  let changesApplied = 0;

  // ---- B.1: Cap General Boot Sequence fetch to ?limit=200 ---- //
  const bootFetchOld = '        const response = await fetch(`${API_BASE_URL}/api/products`);';
  const bootFetchNew = '        const response = await fetch(`${API_BASE_URL}/api/products?limit=200`);';

  if (text.includes(bootFetchNew)) {
    console.log('  ✓ [B.1] General Boot Sequence already caps initial fetch to ?limit=200 (skipped)');
  } else if (text.includes(bootFetchOld)) {
    text = text.replace(bootFetchOld, bootFetchNew);
    changesApplied++;
    console.log('  ✅ [B.1] Capped App() General Boot Sequence fetch to /api/products?limit=200');
  } else {
    console.log('  ℹ️ [B.1] General Boot Sequence fetch already customized (skipped)');
  }

  // ---- B.2: Upgrade BoutiqueSmartFilterSection to True Server-Side Paginated Fetching ---- //
  const bsfStartAnchor = 'const BoutiqueSmartFilterSection = ({';
  const bsfEndAnchor = 'const MembershipUpgradeModal = ({';

  const bsfStartIdx = text.indexOf(bsfStartAnchor);
  const bsfEndIdx = text.indexOf(bsfEndAnchor);

  const upgradedBoutiqueSection = [
    '// Phase 4: True Server-Side Paginated BoutiqueSmartFilterSection (scales cleanly to 5,000+ CJ Skincare SKUs)',
    'const BoutiqueSmartFilterSection = ({',
    '  products = [],',
    '  isLoadingProducts = false,',
    '  quizAnswers = {},',
    '  hasCompletedQuiz = false,',
    '  boutiqueFilters,',
    '  setBoutiqueFilters,',
    '  onResetFilters,',
    '  onAddToCart,',
    '  onCardClick,',
    '  onGoToBlueprintTab',
    '}) => {',
    '  const {',
    '    onlyBlueprintMatch = false,',
    "    skinType = 'All',",
    "    skinConcern = 'All',",
    "    ritualStep = 'All',",
    '    onlySensitiveSafe = false,',
    "    searchQuery = ''",
    '  } = boutiqueFilters || {};',
    '',
    '  const BOUTIQUE_PAGE_SIZE = 24;',
    '  const [serverProducts, setServerProducts] = useState([]);',
    '  const [serverPage, setServerPage] = useState(1);',
    '  const [serverTotal, setServerTotal] = useState(0);',
    '  const [serverCatalogTotal, setServerCatalogTotal] = useState(0);',
    '  const [serverHasMore, setServerHasMore] = useState(false);',
    '  const [isFetchingPage, setIsFetchingPage] = useState(true);',
    '  const [isLoadingMore, setIsLoadingMore] = useState(false);',
    "  const [debouncedSearch, setDebouncedSearch] = useState(String(searchQuery || '').trim());",
    '',
    "  const boutiquePageContext = onGoToBlueprintTab ? 'Member Sanctuary: Boutique' : 'Public Boutique';",
    '',
    '  // Debounce search input (350ms for server query + 600ms analytics tracking)',
    '  useEffect(() => {',
    "    const trimmed = String(searchQuery || '').trim();",
    '    const queryTimer = setTimeout(() => {',
    '      setDebouncedSearch(trimmed);',
    '    }, 350);',
    '    let analyticsTimer = null;',
    '    if (trimmed.length >= 2) {',
    '      analyticsTimer = setTimeout(() => {',
    "        trackSiteEvent('SEARCH_QUERY', {",
    '          page: boutiquePageContext,',
    '          searchQuery: trimmed',
    '        });',
    '      }, 600);',
    '    }',
    '    return () => {',
    '      clearTimeout(queryTimer);',
    '      if (analyticsTimer) clearTimeout(analyticsTimer);',
    '    };',
    '  }, [searchQuery, boutiquePageContext]);',
    '',
    '  const fetchBoutiquePage = async (targetPage = 1, append = false, signal = null) => {',
    '    if (append) setIsLoadingMore(true);',
    '    else setIsFetchingPage(true);',
    '    try {',
    '      const params = new URLSearchParams({',
    "        paginated: 'true',",
    '        page: String(targetPage),',
    '        limit: String(BOUTIQUE_PAGE_SIZE)',
    '      });',
    "      if (skinType && skinType !== 'All') params.set('skinType', skinType);",
    "      if (skinConcern && skinConcern !== 'All') params.set('skinConcern', skinConcern);",
    "      if (ritualStep && ritualStep !== 'All') params.set('ritualStep', ritualStep);",
    "      if (onlySensitiveSafe) params.set('onlySensitiveSafe', 'true');",
    "      if (debouncedSearch) params.set('search', debouncedSearch);",
    '      if (onlyBlueprintMatch && hasCompletedQuiz) {',
    "        params.set('blueprintOnly', 'true');",
    "        if (quizAnswers?.skinType) params.set('blueprintSkinType', quizAnswers.skinType);",
    "        if (quizAnswers?.primaryGoal) params.set('blueprintGoal', quizAnswers.primaryGoal);",
    "        if (quizAnswers?.skinSensitivity) params.set('blueprintSensitivity', quizAnswers.skinSensitivity);",
    '      }',
    '',
    '      const res = await fetch(`${API_BASE_URL}/api/products?${params.toString()}`, signal ? { signal } : undefined);',
    '      if (res.ok) {',
    '        const data = await res.json();',
    '        const incoming = Array.isArray(data) ? data : (Array.isArray(data.products) ? data.products : []);',
    '        const pag = data?.pagination || {};',
    '        setServerProducts(prev => (append ? [...prev, ...incoming] : incoming));',
    '        setServerPage(Number(pag.page || targetPage));',
    '        setServerTotal(Number(pag.total ?? incoming.length));',
    '        setServerCatalogTotal(Number(pag.catalogTotal ?? pag.total ?? incoming.length));',
    '        setServerHasMore(Boolean(pag.hasMore));',
    '      }',
    '    } catch (err) {',
    "      if (err?.name !== 'AbortError') {",
    "        console.error('Server-paginated Boutique fetch error:', err);",
    '      }',
    '    } finally {',
    '      if (append) setIsLoadingMore(false);',
    '      else setIsFetchingPage(false);',
    '    }',
    '  };',
    '',
    '  // Automatically fetch page 1 from MongoDB whenever any filter or debounced search changes',
    '  useEffect(() => {',
    "    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;",
    '    fetchBoutiquePage(1, false, controller ? controller.signal : null);',
    '    return () => {',
    '      if (controller) controller.abort();',
    '    };',
    '    // eslint-disable-next-line',
    '  }, [skinType, skinConcern, ritualStep, onlySensitiveSafe, onlyBlueprintMatch, debouncedSearch, hasCompletedQuiz, quizAnswers?.skinType, quizAnswers?.primaryGoal, quizAnswers?.skinSensitivity]);',
    '',
    '  const applyAndTrackFilter = (updaterFn, filterType, filterValue) => {',
    '    setBoutiqueFilters(updaterFn);',
    "    if (filterType && filterValue && String(filterValue).toLowerCase() !== 'all') {",
    "      trackSiteEvent('FILTER_USED', {",
    '        page: boutiquePageContext,',
    '        filterType,',
    '        filterValue: String(filterValue)',
    '      });',
    '    }',
    '  };',
    '',
    '  const activeListSource = serverProducts.length > 0 || !isFetchingPage ? serverProducts : products;',
    '',
    '  const decoratedProducts = useMemo(',
    '    () => activeListSource.map(prod => ({ product: prod, match: evaluateBlueprintMatch(prod, quizAnswers, hasCompletedQuiz) })),',
    '    [activeListSource, quizAnswers, hasCompletedQuiz]',
    '  );',
    '',
    '  const sortedLoadedProducts = useMemo(() => {',
    '    if (!hasCompletedQuiz) return decoratedProducts;',
    '    return [...decoratedProducts].sort(',
    '      (a, b) => (Number(b.match.isMatch) - Number(a.match.isMatch)) || (b.match.matchScore - a.match.matchScore)',
    '    );',
    '  }, [decoratedProducts, hasCompletedQuiz]);',
    '',
    '  const hasActiveFilter =',
    '    onlyBlueprintMatch ||',
    "    skinType !== 'All' ||",
    "    skinConcern !== 'All' ||",
    "    ritualStep !== 'All' ||",
    '    onlySensitiveSafe ||',
    '    Boolean(debouncedSearch);',
    '',
    '  const effectiveLoading = isFetchingPage && serverProducts.length === 0 && isLoadingProducts;',
    '  const remainingCount = Math.max(0, serverTotal - sortedLoadedProducts.length);',
    '',
    '  return (',
    "    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>",
    '      {/* ✨ My Blueprint Reference & Smart Filter Bar */}',
    '      <div style={{',
    "        backgroundColor: '#FFFFFF',",
    "        border: '1.5px solid #B38B8F',",
    "        borderRadius: '20px',",
    "        padding: '22px 24px',",
    "        boxShadow: '0 8px 25px rgba(232, 197, 200, 0.2)',",
    "        textAlign: 'left'",
    '      }}>',
    "        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '14px', borderBottom: '1px solid #E8C5C8', paddingBottom: '12px' }}>",
    '          <div>',
    "            <h3 style={{ fontFamily: \"'Cormorant Garamond', serif\", fontSize: '1.65rem', color: '#5C5454', margin: 0 }}>",
    '              ✨ My Blueprint Reference & Smart Boutique Filter Bar',
    '            </h3>',
    "            <p style={{ margin: '3px 0 0 0', fontSize: '0.88rem', color: '#8A797A', fontFamily: 'sans-serif' }}>",
    '              {hasCompletedQuiz',
    "                ? 'Every product below is cross-referenced against your locked Beauty Blueprint. Click any pill to filter by Skin Type, Condition, or Ritual Step.'",
    "                : 'Filter our curated skincare & beauty boutique by Skin Type, Target Skin Condition, Sensitivity Safety, or Ritual Step.'}",
    '            </p>',
    '          </div>',
    '',
    "          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>",
    '            {hasCompletedQuiz && (',
    '              <button',
    '                type="button"',
    '                onClick={() =>',
    '                  applyAndTrackFilter(',
    '                    prev => ({',
    '                      ...prev,',
    '                      onlyBlueprintMatch: !prev.onlyBlueprintMatch',
    '                    }),',
    "                    'Blueprint Match',",
    "                    !onlyBlueprintMatch ? 'Best Match for My Blueprint' : 'All'",
    '                  )',
    '                }',
    '                style={{',
    '                  background: onlyBlueprintMatch',
    "                    ? 'linear-gradient(135deg, #B38B8F 0%, #D4A5A9 100%)'",
    "                    : '#FFF0F2',",
    "                  color: onlyBlueprintMatch ? '#FFFFFF' : '#5C5454',",
    "                  border: '1.5px solid #B38B8F',",
    "                  padding: '8px 16px',",
    "                  borderRadius: '20px',",
    "                  fontFamily: \"'Cormorant Garamond', serif\",",
    "                  fontSize: '1.05rem',",
    "                  fontWeight: 'bold',",
    "                  cursor: 'pointer',",
    "                  boxShadow: onlyBlueprintMatch ? '0 4px 12px rgba(179, 139, 143, 0.35)' : 'none',",
    "                  transition: 'all 0.2s ease'",
    '                }}',
    '              >',
    '                {onlyBlueprintMatch',
    "                  ? '✓ Showing Best Match for My Blueprint'",
    "                  : '✨ Best Match for My Blueprint'}",
    '              </button>',
    '            )}',
    '',
    '            {hasActiveFilter && (',
    '              <button',
    '                type="button"',
    '                onClick={onResetFilters}',
    '                style={{',
    "                  backgroundColor: '#FFFFFF',",
    "                  color: '#736A6A',",
    "                  border: '1px solid #E8C5C8',",
    "                  padding: '8px 14px',",
    "                  borderRadius: '20px',",
    "                  fontFamily: 'sans-serif',",
    "                  fontSize: '0.82rem',",
    "                  cursor: 'pointer'",
    '                }}',
    '              >',
    '                ↺ Reset All Filters',
    '              </button>',
    '            )}',
    '          </div>',
    '        </div>',
    '',
    "        {/* Member's Core Blueprint Summary Badges */}",
    '        {hasCompletedQuiz && quizAnswers?.skinType && (',
    '          <div style={{',
    "            display: 'flex',",
    "            alignItems: 'center',",
    "            flexWrap: 'wrap',",
    "            gap: '8px',",
    "            backgroundColor: '#FFF9F9',",
    "            border: '1px solid #E8C5C8',",
    "            borderRadius: '12px',",
    "            padding: '10px 14px',",
    "            marginBottom: '14px'",
    '          }}>',
    "            <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#B38B8F', fontFamily: 'sans-serif' }}>",
    '              🔒 Your Active Blueprint:',
    '            </span>',
    '            <button',
    '              type="button"',
    '              onClick={() =>',
    '                setBoutiqueFilters(prev => ({',
    '                  ...prev,',
    "                  skinType: prev.skinType === quizAnswers.skinType ? 'All' : quizAnswers.skinType",
    '                }))',
    '              }',
    '              style={{',
    "                backgroundColor: skinType === quizAnswers.skinType ? '#F2D4D7' : '#FFFFFF',",
    "                border: '1px solid #B38B8F',",
    "                color: '#5C5454',",
    "                borderRadius: '14px',",
    "                padding: '4px 10px',",
    "                fontSize: '0.78rem',",
    "                fontFamily: 'sans-serif',",
    "                fontWeight: 'bold',",
    "                cursor: 'pointer'",
    '              }}',
    '            >',
    '              💧 Skin: {quizAnswers.skinType}',
    '            </button>',
    '            <button',
    '              type="button"',
    '              onClick={() =>',
    '                setBoutiqueFilters(prev => ({',
    '                  ...prev,',
    "                  skinConcern: prev.skinConcern === quizAnswers.primaryGoal ? 'All' : quizAnswers.primaryGoal",
    '                }))',
    '              }',
    '              style={{',
    "                backgroundColor: skinConcern === quizAnswers.primaryGoal ? '#F2D4D7' : '#FFFFFF',",
    "                border: '1px solid #B38B8F',",
    "                color: '#5C5454',",
    "                borderRadius: '14px',",
    "                padding: '4px 10px',",
    "                fontSize: '0.78rem',",
    "                fontFamily: 'sans-serif',",
    "                fontWeight: 'bold',",
    "                cursor: 'pointer'",
    '              }}',
    '            >',
    '              🎯 Goal: {quizAnswers.primaryGoal}',
    '            </button>',
    '            <button',
    '              type="button"',
    '              onClick={() =>',
    '                setBoutiqueFilters(prev => ({',
    '                  ...prev,',
    '                  onlySensitiveSafe: !prev.onlySensitiveSafe',
    '                }))',
    '              }',
    '              style={{',
    "                backgroundColor: onlySensitiveSafe ? '#F6FBF7' : '#FFFFFF',",
    "                border: onlySensitiveSafe ? '1.5px solid #2E7D32' : '1px solid #E8C5C8',",
    "                color: onlySensitiveSafe ? '#2E7D32' : '#5C5454',",
    "                borderRadius: '14px',",
    "                padding: '4px 10px',",
    "                fontSize: '0.78rem',",
    "                fontFamily: 'sans-serif',",
    "                fontWeight: 'bold',",
    "                cursor: 'pointer'",
    '              }}',
    '            >',
    "              🛡️ Sensitivity: {quizAnswers.skinSensitivity} {onlySensitiveSafe ? '(Safe-Only ✓)' : ''}",
    '            </button>',
    '            <span style={{',
    "              backgroundColor: '#FFFFFF',",
    "              border: '1px solid #E8C5C8',",
    "              color: '#736A6A',",
    "              borderRadius: '14px',",
    "              padding: '4px 10px',",
    "              fontSize: '0.78rem',",
    "              fontFamily: 'sans-serif'",
    '            }}>',
    '              🌤️ Climate: {quizAnswers.climate}',
    '            </span>',
    '            <span style={{',
    "              backgroundColor: '#FFFFFF',",
    "              border: '1px solid #E8C5C8',",
    "              color: '#736A6A',",
    "              borderRadius: '14px',",
    "              padding: '4px 10px',",
    "              fontSize: '0.78rem',",
    "              fontFamily: 'sans-serif'",
    '            }}>',
    '              💄 Vibe: {quizAnswers.makeupVibe} ({quizAnswers.undertone} Undertone)',
    '            </span>',
    '            {onGoToBlueprintTab && (',
    '              <button',
    '                type="button"',
    '                onClick={onGoToBlueprintTab}',
    '                style={{',
    "                  marginLeft: 'auto',",
    "                  background: 'none',",
    "                  border: 'none',",
    "                  color: '#B38B8F',",
    "                  fontSize: '0.8rem',",
    "                  fontFamily: 'sans-serif',",
    "                  fontWeight: 'bold',",
    "                  textDecoration: 'underline',",
    "                  cursor: 'pointer'",
    '                }}',
    '              >',
    '                📝 View Full Dossier →',
    '              </button>',
    '            )}',
    '          </div>',
    '        )}',
    '',
    '        {/* Search & Sensitivity Toggle Row */}',
    "        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>",
    '          <input',
    '            type="text"',
    '            placeholder="🔍 Search by product name, active ingredient (e.g. Hyaluronic, Vitamin C), or concern..."',
    '            value={searchQuery}',
    '            onChange={(e) => setBoutiqueFilters(prev => ({ ...prev, searchQuery: e.target.value }))}',
    '            style={{',
    "              flex: '1 1 280px',",
    "              padding: '10px 15px',",
    "              borderRadius: '20px',",
    "              border: '1px solid #E8C5C8',",
    "              backgroundColor: '#FFF9F9',",
    "              outline: 'none',",
    "              fontFamily: 'sans-serif',",
    "              fontSize: '0.9rem',",
    "              color: '#5C5454'",
    '            }}',
    '          />',
    '',
    '          <button',
    '            type="button"',
    '            onClick={() =>',
    '              applyAndTrackFilter(',
    '                prev => ({ ...prev, onlySensitiveSafe: !prev.onlySensitiveSafe }),',
    "                'Sensitivity',",
    "                !onlySensitiveSafe ? 'High-Sensitivity Safe Only' : 'All'",
    '              )',
    '            }',
    '            style={{',
    "              padding: '9px 15px',",
    "              borderRadius: '20px',",
    "              border: onlySensitiveSafe ? '1.5px solid #2E7D32' : '1px solid #E8C5C8',",
    "              backgroundColor: onlySensitiveSafe ? '#F6FBF7' : '#FFF9F9',",
    "              color: onlySensitiveSafe ? '#2E7D32' : '#5C5454',",
    "              fontFamily: 'sans-serif',",
    "              fontSize: '0.84rem',",
    "              fontWeight: onlySensitiveSafe ? 'bold' : 'normal',",
    "              cursor: 'pointer'",
    '            }}',
    '          >',
    "            {onlySensitiveSafe ? '✓ 🛡️ Gentle • High-Sensitivity Safe Only' : '🛡️ Filter: High-Sensitivity Safe Only'}",
    '          </button>',
    '        </div>',
    '',
    '        {/* Skin Type Filter Pills */}',
    "        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>",
    "          <span style={{ fontSize: '0.78rem', fontWeight: 'bold', color: '#8A797A', fontFamily: 'sans-serif', minWidth: '88px' }}>",
    '            Skin Type:',
    '          </span>',
    "          {['All', ...BLUEPRINT_SKIN_TYPE_OPTIONS].map(st => {",
    '            const active = skinType === st;',
    '            const isUserTrait = hasCompletedQuiz && quizAnswers?.skinType && st.toLowerCase() === quizAnswers.skinType.toLowerCase();',
    '            return (',
    '              <button',
    '                key={`filter-st-${st}`}',
    '                type="button"',
    "                onClick={() => applyAndTrackFilter(prev => ({ ...prev, skinType: st }), 'Skin Type', st)}",
    '                style={{',
    "                  padding: '5px 12px',",
    "                  borderRadius: '15px',",
    "                  fontSize: '0.78rem',",
    "                  fontFamily: 'sans-serif',",
    "                  fontWeight: active || isUserTrait ? 'bold' : 'normal',",
    "                  backgroundColor: active ? '#F2D4D7' : isUserTrait ? '#FFF0F2' : '#FFF9F9',",
    "                  color: '#5C5454',",
    "                  border: active ? '1.5px solid #B38B8F' : isUserTrait ? '1px dashed #B38B8F' : '1px solid #E8C5C8',",
    "                  cursor: 'pointer'",
    '                }}',
    '              >',
    "                {st === 'All' ? 'All Skin Types' : `${isUserTrait ? '★ ' : ''}${st}`}",
    '              </button>',
    '            );',
    '          })}',
    '        </div>',
    '',
    '        {/* Skin Condition / Primary Goal Filter Pills */}',
    "        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>",
    "          <span style={{ fontSize: '0.78rem', fontWeight: 'bold', color: '#8A797A', fontFamily: 'sans-serif', minWidth: '88px' }}>",
    '            Skin Condition:',
    '          </span>',
    "          {['All', ...BLUEPRINT_CONCERN_OPTIONS].map(sc => {",
    '            const active = skinConcern === sc;',
    '            const isUserGoal = hasCompletedQuiz && quizAnswers?.primaryGoal && sc.toLowerCase() === quizAnswers.primaryGoal.toLowerCase();',
    '            return (',
    '              <button',
    '                key={`filter-sc-${sc}`}',
    '                type="button"',
    "                onClick={() => applyAndTrackFilter(prev => ({ ...prev, skinConcern: sc }), 'Skin Condition', sc)}",
    '                style={{',
    "                  padding: '5px 12px',",
    "                  borderRadius: '15px',",
    "                  fontSize: '0.78rem',",
    "                  fontFamily: 'sans-serif',",
    "                  fontWeight: active || isUserGoal ? 'bold' : 'normal',",
    "                  backgroundColor: active ? '#F2D4D7' : isUserGoal ? '#FFF0F2' : '#FFF9F9',",
    "                  color: '#5C5454',",
    "                  border: active ? '1.5px solid #B38B8F' : isUserGoal ? '1px dashed #B38B8F' : '1px solid #E8C5C8',",
    "                  cursor: 'pointer'",
    '                }}',
    '              >',
    "                {sc === 'All' ? 'All Conditions' : `${isUserGoal ? '★ ' : ''}${sc}`}",
    '              </button>',
    '            );',
    '          })}',
    '        </div>',
    '',
    '        {/* Ritual Step Filter Pills */}',
    "        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>",
    "          <span style={{ fontSize: '0.78rem', fontWeight: 'bold', color: '#8A797A', fontFamily: 'sans-serif', minWidth: '88px' }}>",
    '            Ritual Step:',
    '          </span>',
    "          {['All', ...BLUEPRINT_RITUAL_STEP_OPTIONS].map(stepOpt => {",
    '            const active = ritualStep === stepOpt;',
    '            return (',
    '              <button',
    '                key={`filter-step-${stepOpt}`}',
    '                type="button"',
    "                onClick={() => applyAndTrackFilter(prev => ({ ...prev, ritualStep: stepOpt }), 'Ritual Step', stepOpt)}",
    '                style={{',
    "                  padding: '5px 11px',",
    "                  borderRadius: '15px',",
    "                  fontSize: '0.76rem',",
    "                  fontFamily: 'sans-serif',",
    "                  fontWeight: active ? 'bold' : 'normal',",
    "                  backgroundColor: active ? '#5C5454' : '#FFF9F9',",
    "                  color: active ? '#FFFFFF' : '#5C5454',",
    "                  border: active ? '1.5px solid #5C5454' : '1px solid #E8C5C8',",
    "                  cursor: 'pointer'",
    '                }}',
    '              >',
    "                {stepOpt === 'All' ? 'All Steps' : stepOpt}",
    '              </button>',
    '            );',
    '          })}',
    '        </div>',
    '      </div>',
    '',
    '      {/* Results Count Bar */}',
    "      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', padding: '0 4px' }}>",
    "        <span style={{ fontFamily: \"'Cormorant Garamond', serif\", fontSize: '1.2rem', color: '#5C5454', fontWeight: 'bold' }}>",
    '          {isFetchingPage && serverProducts.length === 0',
    '            ? "Loading Susan\'s curated skincare boutique..."',
    '            : `Showing ${sortedLoadedProducts.length} of ${serverTotal || sortedLoadedProducts.length} Matching Skincare & Beauty Essentials${serverCatalogTotal > serverTotal ? ` (${serverCatalogTotal.toLocaleString()} total in boutique)` : \'\'}${onlyBlueprintMatch ? \' (Filtered to Your Blueprint Matches ✧)\' : \'\'}`}',
    '        </span>',
    '        {hasActiveFilter && (',
    '          <button',
    '            type="button"',
    '            onClick={onResetFilters}',
    "            style={{ background: 'none', border: 'none', color: '#B38B8F', fontFamily: 'sans-serif', fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'underline' }}",
    '          >',
    '            Show All {(serverCatalogTotal || serverTotal || products.length).toLocaleString()} Products',
    '          </button>',
    '        )}',
    '      </div>',
    '',
    '      {/* Product Grid */}',
    '      {effectiveLoading || (isFetchingPage && sortedLoadedProducts.length === 0) ? (',
    "        <p style={{ fontFamily: \"'Cormorant Garamond', serif\", color: '#736A6A', fontSize: '1.2rem', fontStyle: 'italic' }}>",
    '          Loading Susan&apos;s curated skincare boutique...',
    '        </p>',
    '      ) : sortedLoadedProducts.length === 0 ? (',
    "        <div style={{ padding: '40px 25px', textAlign: 'center', backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px dashed #E8C5C8' }}>",
    "          <p style={{ fontFamily: \"'Cormorant Garamond', serif\", fontSize: '1.4rem', color: '#5C5454', margin: '0 0 12px 0' }}>",
    '            {hasActiveFilter',
    "              ? 'No boutique products matched that exact filter combination.'",
    "              : 'Our curated skincare boutique is being refreshed. Please check back in a moment.'}",
    '          </p>',
    '          {hasActiveFilter && (',
    '            <button',
    '              type="button"',
    '              onClick={onResetFilters}',
    "              style={{ backgroundColor: '#F2D4D7', border: '1px solid #B38B8F', color: '#5C5454', padding: '10px 22px', borderRadius: '20px', fontFamily: \"'Cormorant Garamond', serif\", fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer' }}",
    '            >',
    '              Reset Boutique Filters ✧',
    '            </button>',
    '          )}',
    '        </div>',
    '      ) : (',
    '        <>',
    "          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '20px' }}>",
    '            {sortedLoadedProducts.map(({ product, match }) => (',
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
    '          {serverHasMore && (',
    "            <div style={{ textAlign: 'center', marginTop: '32px' }}>",
    "              <p style={{ fontSize: '0.88rem', color: '#7A6365', marginBottom: '12px' }}>",
    '                Showing {sortedLoadedProducts.length} of {serverTotal.toLocaleString()} skincare & beauty products',
    '              </p>',
    '              <button',
    '                type="button"',
    '                disabled={isLoadingMore}',
    '                onClick={() => fetchBoutiquePage(serverPage + 1, true)}',
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
    "                  cursor: isLoadingMore ? 'wait' : 'pointer'",
    '                }}',
    '              >',
    "                {isLoadingMore ? 'Loading Next 24 Products...' : `Load More Products (${remainingCount.toLocaleString()} remaining)`}",
    '              </button>',
    '            </div>',
    '          )}',
    '        </>',
    '      )}',
    '    </div>',
    '  );',
    '};',
    ''
  ].join('\n');

  if (text.includes('// Phase 4: True Server-Side Paginated BoutiqueSmartFilterSection')) {
    console.log('  ✓ [B.2] BoutiqueSmartFilterSection already uses server-side pagination (skipped)');
  } else if (bsfStartIdx !== -1 && bsfEndIdx > bsfStartIdx) {
    text = text.slice(0, bsfStartIdx) + upgradedBoutiqueSection + '\n' + text.slice(bsfEndIdx);
    changesApplied++;
    console.log('  ✅ [B.2] Upgraded BoutiqueSmartFilterSection to true server-side pagination (24/page)');
  } else {
    throw new Error('[B.2] Could not locate BoutiqueSmartFilterSection -> MembershipUpgradeModal section.');
  }

  // ---- B.3: Upgrade AdminInventory to True Server-Side Pagination (25/page, excludeRawCj=true) ---- //
  const aiStartAnchor = 'const AdminInventory = ({';
  const aiEndAnchor = 'const AdminTestLab = ({';

  const aiStartIdx = text.indexOf(aiStartAnchor);
  const aiEndIdx = text.indexOf(aiEndAnchor);

  if (aiStartIdx === -1 || aiEndIdx <= aiStartIdx) {
    throw new Error('[B.3] Could not locate AdminInventory -> AdminTestLab section.');
  }

  let aiSection = text.slice(aiStartIdx, aiEndIdx);
  let aiChanged = false;

  // 3a. Add AdminInventory pagination state
  const invStateOld = '  const [inventory, setInventory] = useState([]);';
  const invStateNew = [
    '  const ADMIN_PAGE_SIZE = 25;',
    '  const [inventory, setInventory] = useState([]);',
    '  const [adminPage, setAdminPage] = useState(1);',
    '  const [adminTotalPages, setAdminTotalPages] = useState(1);',
    '  const [adminTotalCount, setAdminTotalCount] = useState(0);',
    '  const [adminCatalogTotal, setAdminCatalogTotal] = useState(0);',
    '  const [isLoadingInventoryPage, setIsLoadingInventoryPage] = useState(false);'
  ].join('\n');

  if (aiSection.includes('const ADMIN_PAGE_SIZE = 25;')) {
    console.log('  ✓ [B.3a] AdminInventory server pagination state already present (skipped)');
  } else if (aiSection.includes(invStateOld)) {
    aiSection = aiSection.replace(invStateOld, invStateNew);
    aiChanged = true;
    console.log('  ✅ [B.3a] Added AdminInventory server pagination state');
  } else {
    throw new Error('[B.3a] Could not find `const [inventory, setInventory] = useState([]);` in AdminInventory.');
  }

  // 3b. Replace fetchInventory with server-paginated fetch + filter/search effect
  const fetchInvStart = '  const fetchInventory = async () => {';
  const fetchInvEnd = '  const fetchCatalogSyncStatus = async () => {';
  const fiStart = aiSection.indexOf(fetchInvStart);
  const fiEnd = aiSection.indexOf(fetchInvEnd);

  const fetchInvNew = [
    '  const fetchInventory = async (targetPage = adminPage, overrides = {}) => {',
    '    setIsLoadingInventoryPage(true);',
    '    try {',
    '      const pageToLoad = Math.max(1, Number(targetPage) || 1);',
    '      const qSearch = overrides.search !== undefined ? overrides.search : inventorySearchQuery;',
    '      const qStep = overrides.ritualStep !== undefined ? overrides.ritualStep : inventoryStepFilter;',
    '      const qSort = overrides.sortBy !== undefined ? overrides.sortBy : inventorySortBy;',
    '',
    '      const params = new URLSearchParams({',
    "        includeAdminFields: 'true',",
    "        excludeRawCj: 'true',",
    "        paginated: 'true',",
    '        page: String(pageToLoad),',
    '        limit: String(ADMIN_PAGE_SIZE)',
    '      });',
    "      if (qSearch && String(qSearch).trim()) params.set('search', String(qSearch).trim());",
    "      if (qStep && qStep !== 'ALL') params.set('ritualStep', qStep);",
    "      if (qSort === 'SHIPPING_DESC') params.set('sort', 'shipping_desc');",
    "      else if (qSort === 'PRICE_ASC') params.set('sort', 'price_asc');",
    "      else if (qSort === 'PRICE_DESC') params.set('sort', 'price_desc');",
    "      else if (qSort === 'TITLE_ASC') params.set('sort', 'title_asc');",
    '',
    '      const res = await fetch(`${API_BASE_URL}/api/products?${params.toString()}`);',
    '      if (res.ok) {',
    '        const data = await res.json();',
    '        const list = Array.isArray(data) ? data : (Array.isArray(data.products) ? data.products : []);',
    '        const pag = data?.pagination || {};',
    '        setInventory(list);',
    '        setAdminPage(Number(pag.page || pageToLoad));',
    '        setAdminTotalPages(Math.max(1, Number(pag.totalPages || 1)));',
    '        setAdminTotalCount(Number(pag.total ?? list.length));',
    '        setAdminCatalogTotal(Number(pag.catalogTotal ?? pag.total ?? list.length));',
    '      }',
    '    } catch (err) {',
    "      console.error('Failed to fetch paginated admin inventory:', err);",
    '    } finally {',
    '      setIsLoadingInventoryPage(false);',
    '    }',
    '  };',
    '',
    '  // Re-fetch page 1 from MongoDB whenever AdminInventory search, ritual step, or sort changes',
    '  useEffect(() => {',
    '    const timer = setTimeout(() => {',
    '      fetchInventory(1);',
    '    }, 350);',
    '    return () => clearTimeout(timer);',
    '    // eslint-disable-next-line',
    '  }, [inventorySearchQuery, inventoryStepFilter, inventorySortBy]);',
    ''
  ].join('\n');

  if (aiSection.includes("excludeRawCj: 'true',") && aiSection.includes('Failed to fetch paginated admin inventory:')) {
    console.log('  ✓ [B.3b] AdminInventory fetchInventory already server-paginated (skipped)');
  } else if (fiStart !== -1 && fiEnd > fiStart) {
    aiSection = aiSection.slice(0, fiStart) + fetchInvNew + '\n' + aiSection.slice(fiEnd);
    aiChanged = true;
    console.log('  ✅ [B.3b] Upgraded AdminInventory fetchInventory to server-side 25/page pagination');
  } else {
    throw new Error('[B.3b] Could not locate fetchInventory -> fetchCatalogSyncStatus range in AdminInventory.');
  }

  // 3c. Update Active Items badge & add Previous/Next pagination controls inside AdminInventory
  const badgeOld = '{inventory.length} Items Active';
  const badgeNew = '{(adminCatalogTotal || syncStatusTelemetry.activeCatalogTotal || inventory.length).toLocaleString()} Items Active';
  if (aiSection.includes(badgeOld)) {
    aiSection = aiSection.replace(badgeOld, badgeNew);
    aiChanged = true;
  }

  const showingOld = 'Showing <strong>{sortedList.length}</strong> of <strong>{inventory.length}</strong> products';
  const showingNew = 'Page <strong>{adminPage}</strong> of <strong>{adminTotalPages}</strong> • Showing <strong>{sortedList.length}</strong> of <strong>{(adminTotalCount || inventory.length).toLocaleString()}</strong> matching products';
  if (aiSection.includes(showingOld)) {
    aiSection = aiSection.replace(showingOld, showingNew);
    aiChanged = true;
  }

  const gridClosingOld = [
    '                    })}',
    '                  </div>',
    '                )}',
    '              </>',
    '            );',
    '          })()}'
  ].join('\n');

  const gridClosingNew = [
    '                    })}',
    '                  </div>',
    '                )}',
    '',
    '                {adminTotalPages > 1 && (',
    "                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '14px', flexWrap: 'wrap', marginTop: '24px', padding: '14px 18px', backgroundColor: '#FFFFFF', border: '1px solid #E8C5C8', borderRadius: '16px' }}>",
    '                    <button',
    '                      type="button"',
    '                      disabled={adminPage <= 1 || isLoadingInventoryPage}',
    '                      onClick={() => fetchInventory(adminPage - 1)}',
    "                      style={{ backgroundColor: '#FFF9F9', color: '#5C5454', border: '1px solid #B38B8F', borderRadius: '20px', padding: '8px 18px', fontFamily: \"'Cormorant Garamond', serif\", fontSize: '1rem', fontWeight: 'bold', cursor: (adminPage <= 1 || isLoadingInventoryPage) ? 'not-allowed' : 'pointer', opacity: adminPage <= 1 ? 0.5 : 1 }}",
    '                    >',
    '                      ← Previous Page',
    '                    </button>',
    "                    <span style={{ fontFamily: 'sans-serif', fontSize: '0.86rem', color: '#5C5454', fontWeight: 'bold' }}>",
    "                      {isLoadingInventoryPage ? 'Loading page...' : `Page ${adminPage} of ${adminTotalPages} (${adminTotalCount.toLocaleString()} matching SKUs)`}",
    '                    </span>',
    '                    <button',
    '                      type="button"',
    '                      disabled={adminPage >= adminTotalPages || isLoadingInventoryPage}',
    '                      onClick={() => fetchInventory(adminPage + 1)}',
    "                      style={{ backgroundColor: '#F2D4D7', color: '#5C5454', border: '1px solid #B38B8F', borderRadius: '20px', padding: '8px 18px', fontFamily: \"'Cormorant Garamond', serif\", fontSize: '1rem', fontWeight: 'bold', cursor: (adminPage >= adminTotalPages || isLoadingInventoryPage) ? 'not-allowed' : 'pointer', opacity: adminPage >= adminTotalPages ? 0.5 : 1 }}",
    '                    >',
    '                      Next Page →',
    '                    </button>',
    '                  </div>',
    '                )}',
    '              </>',
    '            );',
    '          })()}'
  ].join('\n');

  if (aiSection.includes('← Previous Page') && aiSection.includes('Next Page →')) {
    console.log('  ✓ [B.3c] AdminInventory Previous/Next pagination bar already present (skipped)');
  } else if (aiSection.includes(gridClosingOld)) {
    aiSection = aiSection.replace(gridClosingOld, gridClosingNew);
    aiChanged = true;
    console.log('  ✅ [B.3c] Added Previous / Next server pagination bar to AdminInventory');
  } else {
    throw new Error('[B.3c] Could not locate AdminInventory product grid closing anchor.');
  }

  if (aiChanged) {
    text = text.slice(0, aiStartIdx) + aiSection + text.slice(aiEndIdx);
    changesApplied++;
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
    throw new Error('Could not locate server.js. Pass it explicitly: node apply_cj_phase4_server_pagination.js path/to/server.js path/to/App.js');
  }
  if (!appPath) {
    throw new Error('Could not locate App.js. Pass it explicitly: node apply_cj_phase4_server_pagination.js path/to/server.js path/to/App.js');
  }

  patchServerPhase4(serverPath);
  patchAppPhase4(appPath);

  console.log('\n✨ Phase 4 (True Server-Side Paginated Boutique & AdminInventory) applied successfully!');
  console.log('Next steps:');
  console.log(`  1. Syntax-check backend:  node --check "${serverPath}"`);
  console.log('  2. Build React frontend:  cd client && npm run build');
  console.log('  3. Ready for Phase 5 (cursor-streamed /llms-full.txt & /sitemap.xml scaling + final production check)!');
} catch (err) {
  console.error('\n❌ Phase 4 patch failed:', err.message);
  process.exit(1);
}
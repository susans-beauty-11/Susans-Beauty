import React, { useState, useEffect } from 'react';
import './App.css';
import logo from "./susans-logo.png";

// Reads Google OAuth 2.0 Client ID from .env (REACT_APP_GOOGLE_CLIENT_ID) or dynamically from GET /api/auth/providers
const DEFAULT_GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || '';

// Smart API Base URL resolver: ensures mobile phones & live domains never accidentally hit http://localhost:5000
const resolveApiBaseUrl = () => {
  const rawEnv = String(process.env.REACT_APP_API_URL || '').trim().replace(/\/+$/, '');
  if (typeof window !== 'undefined') {
    const host = String(window.location.hostname || '').toLowerCase();
    const isBrowserLocal = host === 'localhost' || host === '127.0.0.1';
    if (rawEnv) {
      const isEnvLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(rawEnv);
      if (!isEnvLocal || isBrowserLocal) {
        return rawEnv;
      }
    }
    if (!isBrowserLocal) {
      return String(window.location.origin || 'https://susansbeautyconsulting.com').replace(/\/+$/, '');
    }
  }
  return rawEnv || 'http://localhost:5000';
};

const API_BASE_URL = resolveApiBaseUrl();

// ---------------- ANALYTICS PHASE 2: SILENT CLIENT-SIDE TELEMETRY ENGINE ---------------- //

const getAnalyticsSessionId = () => {
  try {
    let sid = sessionStorage.getItem('sbc_analytics_session_id');
    if (!sid) {
      sid = `sbc_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
      sessionStorage.setItem('sbc_analytics_session_id', sid);
    }
    return sid;
  } catch (e) {
    return 'sbc_anon_session';
  }
};

const trackSiteEvent = (eventType, payload = {}) => {
  try {
    if (!eventType) return;
    const sessionId = getAnalyticsSessionId();
    const token = localStorage.getItem('token');
    let savedUser = null;
    try {
      const rawUser = localStorage.getItem('authUser');
      if (rawUser) savedUser = JSON.parse(rawUser);
    } catch (e) {}

    // Skip tracking admin portal activity as shopper traffic
    if (savedUser && (savedUser.role === 'admin' || savedUser.membershipTier === 'admin')) {
      return;
    }

    const bodyPayload = {
      eventType: String(eventType).toUpperCase().trim(),
      sessionId,
      page: payload.page || '',
      userId: payload.userId || savedUser?.id || savedUser?._id || null,
      userEmail: payload.userEmail || savedUser?.email || '',
      membershipTier: payload.membershipTier || savedUser?.membershipTier || (token ? 'member' : 'guest'),
      productId: payload.productId || null,
      productTitle: payload.productTitle || '',
      ritualStep: payload.ritualStep || '',
      filterType: payload.filterType || '',
      filterValue: payload.filterValue !== undefined ? String(payload.filterValue) : '',
      searchQuery: payload.searchQuery || '',
      cartValueUsd: Number(payload.cartValueUsd || 0),
      metadata: payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {}
    };

    fetch(`${API_BASE_URL}/api/analytics/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify(bodyPayload),
      keepalive: true
    }).catch(() => {});
  } catch (err) {
    // Fail-safe: telemetry never interrupts UI
  }
};

// ---------------- COMPONENTS ---------------- //

const FallingSparkles = () => {
  const sparkles = Array.from({ length: 40 }).map((_, i) => {
    const colors = ['#FFFFFF', '#E8C5C8', '#B38B8F'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    
    return {
      id: i,
      left: Math.random() * 100, 
      animationDuration: Math.random() * 2 + 2, 
      animationDelay: Math.random() * 1.5, 
      size: Math.random() * 15 + 10, 
      color: randomColor,
      char: Math.random() > 0.5 ? '✦' : '✧' 
    };
  });

  return (
    <div className="sparkle-container" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 9999, overflow: 'hidden' }}>
      {sparkles.map(s => (
        <div 
          key={s.id} 
          style={{
            position: 'absolute',
            top: '-50px',
            left: `${s.left}vw`,
            color: s.color,
            fontSize: `${s.size}px`,
            animation: `fall ${s.animationDuration}s linear ${s.animationDelay}s infinite`,
          }}
        >
          {s.char}
        </div>
      ))}
      <style>{`
        @keyframes fall {
          0% { transform: translateY(-50px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(360deg); opacity: 0; }
        }
        @keyframes spinSlow { 100% { transform: rotate(360deg); } }
        @keyframes pulseSoft { 0%, 100% { opacity: 0.7; } 50% { opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};

const GlobalPublicLaunchStyles = () => (
  <style>{`
    @keyframes fall {
      0% { transform: translateY(-50px) rotate(0deg); opacity: 1; }
      100% { transform: translateY(100vh) rotate(360deg); opacity: 0; }
    }
    @keyframes spinSlow { 100% { transform: rotate(360deg); } }
    @keyframes pulseSoft { 0%, 100% { opacity: 0.7; } 50% { opacity: 1; } }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

    .calendar-grid-wrapper {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }

    @media (max-width: 860px) {
      .sanctuary-shell {
        flex-direction: column !important;
      }
      .sanctuary-sidebar {
        width: 100% !important;
        height: auto !important;
        max-height: 210px !important;
        border-right: none !important;
        border-bottom: 1px solid #E8C5C8 !important;
        padding: 15px 12px !important;
      }
      .sanctuary-nav-list {
        flex-direction: row !important;
        overflow-x: auto !important;
        gap: 8px !important;
        padding: 0 8px !important;
      }
      .sanctuary-nav-list button {
        white-space: nowrap !important;
        padding: 8px 14px !important;
        font-size: 1.05rem !important;
      }
      .sanctuary-main {
        padding: 22px 16px !important;
      }
      .ritual-bag-drawer {
        width: 100vw !important;
        max-width: 380px !important;
      }
    }
  `}</style>
);

const EmpowermentContainer = ({ children }) => (
  <div style={{ margin: '0 auto', maxWidth: '1000px', padding: '60px 40px', textAlign: 'center', position: 'relative', transition: 'all 0.5s ease' }}>
    {children}
  </div>
);

const EmpowermentButton = ({ text, onClick }) => (
  <button style={{
    backgroundColor: '#F2D4D7', color: '#5C5454', border: '1px solid #E8C5C8',
    padding: '12px 50px', fontSize: '32px', fontFamily: "'Alex Brush', cursive", fontWeight: '400',
    cursor: 'pointer', transition: 'all 0.5s ease', borderRadius: '30px', boxShadow: '0 4px 15px rgba(232, 197, 200, 0.3)',
  }}
  onClick={onClick}
  onMouseOver={(e) => { e.target.style.backgroundColor = '#FFFFFF'; e.target.style.color = '#B38B8F'; e.target.style.boxShadow = '0 6px 20px rgba(232, 197, 200, 0.5)'; }}
  onMouseOut={(e) => { e.target.style.backgroundColor = '#F2D4D7'; e.target.style.color = '#5C5454'; e.target.style.boxShadow = '0 4px 15px rgba(232, 197, 200, 0.3)'; }}
  >
    {text}
  </button>
);

const QuizOptionButton = ({ text, onClick }) => (
  <button style={{
    display: 'block', width: '100%', maxWidth: '450px', margin: '12px auto',
    backgroundColor: 'rgba(255, 255, 255, 0.7)', color: '#5C5454', border: '1px solid #E8C5C8',
    padding: '16px 25px', fontSize: '1.2rem', fontFamily: "'Cormorant Garamond', serif",
    cursor: 'pointer', transition: 'all 0.3s ease', borderRadius: '15px', letterSpacing: '1px'
  }}
  onClick={onClick}
  onMouseOver={(e) => { e.target.style.backgroundColor = '#F2D4D7'; e.target.style.borderColor = '#B38B8F'; e.target.style.transform = 'translateY(-2px)'; }}
  onMouseOut={(e) => { e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.7)'; e.target.style.borderColor = '#E8C5C8'; e.target.style.transform = 'translateY(0)'; }}
  >
    {text}
  </button>
);

const ProgressDots = ({ currentStep, totalSteps }) => (
  <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '35px' }}>
    {Array.from({ length: totalSteps }).map((_, index) => (
      <div key={index} style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: index < currentStep ? '#B38B8F' : '#F2D4D7', transition: 'background-color 0.5s ease' }} />
    ))}
  </div>
);

const EmpowermentLoader = ({ text }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '40px 0' }}>
    <div style={{ animation: 'spinSlow 4s linear infinite', width: '60px', height: '60px' }}>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#E8C5C8" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" strokeDasharray="4 4" />
        <path d="M12 2a10 10 0 0 1 10 10" stroke="#B38B8F" strokeWidth="1.5" />
        <circle cx="12" cy="2" r="2" fill="#FFFFFF" stroke="#B38B8F"/>
      </svg>
    </div>
    <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.3rem', color: '#8A797A', marginTop: '20px', fontStyle: 'italic', animation: 'pulseSoft 2s infinite' }}>
      {text || "Curating your personalized routine..."}
    </p>
  </div>
);

const BlueprintCard = ({ label, value }) => (
  <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', border: '1px solid #E8C5C8', borderRadius: '15px', padding: '20px', boxShadow: '0 4px 15px rgba(232, 197, 200, 0.15)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
    <p style={{ margin: '0 0 5px 0', fontSize: '1.1rem', color: '#A89999', fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic' }}>{label}</p>
    <p style={{ margin: 0, fontSize: '1.4rem', color: '#5C5454', fontFamily: "'Cormorant Garamond', serif", fontWeight: 'bold' }}>{value}</p>
  </div>
);

// ---------------- BLUEPRINT PHASE 2: PRODUCT METADATA & LIVE COMPATIBILITY ENGINE ---------------- //

const BLUEPRINT_SKIN_TYPE_OPTIONS = ['Normal', 'Dry', 'Oily', 'Combination', 'All Skin Types'];
const BLUEPRINT_CONCERN_OPTIONS = [
  'Hydration',
  'Anti-Aging',
  'Acne/Texture',
  'Brightening',
  'Barrier & Soothing',
  'Luminous Makeup'
];
const BLUEPRINT_RITUAL_STEP_OPTIONS = [
  'Step 1: Cleanser',
  'Step 2: Toner & Mist',
  'Step 3: Serum & Essence',
  'Step 4: Moisturizer & Cream',
  'Step 5: Eye, Lip & SPF',
  'Makeup & Artistry',
  'Beauty Tool & Spa'
];

const parseBlueprintList = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(v => String(v || '').trim()).filter(Boolean);
  return String(val).split(',').map(v => v.trim()).filter(Boolean);
};

// Guarantees every product has structured skinTypes, skinConcerns, ritualStep, sensitivitySafe, sensitivityLabel, and keyActives
const deriveProductBlueprintMeta = (product = {}) => {
  const cleanTitle = String(product?.title || '').trim();
  const cleanCat = String(product?.rawCjData?.categoryName || '').trim();
  const rawDesc = product?.description || product?.rawCjData?.description || '';
  const cleanDesc = typeof rawDesc === 'string' ? rawDesc.replace(/<[^>]*>?/gm, ' ').slice(0, 800) : '';
  const tagList = parseBlueprintList(product?.tags);
  const corpus = `${cleanTitle} ${cleanCat} ${cleanDesc} ${tagList.join(' ')}`.toLowerCase();

  // 1. Ritual Step
  let ritualStep = String(product?.ritualStep || product?.essentialSlotLabel || '').trim();
  if (!ritualStep) {
    if (/\b(foundation|concealer|primer|blush|blusher|bronzer|highlighter|illuminator|contour|palette|setting powder|loose powder|pressed powder|compact powder|setting spray|makeup fixer|eyeshadow|eye shadow|eyeliner|eye liner|mascara|eyebrow|brow|false lashes|eyelash|lipstick|lip gloss|lipgloss|lip liner|lip tint|lip stain|lip clay|lip glaze|bb cream|cc cream|makeup|cosmetic)\b/i.test(corpus)) {
      ritualStep = 'Makeup & Artistry';
    } else if (/\b(gua sha|jade roller|quartz roller|ice roller|derma roller|microneedle|led mask|light therapy|facial steamer|nano mister|ultrasonic|massager|makeup brush|brush set|kabuki|beauty sponge|makeup sponge|blender sponge|powder puff|lash curler|nail|manicure|pedicure|shampoo|conditioner|hair oil|hair mask|hair serum|scalp|perfume|fragrance|parfum|cologne|body mist|bath bomb|bath salt)\b/i.test(corpus)) {
      ritualStep = 'Beauty Tool & Spa';
    } else if (/\b(cleanser|cleansing|face wash|facial wash|micellar|makeup remover|exfoliant|exfoliating|scrub|peel|peeling|blackhead remover|foam wash)\b/i.test(corpus)) {
      ritualStep = 'Step 1: Cleanser';
    } else if (/\b(toner|facial mist|face mist|rosewater|hydrosol|essence water|toning|refining water|balancing water)\b/i.test(corpus)) {
      ritualStep = 'Step 2: Toner & Mist';
    } else if (/\b(eye cream|eye patch|eye patches|eye mask|eye serum|eye gel|under eye|lip balm|lip mask|lip oil|lip scrub|lip plumper|lip sleeping|sunscreen|sunblock|spf|uv protection)\b/i.test(corpus)) {
      ritualStep = 'Step 5: Eye, Lip & SPF';
    } else if (/\b(moisturizer|moisturizing|face cream|night cream|day cream|neck cream|barrier cream|lotion|body lotion|body butter|body cream|emulsion|gel cream|balm|sleeping mask|ointment)\b/i.test(corpus)) {
      ritualStep = 'Step 4: Moisturizer & Cream';
    } else {
      ritualStep = 'Step 3: Serum & Essence';
    }
  }

  // 2. Skin Concerns / Conditions
  let skinConcerns = parseBlueprintList(product?.skinConcerns);
  const addConcern = (c) => {
    if (c && !skinConcerns.includes(c)) skinConcerns.push(c);
  };
  if (skinConcerns.length === 0) {
    if (/\b(hydrat|hyaluronic|moisture|moisturiz|dry|plump|dewy|water|squalane|glycerin|aloe|snail|mucin|hydrogel|lotion|cream|balm|mist|lip oil|lip balm)\b/i.test(corpus)) {
      addConcern('Hydration');
    }
    if (/\b(anti-aging|anti aging|anti-wrinkle|wrinkle|fine line|firming|lifting|retinol|retinoid|peptide|collagen|elasticity|youth|age-defying|bakuchiol|eye cream|neck|gua sha|jade roller|led mask|massager)\b/i.test(corpus)) {
      addConcern('Anti-Aging');
    }
    if (/\b(acne|blemish|pimple|pore|blackhead|salicylic|bha|aha|pha|glycolic|lactic|exfoliat|scrub|peel|clay|mud|charcoal|tea tree|niacinamide|nicotinamide|oil control|mattif|sebum|purifying|cleanser|scrubber)\b/i.test(corpus)) {
      addConcern('Acne/Texture');
    }
    if (/\b(brighten|whitening|vitamin c|ascorbic|dark spot|hyperpigmentation|even tone|glow|radiance|radiant|luminous|kojic|turmeric|arbutin|pearl|illuminat|niacinamide)\b/i.test(corpus)) {
      addConcern('Brightening');
    }
    if (/\b(sensitive|soothing|calming|barrier|ceramide|centella|cica|aloe|chamomile|rose|panthenol|allantoin|redness|repair|gentle|fragrance-free|micellar|oat)\b/i.test(corpus)) {
      addConcern('Barrier & Soothing');
    }
    if (ritualStep === 'Makeup & Artistry' || /\b(makeup|cosmetic|foundation|concealer|blush|highlighter|lipstick|lip gloss|eyeshadow|mascara|eyeliner|brow|contour|powder|palette)\b/i.test(corpus)) {
      addConcern('Luminous Makeup');
    }
    if (skinConcerns.length === 0) {
      if (ritualStep === 'Step 1: Cleanser') {
        addConcern('Acne/Texture');
        addConcern('Barrier & Soothing');
      } else if (ritualStep === 'Step 2: Toner & Mist' || ritualStep === 'Step 4: Moisturizer & Cream') {
        addConcern('Hydration');
        addConcern('Barrier & Soothing');
      } else if (ritualStep === 'Step 5: Eye, Lip & SPF' || ritualStep === 'Beauty Tool & Spa') {
        addConcern('Hydration');
        addConcern('Anti-Aging');
      } else {
        addConcern('Hydration');
        addConcern('Brightening');
      }
    }
  }

  // 3. Best-Fit Skin Types
  let skinTypes = parseBlueprintList(product?.skinTypes);
  const addSkinType = (st) => {
    if (st && !skinTypes.includes(st)) skinTypes.push(st);
  };
  if (skinTypes.length === 0) {
    if (/\b(dry skin|thirsty|dehydrated|rich cream|nourishing|hydrating|hyaluronic|ceramide|squalane|shea|argan|balm|facial oil|sleeping mask|moisture|night cream|lip oil|lip balm)\b/i.test(corpus) || skinConcerns.includes('Hydration')) {
      addSkinType('Dry');
    }
    if (/\b(oily skin|oil control|mattifying|matte|sebum|salicylic|bha|clay|mud|charcoal|pore|blackhead|tea tree|acne|blemish|pimple|foaming|gel cleanser|lightweight|water gel|setting powder|loose powder)\b/i.test(corpus) || skinConcerns.includes('Acne/Texture')) {
      addSkinType('Oily');
    }
    if (/\b(combination skin|balancing|niacinamide|toner|mist|serum|essence|gel cream|lotion|sheet mask|micellar|vitamin c|cleanser)\b/i.test(corpus) || (skinTypes.includes('Dry') && skinTypes.includes('Oily'))) {
      addSkinType('Combination');
    }
    if (/\b(normal skin|all skin|daily|gentle|balanced|vitamin c|peptide|collagen|brightening|eye|lip|sunscreen|spf)\b/i.test(corpus) || skinConcerns.includes('Brightening') || skinConcerns.includes('Anti-Aging')) {
      addSkinType('Normal');
    }
    if (
      ritualStep === 'Makeup & Artistry' ||
      ritualStep === 'Beauty Tool & Spa' ||
      ritualStep === 'Step 5: Eye, Lip & SPF' ||
      skinTypes.length === 0 ||
      skinTypes.length >= 3
    ) {
      if (skinTypes.length === 0) {
        addSkinType('Normal');
        addSkinType('Dry');
        addSkinType('Combination');
        addSkinType('Oily');
      }
      addSkinType('All Skin Types');
    } else if (skinTypes.length === 1) {
      if (skinTypes[0] === 'Dry') addSkinType('Normal');
      else if (skinTypes[0] === 'Oily') addSkinType('Combination');
      else if (skinTypes[0] === 'Combination') addSkinType('Normal');
      else if (skinTypes[0] === 'Normal') addSkinType('All Skin Types');
    }
  }

  // 4. Sensitivity Profile
  const hasPotentActives = /\b(retinol|retinoid|aha|bha|pha|glycolic|salicylic|lactic acid|peel|peeling|scrub|exfoliant|exfoliating|microneedle|derma roller)\b/i.test(corpus);
  const sensitivitySafe = product?.sensitivitySafe !== undefined
    ? Boolean(product.sensitivitySafe)
    : !hasPotentActives;
  const sensitivityLabel = (product?.sensitivityLabel && String(product.sensitivityLabel).trim())
    ? String(product.sensitivityLabel).trim()
    : (sensitivitySafe
        ? 'Gentle • High-Sensitivity Safe'
        : 'Active Formula • Best for Low/Moderate Sensitivity');

  // 5. Key Actives
  let keyActives = parseBlueprintList(product?.keyActives);
  const addActive = (act) => {
    if (act && !keyActives.includes(act) && keyActives.length < 4) keyActives.push(act);
  };
  if (keyActives.length === 0) {
    const activeRules = [
      { regex: /\b(hyaluronic|sodium hyaluronate)\b/i, name: 'Hyaluronic Acid' },
      { regex: /\b(ceramide)\b/i, name: 'Barrier Ceramides' },
      { regex: /\b(niacinamide|nicotinamide|vitamin b3)\b/i, name: 'Niacinamide (B3)' },
      { regex: /\b(vitamin c|ascorbic)\b/i, name: 'Vitamin C Complex' },
      { regex: /\b(peptide|matrixyl|argireline)\b/i, name: 'Firming Peptides' },
      { regex: /\b(collagen)\b/i, name: 'Hydrolyzed Collagen' },
      { regex: /\b(retinol|retinoid|bakuchiol)\b/i, name: 'Retinol / Cellular Renewal' },
      { regex: /\b(salicylic|bha|tea tree)\b/i, name: 'Clarifying BHA / Tea Tree' },
      { regex: /\b(glycolic|lactic|aha|pha|exfoli)\b/i, name: 'Smoothing AHA Complex' },
      { regex: /\b(centella|cica|aloe|chamomile|calendula|green tea)\b/i, name: 'Soothing Botanical Cica' },
      { regex: /\b(squalane|argan|rosehip|jojoba|shea|vitamin e)\b/i, name: 'Nourishing Lipid Oils' },
      { regex: /\b(snail|mucin)\b/i, name: 'Snail Mucin Filtrate' },
      { regex: /\b(rose|rosewater)\b/i, name: 'Botanical Rosewater' },
      { regex: /\b(clay|kaolin|bentonite|charcoal|mud)\b/i, name: 'Purifying Mineral Clay' },
      { regex: /\b(spf|sunscreen|uv|zinc|titanium)\b/i, name: 'Broad-Spectrum UV Shield' }
    ];
    for (const rule of activeRules) {
      if (rule.regex.test(corpus)) addActive(rule.name);
    }
    if (keyActives.length === 0) {
      if (ritualStep === 'Makeup & Artistry') {
        addActive('Luminous Mineral Pigments');
        addActive('Weightless Breathable Wear');
      } else if (ritualStep === 'Beauty Tool & Spa') {
        addActive('Lymphatic Micro-Circulation');
        addActive('Artisan Spa Craft');
      } else {
        addActive('Hydrating Botanical Complex');
        addActive('pH-Balanced Conditioning');
      }
    }
  }

  return {
    skinTypes,
    skinConcerns,
    ritualStep,
    sensitivitySafe,
    sensitivityLabel,
    keyActives
  };
};

// Cross-references any product with the member's Blueprint quizAnswers (live or from localStorage fallback)
const evaluateBlueprintMatch = (product = {}, quizAnswers = null, hasCompletedQuiz = null) => {
  const meta = deriveProductBlueprintMeta(product);

  let activeAnswers = quizAnswers;
  let activeCompleted = hasCompletedQuiz;

  if (!activeAnswers || typeof activeAnswers !== 'object' || !activeAnswers.skinType) {
    try {
      const stored = localStorage.getItem('quizAnswers');
      if (stored) activeAnswers = JSON.parse(stored);
    } catch (e) {}
  }
  if (activeCompleted === null || activeCompleted === undefined) {
    try {
      activeCompleted = localStorage.getItem('hasCompletedQuiz') === 'true';
    } catch (e) {
      activeCompleted = false;
    }
  }

  const userSkinType = String(activeAnswers?.skinType || '').trim();
  const userGoal = String(activeAnswers?.primaryGoal || '').trim();
  const userClimate = String(activeAnswers?.climate || '').trim();
  const userSensitivity = String(activeAnswers?.skinSensitivity || '').trim();
  const userVibe = String(activeAnswers?.makeupVibe || '').trim();

  const hasValidBlueprint = Boolean(activeCompleted && (userSkinType || userGoal));

  if (!hasValidBlueprint) {
    return {
      ...meta,
      hasValidBlueprint: false,
      isMatch: false,
      matchScore: 0,
      matchedTraits: [],
      cautionNote: '',
      matchesSkinTypePill: () => false,
      matchesConcernPill: () => false
    };
  }

  const matchedTraits = [];
  let score = 52;

  const exactSkinMatch = Boolean(
    userSkinType && meta.skinTypes.some(st => st.toLowerCase() === userSkinType.toLowerCase())
  );
  const universalSkinMatch = meta.skinTypes.some(st => st.toLowerCase() === 'all skin types');

  if (exactSkinMatch) {
    score += 22;
    matchedTraits.push(`✓ Ideal for ${userSkinType} Skin`);
  } else if (universalSkinMatch) {
    score += 14;
    matchedTraits.push(`✓ Balanced for ${userSkinType} & All Skin Types`);
  }

  const exactGoalMatch = Boolean(
    userGoal && meta.skinConcerns.some(sc => sc.toLowerCase() === userGoal.toLowerCase())
  );
  if (exactGoalMatch) {
    score += 24;
    matchedTraits.push(`✓ Targets ${userGoal}`);
  }

  const needsBarrierCare =
    userSensitivity === 'High' ||
    userSensitivity === 'Moderate' ||
    userClimate === 'Dry' ||
    userClimate === 'Cold';
  const hasBarrierConcern = meta.skinConcerns.some(sc => sc.toLowerCase() === 'barrier & soothing');
  if (needsBarrierCare && hasBarrierConcern) {
    score += 10;
    matchedTraits.push(`✓ Calms ${userSensitivity || 'Sensitive'} Barrier (${userClimate || 'Daily'} Climate)`);
  }

  const needsClimateHydration =
    (userClimate === 'Dry' || userClimate === 'Cold' || userSkinType === 'Dry') &&
    userGoal !== 'Hydration';
  const hasHydrationConcern = meta.skinConcerns.some(sc => sc.toLowerCase() === 'hydration');
  if (needsClimateHydration && hasHydrationConcern) {
    score += 8;
    matchedTraits.push(`✓ Counters ${userClimate || 'Dry'} Climate Dehydration`);
  }

  if (meta.ritualStep === 'Makeup & Artistry' && userVibe) {
    score += 15;
    matchedTraits.push(`✓ Complements ${userVibe} Aesthetic`);
  }

  let cautionNote = '';
  if (userSensitivity === 'High') {
    if (meta.sensitivitySafe) {
      score += 8;
      matchedTraits.push('✓ Gentle • High-Sensitivity Safe');
    } else {
      score -= 22;
      cautionNote = 'Contains potent resurfacing or active ingredients — patch test and buffer with a barrier cream for High-Sensitivity skin.';
    }
  } else if (meta.sensitivitySafe) {
    score += 4;
  }

  const clampedScore = Math.max(45, Math.min(99, score));
  const isMatch =
    !cautionNote &&
    (exactGoalMatch ||
      (exactSkinMatch && (hasBarrierConcern || hasHydrationConcern)) ||
      (meta.ritualStep === 'Makeup & Artistry' && Boolean(userVibe)) ||
      clampedScore >= 82);

  const matchesSkinTypePill = (pillText = '') => {
    const clean = String(pillText || '').toLowerCase().trim();
    if (!userSkinType) return false;
    return clean === userSkinType.toLowerCase() || (exactSkinMatch === false && clean === 'all skin types');
  };

  const matchesConcernPill = (pillText = '') => {
    const clean = String(pillText || '').toLowerCase().trim();
    if (userGoal && clean === userGoal.toLowerCase()) return true;
    if (needsBarrierCare && clean === 'barrier & soothing') return true;
    if (needsClimateHydration && clean === 'hydration') return true;
    if (userVibe && clean === 'luminous makeup') return true;
    return false;
  };

  return {
    ...meta,
    hasValidBlueprint: true,
    userSkinType,
    userGoal,
    userClimate,
    userSensitivity,
    userVibe,
    isMatch,
    matchScore: clampedScore,
    matchedTraits,
    cautionNote,
    matchesSkinTypePill,
    matchesConcernPill
  };
};

// ---------------- BLUEPRINT PHASE 3: CLIENT-SIDE DIAGNOSTIC DOSSIER GENERATOR ---------------- //

const generateClientBlueprintDossier = (bp = {}, serverAnalysis = null) => {
  if (
    serverAnalysis &&
    typeof serverAnalysis === 'object' &&
    serverAnalysis.archetypeTitle &&
    Array.isArray(serverAnalysis.amRitual) &&
    serverAnalysis.amRitual.length > 0
  ) {
    return serverAnalysis;
  }

  const skinType = String(bp?.skinType || 'Normal').trim();
  const primaryGoal = String(bp?.primaryGoal || 'Hydration').trim();
  const climate = String(bp?.climate || 'Temperate').trim();
  const skinSensitivity = String(bp?.skinSensitivity || 'Moderate').trim();
  const complexion = String(bp?.complexion || 'Medium').trim();
  const undertone = String(bp?.undertone || 'Neutral').trim();
  const eyeColor = String(bp?.eyeColor || 'Brown').trim();
  const faceShape = String(bp?.faceShape || 'Oval').trim();
  const makeupVibe = String(bp?.makeupVibe || 'Soft Glam').trim();
  const routineFocus = String(bp?.routineFocus || 'Balanced').trim();

  const archetypeMap = {
    'Dry_Hydration': 'The Velvet Moisture Sanctuary',
    'Dry_Anti-Aging': 'The Cashmere Youth Elixir',
    'Dry_Brightening': 'The Dewy Rosewater Luminary',
    'Dry_Acne/Texture': 'The Silk Barrier Clarifier',
    'Oily_Acne/Texture': 'The Clarifying Satin Refiner',
    'Oily_Hydration': 'The Weightless Hydro-Balance Ritual',
    'Oily_Anti-Aging': 'The Sculpted Velvet Renewal',
    'Oily_Brightening': 'The Glass-Skin Radiance Edit',
    'Combination_Hydration': 'The Harmonious Dual-Zone Sanctuary',
    'Combination_Acne/Texture': 'The Balanced Pore & Texture Edit',
    'Combination_Anti-Aging': 'The Ageless Equilibrium Ritual',
    'Combination_Brightening': 'The Luminous Equilibrium Protocol',
    'Normal_Hydration': 'The Porcelain Dew Sanctuary',
    'Normal_Anti-Aging': 'The Timeless Cellular Radiance Ritual',
    'Normal_Brightening': 'The Golden Hour Luminosity Edit',
    'Normal_Acne/Texture': 'The Polished Silk Refinement'
  };

  const archetypeTitle =
    archetypeMap[`${skinType}_${primaryGoal}`] ||
    `The Bespoke ${skinType} & ${primaryGoal} Sanctuary`;

  const climateDescriptions = {
    'Dry': 'your arid, low-humidity environment continuously pulls moisture from the epidermis (transepidermal water loss), requiring humectants sealed beneath barrier lipids',
    'Humid': 'your humid climate amplifies surface sebum and sweat, calling for breathable, gel-serum hydration and non-comedogenic pore refinement',
    'Cold': 'your cold, harsh climate stresses the lipid barrier and triggers micro-chapping, requiring ceramide-rich cushioning and soothing protection',
    'Temperate': 'your temperate climate supports balanced cellular turnover when paired with consistent morning antioxidant protection and evening hydration'
  };

  const sensitivityDescriptions = {
    'High': 'Because your skin has High Sensitivity, every step prioritizes calming barrier protection (Gentle • High-Sensitivity Safe labels) over aggressive acids.',
    'Moderate': 'With Moderate Sensitivity, your skin thrives on buffered actives paired with soothing Centella, rosewater, and barrier-supporting ceramides.',
    'Low': 'Your resilient, Low-Sensitivity canvas tolerates both gentle daily hydrators and targeted resurfacing or cellular-renewal actives.'
  };

  const executiveSummary =
    `Your diagnostic profile reveals a ${skinType} skin temperament focused on ${primaryGoal}. ` +
    `Because ${climateDescriptions[climate] || climateDescriptions['Temperate']}, your ritual is architected to deliver ${primaryGoal.toLowerCase()} without overwhelming your natural barrier. ` +
    `${sensitivityDescriptions[skinSensitivity] || sensitivityDescriptions['Moderate']}`;

  const targetSkinTypes = [skinType, 'All Skin Types'];
  const targetSkinConcerns = [primaryGoal];
  if (skinSensitivity === 'High' || skinSensitivity === 'Moderate' || climate === 'Dry' || climate === 'Cold') {
    if (!targetSkinConcerns.includes('Barrier & Soothing')) targetSkinConcerns.push('Barrier & Soothing');
  }
  if ((skinType === 'Dry' || climate === 'Dry' || climate === 'Cold') && !targetSkinConcerns.includes('Hydration')) {
    targetSkinConcerns.push('Hydration');
  }
  if (!targetSkinConcerns.includes('Luminous Makeup')) {
    targetSkinConcerns.push('Luminous Makeup');
  }

  const sensitivityBadge =
    skinSensitivity === 'High'
      ? 'Gentle • High-Sensitivity Safe'
      : skinSensitivity === 'Moderate'
      ? 'Gentle • Barrier Balanced'
      : 'All Formulas & Actives Compatible';

  const allBadges = [
    {
      label: `${skinType} Skin`,
      category: 'Best for Skin Type',
      filterType: 'skinType',
      filterValue: skinType,
      description: `Formulated specifically for ${skinType.toLowerCase()} skin behavior.`
    },
    {
      label: primaryGoal,
      category: 'Primary Vision',
      filterType: 'skinConcern',
      filterValue: primaryGoal,
      description: `Directly targets your primary vision: ${primaryGoal}.`
    },
    ...(targetSkinConcerns.includes('Barrier & Soothing') && primaryGoal !== 'Barrier & Soothing'
      ? [{
          label: 'Barrier & Soothing',
          category: 'Sensitivity & Climate Care',
          filterType: 'skinConcern',
          filterValue: 'Barrier & Soothing',
          description: `Protects your ${skinSensitivity.toLowerCase()}-sensitivity skin in a ${climate.toLowerCase()} climate.`
        }]
      : []),
    ...(targetSkinConcerns.includes('Hydration') && primaryGoal !== 'Hydration'
      ? [{
          label: 'Hydration',
          category: 'Moisture Balance',
          filterType: 'skinConcern',
          filterValue: 'Hydration',
          description: `Prevents dehydration and tightness in ${climate.toLowerCase()} conditions.`
        }]
      : []),
    {
      label: sensitivityBadge,
      category: 'Sensitivity Profile',
      filterType: 'sensitivity',
      filterValue: skinSensitivity === 'High' ? 'safe' : 'all',
      description: skinSensitivity === 'High'
        ? 'Filters for products marked Gentle • High-Sensitivity Safe.'
        : 'Compatible with your skin reactivity threshold.'
    }
  ];

  const heroIngredients = [];
  const addHero = (name, benefit, targetConcern) => {
    if (!heroIngredients.some(h => h.name === name) && heroIngredients.length < 5) {
      heroIngredients.push({ name, benefit, targetConcern });
    }
  };

  if (primaryGoal === 'Hydration' || skinType === 'Dry' || climate === 'Dry') {
    addHero('Multi-Molecular Hyaluronic Acid', 'Draws moisture deep into thirsty skin layers for instant plumping and softness.', 'Hydration');
    addHero('Barrier Ceramides & Squalane', 'Seals the lipid barrier so arid air cannot strip away your natural hydration.', 'Barrier & Soothing');
  }
  if (primaryGoal === 'Anti-Aging') {
    addHero('Bio-Active Peptides & Collagen', 'Supports firmness, bounce, and smooths the appearance of fine expression lines.', 'Anti-Aging');
    addHero(
      skinSensitivity === 'High' ? 'Bakuchiol & Gentle Botanical Renewal' : 'Encapsulated Retinol / Retinoid Complex',
      skinSensitivity === 'High'
        ? 'Delivers retinol-like cellular renewal without redness or peeling for sensitive skin.'
        : 'Accelerates evening cellular turnover to refine wrinkles and elasticity.',
      'Anti-Aging'
    );
  }
  if (primaryGoal === 'Acne/Texture' || skinType === 'Oily' || skinType === 'Combination') {
    addHero('Niacinamide (Vitamin B3)', 'Balances sebum production, visibly tightens enlarged pores, and calms redness.', 'Acne/Texture');
    addHero(
      skinSensitivity === 'High' ? 'Purifying Kaolin Clay & Tea Tree Hydrosol' : 'Salicylic Acid (BHA) & Gentle AHA',
      skinSensitivity === 'High'
        ? 'Draws out congestion gently without stripping your delicate moisture barrier.'
        : 'Dissolves pore-clogging oil and smooths uneven surface texture.',
      'Acne/Texture'
    );
  }
  if (primaryGoal === 'Brightening') {
    addHero('Stabilized Vitamin C Complex', 'Neutralizes dullness, brightens dark spots, and boosts natural luminosity.', 'Brightening');
    addHero('Botanical Rosewater & Licorice Root', 'Evens out skin tone while keeping the complexion calm and dewy.', 'Brightening');
  }
  if (skinSensitivity === 'High' || skinSensitivity === 'Moderate' || heroIngredients.length < 4) {
    addHero('Centella Asiatica (Cica) & Aloe', 'Calms reactivity, reduces visible redness, and reinforces skin resilience.', 'Barrier & Soothing');
    addHero('Hydrolyzed Collagen & Vitamin E', 'Cushions the complexion against environmental stress and free radicals.', 'Hydration');
  }

  const avoidIngredients = [];
  if (skinSensitivity === 'High') {
    avoidIngredients.push(
      { name: 'High-Percentage Unbuffered Glycolic / Peel Acids', reason: 'Can compromise a high-sensitivity lipid barrier and trigger stinging or flushing.' },
      { name: 'Coarse Physical Nut/Shell Scrubs', reason: 'Creates micro-tears on reactive skin; opt for silky gel cleansers or enzyme care instead.' },
      { name: 'Drying Denatured Alcohol Toners', reason: 'Strips protective surface lipids and accelerates redness.' }
    );
  } else if (skinType === 'Dry' || climate === 'Dry' || climate === 'Cold') {
    avoidIngredients.push(
      { name: 'High-Sulfate Stripping Foam Cleansers', reason: 'Leaves dry or cold-exposed skin feeling tight and depleted.' },
      { name: 'Unsealed Clay Masks Used Daily', reason: 'Absorbs essential surface oils unless followed immediately by a rich hydrating serum.' },
      { name: 'Alcohol-Heavy Setting Sprays', reason: 'Can dehydrate your complexion canvas throughout the day.' }
    );
  } else if (skinType === 'Oily' || climate === 'Humid') {
    avoidIngredients.push(
      { name: 'Heavy Occlusive Petrolatum Balms (Daytime)', reason: 'Can trap heat and excess sebum in humid environments.' },
      { name: 'Pore-Congesting Coconut Oil Bases', reason: 'May congest T-zone pores on oily or combination temperaments.' },
      { name: 'Over-Exfoliating Multiple Times Daily', reason: 'Triggers rebound oil production when the barrier feels stripped.' }
    );
  } else {
    avoidIngredients.push(
      { name: 'Stacking Retinol + Strong Exfoliating Acids in the Same Night', reason: 'Can disrupt your balanced barrier; alternate renewal nights with hydration nights.' },
      { name: 'Harsh Alkaline Bar Soaps', reason: 'Disrupts your natural acid mantle pH.' },
      { name: 'Skipping Morning UV / Antioxidant Protection', reason: 'Allows daily environmental UV exposure to undo brightening and firming progress.' }
    );
  }

  const stepLimit = routineFocus === 'Minimalist' ? 3 : routineFocus === 'Balanced' ? 4 : 5;

  const fullAmSteps = [
    {
      stepNumber: 1,
      ritualStep: 'Step 1: Cleanser',
      title: skinType === 'Dry' || skinSensitivity === 'High' ? 'Gentle Barrier Awakening Cleanse' : 'Purifying Morning Refresh Cleanse',
      instruction: `Cleanse with lukewarm water to refresh your ${skinType.toLowerCase()} canvas without stripping essential morning lipids.`,
      lookForLabel: 'Step 1: Cleanser'
    },
    {
      stepNumber: 2,
      ritualStep: 'Step 2: Toner & Mist',
      title: 'pH-Balancing Botanical Prep Mist',
      instruction: `Mist or press into damp skin to prime your epidermis and counter ${climate.toLowerCase()}-climate dehydration.`,
      lookForLabel: 'Step 2: Toner & Mist'
    },
    {
      stepNumber: 3,
      ritualStep: 'Step 3: Serum & Essence',
      title: `Targeted ${primaryGoal} Day Serum`,
      instruction: `Press 2–3 drops of a ${primaryGoal.toLowerCase()} serum into face and neck to deliver concentrated daytime actives.`,
      lookForLabel: 'Step 3: Serum & Essence'
    },
    {
      stepNumber: 4,
      ritualStep: 'Step 4: Moisturizer & Cream',
      title: skinType === 'Oily' || climate === 'Humid' ? 'Weightless Hydro-Lock Emulsion' : 'Velvet Barrier-Sealing Day Cream',
      instruction: `Lock in your serum and cushion your ${skinSensitivity.toLowerCase()}-sensitivity barrier for smooth makeup prep.`,
      lookForLabel: 'Step 4: Moisturizer & Cream'
    },
    {
      stepNumber: 5,
      ritualStep: 'Step 5: Eye, Lip & SPF',
      title: 'Luminous Eye, Lip & UV Sanctuary Shield',
      instruction: 'Tap brightening care around the orbital bone, nourish lips, and seal with broad-spectrum UV protection.',
      lookForLabel: 'Step 5: Eye, Lip & SPF'
    }
  ];

  const fullPmSteps = [
    {
      stepNumber: 1,
      ritualStep: 'Step 1: Cleanser',
      title: 'Evening Melt & Pore Detox Cleanse',
      instruction: `Dissolve daily SPF, ${makeupVibe.toLowerCase()} makeup, and environmental impurities thoroughly yet gently.`,
      lookForLabel: 'Step 1: Cleanser'
    },
    {
      stepNumber: 2,
      ritualStep: 'Step 2: Toner & Mist',
      title: 'Soothing Hydration Drench',
      instruction: 'Replenish moisture immediately after cleansing so evening recovery actives absorb evenly.',
      lookForLabel: 'Step 2: Toner & Mist'
    },
    {
      stepNumber: 3,
      ritualStep: 'Step 3: Serum & Essence',
      title: `Overnight ${primaryGoal} & Cellular Repair Elixir`,
      instruction: `Apply your targeted ${primaryGoal.toLowerCase()} treatment while skin permeability peaks during sleep.`,
      lookForLabel: 'Step 3: Serum & Essence'
    },
    {
      stepNumber: 4,
      ritualStep: 'Step 4: Moisturizer & Cream',
      title: 'Restorative Night Sanctuary Cream',
      instruction: `Seal in overnight nutrients and prevent moisture loss in your ${climate.toLowerCase()} environment.`,
      lookForLabel: 'Step 4: Moisturizer & Cream'
    },
    {
      stepNumber: 5,
      ritualStep: 'Beauty Tool & Spa',
      title: 'Eye/Lip Sleeping Mask & Gua Sha Lymphatic Ritual',
      instruction: 'Finish with nourishing eye/lip care and 2 minutes of upward facial massage to release tension and sculpt.',
      lookForLabel: 'Beauty Tool & Spa'
    }
  ];

  const selectStepsByFocus = (steps) => {
    if (stepLimit === 3) {
      return [steps[0], steps[2], steps[3]].map((s, i) => ({ ...s, stepNumber: i + 1 }));
    }
    if (stepLimit === 4) {
      return [steps[0], steps[1], steps[2], steps[3]].map((s, i) => ({ ...s, stepNumber: i + 1 }));
    }
    return steps;
  };

  const undertoneHarmony = {
    'Cool': {
      base: `Choose ${complexion} foundations and concealers with rosy, pink, or cool-neutral undertones so your base never looks yellow or brassy.`,
      blushLip: 'Berry, rose-petal pink, cool mauve, cherry, and plum lip oils and blushes illuminate your natural cool undertone.'
    },
    'Warm': {
      base: `Select ${complexion} complexion products with golden, peach, or warm-honey undertones to harmonize with your natural warmth.`,
      blushLip: 'Warm terracotta, apricot, coral, honey-nude, and bronze-gold highlighters make your complexion glow effortlessly.'
    },
    'Neutral': {
      base: `Look for balanced ${complexion} neutral shades that bridge rose and golden pigments without pulling too pink or too orange.`,
      blushLip: 'Soft rosewood, dusty peach, champagne pearl, and berry-nude tones flatter your versatile neutral canvas.'
    }
  };

  const eyeHarmony = {
    'Brown': 'Rich bronze, champagne gold, warm plum, and espresso liners intensify the depth and warmth of your brown eyes.',
    'Blue': 'Warm copper, toasted terracotta, champagne-peach, and bronze eyeshadows create striking contrast that makes blue eyes pop.',
    'Green': 'Rose-gold, mulberry, garnet, and soft taupe shimmers spotlight the emerald and hazel flecks in your eyes.'
  };

  const faceShapeGuide = {
    'Oval': 'Your balanced oval silhouette shines with soft blush swept along the apples of the cheeks toward the temples and a touch of highlighter on the high cheekbones.',
    'Round': 'Create lifted dimension by sweeping bronzer slightly beneath the cheekbones toward the temples and focusing highlighter along the center bridge and brow bone.',
    'Square/Heart': 'Soften angles by diffusing blush in a rounded upward sweep on the cheeks and adding a luminous kiss of highlighter to the cheekbones and Cupid’s bow.'
  };

  const vibeGuide = {
    'Natural': 'Focus on skin-first "Barely There" luminosity: sheer hydrating tints, brushed-up brows, a swipe of nourishing lip oil, and dewy cream highlighter.',
    'Soft Glam': 'Build "Elevated Everyday Elegance": seamless satin-finish complexion, softly defined lash line, diffused rose/peach cheek drape, and a plush glossed lip.',
    'Full Glam': 'Embrace "Sculpted High-Impact Artistry": primed long-wear base, multi-dimensional eyeshadow placement, sculpted contour, and a statement defined lip.'
  };

  const selectedUndertone = undertoneHarmony[undertone] || undertoneHarmony['Neutral'];

  return {
    archetypeTitle,
    executiveSummary,
    recommendedLabels: {
      skinTypes: targetSkinTypes,
      skinConcerns: targetSkinConcerns,
      sensitivityBadge,
      climateContext: `${climate} Climate Care`,
      routineTier: `${routineFocus} (${stepLimit}-Step Ritual)`,
      allBadges
    },
    heroIngredients,
    avoidIngredients,
    amRitual: selectStepsByFocus(fullAmSteps),
    pmRitual: selectStepsByFocus(fullPmSteps),
    artistryProfile: {
      headline: `${complexion} Canvas • ${undertone} Undertone • ${makeupVibe} Artistry`,
      foundationAndBase: selectedUndertone.base,
      blushAndLipHarmony: selectedUndertone.blushLip,
      eyeEnhancement: eyeHarmony[eyeColor] || eyeHarmony['Brown'],
      sculptingPlacement: faceShapeGuide[faceShape] || faceShapeGuide['Oval'],
      signatureFinish: vibeGuide[makeupVibe] || vibeGuide['Soft Glam']
    }
  };
};

// Reusable Boutique Smart Filter Bar & Filtered Grid (shared by Member Boutique Tab & Public Boutique)
const BoutiqueSmartFilterSection = ({
  products = [],
  quizAnswers = {},
  hasCompletedQuiz = false,
  boutiqueFilters,
  setBoutiqueFilters,
  onResetFilters,
  onAddToCart,
  onCardClick,
  onGoToBlueprintTab
}) => {
  const {
    onlyBlueprintMatch = false,
    skinType = 'All',
    skinConcern = 'All',
    ritualStep = 'All',
    onlySensitiveSafe = false,
    searchQuery = ''
  } = boutiqueFilters || {};

  const boutiquePageContext = onGoToBlueprintTab ? 'Member Sanctuary: Boutique' : 'Public Boutique';

  // Debounced SEARCH_QUERY telemetry (600ms after user stops typing 2+ characters)
  useEffect(() => {
    const trimmed = String(searchQuery || '').trim();
    if (trimmed.length < 2) return;
    const timer = setTimeout(() => {
      trackSiteEvent('SEARCH_QUERY', {
        page: boutiquePageContext,
        searchQuery: trimmed
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [searchQuery, boutiquePageContext]);

  const applyAndTrackFilter = (updaterFn, filterType, filterValue) => {
    setBoutiqueFilters(updaterFn);
    if (filterType && filterValue && String(filterValue).toLowerCase() !== 'all') {
      trackSiteEvent('FILTER_USED', {
        page: boutiquePageContext,
        filterType,
        filterValue: String(filterValue)
      });
    }
  };

  const decoratedProducts = products.map(prod => ({
    product: prod,
    match: evaluateBlueprintMatch(prod, quizAnswers, hasCompletedQuiz)
  }));

  const blueprintMatchCount = decoratedProducts.filter(item => item.match.isMatch).length;

  const cleanSearch = String(searchQuery || '').trim().toLowerCase();

  const filteredList = decoratedProducts
    .filter(({ product, match }) => {
      if (onlyBlueprintMatch && hasCompletedQuiz && !match.isMatch) {
        return false;
      }
      if (skinType && skinType !== 'All') {
        const hasSt = match.skinTypes.some(
          st => st.toLowerCase() === skinType.toLowerCase() || st.toLowerCase() === 'all skin types'
        );
        if (!hasSt) return false;
      }
      if (skinConcern && skinConcern !== 'All') {
        const hasSc = match.skinConcerns.some(sc => sc.toLowerCase() === skinConcern.toLowerCase());
        if (!hasSc) return false;
      }
      if (ritualStep && ritualStep !== 'All') {
        if (String(match.ritualStep || '').toLowerCase() !== ritualStep.toLowerCase()) {
          return false;
        }
      }
      if (onlySensitiveSafe && !match.sensitivitySafe) {
        return false;
      }
      if (cleanSearch) {
        const haystack = [
          product.title || '',
          product.description || '',
          match.ritualStep || '',
          ...(match.skinTypes || []),
          ...(match.skinConcerns || []),
          ...(match.keyActives || []),
          ...(Array.isArray(product.tags) ? product.tags : [])
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(cleanSearch)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (hasCompletedQuiz) {
        return (Number(b.match.isMatch) - Number(a.match.isMatch)) || (b.match.matchScore - a.match.matchScore);
      }
      return 0;
    });

  const hasActiveFilter =
    onlyBlueprintMatch ||
    skinType !== 'All' ||
    skinConcern !== 'All' ||
    ritualStep !== 'All' ||
    onlySensitiveSafe ||
    Boolean(cleanSearch);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* ✨ My Blueprint Reference & Smart Filter Bar */}
      <div style={{
        backgroundColor: '#FFFFFF',
        border: '1.5px solid #B38B8F',
        borderRadius: '20px',
        padding: '22px 24px',
        boxShadow: '0 8px 25px rgba(232, 197, 200, 0.2)',
        textAlign: 'left'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '14px', borderBottom: '1px solid #E8C5C8', paddingBottom: '12px' }}>
          <div>
            <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.65rem', color: '#5C5454', margin: 0 }}>
              ✨ My Blueprint Reference & Smart Boutique Filter Bar
            </h3>
            <p style={{ margin: '3px 0 0 0', fontSize: '0.88rem', color: '#8A797A', fontFamily: 'sans-serif' }}>
              {hasCompletedQuiz
                ? 'Every product below is cross-referenced against your locked Beauty Blueprint. Click any pill to filter by Skin Type, Condition, or Ritual Step.'
                : 'Filter our curated boutique by Skin Type, Target Skin Condition, Sensitivity Safety, or Ritual Step.'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            {hasCompletedQuiz && (
              <button
                type="button"
                onClick={() =>
                  applyAndTrackFilter(
                    prev => ({
                      ...prev,
                      onlyBlueprintMatch: !prev.onlyBlueprintMatch
                    }),
                    'Blueprint Match',
                    !onlyBlueprintMatch ? 'Best Match for My Blueprint' : 'All'
                  )
                }
                style={{
                  background: onlyBlueprintMatch
                    ? 'linear-gradient(135deg, #B38B8F 0%, #D4A5A9 100%)'
                    : '#FFF0F2',
                  color: onlyBlueprintMatch ? '#FFFFFF' : '#5C5454',
                  border: '1.5px solid #B38B8F',
                  padding: '8px 16px',
                  borderRadius: '20px',
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: '1.05rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  boxShadow: onlyBlueprintMatch ? '0 4px 12px rgba(179, 139, 143, 0.35)' : 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                {onlyBlueprintMatch
                  ? `✓ Showing Best Match for My Blueprint (${blueprintMatchCount})`
                  : `✨ Best Match for My Blueprint (${blueprintMatchCount})`}
              </button>
            )}

            {hasActiveFilter && (
              <button
                type="button"
                onClick={onResetFilters}
                style={{
                  backgroundColor: '#FFFFFF',
                  color: '#736A6A',
                  border: '1px solid #E8C5C8',
                  padding: '8px 14px',
                  borderRadius: '20px',
                  fontFamily: 'sans-serif',
                  fontSize: '0.82rem',
                  cursor: 'pointer'
                }}
              >
                ↺ Reset All Filters
              </button>
            )}
          </div>
        </div>

        {/* Member's Core Blueprint Summary Badges */}
        {hasCompletedQuiz && quizAnswers?.skinType && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '8px',
            backgroundColor: '#FFF9F9',
            border: '1px solid #E8C5C8',
            borderRadius: '12px',
            padding: '10px 14px',
            marginBottom: '14px'
          }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#B38B8F', fontFamily: 'sans-serif' }}>
              🔒 Your Active Blueprint:
            </span>
            <button
              type="button"
              onClick={() =>
                setBoutiqueFilters(prev => ({
                  ...prev,
                  skinType: prev.skinType === quizAnswers.skinType ? 'All' : quizAnswers.skinType
                }))
              }
              style={{
                backgroundColor: skinType === quizAnswers.skinType ? '#F2D4D7' : '#FFFFFF',
                border: '1px solid #B38B8F',
                color: '#5C5454',
                borderRadius: '14px',
                padding: '4px 10px',
                fontSize: '0.78rem',
                fontFamily: 'sans-serif',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              💧 Skin: {quizAnswers.skinType}
            </button>
            <button
              type="button"
              onClick={() =>
                setBoutiqueFilters(prev => ({
                  ...prev,
                  skinConcern: prev.skinConcern === quizAnswers.primaryGoal ? 'All' : quizAnswers.primaryGoal
                }))
              }
              style={{
                backgroundColor: skinConcern === quizAnswers.primaryGoal ? '#F2D4D7' : '#FFFFFF',
                border: '1px solid #B38B8F',
                color: '#5C5454',
                borderRadius: '14px',
                padding: '4px 10px',
                fontSize: '0.78rem',
                fontFamily: 'sans-serif',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              🎯 Goal: {quizAnswers.primaryGoal}
            </button>
            <button
              type="button"
              onClick={() =>
                setBoutiqueFilters(prev => ({
                  ...prev,
                  onlySensitiveSafe: !prev.onlySensitiveSafe
                }))
              }
              style={{
                backgroundColor: onlySensitiveSafe ? '#F6FBF7' : '#FFFFFF',
                border: onlySensitiveSafe ? '1.5px solid #2E7D32' : '1px solid #E8C5C8',
                color: onlySensitiveSafe ? '#2E7D32' : '#5C5454',
                borderRadius: '14px',
                padding: '4px 10px',
                fontSize: '0.78rem',
                fontFamily: 'sans-serif',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              🛡️ Sensitivity: {quizAnswers.skinSensitivity} {onlySensitiveSafe ? '(Safe-Only ✓)' : ''}
            </button>
            <span style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E8C5C8',
              color: '#736A6A',
              borderRadius: '14px',
              padding: '4px 10px',
              fontSize: '0.78rem',
              fontFamily: 'sans-serif'
            }}>
              🌤️ Climate: {quizAnswers.climate}
            </span>
            <span style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E8C5C8',
              color: '#736A6A',
              borderRadius: '14px',
              padding: '4px 10px',
              fontSize: '0.78rem',
              fontFamily: 'sans-serif'
            }}>
              💄 Vibe: {quizAnswers.makeupVibe} ({quizAnswers.undertone} Undertone)
            </span>
            {onGoToBlueprintTab && (
              <button
                type="button"
                onClick={onGoToBlueprintTab}
                style={{
                  marginLeft: 'auto',
                  background: 'none',
                  border: 'none',
                  color: '#B38B8F',
                  fontSize: '0.8rem',
                  fontFamily: 'sans-serif',
                  fontWeight: 'bold',
                  textDecoration: 'underline',
                  cursor: 'pointer'
                }}
              >
                📝 View Full Dossier →
              </button>
            )}
          </div>
        )}

        {/* Search & Sensitivity Toggle Row */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
          <input
            type="text"
            placeholder="🔍 Search by product name, active ingredient (e.g. Hyaluronic, Vitamin C), or concern..."
            value={searchQuery}
            onChange={(e) => setBoutiqueFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
            style={{
              flex: '1 1 280px',
              padding: '10px 15px',
              borderRadius: '20px',
              border: '1px solid #E8C5C8',
              backgroundColor: '#FFF9F9',
              outline: 'none',
              fontFamily: 'sans-serif',
              fontSize: '0.9rem',
              color: '#5C5454'
            }}
          />

          <button
            type="button"
            onClick={() =>
              applyAndTrackFilter(
                prev => ({ ...prev, onlySensitiveSafe: !prev.onlySensitiveSafe }),
                'Sensitivity',
                !onlySensitiveSafe ? 'High-Sensitivity Safe Only' : 'All'
              )
            }
            style={{
              padding: '9px 15px',
              borderRadius: '20px',
              border: onlySensitiveSafe ? '1.5px solid #2E7D32' : '1px solid #E8C5C8',
              backgroundColor: onlySensitiveSafe ? '#F6FBF7' : '#FFF9F9',
              color: onlySensitiveSafe ? '#2E7D32' : '#5C5454',
              fontFamily: 'sans-serif',
              fontSize: '0.84rem',
              fontWeight: onlySensitiveSafe ? 'bold' : 'normal',
              cursor: 'pointer'
            }}
          >
            {onlySensitiveSafe ? '✓ 🛡️ Gentle • High-Sensitivity Safe Only' : '🛡️ Filter: High-Sensitivity Safe Only'}
          </button>
        </div>

        {/* Skin Type Filter Pills */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 'bold', color: '#8A797A', fontFamily: 'sans-serif', minWidth: '88px' }}>
            Skin Type:
          </span>
          {['All', ...BLUEPRINT_SKIN_TYPE_OPTIONS].map(st => {
            const active = skinType === st;
            const isUserTrait = hasCompletedQuiz && quizAnswers?.skinType && st.toLowerCase() === quizAnswers.skinType.toLowerCase();
            return (
              <button
                key={`filter-st-${st}`}
                type="button"
                onClick={() => applyAndTrackFilter(prev => ({ ...prev, skinType: st }), 'Skin Type', st)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '15px',
                  fontSize: '0.78rem',
                  fontFamily: 'sans-serif',
                  fontWeight: active || isUserTrait ? 'bold' : 'normal',
                  backgroundColor: active ? '#F2D4D7' : isUserTrait ? '#FFF0F2' : '#FFF9F9',
                  color: '#5C5454',
                  border: active ? '1.5px solid #B38B8F' : isUserTrait ? '1px dashed #B38B8F' : '1px solid #E8C5C8',
                  cursor: 'pointer'
                }}
              >
                {st === 'All' ? 'All Skin Types' : `${isUserTrait ? '★ ' : ''}${st}`}
              </button>
            );
          })}
        </div>

        {/* Skin Condition / Primary Goal Filter Pills */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 'bold', color: '#8A797A', fontFamily: 'sans-serif', minWidth: '88px' }}>
            Skin Condition:
          </span>
          {['All', ...BLUEPRINT_CONCERN_OPTIONS].map(sc => {
            const active = skinConcern === sc;
            const isUserGoal = hasCompletedQuiz && quizAnswers?.primaryGoal && sc.toLowerCase() === quizAnswers.primaryGoal.toLowerCase();
            return (
              <button
                key={`filter-sc-${sc}`}
                type="button"
                onClick={() => applyAndTrackFilter(prev => ({ ...prev, skinConcern: sc }), 'Skin Condition', sc)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '15px',
                  fontSize: '0.78rem',
                  fontFamily: 'sans-serif',
                  fontWeight: active || isUserGoal ? 'bold' : 'normal',
                  backgroundColor: active ? '#F2D4D7' : isUserGoal ? '#FFF0F2' : '#FFF9F9',
                  color: '#5C5454',
                  border: active ? '1.5px solid #B38B8F' : isUserGoal ? '1px dashed #B38B8F' : '1px solid #E8C5C8',
                  cursor: 'pointer'
                }}
              >
                {sc === 'All' ? 'All Conditions' : `${isUserGoal ? '★ ' : ''}${sc}`}
              </button>
            );
          })}
        </div>

        {/* Ritual Step Filter Pills */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 'bold', color: '#8A797A', fontFamily: 'sans-serif', minWidth: '88px' }}>
            Ritual Step:
          </span>
          {['All', ...BLUEPRINT_RITUAL_STEP_OPTIONS].map(stepOpt => {
            const active = ritualStep === stepOpt;
            return (
              <button
                key={`filter-step-${stepOpt}`}
                type="button"
                onClick={() => applyAndTrackFilter(prev => ({ ...prev, ritualStep: stepOpt }), 'Ritual Step', stepOpt)}
                style={{
                  padding: '5px 11px',
                  borderRadius: '15px',
                  fontSize: '0.76rem',
                  fontFamily: 'sans-serif',
                  fontWeight: active ? 'bold' : 'normal',
                  backgroundColor: active ? '#5C5454' : '#FFF9F9',
                  color: active ? '#FFFFFF' : '#5C5454',
                  border: active ? '1.5px solid #5C5454' : '1px solid #E8C5C8',
                  cursor: 'pointer'
                }}
              >
                {stepOpt === 'All' ? 'All Steps' : stepOpt}
              </button>
            );
          })}
        </div>
      </div>

      {/* Results Count Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', padding: '0 4px' }}>
        <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.2rem', color: '#5C5454', fontWeight: 'bold' }}>
          Showing {filteredList.length} of {products.length} Curated Boutique Essentials
          {onlyBlueprintMatch ? ' (Filtered to Your Blueprint Matches ✧)' : ''}
        </span>
        {hasActiveFilter && (
          <button
            type="button"
            onClick={onResetFilters}
            style={{ background: 'none', border: 'none', color: '#B38B8F', fontFamily: 'sans-serif', fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'underline' }}
          >
            Show All {products.length} Products
          </button>
        )}
      </div>

      {/* Product Grid */}
      {products.length === 0 ? (
        <p style={{ fontFamily: "'Cormorant Garamond', serif", color: '#736A6A', fontSize: '1.2rem', fontStyle: 'italic' }}>
          Fetching live boutique inventory...
        </p>
      ) : filteredList.length === 0 ? (
        <div style={{ padding: '40px 25px', textAlign: 'center', backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px dashed #E8C5C8' }}>
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.4rem', color: '#5C5454', margin: '0 0 12px 0' }}>
            No boutique products matched that exact filter combination.
          </p>
          <button
            type="button"
            onClick={onResetFilters}
            style={{ backgroundColor: '#F2D4D7', border: '1px solid #B38B8F', color: '#5C5454', padding: '10px 22px', borderRadius: '20px', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer' }}
          >
            Reset Boutique Filters ✧
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '20px' }}>
          {filteredList.map(({ product }) => (
            <ProductCard
              key={product._id || product.title}
              product={product}
              onAddToCart={onAddToCart}
              onCardClick={onCardClick}
              userBlueprint={quizAnswers}
              hasCompletedQuiz={hasCompletedQuiz}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const MembershipUpgradeModal = ({
  isOpen,
  onClose,
  featureContext = '',
  currentTier = 'basic',
  isUpgrading = false,
  onSelectUpgradeTier
}) => {
  if (!isOpen) return null;

  const cleanCurrentTier = String(currentTier || 'basic').toLowerCase().trim();

  return (
    <div
      onClick={() => !isUpgrading && onClose && onClose()}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(92, 84, 84, 0.62)',
        backdropFilter: 'blur(6px)',
        zIndex: 2500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        boxSizing: 'border-box',
        animation: 'fadeIn 0.28s ease'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: '#FFF9F9',
          border: '2px solid #B38B8F',
          borderRadius: '26px',
          padding: '34px 30px',
          maxWidth: '860px',
          width: '100%',
          maxHeight: '92vh',
          overflowY: 'auto',
          boxShadow: '0 22px 55px rgba(92, 84, 84, 0.38)',
          position: 'relative',
          textAlign: 'center',
          boxSizing: 'border-box'
        }}
      >
        <button
          type="button"
          disabled={isUpgrading}
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '20px',
            background: '#FFFFFF',
            border: '1px solid #E8C5C8',
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            fontSize: '1.1rem',
            cursor: 'pointer',
            color: '#8A797A'
          }}
        >
          ✕
        </button>

        <span
          style={{
            display: 'inline-block',
            backgroundColor: '#FFF0F2',
            color: '#B38B8F',
            border: '1px solid #B38B8F',
            borderRadius: '20px',
            padding: '5px 16px',
            fontSize: '0.8rem',
            fontWeight: 'bold',
            fontFamily: 'sans-serif',
            letterSpacing: '0.6px',
            textTransform: 'uppercase',
            marginBottom: '10px'
          }}
        >
          🔒 Exclusive Member Sanctuary Benefit
        </span>

        <h2
          style={{
            fontFamily: "'Alex Brush', cursive",
            fontSize: '3.4rem',
            color: '#B38B8F',
            fontWeight: '400',
            margin: '0 0 8px 0',
            lineHeight: '1.1'
          }}
        >
          Elevate Your Sanctuary Ritual
        </h2>

        <p
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: '1.3rem',
            color: '#5C5454',
            maxWidth: '640px',
            margin: '0 auto 24px auto',
            lineHeight: '1.55'
          }}
        >
          {featureContext ||
            "Free Sanctuary members can browse our curated Boutique and manage their account. Upgrade to a paid membership tier below to unlock Susan's Personalized Beauty Blueprint Quiz, AI Skin Photo Analysis, and 1-on-1 Video Consultations."}
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
            gap: '22px',
            textAlign: 'left',
            marginBottom: '18px'
          }}
        >
          {/* Tier 1: The Luminary Circle ($49/mo) */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              border: cleanCurrentTier === 'luminary' ? '2px solid #2E7D32' : '1.5px solid #E8C5C8',
              borderRadius: '20px',
              padding: '26px 24px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 8px 24px rgba(232, 197, 200, 0.18)',
              position: 'relative'
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.76rem', fontWeight: 'bold', color: '#8A797A', fontFamily: 'sans-serif', textTransform: 'uppercase' }}>
                  ✨ Essential Ritual Tier
                </span>
                {cleanCurrentTier === 'luminary' && (
                  <span style={{ backgroundColor: '#F6FBF7', color: '#2E7D32', border: '1px solid #A5D6A7', padding: '2px 9px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 'bold', fontFamily: 'sans-serif' }}>
                    Current Plan
                  </span>
                )}
              </div>
              <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2rem', color: '#5C5454', margin: '0 0 6px 0' }}>
                The Luminary Circle
              </h3>
              <p style={{ fontFamily: "'Alex Brush', cursive", fontSize: '2.2rem', color: '#B38B8F', margin: '0 0 16px 0' }}>
                $49 <span style={{ fontSize: '0.95rem', fontFamily: 'sans-serif', fontStyle: 'normal', color: '#8A797A' }}>/ month</span>
              </p>

              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 22px 0', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.15rem', color: '#5C5454', lineHeight: '1.85' }}>
                <li><span style={{ color: '#B38B8F', fontWeight: 'bold', marginRight: '8px' }}>✓</span> Full access to the 10-Step Beauty Blueprint Quiz</li>
                <li><span style={{ color: '#B38B8F', fontWeight: 'bold', marginRight: '8px' }}>✓</span> 3-Piece Monthly Curated Skincare Ritual Box</li>
                <li><span style={{ color: '#B38B8F', fontWeight: 'bold', marginRight: '8px' }}>✓</span> <strong>1 Consultation Every 3 Months (Quarterly)</strong></li>
                <li><span style={{ color: '#B38B8F', fontWeight: 'bold', marginRight: '8px' }}>✓</span> Automatic 10% Member Discount in the Boutique</li>
              </ul>
            </div>

            <button
              type="button"
              disabled={isUpgrading || cleanCurrentTier === 'luminary'}
              onClick={() => onSelectUpgradeTier && onSelectUpgradeTier('luminary')}
              style={{
                width: '100%',
                backgroundColor: cleanCurrentTier === 'luminary' ? '#F4F5F7' : '#F2D4D7',
                color: cleanCurrentTier === 'luminary' ? '#8A797A' : '#5C5454',
                border: '1px solid #B38B8F',
                padding: '13px 20px',
                borderRadius: '25px',
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: '1.2rem',
                fontWeight: 'bold',
                cursor: isUpgrading || cleanCurrentTier === 'luminary' ? 'not-allowed' : 'pointer',
                transition: 'all 0.25s ease'
              }}
            >
              {cleanCurrentTier === 'luminary'
                ? '✓ Your Current Tier'
                : isUpgrading
                ? 'Connecting to Stripe...'
                : 'Select Luminary ($49/mo) ✧'}
            </button>
          </div>

          {/* Tier 2: The Radiance Elite ($119/mo) */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              border: '2px solid #B38B8F',
              borderRadius: '20px',
              padding: '26px 24px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 12px 32px rgba(179, 139, 143, 0.28)',
              position: 'relative'
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: '-12px',
                right: '20px',
                background: 'linear-gradient(135deg, #B38B8F 0%, #D4A5A9 100%)',
                color: '#FFFFFF',
                padding: '4px 12px',
                borderRadius: '14px',
                fontSize: '0.73rem',
                fontFamily: 'sans-serif',
                fontWeight: 'bold',
                boxShadow: '0 4px 10px rgba(179, 139, 143, 0.35)'
              }}
            >
              💎 VIP ELITE • AI PHOTO ANALYSIS
            </span>

            <div>
              <span style={{ fontSize: '0.76rem', fontWeight: 'bold', color: '#B38B8F', fontFamily: 'sans-serif', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                🌟 Complete Luxury Sanctuary
              </span>
              <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2rem', color: '#B38B8F', margin: '0 0 6px 0', fontWeight: 'bold' }}>
                The Radiance Elite
              </h3>
              <p style={{ fontFamily: "'Alex Brush', cursive", fontSize: '2.2rem', color: '#5C5454', margin: '0 0 16px 0' }}>
                $119 <span style={{ fontSize: '0.95rem', fontFamily: 'sans-serif', fontStyle: 'normal', color: '#8A797A' }}>/ month</span>
              </p>

              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 22px 0', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.15rem', color: '#5C5454', lineHeight: '1.85' }}>
                <li><span style={{ color: '#B38B8F', fontWeight: 'bold', marginRight: '8px' }}>✦</span> Full 10-Step Beauty Blueprint Quiz Access</li>
                <li><span style={{ color: '#B38B8F', fontWeight: 'bold', marginRight: '8px' }}>✦</span> <strong>Exclusive AI Skin Photo Upload & Visual Analysis</strong></li>
                <li><span style={{ color: '#B38B8F', fontWeight: 'bold', marginRight: '8px' }}>✦</span> 5-Piece Premium Monthly Skincare Ritual Box</li>
                <li><span style={{ color: '#B38B8F', fontWeight: 'bold', marginRight: '8px' }}>✦</span> <strong>1 Consultation Every Month (Monthly 1-on-1)</strong></li>
                <li><span style={{ color: '#B38B8F', fontWeight: 'bold', marginRight: '8px' }}>✦</span> Automatic 25% VIP Discount Across the Boutique</li>
              </ul>
            </div>

            <button
              type="button"
              disabled={isUpgrading || cleanCurrentTier === 'radiance'}
              onClick={() => onSelectUpgradeTier && onSelectUpgradeTier('radiance')}
              style={{
                width: '100%',
                background: cleanCurrentTier === 'radiance'
                  ? '#F4F5F7'
                  : 'linear-gradient(135deg, #B38B8F 0%, #D4A5A9 100%)',
                color: cleanCurrentTier === 'radiance' ? '#8A797A' : '#FFFFFF',
                border: 'none',
                padding: '13px 20px',
                borderRadius: '25px',
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: '1.2rem',
                fontWeight: 'bold',
                cursor: isUpgrading || cleanCurrentTier === 'radiance' ? 'not-allowed' : 'pointer',
                boxShadow: '0 6px 18px rgba(179, 139, 143, 0.35)',
                transition: 'all 0.25s ease'
              }}
            >
              {cleanCurrentTier === 'radiance'
                ? '✓ Your Current Tier'
                : isUpgrading
                ? 'Connecting to Stripe...'
                : 'Upgrade to Radiance ($119/mo) ✧'}
            </button>
          </div>
        </div>

        <p style={{ margin: 0, fontSize: '0.82rem', color: '#8A797A', fontFamily: 'sans-serif' }}>
          🔒 Secure monthly subscription via Stripe • Cancel or switch tiers anytime from your Account Info tab.
        </p>
      </div>
    </div>
  );
};

const ProductDetailModal = ({ product, onClose, onAddToCart, userBlueprint, hasCompletedQuiz }) => {
  const [selectedVariantIdx, setSelectedVariantIdx] = useState(0);

  if (!product) return null;

  const title = product.title || 'Untitled Product';
  const hasVariants = product.variants && product.variants.length > 0;
  const activeVariant = hasVariants ? product.variants[selectedVariantIdx] : product;

  const displayImage = activeVariant?.imageUrl || product.imageUrl;
  const formattedImageUrl = displayImage && displayImage.startsWith('//')
    ? `https:${displayImage}`
    : displayImage;

  const itemPrice = activeVariant?.price || product.price || 0;

  const rawInfo = product.rawCjData?.description || product.description || '';
  const unformattedInfo = typeof rawInfo === 'string' ? rawInfo.replace(/<[^>]*>?/gm, '') : '';
  const shippingTime = product.rawCjData?.deliveryTime ? `${product.rawCjData.deliveryTime} hours` : '7-12 Days';

  const bpMatch = evaluateBlueprintMatch(product, userBlueprint, hasCompletedQuiz);

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      backgroundColor: 'rgba(92, 84, 84, 0.55)', backdropFilter: 'blur(3px)', zIndex: 1200,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      animation: 'fadeIn 0.3s ease', padding: '20px', boxSizing: 'border-box'
    }} onClick={onClose}>
      <div style={{
        backgroundColor: '#FFF9F9', border: bpMatch.isMatch ? '2px solid #B38B8F' : '1px solid #E8C5C8',
        borderRadius: '22px', padding: '28px', maxWidth: '560px', width: '100%',
        boxShadow: '0 12px 36px rgba(92, 84, 84, 0.32)', position: 'relative',
        maxHeight: '92vh', overflowY: 'auto', textAlign: 'left', boxSizing: 'border-box'
      }} onClick={(e) => e.stopPropagation()}>
        
        <button onClick={onClose} style={{ position: 'absolute', top: '15px', right: '20px', background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#8A797A', zIndex: 5 }}>✕</button>

        <div style={{ width: '100%', height: '240px', backgroundColor: '#FFF0F2', borderRadius: '14px', overflow: 'hidden', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', border: '1px solid #E8C5C8' }}>
          <img src={logo} alt="Susan's Logo" style={{ position: 'absolute', top: '10px', right: '10px', width: '35px', height: '35px', objectFit: 'contain', zIndex: 3, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }} />
          <span style={{
            position: 'absolute', top: '10px', left: '10px',
            backgroundColor: 'rgba(92, 84, 84, 0.88)', color: '#FFFFFF',
            padding: '5px 12px', borderRadius: '14px', fontSize: '0.78rem',
            fontFamily: "'Cormorant Garamond', serif", fontWeight: 'bold', letterSpacing: '0.5px', zIndex: 3
          }}>
            {product.essentialSlotLabel || bpMatch.ritualStep}
          </span>
          {bpMatch.isMatch && (
            <span style={{
              position: 'absolute', bottom: '10px', left: '10px',
              background: 'linear-gradient(135deg, #B38B8F 0%, #D4A5A9 100%)',
              color: '#FFFFFF', padding: '5px 13px', borderRadius: '14px',
              fontSize: '0.8rem', fontFamily: 'sans-serif', fontWeight: 'bold',
              boxShadow: '0 3px 10px rgba(179, 139, 143, 0.45)', zIndex: 3
            }}>
              ✨ Matches Your Blueprint ({bpMatch.matchScore}% Fit)
            </span>
          )}
          {formattedImageUrl ? (
            <img src={formattedImageUrl} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ color: '#B38B8F', fontStyle: 'italic' }}>Susan's Select SKU</span>
          )}
        </div>

        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.85rem', color: '#5C5454', margin: '0 0 6px 0', lineHeight: '1.25' }}>{title}</h2>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.6rem', color: '#B38B8F', fontWeight: 'bold', margin: 0 }}>
            ${parseFloat(itemPrice).toFixed(2)}
          </p>
          <p style={{ fontFamily: 'sans-serif', fontSize: '0.85rem', color: '#A89999', margin: 0, display: 'flex', alignItems: 'center', gap: '5px' }}>
            ✈️ Ships globally ({shippingTime})
          </p>
        </div>

        {/* Skin Type & Skin Condition Pill Rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px', padding: '12px 14px', backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E8C5C8' }}>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 'bold', color: '#8A797A', fontFamily: 'sans-serif', marginRight: '2px' }}>
              Best for:
            </span>
            {bpMatch.skinTypes.map((st, i) => {
              const isHighlighted = bpMatch.matchesSkinTypePill(st);
              return (
                <span
                  key={`modal-st-${i}`}
                  style={{
                    fontSize: '0.76rem',
                    fontFamily: 'sans-serif',
                    padding: '3px 9px',
                    borderRadius: '12px',
                    fontWeight: isHighlighted ? 'bold' : '600',
                    backgroundColor: isHighlighted ? '#F2D4D7' : '#FFF0F2',
                    color: isHighlighted ? '#5C5454' : '#736A6A',
                    border: isHighlighted ? '1.5px solid #B38B8F' : '1px solid #E8C5C8'
                  }}
                >
                  {isHighlighted ? `✓ ${st} Skin` : `${st} Skin`}
                </span>
              );
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 'bold', color: '#8A797A', fontFamily: 'sans-serif', marginRight: '2px' }}>
              Targets:
            </span>
            {bpMatch.skinConcerns.map((sc, i) => {
              const isHighlighted = bpMatch.matchesConcernPill(sc);
              return (
                <span
                  key={`modal-sc-${i}`}
                  style={{
                    fontSize: '0.76rem',
                    fontFamily: 'sans-serif',
                    padding: '3px 9px',
                    borderRadius: '12px',
                    fontWeight: isHighlighted ? 'bold' : '600',
                    backgroundColor: isHighlighted ? '#F2D4D7' : '#F6FBF7',
                    color: isHighlighted ? '#5C5454' : '#2E7D32',
                    border: isHighlighted ? '1.5px solid #B38B8F' : '1px solid #A5D6A7'
                  }}
                >
                  {isHighlighted ? `✨ ${sc}` : sc}
                </span>
              );
            })}
          </div>
        </div>

        {/* 📝 Blueprint Compatibility Check Box */}
        <div style={{
          marginBottom: '18px',
          padding: '15px 16px',
          borderRadius: '14px',
          backgroundColor: bpMatch.isMatch ? '#FFF0F2' : '#FFFFFF',
          border: bpMatch.isMatch ? '1.5px solid #B38B8F' : '1px solid #E8C5C8',
          boxShadow: '0 4px 12px rgba(232, 197, 200, 0.15)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
            <strong style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.2rem', color: '#5C5454' }}>
              📝 Blueprint Compatibility Check
            </strong>
            <span style={{
              fontSize: '0.75rem',
              fontFamily: 'sans-serif',
              fontWeight: 'bold',
              padding: '3px 9px',
              borderRadius: '10px',
              backgroundColor: bpMatch.sensitivitySafe ? '#F6FBF7' : '#FFF8E7',
              color: bpMatch.sensitivitySafe ? '#2E7D32' : '#B26A00',
              border: `1px solid ${bpMatch.sensitivitySafe ? '#A5D6A7' : '#FFE082'}`
            }}>
              {bpMatch.sensitivitySafe ? '🛡️ ' : '⚡ '}{bpMatch.sensitivityLabel}
            </span>
          </div>

          {bpMatch.hasValidBlueprint ? (
            <div>
              {bpMatch.matchedTraits.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: bpMatch.cautionNote ? '8px' : '10px' }}>
                  {bpMatch.matchedTraits.map((trait, idx) => (
                    <span
                      key={idx}
                      style={{
                        backgroundColor: '#FFFFFF',
                        color: '#5C5454',
                        border: '1px solid #B38B8F',
                        borderRadius: '10px',
                        padding: '4px 10px',
                        fontSize: '0.78rem',
                        fontFamily: 'sans-serif',
                        fontWeight: 'bold'
                      }}
                    >
                      {trait}
                    </span>
                  ))}
                </div>
              ) : (
                <p style={{ margin: '0 0 8px 0', fontSize: '0.84rem', color: '#736A6A', fontFamily: 'sans-serif' }}>
                  General boutique essential — formulated primarily for {bpMatch.skinTypes.join(', ')} skin and {bpMatch.skinConcerns.join(', ')}.
                </p>
              )}

              {bpMatch.cautionNote && (
                <div style={{ padding: '8px 10px', borderRadius: '8px', backgroundColor: '#FFF8E7', border: '1px solid #FFE082', color: '#B26A00', fontSize: '0.8rem', fontFamily: 'sans-serif', marginBottom: '8px' }}>
                  ⚠️ <strong>Sensitivity Note:</strong> {bpMatch.cautionNote}
                </div>
              )}
            </div>
          ) : (
            <p style={{ margin: '0 0 8px 0', fontSize: '0.83rem', color: '#8A797A', fontFamily: 'sans-serif', fontStyle: 'italic' }}>
              Complete your 10-step Beauty Blueprint Quiz in your Member Sanctuary to unlock live personalized compatibility scoring on every product.
            </p>
          )}

          {bpMatch.keyActives && bpMatch.keyActives.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px', borderTop: '1px dashed #E8C5C8', paddingTop: '8px', marginTop: '4px' }}>
              <span style={{ fontSize: '0.76rem', color: '#8A797A', fontFamily: 'sans-serif', fontWeight: 'bold' }}>
                Key Actives & Highlights:
              </span>
              {bpMatch.keyActives.map((act, idx) => (
                <span key={idx} style={{ fontSize: '0.74rem', fontFamily: 'sans-serif', backgroundColor: '#FFF9F9', color: '#B38B8F', border: '1px solid #E8C5C8', borderRadius: '8px', padding: '2px 8px', fontWeight: 'bold' }}>
                  ✦ {act}
                </span>
              ))}
            </div>
          )}
        </div>

        {unformattedInfo && (
          <p style={{ fontFamily: 'sans-serif', fontSize: '0.94rem', color: '#736A6A', lineHeight: '1.6', margin: '0 0 18px 0' }}>
            {unformattedInfo}
          </p>
        )}

        {hasVariants && product.variants.length > 1 && (
          <div style={{ marginBottom: '18px' }} onClick={(e) => e.stopPropagation()}>
            <label style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", color: '#8A797A', marginBottom: '5px' }}>Select Option:</label>
            <select 
              value={selectedVariantIdx} 
              onChange={(e) => setSelectedVariantIdx(Number(e.target.value))}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #E8C5C8', fontFamily: "'Cormorant Garamond', serif", color: '#5C5454', backgroundColor: '#FFF9F9', outline: 'none' }}
            >
              {product.variants.map((v, idx) => (
                <option key={v.sku || idx} value={idx}>
                  {v.variantName && v.variantName !== v.sku ? v.variantName : `Option ${idx + 1}`} - ${parseFloat(v.price).toFixed(2)}
                </option>
              ))}
            </select>
          </div>
        )}

        <button 
          onClick={() => {
            onAddToCart({
              ...product,
              sku: activeVariant?.sku || product.sku || product._id,
              price: itemPrice,
              selectedVariantName: activeVariant?.variantName,
              imageUrl: activeVariant?.imageUrl || product.imageUrl,
              title: title
            });
            onClose();
          }}
          style={{ backgroundColor: '#F2D4D7', border: '1px solid #B38B8F', color: '#5C5454', padding: '12px 20px', borderRadius: '25px', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', width: '100%', transition: 'all 0.3s ease' }}
        >
          Add to Ritual ✧
        </button>
      </div>
    </div>
  );
};

const ProductCard = ({ product, onAddToCart, onCardClick, userBlueprint, hasCompletedQuiz }) => {
  const [selectedVariantIdx, setSelectedVariantIdx] = useState(0);

  const hasVariants = product.variants && product.variants.length > 0;
  const activeVariant = hasVariants ? product.variants[selectedVariantIdx] : product;

  const displayImage = activeVariant?.imageUrl || product.imageUrl;
  const formattedImageUrl = displayImage && displayImage.startsWith('//') ? `https:${displayImage}` : displayImage;
  const title = product.title || 'Untitled Product';
  
  const itemPrice = activeVariant?.price || product.price || 0;

  const rawInfo = product.rawCjData?.description || product.description || '';
  const unformattedInfo = typeof rawInfo === 'string' ? rawInfo.replace(/<[^>]*>?/gm, '') : '';
  const shippingTime = product.rawCjData?.deliveryTime ? `${product.rawCjData.deliveryTime} hours` : '7-12 Days';

  const bpMatch = evaluateBlueprintMatch(product, userBlueprint, hasCompletedQuiz);
  const enrichedProduct = { ...product, title, activeVariant };

  return (
    <div 
      onClick={() => onCardClick && onCardClick(enrichedProduct)}
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        border: bpMatch.isMatch ? '1.5px solid #B38B8F' : '1px solid #E8C5C8',
        borderRadius: '16px',
        padding: '15px',
        textAlign: 'center',
        transition: 'transform 0.3s ease, box-shadow 0.3s ease',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        boxShadow: bpMatch.isMatch ? '0 6px 20px rgba(179, 139, 143, 0.25)' : '0 4px 15px rgba(232, 197, 200, 0.15)',
        height: '100%',
        cursor: 'pointer',
        position: 'relative',
        boxSizing: 'border-box'
      }}
      onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.boxShadow = '0 10px 26px rgba(179, 139, 143, 0.32)'; }}
      onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = bpMatch.isMatch ? '0 6px 20px rgba(179, 139, 143, 0.25)' : '0 4px 15px rgba(232, 197, 200, 0.15)'; }}
    >
      <div>
        <div style={{ width: '100%', height: '180px', backgroundColor: '#FFF0F2', borderRadius: '10px', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
          <img src={logo} alt="Susan's Logo" style={{ position: 'absolute', top: '8px', right: '8px', width: '30px', height: '30px', objectFit: 'contain', zIndex: 3, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }} />
          <span style={{
            position: 'absolute',
            top: '8px',
            left: '8px',
            backgroundColor: 'rgba(92, 84, 84, 0.86)',
            color: '#FFFFFF',
            padding: '4px 10px',
            borderRadius: '12px',
            fontSize: '0.72rem',
            fontFamily: "'Cormorant Garamond', serif",
            fontWeight: 'bold',
            letterSpacing: '0.4px',
            zIndex: 2
          }}>
            {product.essentialSlotLabel || bpMatch.ritualStep}
          </span>

          {bpMatch.isMatch && (
            <span style={{
              position: 'absolute',
              bottom: '8px',
              left: '8px',
              right: '8px',
              background: 'linear-gradient(135deg, rgba(179, 139, 143, 0.96) 0%, rgba(212, 165, 169, 0.96) 100%)',
              color: '#FFFFFF',
              padding: '4px 10px',
              borderRadius: '10px',
              fontSize: '0.73rem',
              fontFamily: 'sans-serif',
              fontWeight: 'bold',
              letterSpacing: '0.2px',
              boxShadow: '0 2px 8px rgba(92, 84, 84, 0.25)',
              zIndex: 2
            }}>
              ✨ Matches Your Blueprint ({bpMatch.matchScore}%)
            </span>
          )}

          {formattedImageUrl ? (
            <img src={formattedImageUrl} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display = 'none'; }} />
          ) : (
            <span style={{ color: '#B38B8F', fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic' }}>Susan's Select SKU</span>
          )}
        </div>

        <h4 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.15rem', color: '#5C5454', margin: '0 0 6px 0', minHeight: '42px', lineHeight: '1.28' }}>{title}</h4>
        
        <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.38rem', color: '#B38B8F', fontWeight: 'bold', margin: '0 0 4px 0' }}>
          ${parseFloat(itemPrice).toFixed(2)}
        </p>

        {/* Skin Type & Skin Condition Pill Badges */}
        <div style={{ textAlign: 'left', backgroundColor: '#FFF9F9', border: '1px solid #E8C5C8', borderRadius: '10px', padding: '8px 9px', marginBottom: '10px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
            <span style={{ fontSize: '0.7rem', color: '#8A797A', fontFamily: 'sans-serif', fontWeight: 'bold' }}>
              Best for:
            </span>
            {bpMatch.skinTypes.slice(0, 3).map((st, idx) => {
              const isMatchPill = bpMatch.matchesSkinTypePill(st);
              return (
                <span
                  key={`st-${idx}`}
                  style={{
                    fontSize: '0.69rem',
                    fontFamily: 'sans-serif',
                    padding: '2px 7px',
                    borderRadius: '9px',
                    fontWeight: isMatchPill ? 'bold' : 'normal',
                    backgroundColor: isMatchPill ? '#F2D4D7' : '#FFFFFF',
                    color: '#5C5454',
                    border: isMatchPill ? '1.5px solid #B38B8F' : '1px solid #E8C5C8'
                  }}
                >
                  {isMatchPill ? `✓ ${st}` : st}
                </span>
              );
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
            <span style={{ fontSize: '0.7rem', color: '#8A797A', fontFamily: 'sans-serif', fontWeight: 'bold' }}>
              Targets:
            </span>
            {bpMatch.skinConcerns.slice(0, 3).map((sc, idx) => {
              const isMatchPill = bpMatch.matchesConcernPill(sc);
              return (
                <span
                  key={`sc-${idx}`}
                  style={{
                    fontSize: '0.69rem',
                    fontFamily: 'sans-serif',
                    padding: '2px 7px',
                    borderRadius: '9px',
                    fontWeight: isMatchPill ? 'bold' : 'normal',
                    backgroundColor: isMatchPill ? '#F2D4D7' : '#F6FBF7',
                    color: isMatchPill ? '#5C5454' : '#2E7D32',
                    border: isMatchPill ? '1.5px solid #B38B8F' : '1px solid #A5D6A7'
                  }}
                >
                  {isMatchPill ? `✨ ${sc}` : sc}
                </span>
              );
            })}
          </div>
        </div>

        <p style={{ fontFamily: 'sans-serif', fontSize: '0.76rem', color: '#A89999', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
          ✈️ Ships globally ({shippingTime})
        </p>

        {unformattedInfo && (
          <div style={{ fontSize: '0.82rem', color: '#736A6A', marginBottom: '12px', textAlign: 'left', maxHeight: '48px', overflowY: 'auto', fontFamily: 'sans-serif' }}>
            {unformattedInfo}
          </div>
        )}

        {hasVariants && product.variants.length > 1 && (
          <div onClick={(e) => e.stopPropagation()}>
            <select 
              value={selectedVariantIdx} 
              onChange={(e) => setSelectedVariantIdx(Number(e.target.value))}
              style={{ width: '100%', padding: '8px', marginBottom: '12px', borderRadius: '8px', border: '1px solid #E8C5C8', fontFamily: "'Cormorant Garamond', serif", color: '#5C5454', backgroundColor: '#FFF9F9', outline: 'none' }}
            >
              {product.variants.map((v, idx) => (
                <option key={v.sku || idx} value={idx}>
                  {v.variantName && v.variantName !== v.sku ? v.variantName : `Option ${idx + 1}`} - ${parseFloat(v.price).toFixed(2)}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      <button 
        onClick={(e) => {
          e.stopPropagation();
          onAddToCart({
            ...product,
            sku: activeVariant?.sku || product.sku || product._id,
            price: itemPrice,
            selectedVariantName: activeVariant?.variantName,
            imageUrl: activeVariant?.imageUrl || product.imageUrl,
            title: title
          });
        }}
        style={{ backgroundColor: '#F2D4D7', border: '1px solid #B38B8F', color: '#5C5454', padding: '10px 15px', borderRadius: '20px', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.05rem', fontWeight: 'bold', cursor: 'pointer', width: '100%', marginTop: 'auto', transition: 'all 0.3s ease' }}
        onMouseOver={(e) => { e.target.style.backgroundColor = '#FFFFFF'; e.target.style.color = '#B38B8F'; }}
        onMouseOut={(e) => { e.target.style.backgroundColor = '#F2D4D7'; e.target.style.color = '#5C5454'; }}
      >
        Add to Ritual ✧
      </button>
    </div>
  );
};

const ElegantInput = ({ type, placeholder, name, value, onChange }) => (
  <input
    type={type} name={name} placeholder={placeholder} value={value} onChange={onChange}
    style={{ width: '100%', maxWidth: '380px', padding: '16px 25px', margin: '10px auto', display: 'block', backgroundColor: 'rgba(255, 255, 255, 0.8)', border: '1px solid #E8C5C8', borderRadius: '30px', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.2rem', color: '#5C5454', outline: 'none', boxSizing: 'border-box', transition: 'all 0.3s ease' }}
    onFocus={(e) => { e.target.style.backgroundColor = '#FFFFFF'; e.target.style.boxShadow = '0 0 10px rgba(232, 197, 200, 0.4)'; }}
    onBlur={(e) => { e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.8)'; e.target.style.boxShadow = 'none'; }}
  />
);

// ---------------- 6-PROVIDER SOCIAL OAUTH 2.0 BUTTON GRID & HANDSHAKE STUDIO ---------------- //

const SOCIAL_OAUTH_PROVIDERS_META = [
  {
    key: 'google',
    label: 'Google',
    accentColor: '#4285F4',
    envKeys: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']
  },
  {
    key: 'facebook',
    label: 'Facebook',
    accentColor: '#1877F2',
    envKeys: ['FACEBOOK_CLIENT_ID', 'FACEBOOK_CLIENT_SECRET']
  },
  {
    key: 'linkedin',
    label: 'LinkedIn',
    accentColor: '#0A66C2',
    envKeys: ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET']
  },
  {
    key: 'x',
    label: 'X',
    accentColor: '#111111',
    envKeys: ['X_CLIENT_ID', 'X_CLIENT_SECRET']
  },
  {
    key: 'tiktok',
    label: 'TikTok',
    accentColor: '#000000',
    envKeys: ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET']
  },
  {
    key: 'reddit',
    label: 'Reddit',
    accentColor: '#FF4500',
    envKeys: ['REDDIT_CLIENT_ID', 'REDDIT_CLIENT_SECRET']
  }
];

const SocialProviderBrandIcon = ({ provider, size = 18 }) => {
  const p = String(provider || '').toLowerCase();
  if (p === 'google') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.26-.96 2.33-2.04 3.05l3.3 2.56c1.92-1.77 3.04-4.38 3.04-7.51 0-.72-.06-1.42-.19-2H12z" />
        <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.43l-3.3-2.56c-.91.61-2.07.98-3.32.98-2.55 0-4.71-1.72-5.48-4.04H3.11v2.62C4.76 19.86 8.12 22 12 22z" />
        <path fill="#FBBC05" d="M6.52 13.95A5.98 5.98 0 0 1 6.2 12c0-.68.12-1.34.32-1.95V7.43H3.11A9.98 9.98 0 0 0 2 12c0 1.61.39 3.14 1.11 4.57l3.41-2.62z" />
        <path fill="#4285F4" d="M12 6.01c1.47 0 2.79.51 3.83 1.5l2.87-2.87C16.95 3.01 14.7 2 12 2 8.12 2 4.76 4.14 3.11 7.43l3.41 2.62C7.29 7.73 9.45 6.01 12 6.01z" />
      </svg>
    );
  }
  if (p === 'linkedin') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#0A66C2" d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
      </svg>
    );
  }
  if (p === 'facebook') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#1877F2" d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c5.05-.5 9-4.76 9-9.95z" />
      </svg>
    );
  }
  if (p === 'x') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#111111" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    );
  }
  if (p === 'tiktok') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#111111" d="M16.6 5.82s.51.5 0 0A4.278 4.278 0 0 1 15.54 3h-3.09v12.4a2.592 2.592 0 0 1-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6 0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64 0 3.33 2.76 5.7 5.69 5.7 3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3s-1.88.09-3.24-1.48z" />
      </svg>
    );
  }
  if (p === 'reddit') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="10" fill="#FF4500" />
        <path fill="#FFFFFF" d="M16.67 12.11a1.42 1.42 0 0 0-2.37-.99 6.88 6.88 0 0 0-3.83-1.08l.78-3.47 2.48.55a1.1 1.1 0 1 0 .23-.82l-2.82-.63a.42.42 0 0 0-.5.32l-.9 3.99a6.94 6.94 0 0 0-3.99 1.09 1.42 1.42 0 1 0-1.63 2.26c-.04.24-.06.49-.06.74 0 2.49 2.71 4.51 6.06 4.51s6.06-2.02 6.06-4.51c0-.25-.02-.49-.06-.73a1.42 1.42 0 0 0 .55-1.23zM9.27 13.5a1.05 1.05 0 1 1 0 2.1 1.05 1.05 0 0 1 0-2.1zm5.46 0a1.05 1.05 0 1 1 0 2.1 1.05 1.05 0 0 1 0-2.1zm-5.13 3.69a.38.38 0 0 1 .53 0c.58.56 1.43.77 2.37.77s1.79-.21 2.37-.77a.38.38 0 0 1 .53.54c-.73.71-1.76.99-2.9.99s-2.17-.28-2.9-.99a.38.38 0 0 1 0-.54z" />
      </svg>
    );
  }
  return null;
};

const GOOGLE_GSI_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
const LAST_USED_PROVIDER_STORAGE_KEY = 'sbc_last_auth_provider';

const SocialAuthButtonGrid = ({
  mode = 'signup',
  selectedTier = 'luminary',
  isSubscribing = false,
  showTierSelector = false,
  showBottomDivider = false,
  titleText = '',
  subtitleText = '',
  onTierChange,
  onSocialAuthSuccess,
  onSwitchAuthMode,
  initialSandboxProvider = ''
}) => {
  const [localTier, setLocalTier] = useState(selectedTier || 'basic');
  const [activeModalProvider, setActiveModalProvider] = useState(initialSandboxProvider || '');
  const [socialForm, setSocialForm] = useState({ name: '', email: '', handle: '' });
  const [isSubmittingSocial, setIsSubmittingSocial] = useState(false);
  const [socialError, setSocialError] = useState('');
  const [connectingProviderKey, setConnectingProviderKey] = useState('');
  const [providerMap, setProviderMap] = useState({});
  const [backendAuthReachable, setBackendAuthReachable] = useState(true);
  const [lastUsedProvider, setLastUsedProvider] = useState(() => {
    try {
      return localStorage.getItem(LAST_USED_PROVIDER_STORAGE_KEY) || 'google';
    } catch (e) {
      return 'google';
    }
  });

  useEffect(() => {
    if (selectedTier) {
      setLocalTier(selectedTier);
    }
  }, [selectedTier]);

  useEffect(() => {
    if (initialSandboxProvider) {
      setActiveModalProvider(initialSandboxProvider);
    }
  }, [initialSandboxProvider]);

  // Fetch live OAuth provider configuration from /api/auth/providers on mount
  useEffect(() => {
    let isMounted = true;

    fetch(`${API_BASE_URL}/api/auth/providers`)
      .then(res => {
        if (!res.ok) throw new Error('providers endpoint not ok');
        return res.json();
      })
      .then(data => {
        if (!isMounted || !data || !Array.isArray(data.providers)) return;
        const nextMap = {};
        data.providers.forEach(item => {
          if (item && item.provider) {
            nextMap[item.provider] = item;
          }
        });
        setProviderMap(nextMap);
        setBackendAuthReachable(true);
      })
      .catch(() => {
        if (isMounted) {
          setBackendAuthReachable(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const effectiveTier = showTierSelector ? localTier : (selectedTier || 'luminary');
  const effectiveIsSubscribing = showTierSelector
    ? ['luminary', 'radiance'].includes(String(localTier).toLowerCase())
    : Boolean(isSubscribing);

  const resolvedGoogleClientId = (
    providerMap.google?.clientId ||
    DEFAULT_GOOGLE_CLIENT_ID
  ).trim();

  const handleSelectTierPill = (nextTier) => {
    setLocalTier(nextTier);
    if (onTierChange) {
      onTierChange(nextTier, ['luminary', 'radiance'].includes(nextTier));
    }
  };

  // Performs a top-level full-tab browser redirect (matching screenshots 348.jpg -> 350.jpg)
  // so clicking "Continue with Google" opens accounts.google.com ("Choose an account to continue to susansbeautyconsulting.com")
  const handleProviderButtonClick = (providerMeta) => {
    setSocialError('');
    const provKey = providerMeta.key;
    setConnectingProviderKey(provKey);

    try {
      localStorage.setItem(LAST_USED_PROVIDER_STORAGE_KEY, provKey);
      setLastUsedProvider(provKey);
      sessionStorage.setItem('sbc_pending_oauth_tier', effectiveTier || 'luminary');
      sessionStorage.setItem('sbc_pending_oauth_subscribing', effectiveIsSubscribing ? 'true' : 'false');
    } catch (e) {}

    // If clicking Google and the backend /api/auth/providers route wasn't reachable on this host,
    // navigate directly to Google's official OAuth 2.0 Account Chooser (https://accounts.google.com/o/oauth2/v2/auth)
    if (provKey === 'google' && !backendAuthReachable && resolvedGoogleClientId) {
      const callbackUrl = `${API_BASE_URL}/api/auth/google/callback`;
      const googleParams = new URLSearchParams({
        client_id: resolvedGoogleClientId,
        redirect_uri: callbackUrl,
        response_type: 'code',
        scope: 'openid email profile',
        prompt: 'select_account',
        access_type: 'online',
        state: JSON.stringify({
          p: 'google',
          tier: effectiveTier || 'luminary',
          sub: Boolean(effectiveIsSubscribing),
          orig: window.location.origin
        })
      });
      window.location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${googleParams.toString()}`);
      return;
    }

    // Standard full-window 302 redirect via /api/auth/:provider/start -> Official Provider Sign-In Screen
    const startParams = new URLSearchParams({
      tier: effectiveTier || 'luminary',
      isSubscribing: effectiveIsSubscribing ? 'true' : 'false',
      mode: 'redirect',
      returnOrigin: window.location.origin
    });
    window.location.assign(`${API_BASE_URL}/api/auth/${provKey}/start?${startParams.toString()}`);
  };

  const handleCompleteInlineSocialLogin = async (e, autoDemo = false) => {
    if (e) e.preventDefault();
    if (!activeModalProvider) return;
    setIsSubmittingSocial(true);
    setSocialError('');

    const rand = Math.floor(1000 + Math.random() * 9000);
    const activeLabel =
      SOCIAL_OAUTH_PROVIDERS_META.find(p => p.key === activeModalProvider)?.label || activeModalProvider;

    const payloadName = autoDemo
      ? `${activeLabel} Member ${rand}`
      : socialForm.name.trim();
    const payloadEmail = autoDemo
      ? `${activeModalProvider}.member.${rand}@example.com`
      : socialForm.email.trim();
    const payloadHandle = autoDemo
      ? `${activeModalProvider}_member_${rand}`
      : socialForm.handle.trim();

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/social/quick-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: activeModalProvider,
          name: payloadName,
          email: payloadEmail,
          handle: payloadHandle,
          membershipTier: effectiveTier || 'luminary',
          isSubscribing: Boolean(effectiveIsSubscribing)
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.token && data.user) {
        const usedProvider = activeModalProvider;
        setActiveModalProvider('');
        if (onSocialAuthSuccess) {
          await onSocialAuthSuccess({
            ...data,
            provider: usedProvider,
            membershipTier: effectiveTier,
            isSubscribing: effectiveIsSubscribing
          });
        }
      } else {
        setSocialError(data.error || 'Could not complete social sign-up.');
      }
    } catch (err) {
      setSocialError('Network error while connecting to social authentication server.');
    }
    setIsSubmittingSocial(false);
  };

  const activeMeta = SOCIAL_OAUTH_PROVIDERS_META.find(p => p.key === activeModalProvider) || null;

  return (
    <div style={{ width: '100%', maxWidth: '420px', margin: '10px auto' }}>
      {titleText && (
        <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.45rem', color: '#2D2929', fontWeight: '700', margin: '0 0 4px 0', textAlign: 'center' }}>
          {titleText}
        </h3>
      )}
      {subtitleText && (
        <p style={{ fontFamily: 'sans-serif', fontSize: '0.86rem', color: '#736A6A', margin: '0 0 14px 0', textAlign: 'center' }}>
          {subtitleText}
        </p>
      )}

      {/* Optional 3-Tier Selector Pill Bar (for Landing Page & Tier Page) */}
      {showTierSelector && (
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '16px' }}>
          {[
            { id: 'basic', label: '✨ Free ($0)' },
            { id: 'luminary', label: '🌸 Luminary ($49/mo)' },
            { id: 'radiance', label: '💎 Radiance ($119/mo)' }
          ].map(t => {
            const active = effectiveTier === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => handleSelectTierPill(t.id)}
                style={{
                  padding: '7px 13px',
                  borderRadius: '20px',
                  border: active ? '2px solid #B38B8F' : '1px solid #E2E5E9',
                  backgroundColor: active ? '#F2D4D7' : '#FFFFFF',
                  color: '#3D3737',
                  fontFamily: 'sans-serif',
                  fontSize: '0.78rem',
                  fontWeight: active ? '700' : '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {active ? `✓ ${t.label}` : t.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Stacked Full-Width "Continue with [Provider]" Buttons + "Last used" Badge (Matching Screenshot 348.jpg) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}>
        {SOCIAL_OAUTH_PROVIDERS_META.map(prov => {
          const isConnectingThis = connectingProviderKey === prov.key;
          const isLastUsed = lastUsedProvider === prov.key;
          return (
            <div key={prov.key} style={{ position: 'relative', width: '100%' }}>
              {isLastUsed && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-9px',
                    right: '12px',
                    zIndex: 2,
                    backgroundColor: '#F4F5F7',
                    color: '#5C5454',
                    border: '1px solid #DCDFE4',
                    borderRadius: '10px',
                    padding: '1px 9px',
                    fontSize: '0.68rem',
                    fontFamily: 'sans-serif',
                    fontWeight: '600',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                    pointerEvents: 'none'
                  }}
                >
                  Last used
                </span>
              )}
              <button
                type="button"
                disabled={Boolean(connectingProviderKey)}
                onClick={() => handleProviderButtonClick(prov)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  border: isConnectingThis ? '1.5px solid #B38B8F' : '1px solid #E2E5E9',
                  backgroundColor: isConnectingThis ? '#FFF0F2' : '#FFFFFF',
                  color: '#3D3737',
                  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                  fontSize: '0.92rem',
                  fontWeight: '500',
                  cursor: connectingProviderKey ? 'wait' : 'pointer',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                  transition: 'all 0.18s ease'
                }}
                onMouseOver={(e) => {
                  if (connectingProviderKey) return;
                  e.currentTarget.style.backgroundColor = '#FAFAFB';
                  e.currentTarget.style.borderColor = '#B38B8F';
                }}
                onMouseOut={(e) => {
                  if (connectingProviderKey) return;
                  e.currentTarget.style.backgroundColor = '#FFFFFF';
                  e.currentTarget.style.borderColor = '#E2E5E9';
                }}
              >
                <SocialProviderBrandIcon provider={prov.key} size={18} />
                <span>{isConnectingThis ? `Opening ${prov.label}...` : `Continue with ${prov.label}`}</span>
              </button>
            </div>
          );
        })}
      </div>

      {socialError && !activeMeta && (
        <div style={{ marginTop: '10px', padding: '9px 12px', borderRadius: '10px', backgroundColor: '#FFF5F5', border: '1px solid #FFCDD2', color: '#C62828', fontSize: '0.82rem', fontFamily: 'sans-serif', textAlign: 'center' }}>
          {socialError}
        </div>
      )}

      {showBottomDivider && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '20px', marginBottom: '12px' }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: '#E6E8EC' }} />
          <span style={{ fontFamily: 'sans-serif', fontSize: '0.84rem', color: '#8A797A' }}>
            or
          </span>
          <div style={{ flex: 1, height: '1px', backgroundColor: '#E6E8EC' }} />
        </div>
      )}

      {onSwitchAuthMode && (
        <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #F0EAEB', textAlign: 'center', fontFamily: 'sans-serif', fontSize: '0.84rem', color: '#736A6A' }}>
          {mode === 'login' ? (
            <>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => onSwitchAuthMode('signup')}
                style={{ background: 'none', border: 'none', color: '#2D2929', fontWeight: '700', cursor: 'pointer', padding: 0, fontSize: '0.84rem', textDecoration: 'underline' }}
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => onSwitchAuthMode('login')}
                style={{ background: 'none', border: 'none', color: '#2D2929', fontWeight: '700', cursor: 'pointer', padding: 0, fontSize: '0.84rem', textDecoration: 'underline' }}
              >
                Sign in
              </button>
            </>
          )}
        </div>
      )}

      {/* Inline Fallback Modal (if triggered via oauth_sandbox_provider) */}
      {activeMeta && (
        <div
          onClick={() => !isSubmittingSocial && setActiveModalProvider('')}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(92, 84, 84, 0.55)',
            backdropFilter: 'blur(5px)',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            boxSizing: 'border-box',
            animation: 'fadeIn 0.25s ease'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#FFF9F9',
              border: '1.5px solid #B38B8F',
              borderRadius: '24px',
              padding: '28px',
              maxWidth: '420px',
              width: '100%',
              boxShadow: '0 18px 45px rgba(92, 84, 84, 0.3)',
              textAlign: 'left',
              position: 'relative',
              boxSizing: 'border-box'
            }}
          >
            <button
              type="button"
              onClick={() => setActiveModalProvider('')}
              style={{ position: 'absolute', top: '14px', right: '18px', background: 'none', border: 'none', fontSize: '1.4rem', color: '#8A797A', cursor: 'pointer' }}
            >
              ✕
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '50%', backgroundColor: '#FFFFFF', border: '1px solid #E8C5C8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <SocialProviderBrandIcon provider={activeMeta.key} size={22} />
              </div>
              <div>
                <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.65rem', color: '#5C5454', margin: 0 }}>
                  Continue with {activeMeta.label} ✧
                </h3>
                <span style={{ fontSize: '0.76rem', color: '#8A797A', fontFamily: 'sans-serif' }}>
                  Instant Membership Creation
                </span>
              </div>
            </div>

            <form onSubmit={(e) => handleCompleteInlineSocialLogin(e, false)} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 'bold', color: '#5C5454', fontFamily: 'sans-serif', marginBottom: '4px' }}>
                  Your Name:
                </label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Sarah Jenkins"
                  value={socialForm.name}
                  onChange={(e) => setSocialForm({ ...socialForm, name: e.target.value })}
                  style={{ width: '100%', padding: '11px 14px', borderRadius: '12px', border: '1px solid #E8C5C8', backgroundColor: '#FFFFFF', fontFamily: 'sans-serif', fontSize: '0.92rem', boxSizing: 'border-box', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 'bold', color: '#5C5454', fontFamily: 'sans-serif', marginBottom: '4px' }}>
                  {['x', 'tiktok', 'reddit'].includes(activeMeta.key)
                    ? `${activeMeta.label} @Handle or Email:`
                    : `${activeMeta.label} Email Address:`}
                </label>
                <input
                  required
                  type="text"
                  placeholder={
                    ['x', 'tiktok', 'reddit'].includes(activeMeta.key)
                      ? 'e.g. @sarahglam or sarah@example.com'
                      : 'e.g. sarah@example.com'
                  }
                  value={socialForm.email}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSocialForm({
                      ...socialForm,
                      email: val.includes('@') && !val.startsWith('@') ? val : '',
                      handle: val.startsWith('@') || !val.includes('@') ? val.replace(/^@/, '') : socialForm.handle
                    });
                  }}
                  style={{ width: '100%', padding: '11px 14px', borderRadius: '12px', border: '1px solid #E8C5C8', backgroundColor: '#FFFFFF', fontFamily: 'sans-serif', fontSize: '0.92rem', boxSizing: 'border-box', outline: 'none' }}
                />
              </div>

              {socialError && (
                <div style={{ padding: '9px 12px', borderRadius: '10px', backgroundColor: '#FFF5F5', border: '1px solid #FFCDD2', color: '#C62828', fontSize: '0.82rem', fontFamily: 'sans-serif' }}>
                  {socialError}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmittingSocial}
                style={{
                  marginTop: '4px',
                  backgroundColor: '#F2D4D7',
                  border: '1px solid #B38B8F',
                  color: '#5C5454',
                  padding: '12px 20px',
                  borderRadius: '24px',
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: '1.2rem',
                  fontWeight: 'bold',
                  cursor: isSubmittingSocial ? 'not-allowed' : 'pointer'
                }}
              >
                {isSubmittingSocial ? `Connecting ${activeMeta.label}...` : `Continue with ${activeMeta.label} ✧`}
              </button>

              <button
                type="button"
                disabled={isSubmittingSocial}
                onClick={(e) => handleCompleteInlineSocialLogin(e, true)}
                style={{ background: 'none', border: 'none', color: '#8A797A', fontSize: '0.8rem', textDecoration: 'underline', cursor: 'pointer', textAlign: 'center', marginTop: '4px' }}
              >
                ⚡ 1-Click Instant Test Sign-Up with {activeMeta.label}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const CENTRAL_TIMEZONE = 'America/Chicago';

const getCentralParts = (dateVal) => {
  if (!dateVal) return null;
  const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
  if (isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: CENTRAL_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(d);
  const map = {};
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    yearStr: map.year,
    monthStr: map.month,
    dayStr: map.day,
    hourStr: map.hour,
    minuteStr: map.minute
  };
};

const getYMDInCT = (dateVal) => {
  const parts = getCentralParts(dateVal);
  if (!parts) return { year: -1, monthIndex: -1, day: -1 };
  return {
    year: parts.year,
    monthIndex: parts.month - 1,
    day: parts.day
  };
};

const formatDateTimeLocalCT = (dateVal) => {
  if (!dateVal) return '';
  if (typeof dateVal === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(dateVal.trim())) {
    return dateVal.trim();
  }
  const parts = getCentralParts(dateVal);
  if (!parts) return '';
  return `${parts.yearStr}-${parts.monthStr}-${parts.dayStr}T${parts.hourStr}:${parts.minuteStr}`;
};

const formatTimeCT = (dateVal) => {
  if (!dateVal) return '';
  const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
  if (isNaN(d.getTime())) return '';
  return `${d.toLocaleTimeString('en-US', {
    timeZone: CENTRAL_TIMEZONE,
    hour: 'numeric',
    minute: '2-digit'
  })} CT`;
};

const formatDateTimeCT = (dateVal) => {
  if (!dateVal) return '';
  const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
  if (isNaN(d.getTime())) return '';
  return `${d.toLocaleString('en-US', {
    timeZone: CENTRAL_TIMEZONE,
    dateStyle: 'medium',
    timeStyle: 'short'
  })} CT`;
};

// Compresses an uploaded image File into a clean JPEG data URL so uploads stay fast and lightweight
const compressImageFileToDataUrl = (file, maxDimension = 900, quality = 0.82) =>
  new Promise((resolve, reject) => {
    if (!file) return reject(new Error('No image file selected.'));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read image file.'));
    reader.onload = (ev) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image format.'));
      img.onload = () => {
        try {
          let { width, height } = img;
          if (width > maxDimension || height > maxDimension) {
            if (width >= height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedDataUrl);
        } catch (err) {
          resolve(ev.target.result);
        }
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });

const normalizeRoomUrl = (rawLink) => {
  if (!rawLink || !String(rawLink).trim()) return '';
  const trimmed = String(rawLink).trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('meet.jit.si/')) return `https://${trimmed}`;
  return `https://meet.jit.si/${trimmed.replace(/^\/+/, '')}`;
};

const AdminCalendar = ({ users = [] }) => {
  const [appointments, setAppointments] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isScheduling, setIsScheduling] = useState(false);
  const [editingApptId, setEditingApptId] = useState(null);
  const [remindingApptId, setRemindingApptId] = useState(null);
  const [calendarStatus, setCalendarStatus] = useState({ type: '', text: '' });

  const [newAppt, setNewAppt] = useState({
    clientId: '',
    startTime: '',
    durationInMinutes: 60,
    notes: '',
    meetingLink: ''
  });

  const fetchAppointments = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/appointments`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setAppointments(await res.json());
    } catch (err) {
      console.error('Error fetching calendar:', err);
    }
  };

  useEffect(() => {
    fetchAppointments();
    const interval = setInterval(fetchAppointments, 15000);
    return () => clearInterval(interval);
  }, []);

  const resetSchedulerForm = () => {
    setIsScheduling(false);
    setEditingApptId(null);
    setNewAppt({ clientId: '', startTime: '', durationInMinutes: 60, notes: '', meetingLink: '' });
  };

  const handleStartReschedule = (appt) => {
    const duration = Math.max(
      15,
      Math.round((new Date(appt.endTime).getTime() - new Date(appt.startTime).getTime()) / 60000) || 60
    );
    setEditingApptId(appt._id);
    setNewAppt({
      clientId: appt.clientId?._id || appt.clientId || '',
      startTime: formatDateTimeLocalCT(appt.startTime),
      durationInMinutes: duration,
      notes: appt.notes || '',
      meetingLink: appt.meetingLink || ''
    });
    setIsScheduling(true);
    setCalendarStatus({ type: '', text: '' });
  };

  const handleSchedule = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    setCalendarStatus({ type: '', text: '' });

    const isRescheduling = Boolean(editingApptId);
    const url = isRescheduling
      ? `${API_BASE_URL}/api/admin/appointments/${editingApptId}`
      : `${API_BASE_URL}/api/admin/appointments`;
    const method = isRescheduling ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newAppt)
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        await fetchAppointments();
        resetSchedulerForm();
        setCalendarStatus({
          type: 'success',
          text: isRescheduling
            ? 'Consultation rescheduled and synced to the member calendar! ✧'
            : 'Consultation scheduled and synced to the member calendar! ✧'
        });
        setTimeout(() => setCalendarStatus({ type: '', text: '' }), 4000);
      } else {
        setCalendarStatus({ type: 'error', text: data.error || 'Failed to save consultation.' });
      }
    } catch (err) {
      console.error('Error scheduling:', err);
      setCalendarStatus({ type: 'error', text: 'Network error while saving consultation.' });
    }
  };

  const handleSendReminder = async (apptId) => {
    const token = localStorage.getItem('token');
    setRemindingApptId(apptId);
    setCalendarStatus({ type: '', text: '' });
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/appointments/${apptId}/remind`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        await fetchAppointments();
        setCalendarStatus({
          type: 'success',
          text: data.message || '1-on-1 consultation reminder email dispatched to client and Susan! ✧'
        });
        setTimeout(() => setCalendarStatus({ type: '', text: '' }), 5000);
      } else {
        setCalendarStatus({
          type: 'error',
          text: data.error || 'Failed to send consultation reminder.'
        });
      }
    } catch (err) {
      console.error('Error sending reminder:', err);
      setCalendarStatus({ type: 'error', text: 'Network error while dispatching consultation reminder.' });
    }
    setRemindingApptId(null);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Cancel this consultation?')) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/appointments/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        if (editingApptId === id) resetSchedulerForm();
        fetchAppointments();
      }
    } catch (err) {
      console.error('Error canceling:', err);
    }
  };

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const changeMonth = (offset) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
  };

  const handleDayClick = (dayNumber) => {
    if (isScheduling && editingApptId) return;
    const pad = (n) => String(n).padStart(2, '0');
    const defaultSlot = `${currentDate.getFullYear()}-${pad(currentDate.getMonth() + 1)}-${pad(dayNumber)}T09:00`;
    setNewAppt(prev => ({ ...prev, startTime: defaultSlot }));
    setIsScheduling(true);
  };

  const upcomingConsultations = appointments
    .filter(a => a.status !== 'cancelled' && new Date(a.endTime || a.startTime).getTime() >= Date.now() - 3600000)
    .slice(0, 6);

  return (
    <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.75)', borderRadius: '15px', border: '1px solid #E8C5C8', padding: '30px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <button onClick={() => changeMonth(-1)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', color: '#B38B8F', cursor: 'pointer' }}>◀</button>
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2.2rem', color: '#5C5454', margin: 0 }}>
          {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
        </h2>
        <button onClick={() => changeMonth(1)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', color: '#B38B8F', cursor: 'pointer' }}>▶</button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
        <button
          onClick={() => {
            if (isScheduling) resetSchedulerForm();
            else setIsScheduling(true);
          }}
          style={{ backgroundColor: '#F2D4D7', border: '1px solid #B38B8F', padding: '10px 20px', borderRadius: '25px', fontFamily: "'Cormorant Garamond', serif", color: '#5C5454', cursor: 'pointer', fontSize: '1.05rem' }}
        >
          {isScheduling ? 'Close Scheduler' : '+ Schedule Consultation ✧'}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.85rem', color: '#8A797A', backgroundColor: '#FFF0F2', border: '1px solid #E8C5C8', padding: '6px 12px', borderRadius: '15px', fontFamily: 'sans-serif' }}>
            ⏰ Auto 24h Email Reminders Active • US Central Time (CT)
          </span>
          <button
            onClick={fetchAppointments}
            style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8C5C8', padding: '8px 16px', borderRadius: '20px', fontFamily: "'Cormorant Garamond', serif", color: '#8A797A', cursor: 'pointer', fontSize: '1rem' }}
          >
            ↻ Sync Calendar
          </button>
        </div>
      </div>

      {calendarStatus.text && (
        <div style={{
          marginBottom: '20px',
          padding: '12px 16px',
          borderRadius: '10px',
          fontFamily: 'sans-serif',
          fontSize: '0.95rem',
          backgroundColor: calendarStatus.type === 'success' ? '#F6FBF7' : '#FFF5F5',
          color: calendarStatus.type === 'success' ? '#2E7D32' : '#C62828',
          border: `1px solid ${calendarStatus.type === 'success' ? '#A5D6A7' : '#FFCDD2'}`
        }}>
          {calendarStatus.text}
        </div>
      )}

      {upcomingConsultations.length > 0 && (
        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8C5C8', borderRadius: '12px', padding: '16px 20px', marginBottom: '22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
            <strong style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.35rem', color: '#5C5454' }}>
              Upcoming 1-on-1 Consultations & Reminders ✧
            </strong>
            <span style={{ fontSize: '0.82rem', color: '#8A797A', fontFamily: 'sans-serif' }}>
              Reminders are emailed automatically 24h prior, or click 🔔 to dispatch immediately
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {upcomingConsultations.map(appt => (
              <div key={`upcoming-${appt._id}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', padding: '10px 14px', borderRadius: '10px', backgroundColor: '#FFF9F9', border: '1px solid #E8C5C8' }}>
                <div>
                  <strong style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.15rem', color: '#5C5454' }}>
                    {appt.clientId?.name || 'Member'}
                  </strong>
                  <span style={{ color: '#8A797A', fontSize: '0.9rem', marginLeft: '8px', fontFamily: 'sans-serif' }}>
                    • {formatDateTimeCT(appt.startTime)}
                  </span>
                  {appt.reminderSentAt && (
                    <span style={{ marginLeft: '10px', backgroundColor: '#F6FBF7', color: '#2E7D32', border: '1px solid #A5D6A7', borderRadius: '10px', padding: '2px 8px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                      ✓ Reminder Sent
                    </span>
                  )}
                  {appt.notes && (
                    <p style={{ margin: '3px 0 0 0', fontSize: '0.84rem', color: '#736A6A', fontFamily: 'sans-serif' }}>
                      Notes: "{appt.notes}"
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    disabled={remindingApptId === appt._id}
                    onClick={() => handleSendReminder(appt._id)}
                    style={{ backgroundColor: '#F2D4D7', color: '#5C5454', border: '1px solid #B38B8F', padding: '6px 14px', borderRadius: '16px', fontFamily: "'Cormorant Garamond', serif", fontSize: '0.98rem', fontWeight: 'bold', cursor: remindingApptId === appt._id ? 'not-allowed' : 'pointer' }}
                  >
                    {remindingApptId === appt._id ? '⏳ Sending...' : '🔔 Send Reminder Email'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStartReschedule(appt)}
                    style={{ backgroundColor: '#FFFFFF', color: '#5C5454', border: '1px solid #E8C5C8', padding: '6px 12px', borderRadius: '16px', fontFamily: "'Cormorant Garamond', serif", fontSize: '0.95rem', cursor: 'pointer' }}
                  >
                    ✎ Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isScheduling && (
        <form onSubmit={handleSchedule} style={{ backgroundColor: '#FFFFFF', padding: '20px', borderRadius: '12px', border: '1px solid #E8C5C8', marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'center' }}>
          <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.3rem', color: '#B38B8F' }}>
              {editingApptId ? 'Reschedule / Update Consultation ✧' : 'Schedule New Consultation ✧'}
            </strong>
            {editingApptId && (
              <button type="button" onClick={resetSchedulerForm} style={{ background: 'none', border: 'none', color: '#8A797A', textDecoration: 'underline', cursor: 'pointer' }}>
                Cancel Edit
              </button>
            )}
          </div>

          <select
            required
            disabled={Boolean(editingApptId)}
            value={newAppt.clientId}
            onChange={e => setNewAppt({ ...newAppt, clientId: e.target.value })}
            style={{ flex: '1 1 220px', padding: '10px', borderRadius: '8px', border: '1px solid #E8C5C8', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.05rem', backgroundColor: editingApptId ? '#F9F4F5' : '#FFFFFF' }}
          >
            <option value="">Select Member...</option>
            {users.map(u => <option key={u._id} value={u._id}>{u.name} ({u.email})</option>)}
          </select>

          <input
            required
            type="datetime-local"
            value={newAppt.startTime}
            onChange={e => setNewAppt({ ...newAppt, startTime: e.target.value })}
            style={{ flex: '1 1 220px', padding: '10px', borderRadius: '8px', border: '1px solid #E8C5C8', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.05rem' }}
          />

          <input
            type="text"
            placeholder="Notes (e.g. Quarterly check-in)"
            value={newAppt.notes}
            onChange={e => setNewAppt({ ...newAppt, notes: e.target.value })}
            style={{ flex: '2 1 260px', padding: '10px', borderRadius: '8px', border: '1px solid #E8C5C8', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.05rem' }}
          />

          <input
            type="text"
            placeholder="Video Link (optional — auto-generated if blank)"
            value={newAppt.meetingLink}
            onChange={e => setNewAppt({ ...newAppt, meetingLink: e.target.value })}
            style={{ flex: '2 1 260px', padding: '10px', borderRadius: '8px', border: '1px solid #E8C5C8', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.05rem' }}
          />

          <button type="submit" style={{ backgroundColor: '#B38B8F', color: '#FFFFFF', border: 'none', padding: '10px 24px', borderRadius: '8px', cursor: 'pointer', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.1rem' }}>
            {editingApptId ? 'Save Changes ✧' : 'Save ✧'}
          </button>
        </form>
      )}

      <div className="calendar-grid-wrapper"><div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(105px, 1fr))', gap: '10px', textAlign: 'center' }}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <strong key={day} style={{ fontFamily: "'Cormorant Garamond', serif", color: '#8A797A', paddingBottom: '10px' }}>{day}</strong>
        ))}

        {Array.from({ length: firstDayOfMonth }).map((_, i) => <div key={`empty-${i}`} />)}

        {Array.from({ length: daysInMonth }).map((_, i) => {
          const dayNumber = i + 1;
          const dayAppointments = appointments.filter(appt => {
            const ct = getYMDInCT(appt.startTime);
            return ct.day === dayNumber &&
                   ct.monthIndex === currentDate.getMonth() &&
                   ct.year === currentDate.getFullYear();
          });

          return (
            <div
              key={dayNumber}
              onClick={() => handleDayClick(dayNumber)}
              style={{ border: '1px solid #E8C5C8', borderRadius: '8px', padding: '10px', minHeight: '110px', backgroundColor: '#FFFFFF', textAlign: 'left', position: 'relative', cursor: 'pointer' }}
            >
              <span style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 'bold', color: '#5C5454' }}>{dayNumber}</span>

              <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }} onClick={(e) => e.stopPropagation()}>
                {dayAppointments.map(appt => (
                  <div key={appt._id} style={{ backgroundColor: '#FFF0F2', padding: '6px', borderRadius: '6px', fontSize: '0.8rem', borderLeft: '3px solid #B38B8F', position: 'relative' }}>
                    <strong style={{ color: '#5C5454', display: 'block', paddingRight: '46px' }}>
                      {formatTimeCT(appt.startTime)}
                    </strong>
                    <p style={{ margin: '2px 0 0 0', color: '#5C5454', fontWeight: '600', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {appt.clientId?.name || 'Member'}
                    </p>
                    {appt.notes && (
                      <p style={{ margin: '2px 0 0 0', color: '#8A797A', fontSize: '0.75rem', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {appt.notes}
                      </p>
                    )}
                    {appt.reminderSentAt && (
                      <span style={{ display: 'inline-block', marginTop: '3px', marginRight: '3px', backgroundColor: '#F6FBF7', color: '#2E7D32', border: '1px solid #A5D6A7', borderRadius: '6px', padding: '1px 5px', fontSize: '0.68rem', fontWeight: 'bold' }}>
                        ✓ Reminded
                      </span>
                    )}
                    {appt.rescheduledBy === 'client' && (
                      <span style={{ display: 'inline-block', marginTop: '3px', backgroundColor: '#FFFFFF', color: '#B38B8F', border: '1px solid #E8C5C8', borderRadius: '6px', padding: '1px 5px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                        ✧ Rescheduled by Member
                      </span>
                    )}
                    {appt.rescheduledBy === 'admin' && (
                      <span style={{ display: 'inline-block', marginTop: '3px', backgroundColor: '#FFFFFF', color: '#8A797A', border: '1px solid #E8C5C8', borderRadius: '6px', padding: '1px 5px', fontSize: '0.7rem' }}>
                        ✧ Rescheduled by You
                      </span>
                    )}
                    <div style={{ position: 'absolute', top: '3px', right: '3px', display: 'flex', gap: '3px' }}>
                      <button
                        title="Send consultation reminder email to client & Susan"
                        disabled={remindingApptId === appt._id}
                        onClick={() => handleSendReminder(appt._id)}
                        style={{ background: 'none', border: 'none', color: '#B38B8F', cursor: 'pointer', fontSize: '0.78rem', padding: '0 2px' }}
                      >
                        🔔
                      </button>
                      <button
                        title="Reschedule consultation"
                        onClick={() => handleStartReschedule(appt)}
                        style={{ background: 'none', border: 'none', color: '#B38B8F', cursor: 'pointer', fontSize: '0.8rem', padding: '0 2px' }}
                      >
                        ✎
                      </button>
                      <button
                        title="Cancel consultation"
                        onClick={() => handleDelete(appt._id)}
                        style={{ background: 'none', border: 'none', color: '#A89999', cursor: 'pointer', fontSize: '0.8rem', padding: '0 2px' }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div></div>
    </div>
  );
};

const MemberCalendar = ({ onJoinVideoRoom, userTier = 'basic', onOpenPaywallModal }) => {
  const [appointments, setAppointments] = useState([]);
  const [quotaInfo, setQuotaInfo] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isScheduling, setIsScheduling] = useState(false);
  const [editingApptId, setEditingApptId] = useState(null);
  const [statusBanner, setStatusBanner] = useState({ type: '', text: '' });

  const [formState, setFormState] = useState({
    startTime: '',
    durationInMinutes: 60,
    notes: ''
  });

  const fetchMemberAppointments = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/me/appointments`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setAppointments(data);
        } else if (data && typeof data === 'object') {
          setAppointments(Array.isArray(data.appointments) ? data.appointments : []);
          if (data.quotaInfo) setQuotaInfo(data.quotaInfo);
        }
      }
    } catch (err) {
      console.error('Error fetching member calendar:', err);
    }
  };

  useEffect(() => {
    fetchMemberAppointments();
    const interval = setInterval(fetchMemberAppointments, 15000);
    return () => clearInterval(interval);
  }, []);

  const resetForm = () => {
    setIsScheduling(false);
    setEditingApptId(null);
    setFormState({ startTime: '', durationInMinutes: 60, notes: '' });
  };

  const handleStartReschedule = (appt) => {
    setEditingApptId(appt._id);
    setFormState({
      startTime: formatDateTimeLocalCT(appt.startTime),
      durationInMinutes: 60,
      notes: appt.notes || ''
    });
    setIsScheduling(true);
    setStatusBanner({ type: '', text: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    setStatusBanner({ type: '', text: '' });

    const isRescheduling = Boolean(editingApptId);
    const url = isRescheduling
      ? `${API_BASE_URL}/api/users/me/appointments/${editingApptId}`
      : `${API_BASE_URL}/api/users/me/appointments`;
    const method = isRescheduling ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formState)
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        await fetchMemberAppointments();
        resetForm();
        setStatusBanner({
          type: 'success',
          text: isRescheduling
            ? "Your consultation has been rescheduled on Susan's calendar! ✧"
            : "Your 1-on-1 consultation is confirmed on Susan's calendar! ✧"
        });
        setTimeout(() => setStatusBanner({ type: '', text: '' }), 4500);
      } else {
        if (res.status === 402 || data.requiresUpgrade) {
          if (onOpenPaywallModal) {
            onOpenPaywallModal(data.message || 'Upgrade to Luminary Circle or Radiance Elite to book 1-on-1 consultations with Susan.');
          }
        }
        if (data.quotaInfo) setQuotaInfo(data.quotaInfo);
        setStatusBanner({ type: 'error', text: data.message || data.error || 'Could not schedule consultation.' });
      }
    } catch (err) {
      console.error('Error booking consultation:', err);
      setStatusBanner({ type: 'error', text: 'Network error while communicating with calendar.' });
    }
  };

  const handleCancel = async (id) => {
    if (!window.confirm('Would you like to cancel this scheduled consultation?')) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/me/appointments/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        if (editingApptId === id) resetForm();
        fetchMemberAppointments();
      }
    } catch (err) {
      console.error('Error cancelling consultation:', err);
    }
  };

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const changeMonth = (offset) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
  };

  const myUpcomingAppointments = appointments.filter(a => a.isMine);

  // Derive live tier consultation quota (Luminary = 1 every 90 days / Quarterly; Radiance = 1 every 30 days / Monthly)
  const cleanTier = String(quotaInfo?.tier || userTier || 'luminary').toLowerCase().trim();
  const windowDays = quotaInfo?.windowDays || (cleanTier === 'radiance' ? 30 : 90);
  const maxAllowed = quotaInfo?.maxAllowed ?? 1;
  const usedCount = quotaInfo?.usedCount !== undefined ? quotaInfo.usedCount : myUpcomingAppointments.length;
  const canBookNew = quotaInfo?.canBook !== undefined ? Boolean(quotaInfo.canBook) : usedCount < maxAllowed;

  const computedNextEligibleDate = (() => {
    if (quotaInfo?.nextEligibleDate) return quotaInfo.nextEligibleDate;
    if (!canBookNew && myUpcomingAppointments[0]?.startTime) {
      const latestMs = new Date(myUpcomingAppointments[0].startTime).getTime();
      if (!isNaN(latestMs)) {
        return new Date(latestMs + windowDays * 24 * 60 * 60 * 1000).toISOString();
      }
    }
    return null;
  })();

  const formattedNextEligibleDate = computedNextEligibleDate
    ? new Date(computedNextEligibleDate).toLocaleDateString('en-US', {
        timeZone: CENTRAL_TIMEZONE,
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      })
    : '';

  const handleDayClick = (dayNumber) => {
    if (isScheduling && editingApptId) return;
    if (!canBookNew) {
      setStatusBanner({
        type: 'error',
        text:
          cleanTier === 'luminary'
            ? `Luminary Circle includes 1 consultation every 3 months (90 days). Your next eligible booking date is ${formattedNextEligibleDate || 'after your current 90-day cycle'} — or upgrade to Radiance Elite for monthly consultations!`
            : `Radiance Elite includes 1 consultation per month (30 days). Your next eligible booking date is ${formattedNextEligibleDate || 'after your current 30-day cycle'}. You can still reschedule your existing session below.`
      });
      return;
    }
    const pad = (n) => String(n).padStart(2, '0');
    const slot = `${currentDate.getFullYear()}-${pad(currentDate.getMonth() + 1)}-${pad(dayNumber)}T09:00`;
    setFormState(prev => ({ ...prev, startTime: slot }));
    setIsScheduling(true);
  };

  return (
    <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.75)', borderRadius: '15px', border: '1px solid #E8C5C8', padding: '30px' }}>
      {/* Tier Consultation Quota Banner */}
      <div
        style={{
          backgroundColor: canBookNew ? '#F6FBF7' : '#FFF8E7',
          border: `1.5px solid ${canBookNew ? '#A5D6A7' : '#FFE082'}`,
          borderRadius: '14px',
          padding: '14px 18px',
          marginBottom: '22px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          textAlign: 'left'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <strong style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.25rem', color: '#5C5454' }}>
              {cleanTier === 'radiance'
                ? '💎 Radiance Elite Privilege: 1 Consultation Every Month (30-Day Cycle)'
                : '✨ Luminary Circle Privilege: 1 Consultation Every 3 Months (Quarterly / 90-Day Cycle)'}
            </strong>
            <span
              style={{
                backgroundColor: '#FFFFFF',
                color: canBookNew ? '#2E7D32' : '#B26A00',
                border: `1px solid ${canBookNew ? '#A5D6A7' : '#FFE082'}`,
                padding: '2px 10px',
                borderRadius: '12px',
                fontSize: '0.78rem',
                fontWeight: 'bold',
                fontFamily: 'sans-serif'
              }}
            >
              {canBookNew
                ? `✓ ${Math.max(1, maxAllowed - usedCount)} Session Available (${usedCount}/${maxAllowed} Used)`
                : `🔒 Quota Used (${usedCount}/${maxAllowed})${formattedNextEligibleDate ? ` • Next Eligible: ${formattedNextEligibleDate}` : ''}`}
            </span>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#736A6A', fontFamily: 'sans-serif' }}>
            {canBookNew
              ? `You are eligible to reserve your ${cleanTier === 'radiance' ? 'monthly' : 'quarterly'} 1-on-1 video consultation with Susan below.`
              : `You have an active or recently completed consultation in your current ${windowDays}-day window. You may reschedule your upcoming session below${formattedNextEligibleDate ? `, or book your next session starting ${formattedNextEligibleDate}` : ''}.`}
          </p>
        </div>

        {cleanTier === 'luminary' && onOpenPaywallModal && (
          <button
            type="button"
            onClick={() =>
              onOpenPaywallModal(
                'Upgrade from The Luminary Circle ($49/mo — Quarterly) to The Radiance Elite ($119/mo) to unlock Monthly 1-on-1 Consultations, AI Skin Photo Analysis, and 25% off the Boutique!'
              )
            }
            style={{
              background: 'linear-gradient(135deg, #B38B8F 0%, #D4A5A9 100%)',
              color: '#FFFFFF',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '18px',
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: '1rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              boxShadow: '0 4px 12px rgba(179, 139, 143, 0.3)'
            }}
          >
            💎 Want Monthly Sessions? Upgrade to Radiance →
          </button>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <button onClick={() => changeMonth(-1)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', color: '#B38B8F', cursor: 'pointer' }}>◀</button>
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2.2rem', color: '#5C5454', margin: 0 }}>
          {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
        </h2>
        <button onClick={() => changeMonth(1)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', color: '#B38B8F', cursor: 'pointer' }}>▶</button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
        <button
          onClick={() => {
            if (isScheduling) {
              resetForm();
            } else if (!canBookNew) {
              setStatusBanner({
                type: 'error',
                text:
                  cleanTier === 'luminary'
                    ? `Luminary Circle members are limited to 1 consultation every 3 months (90 days). Next eligible date: ${formattedNextEligibleDate || 'after current cycle'}.`
                    : `Radiance Elite members are limited to 1 consultation per month (30 days). Next eligible date: ${formattedNextEligibleDate || 'after current cycle'}.`
              });
            } else {
              setIsScheduling(true);
            }
          }}
          style={{
            backgroundColor: (!canBookNew && !isScheduling) ? '#F4F5F7' : '#F2D4D7',
            border: '1px solid #B38B8F',
            padding: '10px 22px',
            borderRadius: '25px',
            fontFamily: "'Cormorant Garamond', serif",
            color: (!canBookNew && !isScheduling) ? '#8A797A' : '#5C5454',
            cursor: (!canBookNew && !isScheduling) ? 'not-allowed' : 'pointer',
            fontSize: '1.1rem'
          }}
        >
          {isScheduling
            ? 'Close Scheduler'
            : !canBookNew
            ? `🔒 ${cleanTier === 'radiance' ? 'Monthly' : 'Quarterly'} Quota Used${formattedNextEligibleDate ? ` (Next: ${formattedNextEligibleDate})` : ''}`
            : '+ Book Consultation with Susan ✧'}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.85rem', color: '#8A797A', backgroundColor: '#FFF0F2', border: '1px solid #E8C5C8', padding: '6px 12px', borderRadius: '15px', fontFamily: 'sans-serif' }}>
            🕒 US Central Time (Kansas — CT)
          </span>
          <button
            onClick={fetchMemberAppointments}
            style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8C5C8', padding: '8px 16px', borderRadius: '20px', fontFamily: "'Cormorant Garamond', serif", color: '#8A797A', cursor: 'pointer', fontSize: '1rem' }}
          >
            ↻ Refresh Schedule
          </button>
        </div>
      </div>

      {statusBanner.text && (
        <div style={{
          marginBottom: '20px',
          padding: '12px 16px',
          borderRadius: '10px',
          fontFamily: 'sans-serif',
          fontSize: '0.95rem',
          backgroundColor: statusBanner.type === 'success' ? '#F6FBF7' : '#FFF5F5',
          color: statusBanner.type === 'success' ? '#2E7D32' : '#C62828',
          border: `1px solid ${statusBanner.type === 'success' ? '#A5D6A7' : '#FFCDD2'}`
        }}>
          {statusBanner.text}
        </div>
      )}

      {isScheduling && (
        <form onSubmit={handleSubmit} style={{ backgroundColor: '#FFFFFF', padding: '20px', borderRadius: '12px', border: '1px solid #E8C5C8', marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'center' }}>
          <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.3rem', color: '#B38B8F' }}>
              {editingApptId ? 'Reschedule Your Consultation ✧' : 'Reserve Your 1-on-1 Session with Susan ✧'}
            </strong>
            {editingApptId && (
              <button type="button" onClick={resetForm} style={{ background: 'none', border: 'none', color: '#8A797A', textDecoration: 'underline', cursor: 'pointer' }}>
                Cancel Edit
              </button>
            )}
          </div>

          <input
            required
            type="datetime-local"
            value={formState.startTime}
            onChange={e => setFormState({ ...formState, startTime: e.target.value })}
            style={{ flex: '1 1 220px', padding: '10px', borderRadius: '8px', border: '1px solid #E8C5C8', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.05rem' }}
          />

          <input
            type="text"
            placeholder=" Topics or questions for Susan (e.g. Evening hydration ritual)"
            value={formState.notes}
            onChange={e => setFormState({ ...formState, notes: e.target.value })}
            style={{ flex: '2 1 300px', padding: '10px', borderRadius: '8px', border: '1px solid #E8C5C8', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.05rem' }}
          />

          <button type="submit" style={{ backgroundColor: '#B38B8F', color: '#FFFFFF', border: 'none', padding: '10px 24px', borderRadius: '8px', cursor: 'pointer', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.1rem' }}>
            {editingApptId ? 'Confirm New Time ✧' : 'Confirm Booking ✧'}
          </button>
        </form>
      )}

      {myUpcomingAppointments.length > 0 && (
        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8C5C8', borderRadius: '12px', padding: '18px', marginBottom: '25px', textAlign: 'left' }}>
          <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.45rem', color: '#5C5454', margin: '0 0 12px 0' }}>
            Your Scheduled Consultations with Susan
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {myUpcomingAppointments.map(appt => (
              <div key={appt._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', padding: '12px 15px', borderRadius: '10px', backgroundColor: '#FFF9F9', border: appt.rescheduledBy === 'admin' ? '1.5px solid #B38B8F' : '1px solid #E8C5C8' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <strong style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.2rem', color: '#5C5454' }}>
                      {formatDateTimeCT(appt.startTime)}
                    </strong>
                    {appt.rescheduledBy === 'admin' && (
                      <span style={{ backgroundColor: '#F2D4D7', color: '#5C5454', border: '1px solid #B38B8F', borderRadius: '12px', padding: '2px 10px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                        ✧ Rescheduled by Susan
                      </span>
                    )}
                    {appt.rescheduledBy === 'client' && (
                      <span style={{ backgroundColor: '#FFF0F2', color: '#8A797A', border: '1px solid #E8C5C8', borderRadius: '12px', padding: '2px 10px', fontSize: '0.8rem' }}>
                        ✧ Rescheduled by You
                      </span>
                    )}
                  </div>
                  {appt.rescheduledBy === 'admin' && appt.previousStartTime && (
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#8A797A', fontStyle: 'italic' }}>
                      Previously scheduled for {formatDateTimeCT(appt.previousStartTime)}
                    </p>
                  )}
                  {appt.notes && (
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.9rem', color: '#736A6A' }}>
                      Notes: "{appt.notes}"
                    </p>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {appt.meetingLink && onJoinVideoRoom && (
                    <button
                      type="button"
                      onClick={() => onJoinVideoRoom(appt.meetingLink)}
                      style={{ backgroundColor: '#B38B8F', color: '#FFFFFF', border: 'none', padding: '8px 14px', borderRadius: '18px', fontFamily: "'Cormorant Garamond', serif", fontSize: '1rem', cursor: 'pointer' }}
                    >
                      🎥 Join Video Room
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleStartReschedule(appt)}
                    style={{ backgroundColor: '#FFFFFF', color: '#5C5454', border: '1px solid #B38B8F', padding: '8px 14px', borderRadius: '18px', fontFamily: "'Cormorant Garamond', serif", fontSize: '1rem', cursor: 'pointer' }}
                  >
                    ✎ Reschedule
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCancel(appt._id)}
                    style={{ backgroundColor: 'transparent', color: '#A89999', border: '1px solid #E8C5C8', padding: '8px 12px', borderRadius: '18px', fontFamily: "'Cormorant Garamond', serif", fontSize: '1rem', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="calendar-grid-wrapper"><div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(105px, 1fr))', gap: '10px', textAlign: 'center' }}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <strong key={day} style={{ fontFamily: "'Cormorant Garamond', serif", color: '#8A797A', paddingBottom: '10px' }}>{day}</strong>
        ))}

        {Array.from({ length: firstDayOfMonth }).map((_, i) => <div key={`empty-${i}`} />)}

        {Array.from({ length: daysInMonth }).map((_, i) => {
          const dayNumber = i + 1;
          const dayAppointments = appointments.filter(appt => {
            const ct = getYMDInCT(appt.startTime);
            return ct.day === dayNumber &&
                   ct.monthIndex === currentDate.getMonth() &&
                   ct.year === currentDate.getFullYear();
          });

          return (
            <div
              key={dayNumber}
              onClick={() => handleDayClick(dayNumber)}
              style={{ border: '1px solid #E8C5C8', borderRadius: '8px', padding: '10px', minHeight: '110px', backgroundColor: '#FFFFFF', textAlign: 'left', position: 'relative', cursor: 'pointer' }}
            >
              <span style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 'bold', color: '#5C5454' }}>{dayNumber}</span>

              <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }} onClick={(e) => e.stopPropagation()}>
                {dayAppointments.map(appt => (
                  appt.isMine ? (
                    <div key={appt._id} style={{ backgroundColor: '#FFF0F2', padding: '6px', borderRadius: '6px', fontSize: '0.8rem', borderLeft: '3px solid #B38B8F', position: 'relative' }}>
                      <strong style={{ color: '#5C5454', display: 'block', paddingRight: '32px' }}>
                        {formatTimeCT(appt.startTime)}
                      </strong>
                      <p style={{ margin: '2px 0 0 0', color: '#5C5454', fontWeight: '600' }}>
                        Your Session
                      </p>
                      {appt.rescheduledBy === 'admin' && (
                        <span style={{ display: 'inline-block', marginTop: '3px', backgroundColor: '#FFFFFF', color: '#B38B8F', border: '1px solid #B38B8F', borderRadius: '6px', padding: '1px 5px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                          ✧ Rescheduled by Susan
                        </span>
                      )}
                      <div style={{ position: 'absolute', top: '3px', right: '3px', display: 'flex', gap: '4px' }}>
                        <button
                          title="Reschedule"
                          onClick={() => handleStartReschedule(appt)}
                          style={{ background: 'none', border: 'none', color: '#B38B8F', cursor: 'pointer', fontSize: '0.8rem', padding: '0 2px' }}
                        >
                          ✎
                        </button>
                        <button
                          title="Cancel"
                          onClick={() => handleCancel(appt._id)}
                          style={{ background: 'none', border: 'none', color: '#A89999', cursor: 'pointer', fontSize: '0.8rem', padding: '0 2px' }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div key={appt._id} style={{ backgroundColor: '#F7F2F2', padding: '5px', borderRadius: '5px', fontSize: '0.75rem', borderLeft: '3px solid #D8C8C9', color: '#A89999' }}>
                      <strong>{formatTimeCT(appt.startTime)}</strong>
                      <p style={{ margin: '2px 0 0 0' }}>Susan Reserved</p>
                    </div>
                  )
                ))}
              </div>
            </div>
          );
        })}
      </div></div>
    </div>
  );
};

const CJ_CARRIER_OPTIONS = [
  'CJPacket Sensitive Pro',
  'CJPacket Liquid US',
  'CJPacket Eub Special Line',
  'CJPacket Sensitive',
  'YunExpress Sensitive Line',
  'USPS+',
  'CJPacket Fast Line',
  'CJPacket Ordinary',
  'CJPacket YSD Special',
  'DHL Official'
];

const DEFAULT_CJ_PACKAGING_CHOICES = [
  {
    packagingVid: 'CJ-PKG-ROSEGOLD-BOX-01',
    packagingName: "Susan's Rose-Gold Custom Box & Seal",
    labelType: 'CJ_CUSTOM_PACKAGING',
    packagingCostUsd: 0.65
  },
  {
    packagingVid: 'CJ-PKG-SATIN-POUCH-02',
    packagingName: 'Luxury Satin Ritual Pouch',
    labelType: 'CJ_CUSTOM_PACKAGING',
    packagingCostUsd: 0.45
  },
  {
    packagingVid: 'CJ-POD-BOTTLE-LABEL-03',
    packagingName: 'CJ POD Custom Bottle/Jar Logo Label',
    labelType: 'CJ_POD_LOGO',
    packagingCostUsd: 0.85
  }
];

const buildClientDefaultCjCarriers = (weightGrams = 120) => {
  const w = Math.max(25, Number(weightGrams) || 120);
  const extra = Math.max(0, (w - 120) / 100);
  return [
    { logisticName: 'CJPacket Sensitive Pro', shippingCostUsd: Number((7.84 + extra * 0.72).toFixed(2)), deliveryTime: '5-11 Days', isOptimal: true, recommended: true, optimalReason: 'Least Expensive & Most Efficient' },
    { logisticName: 'CJPacket Liquid US', shippingCostUsd: Number((8.33 + extra * 0.78).toFixed(2)), deliveryTime: '5-11 Days', isOptimal: false },
    { logisticName: 'CJPacket Eub Special Line', shippingCostUsd: Number((8.61 + extra * 0.68).toFixed(2)), deliveryTime: '10-23 Days', isOptimal: false },
    { logisticName: 'CJPacket Sensitive', shippingCostUsd: Number((8.12 + extra * 0.74).toFixed(2)), deliveryTime: '7-12 Days', isOptimal: false },
    { logisticName: 'YunExpress Sensitive Line', shippingCostUsd: Number((8.75 + extra * 0.80).toFixed(2)), deliveryTime: '6-11 Days', isOptimal: false },
    { logisticName: 'USPS+', shippingCostUsd: Number((8.95 + extra * 0.84).toFixed(2)), deliveryTime: '6-10 Days', isOptimal: false },
    { logisticName: 'CJPacket Fast Line', shippingCostUsd: Number((9.45 + extra * 0.88).toFixed(2)), deliveryTime: '5-9 Days', isOptimal: false },
    { logisticName: 'CJPacket Ordinary', shippingCostUsd: Number((7.45 + extra * 0.62).toFixed(2)), deliveryTime: '8-15 Days', isOptimal: false },
    { logisticName: 'CJPacket YSD Special', shippingCostUsd: Number((9.15 + extra * 0.79).toFixed(2)), deliveryTime: '7-13 Days', isOptimal: false },
    { logisticName: 'DHL Official', shippingCostUsd: Number((16.90 + extra * 1.95).toFixed(2)), deliveryTime: '3-7 Days', isOptimal: false }
  ];
};

const computeClientProductPriceBreakdown = (prod = {}) => {
  const primaryVariant = prod.variants?.[0] || {};
  const weightGrams = Math.max(25, Number(prod.estimatedWeightGrams || 120) || 120);
  const defaultCarriers = buildClientDefaultCjCarriers(weightGrams);

  const rawAvailable = Array.isArray(prod.availableLogistics) && prod.availableLogistics.length > 0
    ? prod.availableLogistics
    : defaultCarriers;

  // Merge all CJ methods so every product displays all available CJ shipping methods and their varying prices
  const availableLogistics = [...rawAvailable];
  for (const dc of defaultCarriers) {
    if (!availableLogistics.some(r => String(r.logisticName || '').toLowerCase() === dc.logisticName.toLowerCase())) {
      availableLogistics.push(dc);
    }
  }

  const optimalCarrier =
    availableLogistics.find(r => r.isOptimal) ||
    availableLogistics.find(r => /sensitive pro/i.test(r.logisticName)) ||
    availableLogistics[0];

  const storedPrice = Number(primaryVariant.price ?? prod.price ?? 0);
  const markupMultiplier = Number(prod.markupMultiplier || 6.5) || 6.5;
  const rawWholesale = Number(prod.wholesalePriceUsd ?? primaryVariant.wholesalePriceUsd ?? 0);
  const wholesalePriceUsd = rawWholesale > 0
    ? Number(rawWholesale.toFixed(2))
    : Number(Math.max(0.85, storedPrice > 0 ? storedPrice / markupMultiplier : 2.50).toFixed(2));

  const rawSelected = String(prod.selectedLogisticName || optimalCarrier?.logisticName || 'CJPacket Sensitive Pro').trim();
  const selectedLogisticName =
    rawSelected === 'CJPacket Sensitive' && Number(prod.shippingCostUsd || 0) < 6.50
      ? (optimalCarrier?.logisticName || 'CJPacket Sensitive Pro')
      : rawSelected;

  const matchedRate = availableLogistics.find(
    r => String(r.logisticName || '').toLowerCase() === selectedLogisticName.toLowerCase()
  );

  const rawShipping = Number(prod.shippingCostUsd ?? matchedRate?.shippingCostUsd ?? optimalCarrier?.shippingCostUsd ?? 7.84);
  const shippingCostUsd = Number((rawShipping < 5.25 ? (matchedRate?.shippingCostUsd || 7.84) : rawShipping).toFixed(2));
  const shippingIncludedInPrice = prod.shippingIncludedInPrice !== false;
  const customLabelEnabled = Boolean(prod.customLabelConfig?.enabled);
  const customLabelName = prod.customLabelConfig?.packagingName || "Susan's Rose-Gold Custom Box & Seal";
  const customLabelCostUsd = customLabelEnabled
    ? Number(Number(prod.customLabelConfig?.packagingCostUsd || 0.65).toFixed(2))
    : 0;

  const computedRetail = Number(
    ((wholesalePriceUsd * markupMultiplier) + (shippingIncludedInPrice ? shippingCostUsd : 0) + customLabelCostUsd).toFixed(2)
  );
  const allInCostUsd = Number((wholesalePriceUsd + shippingCostUsd + customLabelCostUsd).toFixed(2));
  const minProfitFloorUsd = Number(
    Math.max(allInCostUsd + 8.00, ((wholesalePriceUsd + customLabelCostUsd + 6.00) / 0.75) + shippingCostUsd).toFixed(2)
  );

  const retailPrice = Number(Math.max(storedPrice > 0 ? storedPrice : computedRetail, minProfitFloorUsd).toFixed(2));

  return {
    wholesalePriceUsd,
    markupMultiplier,
    selectedLogisticName,
    shippingCostUsd,
    shippingIncludedInPrice,
    customLabelEnabled,
    customLabelName,
    customLabelCostUsd,
    allInCostUsd,
    minProfitFloorUsd,
    retailPrice,
    computedRetail,
    availableLogistics,
    optimalCarrier
  };
};

const AdminInventory = ({ onCatalogUpdated, onOpenTestsTab, onOpenBoxesTab }) => {
  const [inventory, setInventory] = useState([]);
  const [createForm, setCreateForm] = useState({
    title: '',
    price: '',
    wholesalePriceUsd: '2.50',
    markupMultiplier: '6.5',
    selectedLogisticName: 'CJPacket Sensitive Pro',
    shippingCostUsd: '7.84',
    shippingIncludedInPrice: true,
    customLabelEnabled: false,
    packagingName: "Susan's Rose-Gold Custom Box & Seal",
    packagingCostUsd: 0.65,
    imageUrl: '',
    description: '',
    tags: '',
    ritualStep: '',
    skinTypes: [],
    skinConcerns: []
  });
  const [editModalData, setEditModalData] = useState(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isAutoLabeling, setIsAutoLabeling] = useState(false);
  const [quotingProductId, setQuotingProductId] = useState(null);
  const [togglingLabelProductId, setTogglingLabelProductId] = useState(null);
  const [isBulkUpdatingShipping, setIsBulkUpdatingShipping] = useState(false);
  const [isSyncingAndSanitizing, setIsSyncingAndSanitizing] = useState(false);
  const [isSanitizingOnly, setIsSanitizingOnly] = useState(false);
  const [isSyncingAllCjShipping, setIsSyncingAllCjShipping] = useState(false);
  const [inventorySearchQuery, setInventorySearchQuery] = useState('');
  const [inventoryStepFilter, setInventoryStepFilter] = useState('ALL');
  const [inventoryMarginFilter, setInventoryMarginFilter] = useState('ALL');
  const [inventorySortBy, setInventorySortBy] = useState('DEFAULT');
  const [inlineDraftMap, setInlineDraftMap] = useState({});
  const [savingInlineProductId, setSavingInlineProductId] = useState(null);
  const [selectedMaxCatalogCap, setSelectedMaxCatalogCap] = useState(300);
  const [syncStatusTelemetry, setSyncStatusTelemetry] = useState({
    lastSyncAt: null,
    lastSanitizedAt: null,
    lastDuplicatesPurgedCount: 0,
    lastNonBeautyPurgedCount: 0,
    lastExcessCapPrunedCount: 0,
    maxCatalogCap: 300,
    activeCatalogTotal: 0,
    nextScheduledSync: 'Daily at 3:00 AM CST (America/Chicago)'
  });

  const [globalShippingControl, setGlobalShippingControl] = useState({
    selectedLogisticName: 'CJPacket Sensitive Pro',
    shippingIncludedInPrice: true,
    markupMultiplier: 6.5,
    enableCustomLabelAll: false,
    packagingName: "Susan's Rose-Gold Custom Box & Seal",
    packagingCostUsd: 0.65
  });

  const [opsBanner, setOpsBanner] = useState({ type: '', text: '' });

  const fetchInventory = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/products`);
      if (res.ok) {
        const list = await res.json();
        setInventory(list);
        if (onCatalogUpdated) onCatalogUpdated(list);
      }
    } catch (err) {
      console.error('Failed to fetch inventory:', err);
    }
  };

  const fetchCatalogSyncStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/admin/products/sync-status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSyncStatusTelemetry(prev => ({ ...prev, ...data }));
        if (data.maxCatalogCap) {
          setSelectedMaxCatalogCap(Number(data.maxCatalogCap) || 300);
        }
      }
    } catch (err) {
      console.error('Failed to fetch catalog sync status:', err);
    }
  };

  const handleFullSyncAndSanitize = async (sanitizeOnly = false) => {
    const token = localStorage.getItem('token');
    if (sanitizeOnly) setIsSanitizingOnly(true);
    else setIsSyncingAndSanitizing(true);
    setOpsBanner({ type: '', text: '' });

    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/products/sync-and-sanitize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          sanitizeOnly: Boolean(sanitizeOnly),
          maxCatalogCap: Number(selectedMaxCatalogCap) || 300
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (Array.isArray(data.products)) {
          setInventory(data.products);
          if (onCatalogUpdated) onCatalogUpdated(data.products);
        } else {
          await fetchInventory();
        }
        if (data.syncTelemetry) {
          setSyncStatusTelemetry(prev => ({ ...prev, ...data.syncTelemetry }));
        } else {
          await fetchCatalogSyncStatus();
        }
        setOpsBanner({
          type: 'success',
          text:
            data.message ||
            (sanitizeOnly
              ? '🧹 MongoDB catalog sanitized and deduplicated! ✧'
              : '✨ Full Beauty & Skincare sync + MongoDB sanitization complete! ✧')
        });
      } else {
        setOpsBanner({
          type: 'error',
          text: data.error || 'Failed to sync and sanitize beauty catalog.'
        });
      }
    } catch (err) {
      console.error('Full sync & sanitize error:', err);
      setOpsBanner({
        type: 'error',
        text: 'Network error while running Full Beauty Sync & Sanitization.'
      });
    }
    setIsSyncingAndSanitizing(false);
    setIsSanitizingOnly(false);
  };

  useEffect(() => {
    fetchInventory();
    fetchCatalogSyncStatus();
    // eslint-disable-next-line
  }, []);

  const toggleSelectionInArray = (arr = [], item) => {
    const list = Array.isArray(arr) ? arr : parseBlueprintList(arr);
    return list.includes(item) ? list.filter(x => x !== item) : [...list, item];
  };

  const handleBulkShippingAndPricingUpdate = async () => {
    const token = localStorage.getItem('token');
    setIsBulkUpdatingShipping(true);
    setOpsBanner({ type: '', text: '' });

    try {
      const matchedPkg =
        DEFAULT_CJ_PACKAGING_CHOICES.find(p => p.packagingName === globalShippingControl.packagingName) ||
        DEFAULT_CJ_PACKAGING_CHOICES[0];

      const res = await fetch(`${API_BASE_URL}/api/admin/products/bulk-shipping-update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          selectedLogisticName: globalShippingControl.selectedLogisticName,
          shippingIncludedInPrice: Boolean(globalShippingControl.shippingIncludedInPrice),
          markupMultiplier: Number(globalShippingControl.markupMultiplier) || 6.5,
          customLabelConfig: {
            enabled: Boolean(globalShippingControl.enableCustomLabelAll),
            labelType: matchedPkg.labelType,
            packagingVid: matchedPkg.packagingVid,
            packagingName: matchedPkg.packagingName,
            customBrandText: "Susan's Beauty Consulting ✧",
            packagingCostUsd: Number(globalShippingControl.packagingCostUsd || matchedPkg.packagingCostUsd)
          }
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (Array.isArray(data.products)) {
          setInventory(data.products);
          if (onCatalogUpdated) onCatalogUpdated(data.products);
        } else {
          await fetchInventory();
        }
        setOpsBanner({
          type: 'success',
          text: data.message || 'Recalculated all boutique product prices with CJ shipping & custom labeling! ✧'
        });
      } else {
        setOpsBanner({
          type: 'error',
          text: data.error || 'Failed to bulk-update CJ shipping and retail prices.'
        });
      }
    } catch (err) {
      console.error('Bulk shipping update error:', err);
      setOpsBanner({ type: 'error', text: 'Network error while updating global CJ shipping & prices.' });
    }
    setIsBulkUpdatingShipping(false);
  };

  const handleFetchProductShippingQuote = async (productId, selectedCarrier, overrides = {}) => {
    const token = localStorage.getItem('token');
    setQuotingProductId(productId);
    setOpsBanner({ type: '', text: '' });

    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/products/${productId}/shipping-quote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          selectedLogisticName: selectedCarrier,
          ...overrides
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.product) {
        const updatedBd = computeClientProductPriceBreakdown(data.product);
        setInlineDraftMap(prev => ({
          ...prev,
          [productId]: {
            price: String(updatedBd.retailPrice.toFixed(2)),
            wholesalePriceUsd: String(updatedBd.wholesalePriceUsd.toFixed(2)),
            shippingCostUsd: String(updatedBd.shippingCostUsd.toFixed(2)),
            selectedLogisticName: updatedBd.selectedLogisticName
          }
        }));
        setInventory(prev => {
          const next = prev.map(p => (p._id === productId ? data.product : p));
          if (onCatalogUpdated) onCatalogUpdated(next);
          return next;
        });
        if (editModalData && editModalData.id === productId) {
          const bd = computeClientProductPriceBreakdown(data.product);
          setEditModalData(prev => ({
            ...prev,
            price: bd.retailPrice,
            wholesalePriceUsd: bd.wholesalePriceUsd,
            markupMultiplier: bd.markupMultiplier,
            selectedLogisticName: bd.selectedLogisticName,
            shippingCostUsd: bd.shippingCostUsd,
            shippingIncludedInPrice: bd.shippingIncludedInPrice,
            availableLogistics: data.availableLogistics || data.product.availableLogistics || []
          }));
        }
        setOpsBanner({
          type: 'success',
          text: data.message || 'Updated CJ shipping rate and recalculated retail price! ✧'
        });
      } else {
        setOpsBanner({
          type: 'error',
          text: data.error || 'Could not fetch CJ shipping quote for product.'
        });
      }
    } catch (err) {
      console.error('Product shipping quote error:', err);
      setOpsBanner({ type: 'error', text: 'Network error while fetching CJ shipping quote.' });
    }
    setQuotingProductId(null);
  };

  const handleSyncAllLiveCjShipping = async (recalculatePrices = false) => {
    const token = localStorage.getItem('token');
    setIsSyncingAllCjShipping(true);
    setOpsBanner({ type: '', text: '' });

    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/products/sync-all-cj-shipping`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          limit: 60,
          recalculatePrices: Boolean(recalculatePrices),
          preferredLogisticName: globalShippingControl.selectedLogisticName || 'CJPacket Sensitive'
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (Array.isArray(data.products)) {
          setInventory(data.products);
          if (onCatalogUpdated) onCatalogUpdated(data.products);
        } else {
          await fetchInventory();
        }
        setInlineDraftMap({});
        setOpsBanner({
          type: 'success',
          text: data.message || '✈️ Synced live CJ Variant IDs, weights & carrier shipping rates across the catalog! ✧'
        });
      } else {
        setOpsBanner({
          type: 'error',
          text: data.error || 'Failed to batch-sync live CJ shipping rates.'
        });
      }
    } catch (err) {
      console.error('Batch sync CJ shipping error:', err);
      setOpsBanner({ type: 'error', text: 'Network error while batch-syncing live CJ shipping rates.' });
    }
    setIsSyncingAllCjShipping(false);
  };

  const handleInlineDraftChange = (prod, field, value) => {
    const bd = computeClientProductPriceBreakdown(prod);
    setInlineDraftMap(prev => {
      const current = prev[prod._id] || {
        price: String(bd.retailPrice.toFixed(2)),
        wholesalePriceUsd: String(bd.wholesalePriceUsd.toFixed(2)),
        shippingCostUsd: String(bd.shippingCostUsd.toFixed(2)),
        selectedLogisticName: bd.selectedLogisticName
      };
      return {
        ...prev,
        [prod._id]: {
          ...current,
          [field]: value
        }
      };
    });
  };

  const handleSaveInlineProductPricing = async (prod, { recalculateFromFormula = false } = {}) => {
    const token = localStorage.getItem('token');
    const bd = computeClientProductPriceBreakdown(prod);
    const draft = inlineDraftMap[prod._id] || {
      price: String(bd.retailPrice.toFixed(2)),
      wholesalePriceUsd: String(bd.wholesalePriceUsd.toFixed(2)),
      shippingCostUsd: String(bd.shippingCostUsd.toFixed(2)),
      selectedLogisticName: bd.selectedLogisticName
    };

    const parsedRetail = parseFloat(draft.price);
    const parsedWholesale = parseFloat(draft.wholesalePriceUsd);
    const parsedShipping = parseFloat(draft.shippingCostUsd);

    if (!recalculateFromFormula && (isNaN(parsedRetail) || parsedRetail <= 0)) {
      alert('Please enter a valid Retail Price ($).');
      return;
    }

    setSavingInlineProductId(prod._id);
    setOpsBanner({ type: '', text: '' });

    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/products/${prod._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: prod.title,
          price: !isNaN(parsedRetail) ? Number(parsedRetail.toFixed(2)) : bd.retailPrice,
          wholesalePriceUsd: !isNaN(parsedWholesale) ? Number(parsedWholesale.toFixed(2)) : bd.wholesalePriceUsd,
          shippingCostUsd: !isNaN(parsedShipping) ? Number(parsedShipping.toFixed(2)) : bd.shippingCostUsd,
          selectedLogisticName: draft.selectedLogisticName || bd.selectedLogisticName || 'CJPacket Sensitive',
          markupMultiplier: bd.markupMultiplier || 6.5,
          shippingIncludedInPrice: bd.shippingIncludedInPrice,
          recalculateFromWholesale: Boolean(recalculateFromFormula)
        })
      });
      const updatedProd = await res.json().catch(() => null);
      if (res.ok && updatedProd && updatedProd._id) {
        const nextBd = computeClientProductPriceBreakdown(updatedProd);
        setInlineDraftMap(prev => ({
          ...prev,
          [prod._id]: {
            price: String(nextBd.retailPrice.toFixed(2)),
            wholesalePriceUsd: String(nextBd.wholesalePriceUsd.toFixed(2)),
            shippingCostUsd: String(nextBd.shippingCostUsd.toFixed(2)),
            selectedLogisticName: nextBd.selectedLogisticName
          }
        }));
        setInventory(prev => {
          const next = prev.map(p => (p._id === prod._id ? updatedProd : p));
          if (onCatalogUpdated) onCatalogUpdated(next);
          return next;
        });
        const netProfit = Number((nextBd.retailPrice - nextBd.wholesalePriceUsd - nextBd.shippingCostUsd - (nextBd.customLabelEnabled ? nextBd.customLabelCostUsd : 0)).toFixed(2));
        setOpsBanner({
          type: netProfit > 0 ? 'success' : 'error',
          text: `💾 Saved "${updatedProd.title}" → Retail: $${nextBd.retailPrice.toFixed(2)} • Wholesale: $${nextBd.wholesalePriceUsd.toFixed(2)} • CJ Ship (${nextBd.selectedLogisticName}): $${nextBd.shippingCostUsd.toFixed(2)} • Net Profit: ${netProfit >= 0 ? '+' : ''}$${netProfit.toFixed(2)} ✧`
        });
      } else {
        setOpsBanner({
          type: 'error',
          text: updatedProd?.error || 'Failed to save product price and shipping.'
        });
      }
    } catch (err) {
      console.error('Inline save pricing error:', err);
      setOpsBanner({ type: 'error', text: 'Network error while saving product price and shipping.' });
    }
    setSavingInlineProductId(null);
  };

  const handleToggleProductCustomLabel = async (prod, nextEnabled, packagingNameOverride = null) => {
    const token = localStorage.getItem('token');
    setTogglingLabelProductId(prod._id);
    setOpsBanner({ type: '', text: '' });

    const chosenName = packagingNameOverride || prod.customLabelConfig?.packagingName || "Susan's Rose-Gold Custom Box & Seal";
    const matchedOpt =
      DEFAULT_CJ_PACKAGING_CHOICES.find(o => o.packagingName === chosenName) ||
      DEFAULT_CJ_PACKAGING_CHOICES[0];

    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/products/${prod._id}/custom-label`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          enabled: Boolean(nextEnabled),
          labelType: matchedOpt.labelType,
          packagingVid: matchedOpt.packagingVid,
          packagingName: matchedOpt.packagingName,
          customBrandText: prod.customLabelConfig?.customBrandText || "Susan's Beauty Consulting ✧",
          packagingCostUsd: matchedOpt.packagingCostUsd
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.product) {
        setInventory(prev => {
          const next = prev.map(p => (p._id === prod._id ? data.product : p));
          if (onCatalogUpdated) onCatalogUpdated(next);
          return next;
        });
        setOpsBanner({
          type: 'success',
          text: data.message || 'Updated product custom labeling & retail price! ✧'
        });
      } else {
        setOpsBanner({
          type: 'error',
          text: data.error || 'Failed to update product custom labeling.'
        });
      }
    } catch (err) {
      console.error('Toggle product custom label error:', err);
      setOpsBanner({ type: 'error', text: 'Network error while updating custom labeling.' });
    }
    setTogglingLabelProductId(null);
  };

  const handleAutoLabelAllProducts = async () => {
    const token = localStorage.getItem('token');
    setIsAutoLabeling(true);
    setOpsBanner({ type: '', text: '' });
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/products/reclassify-labels`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ forceAll: true })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (Array.isArray(data.products)) {
          setInventory(data.products);
          if (onCatalogUpdated) onCatalogUpdated(data.products);
        } else {
          await fetchInventory();
        }
        setOpsBanner({
          type: 'success',
          text: data.message || 'Labeled all boutique products with Skin Types, Skin Conditions & Ritual Steps! ✧'
        });
      } else {
        setOpsBanner({
          type: 'error',
          text: data.error || 'Failed to auto-label products for Blueprints.'
        });
      }
    } catch (err) {
      console.error('Auto-label error:', err);
      setOpsBanner({ type: 'error', text: 'Network error while auto-labeling products.' });
    }
    setIsAutoLabeling(false);
  };

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    const matchedPkg =
      DEFAULT_CJ_PACKAGING_CHOICES.find(p => p.packagingName === createForm.packagingName) ||
      DEFAULT_CJ_PACKAGING_CHOICES[0];

    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...createForm,
          wholesalePriceUsd: parseFloat(createForm.wholesalePriceUsd) || 2.50,
          markupMultiplier: parseFloat(createForm.markupMultiplier) || 6.5,
          shippingCostUsd: parseFloat(createForm.shippingCostUsd) || 4.49,
          shippingIncludedInPrice: Boolean(createForm.shippingIncludedInPrice),
          customLabelConfig: {
            enabled: Boolean(createForm.customLabelEnabled),
            labelType: matchedPkg.labelType,
            packagingVid: matchedPkg.packagingVid,
            packagingName: matchedPkg.packagingName,
            customBrandText: "Susan's Beauty Consulting ✧",
            packagingCostUsd: Boolean(createForm.customLabelEnabled) ? matchedPkg.packagingCostUsd : 0
          }
        })
      });
      if (res.ok) {
        const addedTitle = createForm.title;
        await fetchInventory();
        setCreateForm({
          title: '',
          price: '',
          wholesalePriceUsd: '2.50',
          markupMultiplier: '6.5',
          selectedLogisticName: 'CJPacket Sensitive',
          shippingCostUsd: '4.49',
          shippingIncludedInPrice: true,
          customLabelEnabled: false,
          packagingName: "Susan's Rose-Gold Custom Box & Seal",
          packagingCostUsd: 0.65,
          imageUrl: '',
          description: '',
          tags: '',
          ritualStep: '',
          skinTypes: [],
          skinConcerns: []
        });
        setOpsBanner({ type: 'success', text: `Added "${addedTitle}" with CJ shipping & Blueprint labels to the boutique inventory! ✧` });
      } else {
        const data = await res.json().catch(() => ({}));
        setOpsBanner({ type: 'error', text: data.error || 'Failed to add product.' });
      }
    } catch (err) {
      console.error('Create product error:', err);
      setOpsBanner({ type: 'error', text: 'Network error while adding product.' });
    }
  };

  const handleSaveModalEdit = async (e) => {
    e.preventDefault();
    if (!editModalData || !editModalData.id) return;
    setIsSavingEdit(true);
    const token = localStorage.getItem('token');

    const matchedPkg =
      DEFAULT_CJ_PACKAGING_CHOICES.find(p => p.packagingName === editModalData.customLabelName) ||
      DEFAULT_CJ_PACKAGING_CHOICES[0];

    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/products/${editModalData.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...editModalData,
          wholesalePriceUsd: parseFloat(editModalData.wholesalePriceUsd) || 2.50,
          markupMultiplier: parseFloat(editModalData.markupMultiplier) || 6.5,
          selectedLogisticName: editModalData.selectedLogisticName || 'CJPacket Sensitive',
          shippingCostUsd: parseFloat(editModalData.shippingCostUsd) || 4.49,
          shippingIncludedInPrice: Boolean(editModalData.shippingIncludedInPrice),
          customTitleLocked: Boolean(editModalData.customTitleLocked),
          recalculateFromWholesale: Boolean(editModalData.recalculateFromWholesale),
          customLabelConfig: {
            enabled: Boolean(editModalData.customLabelEnabled),
            labelType: matchedPkg.labelType,
            packagingVid: matchedPkg.packagingVid,
            packagingName: matchedPkg.packagingName,
            customBrandText: editModalData.customBrandText || "Susan's Beauty Consulting ✧",
            packagingCostUsd: Boolean(editModalData.customLabelEnabled)
              ? Number(editModalData.customLabelCostUsd || matchedPkg.packagingCostUsd)
              : 0
          }
        })
      });
      if (res.ok) {
        const updatedTitle = editModalData.title;
        setEditModalData(null);
        await fetchInventory();
        setOpsBanner({ type: 'success', text: `Updated "${updatedTitle}", CJ shipping method, custom labeling & Blueprint labels! ✧` });
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Failed to update product.');
      }
    } catch (err) {
      console.error('Update product error:', err);
      alert('Network error while updating product.');
    }
    setIsSavingEdit(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this product? It will be removed from the boutique immediately.')) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/products/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        if (editModalData && editModalData.id === id) setEditModalData(null);
        await fetchInventory();
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const handleEditClick = (prod) => {
    const rawDesc = prod.description || prod.rawCjData?.description || '';
    const cleanDesc = typeof rawDesc === 'string' ? rawDesc.replace(/<[^>]*>?/gm, '') : '';
    const meta = deriveProductBlueprintMeta(prod);
    const bd = computeClientProductPriceBreakdown(prod);

    setEditModalData({
      id: prod._id,
      title: prod.title || '',
      cjPid: prod.cjPid || prod.rawCjData?.pid || '',
      cjSku: prod.cjSku || prod.rawCjData?.productSku || prod.variants?.[0]?.sku || '',
      customTitleLocked: Boolean(prod.customTitleLocked),
      price: bd.retailPrice,
      wholesalePriceUsd: bd.wholesalePriceUsd,
      markupMultiplier: bd.markupMultiplier,
      selectedLogisticName: bd.selectedLogisticName,
      shippingCostUsd: bd.shippingCostUsd,
      shippingIncludedInPrice: bd.shippingIncludedInPrice,
      customLabelEnabled: bd.customLabelEnabled,
      customLabelName: bd.customLabelName,
      customLabelCostUsd: bd.customLabelCostUsd || 0.65,
      customBrandText: prod.customLabelConfig?.customBrandText || "Susan's Beauty Consulting ✧",
      recalculateFromWholesale: false,
      availableLogistics: Array.isArray(prod.availableLogistics) ? prod.availableLogistics : [],
      imageUrl: prod.imageUrl || prod.variants?.[0]?.imageUrl || '',
      description: cleanDesc,
      tags: Array.isArray(prod.tags) ? prod.tags.join(', ') : (prod.tags || ''),
      ritualStep: meta.ritualStep,
      skinTypes: meta.skinTypes,
      skinConcerns: meta.skinConcerns
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '25px', animation: 'fadeIn 0.5s ease' }}>
      {/* Strict Uncapped Skincare & Beauty Catalog Sync & Perfume Purge Command Bar */}
      <div style={{ backgroundColor: '#FFFFFF', padding: '22px 26px', borderRadius: '20px', border: '2px solid #B38B8F', boxShadow: '0 8px 25px rgba(179, 139, 143, 0.18)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.95rem', color: '#5C5454', margin: 0 }}>
                ✨ Strict Skincare & Beauty Catalog Sync & Sanitization
              </h2>
              <span style={{ backgroundColor: '#F6FBF7', color: '#2E7D32', border: '1px solid #A5D6A7', padding: '4px 12px', borderRadius: '14px', fontSize: '0.78rem', fontWeight: 'bold', fontFamily: 'sans-serif' }}>
                🚫 Perfume, Hair, Nail & Oral Blocked • ⏰ 3:00 AM CST Sync
              </span>
            </div>
            <p style={{ margin: '5px 0 0 0', fontSize: '0.88rem', color: '#8A797A', fontFamily: 'sans-serif', lineHeight: '1.45' }}>
              Pulls every genuine <strong>Skincare & Facial/Cosmetic Beauty</strong> product from CJ Dropshipping without an artificial cap, blocks perfumes, fragrances, hair/wig items, nail drills/gels, and oral care, and merges multi-size seller clones into one canonical product.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              disabled={isSyncingAndSanitizing || isSanitizingOnly}
              onClick={() => handleFullSyncAndSanitize(false)}
              style={{ backgroundColor: '#F2D4D7', border: '1px solid #B38B8F', color: '#5C5454', padding: '10px 18px', borderRadius: '22px', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.08rem', fontWeight: 'bold', cursor: (isSyncingAndSanitizing || isSanitizingOnly) ? 'not-allowed' : 'pointer', boxShadow: '0 4px 12px rgba(179, 139, 143, 0.25)' }}
            >
              {isSyncingAndSanitizing ? '⏳ Syncing All Skincare & Beauty...' : '✨ Sync All Skincare & Beauty'}
            </button>
            <button
              type="button"
              disabled={isSyncingAndSanitizing || isSanitizingOnly}
              onClick={() => handleFullSyncAndSanitize(true)}
              style={{ backgroundColor: '#FFF0F2', border: '1px solid #B38B8F', color: '#5C5454', padding: '10px 16px', borderRadius: '22px', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.02rem', fontWeight: 'bold', cursor: (isSyncingAndSanitizing || isSanitizingOnly) ? 'not-allowed' : 'pointer' }}
            >
              {isSanitizingOnly ? '⏳ Purging Non-Skincare & Duplicates...' : '🧹 Purge Perfume & Non-Skincare Now'}
            </button>
          </div>
        </div>

        {/* Live Telemetry Status Bar */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', backgroundColor: '#FFF9F9', padding: '10px 14px', borderRadius: '12px', border: '1px solid #E8C5C8', fontFamily: 'sans-serif', fontSize: '0.8rem', color: '#5C5454' }}>
          <span style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8C5C8', borderRadius: '10px', padding: '4px 10px', fontWeight: 'bold' }}>
            📦 Active Skincare & Beauty: <strong style={{ color: '#B38B8F' }}>{inventory.length} unique products</strong>
          </span>
          <span style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8C5C8', borderRadius: '10px', padding: '4px 10px' }}>
            🚫 Perfume / Non-Skincare Purged: <strong style={{ color: '#C62828' }}>{syncStatusTelemetry.lastNonBeautyPurgedCount || 0}</strong>
          </span>
          <span style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8C5C8', borderRadius: '10px', padding: '4px 10px' }}>
            ♻️ Duplicates Merged: <strong style={{ color: '#2E7D32' }}>{syncStatusTelemetry.lastDuplicatesPurgedCount || 0}</strong>
          </span>
          <span style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8C5C8', borderRadius: '10px', padding: '4px 10px' }}>
            🧹 Last Sanitized:{' '}
            <strong>
              {syncStatusTelemetry.lastSanitizedAt
                ? new Date(syncStatusTelemetry.lastSanitizedAt).toLocaleString()
                : 'Verified on Startup'}
            </strong>
          </span>
        </div>
      </div>

      {/* Global CJ Shipping & Custom Label Control Bar */}
      <div style={{ backgroundColor: '#FFFFFF', padding: '22px 26px', borderRadius: '20px', border: '1.5px solid #B38B8F', boxShadow: '0 8px 25px rgba(232, 197, 200, 0.18)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.95rem', color: '#5C5454', margin: 0 }}>
                ✈️ Global CJ Shipping, Custom Label & Retail Pricing Engine ✧
              </h2>
              <span style={{ backgroundColor: '#F6FBF7', color: '#2E7D32', border: '1px solid #A5D6A7', padding: '3px 10px', borderRadius: '12px', fontSize: '0.76rem', fontWeight: 'bold', fontFamily: 'sans-serif' }}>
                Formula: (Wholesale × Markup) + CJ Shipping + Custom Label = Retail
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.88rem', color: '#8A797A', fontFamily: 'sans-serif' }}>
              Switch the default CJ shipping carrier, toggle shipping-inclusive pricing or Susan's custom packaging, and recalculate all {inventory.length} boutique product prices in 1 click.
            </p>
          </div>

          {onOpenBoxesTab && (
            <button
              type="button"
              onClick={onOpenBoxesTab}
              style={{ backgroundColor: '#FFF0F2', border: '1px solid #B38B8F', color: '#5C5454', padding: '8px 16px', borderRadius: '20px', fontFamily: "'Cormorant Garamond', serif", fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer' }}
            >
              🎁 Open Monthly Boxes & CJ Studio →
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', alignItems: 'center', backgroundColor: '#FFF9F9', padding: '14px 16px', borderRadius: '14px', border: '1px solid #E8C5C8' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 'bold', color: '#8A797A', fontFamily: 'sans-serif', marginBottom: '4px' }}>
              Default CJ Shipping Carrier:
            </label>
            <select
              value={globalShippingControl.selectedLogisticName}
              onChange={(e) => setGlobalShippingControl(prev => ({ ...prev, selectedLogisticName: e.target.value }))}
              style={{ width: '100%', padding: '9px 10px', borderRadius: '10px', border: '1px solid #E8C5C8', backgroundColor: '#FFFFFF', color: '#5C5454', fontFamily: 'sans-serif', fontSize: '0.86rem' }}
            >
              {CJ_CARRIER_OPTIONS.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 'bold', color: '#8A797A', fontFamily: 'sans-serif', marginBottom: '4px' }}>
              Retail Markup Multiplier:
            </label>
            <input
              type="number"
              step="0.1"
              min="1"
              value={globalShippingControl.markupMultiplier}
              onChange={(e) => setGlobalShippingControl(prev => ({ ...prev, markupMultiplier: e.target.value }))}
              style={{ width: '100%', padding: '9px 10px', borderRadius: '10px', border: '1px solid #E8C5C8', backgroundColor: '#FFFFFF', color: '#5C5454', fontFamily: 'sans-serif', fontSize: '0.86rem', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 'bold', color: '#8A797A', fontFamily: 'sans-serif', marginBottom: '4px' }}>
              CJ Custom Packaging Style:
            </label>
            <select
              value={globalShippingControl.packagingName}
              onChange={(e) => {
                const chosen = DEFAULT_CJ_PACKAGING_CHOICES.find(o => o.packagingName === e.target.value);
                setGlobalShippingControl(prev => ({
                  ...prev,
                  packagingName: e.target.value,
                  packagingCostUsd: chosen ? chosen.packagingCostUsd : prev.packagingCostUsd
                }));
              }}
              style={{ width: '100%', padding: '9px 10px', borderRadius: '10px', border: '1px solid #E8C5C8', backgroundColor: '#FFFFFF', color: '#5C5454', fontFamily: 'sans-serif', fontSize: '0.84rem' }}
            >
              {DEFAULT_CJ_PACKAGING_CHOICES.map(opt => (
                <option key={opt.packagingVid} value={opt.packagingName}>
                  {opt.packagingName} (+${opt.packagingCostUsd.toFixed(2)})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: '#5C5454', fontFamily: 'sans-serif', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={Boolean(globalShippingControl.shippingIncludedInPrice)}
                onChange={(e) => setGlobalShippingControl(prev => ({ ...prev, shippingIncludedInPrice: e.target.checked }))}
              />
              <strong>Include CJ Shipping in Retail Price</strong>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: '#5C5454', fontFamily: 'sans-serif', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={Boolean(globalShippingControl.enableCustomLabelAll)}
                onChange={(e) => setGlobalShippingControl(prev => ({ ...prev, enableCustomLabelAll: e.target.checked }))}
              />
              <strong>Enable Custom Label on All Products</strong>
            </label>
          </div>

          <div>
            <button
              type="button"
              disabled={isBulkUpdatingShipping}
              onClick={handleBulkShippingAndPricingUpdate}
              style={{ width: '100%', backgroundColor: '#F2D4D7', border: '1px solid #B38B8F', color: '#5C5454', padding: '11px 14px', borderRadius: '20px', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.08rem', fontWeight: 'bold', cursor: isBulkUpdatingShipping ? 'not-allowed' : 'pointer' }}
            >
              {isBulkUpdatingShipping ? '⏳ Recalculating Catalog...' : '✈️ Recalculate All Catalog Prices ✧'}
            </button>
          </div>
        </div>
      </div>

      {/* Pop-Up Edit Product Modal */}
      {editModalData && (
        <div
          onClick={() => !isSavingEdit && setEditModalData(null)}
          style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            backgroundColor: 'rgba(92, 84, 84, 0.55)', backdropFilter: 'blur(4px)',
            zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px', boxSizing: 'border-box', animation: 'fadeIn 0.25s ease'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#FFF9F9', border: '1.5px solid #B38B8F', borderRadius: '22px',
              padding: '30px', maxWidth: '640px', width: '100%', maxHeight: '92vh', overflowY: 'auto',
              boxShadow: '0 15px 40px rgba(92, 84, 84, 0.35)', position: 'relative', boxSizing: 'border-box'
            }}
          >
            <button
              type="button"
              onClick={() => setEditModalData(null)}
              style={{ position: 'absolute', top: '16px', right: '20px', background: 'none', border: 'none', fontSize: '1.5rem', color: '#8A797A', cursor: 'pointer' }}
            >
              ✕
            </button>

            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2rem', color: '#B38B8F', margin: '0 0 6px 0' }}>
              Edit Boutique Product, CJ Shipping & Custom Label ✧
            </h2>
            <p style={{ margin: '0 0 16px 0', fontSize: '0.88rem', color: '#8A797A', fontFamily: 'sans-serif' }}>
              Adjust wholesale cost, live CJ shipping carrier, custom packaging, and Blueprint skin-condition labels.
            </p>

            {/* Live All-In Price & Net Profit After Shipping Banner inside Modal */}
            {(() => {
              const w = parseFloat(editModalData.wholesalePriceUsd) || 0;
              const m = parseFloat(editModalData.markupMultiplier) || 6.5;
              const shipRaw = parseFloat(editModalData.shippingCostUsd) || 0;
              const s = editModalData.shippingIncludedInPrice ? shipRaw : 0;
              const l = editModalData.customLabelEnabled ? (parseFloat(editModalData.customLabelCostUsd) || 0.65) : 0;
              const calcTotal = Number(((w * m) + s + l).toFixed(2));
              const activeRetail = editModalData.recalculateFromWholesale
                ? calcTotal
                : (parseFloat(editModalData.price) || calcTotal);
              const totalCjCost = Number((w + shipRaw + l).toFixed(2));
              const netProfit = Number((activeRetail - totalCjCost).toFixed(2));

              return (
                <div style={{ backgroundColor: netProfit <= 0 ? '#FFF5F5' : '#FFF0F2', border: `1.5px solid ${netProfit <= 0 ? '#C62828' : '#B38B8F'}`, borderRadius: '14px', padding: '12px 16px', marginBottom: '16px', fontFamily: 'sans-serif', fontSize: '0.84rem', color: '#5C5454', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <strong>All-In CJ Unit Cost vs. Retail Price:</strong>
                    <span style={{ color: netProfit <= 0 ? '#C62828' : '#2E7D32', fontWeight: 'bold', fontSize: '0.92rem' }}>
                      CJ Wholesale (${w.toFixed(2)}) + CJ Shipping (${shipRaw.toFixed(2)}) + Label (${l.toFixed(2)}) = ${totalCjCost.toFixed(2)} Cost → Retail: ${activeRetail.toFixed(2)} ({netProfit >= 0 ? `+$${netProfit.toFixed(2)} Net Profit` : `🚨 -$${Math.abs(netProfit).toFixed(2)} LOSS`})
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', fontSize: '0.78rem', color: '#736A6A' }}>
                    <span>
                      Mode: <strong>{editModalData.recalculateFromWholesale ? `🧮 Formula (${m}x Markup = $${calcTotal.toFixed(2)})` : `🔒 Custom Retail Price ($${activeRetail.toFixed(2)})`}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => setEditModalData(prev => ({
                        ...prev,
                        price: calcTotal,
                        recalculateFromWholesale: false
                      }))}
                      style={{ backgroundColor: '#FFFFFF', border: '1px solid #B38B8F', color: '#5C5454', borderRadius: '10px', padding: '3px 10px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                      🧮 Apply {m}x Formula (${calcTotal.toFixed(2)}) to Retail Box
                    </button>
                  </div>
                </div>
              );
            })()}

            <form onSubmit={handleSaveModalEdit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' }}>
                  <label style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.05rem', color: '#5C5454', fontWeight: 'bold' }}>
                    Product Title
                  </label>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {editModalData.cjPid && (
                      <span style={{ backgroundColor: '#FFF0F2', color: '#736A6A', border: '1px solid #E8C5C8', borderRadius: '8px', padding: '2px 8px', fontSize: '0.72rem', fontFamily: 'sans-serif' }}>
                        CJ PID: <strong>{editModalData.cjPid}</strong>
                      </span>
                    )}
                    {editModalData.cjSku && (
                      <span style={{ backgroundColor: '#FFF0F2', color: '#736A6A', border: '1px solid #E8C5C8', borderRadius: '8px', padding: '2px 8px', fontSize: '0.72rem', fontFamily: 'sans-serif' }}>
                        SKU: <strong>{editModalData.cjSku}</strong>
                      </span>
                    )}
                  </div>
                </div>
                <input
                  required
                  type="text"
                  value={editModalData.title}
                  onChange={e => setEditModalData({ ...editModalData, title: e.target.value, customTitleLocked: true })}
                  style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #E8C5C8', backgroundColor: '#FFFFFF', outline: 'none', fontFamily: 'sans-serif', fontSize: '0.92rem', boxSizing: 'border-box' }}
                />
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginTop: '8px', padding: '8px 10px', borderRadius: '8px', backgroundColor: '#FFFFFF', border: '1px solid #E8C5C8', fontSize: '0.78rem', color: '#5C5454', fontFamily: 'sans-serif', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={Boolean(editModalData.customTitleLocked)}
                    onChange={e => setEditModalData({ ...editModalData, customTitleLocked: e.target.checked })}
                    style={{ marginTop: '2px' }}
                  />
                  <span>
                    <strong>🔒 Lock Custom Title:</strong> Daily 3:00 AM CST syncs will update pricing, stock, and shipping rates without overwriting your custom boutique name.
                  </span>
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#5C5454', marginBottom: '4px', fontWeight: 'bold', fontFamily: 'sans-serif' }}>CJ Wholesale ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editModalData.wholesalePriceUsd}
                    onChange={e => setEditModalData({ ...editModalData, wholesalePriceUsd: e.target.value })}
                    style={{ width: '100%', padding: '9px', borderRadius: '8px', border: '1px solid #E8C5C8', backgroundColor: '#FFFFFF', fontFamily: 'sans-serif', fontSize: '0.9rem', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#5C5454', marginBottom: '4px', fontWeight: 'bold', fontFamily: 'sans-serif' }}>Markup (e.g. 6.5x)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editModalData.markupMultiplier}
                    onChange={e => {
                      const nextM = parseFloat(e.target.value) || 6.5;
                      const w = parseFloat(editModalData.wholesalePriceUsd) || 0;
                      const s = editModalData.shippingIncludedInPrice ? (parseFloat(editModalData.shippingCostUsd) || 0) : 0;
                      const l = editModalData.customLabelEnabled ? (parseFloat(editModalData.customLabelCostUsd) || 0.65) : 0;
                      setEditModalData({
                        ...editModalData,
                        markupMultiplier: e.target.value,
                        price: Number(((w * nextM) + s + l).toFixed(2)),
                        recalculateFromWholesale: false
                      });
                    }}
                    style={{ width: '100%', padding: '9px', borderRadius: '8px', border: '1px solid #E8C5C8', backgroundColor: '#FFFFFF', fontFamily: 'sans-serif', fontSize: '0.9rem', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#5C5454', marginBottom: '4px', fontWeight: 'bold', fontFamily: 'sans-serif' }}>CJ Shipping ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editModalData.shippingCostUsd}
                    onChange={e => setEditModalData({ ...editModalData, shippingCostUsd: e.target.value })}
                    style={{ width: '100%', padding: '9px', borderRadius: '8px', border: '1px solid #E8C5C8', backgroundColor: '#FFFFFF', fontFamily: 'sans-serif', fontSize: '0.9rem', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#2E7D32', marginBottom: '4px', fontWeight: 'bold', fontFamily: 'sans-serif' }}>Retail Price ($ Custom)</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    value={editModalData.price}
                    onChange={e => setEditModalData({ ...editModalData, price: e.target.value, recalculateFromWholesale: false })}
                    style={{ width: '100%', padding: '9px', borderRadius: '8px', border: '2px solid #2E7D32', backgroundColor: '#F6FBF7', fontFamily: 'sans-serif', fontSize: '0.95rem', fontWeight: 'bold', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* CJ Shipping Carrier Selector + Live Quote Button */}
              <div style={{ backgroundColor: '#FFFFFF', padding: '12px', borderRadius: '10px', border: '1px solid #E8C5C8', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <strong style={{ fontSize: '0.88rem', color: '#5C5454', fontFamily: 'sans-serif' }}>
                    ✈️ CJ Shipping Method & Live Rate Calculator
                  </strong>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#5C5454', fontFamily: 'sans-serif', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={Boolean(editModalData.shippingIncludedInPrice)}
                      onChange={e => setEditModalData({ ...editModalData, shippingIncludedInPrice: e.target.checked, recalculateFromWholesale: true })}
                    />
                    Include CJ Shipping in Retail Price
                  </label>
                </div>

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <select
                    value={editModalData.selectedLogisticName}
                    onChange={e => setEditModalData({ ...editModalData, selectedLogisticName: e.target.value, recalculateFromWholesale: true })}
                    style={{ flex: 1, padding: '9px 10px', borderRadius: '8px', border: '1px solid #E8C5C8', backgroundColor: '#FFF9F9', color: '#5C5454', fontFamily: 'sans-serif', fontSize: '0.88rem' }}
                  >
                    {CJ_CARRIER_OPTIONS.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>

                  <button
                    type="button"
                    disabled={quotingProductId === editModalData.id}
                    onClick={() => handleFetchProductShippingQuote(editModalData.id, editModalData.selectedLogisticName)}
                    style={{ backgroundColor: '#FFF0F2', border: '1px solid #B38B8F', color: '#5C5454', padding: '8px 14px', borderRadius: '14px', fontSize: '0.84rem', fontWeight: 'bold', fontFamily: 'sans-serif', cursor: 'pointer' }}
                  >
                    {quotingProductId === editModalData.id ? '⏳ Quoting CJ...' : '↻ Fetch Live CJ Rate'}
                  </button>
                </div>
              </div>

              {/* CJ Custom Label & Private Packaging Controls */}
              <div style={{ backgroundColor: '#FFFFFF', padding: '12px', borderRadius: '10px', border: '1px solid #E8C5C8', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.88rem', color: '#5C5454', fontFamily: 'sans-serif', cursor: 'pointer', fontWeight: 'bold' }}>
                    <input
                      type="checkbox"
                      checked={Boolean(editModalData.customLabelEnabled)}
                      onChange={e => setEditModalData({ ...editModalData, customLabelEnabled: e.target.checked, recalculateFromWholesale: true })}
                    />
                    🏷️ Enable CJ Custom Label / Branded Packaging
                  </label>
                  <span style={{ fontSize: '0.78rem', color: '#B38B8F', fontFamily: 'sans-serif', fontWeight: 'bold' }}>
                    +${Number(editModalData.customLabelEnabled ? editModalData.customLabelCostUsd : 0).toFixed(2)} / unit
                  </span>
                </div>

                {editModalData.customLabelEnabled && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '10px' }}>
                    <select
                      value={editModalData.customLabelName}
                      onChange={e => {
                        const matched = DEFAULT_CJ_PACKAGING_CHOICES.find(o => o.packagingName === e.target.value);
                        setEditModalData({
                          ...editModalData,
                          customLabelName: e.target.value,
                          customLabelCostUsd: matched ? matched.packagingCostUsd : editModalData.customLabelCostUsd,
                          recalculateFromWholesale: true
                        });
                      }}
                      style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #E8C5C8', backgroundColor: '#FFF9F9', fontSize: '0.84rem', fontFamily: 'sans-serif', color: '#5C5454' }}
                    >
                      {DEFAULT_CJ_PACKAGING_CHOICES.map(opt => (
                        <option key={opt.packagingVid} value={opt.packagingName}>
                          {opt.packagingName} (+${opt.packagingCostUsd.toFixed(2)})
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="Custom Brand Text"
                      value={editModalData.customBrandText}
                      onChange={e => setEditModalData({ ...editModalData, customBrandText: e.target.value })}
                      style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #E8C5C8', fontSize: '0.84rem', fontFamily: 'sans-serif' }}
                    />
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.05rem', color: '#5C5454', marginBottom: '4px', fontWeight: 'bold' }}>Ritual Step Badge</label>
                <select
                  value={editModalData.ritualStep || ''}
                  onChange={e => setEditModalData({ ...editModalData, ritualStep: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #E8C5C8', backgroundColor: '#FFFFFF', outline: 'none', fontFamily: 'sans-serif', fontSize: '0.9rem', color: '#5C5454', boxSizing: 'border-box' }}
                >
                  <option value="">Auto-Detect Step from Title</option>
                  {BLUEPRINT_RITUAL_STEP_OPTIONS.map(stepOpt => (
                    <option key={stepOpt} value={stepOpt}>{stepOpt}</option>
                  ))}
                </select>
              </div>

              {/* Skin Types Multi-Select Pills */}
              <div style={{ backgroundColor: '#FFFFFF', padding: '12px', borderRadius: '10px', border: '1px solid #E8C5C8' }}>
                <label style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.05rem', color: '#5C5454', marginBottom: '6px', fontWeight: 'bold' }}>
                  Best for Skin Types (click to toggle):
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {BLUEPRINT_SKIN_TYPE_OPTIONS.map(st => {
                    const selected = Array.isArray(editModalData.skinTypes) && editModalData.skinTypes.includes(st);
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setEditModalData({
                          ...editModalData,
                          skinTypes: toggleSelectionInArray(editModalData.skinTypes, st)
                        })}
                        style={{
                          padding: '5px 11px',
                          borderRadius: '14px',
                          fontSize: '0.8rem',
                          fontFamily: 'sans-serif',
                          fontWeight: selected ? 'bold' : 'normal',
                          backgroundColor: selected ? '#F2D4D7' : '#FFF9F9',
                          color: '#5C5454',
                          border: selected ? '1.5px solid #B38B8F' : '1px solid #E8C5C8',
                          cursor: 'pointer'
                        }}
                      >
                        {selected ? `✓ ${st}` : st}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Skin Concerns Multi-Select Pills */}
              <div style={{ backgroundColor: '#FFFFFF', padding: '12px', borderRadius: '10px', border: '1px solid #E8C5C8' }}>
                <label style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.05rem', color: '#5C5454', marginBottom: '6px', fontWeight: 'bold' }}>
                  Targets Skin Conditions / Goals (click to toggle):
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {BLUEPRINT_CONCERN_OPTIONS.map(sc => {
                    const selected = Array.isArray(editModalData.skinConcerns) && editModalData.skinConcerns.includes(sc);
                    return (
                      <button
                        key={sc}
                        type="button"
                        onClick={() => setEditModalData({
                          ...editModalData,
                          skinConcerns: toggleSelectionInArray(editModalData.skinConcerns, sc)
                        })}
                        style={{
                          padding: '5px 11px',
                          borderRadius: '14px',
                          fontSize: '0.8rem',
                          fontFamily: 'sans-serif',
                          fontWeight: selected ? 'bold' : 'normal',
                          backgroundColor: selected ? '#F6FBF7' : '#FFF9F9',
                          color: selected ? '#2E7D32' : '#5C5454',
                          border: selected ? '1.5px solid #2E7D32' : '1px solid #E8C5C8',
                          cursor: 'pointer'
                        }}
                      >
                        {selected ? `✨ ${sc}` : sc}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.05rem', color: '#5C5454', marginBottom: '4px', fontWeight: 'bold' }}>Image URL (HTTPS)</label>
                  <input
                    type="url"
                    value={editModalData.imageUrl}
                    onChange={e => setEditModalData({ ...editModalData, imageUrl: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #E8C5C8', backgroundColor: '#FFFFFF', outline: 'none', fontFamily: 'sans-serif', fontSize: '0.9rem', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.05rem', color: '#5C5454', marginBottom: '4px', fontWeight: 'bold' }}>Tags (comma-separated)</label>
                  <input
                    type="text"
                    value={editModalData.tags}
                    onChange={e => setEditModalData({ ...editModalData, tags: e.target.value })}
                    placeholder="skincare, serum, hydration"
                    style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #E8C5C8', backgroundColor: '#FFFFFF', outline: 'none', fontFamily: 'sans-serif', fontSize: '0.9rem', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.05rem', color: '#5C5454', marginBottom: '4px', fontWeight: 'bold' }}>Description</label>
                <textarea
                  rows="3"
                  value={editModalData.description}
                  onChange={e => setEditModalData({ ...editModalData, description: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #E8C5C8', backgroundColor: '#FFFFFF', outline: 'none', resize: 'vertical', fontFamily: 'sans-serif', fontSize: '0.9rem', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setEditModalData(null)}
                  style={{ flex: 1, backgroundColor: '#FFFFFF', color: '#736A6A', padding: '12px', borderRadius: '25px', border: '1px solid #E8C5C8', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.15rem', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  style={{ flex: 2, backgroundColor: '#F2D4D7', color: '#5C5454', padding: '12px', borderRadius: '25px', border: '1px solid #B38B8F', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.2rem', fontWeight: 'bold', cursor: isSavingEdit ? 'not-allowed' : 'pointer' }}
                >
                  {isSavingEdit ? 'Saving Changes...' : 'Update Product & Pricing ✧'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {opsBanner.text && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '10px',
          fontFamily: 'sans-serif',
          fontSize: '0.95rem',
          backgroundColor: opsBanner.type === 'success' ? '#F6FBF7' : '#FFF5F5',
          color: opsBanner.type === 'success' ? '#2E7D32' : '#C62828',
          border: `1px solid ${opsBanner.type === 'success' ? '#A5D6A7' : '#FFCDD2'}`
        }}>
          {opsBanner.text}
        </div>
      )}

      <div style={{ display: 'flex', gap: '30px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ width: '360px', flexShrink: 0, backgroundColor: '#FFFFFF', padding: '25px', borderRadius: '20px', border: '1px solid #E8C5C8', boxShadow: '0 10px 30px rgba(232, 197, 200, 0.15)', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", color: '#B38B8F', margin: 0, fontSize: '1.8rem' }}>
              Add Custom Product
            </h2>
          </div>

          <form onSubmit={handleCreateProduct} style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}>
            <input required type="text" placeholder="Product Title" value={createForm.title} onChange={e => setCreateForm({...createForm, title: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #E8C5C8', outline: 'none' }} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <input type="number" step="0.01" placeholder="Wholesale ($)" value={createForm.wholesalePriceUsd} onChange={e => setCreateForm({...createForm, wholesalePriceUsd: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #E8C5C8', outline: 'none' }} />
              <input type="number" step="0.01" placeholder="Retail Price ($ optional)" value={createForm.price} onChange={e => setCreateForm({...createForm, price: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #E8C5C8', outline: 'none' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '8px' }}>
              <select
                value={createForm.selectedLogisticName}
                onChange={e => setCreateForm({ ...createForm, selectedLogisticName: e.target.value })}
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid #E8C5C8', backgroundColor: '#FFF9F9', fontSize: '0.84rem', color: '#5C5454' }}
              >
                {CJ_CARRIER_OPTIONS.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <input type="number" step="0.01" placeholder="CJ Ship ($)" value={createForm.shippingCostUsd} onChange={e => setCreateForm({...createForm, shippingCostUsd: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #E8C5C8', outline: 'none' }} />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#5C5454', fontFamily: 'sans-serif', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={Boolean(createForm.customLabelEnabled)}
                onChange={e => setCreateForm({ ...createForm, customLabelEnabled: e.target.checked })}
              />
              🏷️ Include Susan's Rose-Gold Custom Label (+$0.65)
            </label>

            <select
              value={createForm.ritualStep}
              onChange={e => setCreateForm({ ...createForm, ritualStep: e.target.value })}
              style={{ padding: '10px', borderRadius: '8px', border: '1px solid #E8C5C8', outline: 'none', backgroundColor: '#FFF9F9', color: '#5C5454', fontFamily: 'sans-serif', fontSize: '0.86rem' }}
            >
              <option value="">Ritual Step (Auto-Detect if blank)</option>
              {BLUEPRINT_RITUAL_STEP_OPTIONS.map(stepOpt => (
                <option key={stepOpt} value={stepOpt}>{stepOpt}</option>
              ))}
            </select>

            <div style={{ backgroundColor: '#FFF9F9', padding: '10px', borderRadius: '8px', border: '1px solid #E8C5C8' }}>
              <span style={{ display: 'block', fontSize: '0.78rem', fontWeight: 'bold', color: '#5C5454', marginBottom: '6px', fontFamily: 'sans-serif' }}>
                Best for Skin Types (optional — auto-labeled if blank):
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                {BLUEPRINT_SKIN_TYPE_OPTIONS.map(st => {
                  const selected = createForm.skinTypes.includes(st);
                  return (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setCreateForm({
                        ...createForm,
                        skinTypes: toggleSelectionInArray(createForm.skinTypes, st)
                      })}
                      style={{
                        padding: '4px 9px',
                        borderRadius: '12px',
                        fontSize: '0.74rem',
                        fontFamily: 'sans-serif',
                        fontWeight: selected ? 'bold' : 'normal',
                        backgroundColor: selected ? '#F2D4D7' : '#FFFFFF',
                        color: '#5C5454',
                        border: selected ? '1.5px solid #B38B8F' : '1px solid #E8C5C8',
                        cursor: 'pointer'
                      }}
                    >
                      {selected ? `✓ ${st}` : st}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ backgroundColor: '#FFF9F9', padding: '10px', borderRadius: '8px', border: '1px solid #E8C5C8' }}>
              <span style={{ display: 'block', fontSize: '0.78rem', fontWeight: 'bold', color: '#5C5454', marginBottom: '6px', fontFamily: 'sans-serif' }}>
                Targets Skin Conditions (optional — auto-labeled if blank):
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                {BLUEPRINT_CONCERN_OPTIONS.map(sc => {
                  const selected = createForm.skinConcerns.includes(sc);
                  return (
                    <button
                      key={sc}
                      type="button"
                      onClick={() => setCreateForm({
                        ...createForm,
                        skinConcerns: toggleSelectionInArray(createForm.skinConcerns, sc)
                      })}
                      style={{
                        padding: '4px 9px',
                        borderRadius: '12px',
                        fontSize: '0.74rem',
                        fontFamily: 'sans-serif',
                        fontWeight: selected ? 'bold' : 'normal',
                        backgroundColor: selected ? '#F6FBF7' : '#FFFFFF',
                        color: selected ? '#2E7D32' : '#5C5454',
                        border: selected ? '1.5px solid #2E7D32' : '1px solid #E8C5C8',
                        cursor: 'pointer'
                      }}
                    >
                      {selected ? `✨ ${sc}` : sc}
                    </button>
                  );
                })}
              </div>
            </div>

            <input type="url" placeholder="Image URL (HTTPS)" value={createForm.imageUrl} onChange={e => setCreateForm({...createForm, imageUrl: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #E8C5C8', outline: 'none' }} />
            <input type="text" placeholder="Tags (comma separated)" value={createForm.tags} onChange={e => setCreateForm({...createForm, tags: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #E8C5C8', outline: 'none' }} />
            <textarea placeholder="Description..." rows="3" value={createForm.description} onChange={e => setCreateForm({...createForm, description: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #E8C5C8', outline: 'none', resize: 'vertical' }} />
            
            <button type="submit" style={{ backgroundColor: '#F2D4D7', color: '#5C5454', padding: '12px', borderRadius: '25px', border: '1px solid #B38B8F', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.3s ease', marginTop: '4px' }}>
              Save to Boutique ✧
            </button>
          </form>
        </div>

        <div style={{ flex: 1, minWidth: '280px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", color: '#5C5454', margin: 0, fontSize: '2.2rem' }}>Boutique Inventory</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                disabled={isSyncingAllCjShipping}
                onClick={() => handleSyncAllLiveCjShipping(false)}
                style={{ backgroundColor: '#F6FBF7', border: '1.5px solid #2E7D32', color: '#2E7D32', padding: '7px 14px', borderRadius: '20px', fontSize: '0.84rem', fontFamily: 'sans-serif', fontWeight: 'bold', cursor: isSyncingAllCjShipping ? 'not-allowed' : 'pointer' }}
                title="Resolves real CJ Variant IDs (vid), product weights, and all live CJ shipping rates across your catalog"
              >
                {isSyncingAllCjShipping ? '⏳ Pulling Live CJ Rates...' : '✈️ Sync All CJ Shipping Methods & VIDs'}
              </button>
              <button
                type="button"
                disabled={isSyncingAllCjShipping}
                onClick={() => handleSyncAllLiveCjShipping(true)}
                style={{ backgroundColor: '#FFF0F2', border: '1.5px solid #B38B8F', color: '#5C5454', padding: '7px 14px', borderRadius: '20px', fontSize: '0.84rem', fontFamily: 'sans-serif', fontWeight: 'bold', cursor: isSyncingAllCjShipping ? 'not-allowed' : 'pointer' }}
                title="Automatically selects the Least Expensive & Most Efficient CJ shipping method for every product and updates retail prices to guarantee Wholesale + Shipping + Profit"
              >
                🛡️ Auto-Pick Optimal CJ Carrier & Profit Floor All
              </button>
              <button
                type="button"
                disabled={isAutoLabeling}
                onClick={handleAutoLabelAllProducts}
                style={{ backgroundColor: '#F2D4D7', border: '1px solid #B38B8F', color: '#5C5454', padding: '7px 14px', borderRadius: '20px', fontSize: '0.92rem', fontFamily: "'Cormorant Garamond', serif", fontWeight: 'bold', cursor: isAutoLabeling ? 'not-allowed' : 'pointer' }}
              >
                {isAutoLabeling ? '⏳ Labeling Catalog...' : '🏷️ Auto-Label All Products for Blueprints'}
              </button>
              {onOpenTestsTab && (
                <button
                  type="button"
                  onClick={onOpenTestsTab}
                  style={{ backgroundColor: '#FFF9F9', border: '1px solid #B38B8F', color: '#5C5454', padding: '6px 14px', borderRadius: '20px', fontSize: '0.9rem', fontFamily: "'Cormorant Garamond', serif", fontWeight: 'bold', cursor: 'pointer' }}
                >
                  🧪 CJ Sync & Diagnostics Tab →
                </button>
              )}
              <span style={{ backgroundColor: '#FFF0F2', color: '#B38B8F', padding: '5px 12px', borderRadius: '20px', fontSize: '0.9rem', fontWeight: 'bold', border: '1px solid #E8C5C8' }}>
                {inventory.length} Items Active
              </span>
            </div>
          </div>

          {/* Search, Filter & Profit-Protection Sort Bar for Susan's Boutique Inventory */}
          {(() => {
            const enrichedList = inventory.map(prod => {
              const meta = deriveProductBlueprintMeta(prod);
              const bd = computeClientProductPriceBreakdown(prod);
              const draft = inlineDraftMap[prod._id] || {
                price: String(bd.retailPrice.toFixed(2)),
                wholesalePriceUsd: String(bd.wholesalePriceUsd.toFixed(2)),
                shippingCostUsd: String(bd.shippingCostUsd.toFixed(2)),
                selectedLogisticName: bd.selectedLogisticName
              };
              const retailVal = parseFloat(draft.price);
              const wholesaleVal = parseFloat(draft.wholesalePriceUsd);
              const shippingVal = parseFloat(draft.shippingCostUsd);
              const effectiveRetail = !isNaN(retailVal) ? retailVal : bd.retailPrice;
              const effectiveWholesale = !isNaN(wholesaleVal) ? wholesaleVal : bd.wholesalePriceUsd;
              const effectiveShipping = !isNaN(shippingVal) ? shippingVal : bd.shippingCostUsd;
              const labelCost = bd.customLabelEnabled ? bd.customLabelCostUsd : 0;
              const allInCost = Number((effectiveWholesale + effectiveShipping + labelCost).toFixed(2));
              const netProfit = Number((effectiveRetail - allInCost).toFixed(2));
              return {
                prod,
                meta,
                bd,
                draft,
                effectiveRetail,
                effectiveWholesale,
                effectiveShipping,
                labelCost,
                allInCost,
                netProfit
              };
            });

            const lossOrLowMarginCount = enrichedList.filter(item => item.netProfit < 4.0).length;
            const highShippingCount = enrichedList.filter(item => item.effectiveShipping >= 6.0).length;

            const cleanQ = inventorySearchQuery.trim().toLowerCase();
            const filteredList = enrichedList.filter(({ prod, meta, effectiveShipping, netProfit }) => {
              if (inventoryStepFilter !== 'ALL' && meta.ritualStep !== inventoryStepFilter) {
                return false;
              }
              if (inventoryMarginFilter === 'LOSS_OR_LOW_MARGIN' && netProfit >= 4.0) {
                return false;
              }
              if (inventoryMarginFilter === 'HIGH_SHIPPING' && effectiveShipping < 6.0) {
                return false;
              }
              if (!cleanQ) return true;
              const pidStr = String(prod.cjPid || prod.rawCjData?.pid || '');
              const skuStr = String(prod.cjSku || prod.rawCjData?.productSku || prod.variants?.[0]?.sku || '');
              const vidStr = String(prod.variants?.[0]?.vid || prod.rawCjData?.vid || '');
              const tagsStr = Array.isArray(prod.tags) ? prod.tags.join(' ') : String(prod.tags || '');
              const hay = `${prod.title || ''} ${pidStr} ${skuStr} ${vidStr} ${meta.ritualStep || ''} ${(meta.skinTypes || []).join(' ')} ${(meta.skinConcerns || []).join(' ')} ${tagsStr}`.toLowerCase();
              return hay.includes(cleanQ);
            });

            const sortedList = [...filteredList].sort((a, b) => {
              if (inventorySortBy === 'SHIPPING_DESC') return b.effectiveShipping - a.effectiveShipping;
              if (inventorySortBy === 'PROFIT_ASC') return a.netProfit - b.netProfit;
              if (inventorySortBy === 'PRICE_ASC') return a.effectiveRetail - b.effectiveRetail;
              if (inventorySortBy === 'PRICE_DESC') return b.effectiveRetail - a.effectiveRetail;
              if (inventorySortBy === 'TITLE_ASC') return String(a.prod.title || '').localeCompare(String(b.prod.title || ''));
              return 0;
            });

            return (
              <>
                <div style={{ backgroundColor: '#FFFFFF', border: '1.5px solid #B38B8F', borderRadius: '16px', padding: '14px 16px', marginBottom: '18px', boxShadow: '0 4px 14px rgba(179, 139, 143, 0.12)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(185px, 1fr))', gap: '10px', alignItems: 'center' }}>
                    <div style={{ position: 'relative', gridColumn: 'span 2', minWidth: '240px' }}>
                      <input
                        type="text"
                        value={inventorySearchQuery}
                        onChange={(e) => setInventorySearchQuery(e.target.value)}
                        placeholder="🔍 Search inventory by product name, SKU, CJ PID, variant VID, or skin goal..."
                        style={{ width: '100%', padding: '10px 34px 10px 12px', borderRadius: '10px', border: '1px solid #B38B8F', backgroundColor: '#FFF9F9', color: '#5C5454', fontFamily: 'sans-serif', fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box' }}
                      />
                      {inventorySearchQuery && (
                        <button
                          type="button"
                          onClick={() => setInventorySearchQuery('')}
                          style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#8A797A', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 'bold' }}
                          title="Clear search"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    <select
                      value={inventoryStepFilter}
                      onChange={(e) => setInventoryStepFilter(e.target.value)}
                      style={{ padding: '10px', borderRadius: '10px', border: '1px solid #E8C5C8', backgroundColor: '#FFFFFF', color: '#5C5454', fontFamily: 'sans-serif', fontSize: '0.84rem' }}
                    >
                      <option value="ALL">All Ritual Steps ({inventory.length})</option>
                      {BLUEPRINT_RITUAL_STEP_OPTIONS.map(stepOpt => (
                        <option key={stepOpt} value={stepOpt}>{stepOpt}</option>
                      ))}
                    </select>

                    <select
                      value={inventoryMarginFilter}
                      onChange={(e) => setInventoryMarginFilter(e.target.value)}
                      style={{ padding: '10px', borderRadius: '10px', border: '1px solid #E8C5C8', backgroundColor: '#FFFFFF', color: '#5C5454', fontFamily: 'sans-serif', fontSize: '0.84rem' }}
                    >
                      <option value="ALL">All Margin & Shipping Levels</option>
                      <option value="LOSS_OR_LOW_MARGIN">⚠️ Low Margin / Loss Alert (&lt; $4 Profit) [{lossOrLowMarginCount}]</option>
                      <option value="HIGH_SHIPPING">✈️ High CJ Shipping (&ge; $6.00) [{highShippingCount}]</option>
                    </select>

                    <select
                      value={inventorySortBy}
                      onChange={(e) => setInventorySortBy(e.target.value)}
                      style={{ padding: '10px', borderRadius: '10px', border: '1px solid #E8C5C8', backgroundColor: '#FFFFFF', color: '#5C5454', fontFamily: 'sans-serif', fontSize: '0.84rem' }}
                    >
                      <option value="DEFAULT">Sort: Default Order</option>
                      <option value="SHIPPING_DESC">✈️ Sort: Highest CJ Shipping First</option>
                      <option value="PROFIT_ASC">⚠️ Sort: Lowest Net Profit First</option>
                      <option value="PRICE_ASC">💲 Sort: Retail Price (Low → High)</option>
                      <option value="PRICE_DESC">💲 Sort: Retail Price (High → Low)</option>
                      <option value="TITLE_ASC">🔤 Sort: Product Title (A → Z)</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', fontSize: '0.78rem', fontFamily: 'sans-serif', color: '#736A6A' }}>
                    <span>
                      Showing <strong>{sortedList.length}</strong> of <strong>{inventory.length}</strong> products • Edit <strong>Retail Price ($)</strong> or <strong>CJ Ship ($)</strong> directly on any card and click <strong>💾 Save Price</strong>
                    </span>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {lossOrLowMarginCount > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setInventoryMarginFilter(prev => (prev === 'LOSS_OR_LOW_MARGIN' ? 'ALL' : 'LOSS_OR_LOW_MARGIN'));
                            setInventorySortBy('PROFIT_ASC');
                          }}
                          style={{ backgroundColor: '#FFF5F5', color: '#C62828', border: '1px solid #FFCDD2', borderRadius: '12px', padding: '3px 10px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}
                        >
                          🚨 {lossOrLowMarginCount} Low-Margin / High-Shipping Item(s) — Click to Inspect
                        </button>
                      )}
                      {(inventorySearchQuery || inventoryStepFilter !== 'ALL' || inventoryMarginFilter !== 'ALL' || inventorySortBy !== 'DEFAULT') && (
                        <button
                          type="button"
                          onClick={() => {
                            setInventorySearchQuery('');
                            setInventoryStepFilter('ALL');
                            setInventoryMarginFilter('ALL');
                            setInventorySortBy('DEFAULT');
                          }}
                          style={{ backgroundColor: '#FFF0F2', color: '#5C5454', border: '1px solid #B38B8F', borderRadius: '12px', padding: '3px 10px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}
                        >
                          ↻ Reset Filters
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {sortedList.length === 0 ? (
                  <div style={{ backgroundColor: '#FFFFFF', border: '1px dashed #B38B8F', borderRadius: '16px', padding: '32px', textAlign: 'center', color: '#8A797A', fontFamily: 'sans-serif' }}>
                    No inventory products matched your search or filter criteria.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(285px, 1fr))', gap: '20px' }}>
                    {sortedList.map(({ prod, meta, bd, draft, effectiveRetail, effectiveWholesale, effectiveShipping, labelCost, allInCost, netProfit }) => {
                      const displayImage = prod.imageUrl && prod.imageUrl.startsWith('//') ? `https:${prod.imageUrl}` : prod.imageUrl;
                      const isLoss = netProfit <= 0;
                      const isLowMargin = !isLoss && netProfit < 4.0;
                      const availableRates = Array.isArray(prod.availableLogistics) ? prod.availableLogistics : [];

                      return (
                        <div key={prod._id} style={{ backgroundColor: '#FFFFFF', border: isLoss ? '2px solid #C62828' : (bd.customLabelEnabled ? '1.5px solid #B38B8F' : '1px solid #E8C5C8'), borderRadius: '15px', padding: '15px', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 15px rgba(232, 197, 200, 0.12)' }}>
                          <div style={{ width: '100%', height: '140px', backgroundColor: '#FFF0F2', borderRadius: '10px', marginBottom: '10px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                            <span style={{ position: 'absolute', top: '6px', left: '6px', backgroundColor: 'rgba(92, 84, 84, 0.85)', color: '#FFFFFF', padding: '3px 8px', borderRadius: '10px', fontSize: '0.68rem', fontFamily: "'Cormorant Garamond', serif", fontWeight: 'bold' }}>
                              {meta.ritualStep}
                            </span>
                            <span style={{ position: 'absolute', top: '6px', right: '6px', backgroundColor: 'rgba(255, 255, 255, 0.92)', color: '#5C5454', border: '1px solid #E8C5C8', padding: '2px 7px', borderRadius: '8px', fontSize: '0.65rem', fontFamily: 'sans-serif', fontWeight: 'bold' }}>
                              ⚖️ {Number(prod.estimatedWeightGrams || 120)}g
                            </span>
                            {bd.customLabelEnabled && (
                              <span style={{ position: 'absolute', bottom: '6px', left: '6px', backgroundColor: '#B38B8F', color: '#FFFFFF', padding: '2px 8px', borderRadius: '8px', fontSize: '0.66rem', fontFamily: 'sans-serif', fontWeight: 'bold' }}>
                                🏷️ Custom Labeled (+${bd.customLabelCostUsd.toFixed(2)})
                              </span>
                            )}
                            {displayImage ? (
                              <img src={displayImage} alt={prod.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <span style={{ color: '#B38B8F', fontStyle: 'italic', fontSize: '0.9rem' }}>No Image</span>
                            )}
                          </div>

                          <h4 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.12rem', color: '#5C5454', margin: '0 0 4px 0', minHeight: '36px' }}>{prod.title}</h4>

                          {/* CJ PID, Variant VID/SKU & Custom Title Lock Fingerprint Badges */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
                            {(prod.cjPid || prod.rawCjData?.pid) && (
                              <span style={{ backgroundColor: '#FFF9F9', color: '#736A6A', border: '1px solid #E8C5C8', borderRadius: '6px', padding: '1px 6px', fontSize: '0.63rem', fontFamily: 'sans-serif' }}>
                                PID: {String(prod.cjPid || prod.rawCjData?.pid).slice(0, 14)}
                              </span>
                            )}
                            {(prod.variants?.[0]?.sku || prod.cjSku || prod.rawCjData?.productSku) && (
                              <span style={{ backgroundColor: '#FFF9F9', color: '#736A6A', border: '1px solid #E8C5C8', borderRadius: '6px', padding: '1px 6px', fontSize: '0.63rem', fontFamily: 'sans-serif' }}>
                                SKU/VID: {String(prod.variants?.[0]?.sku || prod.cjSku || prod.rawCjData?.productSku).slice(0, 16)}
                              </span>
                            )}
                            {prod.customTitleLocked && (
                              <span style={{ backgroundColor: '#F6FBF7', color: '#2E7D32', border: '1px solid #A5D6A7', borderRadius: '6px', padding: '1px 6px', fontSize: '0.63rem', fontFamily: 'sans-serif', fontWeight: 'bold' }}>
                                🔒 Title Locked
                              </span>
                            )}
                          </div>

                          {/* Net Profit After Shipping Guardrail Box */}
                          <div style={{
                            backgroundColor: isLoss ? '#FFF5F5' : (isLowMargin ? '#FFF8E7' : '#F6FBF7'),
                            border: `1px solid ${isLoss ? '#FFCDD2' : (isLowMargin ? '#FFE082' : '#A5D6A7')}`,
                            borderRadius: '10px',
                            padding: '8px 10px',
                            marginBottom: '8px',
                            fontFamily: 'sans-serif',
                            fontSize: '0.73rem',
                            color: '#5C5454'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                              <strong style={{ color: isLoss ? '#C62828' : (isLowMargin ? '#B26A00' : '#2E7D32'), fontSize: '0.78rem' }}>
                                {isLoss
                                  ? `🚨 LOSS ALERT (${netProfit.toFixed(2)})`
                                  : isLowMargin
                                  ? `⚠️ Low Margin (+$${netProfit.toFixed(2)} Profit)`
                                  : `✓ Net Profit: +$${netProfit.toFixed(2)}`}
                              </strong>
                              <span style={{ fontWeight: 'bold', color: '#5C5454' }}>
                                Cost: ${allInCost.toFixed(2)}
                              </span>
                            </div>
                            <div style={{ color: '#736A6A', fontSize: '0.7rem', lineHeight: '1.35' }}>
                              CJ Item: <strong>${effectiveWholesale.toFixed(2)}</strong> + CJ Ship ({draft.selectedLogisticName || bd.selectedLogisticName}): <strong>${effectiveShipping.toFixed(2)}</strong>
                              {labelCost > 0 ? ` + Label: $${labelCost.toFixed(2)}` : ''} → Retail: <strong>${effectiveRetail.toFixed(2)}</strong>
                            </div>
                          </div>

                          {/* Direct Inline Price, Wholesale & Shipping Editor on Card */}
                          <div style={{ backgroundColor: '#FFF9F9', border: '1px solid #E8C5C8', borderRadius: '10px', padding: '8px', marginBottom: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '5px' }}>
                              <div>
                                <label style={{ display: 'block', fontSize: '0.63rem', fontWeight: 'bold', color: '#2E7D32', fontFamily: 'sans-serif', marginBottom: '2px' }}>
                                  Retail ($)
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={draft.price}
                                  onChange={(e) => handleInlineDraftChange(prod, 'price', e.target.value)}
                                  style={{ width: '100%', padding: '5px', borderRadius: '6px', border: '1.5px solid #2E7D32', backgroundColor: '#FFFFFF', fontSize: '0.78rem', fontWeight: 'bold', color: '#5C5454', boxSizing: 'border-box' }}
                                />
                              </div>
                              <div>
                                <label style={{ display: 'block', fontSize: '0.63rem', fontWeight: 'bold', color: '#736A6A', fontFamily: 'sans-serif', marginBottom: '2px' }}>
                                  CJ Cost ($)
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={draft.wholesalePriceUsd}
                                  onChange={(e) => handleInlineDraftChange(prod, 'wholesalePriceUsd', e.target.value)}
                                  style={{ width: '100%', padding: '5px', borderRadius: '6px', border: '1px solid #E8C5C8', backgroundColor: '#FFFFFF', fontSize: '0.76rem', color: '#5C5454', boxSizing: 'border-box' }}
                                />
                              </div>
                              <div>
                                <label style={{ display: 'block', fontSize: '0.63rem', fontWeight: 'bold', color: '#B38B8F', fontFamily: 'sans-serif', marginBottom: '2px' }}>
                                  CJ Ship ($)
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={draft.shippingCostUsd}
                                  onChange={(e) => handleInlineDraftChange(prod, 'shippingCostUsd', e.target.value)}
                                  style={{ width: '100%', padding: '5px', borderRadius: '6px', border: '1px solid #B38B8F', backgroundColor: '#FFFFFF', fontSize: '0.76rem', fontWeight: 'bold', color: '#5C5454', boxSizing: 'border-box' }}
                                />
                              </div>
                            </div>

                            <div style={{ display: 'flex', gap: '5px' }}>
                              <button
                                type="button"
                                disabled={savingInlineProductId === prod._id}
                                onClick={() => handleSaveInlineProductPricing(prod, { recalculateFromFormula: false })}
                                style={{ flex: 1, backgroundColor: '#2E7D32', color: '#FFFFFF', border: 'none', borderRadius: '6px', padding: '6px 8px', fontSize: '0.73rem', fontWeight: 'bold', fontFamily: 'sans-serif', cursor: savingInlineProductId === prod._id ? 'not-allowed' : 'pointer' }}
                                title="Saves your exact custom Retail Price ($), CJ Wholesale ($), and CJ Shipping ($) without formula overwrite"
                              >
                                {savingInlineProductId === prod._id ? '⏳ Saving...' : '💾 Save Price & Ship'}
                              </button>
                              {isLoss && (
                                <button
                                  type="button"
                                  onClick={() => handleInlineDraftChange(prod, 'price', String((allInCost + 6.0).toFixed(2)))}
                                  style={{ backgroundColor: '#FFF0F2', color: '#C62828', border: '1px solid #C62828', borderRadius: '6px', padding: '6px 7px', fontSize: '0.68rem', fontWeight: 'bold', fontFamily: 'sans-serif', cursor: 'pointer' }}
                                  title="Set retail price to cover all-in cost + $6.00 profit"
                                >
                                  Fix (${(allInCost + 6.0).toFixed(2)})
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Per-Card CJ Shipping Carrier Dropdown, Live CJ Quote Button & Carrier Pills */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px', backgroundColor: '#FFF9F9', padding: '8px', borderRadius: '8px', border: '1px solid #E8C5C8' }}>
                            <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                              <select
                                value={draft.selectedLogisticName || bd.selectedLogisticName}
                                disabled={quotingProductId === prod._id}
                                onChange={(e) => {
                                  const chosenName = e.target.value;
                                  handleInlineDraftChange(prod, 'selectedLogisticName', chosenName);
                                  const matchedRate = availableRates.find(r => r.logisticName === chosenName);
                                  if (matchedRate && matchedRate.shippingCostUsd > 0) {
                                    handleInlineDraftChange(prod, 'shippingCostUsd', String(Number(matchedRate.shippingCostUsd).toFixed(2)));
                                  } else {
                                    handleFetchProductShippingQuote(prod._id, chosenName, { preserveRetailPrice: true });
                                  }
                                }}
                                style={{ flex: 1, padding: '5px 6px', borderRadius: '6px', border: '1px solid #E8C5C8', fontSize: '0.72rem', fontFamily: 'sans-serif', color: '#5C5454', backgroundColor: '#FFFFFF' }}
                              >
                                {CJ_CARRIER_OPTIONS.map(c => (
                                  <option key={c} value={c}>{c}</option>
                                ))}
                              </select>
                              <button
                                type="button"
                                title="Pull live CJ shipping rates & resolve true CJ Variant ID (vid) without overwriting your custom price"
                                disabled={quotingProductId === prod._id}
                                onClick={() => handleFetchProductShippingQuote(prod._id, draft.selectedLogisticName || bd.selectedLogisticName, { preserveRetailPrice: true })}
                                style={{ backgroundColor: '#F2D4D7', border: '1px solid #B38B8F', color: '#5C5454', borderRadius: '6px', padding: '5px 8px', fontSize: '0.71rem', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' }}
                              >
                                {quotingProductId === prod._id ? '⏳ Pulling...' : '✈️ Pull CJ Rates'}
                              </button>
                            </div>

                            {(bd.availableLogistics || availableRates).length > 0 && (
                              <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8C5C8', borderRadius: '8px', padding: '6px 8px', maxHeight: '150px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.64rem', color: '#8A797A', fontWeight: 'bold', borderBottom: '1px solid #FFF0F2', paddingBottom: '3px' }}>
                                  <span>All CJ Shipping Methods ({(bd.availableLogistics || availableRates).length})</span>
                                  <span style={{ color: '#2E7D32' }}>★ Auto-Picks Optimal at Order</span>
                                </div>
                                {(bd.availableLogistics || availableRates).map((rate, rIdx) => {
                                  const isSelectedCarrier = (draft.selectedLogisticName || bd.selectedLogisticName) === rate.logisticName;
                                  const isOptimal = Boolean(rate.isOptimal) || rate.logisticName === bd.optimalCarrier?.logisticName;
                                  return (
                                    <button
                                      key={rIdx}
                                      type="button"
                                      onClick={() => {
                                        handleInlineDraftChange(prod, 'selectedLogisticName', rate.logisticName);
                                        handleInlineDraftChange(prod, 'shippingCostUsd', String(Number(rate.shippingCostUsd || 0).toFixed(2)));
                                      }}
                                      style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        width: '100%',
                                        textAlign: 'left',
                                        fontSize: '0.66rem',
                                        padding: '4px 6px',
                                        borderRadius: '6px',
                                        border: isSelectedCarrier ? '1.5px solid #2E7D32' : (isOptimal ? '1px solid #B38B8F' : '1px solid #F2E6E7'),
                                        backgroundColor: isSelectedCarrier ? '#F6FBF7' : (isOptimal ? '#FFF0F2' : '#FFFDFD'),
                                        color: '#5C5454',
                                        fontFamily: 'sans-serif',
                                        cursor: 'pointer'
                                      }}
                                      title={`${rate.logisticName} • ${rate.deliveryTime || '5-11 Days'}${isOptimal ? ' (★ Least Expensive & Most Efficient)' : ''}`}
                                    >
                                      <span>
                                        {isOptimal ? '★ ' : ''}{rate.logisticName} <span style={{ color: '#8A797A', fontSize: '0.61rem' }}>({rate.deliveryTime || '5-11 Days'})</span>
                                      </span>
                                      <strong style={{ color: isSelectedCarrier ? '#2E7D32' : '#B38B8F' }}>
                                        ${Number(rate.shippingCostUsd || 0).toFixed(2)}
                                      </strong>
                                    </button>
                                  );
                                })}
                              </div>
                            )}

                            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.73rem', color: '#5C5454', fontFamily: 'sans-serif', cursor: 'pointer' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <input
                                  type="checkbox"
                                  disabled={togglingLabelProductId === prod._id}
                                  checked={bd.customLabelEnabled}
                                  onChange={(e) => handleToggleProductCustomLabel(prod, e.target.checked)}
                                />
                                🏷️ Custom Label / Packaging
                              </span>
                              <span style={{ color: '#B38B8F', fontWeight: 'bold' }}>
                                {bd.customLabelEnabled ? `+$${bd.customLabelCostUsd.toFixed(2)}` : 'Off'}
                              </span>
                            </label>
                          </div>

                          {/* Skin Type & Skin Condition Badges */}
                          <div style={{ backgroundColor: '#FFF9F9', border: '1px solid #E8C5C8', borderRadius: '8px', padding: '7px 8px', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.66rem', color: '#8A797A', fontWeight: 'bold', fontFamily: 'sans-serif' }}>Skin:</span>
                              {meta.skinTypes.slice(0, 3).map((st, idx) => (
                                <span key={idx} style={{ fontSize: '0.66rem', backgroundColor: '#FFF0F2', color: '#5C5454', border: '1px solid #E8C5C8', borderRadius: '7px', padding: '1px 5px', fontFamily: 'sans-serif' }}>
                                  {st}
                                </span>
                              ))}
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.66rem', color: '#8A797A', fontWeight: 'bold', fontFamily: 'sans-serif' }}>Targets:</span>
                              {meta.skinConcerns.slice(0, 3).map((sc, idx) => (
                                <span key={idx} style={{ fontSize: '0.66rem', backgroundColor: '#F6FBF7', color: '#2E7D32', border: '1px solid #A5D6A7', borderRadius: '7px', padding: '1px 5px', fontFamily: 'sans-serif' }}>
                                  {sc}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: '10px', marginTop: 'auto' }}>
                            <button
                              type="button"
                              onClick={() => handleEditClick(prod)}
                              style={{ flex: 1, backgroundColor: '#FFF9F9', border: '1px solid #B38B8F', color: '#5C5454', padding: '8px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 'bold' }}
                            >
                              ✎ Full Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(prod._id)}
                              style={{ flex: 1, backgroundColor: '#FFF0F2', border: '1px solid #E8C5C8', color: '#A89999', padding: '8px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem' }}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
};

const AdminTestLab = ({ onCatalogUpdated, onAskOdieToTest }) => {
  const [isRunningFullSuite, setIsRunningFullSuite] = useState(false);
  const [sendLiveEmailInSuite, setSendLiveEmailInSuite] = useState(false);
  const [fullDiagReport, setFullDiagReport] = useState(null);

  const [isSyncingCj, setIsSyncingCj] = useState(false);
  const [isCleaningCj, setIsCleaningCj] = useState(false);
  const [isTestingWebhooks, setIsTestingWebhooks] = useState(false);
  const [isProvisioningStripeWebhook, setIsProvisioningStripeWebhook] = useState(false);
  const [provisionedWebhookInfo, setProvisionedWebhookInfo] = useState(null);
  const [isTestingSmtp, setIsTestingSmtp] = useState(false);

  const [opsBanner, setOpsBanner] = useState({ type: '', text: '' });
  const [webhookReport, setWebhookReport] = useState(null);
  const [smtpReport, setSmtpReport] = useState(null);

  const handleRunFullSuite = async () => {
    const token = localStorage.getItem('token');
    setIsRunningFullSuite(true);
    setOpsBanner({ type: '', text: '' });

    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/diagnostics/run-all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ sendLiveTestEmail: sendLiveEmailInSuite })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setFullDiagReport(data);
        setOpsBanner({
          type: data.overallStatus === 'PASSED' ? 'success' : 'error',
          text: data.message || '6-Point System Diagnostics completed.'
        });
      } else {
        setOpsBanner({
          type: 'error',
          text: data.error || 'Failed to run 6-point diagnostic suite.'
        });
      }
    } catch (err) {
      console.error('Full diagnostic suite error:', err);
      setOpsBanner({ type: 'error', text: 'Network error while running 6-point system diagnostics.' });
    }
    setIsRunningFullSuite(false);
  };

  const handleCjSyncOrClean = async (purgeOnly = false) => {
    const token = localStorage.getItem('token');
    if (purgeOnly) setIsCleaningCj(true);
    else setIsSyncingCj(true);
    setOpsBanner({ type: '', text: '' });

    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/cj-sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ purgeOnly })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (Array.isArray(data.products) && onCatalogUpdated) {
          onCatalogUpdated(data.products);
        }
        setOpsBanner({
          type: 'success',
          text: data.message || 'CJ Health & Beauty catalog updated! ✧'
        });
      } else {
        setOpsBanner({
          type: 'error',
          text: data.error || 'Failed to run CJ Health & Beauty catalog operation.'
        });
      }
    } catch (err) {
      console.error('CJ Sync Error:', err);
      setOpsBanner({ type: 'error', text: 'Network error while communicating with CJ sync endpoint.' });
    }

    setIsCleaningCj(false);
    setIsSyncingCj(false);
  };

  const handleRunWebhookDiagnostics = async () => {
    const token = localStorage.getItem('token');
    setIsTestingWebhooks(true);
    setOpsBanner({ type: '', text: '' });

    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/diagnostics/test-webhooks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setWebhookReport(data);
        setOpsBanner({
          type: data.overallStatus === 'PASSED' ? 'success' : 'error',
          text: data.message || 'Webhook diagnostics completed.'
        });
      } else {
        setOpsBanner({
          type: 'error',
          text: data.error || 'Webhook self-test failed.'
        });
      }
    } catch (err) {
      console.error('Webhook test error:', err);
      setOpsBanner({ type: 'error', text: 'Network error while running webhook diagnostics.' });
    }
    setIsTestingWebhooks(false);
  };

  const handleProvisionStripeWebhook = async () => {
    const token = localStorage.getItem('token');
    setIsProvisioningStripeWebhook(true);
    setOpsBanner({ type: '', text: '' });

    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/webhooks/provision-stripe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({})
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setProvisionedWebhookInfo(data);
        setOpsBanner({
          type: 'success',
          text: data.message || 'Live Stripe Webhook Endpoint provisioned and activated in memory! ✧'
        });
        await handleRunWebhookDiagnostics();
      } else {
        setOpsBanner({
          type: 'error',
          text: data.error || 'Could not auto-provision Stripe webhook endpoint.'
        });
      }
    } catch (err) {
      console.error('Provision Stripe Webhook Error:', err);
      setOpsBanner({ type: 'error', text: 'Network error while provisioning Stripe webhook endpoint.' });
    }
    setIsProvisioningStripeWebhook(false);
  };

  const handleRunSmtpTest = async () => {
    const token = localStorage.getItem('token');
    setIsTestingSmtp(true);
    setOpsBanner({ type: '', text: '' });
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/diagnostics/test-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json().catch(() => ({}));
      setSmtpReport({ ok: res.ok, ...data });
      if (res.ok) {
        setOpsBanner({
          type: 'success',
          text: data.message || 'IONOS SMTP test email delivered! ✧'
        });
      } else {
        setOpsBanner({
          type: 'error',
          text: data.error || 'IONOS SMTP test failed. See step-by-step diagnostic report below.'
        });
      }
    } catch (err) {
      console.error('SMTP test error:', err);
      setOpsBanner({ type: 'error', text: 'Network error while testing IONOS SMTP.' });
    }
    setIsTestingSmtp(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '25px', animation: 'fadeIn 0.5s ease' }}>
      {/* Card 1: Master 6-Point Odie System Diagnostics Suite */}
      <div style={{ backgroundColor: '#FFFFFF', padding: '26px 28px', borderRadius: '20px', border: '1px solid #E8C5C8', boxShadow: '0 8px 25px rgba(232, 197, 200, 0.15)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2rem', color: '#5C5454', margin: 0 }}>
                🧪 Odie System Diagnostics & Boutique Test Lab ✧
              </h2>
              {fullDiagReport && (
                <span style={{
                  padding: '4px 12px',
                  borderRadius: '14px',
                  fontSize: '0.8rem',
                  fontWeight: 'bold',
                  fontFamily: 'sans-serif',
                  backgroundColor: fullDiagReport.overallStatus === 'PASSED' ? '#F6FBF7' : '#FFF8E7',
                  color: fullDiagReport.overallStatus === 'PASSED' ? '#2E7D32' : '#B26A00',
                  border: `1px solid ${fullDiagReport.overallStatus === 'PASSED' ? '#A5D6A7' : '#FFE082'}`
                }}>
                  {fullDiagReport.passedCount}/{fullDiagReport.totalChecks} Checks Passed ({fullDiagReport.durationMs}ms)
                </span>
              )}
            </div>
            <p style={{ margin: '6px 0 0 0', fontSize: '0.94rem', color: '#8A797A', fontFamily: 'sans-serif' }}>
              Verify MongoDB, Stripe & CJ v2 Webhooks, Stripe Balance API, CJ Dropshipping Wallet API, IONOS SMTP Email, and Odie's AI Brain in one click — or ask Odie to run and explain every test for you.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.86rem', color: '#5C5454', fontFamily: 'sans-serif', backgroundColor: '#FFF9F9', padding: '8px 12px', borderRadius: '14px', border: '1px solid #E8C5C8', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={sendLiveEmailInSuite}
                onChange={(e) => setSendLiveEmailInSuite(e.target.checked)}
              />
              Also send live test email to Susan
            </label>

            <button
              type="button"
              disabled={isRunningFullSuite}
              onClick={handleRunFullSuite}
              style={{ backgroundColor: '#F2D4D7', border: '1px solid #B38B8F', color: '#5C5454', padding: '11px 20px', borderRadius: '24px', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.1rem', fontWeight: 'bold', cursor: isRunningFullSuite ? 'not-allowed' : 'pointer' }}
            >
              {isRunningFullSuite ? '⏳ Running 6-Point Suite...' : '🚀 Run Full 6-Point Diagnostics'}
            </button>

            {onAskOdieToTest && (
              <button
                type="button"
                onClick={() =>
                  onAskOdieToTest(
                    sendLiveEmailInSuite
                      ? 'Odie, run the full 6-point system diagnostics suite with sendLiveTestEmail set to true and explain the results of every subsystem.'
                      : 'Odie, run the full 6-point system diagnostics suite and explain the health of every subsystem.'
                  )
                }
                style={{ backgroundColor: '#B38B8F', border: 'none', color: '#FFFFFF', padding: '11px 20px', borderRadius: '24px', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer' }}
              >
                🐾 Ask Odie to Run & Diagnose
              </button>
            )}
          </div>
        </div>

        {opsBanner.text && (
          <div style={{
            marginTop: '18px',
            padding: '12px 16px',
            borderRadius: '10px',
            fontFamily: 'sans-serif',
            fontSize: '0.95rem',
            backgroundColor: opsBanner.type === 'success' ? '#F6FBF7' : '#FFF5F5',
            color: opsBanner.type === 'success' ? '#2E7D32' : '#C62828',
            border: `1px solid ${opsBanner.type === 'success' ? '#A5D6A7' : '#FFCDD2'}`
          }}>
            {opsBanner.text}
          </div>
        )}

        {/* 6-Point Visual Scorecard Grid */}
        {fullDiagReport && Array.isArray(fullDiagReport.checksList) && (
          <div style={{ marginTop: '20px', padding: '18px', borderRadius: '15px', backgroundColor: '#FFF9F9', border: '1px solid #E8C5C8' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <strong style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.35rem', color: '#5C5454' }}>
                6-Point Subsystem Verification Scorecard ({fullDiagReport.timestampCT})
              </strong>
              <button
                type="button"
                onClick={() => setFullDiagReport(null)}
                style={{ background: 'none', border: 'none', color: '#8A797A', cursor: 'pointer', fontSize: '0.85rem', textDecoration: 'underline' }}
              >
                Hide Scorecard
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
              {fullDiagReport.checksList.map((chk, idx) => (
                <div key={idx} style={{ backgroundColor: '#FFFFFF', border: `1px solid ${chk.passed ? '#A5D6A7' : '#FFE082'}`, borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <strong style={{ color: '#5C5454', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.15rem' }}>
                      {chk.passed ? '✅' : '⚠️'} {chk.name}
                    </strong>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '10px',
                      fontSize: '0.72rem',
                      fontWeight: 'bold',
                      fontFamily: 'sans-serif',
                      backgroundColor: chk.passed ? '#F6FBF7' : '#FFF8E7',
                      color: chk.passed ? '#2E7D32' : '#B26A00'
                    }}>
                      {chk.status}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#736A6A', fontFamily: 'sans-serif', lineHeight: '1.45' }}>
                    {chk.details}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Card 2: Individual Subsystem Test & Catalog Sync Controls (Moved from Inventory) */}
      <div style={{ backgroundColor: '#FFFFFF', padding: '26px 28px', borderRadius: '20px', border: '1px solid #E8C5C8', boxShadow: '0 8px 25px rgba(232, 197, 200, 0.15)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.7rem', color: '#5C5454', margin: '0 0 4px 0' }}>
              Individual Subsystem Tests & CJ Dropshipping Catalog Sync ✧
            </h3>
            <p style={{ margin: 0, fontSize: '0.92rem', color: '#8A797A', fontFamily: 'sans-serif' }}>
              Run targeted CJ Beauty & Skincare catalog syncs, non-beauty purges, live IONOS SMTP delivery tests, or Stripe/CJ webhook payload checks.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              disabled={isSyncingCj || isCleaningCj}
              onClick={() => handleCjSyncOrClean(false)}
              style={{ backgroundColor: '#F2D4D7', border: '1px solid #B38B8F', color: '#5C5454', padding: '10px 18px', borderRadius: '22px', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.05rem', fontWeight: 'bold', cursor: (isSyncingCj || isCleaningCj) ? 'not-allowed' : 'pointer' }}
            >
              {isSyncingCj ? '⏳ Syncing All Skincare & Beauty...' : '🔄 Sync All Skincare & Beauty'}
            </button>

            <button
              type="button"
              disabled={isSyncingCj || isCleaningCj}
              onClick={() => handleCjSyncOrClean(true)}
              style={{ backgroundColor: '#FFF9F9', border: '1px solid #B38B8F', color: '#5C5454', padding: '10px 18px', borderRadius: '22px', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.05rem', fontWeight: 'bold', cursor: (isSyncingCj || isCleaningCj) ? 'not-allowed' : 'pointer' }}
            >
              {isCleaningCj ? '⏳ Purging Non-Skincare...' : '🧹 Purge Perfume & Non-Skincare'}
            </button>

            <button
              type="button"
              disabled={isTestingSmtp}
              onClick={handleRunSmtpTest}
              style={{ backgroundColor: '#FFF0F2', border: '1px solid #B38B8F', color: '#5C5454', padding: '10px 18px', borderRadius: '22px', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.05rem', fontWeight: 'bold', cursor: isTestingSmtp ? 'not-allowed' : 'pointer' }}
            >
              {isTestingSmtp ? '⏳ Testing IONOS SMTP...' : '✉️ Test IONOS Email (SMTP)'}
            </button>

            <button
              type="button"
              disabled={isTestingWebhooks}
              onClick={handleRunWebhookDiagnostics}
              style={{ backgroundColor: '#B38B8F', border: 'none', color: '#FFFFFF', padding: '10px 18px', borderRadius: '22px', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.05rem', fontWeight: 'bold', cursor: isTestingWebhooks ? 'not-allowed' : 'pointer' }}
            >
              {isTestingWebhooks ? '⏳ Checking Live Webhooks...' : '🌐 Verify Live Production Webhooks'}
            </button>

            <button
              type="button"
              disabled={isProvisioningStripeWebhook}
              onClick={handleProvisionStripeWebhook}
              style={{ background: 'linear-gradient(135deg, #5E35B1 0%, #7E57C2 100%)', border: 'none', color: '#FFFFFF', padding: '10px 18px', borderRadius: '22px', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.05rem', fontWeight: 'bold', cursor: isProvisioningStripeWebhook ? 'not-allowed' : 'pointer', boxShadow: '0 4px 12px rgba(94, 53, 177, 0.25)' }}
            >
              {isProvisioningStripeWebhook ? '⏳ Registering in Stripe...' : '⚡ Auto-Configure / Repair Stripe Webhook'}
            </button>

            {onAskOdieToTest && (
              <button
                type="button"
                onClick={() => onAskOdieToTest('Odie, clean any non-beauty items from our CJ catalog and let me know how many verified beauty products remain active.')}
                style={{ backgroundColor: '#FFFFFF', border: '1px solid #B38B8F', color: '#5C5454', padding: '10px 16px', borderRadius: '22px', fontFamily: "'Cormorant Garamond', serif", fontSize: '1rem', cursor: 'pointer' }}
              >
                🐾 Ask Odie to Clean Catalog
              </button>
            )}
          </div>
        </div>

        {smtpReport && (
          <div style={{ marginTop: '18px', padding: '16px', borderRadius: '12px', backgroundColor: '#FFF9F9', border: '1px solid #E8C5C8', fontFamily: 'sans-serif', fontSize: '0.9rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <strong style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.25rem', color: '#5C5454' }}>
                {smtpReport.ok ? '✅ IONOS Email Live Diagnostic Report (PASSED)' : '⚠️ IONOS Email Troubleshooter Report'}
              </strong>
              <button
                type="button"
                onClick={() => setSmtpReport(null)}
                style={{ background: 'none', border: 'none', color: '#8A797A', cursor: 'pointer', fontSize: '0.85rem', textDecoration: 'underline' }}
              >
                Hide SMTP Report
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', marginBottom: '10px' }}>
              <div style={{ backgroundColor: '#FFFFFF', padding: '10px 12px', borderRadius: '8px', border: '1px solid #E8C5C8' }}>
                <strong style={{ color: '#5C5454', display: 'block', marginBottom: '3px' }}>Mailbox & Casing</strong>
                <span style={{ color: '#736A6A', fontSize: '0.84rem' }}>
                  {smtpReport.authUserUsed || smtpReport.configuredUser || 'Susan.Coke@SusansBeautyConsulting.com'}
                </span>
              </div>
              <div style={{ backgroundColor: '#FFFFFF', padding: '10px 12px', borderRadius: '8px', border: '1px solid #E8C5C8' }}>
                <strong style={{ color: '#5C5454', display: 'block', marginBottom: '3px' }}>Transport & Port</strong>
                <span style={{ color: '#736A6A', fontSize: '0.84rem' }}>
                  {smtpReport.deliveryTransport || `${smtpReport.host || 'smtp.ionos.com'}:${smtpReport.portUsed || 465}`}
                </span>
              </div>
              <div style={{ backgroundColor: '#FFFFFF', padding: '10px 12px', borderRadius: '8px', border: '1px solid #E8C5C8' }}>
                <strong style={{ color: '#5C5454', display: 'block', marginBottom: '3px' }}>IPv4 DNS Lookup</strong>
                <span style={{ color: '#736A6A', fontSize: '0.84rem' }}>
                  {smtpReport.dnsResolution?.address ? `${smtpReport.dnsResolution.address} (IPv4)` : (smtpReport.dnsResolution?.error || 'Verified')}
                </span>
              </div>
            </div>
            {Array.isArray(smtpReport.attempts) && smtpReport.attempts.length > 0 && (
              <div style={{ marginBottom: '10px' }}>
                <strong style={{ color: '#5C5454', display: 'block', marginBottom: '4px', fontSize: '0.85rem' }}>Connection & Casing Attempts:</strong>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {smtpReport.attempts.map((att, idx) => (
                    <div key={idx} style={{ fontSize: '0.82rem', padding: '6px 10px', borderRadius: '6px', backgroundColor: '#FFFFFF', border: '1px solid #E8C5C8', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                      <span><strong>{att.status === 'PASSED' || att.status === 'SENT' ? '✅' : '❌'} {att.label}</strong></span>
                      <span style={{ color: '#736A6A' }}>{att.error ? `${att.code || ''} ${att.error}` : `Succeeded in ${att.durationMs || 0}ms`}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {Array.isArray(smtpReport.troubleshootingAdvice) && smtpReport.troubleshootingAdvice.length > 0 && (
              <div style={{ backgroundColor: '#FFF5F5', border: '1px solid #FFCDD2', borderRadius: '8px', padding: '10px 14px', color: '#C62828', fontSize: '0.85rem' }}>
                <strong style={{ display: 'block', marginBottom: '4px' }}>Actionable IONOS Fixes:</strong>
                <ul style={{ margin: 0, paddingLeft: '18px' }}>
                  {smtpReport.troubleshootingAdvice.map((tip, i) => (
                    <li key={i} style={{ marginBottom: '4px' }}>{tip}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {webhookReport && (
          <div style={{ marginTop: '18px', padding: '20px', borderRadius: '14px', backgroundColor: '#FFF9F9', border: '1px solid #E8C5C8', fontFamily: 'sans-serif', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <strong style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.35rem', color: '#5C5454' }}>
                  🌐 Live Production Webhook & Launch Readiness ({webhookReport.overallStatus})
                </strong>
                <span
                  style={{
                    padding: '4px 12px',
                    borderRadius: '14px',
                    fontSize: '0.76rem',
                    fontWeight: 'bold',
                    backgroundColor: webhookReport.stripeKeyMode === 'LIVE' ? '#E8F5E9' : '#FFF8E1',
                    color: webhookReport.stripeKeyMode === 'LIVE' ? '#2E7D32' : '#8D6E63',
                    border: `1px solid ${webhookReport.stripeKeyMode === 'LIVE' ? '#A5D6A7' : '#FFE082'}`
                  }}
                >
                  {webhookReport.stripeKeyMode === 'LIVE' ? '🟢 STRIPE LIVE PRODUCTION KEY' : `🟡 STRIPE ${webhookReport.stripeKeyMode || 'TEST'} KEY`}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setWebhookReport(null)}
                style={{ background: 'none', border: 'none', color: '#8A797A', cursor: 'pointer', fontSize: '0.85rem', textDecoration: 'underline' }}
              >
                Hide Report
              </button>
            </div>

            {provisionedWebhookInfo?.signingSecret && (
              <div style={{ backgroundColor: '#F4F0FF', border: '1.5px solid #5E35B1', borderRadius: '10px', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <strong style={{ color: '#5E35B1', display: 'block', fontSize: '0.88rem', marginBottom: '4px' }}>
                    🔑 New Stripe Signing Secret Provisioned & Active in Memory!
                  </strong>
                  <div style={{ fontSize: '0.82rem', color: '#5C5454' }}>
                    <code>STRIPE_WEBHOOK_SECRET={provisionedWebhookInfo.signingSecret}</code>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (navigator.clipboard && provisionedWebhookInfo.signingSecret) {
                      navigator.clipboard.writeText(provisionedWebhookInfo.signingSecret);
                    }
                  }}
                  style={{ backgroundColor: '#5E35B1', color: '#FFFFFF', border: 'none', borderRadius: '14px', padding: '7px 14px', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  📋 Copy whsec_ Secret for .env
                </button>
              </div>
            )}

            {/* Copyable Production Webhook Endpoint URLs */}
            {webhookReport.productionEndpoints && (
              <div style={{ backgroundColor: '#FFFFFF', padding: '14px 16px', borderRadius: '10px', border: '1px solid #E8C5C8' }}>
                <strong style={{ color: '#5C5454', display: 'block', marginBottom: '8px', fontSize: '0.88rem' }}>
                  🔗 Your Live Production Webhook Endpoint URLs (Click to Copy for Stripe & CJ Dashboards):
                </strong>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[
                    { label: 'Stripe Webhook URL (checkout.session.completed, invoice.paid, customer.subscription.*)', url: webhookReport.productionEndpoints.stripeWebhookUrl },
                    { label: 'CJ Dropshipping Webhook URL (Order Status & Tracking Sync)', url: webhookReport.productionEndpoints.cjWebhookUrl },
                    { label: 'Inbound Email Webhook URL (HTTPS Fallback)', url: webhookReport.productionEndpoints.inboundEmailWebhookUrl }
                  ].map((ep, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', padding: '8px 12px', borderRadius: '8px', backgroundColor: '#FFFDFD', border: '1px solid #F2D4D7' }}>
                      <div>
                        <div style={{ fontSize: '0.76rem', color: '#8A797A', fontWeight: 'bold' }}>{ep.label}</div>
                        <code style={{ fontSize: '0.84rem', color: '#5C5454', wordBreak: 'break-all' }}>{ep.url}</code>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (navigator.clipboard && ep.url) {
                            navigator.clipboard.writeText(ep.url);
                          }
                        }}
                        style={{ backgroundColor: '#FFF0F2', color: '#B38B8F', border: '1px solid #B38B8F', borderRadius: '14px', padding: '5px 12px', fontSize: '0.78rem', fontWeight: 'bold', cursor: 'pointer' }}
                      >
                        📋 Copy URL
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Subsystem Readiness Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
              <div style={{ backgroundColor: '#FFFFFF', padding: '12px', borderRadius: '8px', border: '1px solid #E8C5C8' }}>
                <strong style={{ color: '#5C5454', display: 'block', marginBottom: '4px' }}>
                  {webhookReport.checks?.cjWebhookParser?.passed ? '✅' : '⚠️'} CJ v2 Production Webhook
                </strong>
                <span style={{ color: '#736A6A', fontSize: '0.84rem' }}>
                  Matches live orders by MongoDB <code>_id</code> or <code>cjOrderId</code> and dispatches customer tracking emails.
                </span>
              </div>
              <div style={{ backgroundColor: '#FFFFFF', padding: '12px', borderRadius: '8px', border: '1px solid #E8C5C8' }}>
                <strong style={{ color: '#5C5454', display: 'block', marginBottom: '4px' }}>
                  {webhookReport.checks?.stripeToCjFulfillment?.passed ? '✅' : '⚠️'} Stripe Lifecycle & CJ Bridge
                </strong>
                <span style={{ color: '#736A6A', fontSize: '0.84rem' }}>
                  Handles checkout, subscription renewals, cancellations, and CJ <code>createOrderV2</code> routing.
                </span>
              </div>
              <div style={{ backgroundColor: '#FFFFFF', padding: '12px', borderRadius: '8px', border: '1px solid #E8C5C8' }}>
                <strong style={{ color: '#5C5454', display: 'block', marginBottom: '4px' }}>
                  🔐 Environment Secrets
                </strong>
                <span style={{ color: '#736A6A', fontSize: '0.82rem', display: 'block' }}>
                  Stripe Key: {webhookReport.checks?.environment?.stripeSecretConfigured ? '✓' : 'Missing'} | Signing Secret: {webhookReport.checks?.environment?.stripeWebhookSecretConfigured ? '✓' : 'Missing'}
                </span>
                <span style={{ color: '#736A6A', fontSize: '0.82rem', display: 'block' }}>
                  CJ Token: {webhookReport.checks?.environment?.cjAccessTokenConfigured ? '✓' : 'Missing'} | CJ Secret: {webhookReport.checks?.environment?.cjWebhookSecretConfigured ? '✓' : 'Optional'}
                </span>
              </div>
            </div>

            {/* Registered Stripe Webhook Endpoints from Stripe API */}
            {Array.isArray(webhookReport.registeredStripeEndpoints) && webhookReport.registeredStripeEndpoints.length > 0 && (
              <div style={{ backgroundColor: '#FFFFFF', padding: '14px 16px', borderRadius: '10px', border: '1px solid #E8C5C8' }}>
                <strong style={{ color: '#5C5454', display: 'block', marginBottom: '8px', fontSize: '0.88rem' }}>
                  📡 Registered Endpoints in Your Stripe Account ({webhookReport.registeredStripeEndpoints.length}):
                </strong>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {webhookReport.registeredStripeEndpoints.map((ep) => (
                    <div key={ep.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', fontSize: '0.82rem', padding: '6px 10px', borderRadius: '6px', backgroundColor: '#FFF9F9', border: '1px solid #E8C5C8' }}>
                      <code>{ep.url}</code>
                      <span style={{ fontWeight: 'bold', color: ep.status === 'enabled' ? '#2E7D32' : '#8A797A' }}>
                        {ep.status?.toUpperCase()} • {ep.livemode ? 'LIVE' : 'TEST'} • {(ep.enabledEvents || []).length} events
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Real Webhook Deliveries from MongoDB WebhookEventLog */}
            <div style={{ backgroundColor: '#FFFFFF', padding: '14px 16px', borderRadius: '10px', border: '1px solid #E8C5C8' }}>
              <strong style={{ color: '#5C5454', display: 'block', marginBottom: '8px', fontSize: '0.88rem' }}>
                📜 Recent Live Webhook Deliveries ({Array.isArray(webhookReport.recentWebhookEvents) ? webhookReport.recentWebhookEvents.length : 0}):
              </strong>
              {Array.isArray(webhookReport.recentWebhookEvents) && webhookReport.recentWebhookEvents.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '220px', overflowY: 'auto' }}>
                  {webhookReport.recentWebhookEvents.map((ev, i) => (
                    <div key={ev._id || i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', fontSize: '0.81rem', padding: '7px 10px', borderRadius: '6px', backgroundColor: '#FFFDFD', border: '1px solid #F2D4D7' }}>
                      <div>
                        <strong style={{ color: '#5C5454' }}>[{ev.source}] {ev.eventType}</strong>
                        <span style={{ color: '#736A6A', marginLeft: '8px' }}>{ev.summary}</span>
                      </div>
                      <div style={{ color: '#8A797A', fontSize: '0.76rem' }}>
                        {ev.status} • {ev.createdAt ? new Date(ev.createdAt).toLocaleString() : ''}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <span style={{ color: '#8A797A', fontSize: '0.84rem', fontStyle: 'italic' }}>
                  No live webhook deliveries recorded yet. As soon as Stripe or CJ sends a webhook event to your production URLs above, it will appear here in real time.
                </span>
              )}
            </div>
          </div>
        )}
      </div>

    </div>
  );
};

const AdminFinancesAndOrders = ({
  onEmailCustomer,
  onOrdersUpdated,
  onAskOdie,
  viewMode = 'FINANCES', // 'FINANCES' | 'ORDERS'
  onOpenOrdersTab,
  onOpenFinancesTab
}) => {
  const [telemetry, setTelemetry] = useState(null);
  const [isLoadingFinances, setIsLoadingFinances] = useState(false);
  const [isSyncingCjOrders, setIsSyncingCjOrders] = useState(false);
  const [pipelineFilter, setPipelineFilter] = useState('ALL'); // 'ALL' | 'NEEDS_CJ' | 'PRESENT' | 'FUTURE' | 'PAST'
  const [searchQuery, setSearchQuery] = useState('');
  const [statusBanner, setStatusBanner] = useState({ type: '', text: '' });
  const [editingOrderMap, setEditingOrderMap] = useState({});
  const [savingOrderId, setSavingOrderId] = useState(null);
  const [updatingCjLogisticsId, setUpdatingCjLogisticsId] = useState(null);
  const [orderCjCarrierOptionsMap, setOrderCjCarrierOptionsMap] = useState({});
  const [fulfillingOrderId, setFulfillingOrderId] = useState(null);
  const [isBatchFulfilling, setIsBatchFulfilling] = useState(false);
  const [editingShippingOrderId, setEditingShippingOrderId] = useState(null);
  const [shippingDraftMap, setShippingDraftMap] = useState({});

  // Phase 3: Stripe "Money Dump" (Bank Payout) State
  const [isDumpingStripe, setIsDumpingStripe] = useState(false);
  const [moneyDumpForm, setMoneyDumpForm] = useState({
    fullAvailableDump: true,
    amountUsd: '',
    reserveForActiveOrders: true,
    method: 'standard',
    notes: ''
  });
  const [lastDumpResult, setLastDumpResult] = useState(null);

  // Phase 3: Move Money (Stripe -> CJ Dropshipping Bridge & Order Auto-Pay) State
  const [isMovingToCj, setIsMovingToCj] = useState(false);
  const [cjBridgeForm, setCjBridgeForm] = useState({
    amountUsd: '',
    allocateFromStripe: false,
    payUnpaidCjOrders: true,
    notes: ''
  });
  const [lastBridgeResult, setLastBridgeResult] = useState(null);

  // Phase 4: Bank Card CJ Wallet Top-Up Studio State
  const [isToppingUpCjCard, setIsToppingUpCjCard] = useState(false);
  const [cjCardTopUpForm, setCjCardTopUpForm] = useState({
    amountUsd: '50.00',
    autoPayOrders: true,
    cardBrand: 'VISA',
    cardLast4: '4242',
    notes: ''
  });
  const [lastCardTopUpResult, setLastCardTopUpResult] = useState(null);

  const fetchFinancesAndOrders = async (syncCj = false) => {
    const token = localStorage.getItem('token');
    if (syncCj) setIsSyncingCjOrders(true);
    else setIsLoadingFinances(true);
    setStatusBanner({ type: '', text: '' });

    try {
      const url = `${API_BASE_URL}/api/admin/finances-and-orders${syncCj ? '?syncCjOrders=true' : ''}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setTelemetry(data);
        if (syncCj) {
          const syncedCount = data.cjBalance?.syncedLocalOrdersCount || 0;
          setStatusBanner({
            type: 'success',
            text: `Synced live CJ Dropshipping wallet & order list (${syncedCount} local order(s) updated)! ✧`
          });
          if (onOrdersUpdated) onOrdersUpdated();
        }
      } else {
        setStatusBanner({
          type: 'error',
          text: data.error || 'Could not load financial & order pipeline telemetry.'
        });
      }
    } catch (err) {
      console.error('Error fetching finances and orders:', err);
      setStatusBanner({
        type: 'error',
        text: 'Network error while fetching Stripe & CJ Dropshipping balances.'
      });
    }

    setIsLoadingFinances(false);
    setIsSyncingCjOrders(false);
  };

  const handleConfirmCjCardTopUpSession = async (sessionId) => {
    const token = localStorage.getItem('token');
    setIsToppingUpCjCard(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/finances/cj-wallet-card-topup-confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ sessionId, autoPayOrders: true })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setLastCardTopUpResult(data);
        if (data.telemetry) {
          setTelemetry(data.telemetry);
        } else {
          await fetchFinancesAndOrders(false);
        }
        setStatusBanner({
          type: 'success',
          text: data.message || '💳 Bank Card Top-Up confirmed and credited to your CJ Wallet Reserve! ✧'
        });
        if (onOrdersUpdated) onOrdersUpdated();
      } else {
        setStatusBanner({
          type: 'error',
          text: data.error || 'Could not verify Bank Card Top-Up session.'
        });
      }
    } catch (err) {
      console.error('Error confirming CJ Wallet card top-up:', err);
    }
    setIsToppingUpCjCard(false);
  };

  const handleCjCardTopUpCheckout = async (e, instantDepositMode = false) => {
    if (e) e.preventDefault();
    const token = localStorage.getItem('token');
    setIsToppingUpCjCard(true);
    setStatusBanner({ type: '', text: '' });

    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/finances/cj-wallet-card-topup-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          amountUsd: cjCardTopUpForm.amountUsd !== '' ? Number(cjCardTopUpForm.amountUsd) : 50,
          autoPayOrders: Boolean(cjCardTopUpForm.autoPayOrders),
          cardBrand: cjCardTopUpForm.cardBrand || 'VISA',
          cardLast4: cjCardTopUpForm.cardLast4 || '4242',
          notes: cjCardTopUpForm.notes || '',
          instantDeposit: Boolean(instantDepositMode),
          returnOrigin: window.location.origin
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (data.checkoutUrl && !data.instantConfirmed) {
          window.location.href = data.checkoutUrl;
          return;
        }
        setLastCardTopUpResult(data);
        if (data.telemetry) {
          setTelemetry(data.telemetry);
        } else {
          await fetchFinancesAndOrders(false);
        }
        setCjCardTopUpForm(prev => ({ ...prev, notes: '' }));
        setStatusBanner({
          type: 'success',
          text: data.message || '💳 Added Bank Card funds to your CJ Wallet Reserve! ✧'
        });
        if (onOrdersUpdated) onOrdersUpdated();
      } else {
        setStatusBanner({
          type: 'error',
          text: data.error || 'Failed to initiate Bank Card Top-Up for CJ Wallet.'
        });
      }
    } catch (err) {
      console.error('CJ Wallet Card Top-Up error:', err);
      setStatusBanner({
        type: 'error',
        text: 'Network error while processing CJ Wallet Bank Card Top-Up.'
      });
    }
    setIsToppingUpCjCard(false);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const topupStatus = params.get('cj_topup');
    const sessionId = params.get('session_id');

    if (topupStatus === 'success' && sessionId) {
      handleConfirmCjCardTopUpSession(sessionId);
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (topupStatus === 'cancelled') {
      setStatusBanner({
        type: 'error',
        text: 'Bank card checkout was cancelled — your card was not charged.'
      });
      window.history.replaceState({}, document.title, window.location.pathname);
      fetchFinancesAndOrders(false);
    } else {
      fetchFinancesAndOrders(false);
    }
    // eslint-disable-next-line
  }, []);

  const handleExecuteStripeMoneyDump = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    setIsDumpingStripe(true);
    setStatusBanner({ type: '', text: '' });

    try {
      const payload = {
        fullAvailableDump: Boolean(moneyDumpForm.fullAvailableDump),
        amountUsd: moneyDumpForm.fullAvailableDump ? undefined : moneyDumpForm.amountUsd,
        reserveForActiveOrders: Boolean(moneyDumpForm.reserveForActiveOrders),
        method: moneyDumpForm.method || 'standard',
        notes: moneyDumpForm.notes || ''
      };

      const res = await fetch(`${API_BASE_URL}/api/admin/finances/stripe-payout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setLastDumpResult(data);
        if (data.telemetry) {
          setTelemetry(data.telemetry);
        } else {
          await fetchFinancesAndOrders(false);
        }
        setMoneyDumpForm(prev => ({ ...prev, amountUsd: '', notes: '' }));
        setStatusBanner({
          type: 'success',
          text: data.message || 'Stripe Money Dump completed! ✧'
        });
      } else {
        setStatusBanner({
          type: 'error',
          text: data.error || 'Failed to execute Stripe Money Dump.'
        });
      }
    } catch (err) {
      console.error('Stripe Money Dump error:', err);
      setStatusBanner({
        type: 'error',
        text: 'Network error while executing Stripe Money Dump.'
      });
    }
    setIsDumpingStripe(false);
  };

  const handleExecuteStripeToCjBridge = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    setIsMovingToCj(true);
    setStatusBanner({ type: '', text: '' });

    try {
      const payload = {
        amountUsd: cjBridgeForm.amountUsd !== '' ? Number(cjBridgeForm.amountUsd) : undefined,
        allocateFromStripe: Boolean(cjBridgeForm.allocateFromStripe),
        payUnpaidCjOrders: Boolean(cjBridgeForm.payUnpaidCjOrders),
        notes: cjBridgeForm.notes || ''
      };

      const res = await fetch(`${API_BASE_URL}/api/admin/finances/stripe-to-cj`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setLastBridgeResult(data);
        if (data.telemetry) {
          setTelemetry(data.telemetry);
        } else {
          await fetchFinancesAndOrders(false);
        }
        setCjBridgeForm(prev => ({ ...prev, notes: '' }));
        setStatusBanner({
          type: 'success',
          text: data.message || 'Stripe → CJ Dropshipping treasury bridge executed! ✧'
        });
        if (onOrdersUpdated) onOrdersUpdated();
      } else {
        setStatusBanner({
          type: 'error',
          text: data.error || 'Failed to execute Stripe → CJ transfer bridge.'
        });
      }
    } catch (err) {
      console.error('Stripe -> CJ Bridge error:', err);
      setStatusBanner({
        type: 'error',
        text: 'Network error while executing Stripe → CJ transfer bridge.'
      });
    }
    setIsMovingToCj(false);
  };

  const handleOrderEditChange = (order, field, value) => {
    setEditingOrderMap(prev => {
      const current = prev[order._id] || {
        status: order.status || 'Pending',
        tracking_code: order.tracking_code || '',
        logisticName: order.logisticName || '',
        notifyCustomer: true
      };
      return {
        ...prev,
        [order._id]: {
          ...current,
          [field]: value
        }
      };
    });
  };

  const handleSaveOrderStatus = async (order) => {
    const token = localStorage.getItem('token');
    const draft = editingOrderMap[order._id] || {
      status: order.status || 'Pending',
      tracking_code: order.tracking_code || '',
      logisticName: order.logisticName || '',
      notifyCustomer: false
    };

    setSavingOrderId(order._id);
    setStatusBanner({ type: '', text: '' });

    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/orders/${order._id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(draft)
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setStatusBanner({
          type: 'success',
          text: data.message || `Order #${order.shortId} updated! ✧`
        });
        await fetchFinancesAndOrders(false);
        if (onOrdersUpdated) onOrdersUpdated();
      } else {
        setStatusBanner({
          type: 'error',
          text: data.error || 'Failed to update order status.'
        });
      }
    } catch (err) {
      console.error('Error updating order status:', err);
      setStatusBanner({
        type: 'error',
        text: 'Network error while updating order status.'
      });
    }
    setSavingOrderId(null);
  };

  const handleSwitchOrderCjLogistics = async (order, newLogisticName, fetchOptionsOnly = false) => {
    const token = localStorage.getItem('token');
    setUpdatingCjLogisticsId(order._id);
    setStatusBanner({ type: '', text: '' });

    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/orders/${order._id}/cj-logistics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          logisticName: newLogisticName,
          fetchOptionsOnly: Boolean(fetchOptionsOnly)
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (Array.isArray(data.optionalLogistics) && data.optionalLogistics.length > 0) {
          setOrderCjCarrierOptionsMap(prev => ({
            ...prev,
            [order._id]: data.optionalLogistics
          }));
        }
        if (!fetchOptionsOnly) {
          handleOrderEditChange(order, 'logisticName', newLogisticName);
          setStatusBanner({
            type: 'success',
            text: data.message || `Updated Order #${order.shortId} CJ shipping carrier to ${newLogisticName}! ✧`
          });
          await fetchFinancesAndOrders(false);
          if (onOrdersUpdated) onOrdersUpdated();
        } else {
          setStatusBanner({
            type: 'success',
            text: `Loaded ${data.optionalLogistics?.length || 0} available CJ shipping carriers for Order #${order.shortId}! ✧`
          });
        }
      } else {
        setStatusBanner({
          type: 'error',
          text: data.error || 'Failed to update CJ shipping method for order.'
        });
      }
    } catch (err) {
      console.error('Switch Order CJ Logistics Error:', err);
      setStatusBanner({
        type: 'error',
        text: 'Network error while updating order CJ shipping carrier.'
      });
    }
    setUpdatingCjLogisticsId(null);
  };

  const handleManualFulfillSingleOrder = async (
    order,
    { payWithWallet = true, forceRecreate = false } = {}
  ) => {
    const token = localStorage.getItem('token');
    setFulfillingOrderId(order._id);
    setStatusBanner({ type: '', text: '' });

    try {
      const draft = editingOrderMap[order._id] || {};
      const shippingOverride = shippingDraftMap[order._id] || undefined;

      const res = await fetch(`${API_BASE_URL}/api/admin/orders/${order._id}/fulfill-cj`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          payWithWallet: Boolean(payWithWallet),
          forceRecreate: Boolean(forceRecreate),
          logisticName: draft.logisticName || order.selectedLogisticName || order.logisticName || 'CJPacket Sensitive',
          shipping_address: shippingOverride,
          notifyCustomer: Boolean(draft.notifyCustomer)
        })
      });
      const data = await res.json().catch(() => ({}));
      if (data.telemetry) {
        setTelemetry(data.telemetry);
      } else {
        await fetchFinancesAndOrders(false);
      }
      if (onOrdersUpdated) onOrdersUpdated();

      if (res.ok && data.ok) {
        setStatusBanner({
          type: 'success',
          text: data.message || `Order #${order.shortId} fulfilled on CJ Dropshipping! ✧`
        });
      } else {
        setStatusBanner({
          type: 'error',
          text: data.message || data.error || 'CJ fulfillment returned a warning. Check shipping address or CJ Wallet balance.'
        });
      }
    } catch (err) {
      console.error('Manual CJ fulfill error:', err);
      setStatusBanner({
        type: 'error',
        text: 'Network error while fulfilling order on CJ Dropshipping.'
      });
    }
    setFulfillingOrderId(null);
  };

  const handleBatchFulfillAllPending = async () => {
    const token = localStorage.getItem('token');
    setIsBatchFulfilling(true);
    setStatusBanner({ type: '', text: '' });

    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/orders/fulfill-all-pending`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          payWithWallet: true,
          includePendingCheckout: true
        })
      });
      const data = await res.json().catch(() => ({}));
      if (data.telemetry) {
        setTelemetry(data.telemetry);
      } else {
        await fetchFinancesAndOrders(false);
      }
      if (onOrdersUpdated) onOrdersUpdated();

      if (res.ok) {
        setStatusBanner({
          type: 'success',
          text: data.message || 'Batch CJ fulfillment complete! ✧'
        });
      } else {
        setStatusBanner({
          type: 'error',
          text: data.error || 'Could not complete batch CJ fulfillment.'
        });
      }
    } catch (err) {
      console.error('Batch CJ fulfill error:', err);
      setStatusBanner({
        type: 'error',
        text: 'Network error while running batch CJ fulfillment.'
      });
    }
    setIsBatchFulfilling(false);
  };

  const handleOpenEditShipping = (order) => {
    const addr = order.shipping_address || {};
    setShippingDraftMap(prev => ({
      ...prev,
      [order._id]: {
        name: addr.name || order.customerName || '',
        address_1: addr.address_1 || '',
        city: addr.city || '',
        state: addr.state || '',
        postcode: addr.postcode || '',
        country: addr.country || 'US',
        phone: addr.phone || ''
      }
    }));
    setEditingShippingOrderId(prev => (prev === order._id ? null : order._id));
  };

  const handleSaveOrderShippingAddress = async (order) => {
    const token = localStorage.getItem('token');
    const addrDraft = shippingDraftMap[order._id];
    if (!addrDraft) return;
    setSavingOrderId(order._id);
    setStatusBanner({ type: '', text: '' });

    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/orders/${order._id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          shipping_address: addrDraft
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setEditingShippingOrderId(null);
        setStatusBanner({
          type: 'success',
          text: `Saved shipping address for Order #${order.shortId}! You can now click "🚀 Fulfill on CJ Now". ✧`
        });
        await fetchFinancesAndOrders(false);
        if (onOrdersUpdated) onOrdersUpdated();
      } else {
        setStatusBanner({
          type: 'error',
          text: data.error || 'Failed to save shipping address.'
        });
      }
    } catch {
      setStatusBanner({
        type: 'error',
        text: 'Network error while saving shipping address.'
      });
    }
    setSavingOrderId(null);
  };

  const stripeBal = telemetry?.stripeBalance || {};
  const cjBal = telemetry?.cjBalance || {};
  const counts = telemetry?.orderPipeline?.counts || { total: 0, past: 0, present: 0, future: 0, scheduledMemberBoxes: 0 };
  const summary = telemetry?.summaryMetrics || {};
  const futureProj = telemetry?.futureProjections || { scheduledMemberBoxes: [] };
  const recentTransfers = telemetry?.recentTransfers || [];

  const [isClearingTestLedger, setIsClearingTestLedger] = useState(false);
  const [liveAuditData, setLiveAuditData] = useState(null);
  const [isAuditingFunds, setIsAuditingFunds] = useState(false);
  const [isRecoveringFunds, setIsRecoveringFunds] = useState(false);

  const fetchLiveFundsAudit = async () => {
    const token = localStorage.getItem('token');
    setIsAuditingFunds(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/finances/live-funds-audit`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLiveAuditData(data);
      }
    } catch (err) {
      console.error('Live funds audit error:', err);
    }
    setIsAuditingFunds(false);
  };

  const handleRecoverStripeFunds = async (action = 'cancel_all_pending_payouts', extra = {}) => {
    const token = localStorage.getItem('token');
    setIsRecoveringFunds(true);
    setStatusBanner({ type: '', text: '' });
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/finances/recover-stripe-funds`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action, ...extra })
      });
      const data = await res.json().catch(() => ({}));
      if (data.telemetry) {
        setTelemetry(data.telemetry);
      } else {
        await fetchFinancesAndOrders(false);
      }
      await fetchLiveFundsAudit();
      if (onOrdersUpdated) onOrdersUpdated();
      setStatusBanner({
        type: res.ok ? 'success' : 'error',
        text: data.message || data.error || 'Completed Stripe funds recovery action.'
      });
    } catch {
      setStatusBanner({
        type: 'error',
        text: 'Network error while executing Stripe funds recovery action.'
      });
    }
    setIsRecoveringFunds(false);
  };

  useEffect(() => {
    fetchLiveFundsAudit();
    // eslint-disable-next-line
  }, []);

  const handleClearTestLedger = async () => {
    const token = localStorage.getItem('token');
    setIsClearingTestLedger(true);
    setStatusBanner({ type: '', text: '' });
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/finances/clear-test-ledger`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ clearAllCardReserves: true })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (data.telemetry) {
          setTelemetry(data.telemetry);
        } else {
          await fetchFinancesAndOrders(false);
        }
        setStatusBanner({
          type: 'success',
          text: data.message || '🧹 Cleared old test/simulated reserve entries! Showing 100% live CJ.com Wallet balance ✧'
        });
      } else {
        setStatusBanner({
          type: 'error',
          text: data.error || 'Failed to clear test ledger entries.'
        });
      }
    } catch {
      setStatusBanner({
        type: 'error',
        text: 'Network error while clearing test ledger entries.'
      });
    }
    setIsClearingTestLedger(false);
  };

  // Live Money Dump & CJ Wholesale Reserve Math (Strictly 100% Real CJ.com Wallet Balance)
  const availableStripeUsd = Number(stripeBal.availableUsd || 0);
  const activeUnshippedCostUsd = Number(cjBal.activeUnshippedCostUsd || 0);
  const cjWalletAvailableUsd = Number(cjBal.availableUsd || 0);
  const cjCardReserveUsd = Number(cjBal.cjCardReserveBalanceUsd || 0);
  const simulatedTestReserveUsd = Number(cjBal.simulatedTestReserveUsd || 0);
  const effectiveCjPurchasingPowerUsd = Number((cjWalletAvailableUsd + cjCardReserveUsd).toFixed(2));
  const uncoveredCjWholesaleUsd = Number(Math.max(0, activeUnshippedCostUsd - effectiveCjPurchasingPowerUsd).toFixed(2));
  const reserveAppliedUsd = moneyDumpForm.reserveForActiveOrders ? uncoveredCjWholesaleUsd : 0;
  const maxSafeStripeDumpUsd = Number(Math.max(0, availableStripeUsd - reserveAppliedUsd).toFixed(2));

  const allPipelineOrders = telemetry?.orderPipeline?.all || [];
  const needsCjOrders = allPipelineOrders.filter(
    o =>
      o.status !== 'SHIPPED' &&
      o.status !== 'DELIVERED' &&
      o.status !== 'CANCELLED' &&
      o.status !== 'REFUNDED' &&
      (!o.cjOrderId || o.cjOrderStatus !== 'PAID_WALLET')
  );

  const rawOrders =
    pipelineFilter === 'NEEDS_CJ'
      ? needsCjOrders
      : pipelineFilter === 'PAST'
      ? (telemetry?.orderPipeline?.past || [])
      : pipelineFilter === 'PRESENT'
      ? (telemetry?.orderPipeline?.present || [])
      : pipelineFilter === 'FUTURE'
      ? (telemetry?.orderPipeline?.future || [])
      : allPipelineOrders;

  const cleanSearch = searchQuery.trim().toLowerCase();
  const filteredOrders = rawOrders.filter(ord => {
    if (!cleanSearch) return true;
    const haystack = `${ord.shortId || ''} ${ord._id || ''} ${ord.cjOrderId || ''} ${ord.customerName || ''} ${ord.customerEmail || ''} ${ord.status || ''} ${ord.tracking_code || ''} ${(ord.items || []).map(i => i.title).join(' ')}`.toLowerCase();
    return haystack.includes(cleanSearch);
  });

  const stageBadgeStyle = (stage) => {
    if (stage === 'PRESENT') {
      return { backgroundColor: '#F6FBF7', color: '#2E7D32', border: '1px solid #A5D6A7', label: '🟢 PRESENT • Active Fulfillment' };
    }
    if (stage === 'FUTURE') {
      return { backgroundColor: '#FFF8E7', color: '#B26A00', border: '1px solid #FFE082', label: '🔮 FUTURE • Awaiting Payment / Scheduled' };
    }
    return { backgroundColor: '#FFF0F2', color: '#8A797A', border: '1px solid #E8C5C8', label: '🏛️ PAST • Completed / Archived' };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '25px', animation: 'fadeIn 0.5s ease' }}>
      {viewMode !== 'ORDERS' && (
        <>
      {/* Top Action Bar */}
      <div style={{ backgroundColor: '#FFFFFF', padding: '20px 25px', borderRadius: '20px', border: '1px solid #E8C5C8', boxShadow: '0 8px 25px rgba(232, 197, 200, 0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2rem', color: '#5C5454', margin: '0 0 4px 0' }}>
            Executive Treasury & Order Pipeline Command Center ✧
          </h2>
          <p style={{ margin: 0, fontSize: '0.92rem', color: '#8A797A', fontFamily: 'sans-serif' }}>
            Real-time Stripe Money Dump Payouts, Stripe → CJ Dropshipping Wholesale Bridge, and Past, Present & Future Order Monitoring.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            disabled={isLoadingFinances || isSyncingCjOrders}
            onClick={() => fetchFinancesAndOrders(false)}
            style={{ backgroundColor: '#FFF9F9', border: '1px solid #B38B8F', color: '#5C5454', padding: '10px 18px', borderRadius: '22px', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.05rem', fontWeight: 'bold', cursor: (isLoadingFinances || isSyncingCjOrders) ? 'not-allowed' : 'pointer' }}
          >
            {isLoadingFinances ? '⏳ Refreshing...' : '↻ Refresh Live Balances'}
          </button>

          <button
            type="button"
            disabled={isLoadingFinances || isSyncingCjOrders}
            onClick={() => fetchFinancesAndOrders(true)}
            style={{ backgroundColor: '#F2D4D7', border: '1px solid #B38B8F', color: '#5C5454', padding: '10px 18px', borderRadius: '22px', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.05rem', fontWeight: 'bold', cursor: (isLoadingFinances || isSyncingCjOrders) ? 'not-allowed' : 'pointer' }}
          >
            {isSyncingCjOrders ? '⏳ Syncing CJ Tracking...' : '🔄 Sync CJ Order Tracking'}
          </button>
        </div>
      </div>

      {statusBanner.text && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '10px',
          fontFamily: 'sans-serif',
          fontSize: '0.95rem',
          backgroundColor: statusBanner.type === 'success' ? '#F6FBF7' : '#FFF5F5',
          color: statusBanner.type === 'success' ? '#2E7D32' : '#C62828',
          border: `1px solid ${statusBanner.type === 'success' ? '#A5D6A7' : '#FFCDD2'}`
        }}>
          {statusBanner.text}
        </div>
      )}

      {/* Live Stripe Money Tracker, Payout Reversal ($5.19 po_...) & Hands-Free CJ Auto-Pay Console */}
      <div style={{ backgroundColor: '#FFFFFF', padding: '22px 26px', borderRadius: '20px', border: '2px solid #B38B8F', boxShadow: '0 8px 25px rgba(179, 139, 143, 0.18)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.85rem', color: '#5C5454', margin: 0 }}>
                🛡️ Live Money Recovery & Hands-Free CJ Auto-Payment Console
              </h3>
              <span style={{ backgroundColor: '#F6FBF7', color: '#2E7D32', border: '1px solid #A5D6A7', padding: '3px 10px', borderRadius: '12px', fontSize: '0.76rem', fontWeight: 'bold', fontFamily: 'sans-serif' }}>
                ✓ Auto-Picks Optimal CJ Shipping • Auto-Confirms Cart for CJ Auto-Pay
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.86rem', color: '#736A6A', fontFamily: 'sans-serif', lineHeight: '1.45' }}>
              Inspect every live Stripe Payout (such as <code>po_1UY6XZFNjDeRHBxyMRVOcV4F</code> for $5.19), your <strong>${cjCardReserveUsd.toFixed(2)}</strong> Card Reserve, and live Stripe charges. Cancel any <code>pending</code> Stripe payouts to return funds immediately to your Live Stripe Available Balance, or trigger hands-free CJ Cart Confirmation so Susan's CJ Auto-Payment charges and fulfills active orders automatically.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              disabled={isRecoveringFunds}
              onClick={() => handleRecoverStripeFunds('cancel_all_pending_payouts')}
              style={{ backgroundColor: '#2E7D32', color: '#FFFFFF', border: 'none', padding: '10px 16px', borderRadius: '20px', fontFamily: 'sans-serif', fontSize: '0.84rem', fontWeight: 'bold', cursor: isRecoveringFunds ? 'not-allowed' : 'pointer', boxShadow: '0 4px 12px rgba(46, 125, 50, 0.25)' }}
            >
              {isRecoveringFunds ? '⏳ Processing...' : '↩️ Cancel Pending Payouts & Return Money to Stripe Balance'}
            </button>
            <button
              type="button"
              disabled={isRecoveringFunds}
              onClick={() => handleRecoverStripeFunds('auto_confirm_cj_orders')}
              style={{ backgroundColor: '#F2D4D7', color: '#5C5454', border: '1.5px solid #B38B8F', padding: '10px 16px', borderRadius: '20px', fontFamily: 'sans-serif', fontSize: '0.84rem', fontWeight: 'bold', cursor: isRecoveringFunds ? 'not-allowed' : 'pointer' }}
            >
              ⚡ Auto-Confirm & Queue All Active Orders for CJ Auto-Pay
            </button>
            <button
              type="button"
              disabled={isAuditingFunds}
              onClick={fetchLiveFundsAudit}
              style={{ backgroundColor: '#FFF9F9', color: '#5C5454', border: '1px solid #E8C5C8', padding: '10px 14px', borderRadius: '20px', fontFamily: 'sans-serif', fontSize: '0.82rem', fontWeight: 'bold', cursor: 'pointer' }}
            >
              {isAuditingFunds ? '⏳ Auditing...' : '🔍 Audit Live Stripe & Reserve'}
            </button>
          </div>
        </div>

        {/* Live Stripe Payouts & Card Charges Breakdown Table */}
        {liveAuditData && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '12px', backgroundColor: '#FFF9F9', padding: '12px 14px', borderRadius: '14px', border: '1px solid #E8C5C8', fontFamily: 'sans-serif', fontSize: '0.8rem' }}>
            <div>
              <strong style={{ color: '#5C5454', display: 'block', marginBottom: '6px' }}>
                🏦 Recent Live Stripe Payouts ({ (liveAuditData.livePayouts || []).length }):
              </strong>
              {(liveAuditData.livePayouts || []).length === 0 ? (
                <span style={{ color: '#8A797A' }}>No recent Stripe payouts found.</span>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '150px', overflowY: 'auto' }}>
                  {(liveAuditData.livePayouts || []).slice(0, 8).map(p => (
                    <div key={p.id} style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8C5C8', borderRadius: '8px', padding: '6px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <div>
                        <strong>${Number(p.amountUsd || 0).toFixed(2)}</strong> • <code>{p.id}</code>
                        <span style={{ display: 'block', fontSize: '0.72rem', color: '#736A6A' }}>
                          Status: <strong style={{ color: p.status === 'pending' ? '#B26A00' : '#2E7D32' }}>{String(p.status).toUpperCase()}</strong> • To: {p.destinationBankName} {p.destinationLast4 ? `••••${p.destinationLast4}` : ''}
                        </span>
                      </div>
                      {p.canCancelToReturnToStripe && (
                        <button
                          type="button"
                          disabled={isRecoveringFunds}
                          onClick={() => handleRecoverStripeFunds('cancel_payout', { payoutId: p.id })}
                          style={{ backgroundColor: '#2E7D32', color: '#FFFFFF', border: 'none', borderRadius: '8px', padding: '4px 10px', fontSize: '0.72rem', fontWeight: 'bold', cursor: 'pointer' }}
                        >
                          ↩️ Return to Stripe
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <strong style={{ color: '#5C5454', display: 'block', marginBottom: '6px' }}>
                💳 Recent Stripe Card Charges & Reserve Top-Ups ({ (liveAuditData.liveCharges || []).length }):
              </strong>
              {(liveAuditData.liveCharges || []).length === 0 ? (
                <span style={{ color: '#8A797A' }}>No recent card charges found.</span>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '150px', overflowY: 'auto' }}>
                  {(liveAuditData.liveCharges || []).slice(0, 8).map(c => (
                    <div key={c.id} style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8C5C8', borderRadius: '8px', padding: '6px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <div>
                        <strong>${Number(c.amountUsd || 0).toFixed(2)}</strong> • {c.cardBrand ? `${c.cardBrand.toUpperCase()} ••••${c.cardLast4}` : c.id}
                        <span style={{ display: 'block', fontSize: '0.72rem', color: '#736A6A' }}>
                          {c.refunded ? 'Refunded to Card' : 'In Your Stripe Account Balance'} {c.description ? `• ${c.description.slice(0, 36)}` : ''}
                        </span>
                      </div>
                      {c.canRefundToCard && (
                        <button
                          type="button"
                          disabled={isRecoveringFunds}
                          onClick={() => handleRecoverStripeFunds('refund_charge', { chargeId: c.id })}
                          style={{ backgroundColor: '#FFF0F2', color: '#C62828', border: '1px solid #C62828', borderRadius: '8px', padding: '4px 9px', fontSize: '0.72rem', fontWeight: 'bold', cursor: 'pointer' }}
                        >
                          💳 Refund to Card
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Row 1: Live Stripe Balance, CJ Dropshipping Wallet & Profit/Forecast Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '22px' }}>
        {/* 1. Stripe Account Balance Card */}
        <div style={{ backgroundColor: '#FFFFFF', padding: '25px', borderRadius: '20px', border: '1px solid #E8C5C8', boxShadow: '0 8px 25px rgba(232, 197, 200, 0.15)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.35rem', color: '#5C5454', fontWeight: 'bold' }}>
                💳 Stripe Account Balance
              </span>
              <span style={{
                padding: '3px 10px',
                borderRadius: '12px',
                fontSize: '0.75rem',
                fontWeight: 'bold',
                fontFamily: 'sans-serif',
                backgroundColor: stripeBal.connected ? (stripeBal.mode === 'LIVE' ? '#F6FBF7' : '#FFF8E7') : '#FFF5F5',
                color: stripeBal.connected ? (stripeBal.mode === 'LIVE' ? '#2E7D32' : '#B26A00') : '#C62828',
                border: `1px solid ${stripeBal.connected ? (stripeBal.mode === 'LIVE' ? '#A5D6A7' : '#FFE082') : '#FFCDD2'}`
              }}>
                {stripeBal.connected ? `✓ ${stripeBal.mode} MODE` : '⚠️ CHECK KEY'}
              </span>
            </div>

            <div style={{ backgroundColor: '#FFF9F9', border: '1px solid #E8C5C8', borderRadius: '14px', padding: '16px', marginBottom: '14px' }}>
              <p style={{ margin: '0 0 4px 0', fontSize: '0.85rem', color: '#8A797A', fontFamily: 'sans-serif' }}>Available for Payout ({stripeBal.currency || 'USD'})</p>
              <p style={{ margin: 0, fontFamily: "'Cormorant Garamond', serif", fontSize: '2.4rem', color: '#B38B8F', fontWeight: 'bold' }}>
                ${Number(stripeBal.availableUsd || 0).toFixed(2)}
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px', fontFamily: 'sans-serif', fontSize: '0.88rem' }}>
              <div style={{ backgroundColor: '#FFF0F2', padding: '10px', borderRadius: '10px' }}>
                <span style={{ color: '#8A797A', display: 'block', fontSize: '0.78rem' }}>Pending Settlement</span>
                <strong style={{ color: '#5C5454', fontSize: '1.05rem' }}>${Number(stripeBal.pendingUsd || 0).toFixed(2)}</strong>
              </div>
              <div style={{ backgroundColor: '#FFF0F2', padding: '10px', borderRadius: '10px' }}>
                <span style={{ color: '#8A797A', display: 'block', fontSize: '0.78rem' }}>Instant Available</span>
                <strong style={{ color: '#5C5454', fontSize: '1.05rem' }}>${Number(stripeBal.instantAvailableUsd || 0).toFixed(2)}</strong>
              </div>
            </div>

            {stripeBal.error && (
              <p style={{ margin: '0 0 10px 0', fontSize: '0.82rem', color: '#C62828', fontFamily: 'sans-serif' }}>
                ⚠️ {stripeBal.error}
              </p>
            )}
          </div>

          <div style={{ borderTop: '1px solid #E8C5C8', paddingTop: '10px', fontSize: '0.82rem', color: '#736A6A', fontFamily: 'sans-serif' }}>
            {Array.isArray(stripeBal.recentPayouts) && stripeBal.recentPayouts.length > 0 ? (
              <span>
                Latest Payout: <strong>${Number(stripeBal.recentPayouts[0].amountUsd || 0).toFixed(2)}</strong> ({stripeBal.recentPayouts[0].status})
              </span>
            ) : (
              <span>Total Combined Stripe Balance: <strong>${Number(stripeBal.totalBalanceUsd || 0).toFixed(2)}</strong></span>
            )}
          </div>
        </div>

        {/* 2. CJ Dropshipping Wallet Balance Card (Strictly 100% Real CJ.com Live Balance) */}
        <div style={{ backgroundColor: '#FFFFFF', padding: '25px', borderRadius: '20px', border: '1px solid #E8C5C8', boxShadow: '0 8px 25px rgba(232, 197, 200, 0.15)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.35rem', color: '#5C5454', fontWeight: 'bold' }}>
                📦 CJ Dropshipping Wallet
              </span>
              <span style={{
                padding: '3px 10px',
                borderRadius: '12px',
                fontSize: '0.75rem',
                fontWeight: 'bold',
                fontFamily: 'sans-serif',
                backgroundColor: cjBal.connected ? '#F6FBF7' : '#FFF8E7',
                color: cjBal.connected ? '#2E7D32' : '#B26A00',
                border: `1px solid ${cjBal.connected ? '#A5D6A7' : '#FFE082'}`
              }}>
                {cjBal.connected ? '✓ LIVE CJ.COM API' : '⚠️ CHECK TOKEN'}
              </span>
            </div>

            <div style={{ backgroundColor: '#FFF9F9', border: '1px solid #E8C5C8', borderRadius: '14px', padding: '16px', marginBottom: '12px' }}>
              <p style={{ margin: '0 0 4px 0', fontSize: '0.82rem', color: '#8A797A', fontFamily: 'sans-serif' }}>
                Total CJ Fulfillment Reserve & Wallet Power (USD)
              </p>
              <p style={{ margin: 0, fontFamily: "'Cormorant Garamond', serif", fontSize: '2.4rem', color: '#B38B8F', fontWeight: 'bold' }}>
                ${effectiveCjPurchasingPowerUsd.toFixed(2)}
              </p>
              <div style={{ marginTop: '6px', display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#736A6A', fontFamily: 'sans-serif', flexWrap: 'wrap', gap: '6px' }}>
                <span>Card Reserve in Stripe: <strong style={{ color: '#2E7D32' }}>${cjCardReserveUsd.toFixed(2)}</strong></span>
                <span>CJ.com Wallet Balance: <strong>${cjWalletAvailableUsd.toFixed(2)}</strong></span>
              </div>
              <div style={{ marginTop: '6px', fontSize: '0.73rem', color: '#2E7D32', fontFamily: 'sans-serif', fontWeight: 'bold' }}>
                ⚡ CJ Auto-Payment Active: Orders automatically lock in the optimal CJ carrier, enter CJ Cart (`addCart`), and confirm (`confirmOrder`) so Susan's CJ Auto-Payment charges automatically!
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px', fontFamily: 'sans-serif', fontSize: '0.88rem' }}>
              <div style={{ backgroundColor: '#FFF0F2', padding: '10px', borderRadius: '10px' }}>
                <span style={{ color: '#8A797A', display: 'block', fontSize: '0.78rem' }}>Active Unshipped Cost</span>
                <strong style={{ color: '#5C5454', fontSize: '1.05rem' }}>${Number(cjBal.activeUnshippedCostUsd || 0).toFixed(2)}</strong>
              </div>
              <div style={{ backgroundColor: '#FFF0F2', padding: '10px', borderRadius: '10px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '3px' }}>
                <a
                  href={cjBal.cjRechargePortalUrl || 'https://app.cjdropshipping.com/myCJ.html#/myCJWallet'}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#B38B8F', fontWeight: 'bold', fontSize: '0.78rem', textDecoration: 'none' }}
                >
                  💳 1. Top Up CJ.com Wallet ↗
                </a>
                <a
                  href="https://app.cjdropshipping.com/myCJ.html#/dropshippingOrders"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#5C5454', fontWeight: 'bold', fontSize: '0.74rem', textDecoration: 'none' }}
                >
                  📦 2. Pay Orders on CJ.com ↗
                </a>
              </div>
            </div>

            {cjBal.error && (
              <p style={{ margin: '0 0 10px 0', fontSize: '0.82rem', color: '#B26A00', fontFamily: 'sans-serif' }}>
                ℹ️ {cjBal.error}
              </p>
            )}
          </div>

          <div style={{ borderTop: '1px solid #E8C5C8', paddingTop: '10px', fontSize: '0.8rem', fontFamily: 'sans-serif', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
            {cjWalletAvailableUsd >= activeUnshippedCostUsd && activeUnshippedCostUsd > 0 ? (
              <span style={{ color: '#2E7D32', fontWeight: 'bold' }}>
                ✓ Live CJ.com Wallet covers all active unshipped orders
              </span>
            ) : (
              <span style={{ color: '#C62828', fontWeight: 'bold' }}>
                ⚠️ Live CJ.com Wallet is ${cjWalletAvailableUsd.toFixed(2)} — Top up on CJ.com or pay invoice in MyCJ
              </span>
            )}
            <button
              type="button"
              disabled={isClearingTestLedger}
              onClick={handleClearTestLedger}
              style={{ backgroundColor: '#FFF9F9', border: '1px solid #E8C5C8', color: '#736A6A', borderRadius: '10px', padding: '3px 8px', fontSize: '0.72rem', cursor: 'pointer' }}
              title="Purge any old simulated/test reserve entries from the local ledger"
            >
              🧹 Purge Test Ledger
            </button>
          </div>
        </div>

        {/* 3. Boutique Profit & Future 30-Day Revenue Forecast Card */}
        <div style={{ backgroundColor: '#FFFFFF', padding: '25px', borderRadius: '20px', border: '1px solid #E8C5C8', boxShadow: '0 8px 25px rgba(232, 197, 200, 0.15)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.35rem', color: '#5C5454', fontWeight: 'bold' }}>
                📈 Net Profit & 30-Day Forecast
              </span>
              <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold', fontFamily: 'sans-serif', backgroundColor: '#FFF0F2', color: '#B38B8F', border: '1px solid #E8C5C8' }}>
                6.5x Markup
              </span>
            </div>

            <div style={{ backgroundColor: '#FFF9F9', border: '1px solid #E8C5C8', borderRadius: '14px', padding: '16px', marginBottom: '14px' }}>
              <p style={{ margin: '0 0 4px 0', fontSize: '0.85rem', color: '#8A797A', fontFamily: 'sans-serif' }}>Estimated Net Boutique Profit (Paid Orders)</p>
              <p style={{ margin: 0, fontFamily: "'Cormorant Garamond', serif", fontSize: '2.4rem', color: '#2E7D32', fontWeight: 'bold' }}>
                ${Number(summary.totalEstimatedProfitUsd || 0).toFixed(2)}
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px', fontFamily: 'sans-serif', fontSize: '0.88rem' }}>
              <div style={{ backgroundColor: '#FFF0F2', padding: '10px', borderRadius: '10px' }}>
                <span style={{ color: '#8A797A', display: 'block', fontSize: '0.78rem' }}>Paid Retail Revenue</span>
                <strong style={{ color: '#5C5454', fontSize: '1.05rem' }}>${Number(summary.totalPaidRevenueUsd || 0).toFixed(2)}</strong>
              </div>
              <div style={{ backgroundColor: '#FFF0F2', padding: '10px', borderRadius: '10px' }}>
                <span style={{ color: '#8A797A', display: 'block', fontSize: '0.78rem' }}>30-Day Future Forecast</span>
                <strong style={{ color: '#B38B8F', fontSize: '1.05rem' }}>${Number(futureProj.projectedNext30DaysTotal || 0).toFixed(2)}</strong>
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid #E8C5C8', paddingTop: '10px', fontSize: '0.82rem', color: '#736A6A', fontFamily: 'sans-serif' }}>
            Active Memberships: <strong>{futureProj.radianceCount || 0} Radiance ($119)</strong> • <strong>{futureProj.luminaryCount || 0} Luminary ($49)</strong>
          </div>
        </div>
      </div>

      {/* Row 1.25: Phase 4 — Dedicated Bank Card CJ Wallet Top-Up Studio */}
      <div style={{ backgroundColor: '#FFFFFF', padding: '26px 28px', borderRadius: '20px', border: '2px solid #B38B8F', boxShadow: '0 10px 28px rgba(179, 139, 143, 0.2)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.9rem', color: '#5C5454', margin: 0 }}>
                💳 Add Funds to CJ Wallet with Bank Card
              </h3>
              <span style={{ backgroundColor: '#F6FBF7', color: '#2E7D32', border: '1px solid #A5D6A7', padding: '4px 12px', borderRadius: '14px', fontSize: '0.78rem', fontWeight: 'bold', fontFamily: 'sans-serif' }}>
                ✓ Visa • Mastercard • Amex • Bank Debit
              </span>
            </div>
            <p style={{ margin: '5px 0 0 0', fontSize: '0.9rem', color: '#8A797A', fontFamily: 'sans-serif' }}>
              Charge your bank debit or credit card directly to fund your CJ Wallet Reserve and automatically pay waiting CJ Dropshipping orders (`POST /shopping/pay/payBalance`), or launch CJ's direct card recharge portal.
            </p>
          </div>

          <a
            href={cjBal.cjRechargePortalUrl || 'https://app.cjdropshipping.com/myCJ.html#/myCJWallet'}
            target="_blank"
            rel="noopener noreferrer"
            style={{ backgroundColor: '#FFF0F2', border: '1px solid #B38B8F', color: '#5C5454', padding: '9px 16px', borderRadius: '20px', fontFamily: "'Cormorant Garamond', serif", fontSize: '1rem', fontWeight: 'bold', textDecoration: 'none', whiteSpace: 'nowrap' }}
          >
            🌐 Open CJ Direct Card / Payoneer Portal ↗
          </a>
        </div>

        {/* Preset Amount Buttons */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 'bold', color: '#5C5454', fontFamily: 'sans-serif' }}>
            Quick Top-Up Amounts:
          </span>
          {[25, 50, 100, 250].map(amt => {
            const isSelected = Number(cjCardTopUpForm.amountUsd) === amt;
            return (
              <button
                key={amt}
                type="button"
                onClick={() => setCjCardTopUpForm(prev => ({ ...prev, amountUsd: String(amt.toFixed(2)) }))}
                style={{
                  padding: '8px 16px',
                  borderRadius: '18px',
                  border: isSelected ? '2px solid #B38B8F' : '1px solid #E8C5C8',
                  backgroundColor: isSelected ? '#F2D4D7' : '#FFF9F9',
                  color: '#5C5454',
                  fontFamily: 'sans-serif',
                  fontSize: '0.86rem',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                +${amt}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() =>
              setCjCardTopUpForm(prev => ({
                ...prev,
                amountUsd: String((activeUnshippedCostUsd > 0 ? activeUnshippedCostUsd : 50).toFixed(2))
              }))
            }
            style={{
              padding: '8px 16px',
              borderRadius: '18px',
              border: '1px solid #B38B8F',
              backgroundColor: '#FFF0F2',
              color: '#5C5454',
              fontFamily: 'sans-serif',
              fontSize: '0.84rem',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            ⚡ Cover Unshipped Orders (${(activeUnshippedCostUsd > 0 ? activeUnshippedCostUsd : 50).toFixed(2)})
          </button>
        </div>

        {/* Custom Amount, Card Info & Action Buttons */}
        <form onSubmit={(e) => handleCjCardTopUpCheckout(e, false)} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', alignItems: 'end', backgroundColor: '#FFF9F9', padding: '16px', borderRadius: '14px', border: '1px solid #E8C5C8' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 'bold', color: '#5C5454', fontFamily: 'sans-serif', marginBottom: '4px' }}>
              Top-Up Amount (USD $):
            </label>
            <input
              required
              type="number"
              step="0.01"
              min="1"
              value={cjCardTopUpForm.amountUsd}
              onChange={(e) => setCjCardTopUpForm(prev => ({ ...prev, amountUsd: e.target.value }))}
              placeholder="e.g. 100.00"
              style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #B38B8F', fontFamily: 'sans-serif', fontSize: '0.95rem', fontWeight: 'bold', backgroundColor: '#FFFFFF', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 'bold', color: '#5C5454', fontFamily: 'sans-serif', marginBottom: '4px' }}>
              Bank Card Network:
            </label>
            <select
              value={cjCardTopUpForm.cardBrand}
              onChange={(e) => setCjCardTopUpForm(prev => ({ ...prev, cardBrand: e.target.value }))}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #E8C5C8', fontFamily: 'sans-serif', fontSize: '0.88rem', backgroundColor: '#FFFFFF', color: '#5C5454', boxSizing: 'border-box' }}
            >
              <option value="VISA">💳 Visa Debit / Credit</option>
              <option value="MASTERCARD">💳 Mastercard Debit / Credit</option>
              <option value="AMEX">💳 American Express</option>
              <option value="DISCOVER">💳 Discover Card</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 'bold', color: '#5C5454', fontFamily: 'sans-serif', marginBottom: '4px' }}>
              Card Last 4 / Reference Note:
            </label>
            <input
              type="text"
              value={cjCardTopUpForm.notes}
              onChange={(e) => setCjCardTopUpForm(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Optional memo (e.g. Business Visa)"
              style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #E8C5C8', fontFamily: 'sans-serif', fontSize: '0.88rem', backgroundColor: '#FFFFFF', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#5C5454', fontFamily: 'sans-serif', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={Boolean(cjCardTopUpForm.autoPayOrders)}
                onChange={(e) => setCjCardTopUpForm(prev => ({ ...prev, autoPayOrders: e.target.checked }))}
              />
              <strong>Auto-Pay Unpaid CJ Orders Immediately</strong>
            </label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="submit"
                disabled={isToppingUpCjCard}
                style={{ flex: 1, backgroundColor: '#F2D4D7', border: '1px solid #B38B8F', color: '#5C5454', padding: '10px 14px', borderRadius: '20px', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.05rem', fontWeight: 'bold', cursor: isToppingUpCjCard ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}
              >
                {isToppingUpCjCard ? '⏳ Processing...' : '💳 Pay with Bank Card (Stripe Checkout)'}
              </button>
              <button
                type="button"
                disabled={isToppingUpCjCard}
                onClick={(e) => handleCjCardTopUpCheckout(e, true)}
                style={{ backgroundColor: '#B38B8F', border: 'none', color: '#FFFFFF', padding: '10px 14px', borderRadius: '20px', fontFamily: "'Cormorant Garamond', serif", fontSize: '1rem', fontWeight: 'bold', cursor: isToppingUpCjCard ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}
                title="Instantly credits your CJ Card Reserve & auto-pays waiting CJ orders"
              >
                ⚡ Instant Deposit
              </button>
            </div>
          </div>
        </form>

        {lastCardTopUpResult && (
          <div style={{ padding: '11px 15px', borderRadius: '10px', backgroundColor: '#F6FBF7', border: '1px solid #A5D6A7', fontSize: '0.86rem', color: '#2E7D32', fontFamily: 'sans-serif', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <span>
              <strong>✓ Latest Bank Card Top-Up:</strong> {lastCardTopUpResult.message}
            </span>
            <span style={{ fontWeight: 'bold' }}>
              Effective CJ Purchasing Power: ${effectiveCjPurchasingPowerUsd.toFixed(2)}
            </span>
          </div>
        )}
      </div>

      {/* Row 1.5: Phase 3 — Executive Treasury Console: Stripe Money Dump & Stripe → CJ Dropshipping Bridge */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '24px' }}>
        {/* Column A: Susan's Stripe "Money Dump" (Bank Payout) */}
        <div style={{ backgroundColor: '#FFFFFF', padding: '26px', borderRadius: '20px', border: '1.5px solid #B38B8F', boxShadow: '0 8px 25px rgba(232, 197, 200, 0.18)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>
              <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.75rem', color: '#5C5454', margin: 0 }}>
                💸 Susan's Stripe "Money Dump" (Bank Payout)
              </h3>
              <span style={{ backgroundColor: '#FFF0F2', color: '#B38B8F', border: '1px solid #E8C5C8', padding: '3px 10px', borderRadius: '12px', fontSize: '0.76rem', fontWeight: 'bold', fontFamily: 'sans-serif' }}>
                Stripe Payouts API
              </span>
            </div>
            <p style={{ margin: '0 0 16px 0', fontSize: '0.88rem', color: '#8A797A', fontFamily: 'sans-serif', lineHeight: '1.45' }}>
              Sweep your available Stripe profits directly to your linked bank account or debit card while optionally holding back a Smart Wholesale Reserve for active unshipped CJ orders.
            </p>

            {/* Live Payout Calculation Preview Box */}
            <div style={{ backgroundColor: '#FFF9F9', border: '1px solid #E8C5C8', borderRadius: '12px', padding: '12px 15px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', fontFamily: 'sans-serif', fontSize: '0.86rem' }}>
              <div>
                <span style={{ color: '#8A797A', display: 'block', fontSize: '0.76rem' }}>Safe Bank Dump Available</span>
                <strong style={{ color: '#2E7D32', fontSize: '1.25rem' }}>${maxSafeStripeDumpUsd.toFixed(2)}</strong>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ color: '#8A797A', display: 'block', fontSize: '0.76rem' }}>Smart CJ Wholesale Reserve</span>
                <strong style={{ color: '#B38B8F', fontSize: '1.05rem' }}>${reserveAppliedUsd.toFixed(2)}</strong>
              </div>
            </div>

            <form onSubmit={handleExecuteStripeMoneyDump} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setMoneyDumpForm({ ...moneyDumpForm, fullAvailableDump: true, amountUsd: '' })}
                  style={{
                    flex: 1,
                    padding: '9px 12px',
                    borderRadius: '14px',
                    border: moneyDumpForm.fullAvailableDump ? '1.5px solid #B38B8F' : '1px solid #E8C5C8',
                    backgroundColor: moneyDumpForm.fullAvailableDump ? '#F2D4D7' : '#FFF9F9',
                    color: '#5C5454',
                    fontFamily: 'sans-serif',
                    fontSize: '0.84rem',
                    fontWeight: moneyDumpForm.fullAvailableDump ? 'bold' : 'normal',
                    cursor: 'pointer'
                  }}
                >
                  ✓ Dump Full Safe Balance (${maxSafeStripeDumpUsd.toFixed(2)})
                </button>
                <button
                  type="button"
                  onClick={() => setMoneyDumpForm({ ...moneyDumpForm, fullAvailableDump: false })}
                  style={{
                    flex: 1,
                    padding: '9px 12px',
                    borderRadius: '14px',
                    border: !moneyDumpForm.fullAvailableDump ? '1.5px solid #B38B8F' : '1px solid #E8C5C8',
                    backgroundColor: !moneyDumpForm.fullAvailableDump ? '#F2D4D7' : '#FFF9F9',
                    color: '#5C5454',
                    fontFamily: 'sans-serif',
                    fontSize: '0.84rem',
                    fontWeight: !moneyDumpForm.fullAvailableDump ? 'bold' : 'normal',
                    cursor: 'pointer'
                  }}
                >
                  Custom USD Amount ($)
                </button>
              </div>

              {!moneyDumpForm.fullAvailableDump && (
                <input
                  required
                  type="number"
                  step="0.01"
                  min="1"
                  placeholder="Enter custom payout amount in USD (e.g. 250.00)"
                  value={moneyDumpForm.amountUsd}
                  onChange={(e) => setMoneyDumpForm({ ...moneyDumpForm, amountUsd: e.target.value })}
                  style={{ padding: '10px 14px', borderRadius: '10px', border: '1px solid #E8C5C8', fontFamily: 'sans-serif', fontSize: '0.92rem', backgroundColor: '#FFF9F9' }}
                />
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <select
                  value={moneyDumpForm.method}
                  onChange={(e) => setMoneyDumpForm({ ...moneyDumpForm, method: e.target.value })}
                  style={{ padding: '10px 12px', borderRadius: '10px', border: '1px solid #E8C5C8', fontFamily: 'sans-serif', fontSize: '0.88rem', color: '#5C5454', backgroundColor: '#FFF9F9' }}
                >
                  <option value="standard">🏦 Standard Bank ACH (Free • 1–2 Days)</option>
                  <option value="instant">⚡ Instant Debit Card Payout</option>
                </select>

                <input
                  type="text"
                  placeholder="Ledger Note (e.g. Weekly Profit Sweep)"
                  value={moneyDumpForm.notes}
                  onChange={(e) => setMoneyDumpForm({ ...moneyDumpForm, notes: e.target.value })}
                  style={{ padding: '10px 12px', borderRadius: '10px', border: '1px solid #E8C5C8', fontFamily: 'sans-serif', fontSize: '0.88rem' }}
                />
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#5C5454', fontFamily: 'sans-serif', cursor: 'pointer', backgroundColor: '#FFF9F9', padding: '8px 12px', borderRadius: '10px', border: '1px solid #E8C5C8' }}>
                <input
                  type="checkbox"
                  checked={Boolean(moneyDumpForm.reserveForActiveOrders)}
                  onChange={(e) => setMoneyDumpForm({ ...moneyDumpForm, reserveForActiveOrders: e.target.checked })}
                />
                <span>
                  <strong>Smart CJ Wholesale Reserve:</strong> Keep ${uncoveredCjWholesaleUsd.toFixed(2)} in Stripe to cover active unshipped CJ orders
                </span>
              </label>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '4px' }}>
                <button
                  type="submit"
                  disabled={isDumpingStripe}
                  style={{ flex: 2, backgroundColor: '#F2D4D7', border: '1px solid #B38B8F', color: '#5C5454', padding: '12px 18px', borderRadius: '24px', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.15rem', fontWeight: 'bold', cursor: isDumpingStripe ? 'not-allowed' : 'pointer' }}
                >
                  {isDumpingStripe ? '⏳ Dumping Stripe Funds...' : '💸 Execute Stripe Money Dump ✧'}
                </button>

                {onAskOdie && (
                  <button
                    type="button"
                    onClick={() =>
                      onAskOdie(
                        'Odie, execute a Stripe money dump of my available balance to the bank, reserving enough for active unshipped CJ orders.'
                      )
                    }
                    style={{ flex: 1, backgroundColor: '#B38B8F', border: 'none', color: '#FFFFFF', padding: '12px 14px', borderRadius: '24px', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.05rem', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    🐾 Ask Odie
                  </button>
                )}
              </div>
            </form>

            {lastDumpResult && (
              <div style={{ marginTop: '12px', padding: '10px 12px', borderRadius: '10px', backgroundColor: '#F6FBF7', border: '1px solid #A5D6A7', fontSize: '0.84rem', color: '#2E7D32', fontFamily: 'sans-serif' }}>
                <strong>✓ Latest Money Dump:</strong> {lastDumpResult.message}
              </div>
            )}
          </div>
        </div>

        {/* Column B: Move Money: Stripe → CJ Dropshipping Wholesale Bridge & Order Auto-Payment */}
        <div style={{ backgroundColor: '#FFFFFF', padding: '26px', borderRadius: '20px', border: '1.5px solid #B38B8F', boxShadow: '0 8px 25px rgba(232, 197, 200, 0.18)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>
              <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.75rem', color: '#5C5454', margin: 0 }}>
                📦 Move Money: Stripe → CJ Dropshipping Bridge
              </h3>
              <span style={{ backgroundColor: '#F6FBF7', color: '#2E7D32', border: '1px solid #A5D6A7', padding: '3px 10px', borderRadius: '12px', fontSize: '0.76rem', fontWeight: 'bold', fontFamily: 'sans-serif' }}>
                CJ Wallet & Order Pay
              </span>
            </div>
            <p style={{ margin: '0 0 12px 0', fontSize: '0.86rem', color: '#8A797A', fontFamily: 'sans-serif', lineHeight: '1.45' }}>
              <strong>How Stripe → CJ Works:</strong> Because CJ Dropshipping does not allow Stripe to wire money directly into CJ's proprietary wallet via API, <strong>Stage A</strong> sends a dedicated <code>CJ DROPSHIP</code> payout from Stripe to your linked bank card, and <strong>Stage B</strong> submits your orders to CJ (`createOrderV2`) and pays them from your live <a href="https://app.cjdropshipping.com/myCJ.html#/myCJWallet" target="_blank" rel="noopener noreferrer" style={{ color: '#B38B8F', fontWeight: 'bold' }}>CJ.com Wallet ↗</a> (`payBalance`).
            </p>

            {/* Live CJ Wholesale Needed vs CJ Wallet Box */}
            <div style={{ backgroundColor: '#FFF9F9', border: '1px solid #E8C5C8', borderRadius: '12px', padding: '12px 15px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', fontFamily: 'sans-serif', fontSize: '0.86rem' }}>
              <div>
                <span style={{ color: '#8A797A', display: 'block', fontSize: '0.76rem' }}>Active Unshipped CJ Wholesale Cost</span>
                <strong style={{ color: '#5C5454', fontSize: '1.25rem' }}>${activeUnshippedCostUsd.toFixed(2)}</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() =>
                    setCjBridgeForm({
                      ...cjBridgeForm,
                      amountUsd: String(activeUnshippedCostUsd > 0 ? activeUnshippedCostUsd.toFixed(2) : '50.00')
                    })
                  }
                  style={{ backgroundColor: '#FFF0F2', border: '1px solid #B38B8F', color: '#5C5454', padding: '6px 12px', borderRadius: '14px', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Use Exact Wholesale (${(activeUnshippedCostUsd > 0 ? activeUnshippedCostUsd : 50).toFixed(2)})
                </button>
              </div>
            </div>

            <form onSubmit={handleExecuteStripeToCjBridge} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  placeholder={`Transfer Amount ($ default ${(activeUnshippedCostUsd > 0 ? activeUnshippedCostUsd : 50).toFixed(2)})`}
                  value={cjBridgeForm.amountUsd}
                  onChange={(e) => setCjBridgeForm({ ...cjBridgeForm, amountUsd: e.target.value })}
                  style={{ padding: '10px 12px', borderRadius: '10px', border: '1px solid #E8C5C8', fontFamily: 'sans-serif', fontSize: '0.88rem', backgroundColor: '#FFF9F9' }}
                />

                <input
                  type="text"
                  placeholder="Bridge Note (e.g. CJ Order Batch Fulfillment)"
                  value={cjBridgeForm.notes}
                  onChange={(e) => setCjBridgeForm({ ...cjBridgeForm, notes: e.target.value })}
                  style={{ padding: '10px 12px', borderRadius: '10px', border: '1px solid #E8C5C8', fontFamily: 'sans-serif', fontSize: '0.88rem' }}
                />
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#5C5454', fontFamily: 'sans-serif', cursor: 'pointer', backgroundColor: '#FFF9F9', padding: '8px 12px', borderRadius: '10px', border: '1px solid #E8C5C8' }}>
                <input
                  type="checkbox"
                  checked={Boolean(cjBridgeForm.allocateFromStripe)}
                  onChange={(e) => setCjBridgeForm({ ...cjBridgeForm, allocateFromStripe: e.target.checked })}
                />
                <span>
                  <strong>Stage A — Allocate & Payout from Stripe:</strong> Initiate dedicated <code>CJ DROPSHIP</code> wholesale payout
                </span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#5C5454', fontFamily: 'sans-serif', cursor: 'pointer', backgroundColor: '#FFF9F9', padding: '8px 12px', borderRadius: '10px', border: '1px solid #E8C5C8' }}>
                <input
                  type="checkbox"
                  checked={Boolean(cjBridgeForm.payUnpaidCjOrders)}
                  onChange={(e) => setCjBridgeForm({ ...cjBridgeForm, payUnpaidCjOrders: e.target.checked })}
                />
                <span>
                  <strong>Stage B — Auto-Pay Open CJ Orders:</strong> Forward unpaid Present orders & pay via CJ Wallet API
                </span>
              </label>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '4px' }}>
                <button
                  type="submit"
                  disabled={isMovingToCj}
                  style={{ flex: 2, backgroundColor: '#F2D4D7', border: '1px solid #B38B8F', color: '#5C5454', padding: '12px 18px', borderRadius: '24px', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.12rem', fontWeight: 'bold', cursor: isMovingToCj ? 'not-allowed' : 'pointer' }}
                >
                  {isMovingToCj ? '⏳ Moving Funds to CJ...' : '📦 Move Funds & Pay CJ Orders ✧'}
                </button>

                <a
                  href="https://app.cjdropshipping.com/myCJ.html#/myCJWallet"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ flex: 1, textAlign: 'center', textDecoration: 'none', backgroundColor: '#FFF9F9', border: '1px solid #B38B8F', color: '#5C5454', padding: '12px 12px', borderRadius: '24px', fontFamily: "'Cormorant Garamond', serif", fontSize: '1rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  ↗ CJ Wallet Portal
                </a>

                {onAskOdie && (
                  <button
                    type="button"
                    onClick={() =>
                      onAskOdie(
                        'Odie, move the wholesale funds needed for my active orders from Stripe to CJ Dropshipping and pay any open CJ orders.'
                      )
                    }
                    style={{ backgroundColor: '#B38B8F', border: 'none', color: '#FFFFFF', padding: '12px 14px', borderRadius: '24px', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.05rem', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    🐾 Ask Odie
                  </button>
                )}
              </div>
            </form>

            {lastBridgeResult && (
              <div style={{ marginTop: '12px', padding: '10px 12px', borderRadius: '10px', backgroundColor: '#F6FBF7', border: '1px solid #A5D6A7', fontSize: '0.84rem', color: '#2E7D32', fontFamily: 'sans-serif' }}>
                <strong>✓ Latest Stripe → CJ Bridge:</strong> {lastBridgeResult.message}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 1.8: Recent Treasury Transfers & Money Dump Audit Ledger */}
      {recentTransfers.length > 0 && (
        <div style={{ backgroundColor: '#FFFFFF', padding: '24px 28px', borderRadius: '20px', border: '1px solid #E8C5C8', boxShadow: '0 8px 25px rgba(232, 197, 200, 0.12)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
            <div>
              <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.65rem', color: '#5C5454', margin: 0 }}>
                🏛️ Executive Treasury Transfer & Money Dump Ledger
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.85rem', color: '#8A797A', fontFamily: 'sans-serif' }}>
                Permanent audit trail of every Stripe Money Dump bank payout and Stripe → CJ Dropshipping wholesale transfer triggered by Susan or Odie.
              </p>
            </div>
            <span style={{ backgroundColor: '#FFF0F2', color: '#B38B8F', padding: '4px 12px', borderRadius: '14px', fontSize: '0.82rem', fontWeight: 'bold', fontFamily: 'sans-serif' }}>
              {recentTransfers.length} Recorded Transfer(s)
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '260px', overflowY: 'auto' }}>
            {recentTransfers.map((tr, idx) => {
              const isDump = tr.transferType === 'STRIPE_BANK_PAYOUT';
              return (
                <div key={tr._id || idx} style={{ padding: '12px 16px', borderRadius: '12px', backgroundColor: '#FFF9F9', border: '1px solid #E8C5C8', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', fontFamily: 'sans-serif', fontSize: '0.86rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <strong style={{ color: '#5C5454', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.15rem' }}>
                        {isDump ? '💸 Stripe Bank Money Dump' : '📦 Stripe → CJ Wholesale Bridge'}
                      </strong>
                      <span style={{ backgroundColor: '#FFFFFF', color: '#B38B8F', border: '1px solid #E8C5C8', padding: '2px 8px', borderRadius: '10px', fontSize: '0.74rem', fontWeight: 'bold' }}>
                        {tr.status}
                      </span>
                      <span style={{ backgroundColor: tr.triggeredBy === 'odie' ? '#F6FBF7' : '#FFF0F2', color: tr.triggeredBy === 'odie' ? '#2E7D32' : '#5C5454', padding: '2px 8px', borderRadius: '10px', fontSize: '0.74rem', fontWeight: 'bold' }}>
                        {tr.triggeredBy === 'odie' ? '🐾 Triggered by Odie' : '👩🏼‍💼 Triggered by Susan'}
                      </span>
                    </div>
                    <p style={{ margin: '4px 0 0 0', color: '#736A6A', fontSize: '0.82rem' }}>
                      {tr.notes} • {tr.createdAt ? new Date(tr.createdAt).toLocaleString() : ''}
                    </p>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <strong style={{ fontSize: '1.2rem', color: isDump ? '#2E7D32' : '#B38B8F' }}>
                      ${Number(tr.amountUsd || 0).toFixed(2)} {tr.currency || 'USD'}
                    </strong>
                    {tr.wholesaleReserveUsd > 0 && (
                      <span style={{ display: 'block', fontSize: '0.75rem', color: '#8A797A' }}>
                        CJ Reserve: ${Number(tr.wholesaleReserveUsd).toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

          {/* Consolidated Orders Tab Link Card inside Finances */}
          <div style={{ backgroundColor: '#FFFFFF', padding: '24px 28px', borderRadius: '20px', border: '1.5px solid #B38B8F', boxShadow: '0 8px 25px rgba(232, 197, 200, 0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.75rem', color: '#5C5454', margin: '0 0 4px 0' }}>
                📦 Consolidated Order Fulfillment & Tracking Command Center
              </h3>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#736A6A', fontFamily: 'sans-serif' }}>
                All customer orders ({counts.total || 0} total • {needsCjOrders.length} awaiting CJ fulfillment) are now consolidated in your dedicated <strong>📦 Orders</strong> tab with 1-click manual CJ fulfillment.
              </p>
            </div>
            {onOpenOrdersTab && (
              <button
                type="button"
                onClick={onOpenOrdersTab}
                style={{ background: 'linear-gradient(135deg, #B38B8F 0%, #D4A5A9 100%)', border: 'none', color: '#FFFFFF', padding: '12px 24px', borderRadius: '24px', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.15rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 6px 18px rgba(179, 139, 143, 0.3)' }}
              >
                📦 Open Orders & Manual CJ Fulfillment ({counts.total || 0}) →
              </button>
            )}
          </div>
        </>
      )}

      {viewMode === 'ORDERS' && (
        <>
          {/* Orders Top Command & Manual CJ Fulfillment Bar */}
          <div style={{ backgroundColor: '#FFFFFF', padding: '24px 28px', borderRadius: '20px', border: '2px solid #B38B8F', boxShadow: '0 8px 25px rgba(179, 139, 143, 0.18)', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2.1rem', color: '#5C5454', margin: 0 }}>
                    📦 Consolidated Orders & Manual CJ Fulfillment Center ✧
                  </h2>
                  {needsCjOrders.length > 0 && (
                    <span style={{ backgroundColor: '#FFF8E1', color: '#B26A00', border: '1px solid #FFE082', padding: '4px 12px', borderRadius: '14px', fontSize: '0.8rem', fontWeight: 'bold', fontFamily: 'sans-serif' }}>
                      ⚠️ {needsCjOrders.length} Order(s) Awaiting CJ Fulfillment
                    </span>
                  )}
                </div>
                <p style={{ margin: '6px 0 0 0', fontSize: '0.92rem', color: '#736A6A', fontFamily: 'sans-serif' }}>
                  Manually push or retry any order to CJ Dropshipping (<code>createOrderV2</code> + CJ Wallet payment), edit shipping addresses, switch CJ carriers, and manage live tracking numbers in one place.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  type="button"
                  disabled={isBatchFulfilling || isLoadingFinances}
                  onClick={handleBatchFulfillAllPending}
                  style={{ background: 'linear-gradient(135deg, #B38B8F 0%, #D4A5A9 100%)', border: 'none', color: '#FFFFFF', padding: '11px 20px', borderRadius: '22px', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.08rem', fontWeight: 'bold', cursor: isBatchFulfilling ? 'wait' : 'pointer', boxShadow: '0 4px 14px rgba(179, 139, 143, 0.3)' }}
                >
                  {isBatchFulfilling ? '⏳ Fulfilling All on CJ...' : `🚀 Fulfill & Pay All Unprocessed Orders (${needsCjOrders.length})`}
                </button>

                <button
                  type="button"
                  disabled={isLoadingFinances || isSyncingCjOrders}
                  onClick={() => fetchFinancesAndOrders(true)}
                  style={{ backgroundColor: '#F2D4D7', border: '1px solid #B38B8F', color: '#5C5454', padding: '10px 18px', borderRadius: '22px', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.05rem', fontWeight: 'bold', cursor: (isLoadingFinances || isSyncingCjOrders) ? 'not-allowed' : 'pointer' }}
                >
                  {isSyncingCjOrders ? '⏳ Syncing CJ Tracking...' : '🔄 Sync CJ Tracking & Statuses'}
                </button>

                {onOpenFinancesTab && (
                  <button
                    type="button"
                    onClick={onOpenFinancesTab}
                    style={{ backgroundColor: '#FFF9F9', border: '1px solid #E8C5C8', color: '#5C5454', padding: '10px 16px', borderRadius: '22px', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.02rem', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    💸 Finances & CJ Wallet (${effectiveCjPurchasingPowerUsd.toFixed(2)}) →
                  </button>
                )}
              </div>
            </div>

            {/* Live Order Pipeline KPI Pills */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px' }}>
              <div style={{ backgroundColor: '#FFF9F9', border: '1px solid #E8C5C8', borderRadius: '12px', padding: '12px 16px' }}>
                <div style={{ fontSize: '0.75rem', fontFamily: 'sans-serif', color: '#8A797A', textTransform: 'uppercase' }}>Total Orders</div>
                <div style={{ fontSize: '1.55rem', fontFamily: "'Cormorant Garamond', serif", color: '#5C5454', fontWeight: 'bold' }}>{counts.total || 0}</div>
              </div>
              <div style={{ backgroundColor: needsCjOrders.length > 0 ? '#FFF8E1' : '#F6FBF7', border: `1px solid ${needsCjOrders.length > 0 ? '#FFE082' : '#A5D6A7'}`, borderRadius: '12px', padding: '12px 16px' }}>
                <div style={{ fontSize: '0.75rem', fontFamily: 'sans-serif', color: needsCjOrders.length > 0 ? '#B26A00' : '#2E7D32', textTransform: 'uppercase', fontWeight: 'bold' }}>Needs CJ Fulfillment</div>
                <div style={{ fontSize: '1.55rem', fontFamily: "'Cormorant Garamond', serif", color: needsCjOrders.length > 0 ? '#B26A00' : '#2E7D32', fontWeight: 'bold' }}>{needsCjOrders.length}</div>
              </div>
              <div style={{ backgroundColor: '#FFF9F9', border: '1px solid #E8C5C8', borderRadius: '12px', padding: '12px 16px' }}>
                <div style={{ fontSize: '0.75rem', fontFamily: 'sans-serif', color: '#8A797A', textTransform: 'uppercase' }}>Active / In-Transit</div>
                <div style={{ fontSize: '1.55rem', fontFamily: "'Cormorant Garamond', serif", color: '#2E7D32', fontWeight: 'bold' }}>{counts.present || 0}</div>
              </div>
              <div style={{ backgroundColor: '#FFF9F9', border: '1px solid #E8C5C8', borderRadius: '12px', padding: '12px 16px' }}>
                <div style={{ fontSize: '0.75rem', fontFamily: 'sans-serif', color: '#8A797A', textTransform: 'uppercase' }}>Completed / Delivered</div>
                <div style={{ fontSize: '1.55rem', fontFamily: "'Cormorant Garamond', serif", color: '#B38B8F', fontWeight: 'bold' }}>{counts.past || 0}</div>
              </div>
              <div style={{ backgroundColor: '#F4F0FF', border: '1px solid #D1C4E9', borderRadius: '12px', padding: '12px 16px' }}>
                <div style={{ fontSize: '0.75rem', fontFamily: 'sans-serif', color: '#5E35B1', textTransform: 'uppercase', fontWeight: 'bold' }}>CJ Purchasing Power</div>
                <div style={{ fontSize: '1.55rem', fontFamily: "'Cormorant Garamond', serif", color: '#5E35B1', fontWeight: 'bold' }}>${effectiveCjPurchasingPowerUsd.toFixed(2)}</div>
              </div>
            </div>
          </div>

          {statusBanner.text && (
            <div style={{
              padding: '14px 18px',
              borderRadius: '12px',
              fontFamily: 'sans-serif',
              fontSize: '0.95rem',
              fontWeight: 'bold',
              backgroundColor: statusBanner.type === 'success' ? '#F6FBF7' : '#FFF5F5',
              color: statusBanner.type === 'success' ? '#2E7D32' : '#C62828',
              border: `1px solid ${statusBanner.type === 'success' ? '#A5D6A7' : '#FFCDD2'}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span>{statusBanner.text}</span>
              <button
                type="button"
                onClick={() => setStatusBanner({ type: '', text: '' })}
                style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 'bold' }}
              >
                ✕
              </button>
            </div>
          )}

          {/* Consolidated Order Pipeline List */}
          <div style={{ backgroundColor: '#FFFFFF', padding: '28px', borderRadius: '20px', border: '1px solid #E8C5C8', boxShadow: '0 10px 30px rgba(232, 197, 200, 0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {[
                  { id: 'ALL', label: `All Orders (${counts.total || 0})` },
                  { id: 'NEEDS_CJ', label: `⚠️ Needs CJ Fulfillment (${needsCjOrders.length})` },
                  { id: 'PRESENT', label: `🟢 Active & In-Transit (${counts.present || 0})` },
                  { id: 'FUTURE', label: `🔮 Pending & Ritual Boxes (${(counts.future || 0) + (counts.scheduledMemberBoxes || 0)})` },
                  { id: 'PAST', label: `🏛️ Completed & Delivered (${counts.past || 0})` }
                ].map(tabBtn => (
                  <button
                    key={tabBtn.id}
                    type="button"
                    onClick={() => setPipelineFilter(tabBtn.id)}
                    style={{
                      padding: '9px 15px',
                      borderRadius: '20px',
                      border: pipelineFilter === tabBtn.id ? '1.5px solid #B38B8F' : '1px solid #E8C5C8',
                      backgroundColor: pipelineFilter === tabBtn.id ? '#F2D4D7' : '#FFF9F9',
                      color: '#5C5454',
                      fontFamily: "'Cormorant Garamond', serif",
                      fontSize: '1.02rem',
                      fontWeight: pipelineFilter === tabBtn.id ? 'bold' : 'normal',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {tabBtn.label}
                  </button>
                ))}
              </div>

              <input
                type="text"
                placeholder="Search full Order ID (6aeae0...), #ShortID, email, or tracking..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ minWidth: '280px', flex: '1 1 280px', maxWidth: '400px', padding: '10px 16px', borderRadius: '20px', border: '1px solid #E8C5C8', backgroundColor: '#FFF9F9', outline: 'none', fontFamily: 'sans-serif', fontSize: '0.9rem' }}
              />
            </div>

            {/* Future Recurring Member Ritual Box Schedule (shown in FUTURE view) */}
            {pipelineFilter === 'FUTURE' && Array.isArray(futureProj.scheduledMemberBoxes) && futureProj.scheduledMemberBoxes.length > 0 && (
              <div style={{ marginBottom: '24px', padding: '18px 20px', borderRadius: '15px', backgroundColor: '#FFF9F9', border: '1px solid #E8C5C8' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
                  <div>
                    <strong style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.4rem', color: '#5C5454' }}>
                      🔮 Upcoming Monthly Member Ritual Box Dispatches & Subscription Renewals
                    </strong>
                    <p style={{ margin: '2px 0 0 0', fontSize: '0.85rem', color: '#8A797A', fontFamily: 'sans-serif' }}>
                      Projected Monthly Recurring Subscription Revenue: <strong>${Number(futureProj.projectedMonthlySubscriptionRevenue || 0).toFixed(2)}/mo</strong>
                    </p>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
                  {futureProj.scheduledMemberBoxes.map((box, idx) => (
                    <div key={box.memberId || idx} style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8C5C8', borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '8px' }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong style={{ color: '#5C5454', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.15rem' }}>{box.memberName}</strong>
                          <span style={{ backgroundColor: '#FFF0F2', color: '#B38B8F', padding: '2px 8px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                            ${box.monthlyRateUsd}/mo
                          </span>
                        </div>
                        <p style={{ margin: '2px 0', fontSize: '0.82rem', color: '#8A797A', fontFamily: 'sans-serif' }}>{box.memberEmail}</p>
                        <p style={{ margin: '4px 0 0 0', fontSize: '0.84rem', color: '#5C5454', fontFamily: 'sans-serif' }}>
                          🎁 {box.tierLabel}
                        </p>
                        <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#B38B8F', fontWeight: 'bold', fontFamily: 'sans-serif' }}>
                          Next Box Dispatch: {new Date(box.nextDispatchDate).toLocaleDateString()}
                        </p>
                      </div>
                      {onEmailCustomer && box.memberEmail && (
                        <button
                          type="button"
                          onClick={() => onEmailCustomer(box.memberEmail, `✧ Your Upcoming ${box.tier === 'radiance' ? 'Radiance Elite' : 'Luminary Circle'} Ritual Box`)}
                          style={{ backgroundColor: '#FFF0F2', border: '1px solid #B38B8F', borderRadius: '15px', padding: '6px 12px', fontSize: '0.85rem', color: '#5C5454', cursor: 'pointer', fontFamily: "'Cormorant Garamond', serif", fontWeight: 'bold' }}
                        >
                          ✉ Email Member
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Order Cards List */}
            {filteredOrders.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', backgroundColor: '#FFF9F9', borderRadius: '15px', border: '1px dashed #E8C5C8' }}>
                <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.35rem', color: '#8A797A', fontStyle: 'italic', margin: 0 }}>
                  No orders match the current filter ({pipelineFilter}).
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {filteredOrders.map(order => {
                  const badge = stageBadgeStyle(order.pipelineStage);
                  const draft = editingOrderMap[order._id] || {
                    status: order.status || 'Pending',
                    tracking_code: order.tracking_code || '',
                    logisticName: order.logisticName || '',
                    notifyCustomer: true
                  };
                  const addr = order.shipping_address || {};
                  const formattedAddress = [addr.address_1, addr.city, addr.state, addr.postcode, addr.country].filter(Boolean).join(', ');
                  const hasCjOrder = Boolean(order.cjOrderId);
                  const isCjWalletPaid = order.cjOrderStatus === 'PAID_WALLET';
                  const isFulfillingThis = fulfillingOrderId === order._id;
                  const isEditingThisAddr = editingShippingOrderId === order._id;
                  const addrDraft = shippingDraftMap[order._id] || {
                    name: addr.name || order.customerName || '',
                    address_1: addr.address_1 || '',
                    city: addr.city || '',
                    state: addr.state || '',
                    postcode: addr.postcode || '',
                    country: addr.country || 'US',
                    phone: addr.phone || ''
                  };

                  return (
                    <div key={order._id} style={{ padding: '22px', backgroundColor: '#FFF9F9', border: !hasCjOrder ? '2px solid #FFB74D' : '1px solid #E8C5C8', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '14px', boxShadow: '0 4px 14px rgba(232, 197, 200, 0.12)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid rgba(232, 197, 200, 0.4)', paddingBottom: '12px' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                            <strong style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.4rem', color: '#5C5454' }}>
                              Order #{order.shortId} — {order.customerName}
                            </strong>
                            <span
                              onClick={() => {
                                if (navigator.clipboard && order._id) {
                                  navigator.clipboard.writeText(String(order._id));
                                }
                              }}
                              title="Click to copy full MongoDB Order ID"
                              style={{ padding: '3px 9px', borderRadius: '10px', fontSize: '0.73rem', fontFamily: 'monospace', backgroundColor: '#FFFFFF', color: '#736A6A', border: '1px solid #E8C5C8', cursor: 'pointer' }}
                            >
                              ID: {order._id} 📋
                            </span>
                            <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold', fontFamily: 'sans-serif', backgroundColor: badge.backgroundColor, color: badge.color, border: badge.border }}>
                              {badge.label}
                            </span>
                            <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '0.75rem', fontFamily: 'sans-serif', backgroundColor: '#FFFFFF', color: '#B38B8F', border: '1px solid #E8C5C8', fontWeight: 'bold' }}>
                              Status: {order.status}
                            </span>
                            <span
                              style={{
                                padding: '3px 10px',
                                borderRadius: '12px',
                                fontSize: '0.75rem',
                                fontFamily: 'sans-serif',
                                fontWeight: 'bold',
                                backgroundColor: isCjWalletPaid ? '#E8F5E9' : (order.cjOrderStatus === 'CONFIRMED_AUTO_PAY' ? '#E3F2FD' : (hasCjOrder ? '#F4F0FF' : '#FFF8E1')),
                                color: isCjWalletPaid ? '#2E7D32' : (order.cjOrderStatus === 'CONFIRMED_AUTO_PAY' ? '#1565C0' : (hasCjOrder ? '#5E35B1' : '#B26A00')),
                                border: `1px solid ${isCjWalletPaid ? '#A5D6A7' : (order.cjOrderStatus === 'CONFIRMED_AUTO_PAY' ? '#90CAF9' : (hasCjOrder ? '#D1C4E9' : '#FFE082'))}`
                              }}
                            >
                              {isCjWalletPaid
                                ? `✅ CJ Wallet Paid (CJ ID: ${order.cjOrderId})`
                                : order.cjOrderStatus === 'CONFIRMED_AUTO_PAY'
                                ? `⚡ Confirmed in CJ Cart for Auto-Pay (${order.cjOrderId} • ${order.logisticName || 'CJPacket Sensitive Pro'})`
                                : hasCjOrder
                                ? `📦 CJ Order Created (${order.cjOrderId} • ${order.logisticName || 'CJPacket Sensitive Pro'})`
                                : '⚠️ Not Yet Sent to CJ Dropshipping'}
                            </span>
                          </div>
                          <p style={{ margin: '6px 0 0 0', fontSize: '0.88rem', color: '#736A6A', fontFamily: 'sans-serif' }}>
                            📧 {order.customerEmail} • Placed {new Date(order.createdAt).toLocaleString()}
                            {formattedAddress ? ` • ✈️ Ship To: ${formattedAddress}` : ' • ⚠️ Shipping address pending'}
                          </p>
                        </div>

                        <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap', fontFamily: 'sans-serif' }}>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ display: 'block', fontSize: '0.75rem', color: '#8A797A' }}>Retail Total</span>
                            <strong style={{ fontSize: '1.2rem', color: '#5C5454' }}>${Number(order.totalAmount || 0).toFixed(2)}</strong>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ display: 'block', fontSize: '0.75rem', color: '#8A797A' }}>Est. CJ Cost</span>
                            <strong style={{ fontSize: '1.05rem', color: '#8A797A' }}>${Number(order.estimatedWholesaleCost || 0).toFixed(2)}</strong>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ display: 'block', fontSize: '0.75rem', color: '#2E7D32' }}>Est. Net Profit</span>
                            <strong style={{ fontSize: '1.2rem', color: '#2E7D32' }}>+${Number(order.estimatedProfit || 0).toFixed(2)}</strong>
                          </div>
                        </div>
                      </div>

                      {/* Order Line Items */}
                      {Array.isArray(order.items) && order.items.length > 0 && (
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {order.items.map((item, idx) => (
                            <span key={idx} style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8C5C8', borderRadius: '10px', padding: '5px 10px', fontSize: '0.83rem', color: '#5C5454', fontFamily: 'sans-serif' }}>
                              {item.quantity}x <strong>{item.title}</strong> (${Number(item.price || 0).toFixed(2)})
                              {item.sku ? <code style={{ marginLeft: '6px', fontSize: '0.74rem', color: '#8A797A' }}>[{item.sku}]</code> : null}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Dedicated Manual CJ Fulfillment Action Bar */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', backgroundColor: '#FFFDFD', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #F2D4D7' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontFamily: 'sans-serif', fontSize: '0.84rem', color: '#5C5454' }}>
                          <strong>⚡ Manual CJ Fulfillment Actions:</strong>
                          <span style={{ color: '#8A797A' }}>
                            {isCjWalletPaid
                              ? 'Order is created & paid on CJ.'
                              : hasCjOrder
                              ? 'Order is created on CJ — click to pay via CJ Wallet or re-send.'
                              : 'Click to push this order to CJ Dropshipping now.'}
                          </span>
                        </div>

                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                          <button
                            type="button"
                            disabled={isFulfillingThis}
                            onClick={() => handleManualFulfillSingleOrder(order, { payWithWallet: true, forceRecreate: false })}
                            style={{
                              background: 'linear-gradient(135deg, #B38B8F 0%, #D4A5A9 100%)',
                              color: '#FFFFFF',
                              border: 'none',
                              borderRadius: '18px',
                              padding: '8px 16px',
                              fontFamily: 'sans-serif',
                              fontSize: '0.84rem',
                              fontWeight: 'bold',
                              cursor: isFulfillingThis ? 'wait' : 'pointer',
                              boxShadow: '0 4px 10px rgba(179, 139, 143, 0.25)'
                            }}
                          >
                            {isFulfillingThis
                              ? '⏳ Processing on CJ...'
                              : hasCjOrder && !isCjWalletPaid
                              ? '💳 Pay CJ Wallet Balance Now'
                              : '🚀 Fulfill on CJ Now (Create + Pay Wallet)'}
                          </button>

                          <button
                            type="button"
                            disabled={isFulfillingThis}
                            onClick={() => handleManualFulfillSingleOrder(order, { payWithWallet: false, forceRecreate: true })}
                            style={{
                              backgroundColor: '#FFF0F2',
                              color: '#5C5454',
                              border: '1px solid #B38B8F',
                              borderRadius: '18px',
                              padding: '8px 14px',
                              fontFamily: 'sans-serif',
                              fontSize: '0.82rem',
                              fontWeight: 'bold',
                              cursor: isFulfillingThis ? 'wait' : 'pointer'
                            }}
                          >
                            {hasCjOrder ? '↻ Re-Send createOrderV2 to CJ' : '📦 Create on CJ Only (Unpaid)'}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenEditShipping(order)}
                            style={{
                              backgroundColor: '#FFFFFF',
                              color: '#5C5454',
                              border: '1px solid #E8C5C8',
                              borderRadius: '18px',
                              padding: '8px 14px',
                              fontFamily: 'sans-serif',
                              fontSize: '0.82rem',
                              fontWeight: 'bold',
                              cursor: 'pointer'
                            }}
                          >
                            {isEditingThisAddr ? '✕ Close Address Editor' : '✏️ Edit Shipping Address'}
                          </button>
                        </div>
                      </div>

                      {/* Collapsible Inline Shipping Address Editor */}
                      {isEditingThisAddr && (
                        <div style={{ backgroundColor: '#FFFFFF', padding: '16px', borderRadius: '12px', border: '1.5px solid #B38B8F', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <strong style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.2rem', color: '#5C5454' }}>
                            📍 Edit Customer Shipping Address for Order #{order.shortId}
                          </strong>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                            <input
                              type="text"
                              placeholder="Recipient Full Name"
                              value={addrDraft.name}
                              onChange={(e) => setShippingDraftMap(prev => ({ ...prev, [order._id]: { ...addrDraft, name: e.target.value } }))}
                              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #E8C5C8', fontFamily: 'sans-serif', fontSize: '0.86rem' }}
                            />
                            <input
                              type="text"
                              placeholder="Street Address"
                              value={addrDraft.address_1}
                              onChange={(e) => setShippingDraftMap(prev => ({ ...prev, [order._id]: { ...addrDraft, address_1: e.target.value } }))}
                              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #E8C5C8', fontFamily: 'sans-serif', fontSize: '0.86rem', gridColumn: 'span 2' }}
                            />
                            <input
                              type="text"
                              placeholder="City"
                              value={addrDraft.city}
                              onChange={(e) => setShippingDraftMap(prev => ({ ...prev, [order._id]: { ...addrDraft, city: e.target.value } }))}
                              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #E8C5C8', fontFamily: 'sans-serif', fontSize: '0.86rem' }}
                            />
                            <input
                              type="text"
                              placeholder="State (e.g. KS)"
                              value={addrDraft.state}
                              onChange={(e) => setShippingDraftMap(prev => ({ ...prev, [order._id]: { ...addrDraft, state: e.target.value } }))}
                              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #E8C5C8', fontFamily: 'sans-serif', fontSize: '0.86rem' }}
                            />
                            <input
                              type="text"
                              placeholder="ZIP / Postal Code"
                              value={addrDraft.postcode}
                              onChange={(e) => setShippingDraftMap(prev => ({ ...prev, [order._id]: { ...addrDraft, postcode: e.target.value } }))}
                              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #E8C5C8', fontFamily: 'sans-serif', fontSize: '0.86rem' }}
                            />
                            <input
                              type="text"
                              placeholder="Country (US)"
                              value={addrDraft.country}
                              onChange={(e) => setShippingDraftMap(prev => ({ ...prev, [order._id]: { ...addrDraft, country: e.target.value } }))}
                              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #E8C5C8', fontFamily: 'sans-serif', fontSize: '0.86rem' }}
                            />
                            <input
                              type="text"
                              placeholder="Phone Number"
                              value={addrDraft.phone}
                              onChange={(e) => setShippingDraftMap(prev => ({ ...prev, [order._id]: { ...addrDraft, phone: e.target.value } }))}
                              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #E8C5C8', fontFamily: 'sans-serif', fontSize: '0.86rem' }}
                            />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                            <button
                              type="button"
                              onClick={() => setEditingShippingOrderId(null)}
                              style={{ backgroundColor: 'transparent', border: '1px solid #E8C5C8', borderRadius: '16px', padding: '7px 14px', fontSize: '0.82rem', color: '#8A797A', cursor: 'pointer' }}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={savingOrderId === order._id}
                              onClick={() => handleSaveOrderShippingAddress(order)}
                              style={{ backgroundColor: '#B38B8F', border: 'none', borderRadius: '16px', padding: '8px 18px', fontSize: '0.84rem', color: '#FFFFFF', fontWeight: 'bold', cursor: 'pointer' }}
                            >
                              {savingOrderId === order._id ? '⏳ Saving...' : '💾 Save Shipping Address'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Inline Status, Tracking & Customer Notification Controls */}
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', backgroundColor: '#FFFFFF', padding: '12px', borderRadius: '12px', border: '1px solid #E8C5C8' }}>
                        <select
                          value={draft.status}
                          onChange={(e) => handleOrderEditChange(order, 'status', e.target.value)}
                          style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #E8C5C8', fontFamily: 'sans-serif', fontSize: '0.88rem', color: '#5C5454', backgroundColor: '#FFF9F9' }}
                        >
                          <option value="Pending">Pending (Future / Unpaid)</option>
                          <option value="PAID_PROCESSING">PAID_PROCESSING (Present)</option>
                          <option value="SHIPPED">SHIPPED (Present / In-Transit)</option>
                          <option value="DELIVERED">DELIVERED (Past / Completed)</option>
                          <option value="COMPLETED">COMPLETED (Past)</option>
                          <option value="CANCELLED">CANCELLED (Past)</option>
                          <option value="REFUNDED">REFUNDED (Past)</option>
                        </select>

                        <input
                          type="text"
                          placeholder="Tracking Number (optional)"
                          value={draft.tracking_code}
                          onChange={(e) => handleOrderEditChange(order, 'tracking_code', e.target.value)}
                          style={{ flex: '1 1 180px', padding: '8px 12px', borderRadius: '8px', border: '1px solid #E8C5C8', fontFamily: 'sans-serif', fontSize: '0.88rem' }}
                        />

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <select
                            title="Switch CJ Dropshipping Shipping Method (POST /api/admin/orders/:id/cj-logistics)"
                            disabled={updatingCjLogisticsId === order._id}
                            value={draft.logisticName || order.selectedLogisticName || order.logisticName || 'CJPacket Sensitive'}
                            onChange={(e) => handleSwitchOrderCjLogistics(order, e.target.value, false)}
                            style={{ padding: '8px 10px', borderRadius: '8px', border: '1.5px solid #B38B8F', fontFamily: 'sans-serif', fontSize: '0.84rem', color: '#5C5454', backgroundColor: '#FFF0F2', fontWeight: 'bold', cursor: 'pointer' }}
                          >
                            {(orderCjCarrierOptionsMap[order._id]
                              ? orderCjCarrierOptionsMap[order._id].map(o => o.logisticName)
                              : CJ_CARRIER_OPTIONS
                            ).map(cName => (
                              <option key={cName} value={cName}>✈️ CJ: {cName}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            title="Query CJ getOrderOptionalLogistics for this order"
                            disabled={updatingCjLogisticsId === order._id}
                            onClick={() => handleSwitchOrderCjLogistics(order, draft.logisticName || order.selectedLogisticName || 'CJPacket Sensitive', true)}
                            style={{ backgroundColor: '#FFF9F9', border: '1px solid #E8C5C8', borderRadius: '8px', padding: '8px 10px', fontSize: '0.78rem', color: '#5C5454', cursor: 'pointer', fontFamily: 'sans-serif' }}
                          >
                            {updatingCjLogisticsId === order._id ? '⏳' : '↻ Rates'}
                          </button>
                        </div>

                        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.84rem', color: '#5C5454', fontFamily: 'sans-serif', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={Boolean(draft.notifyCustomer)}
                            onChange={(e) => handleOrderEditChange(order, 'notifyCustomer', e.target.checked)}
                          />
                          Email update to client
                        </label>

                        <button
                          type="button"
                          disabled={savingOrderId === order._id}
                          onClick={() => handleSaveOrderStatus(order)}
                          style={{ backgroundColor: '#F2D4D7', border: '1px solid #B38B8F', color: '#5C5454', padding: '8px 16px', borderRadius: '18px', fontFamily: "'Cormorant Garamond', serif", fontSize: '1rem', fontWeight: 'bold', cursor: savingOrderId === order._id ? 'not-allowed' : 'pointer' }}
                        >
                          {savingOrderId === order._id ? 'Saving...' : '💾 Save Status & Tracking ✧'}
                        </button>

                        {onEmailCustomer && order.customerEmail && order.customerEmail !== 'Anonymous Checkout' && (
                          <button
                            type="button"
                            onClick={() => onEmailCustomer(order.customerEmail, `Update regarding your order #${order.shortId}`)}
                            style={{ backgroundColor: 'transparent', border: '1px solid #E8C5C8', color: '#736A6A', padding: '8px 14px', borderRadius: '18px', fontFamily: "'Cormorant Garamond', serif", fontSize: '0.95rem', cursor: 'pointer' }}
                          >
                            ✉ Custom Email
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

const AdminVideoPortal = () => {
  const [roomName, setRoomName] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [copySuccess, setCopySuccess] = useState('');

  const generateRoom = () => {
    const randomId = Math.random().toString(36).substring(2, 10);
    setRoomName(`SusansBoutique_Consultation_${randomId}`);
    setIsActive(false);
    setCopySuccess('');
  };

  const copyToClipboard = () => {
    if (!roomName) return;
    const url = `https://meet.jit.si/${roomName}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopySuccess('Copied!');
      setTimeout(() => setCopySuccess(''), 2000);
    });
  };

  return (
    <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.75)', borderRadius: '15px', border: '1px solid #E8C5C8', padding: '30px', animation: 'fadeIn 0.5s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2.2rem', color: '#5C5454', margin: 0 }}>Consultation Studio</h2>
        <button onClick={generateRoom} style={{ backgroundColor: '#F2D4D7', border: '1px solid #B38B8F', padding: '10px 20px', borderRadius: '25px', fontFamily: "'Cormorant Garamond', serif", color: '#5C5454', cursor: 'pointer', fontSize: '1.1rem' }}>
          + Generate New Room ✧
        </button>
      </div>

      {!roomName ? (
        <div style={{ padding: '50px', textAlign: 'center', border: '2px dashed #E8C5C8', borderRadius: '15px', backgroundColor: '#FFFFFF' }}>
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.4rem', color: '#8A797A', fontStyle: 'italic' }}>Generate a secure room to begin your 1-on-1 consultation.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center', backgroundColor: '#FFFFFF', padding: '15px', borderRadius: '10px', border: '1px solid #E8C5C8' }}>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: '0.9rem', color: '#A89999', display: 'block', marginBottom: '5px' }}>Client Share Link:</span>
              <strong style={{ color: '#B38B8F', fontSize: '1.1rem' }}>https://meet.jit.si/{roomName}</strong>
            </div>
            <button onClick={copyToClipboard} style={{ backgroundColor: '#FFF0F2', border: '1px solid #E8C5C8', padding: '8px 15px', borderRadius: '8px', color: '#5C5454', cursor: 'pointer', fontFamily: 'sans-serif', fontSize: '0.9rem' }}>
              {copySuccess || '📋 Copy Link'}
            </button>
            {!isActive && (
              <button onClick={() => setIsActive(true)} style={{ backgroundColor: '#B38B8F', border: 'none', padding: '10px 20px', borderRadius: '8px', color: '#FFFFFF', cursor: 'pointer', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.1rem' }}>
                Join as Host
              </button>
            )}
            {isActive && (
              <button onClick={() => { setIsActive(false); setRoomName(''); }} style={{ backgroundColor: '#5C5454', border: 'none', padding: '10px 20px', borderRadius: '8px', color: '#FFFFFF', cursor: 'pointer', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.1rem' }}>
                End Session
              </button>
            )}
          </div>

          {isActive && (
            <div style={{ width: '100%', height: '600px', borderRadius: '15px', overflow: 'hidden', border: '1px solid #E8C5C8', boxShadow: '0 10px 30px rgba(232, 197, 200, 0.2)' }}>
              <iframe
                allow="camera; microphone; fullscreen; display-capture; autoplay"
                src={`https://meet.jit.si/${roomName}`}
                style={{ width: '100%', height: '100%', border: '0' }}
                title="Consultation Room"
              ></iframe>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const AdminAnalytics = ({ onOpenCurationTab, onOpenInventoryTab, onAskOdie }) => {
  const [range, setRange] = useState('30d');
  const [analytics, setAnalytics] = useState(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
  const [isSeedingDemo, setIsSeedingDemo] = useState(false);
  const [isClearingDemo, setIsClearingDemo] = useState(false);
  const [leaderboardSort, setLeaderboardSort] = useState('engagement'); // 'engagement' | 'views' | 'cartAdds' | 'purchases' | 'curated' | 'conversion'
  const [statusBanner, setStatusBanner] = useState({ type: '', text: '' });

  const fetchAnalytics = async (selectedRange = range) => {
    const token = localStorage.getItem('token');
    setIsLoadingAnalytics(true);
    setStatusBanner({ type: '', text: '' });
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/analytics?range=${encodeURIComponent(selectedRange)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setAnalytics(data);
      } else {
        setStatusBanner({
          type: 'error',
          text: data.error || 'Could not load site analytics telemetry.'
        });
      }
    } catch (err) {
      console.error('Error fetching admin analytics:', err);
      setStatusBanner({
        type: 'error',
        text: 'Network error while fetching site analytics telemetry.'
      });
    }
    setIsLoadingAnalytics(false);
  };

  useEffect(() => {
    fetchAnalytics(range);
    // eslint-disable-next-line
  }, [range]);

  const handleSeedOrClearDemo = async (actionType = 'seed') => {
    const token = localStorage.getItem('token');
    if (actionType === 'clear_demo') setIsClearingDemo(true);
    else setIsSeedingDemo(true);
    setStatusBanner({ type: '', text: '' });

    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/analytics/seed-demo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action: actionType, range })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (data.telemetry) {
          setAnalytics(data.telemetry);
        } else {
          await fetchAnalytics(range);
        }
        setStatusBanner({
          type: 'success',
          text: data.message || (actionType === 'clear_demo' ? 'Sample traffic cleared! ✧' : 'Sample traffic loaded! ✧')
        });
      } else {
        setStatusBanner({
          type: 'error',
          text: data.error || 'Failed to update sample analytics traffic.'
        });
      }
    } catch (err) {
      console.error('Analytics seed/clear error:', err);
      setStatusBanner({
        type: 'error',
        text: 'Network error while updating sample analytics traffic.'
      });
    }

    setIsSeedingDemo(false);
    setIsClearingDemo(false);
  };

  const ov = analytics?.overview || {};
  const dailySeries = Array.isArray(analytics?.dailyTrafficSeries) ? analytics.dailyTrafficSeries : [];
  const topPages = Array.isArray(analytics?.topPages) ? analytics.topPages : [];
  const funnel = Array.isArray(analytics?.conversionFunnel) ? analytics.conversionFunnel : [];
  const rawLeaderboard = Array.isArray(analytics?.productLeaderboard) ? analytics.productLeaderboard : [];
  const bpSupplyDemand = analytics?.blueprintDemandVsSupply || {};
  const filterTrends = analytics?.filterAndSearchTrends?.topFilters || [];
  const searchTrends = analytics?.filterAndSearchTrends?.topSearches || [];
  const recentEvents = Array.isArray(analytics?.recentEvents) ? analytics.recentEvents : [];

  const sortedLeaderboard = [...rawLeaderboard].sort((a, b) => {
    if (leaderboardSort === 'views') return (b.viewCount - a.viewCount) || (b.engagementScore - a.engagementScore);
    if (leaderboardSort === 'cartAdds') return (b.cartAddCount - a.cartAddCount) || (b.viewCount - a.viewCount);
    if (leaderboardSort === 'purchases') return (b.purchaseCount - a.purchaseCount) || (b.revenueUsd - a.revenueUsd);
    if (leaderboardSort === 'curated') return (b.curatedCount - a.curatedCount) || (b.viewCount - a.viewCount);
    if (leaderboardSort === 'conversion') return (b.viewToCartRatePct - a.viewToCartRatePct) || (b.cartAddCount - a.cartAddCount);
    return (b.engagementScore - a.engagementScore) || (b.viewCount - a.viewCount);
  });

  const maxDailyVal = Math.max(
    1,
    ...dailySeries.map(d => Math.max(Number(d.pageViews || 0), Number(d.productViews || 0) + Number(d.cartAdds || 0)))
  );

  const badgeStyleForTone = (tone) => {
    if (tone === 'hot') return { bg: '#FFF0F2', color: '#C62828', border: '#FFCDD2' };
    if (tone === 'warning') return { bg: '#FFF8E7', color: '#B26A00', border: '#FFE082' };
    if (tone === 'gem') return { bg: '#F6FBF7', color: '#2E7D32', border: '#A5D6A7' };
    if (tone === 'curated') return { bg: '#F4F0FF', color: '#5E35B1', border: '#D1C4E9' };
    if (tone === 'active') return { bg: '#FFF9F9', color: '#B38B8F', border: '#B38B8F' };
    return { bg: '#F7F2F2', color: '#736A6A', border: '#E8C5C8' };
  };

  const eventLabelStyle = (evType) => {
    switch (evType) {
      case 'PRODUCT_VIEW': return { icon: '👁️', label: 'Product View', bg: '#FFF0F2', color: '#B38B8F' };
      case 'ADD_TO_CART': return { icon: '🛍️', label: 'Added to Bag', bg: '#F6FBF7', color: '#2E7D32' };
      case 'REMOVE_FROM_CART': return { icon: '🗑️', label: 'Removed from Bag', bg: '#FFF5F5', color: '#C62828' };
      case 'CHECKOUT_INITIATED': return { icon: '💳', label: 'Checkout Started', bg: '#FFF8E7', color: '#B26A00' };
      case 'FILTER_USED': return { icon: '🏷️', label: 'Filter Clicked', bg: '#F4F0FF', color: '#5E35B1' };
      case 'SEARCH_QUERY': return { icon: '🔍', label: 'Boutique Search', bg: '#F4F0FF', color: '#5E35B1' };
      case 'QUIZ_STARTED': return { icon: '📝', label: 'Quiz Started', bg: '#FFF0F2', color: '#B38B8F' };
      case 'QUIZ_COMPLETED': return { icon: '✨', label: 'Blueprint Locked', bg: '#F6FBF7', color: '#2E7D32' };
      default: return { icon: '📄', label: 'Page View', bg: '#FFF9F9', color: '#5C5454' };
    }
  };

  const hasDemoEvents = recentEvents.some(e => e.isDemo);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '26px', animation: 'fadeIn 0.5s ease' }}>
      {/* Top Executive Analytics Command Bar */}
      <div style={{ backgroundColor: '#FFFFFF', padding: '22px 26px', borderRadius: '20px', border: '1.5px solid #B38B8F', boxShadow: '0 8px 25px rgba(232, 197, 200, 0.18)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2.05rem', color: '#5C5454', margin: 0 }}>
              📊 Boutique Traffic, Product Engagement & Curation Intelligence ✧
            </h2>
            {analytics?.updatedAtCT && (
              <span style={{ backgroundColor: '#FFF0F2', color: '#B38B8F', border: '1px solid #E8C5C8', padding: '3px 10px', borderRadius: '12px', fontSize: '0.76rem', fontFamily: 'sans-serif', fontWeight: 'bold' }}>
                🕒 Updated {analytics.updatedAtCT}
              </span>
            )}
          </div>
          <p style={{ margin: '5px 0 0 0', fontSize: '0.92rem', color: '#8A797A', fontFamily: 'sans-serif' }}>
            Real-time page views, most viewed & highest-converting products, Member Blueprint demand vs. inventory supply gaps, and live shopper telemetry.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Time Range Selector Pills */}
          <div style={{ display: 'flex', backgroundColor: '#FFF9F9', padding: '4px', borderRadius: '20px', border: '1px solid #E8C5C8', gap: '4px' }}>
            {[
              { id: '7d', label: '7 Days' },
              { id: '30d', label: '30 Days' },
              { id: '90d', label: '90 Days' },
              { id: 'all', label: 'All Time' }
            ].map(rOpt => (
              <button
                key={rOpt.id}
                type="button"
                onClick={() => setRange(rOpt.id)}
                style={{
                  padding: '6px 13px',
                  borderRadius: '16px',
                  border: range === rOpt.id ? '1px solid #B38B8F' : 'none',
                  backgroundColor: range === rOpt.id ? '#F2D4D7' : 'transparent',
                  color: '#5C5454',
                  fontFamily: 'sans-serif',
                  fontSize: '0.8rem',
                  fontWeight: range === rOpt.id ? 'bold' : 'normal',
                  cursor: 'pointer'
                }}
              >
                {rOpt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={isLoadingAnalytics}
            onClick={() => fetchAnalytics(range)}
            style={{ backgroundColor: '#FFF9F9', border: '1px solid #B38B8F', color: '#5C5454', padding: '9px 16px', borderRadius: '20px', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.02rem', fontWeight: 'bold', cursor: isLoadingAnalytics ? 'not-allowed' : 'pointer' }}
          >
            {isLoadingAnalytics ? '⏳ Refreshing...' : '↻ Refresh Live Telemetry'}
          </button>

          <button
            type="button"
            disabled={isSeedingDemo || isClearingDemo}
            onClick={() => handleSeedOrClearDemo('seed')}
            style={{ backgroundColor: '#F2D4D7', border: '1px solid #B38B8F', color: '#5C5454', padding: '9px 16px', borderRadius: '20px', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.02rem', fontWeight: 'bold', cursor: (isSeedingDemo || isClearingDemo) ? 'not-allowed' : 'pointer' }}
          >
            {isSeedingDemo ? '⏳ Populating...' : '✨ Load Sample Traffic Preview'}
          </button>

          {hasDemoEvents && (
            <button
              type="button"
              disabled={isSeedingDemo || isClearingDemo}
              onClick={() => handleSeedOrClearDemo('clear_demo')}
              style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8C5C8', color: '#8A797A', padding: '9px 14px', borderRadius: '20px', fontFamily: 'sans-serif', fontSize: '0.8rem', cursor: (isSeedingDemo || isClearingDemo) ? 'not-allowed' : 'pointer' }}
            >
              {isClearingDemo ? '⏳ Clearing...' : '🧹 Clear Sample Events'}
            </button>
          )}

          {onAskOdie && (
            <button
              type="button"
              onClick={() =>
                onAskOdie(
                  `Odie, analyze my site traffic and product engagement for the ${range} window, tell me my top viewed products and Blueprint demand gaps, and suggest what I should curate for members today.`
                )
              }
              style={{ backgroundColor: '#B38B8F', border: 'none', color: '#FFFFFF', padding: '9px 18px', borderRadius: '20px', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.05rem', fontWeight: 'bold', cursor: 'pointer' }}
            >
              🐾 Ask Odie for Curation Strategy
            </button>
          )}
        </div>
      </div>

      {statusBanner.text && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '10px',
          fontFamily: 'sans-serif',
          fontSize: '0.94rem',
          backgroundColor: statusBanner.type === 'success' ? '#F6FBF7' : '#FFF5F5',
          color: statusBanner.type === 'success' ? '#2E7D32' : '#C62828',
          border: `1px solid ${statusBanner.type === 'success' ? '#A5D6A7' : '#FFCDD2'}`
        }}>
          {statusBanner.text}
        </div>
      )}

      {/* Section 1: 6-Card Executive KPI Scorecard */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '18px' }}>
        <div style={{ backgroundColor: '#FFFFFF', padding: '20px 22px', borderRadius: '18px', border: '1px solid #E8C5C8', boxShadow: '0 6px 20px rgba(232, 197, 200, 0.14)' }}>
          <span style={{ fontSize: '0.8rem', color: '#8A797A', fontFamily: 'sans-serif', fontWeight: 'bold', textTransform: 'uppercase' }}>
            🌐 Total Page Views
          </span>
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2.35rem', color: '#5C5454', fontWeight: 'bold', margin: '6px 0 4px 0' }}>
            {Number(ov.totalPageViews || 0).toLocaleString()}
          </p>
          <span style={{ fontSize: '0.82rem', color: '#B38B8F', fontFamily: 'sans-serif', fontWeight: 'bold' }}>
            {Number(ov.uniqueVisitors || 0).toLocaleString()} Unique Visitor Session(s)
          </span>
        </div>

        <div style={{ backgroundColor: '#FFFFFF', padding: '20px 22px', borderRadius: '18px', border: '1px solid #E8C5C8', boxShadow: '0 6px 20px rgba(232, 197, 200, 0.14)' }}>
          <span style={{ fontSize: '0.8rem', color: '#8A797A', fontFamily: 'sans-serif', fontWeight: 'bold', textTransform: 'uppercase' }}>
            👁️ Product Detail Views
          </span>
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2.35rem', color: '#B38B8F', fontWeight: 'bold', margin: '6px 0 4px 0' }}>
            {Number(ov.productViews || 0).toLocaleString()}
          </p>
          <span style={{ fontSize: '0.82rem', color: '#736A6A', fontFamily: 'sans-serif' }}>
            Across {ov.totalActiveProducts || 0} Active Boutique SKUs
          </span>
        </div>

        <div style={{ backgroundColor: '#FFFFFF', padding: '20px 22px', borderRadius: '18px', border: '1px solid #E8C5C8', boxShadow: '0 6px 20px rgba(232, 197, 200, 0.14)' }}>
          <span style={{ fontSize: '0.8rem', color: '#8A797A', fontFamily: 'sans-serif', fontWeight: 'bold', textTransform: 'uppercase' }}>
            🛍️ Ritual Bag Additions
          </span>
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2.35rem', color: '#2E7D32', fontWeight: 'bold', margin: '6px 0 4px 0' }}>
            {Number(ov.cartAdditions || 0).toLocaleString()}
          </p>
          <span style={{ fontSize: '0.82rem', color: '#736A6A', fontFamily: 'sans-serif' }}>
            {ov.checkoutsInitiated || 0} Checkout(s) Initiated
          </span>
        </div>

        <div style={{ backgroundColor: '#FFFFFF', padding: '20px 22px', borderRadius: '18px', border: '1px solid #E8C5C8', boxShadow: '0 6px 20px rgba(232, 197, 200, 0.14)' }}>
          <span style={{ fontSize: '0.8rem', color: '#8A797A', fontFamily: 'sans-serif', fontWeight: 'bold', textTransform: 'uppercase' }}>
            💳 Order Conversion Rate
          </span>
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2.35rem', color: '#5C5454', fontWeight: 'bold', margin: '6px 0 4px 0' }}>
            {Number(ov.conversionRatePct || 0).toFixed(1)}%
          </p>
          <span style={{ fontSize: '0.82rem', color: '#2E7D32', fontFamily: 'sans-serif', fontWeight: 'bold' }}>
            {ov.paidOrdersCount || 0} Paid Orders (${Number(ov.paidRevenueUsd || 0).toFixed(2)})
          </span>
        </div>

        <div style={{ backgroundColor: '#FFFFFF', padding: '20px 22px', borderRadius: '18px', border: '1px solid #E8C5C8', boxShadow: '0 6px 20px rgba(232, 197, 200, 0.14)' }}>
          <span style={{ fontSize: '0.8rem', color: '#8A797A', fontFamily: 'sans-serif', fontWeight: 'bold', textTransform: 'uppercase' }}>
            📝 Blueprint Quiz Completion
          </span>
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2.35rem', color: '#B38B8F', fontWeight: 'bold', margin: '6px 0 4px 0' }}>
            {Number(ov.quizCompletionRatePct || 0).toFixed(1)}%
          </p>
          <span style={{ fontSize: '0.82rem', color: '#736A6A', fontFamily: 'sans-serif' }}>
            {ov.quizCompletions || 0} Locked Blueprints • {ov.totalCurationsSent || 0} Curations Sent
          </span>
        </div>

        <div style={{ backgroundColor: '#FFFFFF', padding: '20px 22px', borderRadius: '18px', border: '1px solid #E8C5C8', boxShadow: '0 6px 20px rgba(232, 197, 200, 0.14)' }}>
          <span style={{ fontSize: '0.8rem', color: '#8A797A', fontFamily: 'sans-serif', fontWeight: 'bold', textTransform: 'uppercase' }}>
            👑 Member vs. Guest Split
          </span>
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.65rem', color: '#5C5454', fontWeight: 'bold', margin: '10px 0 6px 0' }}>
            {ov.memberTrafficSharePct ?? 50}% Member / {ov.guestTrafficSharePct ?? 50}% Guest
          </p>
          <div style={{ width: '100%', height: '8px', backgroundColor: '#FFF0F2', borderRadius: '6px', overflow: 'hidden', display: 'flex' }}>
            <div style={{ width: `${ov.memberTrafficSharePct ?? 50}%`, backgroundColor: '#B38B8F', height: '100%' }} />
            <div style={{ width: `${ov.guestTrafficSharePct ?? 50}%`, backgroundColor: '#F2D4D7', height: '100%' }} />
          </div>
        </div>
      </div>

      {/* Section 2: Daily Traffic & Engagement Trend Chart + Top Viewed Pages Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '24px' }}>
        {/* Left: Pure CSS Daily Traffic & Product Engagement Bar Chart */}
        <div style={{ backgroundColor: '#FFFFFF', padding: '24px 26px', borderRadius: '20px', border: '1px solid #E8C5C8', boxShadow: '0 8px 25px rgba(232, 197, 200, 0.14)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
              <div>
                <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.65rem', color: '#5C5454', margin: 0 }}>
                  📈 Daily Traffic & Product Engagement Trend
                </h3>
                <span style={{ fontSize: '0.82rem', color: '#8A797A', fontFamily: 'sans-serif' }}>
                  Page Views vs. Product Detail Opens & Ritual Bag Additions (US Central Time)
                </span>
              </div>
              <div style={{ display: 'flex', gap: '12px', fontSize: '0.76rem', fontFamily: 'sans-serif', color: '#5C5454' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: '#B38B8F', display: 'inline-block' }} />
                  Page Views
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: '#F2D4D7', border: '1px solid #B38B8F', display: 'inline-block' }} />
                  Product Views
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: '#2E7D32', display: 'inline-block' }} />
                  Bag Adds
                </span>
              </div>
            </div>

            {dailySeries.length === 0 ? (
              <p style={{ color: '#8A797A', fontStyle: 'italic', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.2rem' }}>
                No daily traffic recorded yet. Click "✨ Load Sample Traffic Preview" above to preview multi-day charts.
              </p>
            ) : (
              <div style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: '8px',
                height: '215px',
                padding: '18px 12px 8px 12px',
                backgroundColor: '#FFF9F9',
                borderRadius: '14px',
                border: '1px solid #E8C5C8',
                overflowX: 'auto'
              }}>
                {dailySeries.map((day, idx) => {
                  const pvH = Math.max(4, Math.round((Number(day.pageViews || 0) / maxDailyVal) * 145));
                  const prodH = Math.max(3, Math.round((Number(day.productViews || 0) / maxDailyVal) * 145));
                  const cartH = Math.max(0, Math.round((Number(day.cartAdds || 0) / maxDailyVal) * 145));
                  return (
                    <div
                      key={day.dateStr || idx}
                      title={`${day.label}: ${day.pageViews} Page Views • ${day.productViews} Product Views • ${day.cartAdds} Bag Adds • ${day.orders} Orders`}
                      style={{
                        flex: '1 0 34px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        height: '100%'
                      }}
                    >
                      <span style={{ fontSize: '0.68rem', color: '#8A797A', fontFamily: 'sans-serif', marginBottom: '3px', fontWeight: day.pageViews > 0 ? 'bold' : 'normal' }}>
                        {day.pageViews > 0 ? day.pageViews : ''}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '150px' }}>
                        <div style={{ width: '9px', height: `${pvH}px`, backgroundColor: '#B38B8F', borderRadius: '4px 4px 0 0', transition: 'height 0.3s ease' }} />
                        <div style={{ width: '9px', height: `${prodH}px`, backgroundColor: '#F2D4D7', border: '1px solid #B38B8F', borderRadius: '4px 4px 0 0', transition: 'height 0.3s ease' }} />
                        {cartH > 0 && (
                          <div style={{ width: '7px', height: `${Math.max(5, cartH)}px`, backgroundColor: '#2E7D32', borderRadius: '4px 4px 0 0', transition: 'height 0.3s ease' }} />
                        )}
                      </div>
                      <span style={{ fontSize: '0.68rem', color: '#5C5454', fontFamily: 'sans-serif', marginTop: '6px', whiteSpace: 'nowrap' }}>
                        {day.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', fontSize: '0.82rem', color: '#736A6A', fontFamily: 'sans-serif' }}>
            <span>💡 Hover over any day's bars to inspect exact Page Views, Product Modal Opens, Bag Additions, and Orders.</span>
          </div>
        </div>

        {/* Right: Top Viewed Pages & Member Sanctuary Tabs */}
        <div style={{ backgroundColor: '#FFFFFF', padding: '24px 26px', borderRadius: '20px', border: '1px solid #E8C5C8', boxShadow: '0 8px 25px rgba(232, 197, 200, 0.14)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.65rem', color: '#5C5454', margin: 0 }}>
                🏛️ Most Visited Pages & Member Sanctuary Tabs
              </h3>
              <span style={{ fontSize: '0.82rem', color: '#8A797A', fontFamily: 'sans-serif' }}>
                Ranked by total page views and unique visitor sessions
              </span>
            </div>
            <span style={{ backgroundColor: '#FFF0F2', color: '#B38B8F', padding: '4px 10px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 'bold', fontFamily: 'sans-serif' }}>
              {topPages.length} Active Destinations
            </span>
          </div>

          {topPages.length === 0 ? (
            <div style={{ padding: '30px', textAlign: 'center', backgroundColor: '#FFF9F9', borderRadius: '14px', border: '1px dashed #E8C5C8' }}>
              <p style={{ margin: 0, fontFamily: "'Cormorant Garamond', serif", fontSize: '1.2rem', color: '#8A797A', fontStyle: 'italic' }}>
                Browse the Boutique or click "✨ Load Sample Traffic Preview" to populate page rankings.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '240px', overflowY: 'auto' }}>
              {topPages.map((pg, idx) => (
                <div key={pg.page || idx} style={{ backgroundColor: '#FFF9F9', border: '1px solid #E8C5C8', borderRadius: '12px', padding: '10px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                    <strong style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.12rem', color: '#5C5454' }}>
                      {idx + 1}. {pg.page}
                    </strong>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontFamily: 'sans-serif', fontSize: '0.78rem' }}>
                      <span style={{ color: '#B38B8F', fontWeight: 'bold' }}>{pg.views} views ({pg.sharePct}%)</span>
                      <span style={{ color: '#8A797A' }}>• {pg.uniqueSessions} session(s)</span>
                    </div>
                  </div>
                  <div style={{ width: '100%', height: '6px', backgroundColor: '#FFF0F2', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, Math.max(6, pg.sharePct))}%`, height: '100%', backgroundColor: '#B38B8F', borderRadius: '4px' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Section 3: 5-Stage Boutique Conversion Funnel & Blueprint Quiz Pipeline */}
      <div style={{ backgroundColor: '#FFFFFF', padding: '24px 26px', borderRadius: '20px', border: '1px solid #E8C5C8', boxShadow: '0 8px 25px rgba(232, 197, 200, 0.14)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.7rem', color: '#5C5454', margin: 0 }}>
              🔻 5-Stage Boutique Conversion Funnel & Shopper Journey
            </h3>
            <span style={{ fontSize: '0.84rem', color: '#8A797A', fontFamily: 'sans-serif' }}>
              Tracks how visitors progress from landing on the site to opening product modals, adding to their Ritual Bag, and completing paid orders
            </span>
          </div>
          <span style={{ backgroundColor: '#F6FBF7', color: '#2E7D32', border: '1px solid #A5D6A7', padding: '4px 12px', borderRadius: '14px', fontSize: '0.8rem', fontWeight: 'bold', fontFamily: 'sans-serif' }}>
            Overall Site-to-Order Conversion: {Number(ov.conversionRatePct || 0).toFixed(1)}%
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(185px, 1fr))', gap: '14px' }}>
          {funnel.map((st, idx) => (
            <div key={st.stage || idx} style={{ backgroundColor: '#FFF9F9', border: '1px solid #E8C5C8', borderRadius: '14px', padding: '14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '8px' }}>
              <div>
                <span style={{ fontSize: '0.76rem', color: '#8A797A', fontFamily: 'sans-serif', fontWeight: 'bold' }}>
                  {st.stage}
                </span>
                <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2rem', color: '#5C5454', fontWeight: 'bold', margin: '4px 0' }}>
                  {Number(st.count || 0).toLocaleString()}
                </p>
              </div>
              <div>
                <div style={{ width: '100%', height: '7px', backgroundColor: '#FFF0F2', borderRadius: '4px', overflow: 'hidden', marginBottom: '4px' }}>
                  <div style={{ width: `${Math.min(100, Math.max(5, st.pctOfTop || 0))}%`, height: '100%', backgroundColor: idx === funnel.length - 1 ? '#2E7D32' : '#B38B8F' }} />
                </div>
                <span style={{ fontSize: '0.75rem', color: '#B38B8F', fontFamily: 'sans-serif', fontWeight: 'bold' }}>
                  {st.pctOfTop}% of Top-of-Funnel
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 4: Most Viewed & Highest-Converting Products Leaderboard */}
      <div style={{ backgroundColor: '#FFFFFF', padding: '26px 28px', borderRadius: '20px', border: '1.5px solid #B38B8F', boxShadow: '0 8px 25px rgba(232, 197, 200, 0.16)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '18px' }}>
          <div>
            <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.85rem', color: '#5C5454', margin: 0 }}>
              🏆 Most Viewed, Carted & Highest-Converting Products Leaderboard
            </h3>
            <p style={{ margin: '3px 0 0 0', fontSize: '0.88rem', color: '#8A797A', fontFamily: 'sans-serif' }}>
              See which products attract the most views, which convert into Ritual Bag additions and orders, and which hidden gems to curate for members next.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {[
              { id: 'engagement', label: '🔥 Top Overall' },
              { id: 'views', label: '👁️ Most Viewed' },
              { id: 'cartAdds', label: '🛍️ Most Added to Bag' },
              { id: 'purchases', label: '💸 Most Purchased' },
              { id: 'curated', label: '💌 Most Curated' },
              { id: 'conversion', label: '💎 Highest View→Bag %' }
            ].map(sBtn => (
              <button
                key={sBtn.id}
                type="button"
                onClick={() => setLeaderboardSort(sBtn.id)}
                style={{
                  padding: '7px 13px',
                  borderRadius: '16px',
                  border: leaderboardSort === sBtn.id ? '1.5px solid #B38B8F' : '1px solid #E8C5C8',
                  backgroundColor: leaderboardSort === sBtn.id ? '#F2D4D7' : '#FFF9F9',
                  color: '#5C5454',
                  fontFamily: 'sans-serif',
                  fontSize: '0.78rem',
                  fontWeight: leaderboardSort === sBtn.id ? 'bold' : 'normal',
                  cursor: 'pointer'
                }}
              >
                {sBtn.label}
              </button>
            ))}
          </div>
        </div>

        {sortedLeaderboard.length === 0 ? (
          <p style={{ color: '#8A797A', fontStyle: 'italic', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.2rem' }}>
            No products in catalog yet.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '520px', overflowY: 'auto', paddingRight: '4px' }}>
            {sortedLeaderboard.slice(0, 20).map((prod, idx) => {
              const bStyle = badgeStyleForTone(prod.badgeTone);
              const imgUrl = prod.imageUrl && prod.imageUrl.startsWith('//') ? `https:${prod.imageUrl}` : prod.imageUrl;

              return (
                <div
                  key={prod._id || idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '14px',
                    padding: '14px 16px',
                    backgroundColor: '#FFF9F9',
                    border: '1px solid #E8C5C8',
                    borderRadius: '14px'
                  }}
                >
                  {/* Product Info & Skin Condition Pills */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: '2 1 300px' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: idx < 3 ? '#F2D4D7' : '#FFFFFF',
                      border: '1px solid #B38B8F',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: "'Cormorant Garamond', serif",
                      fontWeight: 'bold',
                      color: '#5C5454',
                      flexShrink: 0
                    }}>
                      {idx + 1}
                    </div>

                    <div style={{ width: '54px', height: '54px', borderRadius: '10px', backgroundColor: '#FFF0F2', border: '1px solid #E8C5C8', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {imgUrl ? (
                        <img src={imgUrl} alt={prod.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ fontSize: '0.7rem', color: '#B38B8F' }}>SKU</span>
                      )}
                    </div>

                    <div style={{ minWidth: '180px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <strong style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.2rem', color: '#5C5454' }}>
                          {prod.title}
                        </strong>
                        <span style={{ fontSize: '0.88rem', color: '#B38B8F', fontWeight: 'bold', fontFamily: 'sans-serif' }}>
                          ${Number(prod.price || 0).toFixed(2)}
                        </span>
                        <span style={{
                          backgroundColor: bStyle.bg,
                          color: bStyle.color,
                          border: `1px solid ${bStyle.border}`,
                          padding: '2px 9px',
                          borderRadius: '10px',
                          fontSize: '0.72rem',
                          fontFamily: 'sans-serif',
                          fontWeight: 'bold'
                        }}>
                          {prod.curationInsightBadge}
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '5px', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.7rem', backgroundColor: '#5C5454', color: '#FFFFFF', padding: '2px 7px', borderRadius: '8px', fontFamily: 'sans-serif' }}>
                          {prod.ritualStep}
                        </span>
                        {(prod.skinTypes || []).slice(0, 2).map((st, i) => (
                          <span key={`lb-st-${i}`} style={{ fontSize: '0.7rem', backgroundColor: '#FFF0F2', color: '#5C5454', border: '1px solid #E8C5C8', padding: '1px 6px', borderRadius: '8px', fontFamily: 'sans-serif' }}>
                            💧 {st}
                          </span>
                        ))}
                        {(prod.skinConcerns || []).slice(0, 2).map((sc, i) => (
                          <span key={`lb-sc-${i}`} style={{ fontSize: '0.7rem', backgroundColor: '#F6FBF7', color: '#2E7D32', border: '1px solid #A5D6A7', padding: '1px 6px', borderRadius: '8px', fontFamily: 'sans-serif' }}>
                            ✨ {sc}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Telemetry Metrics Columns */}
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap', fontFamily: 'sans-serif' }}>
                    <div style={{ textAlign: 'center', minWidth: '58px' }}>
                      <span style={{ display: 'block', fontSize: '0.7rem', color: '#8A797A' }}>Views</span>
                      <strong style={{ fontSize: '1.08rem', color: '#5C5454' }}>{prod.viewCount}</strong>
                    </div>
                    <div style={{ textAlign: 'center', minWidth: '58px' }}>
                      <span style={{ display: 'block', fontSize: '0.7rem', color: '#8A797A' }}>Bag Adds</span>
                      <strong style={{ fontSize: '1.08rem', color: '#B38B8F' }}>{prod.cartAddCount}</strong>
                    </div>
                    <div style={{ textAlign: 'center', minWidth: '58px' }}>
                      <span style={{ display: 'block', fontSize: '0.7rem', color: '#8A797A' }}>View→Bag</span>
                      <strong style={{ fontSize: '1.02rem', color: '#5C5454' }}>{prod.viewToCartRatePct}%</strong>
                    </div>
                    <div style={{ textAlign: 'center', minWidth: '58px' }}>
                      <span style={{ display: 'block', fontSize: '0.7rem', color: '#8A797A' }}>Sold</span>
                      <strong style={{ fontSize: '1.08rem', color: '#2E7D32' }}>{prod.purchaseCount}</strong>
                    </div>
                    <div style={{ textAlign: 'center', minWidth: '68px' }}>
                      <span style={{ display: 'block', fontSize: '0.7rem', color: '#8A797A' }}>Revenue</span>
                      <strong style={{ fontSize: '1.05rem', color: '#2E7D32' }}>${Number(prod.revenueUsd || 0).toFixed(2)}</strong>
                    </div>
                    <div style={{ textAlign: 'center', minWidth: '58px' }}>
                      <span style={{ display: 'block', fontSize: '0.7rem', color: '#8A797A' }}>Curated</span>
                      <strong style={{ fontSize: '1.05rem', color: '#5E35B1' }}>{prod.curatedCount}x</strong>
                    </div>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      {onOpenCurationTab && (
                        <button
                          type="button"
                          onClick={onOpenCurationTab}
                          style={{ backgroundColor: '#F2D4D7', border: '1px solid #B38B8F', color: '#5C5454', padding: '7px 12px', borderRadius: '14px', fontFamily: "'Cormorant Garamond', serif", fontSize: '0.95rem', fontWeight: 'bold', cursor: 'pointer' }}
                        >
                          ✨ Curate for Member →
                        </button>
                      )}
                      {onOpenInventoryTab && (
                        <button
                          type="button"
                          onClick={onOpenInventoryTab}
                          style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8C5C8', color: '#736A6A', padding: '7px 10px', borderRadius: '14px', fontFamily: 'sans-serif', fontSize: '0.76rem', cursor: 'pointer' }}
                        >
                          🏷️ Edit
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Section 5: Curation Intelligence — Member Blueprint Demand vs. Inventory Supply Matrix */}
      <div style={{ backgroundColor: '#FFFFFF', padding: '26px 28px', borderRadius: '20px', border: '1px solid #E8C5C8', boxShadow: '0 8px 25px rgba(232, 197, 200, 0.14)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.85rem', color: '#5C5454', margin: 0 }}>
              🧬 Curation Intelligence: Member Blueprint Demand vs. Boutique Supply Matrix
            </h3>
            <p style={{ margin: '3px 0 0 0', fontSize: '0.88rem', color: '#8A797A', fontFamily: 'sans-serif' }}>
              Compares your members' locked Beauty Blueprints ({bpSupplyDemand.totalBlueprints || 0} profiles) against your active Boutique inventory ({bpSupplyDemand.totalCatalog || 0} products) to spotlight curation & catalog opportunities.
            </p>
          </div>
          {onOpenCurationTab && (
            <button
              type="button"
              onClick={onOpenCurationTab}
              style={{ backgroundColor: '#F2D4D7', border: '1px solid #B38B8F', color: '#5C5454', padding: '8px 16px', borderRadius: '18px', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.02rem', fontWeight: 'bold', cursor: 'pointer' }}
            >
              ✨ Open Client Curation Studio →
            </button>
          )}
        </div>

        {/* Actionable Curation Recommendations Callout */}
        {Array.isArray(bpSupplyDemand.curationRecommendations) && bpSupplyDemand.curationRecommendations.length > 0 && (
          <div style={{ backgroundColor: '#FFF0F2', border: '1px solid #B38B8F', borderRadius: '14px', padding: '14px 18px', marginBottom: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <strong style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.2rem', color: '#5C5454' }}>
              💡 Odie's Automated Curation & Inventory Recommendations for Susan:
            </strong>
            {bpSupplyDemand.curationRecommendations.map((rec, i) => (
              <div key={i} style={{ fontSize: '0.86rem', color: '#5C5454', fontFamily: 'sans-serif' }}>
                {rec}
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
          {/* Primary Skin Goals / Conditions Matrix */}
          <div style={{ backgroundColor: '#FFF9F9', border: '1px solid #E8C5C8', borderRadius: '14px', padding: '16px' }}>
            <strong style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.3rem', color: '#5C5454', display: 'block', marginBottom: '10px' }}>
              🎯 Primary Skin Conditions (Member Demand vs. Products in Stock)
            </strong>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {(bpSupplyDemand.skinConcerns || []).map((row, idx) => (
                <div key={idx} style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8C5C8', borderRadius: '10px', padding: '10px 12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <strong style={{ color: '#5C5454', fontFamily: 'sans-serif', fontSize: '0.86rem' }}>{row.trait}</strong>
                    <span style={{ fontSize: '0.74rem', fontFamily: 'sans-serif', fontWeight: 'bold', color: row.status.startsWith('✓') ? '#2E7D32' : '#B26A00' }}>
                      {row.status}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#736A6A', fontFamily: 'sans-serif' }}>
                    <span>👥 Members: <strong>{row.memberCount}</strong> ({row.memberSharePct}%)</span>
                    <span>🛍️ Catalog: <strong>{row.productCount} SKUs</strong> ({row.catalogSharePct}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Skin Types & Sensitivity Matrix */}
          <div style={{ backgroundColor: '#FFF9F9', border: '1px solid #E8C5C8', borderRadius: '14px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <strong style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.3rem', color: '#5C5454', display: 'block', marginBottom: '10px' }}>
                💧 Member Skin Temperaments vs. Compatible Products
              </strong>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(bpSupplyDemand.skinTypes || []).map((row, idx) => (
                  <div key={idx} style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8C5C8', borderRadius: '10px', padding: '9px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'sans-serif', fontSize: '0.82rem' }}>
                    <strong style={{ color: '#5C5454' }}>{row.trait}</strong>
                    <span style={{ color: '#736A6A' }}>
                      👥 <strong>{row.memberCount}</strong> members ({row.memberSharePct}%) • 🛍️ <strong>{row.productCount}</strong> products
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <strong style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.25rem', color: '#5C5454', display: 'block', marginBottom: '8px' }}>
                🛡️ Member Skin Sensitivity Distribution
              </strong>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {(bpSupplyDemand.sensitivities || []).map((row, idx) => (
                  <div key={idx} style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8C5C8', borderRadius: '10px', padding: '10px', textAlign: 'center', fontFamily: 'sans-serif' }}>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: '#8A797A', fontWeight: 'bold' }}>{row.trait}</span>
                    <strong style={{ fontSize: '1.2rem', color: '#B38B8F' }}>{row.memberCount}</strong>
                    <span style={{ display: 'block', fontSize: '0.72rem', color: '#736A6A' }}>{row.productCount} Safe SKUs</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section 6: Shopper Filter/Search Trends & Live Visitor Activity Stream */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
        {/* Left: Top Filter Pills & Search Keywords */}
        <div style={{ backgroundColor: '#FFFFFF', padding: '24px 26px', borderRadius: '20px', border: '1px solid #E8C5C8', boxShadow: '0 8px 25px rgba(232, 197, 200, 0.14)' }}>
          <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.65rem', color: '#5C5454', margin: '0 0 6px 0' }}>
            🔍 Shopper Filter Clicks & Boutique Search Trends
          </h3>
          <p style={{ margin: '0 0 14px 0', fontSize: '0.84rem', color: '#8A797A', fontFamily: 'sans-serif' }}>
            Reveals which skin-condition pills, ritual steps, and ingredient keywords shoppers actively filter and search for.
          </p>

          <div style={{ marginBottom: '16px' }}>
            <strong style={{ display: 'block', fontSize: '0.82rem', color: '#8A797A', fontFamily: 'sans-serif', marginBottom: '8px', textTransform: 'uppercase' }}>
              🏷️ Most Clicked Boutique Filter Pills:
            </strong>
            {filterTrends.length === 0 ? (
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#A89999', fontStyle: 'italic' }}>
                No filter clicks recorded in this window yet.
              </p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {filterTrends.map((f, i) => (
                  <span key={i} style={{ backgroundColor: '#FFF0F2', color: '#5C5454', border: '1px solid #B38B8F', borderRadius: '14px', padding: '5px 11px', fontSize: '0.8rem', fontFamily: 'sans-serif', fontWeight: 'bold' }}>
                    {f.label} <span style={{ color: '#B38B8F' }}>({f.count})</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <strong style={{ display: 'block', fontSize: '0.82rem', color: '#8A797A', fontFamily: 'sans-serif', marginBottom: '8px', textTransform: 'uppercase' }}>
              🔍 Top Boutique Search Keywords:
            </strong>
            {searchTrends.length === 0 ? (
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#A89999', fontStyle: 'italic' }}>
                No search queries recorded in this window yet.
              </p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {searchTrends.map((s, i) => (
                  <span key={i} style={{ backgroundColor: '#F6FBF7', color: '#2E7D32', border: '1px solid #A5D6A7', borderRadius: '14px', padding: '5px 11px', fontSize: '0.8rem', fontFamily: 'sans-serif', fontWeight: 'bold' }}>
                    "{s.keyword}" ({s.count})
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Live Visitor & Member Activity Stream */}
        <div style={{ backgroundColor: '#FFFFFF', padding: '24px 26px', borderRadius: '20px', border: '1px solid #E8C5C8', boxShadow: '0 8px 25px rgba(232, 197, 200, 0.14)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div>
              <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.65rem', color: '#5C5454', margin: 0 }}>
                ⚡ Live Visitor & Member Activity Stream
              </h3>
              <span style={{ fontSize: '0.82rem', color: '#8A797A', fontFamily: 'sans-serif' }}>
                Latest 35 telemetry events across your Public Boutique & Member Sanctuary
              </span>
            </div>
          </div>

          {recentEvents.length === 0 ? (
            <p style={{ color: '#8A797A', fontStyle: 'italic', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.15rem' }}>
              No visitor events recorded yet.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '250px', overflowY: 'auto', paddingRight: '4px' }}>
              {recentEvents.map((ev, idx) => {
                const meta = eventLabelStyle(ev.eventType);
                return (
                  <div key={ev._id || idx} style={{ backgroundColor: '#FFF9F9', border: '1px solid #E8C5C8', borderRadius: '10px', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', fontFamily: 'sans-serif', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ backgroundColor: meta.bg, color: meta.color, padding: '2px 8px', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.74rem' }}>
                        {meta.icon} {meta.label}
                      </span>
                      <strong style={{ color: '#5C5454' }}>
                        {ev.productTitle || ev.filterValue || ev.searchQuery || ev.page || 'Site Interaction'}
                      </strong>
                      {ev.userEmail ? (
                        <span style={{ color: '#B38B8F', fontWeight: 'bold' }}>({ev.userEmail})</span>
                      ) : (
                        <span style={{ color: '#A89999' }}>({ev.membershipTier || 'guest'})</span>
                      )}
                    </div>
                    <span style={{ fontSize: '0.73rem', color: '#8A797A' }}>
                      {ev.timestampCT}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const AdminMonthlyBoxesAndCjStudio = ({
  catalogProducts = [],
  refreshTrigger = 0,
  onCatalogUpdated,
  onOrdersUpdated,
  onOpenFinancesTab,
  onAskOdie
}) => {
  const [boxTelemetry, setBoxTelemetry] = useState(null);
  const [packagingCatalog, setPackagingCatalog] = useState(null);
  const [billingMonth, setBillingMonth] = useState('');
  const [isLoadingBoxes, setIsLoadingBoxes] = useState(false);
  const [isCuratingAll, setIsCuratingAll] = useState(false);
  const [curatingUserId, setCuratingUserId] = useState(null);
  const [updatingBoxId, setUpdatingBoxId] = useState(null);
  const [dispatchingBoxId, setDispatchingBoxId] = useState(null);
  const [isApplyingGlobalStudio, setIsApplyingGlobalStudio] = useState(false);

  const [defaultBoxCarrier, setDefaultBoxCarrier] = useState('CJPacket Sensitive');
  const [globalBoxCustomLabelEnabled, setGlobalBoxCustomLabelEnabled] = useState(true);
  const [selectedSlotSwapMap, setSelectedSlotSwapMap] = useState({});

  const [studioConfig, setStudioConfig] = useState({
    enabled: true,
    packagingVid: 'CJ-PKG-ROSEGOLD-BOX-01',
    packagingName: "Susan's Rose-Gold Custom Box & Seal",
    labelType: 'CJ_CUSTOM_PACKAGING',
    customBrandText: "Susan's Beauty Consulting ✧",
    logoUrl: 'https://susansbeautyconsulting.com/susans-logo.png',
    ritualCardMessage: 'Hand-selected for your Personal Beauty Blueprint Sanctuary ✧',
    packagingCostUsd: 0.65,
    defaultLogisticName: 'CJPacket Sensitive',
    shippingIncludedInPrice: true,
    markupMultiplier: 6.5
  });

  const [statusBanner, setStatusBanner] = useState({ type: '', text: '' });

  const fetchMonthlyBoxesAndPackaging = async (monthOverride = billingMonth) => {
    const token = localStorage.getItem('token');
    setIsLoadingBoxes(true);
    try {
      const monthQuery = monthOverride ? `?billingMonth=${encodeURIComponent(monthOverride)}` : '';
      const [boxesRes, pkgRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/admin/monthly-boxes${monthQuery}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API_BASE_URL}/api/admin/cj/custom-packaging`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).catch(() => null)
      ]);

      if (boxesRes && boxesRes.ok) {
        const bData = await boxesRes.json();
        setBoxTelemetry(bData);
        if (!billingMonth && bData.billingMonth) {
          setBillingMonth(bData.billingMonth);
        }
      }
      if (pkgRes && pkgRes.ok) {
        const pData = await pkgRes.json();
        setPackagingCatalog(pData);
      }
    } catch (err) {
      console.error('Error fetching monthly boxes studio:', err);
      setStatusBanner({
        type: 'error',
        text: 'Network error while loading Monthly Membership Boxes & CJ Studio.'
      });
    }
    setIsLoadingBoxes(false);
  };

  useEffect(() => {
    fetchMonthlyBoxesAndPackaging(billingMonth);
    // eslint-disable-next-line
  }, [refreshTrigger]);

  const handleAutoCurateAllBoxes = async () => {
    const token = localStorage.getItem('token');
    setIsCuratingAll(true);
    setStatusBanner({ type: '', text: '' });

    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/monthly-boxes/curate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          curateAll: true,
          billingMonth: billingMonth || undefined,
          selectedLogisticName: defaultBoxCarrier,
          customLabelConfig: {
            enabled: Boolean(globalBoxCustomLabelEnabled),
            packagingVid: studioConfig.packagingVid,
            packagingName: studioConfig.packagingName,
            labelType: studioConfig.labelType,
            customBrandText: studioConfig.customBrandText,
            logoUrl: studioConfig.logoUrl,
            packagingCostUsd: Boolean(globalBoxCustomLabelEnabled) ? Number(studioConfig.packagingCostUsd || 0.65) : 0
          },
          curatedBy: 'susan'
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setBoxTelemetry(data);
        setStatusBanner({
          type: 'success',
          text: data.message || 'Curated all member monthly boxes strictly within the ≤25% cost cap! ✧'
        });
      } else {
        setStatusBanner({
          type: 'error',
          text: data.error || 'Failed to auto-curate monthly member boxes.'
        });
      }
    } catch (err) {
      console.error('Auto-curate all boxes error:', err);
      setStatusBanner({ type: 'error', text: 'Network error while auto-curating monthly boxes.' });
    }
    setIsCuratingAll(false);
  };

  const handleCurateSingleMemberBox = async (userId) => {
    const token = localStorage.getItem('token');
    setCuratingUserId(userId);
    setStatusBanner({ type: '', text: '' });

    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/monthly-boxes/curate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userId,
          curateAll: false,
          billingMonth: billingMonth || undefined,
          selectedLogisticName: defaultBoxCarrier,
          customLabelConfig: {
            enabled: Boolean(globalBoxCustomLabelEnabled),
            packagingVid: studioConfig.packagingVid,
            packagingName: studioConfig.packagingName,
            labelType: studioConfig.labelType,
            customBrandText: studioConfig.customBrandText,
            logoUrl: studioConfig.logoUrl,
            packagingCostUsd: Boolean(globalBoxCustomLabelEnabled) ? Number(studioConfig.packagingCostUsd || 0.65) : 0
          },
          curatedBy: 'susan'
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setBoxTelemetry(data);
        setStatusBanner({
          type: 'success',
          text: data.message || 'Curated member monthly box under the 25% cost cap! ✧'
        });
      } else {
        setStatusBanner({
          type: 'error',
          text: data.error || 'Failed to curate member box.'
        });
      }
    } catch (err) {
      console.error('Curate single member box error:', err);
      setStatusBanner({ type: 'error', text: 'Network error while curating member box.' });
    }
    setCuratingUserId(null);
  };

  const handleUpdateBoxSettings = async (boxId, payloadUpdates) => {
    const token = localStorage.getItem('token');
    setUpdatingBoxId(boxId);
    setStatusBanner({ type: '', text: '' });

    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/monthly-boxes/${boxId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payloadUpdates)
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setBoxTelemetry(data);
        setStatusBanner({
          type: 'success',
          text: data.message || 'Monthly box updated and verified against the ≤25% cost cap! ✧'
        });
      } else {
        setStatusBanner({
          type: 'error',
          text: data.error || 'Edit rejected by the 25% cost cap guardrail.'
        });
      }
    } catch (err) {
      console.error('Update monthly box error:', err);
      setStatusBanner({ type: 'error', text: 'Network error while updating monthly box.' });
    }
    setUpdatingBoxId(null);
  };

  const handleDispatchBoxToCj = async (box) => {
    const token = localStorage.getItem('token');
    setDispatchingBoxId(box._id);
    setStatusBanner({ type: '', text: '' });

    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/monthly-boxes/${box._id}/dispatch-cj`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          payFromCjWallet: true,
          notifyMember: true
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setBoxTelemetry(data);
        setStatusBanner({
          type: 'success',
          text: data.message || `Dispatched ${box.memberName}'s monthly box to CJ Dropshipping! ✧`
        });
        if (onOrdersUpdated) onOrdersUpdated();
      } else {
        setStatusBanner({
          type: 'error',
          text: data.error || 'Failed to dispatch monthly box to CJ Dropshipping.'
        });
      }
    } catch (err) {
      console.error('Dispatch monthly box error:', err);
      setStatusBanner({ type: 'error', text: 'Network error while dispatching box to CJ Dropshipping.' });
    }
    setDispatchingBoxId(null);
  };

  const handleApplyStudioAcrossBoutique = async () => {
    const token = localStorage.getItem('token');
    setIsApplyingGlobalStudio(true);
    setStatusBanner({ type: '', text: '' });

    try {
      // 1. Apply custom labeling across the catalog
      const labelRes = await fetch(`${API_BASE_URL}/api/admin/cj/custom-label`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          applyToAll: true,
          enabled: Boolean(studioConfig.enabled),
          labelType: studioConfig.labelType,
          packagingVid: studioConfig.packagingVid,
          packagingName: studioConfig.packagingName,
          customBrandText: `${studioConfig.customBrandText} • ${studioConfig.ritualCardMessage}`,
          logoUrl: studioConfig.logoUrl,
          packagingCostUsd: Boolean(studioConfig.enabled) ? Number(studioConfig.packagingCostUsd || 0.65) : 0
        })
      });
      await labelRes.json().catch(() => ({}));

      // 2. Recalculate shipping-included retail prices across the boutique
      const shipRes = await fetch(`${API_BASE_URL}/api/admin/products/bulk-shipping-update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          selectedLogisticName: studioConfig.defaultLogisticName,
          shippingIncludedInPrice: Boolean(studioConfig.shippingIncludedInPrice),
          markupMultiplier: Number(studioConfig.markupMultiplier) || 6.5,
          customLabelConfig: {
            enabled: Boolean(studioConfig.enabled),
            labelType: studioConfig.labelType,
            packagingVid: studioConfig.packagingVid,
            packagingName: studioConfig.packagingName,
            customBrandText: studioConfig.customBrandText,
            logoUrl: studioConfig.logoUrl,
            packagingCostUsd: Boolean(studioConfig.enabled) ? Number(studioConfig.packagingCostUsd || 0.65) : 0
          }
        })
      });
      const shipData = await shipRes.json().catch(() => ({}));

      if (shipRes.ok) {
        if (Array.isArray(shipData.products) && onCatalogUpdated) {
          onCatalogUpdated(shipData.products);
        }
        setStatusBanner({
          type: 'success',
          text: `Applied "${studioConfig.packagingName}" (${studioConfig.enabled ? `+$${Number(studioConfig.packagingCostUsd).toFixed(2)}` : 'Off'}) & recalculated shipping-inclusive retail prices (${studioConfig.defaultLogisticName}) across all ${shipData.updatedCount || catalogProducts.length} boutique products! ✧`
        });
      } else {
        setStatusBanner({
          type: 'error',
          text: shipData.error || 'Failed to apply studio settings across catalog.'
        });
      }
    } catch (err) {
      console.error('Apply studio settings error:', err);
      setStatusBanner({ type: 'error', text: 'Network error while applying Custom Labeling & Shipping Studio settings.' });
    }
    setIsApplyingGlobalStudio(false);
  };

  const sm = boxTelemetry?.summaryMetrics || {};
  const boxes = Array.isArray(boxTelemetry?.boxes) ? boxTelemetry.boxes : [];
  const uncuratedMembers = Array.isArray(boxTelemetry?.uncuratedMembers) ? boxTelemetry.uncuratedMembers : [];
  const packagingOptions = Array.isArray(packagingCatalog?.allOptions) && packagingCatalog.allOptions.length > 0
    ? packagingCatalog.allOptions
    : (Array.isArray(boxTelemetry?.customPackagingOptions) && boxTelemetry.customPackagingOptions.length > 0
        ? boxTelemetry.customPackagingOptions
        : DEFAULT_CJ_PACKAGING_CHOICES);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', animation: 'fadeIn 0.5s ease' }}>
      {/* SECTION 1 — Profit-Protected Monthly Box Command Bar & KPI Cards */}
      <div style={{ backgroundColor: '#FFFFFF', padding: '26px 28px', borderRadius: '20px', border: '1.5px solid #B38B8F', boxShadow: '0 8px 25px rgba(232, 197, 200, 0.18)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2.1rem', color: '#5C5454', margin: 0 }}>
                🎁 Profit-Protected Monthly Ritual Boxes & CJ Studio ({boxTelemetry?.billingMonth || 'Current Cycle'}) ✧
              </h2>
              <span style={{
                backgroundColor: sm.allWithinCap !== false ? '#F6FBF7' : '#FFF8E7',
                color: sm.allWithinCap !== false ? '#2E7D32' : '#B26A00',
                border: `1px solid ${sm.allWithinCap !== false ? '#A5D6A7' : '#FFE082'}`,
                padding: '4px 12px',
                borderRadius: '14px',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                fontFamily: 'sans-serif'
              }}>
                ✓ Under 25% Hard Cap ({Number(sm.averageCostPct || 0).toFixed(1)}% Avg)
              </span>
            </div>
            <p style={{ margin: '5px 0 0 0', fontSize: '0.92rem', color: '#8A797A', fontFamily: 'sans-serif' }}>
              Every box is curated to the member's locked Beauty Blueprint while strictly enforcing that <strong>Wholesale + Consolidated CJ Shipping + Custom Label ≤ 25% of Membership Price</strong> ($12.25 max for Luminary $49/mo; $29.75 max for Radiance $119/mo).
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              disabled={isLoadingBoxes}
              onClick={() => fetchMonthlyBoxesAndPackaging(billingMonth)}
              style={{ backgroundColor: '#FFF9F9', border: '1px solid #B38B8F', color: '#5C5454', padding: '10px 16px', borderRadius: '22px', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.02rem', fontWeight: 'bold', cursor: 'pointer' }}
            >
              {isLoadingBoxes ? '⏳ Refreshing...' : '↻ Refresh Boxes'}
            </button>

            {onOpenFinancesTab && (
              <button
                type="button"
                onClick={onOpenFinancesTab}
                style={{ backgroundColor: '#FFF0F2', border: '1px solid #B38B8F', color: '#5C5454', padding: '10px 16px', borderRadius: '22px', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.02rem', fontWeight: 'bold', cursor: 'pointer' }}
              >
                💳 Top Up CJ Wallet
              </button>
            )}

            <button
              type="button"
              disabled={isCuratingAll}
              onClick={handleAutoCurateAllBoxes}
              style={{ backgroundColor: '#F2D4D7', border: '1px solid #B38B8F', color: '#5C5454', padding: '10px 20px', borderRadius: '22px', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.1rem', fontWeight: 'bold', cursor: isCuratingAll ? 'not-allowed' : 'pointer', boxShadow: '0 4px 12px rgba(179, 139, 143, 0.25)' }}
            >
              {isCuratingAll ? '⏳ Curating All Boxes...' : '✨ Auto-Curate All Member Boxes (≤25% Cost Cap)'}
            </button>

            {onAskOdie && (
              <button
                type="button"
                onClick={() =>
                  onAskOdie(
                    'Odie, curate profit-protected monthly boxes for all paid members under the strict 25% cost cap and audit every box for Blueprint match and net profit.'
                  )
                }
                style={{ backgroundColor: '#B38B8F', border: 'none', color: '#FFFFFF', padding: '10px 18px', borderRadius: '22px', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.08rem', fontWeight: 'bold', cursor: 'pointer' }}
              >
                🐾 Ask Odie to Curate & Audit Boxes
              </button>
            )}
          </div>
        </div>

        {/* Command Bar Controls: Default CJ Box Shipping Method & Global Custom Label Toggle */}
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap', backgroundColor: '#FFF9F9', padding: '14px 18px', borderRadius: '14px', border: '1px solid #E8C5C8' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 'bold', color: '#5C5454', fontFamily: 'sans-serif' }}>
              ✈️ Default CJ Box Shipping Method:
            </span>
            <select
              value={defaultBoxCarrier}
              onChange={(e) => setDefaultBoxCarrier(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '10px', border: '1px solid #B38B8F', backgroundColor: '#FFFFFF', color: '#5C5454', fontFamily: 'sans-serif', fontSize: '0.85rem', fontWeight: 'bold' }}
            >
              {CJ_CARRIER_OPTIONS.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem', color: '#5C5454', fontFamily: 'sans-serif', cursor: 'pointer', backgroundColor: '#FFFFFF', padding: '7px 14px', borderRadius: '10px', border: '1px solid #E8C5C8' }}>
            <input
              type="checkbox"
              checked={Boolean(globalBoxCustomLabelEnabled)}
              onChange={(e) => setGlobalBoxCustomLabelEnabled(e.target.checked)}
            />
            <span>
              🏷️ <strong>Global Custom Label Toggle:</strong> {studioConfig.packagingName} (+${Number(studioConfig.packagingCostUsd || 0.65).toFixed(2)}/box)
            </span>
          </label>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
            <span style={{ fontSize: '0.8rem', color: '#8A797A', fontFamily: 'sans-serif' }}>Billing Cycle:</span>
            <input
              type="month"
              value={billingMonth}
              onChange={(e) => {
                setBillingMonth(e.target.value);
                fetchMonthlyBoxesAndPackaging(e.target.value);
              }}
              style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #E8C5C8', fontFamily: 'sans-serif', fontSize: '0.84rem', color: '#5C5454' }}
            />
          </div>
        </div>

        {/* 4 Executive KPI Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <div style={{ backgroundColor: '#FFF9F9', padding: '18px 20px', borderRadius: '16px', border: '1px solid #E8C5C8' }}>
            <span style={{ fontSize: '0.78rem', color: '#8A797A', fontFamily: 'sans-serif', fontWeight: 'bold', textTransform: 'uppercase' }}>
              💳 Total Monthly Subscription Revenue
            </span>
            <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2.3rem', color: '#5C5454', fontWeight: 'bold', margin: '6px 0 2px 0' }}>
              ${Number(sm.totalSubscriptionRevenueUsd || 0).toFixed(2)}
            </p>
            <span style={{ fontSize: '0.8rem', color: '#736A6A', fontFamily: 'sans-serif' }}>
              {sm.totalCuratedBoxes || 0} Curated Box(es) • {sm.totalPaidMembersCount || 0} Paid Member(s)
            </span>
          </div>

          <div style={{ backgroundColor: '#FFF9F9', padding: '18px 20px', borderRadius: '16px', border: '1px solid #E8C5C8' }}>
            <span style={{ fontSize: '0.78rem', color: '#8A797A', fontFamily: 'sans-serif', fontWeight: 'bold', textTransform: 'uppercase' }}>
              📦 Total All-In CJ Box Cost
            </span>
            <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2.3rem', color: '#B38B8F', fontWeight: 'bold', margin: '6px 0 2px 0' }}>
              ${Number(sm.totalBoxCjCostUsd || 0).toFixed(2)}
            </p>
            <span style={{ fontSize: '0.8rem', color: '#736A6A', fontFamily: 'sans-serif' }}>
              Includes Wholesale + Consolidated CJ Ship + Label
            </span>
          </div>

          <div style={{ backgroundColor: '#F6FBF7', padding: '18px 20px', borderRadius: '16px', border: '1px solid #A5D6A7' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.78rem', color: '#2E7D32', fontFamily: 'sans-serif', fontWeight: 'bold', textTransform: 'uppercase' }}>
                🛡️ Avg Cost-to-Membership %
              </span>
              <span style={{ backgroundColor: '#FFFFFF', color: '#2E7D32', border: '1px solid #A5D6A7', padding: '2px 8px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 'bold', fontFamily: 'sans-serif' }}>
                ✓ Under 25% Hard Cap
              </span>
            </div>
            <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2.3rem', color: '#2E7D32', fontWeight: 'bold', margin: '6px 0 2px 0' }}>
              {Number(sm.averageCostPct || 0).toFixed(1)}%
            </p>
            <span style={{ fontSize: '0.8rem', color: '#2E7D32', fontFamily: 'sans-serif', fontWeight: 'bold' }}>
              Luminary ≤$12.25 • Radiance ≤$29.75
            </span>
          </div>

          <div style={{ backgroundColor: '#FFF9F9', padding: '18px 20px', borderRadius: '16px', border: '1px solid #E8C5C8' }}>
            <span style={{ fontSize: '0.78rem', color: '#8A797A', fontFamily: 'sans-serif', fontWeight: 'bold', textTransform: 'uppercase' }}>
              💰 Guaranteed Net Profit
            </span>
            <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2.3rem', color: '#2E7D32', fontWeight: 'bold', margin: '6px 0 2px 0' }}>
              +${Number(sm.totalNetProfitUsd || 0).toFixed(2)}
            </p>
            <span style={{ fontSize: '0.8rem', color: '#2E7D32', fontFamily: 'sans-serif', fontWeight: 'bold' }}>
              ≥75% Protected Gross Margin
            </span>
          </div>
        </div>
      </div>

      {statusBanner.text && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '10px',
          fontFamily: 'sans-serif',
          fontSize: '0.95rem',
          backgroundColor: statusBanner.type === 'success' ? '#F6FBF7' : '#FFF5F5',
          color: statusBanner.type === 'success' ? '#2E7D32' : '#C62828',
          border: `1px solid ${statusBanner.type === 'success' ? '#A5D6A7' : '#FFCDD2'}`
        }}>
          {statusBanner.text}
        </div>
      )}

      {/* SECTION 2 — Member-by-Member Curated Box Cards (with Live 25% Cost Cap Progress Bar) */}
      <div style={{ backgroundColor: '#FFFFFF', padding: '26px 28px', borderRadius: '20px', border: '1px solid #E8C5C8', boxShadow: '0 8px 25px rgba(232, 197, 200, 0.14)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '18px' }}>
          <div>
            <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.85rem', color: '#5C5454', margin: 0 }}>
              🎀 Member-by-Member Curated Ritual Boxes (Live ≤25% Cost Cap Meter)
            </h3>
            <p style={{ margin: '3px 0 0 0', fontSize: '0.88rem', color: '#8A797A', fontFamily: 'sans-serif' }}>
              Inspect each member's locked Blueprint traits, swap any item with live 25% budget validation, switch CJ shipping carriers, toggle custom labeling, or dispatch directly to CJ Dropshipping.
            </p>
          </div>
        </div>

        {/* Uncurated Paid Members Queue (if any) */}
        {uncuratedMembers.length > 0 && (
          <div style={{ marginBottom: '22px', padding: '16px 18px', borderRadius: '14px', backgroundColor: '#FFF9F9', border: '1px dashed #B38B8F' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
              <strong style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.3rem', color: '#5C5454' }}>
                ⏳ Paid Members Ready for {boxTelemetry?.billingMonth || 'Monthly'} Box Curation ({uncuratedMembers.length})
              </strong>
              <button
                type="button"
                disabled={isCuratingAll}
                onClick={handleAutoCurateAllBoxes}
                style={{ backgroundColor: '#F2D4D7', border: '1px solid #B38B8F', color: '#5C5454', padding: '6px 14px', borderRadius: '16px', fontSize: '0.88rem', fontWeight: 'bold', cursor: 'pointer' }}
              >
                ✨ Curate All {uncuratedMembers.length} Now
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '10px' }}>
              {uncuratedMembers.map(um => (
                <div key={um.userId} style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8C5C8', borderRadius: '10px', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                  <div>
                    <strong style={{ color: '#5C5454', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.1rem', display: 'block' }}>
                      {um.memberName}
                    </strong>
                    <span style={{ fontSize: '0.78rem', color: '#8A797A', fontFamily: 'sans-serif', display: 'block' }}>
                      {um.membershipTier === 'radiance' ? '🌟 Radiance ($119/mo → Max $29.75, 5 pcs)' : '✨ Luminary ($49/mo → Max $12.25, 3 pcs)'}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#B38B8F', fontFamily: 'sans-serif' }}>
                      💧 {um.blueprintSnapshot?.skinType || 'Normal'} • 🎯 {um.blueprintSnapshot?.primaryGoal || 'Hydration'}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={curatingUserId === um.userId}
                    onClick={() => handleCurateSingleMemberBox(um.userId)}
                    style={{ backgroundColor: '#FFF0F2', border: '1px solid #B38B8F', color: '#5C5454', padding: '7px 12px', borderRadius: '14px', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    {curatingUserId === um.userId ? '⏳...' : '+ Curate Box'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {boxes.length === 0 ? (
          <div style={{ padding: '40px 25px', textAlign: 'center', backgroundColor: '#FFF9F9', borderRadius: '16px', border: '1px dashed #E8C5C8' }}>
            <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.45rem', color: '#5C5454', margin: '0 0 12px 0' }}>
              No monthly membership boxes curated for {boxTelemetry?.billingMonth || 'this billing cycle'} yet.
            </p>
            <button
              type="button"
              disabled={isCuratingAll}
              onClick={handleAutoCurateAllBoxes}
              style={{ backgroundColor: '#F2D4D7', border: '1px solid #B38B8F', color: '#5C5454', padding: '12px 24px', borderRadius: '24px', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.15rem', fontWeight: 'bold', cursor: 'pointer' }}
            >
              ✨ Auto-Curate All Member Boxes (≤25% Cost Cap) ✧
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {boxes.map(box => {
              const isRadiance = String(box.membershipTier || '').toLowerCase() === 'radiance';
              const bp = box.blueprintSnapshot || {};
              const costPct = Number(box.costPercentageOfMembership || 0);
              const meterRatioPct = Math.min(100, Math.max(6, (Number(box.totalAllInCostUsd || 0) / Math.max(1, Number(box.maxAllowedCostUsd || 12.25))) * 100));
              const withinCap = box.withinBudgetCap !== false && costPct <= 25.05;

              // Filter compatible catalog items for slot swap dropdowns
              const compatibleCatalog = catalogProducts.filter(p => {
                if (String(bp.skinSensitivity || '').toLowerCase() === 'high' && p.sensitivitySafe === false) {
                  return false;
                }
                return true;
              });

              return (
                <div
                  key={box._id}
                  style={{
                    backgroundColor: '#FFF9F9',
                    border: withinCap ? '1.5px solid #B38B8F' : '2px solid #C62828',
                    borderRadius: '18px',
                    padding: '22px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    boxShadow: '0 6px 20px rgba(232, 197, 200, 0.15)'
                  }}
                >
                  {/* Box Top Header: Member Identity, Tier Rules & Status Badge */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid #E8C5C8', paddingBottom: '12px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <strong style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.55rem', color: '#5C5454' }}>
                          {box.memberName || 'Valued Member'}
                        </strong>
                        <span style={{
                          backgroundColor: isRadiance ? '#F4F0FF' : '#FFF0F2',
                          color: isRadiance ? '#5E35B1' : '#B38B8F',
                          border: `1px solid ${isRadiance ? '#D1C4E9' : '#B38B8F'}`,
                          padding: '3px 11px',
                          borderRadius: '12px',
                          fontSize: '0.78rem',
                          fontWeight: 'bold',
                          fontFamily: 'sans-serif'
                        }}>
                          {isRadiance
                            ? '🌟 Radiance $119/mo → Max $29.75 Cost, 5 pcs'
                            : '✨ Luminary $49/mo → Max $12.25 Cost, 3 pcs'}
                        </span>
                        <span style={{
                          backgroundColor: box.status === 'DISPATCHED_TO_CJ' ? '#F6FBF7' : '#FFFFFF',
                          color: box.status === 'DISPATCHED_TO_CJ' ? '#2E7D32' : '#5C5454',
                          border: '1px solid #E8C5C8',
                          padding: '3px 10px',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: 'bold',
                          fontFamily: 'sans-serif'
                        }}>
                          {box.status === 'DISPATCHED_TO_CJ' ? `✓ Dispatched (${box.cjOrderId || 'CJ'})` : `Status: ${box.status}`}
                        </span>
                      </div>

                      <p style={{ margin: '4px 0 8px 0', fontSize: '0.84rem', color: '#736A6A', fontFamily: 'sans-serif' }}>
                        📧 {box.memberEmail} • Curated by {box.curatedBy === 'odie' ? '🐾 Odie AI' : '👩🏼‍💼 Susan'} • {bp.archetypeTitle || 'Personal Blueprint Sanctuary'}
                      </p>

                      {/* Locked Blueprint Badges */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.74rem', fontWeight: 'bold', color: '#B38B8F', fontFamily: 'sans-serif' }}>
                          🔒 Locked Blueprint:
                        </span>
                        <span style={{ backgroundColor: '#FFFFFF', border: '1px solid #B38B8F', color: '#5C5454', borderRadius: '10px', padding: '2px 9px', fontSize: '0.74rem', fontFamily: 'sans-serif', fontWeight: 'bold' }}>
                          💧 Skin Type: {bp.skinType || 'Normal'}
                        </span>
                        <span style={{ backgroundColor: '#FFFFFF', border: '1px solid #B38B8F', color: '#5C5454', borderRadius: '10px', padding: '2px 9px', fontSize: '0.74rem', fontFamily: 'sans-serif', fontWeight: 'bold' }}>
                          🎯 Primary Goal: {bp.primaryGoal || 'Hydration'}
                        </span>
                        <span style={{ backgroundColor: '#F6FBF7', border: '1px solid #A5D6A7', color: '#2E7D32', borderRadius: '10px', padding: '2px 9px', fontSize: '0.74rem', fontFamily: 'sans-serif', fontWeight: 'bold' }}>
                          🛡️ Sensitivity: {bp.skinSensitivity || 'Moderate'}
                        </span>
                        {bp.climate && (
                          <span style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8C5C8', color: '#736A6A', borderRadius: '10px', padding: '2px 8px', fontSize: '0.73rem', fontFamily: 'sans-serif' }}>
                            🌤️ {bp.climate} Climate
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Visual 25% Budget Cap Meter */}
                    <div style={{ minWidth: '300px', flex: '0 1 360px', backgroundColor: '#FFFFFF', padding: '12px 16px', borderRadius: '14px', border: withinCap ? '1px solid #A5D6A7' : '1.5px solid #C62828', fontFamily: 'sans-serif' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <strong style={{ fontSize: '0.78rem', color: withinCap ? '#2E7D32' : '#C62828', textTransform: 'uppercase' }}>
                          {withinCap ? '✓ 25% Budget Cap Meter' : '⚠️ Over 25% Cap'}
                        </strong>
                        <strong style={{ fontSize: '0.86rem', color: '#2E7D32' }}>
                          Profit: +${Number(box.estimatedNetProfitUsd || 0).toFixed(2)}
                        </strong>
                      </div>
                      <div style={{ width: '100%', height: '10px', backgroundColor: '#FFF0F2', borderRadius: '6px', overflow: 'hidden', marginBottom: '6px' }}>
                        <div style={{
                          width: `${meterRatioPct}%`,
                          height: '100%',
                          backgroundColor: withinCap ? '#2E7D32' : '#C62828',
                          borderRadius: '6px',
                          transition: 'width 0.3s ease'
                        }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#5C5454', fontWeight: 'bold' }}>
                        <span>
                          ${Number(box.totalAllInCostUsd || 0).toFixed(2)} / ${Number(box.maxAllowedCostUsd || 12.25).toFixed(2)} Max ({costPct.toFixed(1)}%)
                        </span>
                        <span style={{ color: '#8A797A', fontWeight: 'normal' }}>
                          Items: ${Number(box.totalWholesaleCostUsd || 0).toFixed(2)} • Ship: ${Number(box.consolidatedShippingUsd || 0).toFixed(2)} • Label: ${Number(box.customLabelCostUsd || 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 3 or 5 Curated Products Grid with Individual Wholesale Costs, Match Scores & Swap Dropdown */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px' }}>
                    {(box.items || []).map((item, slotIdx) => {
                      const swapKey = `${box._id}_${slotIdx}`;
                      const selectedReplacementId = selectedSlotSwapMap[swapKey] || String(item.productId || '');
                      const imgUrl = item.imageUrl && item.imageUrl.startsWith('//') ? `https:${item.imageUrl}` : item.imageUrl;

                      return (
                        <div key={swapKey} style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8C5C8', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '8px' }}>
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                              <span style={{ backgroundColor: '#5C5454', color: '#FFFFFF', padding: '2px 8px', borderRadius: '8px', fontSize: '0.68rem', fontFamily: 'sans-serif', fontWeight: 'bold' }}>
                                #{slotIdx + 1} • {item.ritualStep || 'Ritual Step'}
                              </span>
                              <span style={{ backgroundColor: '#FFF0F2', color: '#B38B8F', border: '1px solid #E8C5C8', padding: '2px 7px', borderRadius: '8px', fontSize: '0.68rem', fontFamily: 'sans-serif', fontWeight: 'bold' }}>
                                ✨ {item.matchScore || 92}% Fit
                              </span>
                            </div>

                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '6px' }}>
                              <div style={{ width: '44px', height: '44px', borderRadius: '8px', backgroundColor: '#FFF0F2', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #E8C5C8' }}>
                                {imgUrl ? (
                                  <img src={imgUrl} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                  <span style={{ fontSize: '0.65rem', color: '#B38B8F' }}>SKU</span>
                                )}
                              </div>
                              <div>
                                <strong style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.05rem', color: '#5C5454', display: 'block', lineHeight: '1.2' }}>
                                  {item.title}
                                </strong>
                                <span style={{ fontSize: '0.76rem', color: '#2E7D32', fontFamily: 'sans-serif', fontWeight: 'bold' }}>
                                  Wholesale: ${Number(item.wholesaleCostUsd || 0).toFixed(2)}
                                </span>
                                <span style={{ fontSize: '0.72rem', color: '#8A797A', fontFamily: 'sans-serif', marginLeft: '6px' }}>
                                  (Retail: ${Number(item.retailPriceUsd || 0).toFixed(2)})
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Swap Product Dropdown (Live 25% Cap Validation) */}
                          <div style={{ borderTop: '1px dashed #E8C5C8', paddingTop: '6px' }}>
                            <label style={{ display: 'block', fontSize: '0.68rem', color: '#8A797A', fontFamily: 'sans-serif', marginBottom: '3px' }}>
                              Swap Slot #{slotIdx + 1} Product (≤25% Cap Checked):
                            </label>
                            <select
                              disabled={updatingBoxId === box._id}
                              value={selectedReplacementId}
                              onChange={(e) => {
                                const newProdId = e.target.value;
                                setSelectedSlotSwapMap(prev => ({ ...prev, [swapKey]: newProdId }));
                                if (newProdId && newProdId !== String(item.productId)) {
                                  handleUpdateBoxSettings(box._id, {
                                    swapSlotIndex: slotIdx,
                                    replacementProductId: newProdId
                                  });
                                }
                              }}
                              style={{ width: '100%', padding: '5px 6px', borderRadius: '6px', border: '1px solid #E8C5C8', fontSize: '0.72rem', fontFamily: 'sans-serif', color: '#5C5454', backgroundColor: '#FFF9F9' }}
                            >
                              {compatibleCatalog.map(cp => {
                                const cpWholesale = Number(cp.wholesalePriceUsd || (cp.price ? cp.price / 6.5 : 2.50)).toFixed(2);
                                return (
                                  <option key={cp._id} value={cp._id}>
                                    {cp.title} (${cpWholesale} wholesale • {cp.ritualStep || 'Skincare'})
                                  </option>
                                );
                              })}
                            </select>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Box Bottom Action Bar: CJ Shipping Method, Custom Label Toggle, Re-Curate & Dispatch to CJ */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', backgroundColor: '#FFFFFF', padding: '12px 16px', borderRadius: '12px', border: '1px solid #E8C5C8' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 'bold', color: '#5C5454', fontFamily: 'sans-serif' }}>
                          ✈️ CJ Box Carrier:
                        </span>
                        <select
                          disabled={updatingBoxId === box._id}
                          value={box.selectedLogisticName || 'CJPacket Sensitive'}
                          onChange={(e) => handleUpdateBoxSettings(box._id, { selectedLogisticName: e.target.value })}
                          style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #B38B8F', backgroundColor: '#FFF0F2', color: '#5C5454', fontSize: '0.8rem', fontFamily: 'sans-serif', fontWeight: 'bold' }}
                        >
                          {CJ_CARRIER_OPTIONS.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                        <span style={{ fontSize: '0.76rem', color: '#8A797A', fontFamily: 'sans-serif' }}>
                          (${Number(box.consolidatedShippingUsd || 0).toFixed(2)} consolidated)
                        </span>
                      </div>

                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#5C5454', fontFamily: 'sans-serif', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          disabled={updatingBoxId === box._id}
                          checked={Boolean(box.customLabelConfig?.enabled)}
                          onChange={(e) =>
                            handleUpdateBoxSettings(box._id, {
                              customLabelConfig: {
                                ...(box.customLabelConfig || {}),
                                enabled: e.target.checked,
                                packagingName: box.customLabelConfig?.packagingName || "Susan's Rose-Gold Custom Box & Seal",
                                packagingCostUsd: e.target.checked ? Number(box.customLabelConfig?.packagingCostUsd || 0.65) : 0
                              }
                            })
                          }
                        />
                        <span>
                          🏷️ Custom Label ({box.customLabelConfig?.packagingName || "Susan's Rose-Gold Custom Box"} • +${Number(box.customLabelCostUsd || 0).toFixed(2)})
                        </span>
                      </label>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        disabled={curatingUserId === box.userId}
                        onClick={() => handleCurateSingleMemberBox(box.userId)}
                        style={{ backgroundColor: '#FFF9F9', border: '1px solid #E8C5C8', color: '#5C5454', padding: '8px 14px', borderRadius: '18px', fontFamily: "'Cormorant Garamond', serif", fontSize: '0.96rem', cursor: 'pointer' }}
                      >
                        {curatingUserId === box.userId ? '⏳ Re-Curating...' : '↺ Re-Curate Box'}
                      </button>

                      <button
                        type="button"
                        disabled={dispatchingBoxId === box._id}
                        onClick={() => handleDispatchBoxToCj(box)}
                        style={{
                          backgroundColor: box.status === 'DISPATCHED_TO_CJ' ? '#F6FBF7' : '#F2D4D7',
                          border: `1px solid ${box.status === 'DISPATCHED_TO_CJ' ? '#2E7D32' : '#B38B8F'}`,
                          color: box.status === 'DISPATCHED_TO_CJ' ? '#2E7D32' : '#5C5454',
                          padding: '9px 18px',
                          borderRadius: '20px',
                          fontFamily: "'Cormorant Garamond', serif",
                          fontSize: '1.05rem',
                          fontWeight: 'bold',
                          cursor: dispatchingBoxId === box._id ? 'not-allowed' : 'pointer'
                        }}
                      >
                        {dispatchingBoxId === box._id
                          ? '⏳ Dispatching to CJ...'
                          : box.status === 'DISPATCHED_TO_CJ'
                          ? `✓ Dispatched (${box.cjOrderId || 'Re-Dispatch'})`
                          : '📦 Approve & Dispatch Box to CJ ✧'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 3 — CJ Custom Labeling, Private Packaging & Shipping Rate Studio */}
      <div style={{ backgroundColor: '#FFFFFF', padding: '26px 28px', borderRadius: '20px', border: '1.5px solid #B38B8F', boxShadow: '0 8px 25px rgba(232, 197, 200, 0.16)', display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.85rem', color: '#5C5454', margin: 0 }}>
              🏷️ CJ Custom Labeling, Private Packaging & Shipping Rate Studio ✧
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.88rem', color: '#8A797A', fontFamily: 'sans-serif' }}>
              Configure CJ Dropshipping custom packaging (`queryPackagingProduct` / `queryCjPackagingProduct`) and Print-on-Demand (POD) branding (Logo URL, Brand Name, Custom Ritual Card message), then apply across your boutique catalog in 1 click.
            </p>
          </div>
          <span style={{ backgroundColor: '#FFF0F2', color: '#B38B8F', border: '1px solid #E8C5C8', padding: '4px 12px', borderRadius: '14px', fontSize: '0.78rem', fontWeight: 'bold', fontFamily: 'sans-serif' }}>
            {packagingOptions.length} CJ Packaging & POD Options Ready
          </span>
        </div>

        {/* Selectable CJ Custom Packaging Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '14px' }}>
          {packagingOptions.map((opt, idx) => {
            const isSelected = studioConfig.packagingName === opt.packagingName;
            return (
              <div
                key={opt.packagingVid || idx}
                onClick={() =>
                  setStudioConfig(prev => ({
                    ...prev,
                    packagingVid: opt.packagingVid || 'CJ-PKG-ROSEGOLD-BOX-01',
                    packagingName: opt.packagingName,
                    labelType: opt.labelType || 'CJ_CUSTOM_PACKAGING',
                    packagingCostUsd: Number(opt.packagingCostUsd || 0.65)
                  }))
                }
                style={{
                  backgroundColor: isSelected ? '#FFF0F2' : '#FFF9F9',
                  border: isSelected ? '2px solid #B38B8F' : '1px solid #E8C5C8',
                  borderRadius: '14px',
                  padding: '14px 16px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '8px'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <strong style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.2rem', color: '#5C5454' }}>
                      {isSelected ? '✓ ' : ''}{opt.packagingName}
                    </strong>
                    <span style={{ backgroundColor: '#FFFFFF', color: '#B38B8F', border: '1px solid #B38B8F', padding: '2px 8px', borderRadius: '10px', fontSize: '0.76rem', fontWeight: 'bold', fontFamily: 'sans-serif' }}>
                      +${Number(opt.packagingCostUsd || 0.65).toFixed(2)}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#736A6A', fontFamily: 'sans-serif', lineHeight: '1.45' }}>
                    {opt.description || `CJ SKU/VID: ${opt.packagingVid} (${opt.labelType})`}
                  </p>
                </div>
                <span style={{ fontSize: '0.72rem', color: '#8A797A', fontFamily: 'sans-serif', fontWeight: 'bold' }}>
                  VID: {opt.packagingVid} • {opt.labelType}
                </span>
              </div>
            );
          })}
        </div>

        {/* POD Branding & Shipping-Included Pricing Inputs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', backgroundColor: '#FFF9F9', padding: '16px 18px', borderRadius: '14px', border: '1px solid #E8C5C8' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 'bold', color: '#5C5454', fontFamily: 'sans-serif', marginBottom: '4px' }}>
              Brand Name on Custom Label:
            </label>
            <input
              type="text"
              value={studioConfig.customBrandText}
              onChange={(e) => setStudioConfig(prev => ({ ...prev, customBrandText: e.target.value }))}
              style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #E8C5C8', fontFamily: 'sans-serif', fontSize: '0.86rem', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 'bold', color: '#5C5454', fontFamily: 'sans-serif', marginBottom: '4px' }}>
              POD Logo URL (HTTPS):
            </label>
            <input
              type="url"
              value={studioConfig.logoUrl}
              onChange={(e) => setStudioConfig(prev => ({ ...prev, logoUrl: e.target.value }))}
              style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #E8C5C8', fontFamily: 'sans-serif', fontSize: '0.86rem', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 'bold', color: '#5C5454', fontFamily: 'sans-serif', marginBottom: '4px' }}>
              Custom Ritual Card Insert Message:
            </label>
            <input
              type="text"
              value={studioConfig.ritualCardMessage}
              onChange={(e) => setStudioConfig(prev => ({ ...prev, ritualCardMessage: e.target.value }))}
              style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #E8C5C8', fontFamily: 'sans-serif', fontSize: '0.86rem', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 'bold', color: '#5C5454', fontFamily: 'sans-serif', marginBottom: '4px' }}>
              Default Boutique CJ Shipping Carrier:
            </label>
            <select
              value={studioConfig.defaultLogisticName}
              onChange={(e) => setStudioConfig(prev => ({ ...prev, defaultLogisticName: e.target.value }))}
              style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #E8C5C8', backgroundColor: '#FFFFFF', fontFamily: 'sans-serif', fontSize: '0.86rem', color: '#5C5454' }}
            >
              {CJ_CARRIER_OPTIONS.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#5C5454', fontFamily: 'sans-serif', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={Boolean(studioConfig.enabled)}
                onChange={(e) => setStudioConfig(prev => ({ ...prev, enabled: e.target.checked }))}
              />
              <strong>Enable Custom Labeling Across Boutique</strong>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#5C5454', fontFamily: 'sans-serif', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={Boolean(studioConfig.shippingIncludedInPrice)}
                onChange={(e) => setStudioConfig(prev => ({ ...prev, shippingIncludedInPrice: e.target.checked }))}
              />
              <strong>Bake CJ Shipping into All Retail Prices</strong>
            </label>
          </div>

          <button
            type="button"
            disabled={isApplyingGlobalStudio}
            onClick={handleApplyStudioAcrossBoutique}
            style={{ backgroundColor: '#F2D4D7', border: '1px solid #B38B8F', color: '#5C5454', padding: '12px 24px', borderRadius: '24px', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.15rem', fontWeight: 'bold', cursor: isApplyingGlobalStudio ? 'not-allowed' : 'pointer' }}
          >
            {isApplyingGlobalStudio
              ? '⏳ Applying Custom Labeling & Recalculating...'
              : '🏷️ Apply Custom Labeling & Recalculate All Boutique Prices ✧'}
          </button>
        </div>
      </div>
    </div>
  );
};

const AdminAiAssistant = ({ onProductDeleted, onExecutiveAction, pendingPrompt, onClearPendingPrompt }) => {
  const defaultGreeting = {
    role: 'model',
    text: "Hello Susan ✧ I'm Odie, your Executive Boutique AI Assistant! My persistent Memory Bank is online, and I'm connected to your Profit-Protected Monthly Membership Boxes (≤25% cost cap), CJ Custom Labeling, live CJ shipping rates, boutique inventory, member blueprints, IONOS email, Central Time calendar, system diagnostics, and Stripe/CJ treasury. What would you like me to handle or remember for you today?"
  };

  const [messages, setMessages] = useState([defaultGreeting]);
  const [memories, setMemories] = useState([]);
  const [showMemoryBank, setShowMemoryBank] = useState(false);
  const [isLoadingMemory, setIsLoadingMemory] = useState(false);
  const [isSavingMemory, setIsSavingMemory] = useState(false);
  const [memoryForm, setMemoryForm] = useState({
    key: '',
    category: 'preference',
    content: '',
    pinned: true
  });
  const [memoryBanner, setMemoryBanner] = useState({ type: '', text: '' });
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = React.useRef(null);

  const quickActions = [
    { label: '🎁 Curate Monthly Boxes (≤25% Cap)', prompt: 'Odie, curate profit-protected monthly membership boxes for all paid members under the strict 25% cost cap and summarize each box cost and net profit.' },
    { label: '🏷️ Enable CJ Custom Labeling', prompt: "Odie, enable CJ custom labeling with Susan's Rose-Gold Custom Box & Seal across the boutique catalog and recalculate retail prices." },
    { label: '✈️ Update CJ Shipping & Prices', prompt: 'Odie, update our boutique CJ shipping method to CJPacket Sensitive with shipping included in retail prices across all products.' },
    { label: '📈 Site Analytics & Top Products', prompt: 'Odie, analyze my site traffic, top viewed and highest-converting products, and tell me which products I should curate for members today.' },
    { label: '🧠 Teach Odie a Rule', prompt: 'Odie, remember this business rule: Always include a complimentary luxury sample note for Radiance Elite members.' },
    { label: '🧪 Run 6-Point Diagnostics', prompt: 'Odie, run the full 6-point system diagnostics suite and tell me if every subsystem is healthy.' },
    { label: '💸 Check Stripe & CJ Balances', prompt: 'Odie, check my live Stripe account balance, CJ Dropshipping wallet balance, and summarize my Past, Present, and Future orders.' },
    { label: '🏦 Stripe Money Dump (Keep CJ Reserve)', prompt: 'Odie, execute a Stripe money dump of my available balance to the bank, reserving enough for active unshipped CJ orders.' },
    { label: '💳 Top Up CJ Wallet ($100 Card)', prompt: 'Odie, top up my CJ Dropshipping Wallet Reserve with $100 using my bank card and automatically pay any waiting CJ orders.' },
    { label: '📦 Move Stripe Funds to CJ', prompt: 'Odie, move the wholesale funds needed for my active orders from Stripe to CJ Dropshipping and pay any open CJ orders.' },
    { label: '🔄 Sync CJ Order Tracking', prompt: 'Odie, sync my CJ Dropshipping orders and tell me if any Present orders have new tracking numbers.' },
    { label: '➕ Add Custom Product', prompt: 'Odie, add a new product called "Rosewater Luminous Mist" priced at $48 with tags "skincare, hydration, mist" and a short description.' },
    { label: '✨ Curate for Member', prompt: 'Odie, recommend the best hydrating product from our inventory to our newest member with a warm personal note from me.' },
    { label: '📅 Schedule Consultation', prompt: 'Odie, schedule a 1-on-1 consultation with our newest member for tomorrow at 2:00 PM CT with notes "Seasonal Skincare Check-In".' },
    { label: '🔔 Send Consultation Reminder', prompt: 'Odie, send an immediate consultation reminder email for my next upcoming appointment.' }
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchOdieMemoryAndHistory = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    setIsLoadingMemory(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/odie/memory`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.memories)) {
          setMemories(data.memories);
        }
        if (Array.isArray(data.history) && data.history.length > 0) {
          const restored = data.history.map(h => ({
            role: h.role === 'user' ? 'user' : 'model',
            text: h.text,
            actionsTaken: h.actionsTaken || []
          }));
          setMessages([defaultGreeting, ...restored]);
        }
      }
    } catch (err) {
      console.error('Failed to load Odie memory bank:', err);
    }
    setIsLoadingMemory(false);
  };

  useEffect(() => {
    fetchOdieMemoryAndHistory();
    // eslint-disable-next-line
  }, []);

  const handleSaveManualMemory = async (e) => {
    e.preventDefault();
    if (!memoryForm.content.trim()) return;
    setIsSavingMemory(true);
    setMemoryBanner({ type: '', text: '' });

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/admin/odie/memory`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          key: memoryForm.key.trim() || 'Susan Executive Note',
          category: memoryForm.category,
          content: memoryForm.content.trim(),
          pinned: memoryForm.pinned
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (Array.isArray(data.memories)) setMemories(data.memories);
        setMemoryForm({ key: '', category: 'preference', content: '', pinned: true });
        setMemoryBanner({ type: 'success', text: data.message || 'Saved to Odie Memory Bank! 🧠✧' });
        setTimeout(() => setMemoryBanner({ type: '', text: '' }), 4000);
      } else {
        setMemoryBanner({ type: 'error', text: data.error || 'Failed to save memory.' });
      }
    } catch (err) {
      setMemoryBanner({ type: 'error', text: 'Network error while saving memory.' });
    }
    setIsSavingMemory(false);
  };

  const handleDeleteMemory = async (memoryId) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/odie/memory/${memoryId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.memories)) {
        setMemories(data.memories);
      }
    } catch (err) {
      console.error('Failed to delete Odie memory:', err);
    }
  };

  const handleClearChatHistory = async () => {
    if (!window.confirm("Clear Odie's conversation log? (Odie's long-term Memory Bank facts will remain safely stored.)")) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/odie/history`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setMessages([defaultGreeting]);
        setMemoryBanner({
          type: 'success',
          text: "Cleared Odie's chat log while keeping your long-term Memory Bank intact ✧"
        });
        setTimeout(() => setMemoryBanner({ type: '', text: '' }), 4000);
      }
    } catch (err) {
      console.error('Failed to clear Odie history:', err);
    }
  };

  const dispatchPromptToOdie = async (promptText) => {
    const trimmedInput = String(promptText || '').trim();
    if (!trimmedInput || isTyping) return;

    const userMessage = { role: 'user', text: trimmedInput };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsTyping(true);

    // Exclude the initial greeting and any prior error bubbles from multi-turn history
    const history = messages
      .slice(1)
      .filter(msg => !msg.isError && msg.text && !String(msg.text).startsWith('⚠️'))
      .map(({ role, text }) => ({ role, text }));

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/admin/ai-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message: trimmedInput, history })
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (Array.isArray(data.memories)) {
          setMemories(data.memories);
        }
        setMessages(prev => [
          ...prev,
          {
            role: 'model',
            text: data.response || "I'm right here, Susan ✧ How may Odie help?",
            actionsTaken: data.actionsTaken || []
          }
        ]);
        if (data.deletedProductId && onProductDeleted) {
          onProductDeleted(data.deletedProductId);
        }
        if (onExecutiveAction && (
          (Array.isArray(data.actionsTaken) && data.actionsTaken.length > 0) ||
          data.addedProduct ||
          data.updatedProduct ||
          data.deletedProductId ||
          data.sentEmailLog ||
          data.curatedRecommendation ||
          data.scheduledAppointment ||
          data.remindedAppointmentId ||
          data.financialTelemetry ||
          data.updatedOrder ||
          data.savedMemory ||
          data.diagnosticsReport ||
          data.stripeMoneyDumpResult ||
          data.stripeToCjResult ||
          data.siteAnalytics ||
          data.reclassifiedProducts ||
          data.curatedMonthlyBox ||
          data.monthlyBoxesTelemetry ||
          data.updatedMonthlyBox ||
          data.dispatchedMonthlyBox ||
          data.customLabelResult
        )) {
          onExecutiveAction(data);
        }
      } else {
        setMessages(prev => [
          ...prev,
          { role: 'model', text: '⚠️ Odie Connection failed: ' + (data.error || 'Unknown error'), isError: true }
        ]);
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [
        ...prev,
        { role: 'model', text: '⚠️ Network error communicating with Odie.', isError: true }
      ]);
    }
    setIsTyping(false);
  };

  const handleSend = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    await dispatchPromptToOdie(input);
  };

  useEffect(() => {
    if (pendingPrompt && String(pendingPrompt).trim() && !isTyping) {
      const toRun = String(pendingPrompt).trim();
      if (onClearPendingPrompt) onClearPendingPrompt();
      dispatchPromptToOdie(toRun);
    }
    // eslint-disable-next-line
  }, [pendingPrompt]);

  const categoryBadgeColor = (cat) => {
    switch (cat) {
      case 'business_rule': return { bg: '#FFF0F2', color: '#B38B8F', label: 'Business Rule' };
      case 'vip_client': return { bg: '#FFF8E7', color: '#B26A00', label: 'VIP Client' };
      case 'financial_goal': return { bg: '#F6FBF7', color: '#2E7D32', label: 'Treasury & Finance' };
      case 'preference': return { bg: '#F4F0FF', color: '#5E35B1', label: 'Susan Preference' };
      default: return { bg: '#F7F2F2', color: '#736A6A', label: 'General Note' };
    }
  };

  return (
    <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.75)', borderRadius: '15px', border: '1px solid #E8C5C8', display: 'flex', flexDirection: 'column', minHeight: '680px', animation: 'fadeIn 0.5s ease', boxShadow: '0 10px 30px rgba(232, 197, 200, 0.15)' }}>
      {/* Odie Header Bar */}
      <div style={{ padding: '18px 22px', borderBottom: '1px solid #E8C5C8', backgroundColor: '#FFFFFF', borderRadius: '15px 15px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#FFF0F2', border: '1.5px solid #B38B8F', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.7rem' }}>
            🐾
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.9rem', color: '#5C5454', margin: 0 }}>
                Odie — Susan's Executive Boutique AI
              </h2>
              <span style={{ backgroundColor: '#F6FBF7', color: '#2E7D32', border: '1px solid #A5D6A7', borderRadius: '12px', padding: '2px 10px', fontSize: '0.76rem', fontWeight: 'bold', fontFamily: 'sans-serif' }}>
                🧠 {memories.length} Persistent Memories Active
              </span>
            </div>
            <p style={{ margin: '2px 0 0 0', color: '#8A797A', fontSize: '0.86rem', fontFamily: 'sans-serif' }}>
              21 Live Tools: Monthly Boxes (≤25% Cap) • CJ Custom Labeling & Shipping • Site Analytics • Memory Bank • 6-Point Diagnostics • Treasury
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setShowMemoryBank(!showMemoryBank)}
            style={{
              backgroundColor: showMemoryBank ? '#B38B8F' : '#FFF0F2',
              color: showMemoryBank ? '#FFFFFF' : '#5C5454',
              border: '1px solid #B38B8F',
              borderRadius: '20px',
              padding: '8px 16px',
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: '1.05rem',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            {showMemoryBank ? '✕ Close Memory Bank' : `🧠 Odie Memory Bank (${memories.length})`}
          </button>

          <button
            type="button"
            onClick={handleClearChatHistory}
            style={{
              backgroundColor: '#FFFFFF',
              color: '#8A797A',
              border: '1px solid #E8C5C8',
              borderRadius: '20px',
              padding: '8px 14px',
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: '1rem',
              cursor: 'pointer'
            }}
          >
            🧹 Clear Chat Log
          </button>
        </div>
      </div>

      {/* Collapsible Odie Persistent Memory Bank Drawer */}
      {showMemoryBank && (
        <div style={{ padding: '20px 22px', backgroundColor: '#FFF9F9', borderBottom: '1px solid #E8C5C8', animation: 'fadeIn 0.3s ease' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
            <div>
              <strong style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.45rem', color: '#5C5454' }}>
                🧠 Odie's Long-Term Memory Bank (Stored in MongoDB)
              </strong>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.85rem', color: '#8A797A', fontFamily: 'sans-serif' }}>
                Odie automatically recalls these facts in every conversation. You can also tell Odie in chat: <em>"Odie, remember that..."</em>
              </p>
            </div>
            <button
              type="button"
              onClick={fetchOdieMemoryAndHistory}
              disabled={isLoadingMemory}
              style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8C5C8', borderRadius: '16px', padding: '6px 12px', fontSize: '0.85rem', color: '#5C5454', cursor: 'pointer' }}
            >
              {isLoadingMemory ? '⏳ Syncing...' : '↻ Refresh Memories'}
            </button>
          </div>

          {memoryBanner.text && (
            <div style={{
              marginBottom: '12px',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '0.9rem',
              fontFamily: 'sans-serif',
              backgroundColor: memoryBanner.type === 'success' ? '#F6FBF7' : '#FFF5F5',
              color: memoryBanner.type === 'success' ? '#2E7D32' : '#C62828',
              border: `1px solid ${memoryBanner.type === 'success' ? '#A5D6A7' : '#FFCDD2'}`
            }}>
              {memoryBanner.text}
            </div>
          )}

          {/* Add Manual Memory Form */}
          <form onSubmit={handleSaveManualMemory} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px', backgroundColor: '#FFFFFF', padding: '14px', borderRadius: '12px', border: '1px solid #E8C5C8' }}>
            <input
              type="text"
              placeholder="Memory Title (e.g. VIP Packaging Rule)"
              value={memoryForm.key}
              onChange={(e) => setMemoryForm({ ...memoryForm, key: e.target.value })}
              style={{ flex: '1 1 180px', padding: '9px 12px', borderRadius: '8px', border: '1px solid #E8C5C8', fontFamily: 'sans-serif', fontSize: '0.88rem' }}
            />
            <select
              value={memoryForm.category}
              onChange={(e) => setMemoryForm({ ...memoryForm, category: e.target.value })}
              style={{ padding: '9px 12px', borderRadius: '8px', border: '1px solid #E8C5C8', fontFamily: 'sans-serif', fontSize: '0.88rem', color: '#5C5454', backgroundColor: '#FFF9F9' }}
            >
              <option value="preference">Susan Preference</option>
              <option value="business_rule">Business Rule</option>
              <option value="vip_client">VIP Client Note</option>
              <option value="financial_goal">Treasury & Finance</option>
              <option value="general">General Note</option>
            </select>
            <input
              required
              type="text"
              placeholder="What should Odie permanently remember?"
              value={memoryForm.content}
              onChange={(e) => setMemoryForm({ ...memoryForm, content: e.target.value })}
              style={{ flex: '2 1 280px', padding: '9px 12px', borderRadius: '8px', border: '1px solid #E8C5C8', fontFamily: 'sans-serif', fontSize: '0.88rem' }}
            />
            <button
              type="submit"
              disabled={isSavingMemory}
              style={{ backgroundColor: '#F2D4D7', border: '1px solid #B38B8F', color: '#5C5454', padding: '9px 18px', borderRadius: '18px', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.05rem', fontWeight: 'bold', cursor: isSavingMemory ? 'not-allowed' : 'pointer' }}
            >
              {isSavingMemory ? 'Saving...' : '+ Save to Odie Memory ✧'}
            </button>
          </form>

          {/* Stored Memories Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '10px', maxHeight: '210px', overflowY: 'auto' }}>
            {memories.map((mem) => {
              const badge = categoryBadgeColor(mem.category);
              return (
                <div key={mem._id || mem.key} style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8C5C8', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', marginBottom: '6px', paddingRight: '22px' }}>
                      <strong style={{ color: '#5C5454', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.1rem' }}>
                        {mem.pinned ? '📌 ' : ''}{mem.key}
                      </strong>
                      <span style={{ backgroundColor: badge.bg, color: badge.color, padding: '2px 8px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 'bold', fontFamily: 'sans-serif' }}>
                        {badge.label}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#736A6A', fontFamily: 'sans-serif', lineHeight: '1.45' }}>
                      {mem.content}
                    </p>
                  </div>
                  {mem._id && (
                    <button
                      type="button"
                      title="Forget this memory"
                      onClick={() => handleDeleteMemory(mem._id)}
                      style={{ position: 'absolute', top: '8px', right: '8px', background: 'none', border: 'none', color: '#A89999', cursor: 'pointer', fontSize: '0.85rem' }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick-Action Executive Prompt Bar */}
      <div style={{ padding: '10px 18px', backgroundColor: '#FFF9F9', borderBottom: '1px solid #E8C5C8', display: 'flex', gap: '8px', overflowX: 'auto' }}>
        {quickActions.map((qa, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setInput(qa.prompt)}
            style={{
              whiteSpace: 'nowrap', backgroundColor: '#FFFFFF', border: '1px solid #E8C5C8',
              borderRadius: '16px', padding: '6px 12px', fontSize: '0.82rem', color: '#5C5454',
              cursor: 'pointer', fontFamily: 'sans-serif', transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#F2D4D7'; e.currentTarget.style.borderColor = '#B38B8F'; }}
            onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#FFFFFF'; e.currentTarget.style.borderColor = '#E8C5C8'; }}
          >
            {qa.label}
          </button>
        ))}
      </div>

      {/* Chat Messages Viewport */}
      <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '15px', maxHeight: showMemoryBank ? '340px' : '500px' }}>
        {messages.map((msg, idx) => (
          <div key={idx} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{ 
              maxWidth: '78%', 
              padding: '15px', 
              borderRadius: msg.role === 'user' ? '20px 20px 0 20px' : '20px 20px 20px 0', 
              backgroundColor: msg.role === 'user' ? '#B38B8F' : '#FFFFFF', 
              color: msg.role === 'user' ? '#FFFFFF' : '#5C5454', 
              border: msg.role === 'user' ? 'none' : '1px solid #E8C5C8',
              boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
              fontFamily: 'sans-serif',
              lineHeight: '1.5',
              whiteSpace: 'pre-wrap'
            }}>
              {msg.role !== 'user' && (
                <div style={{ fontSize: '0.76rem', fontWeight: 'bold', color: '#B38B8F', marginBottom: '4px', letterSpacing: '0.4px' }}>
                  🐾 ODIE • EXECUTIVE ASSISTANT
                </div>
              )}
              {Array.isArray(msg.actionsTaken) && msg.actionsTaken.length > 0 && (
                <div style={{ marginBottom: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {msg.actionsTaken.map((act, i) => (
                    <span key={i} style={{ backgroundColor: '#F6FBF7', color: '#2E7D32', border: '1px solid #A5D6A7', borderRadius: '10px', padding: '2px 8px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                      ✓ Odie Executed: {act}
                    </span>
                  ))}
                </div>
              )}
              {msg.text}
            </div>
          </div>
        ))}
        {isTyping && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ padding: '15px', borderRadius: '20px 20px 20px 0', backgroundColor: '#FFFFFF', border: '1px solid #E8C5C8', color: '#8A797A', fontStyle: 'italic' }}>
              🐾 Odie is working on your request, Susan...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSend} style={{ padding: '18px 20px', backgroundColor: '#FFFFFF', borderTop: '1px solid #E8C5C8', borderRadius: '0 0 15px 15px', display: 'flex', gap: '10px' }}>
        <input 
          type="text" 
          placeholder="Ask Odie to curate monthly boxes (≤25% cap), enable CJ custom labeling, update shipping rates, or manage products..." 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isTyping}
          style={{ flex: 1, padding: '15px', borderRadius: '30px', border: '1px solid #E8C5C8', outline: 'none', fontFamily: 'sans-serif', fontSize: '1rem', backgroundColor: '#FFF9F9' }}
        />
        <button type="submit" disabled={isTyping || !input.trim()} style={{ backgroundColor: '#F2D4D7', border: '1px solid #B38B8F', borderRadius: '30px', padding: '0 25px', color: '#5C5454', cursor: (isTyping || !input.trim()) ? 'not-allowed' : 'pointer', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.2rem', fontWeight: 'bold', transition: 'all 0.3s ease' }}>
          Ask Odie ✧
        </button>
      </form>
    </div>
  );
};

const AdminIonosInbox = ({ onLoadReplyInComposer, onAskOdie, refreshTrigger = 0 }) => {
  const [emails, setEmails] = useState([]);
  const [counts, setCounts] = useState({ total: 0, unread: 0, starred: 0, replied: 0, archived: 0 });
  const [imapTelemetry, setImapTelemetry] = useState({
    host: 'imap.ionos.com',
    port: 993,
    activeUser: 'Susan.Coke@SusansBeautyConsulting.com',
    connected: false,
    lastSyncAt: null,
    lastSyncStatus: 'IDLE',
    lastError: null
  });
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });
  const [inlineReplyBody, setInlineReplyBody] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);

  const fetchInboxEmails = async ({ status = statusFilter, search = searchQuery, sync = false, silent = false } = {}) => {
    if (!silent) setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        status,
        search: search.trim(),
        limit: '50'
      });
      if (sync) params.set('sync', 'true');

      const res = await fetch(`${API_BASE_URL}/api/admin/inbox/emails?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const list = Array.isArray(data.emails) ? data.emails : [];
        setEmails(list);
        if (data.counts) setCounts(data.counts);
        if (data.imapTelemetry) setImapTelemetry(data.imapTelemetry);

        if (selectedEmail) {
          const updatedSelected = list.find(e => e._id === selectedEmail._id);
          if (updatedSelected) {
            setSelectedEmail(updatedSelected);
          } else if (list.length > 0) {
            setSelectedEmail(list[0]);
          } else {
            setSelectedEmail(null);
          }
        } else if (list.length > 0) {
          setSelectedEmail(list[0]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch IONOS inbox emails:', err);
    }
    if (!silent) setIsLoading(false);
  };

  useEffect(() => {
    fetchInboxEmails({ status: statusFilter, search: searchQuery });
  }, [statusFilter, refreshTrigger]);

  const handleManualSync = async () => {
    setIsSyncing(true);
    setFeedback({ type: '', text: '' });
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/admin/inbox/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ maxFetch: 50 })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (Array.isArray(data.emails)) setEmails(data.emails);
        if (data.counts) setCounts(data.counts);
        if (data.imapTelemetry) setImapTelemetry(data.imapTelemetry);
        const isErr = data.syncResult?.status === 'error';
        setFeedback({
          type: isErr ? 'error' : 'success',
          text: data.message || (isErr ? data.syncResult?.error : 'Synced IONOS Inbox ✧')
        });
        await fetchInboxEmails({ status: statusFilter, search: searchQuery, silent: true });
      } else {
        setFeedback({ type: 'error', text: data.error || 'Could not sync IONOS IMAP inbox.' });
      }
    } catch (err) {
      setFeedback({ type: 'error', text: 'Network error while syncing IONOS inbox.' });
    }
    setIsSyncing(false);
  };

  const handleUpdateEmailFlags = async (emailId, patchBody, e) => {
    if (e) e.stopPropagation();
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/admin/inbox/emails/${emailId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(patchBody)
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.email) {
        if (data.counts) setCounts(data.counts);
        setEmails(prev =>
          prev
            .map(item => (item._id === emailId ? data.email : item))
            .filter(item => {
              if (statusFilter !== 'archived' && item.isArchived) return false;
              if (statusFilter === 'archived' && !item.isArchived) return false;
              if (statusFilter === 'unread' && item.isRead) return false;
              if (statusFilter === 'starred' && !item.isStarred) return false;
              return true;
            })
        );
        if (selectedEmail && selectedEmail._id === emailId) {
          setSelectedEmail(data.email);
        }
      }
    } catch (err) {
      console.error('Failed to update email flags:', err);
    }
  };

  const handleDeleteOrArchiveEmail = async (emailId, permanent = false, e) => {
    if (e) e.stopPropagation();
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `${API_BASE_URL}/api/admin/inbox/emails/${emailId}${permanent ? '?permanent=true' : ''}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (data.counts) setCounts(data.counts);
        setEmails(prev => prev.filter(item => item._id !== emailId));
        if (selectedEmail && selectedEmail._id === emailId) {
          setSelectedEmail(null);
        }
        setFeedback({ type: 'success', text: data.message || 'Email updated.' });
      }
    } catch (err) {
      console.error('Failed to delete/archive email:', err);
    }
  };

  const handleSelectEmail = (emailObj) => {
    setSelectedEmail(emailObj);
    setInlineReplyBody('');
    if (!emailObj.isRead) {
      handleUpdateEmailFlags(emailObj._id, { isRead: true });
    }
  };

  const handleSendInlineReply = async (e) => {
    e.preventDefault();
    if (!selectedEmail || !inlineReplyBody.trim()) return;
    setIsSendingReply(true);
    setFeedback({ type: '', text: '' });
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/admin/inbox/emails/${selectedEmail._id}/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          body: inlineReplyBody.trim()
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setInlineReplyBody('');
        if (data.counts) setCounts(data.counts);
        if (data.email) {
          setSelectedEmail(data.email);
          setEmails(prev => prev.map(item => (item._id === data.email._id ? data.email : item)));
        }
        setFeedback({
          type: 'success',
          text: data.message || `Reply dispatched to ${selectedEmail.fromEmail} ✧`
        });
      } else {
        setFeedback({ type: 'error', text: data.error || 'Failed to dispatch reply.' });
      }
    } catch (err) {
      setFeedback({ type: 'error', text: 'Network error while sending reply.' });
    }
    setIsSendingReply(false);
  };

  const filterOptions = [
    { key: 'all', label: `All Mail (${counts.total || 0})` },
    { key: 'unread', label: `Unread (${counts.unread || 0})` },
    { key: 'starred', label: `★ Starred (${counts.starred || 0})` },
    { key: 'replied', label: `↩ Replied (${counts.replied || 0})` },
    { key: 'archived', label: `🗄️ Archived (${counts.archived || 0})` }
  ];

  return (
    <div style={{ backgroundColor: '#FFFFFF', padding: '28px', borderRadius: '20px', border: '1px solid #E8C5C8', boxShadow: '0 10px 30px rgba(232, 197, 200, 0.16)', marginBottom: '30px' }}>
      {/* Top Command Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', borderBottom: '1px solid #F2D4D7', paddingBottom: '18px', marginBottom: '18px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", color: '#5C5454', margin: 0, fontSize: '2.1rem' }}>
              📥 IONOS Live Email Inbox
            </h2>
            <span style={{ backgroundColor: counts.unread > 0 ? '#B38B8F' : '#F6FBF7', color: counts.unread > 0 ? '#FFFFFF' : '#2E7D32', border: `1px solid ${counts.unread > 0 ? '#B38B8F' : '#A5D6A7'}`, borderRadius: '20px', padding: '4px 12px', fontSize: '0.82rem', fontWeight: 'bold', fontFamily: 'sans-serif' }}>
              {counts.unread > 0 ? `${counts.unread} Unread` : '✓ All Caught Up'}
            </span>
            <span style={{ backgroundColor: '#FFF9F9', color: '#736A6A', border: '1px solid #E8C5C8', borderRadius: '20px', padding: '4px 12px', fontSize: '0.78rem', fontFamily: 'sans-serif' }}>
              {imapTelemetry.activeUser || 'Susan.Coke@SusansBeautyConsulting.com'} • {imapTelemetry.host || 'imap.ionos.com'}:{imapTelemetry.port || 993}
            </span>
          </div>
          <p style={{ margin: '6px 0 0 0', fontSize: '0.85rem', color: '#8A797A', fontFamily: 'sans-serif' }}>
            {imapTelemetry.lastSyncAt
              ? `Last synced: ${new Date(imapTelemetry.lastSyncAt).toLocaleString()} (${imapTelemetry.lastSyncStatus})`
              : 'Auto-syncs every 2 minutes over TLS port 993 with your IONOS mailbox'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            onClick={handleManualSync}
            disabled={isSyncing}
            style={{ backgroundColor: '#F2D4D7', color: '#5C5454', border: '1px solid #B38B8F', borderRadius: '22px', padding: '10px 18px', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.05rem', fontWeight: 'bold', cursor: isSyncing ? 'not-allowed' : 'pointer', transition: 'all 0.2s ease' }}
          >
            {isSyncing ? '🔄 Syncing imap.ionos.com:993...' : '🔄 Sync IONOS Mail Now'}
          </button>
          {onAskOdie && (
            <button
              type="button"
              onClick={() => onAskOdie('Please sync my incoming IONOS email inbox and summarize my unread messages.')}
              style={{ backgroundColor: '#FFF0F2', color: '#5C5454', border: '1px solid #E8C5C8', borderRadius: '22px', padding: '10px 16px', fontFamily: "'Cormorant Garamond', serif", fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer' }}
            >
              🐾 Ask Odie to Read Inbox
            </button>
          )}
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback.text && (
        <div style={{
          marginBottom: '16px',
          padding: '11px 16px',
          borderRadius: '10px',
          fontFamily: 'sans-serif',
          fontSize: '0.9rem',
          backgroundColor: feedback.type === 'error' ? '#FFF5F5' : '#F6FBF7',
          color: feedback.type === 'error' ? '#C62828' : '#2E7D32',
          border: `1px solid ${feedback.type === 'error' ? '#FFCDD2' : '#A5D6A7'}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>{feedback.text}</span>
          <button
            type="button"
            onClick={() => setFeedback({ type: '', text: '' })}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontWeight: 'bold' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Filter Pills & Search Input */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '18px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {filterOptions.map(opt => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setStatusFilter(opt.key)}
              style={{
                padding: '7px 14px',
                borderRadius: '18px',
                border: statusFilter === opt.key ? '1.5px solid #B38B8F' : '1px solid #E8C5C8',
                backgroundColor: statusFilter === opt.key ? '#F2D4D7' : '#FFF9F9',
                color: '#5C5454',
                fontFamily: 'sans-serif',
                fontSize: '0.83rem',
                fontWeight: statusFilter === opt.key ? 'bold' : 'normal',
                cursor: 'pointer'
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            fetchInboxEmails({ status: statusFilter, search: searchQuery });
          }}
          style={{ display: 'flex', gap: '8px', flex: '1 1 280px', maxWidth: '420px' }}
        >
          <input
            type="text"
            placeholder="Search sender, subject, or message..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ flex: 1, padding: '8px 14px', borderRadius: '18px', border: '1px solid #E8C5C8', backgroundColor: '#FFF9F9', fontFamily: 'sans-serif', fontSize: '0.88rem', outline: 'none' }}
          />
          <button
            type="submit"
            style={{ padding: '8px 15px', borderRadius: '18px', border: '1px solid #B38B8F', backgroundColor: '#FFF0F2', color: '#5C5454', fontFamily: 'sans-serif', fontSize: '0.84rem', fontWeight: 'bold', cursor: 'pointer' }}
          >
            Search
          </button>
        </form>
      </div>

      {/* Dual-Pane Split View: Left Message List + Right Message Reader & Quick Reply */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(290px, 380px) 1fr', gap: '20px', alignItems: 'start' }}>
        {/* Left Pane: Incoming Email List */}
        <div style={{ border: '1px solid #E8C5C8', borderRadius: '15px', backgroundColor: '#FFF9F9', maxHeight: '560px', overflowY: 'auto' }}>
          {isLoading ? (
            <div style={{ padding: '35px 20px', textAlign: 'center', color: '#8A797A', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.2rem', fontStyle: 'italic' }}>
              Loading incoming IONOS messages...
            </div>
          ) : emails.length === 0 ? (
            <div style={{ padding: '35px 20px', textAlign: 'center', color: '#8A797A' }}>
              <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.25rem', fontStyle: 'italic', margin: '0 0 8px 0' }}>
                No incoming emails in this view yet.
              </p>
              <p style={{ fontFamily: 'sans-serif', fontSize: '0.82rem', margin: 0 }}>
                Click "🔄 Sync IONOS Mail Now" to pull messages from imap.ionos.com:993.
              </p>
            </div>
          ) : (
            emails.map(item => {
              const isSelected = selectedEmail && selectedEmail._id === item._id;
              return (
                <div
                  key={item._id}
                  onClick={() => handleSelectEmail(item)}
                  style={{
                    padding: '14px 16px',
                    borderBottom: '1px solid rgba(232, 197, 200, 0.5)',
                    backgroundColor: isSelected ? '#FFF0F2' : (item.isRead ? '#FFFFFF' : '#FFF9F9'),
                    borderLeft: isSelected ? '4px solid #B38B8F' : '4px solid transparent',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
                      {!item.isRead && (
                        <span style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: '#B38B8F', flexShrink: 0 }} title="Unread" />
                      )}
                      <button
                        type="button"
                        onClick={(e) => handleUpdateEmailFlags(item._id, { isStarred: !item.isStarred }, e)}
                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: item.isStarred ? '#D4AF37' : '#C8B8B9', fontSize: '1rem', lineHeight: 1 }}
                        title={item.isStarred ? 'Unstar' : 'Star'}
                      >
                        {item.isStarred ? '★' : '☆'}
                      </button>
                      <span style={{ fontFamily: 'sans-serif', fontSize: '0.9rem', fontWeight: item.isRead ? '600' : '800', color: '#5C5454', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.fromName || item.fromEmail}
                      </span>
                    </div>
                    <span style={{ fontFamily: 'sans-serif', fontSize: '0.74rem', color: '#A89999', flexShrink: 0 }}>
                      {item.receivedAt ? new Date(item.receivedAt).toLocaleDateString() : ''}
                    </span>
                  </div>

                  <div style={{ fontFamily: 'sans-serif', fontSize: '0.86rem', fontWeight: item.isRead ? 'normal' : 'bold', color: '#5C5454', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.subject || '(No Subject)'}
                  </div>

                  <div style={{ fontFamily: 'sans-serif', fontSize: '0.78rem', color: '#8A797A', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: '1.35' }}>
                    {item.snippet || item.textBody || 'No text preview'}
                  </div>

                  {item.repliedAt && (
                    <div style={{ marginTop: '6px' }}>
                      <span style={{ display: 'inline-block', backgroundColor: '#F6FBF7', color: '#2E7D32', border: '1px solid #A5D6A7', borderRadius: '10px', padding: '1px 8px', fontSize: '0.68rem', fontFamily: 'sans-serif', fontWeight: 'bold' }}>
                        ↩ Replied {new Date(item.repliedAt).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Right Pane: Selected Email Reader & Threaded Reply Studio */}
        <div style={{ border: '1px solid #E8C5C8', borderRadius: '15px', backgroundColor: '#FFFFFF', padding: '22px', minHeight: '420px' }}>
          {!selectedEmail ? (
            <div style={{ height: '360px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#8A797A', textAlign: 'center' }}>
              <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.5rem', fontStyle: 'italic', margin: '0 0 8px 0' }}>
                Select an incoming email to read & reply ✧
              </p>
              <p style={{ fontFamily: 'sans-serif', fontSize: '0.86rem', margin: 0 }}>
                All emails sent to Susan.Coke@SusansBeautyConsulting.com appear here automatically.
              </p>
            </div>
          ) : (
            <div>
              {/* Email Reader Header & Action Toolbar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid #F2D4D7', paddingBottom: '14px', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.65rem', color: '#5C5454', margin: '0 0 6px 0' }}>
                    {selectedEmail.subject || '(No Subject)'}
                  </h3>
                  <div style={{ fontFamily: 'sans-serif', fontSize: '0.86rem', color: '#736A6A', lineHeight: '1.5' }}>
                    <div>
                      <strong>From:</strong> {selectedEmail.fromName ? `${selectedEmail.fromName} ` : ''}&lt;{selectedEmail.fromEmail}&gt;
                    </div>
                    <div>
                      <strong>To:</strong> {selectedEmail.to || 'Susan.Coke@SusansBeautyConsulting.com'} •{' '}
                      <span>{selectedEmail.receivedAt ? new Date(selectedEmail.receivedAt).toLocaleString() : ''}</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => handleUpdateEmailFlags(selectedEmail._id, { isRead: !selectedEmail.isRead })}
                    style={{ padding: '6px 12px', borderRadius: '14px', border: '1px solid #E8C5C8', backgroundColor: '#FFF9F9', color: '#5C5454', fontFamily: 'sans-serif', fontSize: '0.78rem', cursor: 'pointer' }}
                  >
                    {selectedEmail.isRead ? '● Mark Unread' : '✓ Mark Read'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateEmailFlags(selectedEmail._id, { isStarred: !selectedEmail.isStarred })}
                    style={{ padding: '6px 12px', borderRadius: '14px', border: '1px solid #E8C5C8', backgroundColor: '#FFF9F9', color: '#5C5454', fontFamily: 'sans-serif', fontSize: '0.78rem', cursor: 'pointer' }}
                  >
                    {selectedEmail.isStarred ? '★ Starred' : '☆ Star'}
                  </button>
                  {onLoadReplyInComposer && (
                    <button
                      type="button"
                      onClick={() => onLoadReplyInComposer(selectedEmail)}
                      style={{ padding: '6px 12px', borderRadius: '14px', border: '1px solid #B38B8F', backgroundColor: '#FFF0F2', color: '#5C5454', fontFamily: 'sans-serif', fontSize: '0.78rem', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                      ↩ Open in Full Composer
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDeleteOrArchiveEmail(selectedEmail._id, false)}
                    style={{ padding: '6px 12px', borderRadius: '14px', border: '1px solid #E8C5C8', backgroundColor: '#FFF9F9', color: '#8A797A', fontFamily: 'sans-serif', fontSize: '0.78rem', cursor: 'pointer' }}
                  >
                    {selectedEmail.isArchived ? '🗑️ Delete' : '🗄️ Archive'}
                  </button>
                </div>
              </div>

              {/* Message Body */}
              <div style={{ backgroundColor: '#FFF9F9', border: '1px solid #E8C5C8', borderRadius: '12px', padding: '18px', fontFamily: 'sans-serif', fontSize: '0.94rem', color: '#5C5454', whiteSpace: 'pre-wrap', lineHeight: '1.6', maxHeight: '260px', overflowY: 'auto', marginBottom: '18px' }}>
                {selectedEmail.textBody || selectedEmail.snippet || '(No message content)'}
              </div>

              {selectedEmail.repliedAt && (
                <div style={{ backgroundColor: '#F6FBF7', border: '1px solid #A5D6A7', borderRadius: '10px', padding: '10px 14px', marginBottom: '14px', fontFamily: 'sans-serif', fontSize: '0.82rem', color: '#2E7D32' }}>
                  <strong>↩ Replied on {new Date(selectedEmail.repliedAt).toLocaleString()}:</strong>{' '}
                  {selectedEmail.lastReplyPreview || 'Reply sent via IONOS SMTP.'}
                </div>
              )}

              {/* Direct Threaded Reply Form */}
              <form onSubmit={handleSendInlineReply} style={{ borderTop: '1px solid #F2D4D7', paddingTop: '14px' }}>
                <label style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.15rem', fontWeight: 'bold', color: '#B38B8F', marginBottom: '8px' }}>
                  ↩ Quick Threaded Reply to {selectedEmail.fromName || selectedEmail.fromEmail}
                </label>
                <textarea
                  rows="4"
                  placeholder={`Write your reply to ${selectedEmail.fromEmail}...`}
                  value={inlineReplyBody}
                  onChange={(e) => setInlineReplyBody(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #E8C5C8', backgroundColor: '#FFF9F9', fontFamily: 'sans-serif', fontSize: '0.92rem', outline: 'none', resize: 'vertical', boxSizing: 'border-box', marginBottom: '10px' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <span style={{ fontFamily: 'sans-serif', fontSize: '0.78rem', color: '#8A797A' }}>
                    Dispatches via smtp.ionos.com with In-Reply-To headers & logs to Outbox
                  </span>
                  <button
                    type="submit"
                    disabled={isSendingReply || !inlineReplyBody.trim()}
                    style={{ backgroundColor: '#F2D4D7', color: '#5C5454', border: '1px solid #B38B8F', borderRadius: '20px', padding: '9px 20px', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.08rem', fontWeight: 'bold', cursor: (isSendingReply || !inlineReplyBody.trim()) ? 'not-allowed' : 'pointer' }}
                  >
                    {isSendingReply ? 'Sending Reply...' : '✉️ Send Reply ✧'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const AdminDashboard = ({ adminData, onLogout, backendProducts, onProductDeleted, onCatalogUpdated, onRefreshAdminData }) => {
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('cj_topup') || urlParams.get('tab') === 'Finances') {
        return 'Finances';
      }
      const tabParam = urlParams.get('tab');
      if (tabParam) return tabParam;
    } catch (e) {}
    const saved = localStorage.getItem('adminActiveTab');
    if (saved === 'AI') return 'Odie';
    return saved || 'Inbox';
  });
  const [monthlyBoxesRefreshKey, setMonthlyBoxesRefreshKey] = useState(0);
  const mainContentRef = React.useRef(null);
  
  useEffect(() => {
    localStorage.setItem('adminActiveTab', activeTab);
    if (mainContentRef.current) {
      mainContentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [activeTab]);

  const tabs = ['Orders', 'Inbox', 'Finances', 'Boxes', 'Analytics', 'Outbox', 'Curation', 'Calendar', 'Inventory', 'Tests', 'Video', 'Odie'];
  const [pendingOdiePrompt, setPendingOdiePrompt] = useState('');

  const [emailForm, setEmailForm] = useState({ to: '', subject: '', body: '', inReplyToId: '' });
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [inboxRefreshKey, setInboxRefreshKey] = useState(0);
  
  const emailFormRef = React.useRef(null);
  const [emailStatus, setEmailStatus] = useState({ type: '', message: '' });

  const [emailLogs, setEmailLogs] = useState([]);
  
  useEffect(() => {
    if (activeTab === 'Outbox') {
      const fetchLogs = async () => {
        try {
          const token = localStorage.getItem('token');
          const res = await fetch(`${API_BASE_URL}/api/admin/email-logs`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) setEmailLogs(await res.json());
        } catch (err) {
          console.error('Failed to fetch logs:', err);
        }
      };
      fetchLogs();
    }
  }, [activeTab]);

  const [selectedBlueprint, setSelectedBlueprint] = useState(null);
  const [pushingId, setPushingId] = useState(null);
  const [curationNote, setCurationNote] = useState('');
  const [curationFeedback, setCurationFeedback] = useState({ type: '', text: '' });
  const [pushedProductMap, setPushedProductMap] = useState({});

  const handleSendEmail = async (e) => {
    e.preventDefault();
    setIsSendingEmail(true);
    setEmailStatus({ type: '', message: '' });

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/admin/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(emailForm)
      });
      const data = await res.json();
      
      if (res.ok) {
        setEmailStatus({ type: 'success', message: 'Email successfully dispatched! ✧' });
        setEmailForm({ to: '', subject: '', body: '', inReplyToId: '' });
        setInboxRefreshKey(prev => prev + 1); 
        
        setTimeout(() => setEmailStatus({ type: '', message: '' }), 4000);
      } else {
        setEmailStatus({ type: 'error', message: data.error || 'Failed to send email.' });
      }
    } catch (err) {
      console.error(err);
      setEmailStatus({ type: 'error', message: 'Network error while sending email.' });
    }
    setIsSendingEmail(false);
  };

  const handlePushRecommendation = async (productId, userId) => {
    if (!userId) {
      setCurationFeedback({ type: 'error', text: 'Cannot push recommendation: User account not found for this blueprint.' });
      return;
    }
    setPushingId(productId);
    setCurationFeedback({ type: '', text: '' });
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/admin/users/${userId}/recommend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          productId,
          message: curationNote.trim() || undefined
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setPushedProductMap(prev => {
          const existing = prev[userId] || [];
          return {
            ...prev,
            [userId]: existing.includes(productId) ? existing : [...existing, productId]
          };
        });
        setCurationFeedback({
          type: 'success',
          text: 'Product pushed to member Inbox & Blueprint curation! ✧'
        });
        setTimeout(() => setCurationFeedback({ type: '', text: '' }), 4000);
      } else {
        setCurationFeedback({ type: 'error', text: data.error || 'Failed to push recommendation.' });
      }
    } catch (err) {
      console.error('Error pushing recommendation:', err);
      setCurationFeedback({ type: 'error', text: 'Network error while pushing recommendation.' });
    }
    setPushingId(null);
  };

  return (
    <div className="sanctuary-shell" style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', background: 'inherit', backgroundColor: 'transparent', position: 'fixed', top: 0, left: 0, zIndex: 500, boxSizing: 'border-box' }}>
      
      {/* Sidebar Navigation */}
      <div className="sanctuary-sidebar" style={{ width: '260px', height: '100%', overflowY: 'auto', flexShrink: 0, backgroundColor: 'rgba(255, 255, 255, 0.78)', backdropFilter: 'blur(8px)', borderRight: '1px solid #E8C5C8', display: 'flex', flexDirection: 'column', padding: '30px 0', boxShadow: '2px 0 15px rgba(232, 197, 200, 0.2)', boxSizing: 'border-box' }}>
        <div style={{ textAlign: 'center', marginBottom: '25px' }}>
          <h2 style={{ fontFamily: "'Alex Brush', cursive", color: '#B38B8F', fontSize: '3rem', margin: 0, fontWeight: '400' }}>Admin Portal</h2>
          <p style={{ fontFamily: "'Cormorant Garamond', serif", color: '#A89999', margin: '5px 0 0 0', fontStyle: 'italic' }}>Susan's Beauty Consulting</p>
        </div>
        
        <div className="sanctuary-nav-list" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', padding: '0 20px' }}>
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '12px 20px', textAlign: 'left', border: 'none', borderRadius: '12px',
                backgroundColor: activeTab === tab ? '#F2D4D7' : 'transparent',
                color: activeTab === tab ? '#5C5454' : '#8A797A',
                fontFamily: "'Cormorant Garamond', serif", fontSize: '1.25rem', cursor: 'pointer',
                transition: 'all 0.3s ease', fontWeight: activeTab === tab ? 'bold' : 'normal',
                boxShadow: activeTab === tab ? '0 4px 10px rgba(232, 197, 200, 0.3)' : 'none'
              }}
            >
              {tab === 'Orders' && '📦 '}
              {tab === 'Inbox' && '✉️ '}
              {tab === 'Finances' && '💸 '}
              {tab === 'Boxes' && '🎁 '}
              {tab === 'Analytics' && '📊 '}
              {tab === 'Outbox' && '📤 '}
              {tab === 'Curation' && '✨ '}
              {tab === 'Calendar' && '📅 '}
              {tab === 'Inventory' && '🛍️ '}
              {tab === 'Tests' && '🧪 '}
              {tab === 'Video' && '🎥 '}
              {tab === 'Odie' && '🐾 '}
              {tab}
            </button>
          ))}
        </div>

        <div style={{ padding: '20px 20px 0 20px' }}>
          <button onClick={onLogout} style={{ width: '100%', padding: '12px', border: '1px solid #E8C5C8', backgroundColor: 'transparent', color: '#736A6A', borderRadius: '12px', cursor: 'pointer', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.1rem', transition: 'all 0.3s ease' }} onMouseOver={(e) => { e.target.style.backgroundColor = '#FFF0F2'; }} onMouseOut={(e) => { e.target.style.backgroundColor = 'transparent'; }}>
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div ref={mainContentRef} className="sanctuary-main" style={{ flex: 1, height: '100%', padding: '50px', overflowY: 'auto', WebkitOverflowScrolling: 'touch', boxSizing: 'border-box' }}>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", color: '#5C5454', fontSize: '2.8rem', marginTop: 0, borderBottom: '1px solid rgba(232, 197, 200, 0.5)', paddingBottom: '15px', marginBottom: '30px' }}>
          {activeTab === 'Boxes' ? 'Monthly Ritual Boxes & CJ Studio' : activeTab}
        </h1>
        
        {activeTab === 'Inbox' && (
          <div style={{ animation: 'fadeIn 0.5s ease' }}>
            <AdminIonosInbox
              refreshTrigger={inboxRefreshKey}
              onLoadReplyInComposer={(inboundEmail) => {
                const baseSubj = String(inboundEmail.subject || '').trim();
                const replySubj = /^re:/i.test(baseSubj) ? baseSubj : `Re: ${baseSubj}`;
                const quoted = String(inboundEmail.textBody || inboundEmail.snippet || '').trim();
                setEmailForm({
                  to: inboundEmail.fromEmail || '',
                  subject: replySubj,
                  body: quoted ? `\n\n--- Original Message from ${inboundEmail.fromName || inboundEmail.fromEmail} ---\n${quoted}` : '',
                  inReplyToId: inboundEmail._id || ''
                });
                emailFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              onAskOdie={(promptText) => {
                setPendingOdiePrompt(promptText);
                setActiveTab('Odie');
              }}
            />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '30px', alignItems: 'start' }}>
            
            {/* Left Column: Email Composer */}
            <div ref={emailFormRef} style={{ backgroundColor: '#FFFFFF', padding: '30px', borderRadius: '20px', border: '1px solid #E8C5C8', boxShadow: '0 10px 30px rgba(232, 197, 200, 0.15)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                <h2 style={{ fontFamily: "'Cormorant Garamond', serif", color: '#B38B8F', margin: 0, fontSize: '2.2rem' }}>Compose Message</h2>
                {emailForm.inReplyToId && (
                  <span style={{ backgroundColor: '#FFF0F2', color: '#5C5454', border: '1px solid #B38B8F', borderRadius: '14px', padding: '4px 10px', fontSize: '0.78rem', fontFamily: 'sans-serif' }}>
                    ↩ Threaded Reply Active{' '}
                    <button
                      type="button"
                      onClick={() => setEmailForm({ ...emailForm, inReplyToId: '' })}
                      style={{ background: 'none', border: 'none', color: '#B38B8F', fontWeight: 'bold', cursor: 'pointer', marginLeft: '4px' }}
                    >
                      ✕
                    </button>
                  </span>
                )}
              </div>
              <form onSubmit={handleSendEmail} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <input 
                  type="email" 
                  placeholder="Recipient Email" 
                  required
                  value={emailForm.to}
                  onChange={(e) => setEmailForm({...emailForm, to: e.target.value})}
                  style={{ padding: '15px', borderRadius: '12px', border: '1px solid #E8C5C8', fontFamily: 'sans-serif', fontSize: '1rem', outline: 'none', backgroundColor: '#FFF9F9' }}
                />
                <input 
                  type="text" 
                  placeholder="Subject Line" 
                  required
                  value={emailForm.subject}
                  onChange={(e) => setEmailForm({...emailForm, subject: e.target.value})}
                  style={{ padding: '15px', borderRadius: '12px', border: '1px solid #E8C5C8', fontFamily: 'sans-serif', fontSize: '1rem', outline: 'none', backgroundColor: '#FFF9F9' }}
                />
                <textarea 
                  placeholder="Draft your message here..." 
                  required
                  rows="10"
                  value={emailForm.body}
                  onChange={(e) => setEmailForm({...emailForm, body: e.target.value})}
                  style={{ padding: '15px', borderRadius: '12px', border: '1px solid #E8C5C8', fontFamily: 'sans-serif', fontSize: '1rem', outline: 'none', resize: 'vertical', backgroundColor: '#FFF9F9' }}
                />
                <button 
                  type="submit" 
                  disabled={isSendingEmail}
                  style={{ backgroundColor: '#F2D4D7', color: '#5C5454', padding: '15px', borderRadius: '30px', border: '1px solid #B38B8F', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.2rem', cursor: isSendingEmail ? 'not-allowed' : 'pointer', transition: 'all 0.3s ease', marginTop: '10px' }}
                >
                  {isSendingEmail ? 'Dispatching...' : 'Send Message ✧'}
                </button>

                {emailStatus.message && (
                  <div style={{
                    marginTop: '10px',
                    padding: '12px',
                    borderRadius: '10px',
                    textAlign: 'center',
                    fontFamily: 'sans-serif',
                    fontSize: '0.95rem',
                    backgroundColor: emailStatus.type === 'success' ? '#F6FBF7' : '#FFF5F5',
                    color: emailStatus.type === 'success' ? '#2E7D32' : '#C62828',
                    border: `1px solid ${emailStatus.type === 'success' ? '#A5D6A7' : '#FFCDD2'}`,
                    animation: 'fadeIn 0.3s ease'
                  }}>
                    {emailStatus.message}
                  </div>
                )}
              </form>
            </div>

          </div>
          </div>
        )}

        {activeTab === 'Orders' && (
          <AdminFinancesAndOrders
            viewMode="ORDERS"
            onOpenFinancesTab={() => setActiveTab('Finances')}
            onEmailCustomer={(to, subject) => {
              setEmailForm({ to, subject, body: '' });
              setActiveTab('Inbox');
            }}
            onOrdersUpdated={onRefreshAdminData}
            onAskOdie={(promptText) => {
              setPendingOdiePrompt(promptText);
              setActiveTab('Odie');
            }}
          />
        )}

        {activeTab === 'Finances' && (
          <AdminFinancesAndOrders
            viewMode="FINANCES"
            onOpenOrdersTab={() => setActiveTab('Orders')}
            onEmailCustomer={(to, subject) => {
              setEmailForm({ to, subject, body: '' });
              setActiveTab('Inbox');
            }}
            onOrdersUpdated={onRefreshAdminData}
            onAskOdie={(promptText) => {
              setPendingOdiePrompt(promptText);
              setActiveTab('Odie');
            }}
          />
        )}

        {activeTab === 'Boxes' && (
          <AdminMonthlyBoxesAndCjStudio
            catalogProducts={backendProducts}
            refreshTrigger={monthlyBoxesRefreshKey}
            onCatalogUpdated={onCatalogUpdated}
            onOrdersUpdated={onRefreshAdminData}
            onOpenFinancesTab={() => setActiveTab('Finances')}
            onAskOdie={(promptText) => {
              setPendingOdiePrompt(promptText);
              setActiveTab('Odie');
            }}
          />
        )}

        {activeTab === 'Analytics' && (
          <AdminAnalytics
            onOpenCurationTab={() => setActiveTab('Curation')}
            onOpenInventoryTab={() => setActiveTab('Inventory')}
            onAskOdie={(promptText) => {
              setPendingOdiePrompt(promptText);
              setActiveTab('Odie');
            }}
          />
        )}

        {activeTab === 'Outbox' && (
          <div style={{ backgroundColor: '#FFFFFF', padding: '30px', borderRadius: '20px', border: '1px solid #E8C5C8', boxShadow: '0 10px 30px rgba(232, 197, 200, 0.15)', animation: 'fadeIn 0.5s ease', maxWidth: '900px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", color: '#B38B8F', margin: 0, fontSize: '2.2rem' }}>Sent Messages</h2>
              <span style={{ backgroundColor: '#FFF0F2', color: '#B38B8F', padding: '5px 12px', borderRadius: '20px', fontSize: '0.9rem', fontWeight: 'bold', border: '1px solid #E8C5C8' }}>
                {emailLogs.length} Records
              </span>
            </div>

            {emailLogs.length === 0 ? (
              <p style={{ color: '#8A797A', fontStyle: 'italic', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.2rem' }}>No messages have been sent yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {emailLogs.map(log => (
                  <div key={log._id} style={{ padding: '20px', backgroundColor: '#FFF9F9', border: '1px solid #E8C5C8', borderRadius: '15px', transition: 'transform 0.2s ease' }} onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', borderBottom: '1px solid rgba(232, 197, 200, 0.3)', paddingBottom: '10px' }}>
                      <strong style={{ color: '#5C5454', fontSize: '1.1rem' }}>To: <span style={{ color: '#B38B8F' }}>{log.to}</span></strong>
                      <span style={{ color: '#A89999', fontSize: '0.9rem' }}>{new Date(log.sentAt).toLocaleString()}</span>
                    </div>
                    <p style={{ margin: '0 0 10px 0', fontFamily: 'sans-serif', fontSize: '0.95rem', color: '#5C5454', fontWeight: 'bold' }}>Subject: {log.subject}</p>
                    <div style={{ fontSize: '0.95rem', color: '#736A6A', whiteSpace: 'pre-wrap', backgroundColor: '#FFFFFF', padding: '15px', borderRadius: '10px', border: '1px solid rgba(232, 197, 200, 0.4)', lineHeight: '1.5' }}>
                      {log.body}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'Curation' && (
          <div style={{ display: 'flex', gap: '30px', alignItems: 'flex-start', flexWrap: 'wrap', animation: 'fadeIn 0.5s ease' }}>
            <div style={{ width: '350px', flexShrink: 0, backgroundColor: '#FFFFFF', padding: '25px', borderRadius: '20px', border: '1px solid #E8C5C8', boxShadow: '0 10px 30px rgba(232, 197, 200, 0.15)', boxSizing: 'border-box' }}>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", color: '#B38B8F', marginTop: 0, fontSize: '1.8rem' }}>Client Blueprints</h2>
              {(!adminData.blueprints || adminData.blueprints.length === 0) ? (
                <p style={{ color: '#8A797A', fontStyle: 'italic', fontFamily: "'Cormorant Garamond', serif" }}>No blueprints submitted yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  {adminData.blueprints.map(bp => (
                    <div 
                      key={bp._id} 
                      onClick={() => setSelectedBlueprint(bp)}
                      style={{ padding: '15px', borderRadius: '12px', border: selectedBlueprint?._id === bp._id ? '2px solid #B38B8F' : '1px solid #E8C5C8', backgroundColor: selectedBlueprint?._id === bp._id ? '#FFF0F2' : '#FFF9F9', cursor: 'pointer', transition: 'all 0.2s ease' }}
                    >
                      <strong style={{ display: 'block', color: '#5C5454', fontSize: '1.1rem' }}>{bp.userId?.name || 'Anonymous'}</strong>
                      <span style={{ color: '#8A797A', fontSize: '0.9rem' }}>{bp.userId?.email || 'No email'}</span>
                      <span style={{ display: 'block', color: '#A89999', fontSize: '0.8rem', marginTop: '5px' }}>{new Date(bp.createdAt).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ flex: 1, minWidth: '320px', backgroundColor: '#FFFFFF', padding: '30px', borderRadius: '20px', border: '1px solid #E8C5C8', boxShadow: '0 10px 30px rgba(232, 197, 200, 0.15)', boxSizing: 'border-box' }}>
              {!selectedBlueprint ? (
                <div style={{ height: '100%', minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <p style={{ color: '#8A797A', fontStyle: 'italic', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.4rem' }}>Select a client blueprint to begin curation ✧</p>
                </div>
              ) : (
                <div style={{ animation: 'fadeIn 0.3s ease' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E8C5C8', paddingBottom: '15px', marginBottom: '20px' }}>
                    <div>
                      <h2 style={{ fontFamily: "'Cormorant Garamond', serif", color: '#5C5454', margin: '0 0 5px 0', fontSize: '2.2rem' }}>{selectedBlueprint.userId?.name || 'Anonymous'}</h2>
                      <p style={{ color: '#8A797A', margin: 0 }}>{selectedBlueprint.userId?.email || 'No email'}</p>
                    </div>
                    <button onClick={() => setSelectedBlueprint(null)} style={{ background: 'none', border: '1px solid #E8C5C8', borderRadius: '15px', padding: '8px 15px', color: '#8A797A', cursor: 'pointer' }}>Close View</button>
                  </div>

                  <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.5rem', color: '#B38B8F', marginBottom: '15px' }}>Quiz Analysis</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '30px' }}>
                    <BlueprintCard label="Skin Temperament" value={selectedBlueprint.skinType}/>
                    <BlueprintCard label="Primary Vision" value={selectedBlueprint.primaryGoal}/>
                    <BlueprintCard label="Climate Context" value={selectedBlueprint.climate}/>
                    <BlueprintCard label="Skin Sensitivity" value={selectedBlueprint.skinSensitivity}/>
                    <BlueprintCard label="Complexion Canvas" value={selectedBlueprint.complexion}/>
                    <BlueprintCard label="Undertone" value={selectedBlueprint.undertone}/>
                    <BlueprintCard label="Eye Color" value={selectedBlueprint.eyeColor}/>
                    <BlueprintCard label="Facial Silhouette" value={selectedBlueprint.faceShape}/>
                    <BlueprintCard label="Signature Aesthetic" value={selectedBlueprint.makeupVibe}/>
                    <BlueprintCard label="Regimen Focus" value={selectedBlueprint.routineFocus}/>
                  </div>

                  <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.5rem', color: '#B38B8F', marginBottom: '12px', borderTop: '1px solid #E8C5C8', paddingTop: '20px' }}>Curate Products for {selectedBlueprint.userId?.name || 'Member'}</h3>
                  <div style={{ marginBottom: '20px', backgroundColor: '#FFF9F9', padding: '15px', borderRadius: '12px', border: '1px solid #E8C5C8' }}>
                    <label style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.1rem', color: '#5C5454', marginBottom: '8px' }}>
                      Personal Note from Susan (optional — sent with each recommended product):
                    </label>
                    <input
                      type="text"
                      placeholder="Susan has hand-selected this specifically for your custom beauty profile ✧"
                      value={curationNote}
                      onChange={(e) => setCurationNote(e.target.value)}
                      style={{ width: '100%', padding: '12px 15px', borderRadius: '10px', border: '1px solid #E8C5C8', fontFamily: 'sans-serif', fontSize: '0.95rem', backgroundColor: '#FFFFFF', outline: 'none', boxSizing: 'border-box' }}
                    />
                    {curationFeedback.text && (
                      <div style={{
                        marginTop: '12px',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        fontSize: '0.95rem',
                        fontFamily: 'sans-serif',
                        backgroundColor: curationFeedback.type === 'success' ? '#F6FBF7' : '#FFF5F5',
                        color: curationFeedback.type === 'success' ? '#2E7D32' : '#C62828',
                        border: `1px solid ${curationFeedback.type === 'success' ? '#A5D6A7' : '#FFCDD2'}`
                      }}>
                        {curationFeedback.text}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '15px' }}>
                    {[...backendProducts]
                      .sort((a, b) => {
                        const matchA = evaluateBlueprintMatch(a, selectedBlueprint, true);
                        const matchB = evaluateBlueprintMatch(b, selectedBlueprint, true);
                        return (Number(matchB.isMatch) - Number(matchA.isMatch)) || (matchB.matchScore - matchA.matchScore);
                      })
                      .map(product => {
                        const title = product.title || 'Untitled Product';
                        const price = product.variants?.[0]?.retailPrice || product.variants?.[0]?.price || product.retailPrice || product.price || 0;
                        const clientId = selectedBlueprint.userId?._id;
                        const initialRecs = (selectedBlueprint.userId?.recommendedProducts || []).map(id =>
                          typeof id === 'object' && id !== null ? id._id || id.toString() : String(id)
                        );
                        const sessionRecs = (clientId && pushedProductMap[clientId]) ? pushedProductMap[clientId] : [];
                        const isAlreadyRecommended = initialRecs.includes(String(product._id)) || sessionRecs.includes(String(product._id));
                        const clientMatch = evaluateBlueprintMatch(product, selectedBlueprint, true);

                        return (
                          <div key={product._id} style={{ backgroundColor: '#FFF9F9', border: (isAlreadyRecommended || clientMatch.isMatch) ? '1.5px solid #B38B8F' : '1px solid #E8C5C8', borderRadius: '12px', padding: '15px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', transition: 'transform 0.2s ease' }} onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
                            <div style={{ marginBottom: '12px' }}>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '6px' }}>
                                {clientMatch.isMatch && (
                                  <span style={{ display: 'inline-block', backgroundColor: '#F2D4D7', color: '#5C5454', border: '1px solid #B38B8F', borderRadius: '10px', padding: '2px 8px', fontSize: '0.72rem', fontWeight: 'bold', fontFamily: 'sans-serif' }}>
                                    ✨ Matches Client Blueprint ({clientMatch.matchScore}%)
                                  </span>
                                )}
                                {isAlreadyRecommended && (
                                  <span style={{ display: 'inline-block', backgroundColor: '#FFF0F2', color: '#B38B8F', border: '1px solid #E8C5C8', borderRadius: '10px', padding: '2px 8px', fontSize: '0.72rem', fontWeight: 'bold', fontFamily: 'sans-serif' }}>
                                    ✓ In Member's Curation
                                  </span>
                                )}
                                <span style={{ display: 'inline-block', backgroundColor: '#FFFFFF', color: '#736A6A', border: '1px solid #E8C5C8', borderRadius: '10px', padding: '2px 7px', fontSize: '0.68rem', fontFamily: 'sans-serif' }}>
                                  {clientMatch.ritualStep}
                                </span>
                              </div>
                              <h4 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.1rem', color: '#5C5454', margin: '0 0 4px 0' }}>{title}</h4>
                              <p style={{ fontFamily: 'sans-serif', fontSize: '1rem', color: '#B38B8F', fontWeight: 'bold', margin: '0 0 8px 0' }}>${parseFloat(price).toFixed(2)}</p>

                              <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8C5C8', borderRadius: '8px', padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', alignItems: 'center' }}>
                                  <span style={{ fontSize: '0.66rem', color: '#8A797A', fontWeight: 'bold', fontFamily: 'sans-serif' }}>Best for:</span>
                                  {clientMatch.skinTypes.slice(0, 3).map((st, idx) => {
                                    const hi = clientMatch.matchesSkinTypePill(st);
                                    return (
                                      <span key={idx} style={{ fontSize: '0.65rem', backgroundColor: hi ? '#F2D4D7' : '#FFF0F2', color: '#5C5454', border: hi ? '1px solid #B38B8F' : '1px solid #E8C5C8', borderRadius: '6px', padding: '1px 5px', fontWeight: hi ? 'bold' : 'normal', fontFamily: 'sans-serif' }}>
                                        {hi ? `✓ ${st}` : st}
                                      </span>
                                    );
                                  })}
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', alignItems: 'center' }}>
                                  <span style={{ fontSize: '0.66rem', color: '#8A797A', fontWeight: 'bold', fontFamily: 'sans-serif' }}>Targets:</span>
                                  {clientMatch.skinConcerns.slice(0, 3).map((sc, idx) => {
                                    const hi = clientMatch.matchesConcernPill(sc);
                                    return (
                                      <span key={idx} style={{ fontSize: '0.65rem', backgroundColor: hi ? '#F2D4D7' : '#F6FBF7', color: hi ? '#5C5454' : '#2E7D32', border: hi ? '1px solid #B38B8F' : '1px solid #A5D6A7', borderRadius: '6px', padding: '1px 5px', fontWeight: hi ? 'bold' : 'normal', fontFamily: 'sans-serif' }}>
                                        {hi ? `✨ ${sc}` : sc}
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => handlePushRecommendation(product._id, selectedBlueprint.userId?._id)}
                              disabled={pushingId === product._id}
                              style={{ backgroundColor: isAlreadyRecommended ? '#FFFFFF' : '#F2D4D7', border: '1px solid #B38B8F', color: '#5C5454', padding: '10px', borderRadius: '15px', fontFamily: "'Cormorant Garamond', serif", fontSize: '1rem', fontWeight: 'bold', cursor: pushingId === product._id ? 'not-allowed' : 'pointer', width: '100%', transition: 'all 0.3s ease' }}
                            >
                              {pushingId === product._id ? 'Pushing...' : isAlreadyRecommended ? 'Push Again with Note ✧' : 'Push to Member ✧'}
                            </button>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'Calendar' && (
          <div>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2rem', color: '#5C5454' }}>Consultation Schedule</h2>
            <AdminCalendar users={adminData.users} />
          </div>
        )}
        {activeTab === 'Inventory' && (
          <AdminInventory
            onCatalogUpdated={onCatalogUpdated}
            onOpenTestsTab={() => setActiveTab('Tests')}
            onOpenBoxesTab={() => setActiveTab('Boxes')}
          />
        )}
        {activeTab === 'Tests' && (
          <AdminTestLab
            onCatalogUpdated={onCatalogUpdated}
            onAskOdieToTest={(promptText) => {
              setPendingOdiePrompt(promptText);
              setActiveTab('Odie');
            }}
          />
        )}
        {activeTab === 'Video' && (
          <AdminVideoPortal />
        )}
        {activeTab === 'Odie' && (
          <AdminAiAssistant
            onProductDeleted={onProductDeleted}
            pendingPrompt={pendingOdiePrompt}
            onClearPendingPrompt={() => setPendingOdiePrompt('')}
            onExecutiveAction={async (data) => {
              const actions = Array.isArray(data.actionsTaken) ? data.actionsTaken : [];
              const needsCatalogRefresh =
                Boolean(data.addedProduct || data.updatedProduct || data.deletedProductId || data.customLabelResult) ||
                actions.some(a =>
                  [
                    'syncOrCleanCjCatalog',
                    'reclassifyProductBlueprintLabels',
                    'configureCjCustomLabeling',
                    'adjustCjShippingAndPricing'
                  ].includes(a)
                );

              const needsBoxesRefresh =
                Boolean(
                  data.curatedMonthlyBox ||
                  data.monthlyBoxesTelemetry ||
                  data.updatedMonthlyBox ||
                  data.dispatchedMonthlyBox
                ) ||
                actions.some(a =>
                  [
                    'curateMonthlyMemberBoxes',
                    'configureCjCustomLabeling',
                    'adjustCjShippingAndPricing',
                    'dispatchMonthlyMemberBoxToCj'
                  ].includes(a)
                );

              if (needsCatalogRefresh) {
                try {
                  const prodRes = await fetch(`${API_BASE_URL}/api/products`);
                  if (prodRes.ok && onCatalogUpdated) {
                    onCatalogUpdated(await prodRes.json());
                  }
                } catch (e) {}
              }
              if (needsBoxesRefresh) {
                setMonthlyBoxesRefreshKey(prev => prev + 1);
              }
              if (actions.includes('syncAndReadIonosInbox') || data.repliedInboundEmail || data.inboundEmails) {
                setInboxRefreshKey(prev => prev + 1);
              }
              if (onRefreshAdminData) {
                onRefreshAdminData();
              }
            }}
          />
        )}
      </div>
    </div>
  );
};

// ---------------- MAIN APP ---------------- //

function App() {
  const [step, setStep] = useState(() => {
    try {
      const savedStep = localStorage.getItem('currentStep');
      return savedStep !== null ? parseInt(savedStep, 10) : 0;
    } catch { return 0; }
  }); 

  const [cart, setCart] = useState(() => {
    try {
      const savedCart = localStorage.getItem('ritualCart');
      return savedCart ? JSON.parse(savedCart) : [];
    } catch { return []; }
  });

  const [userDetails, setUserDetails] = useState(() => {
    try {
      const savedUser = localStorage.getItem('authUser');
      return savedUser
        ? JSON.parse(savedUser)
        : {
            name: '',
            username: '',
            email: '',
            phone: '',
            password: '',
            membershipTier: 'basic',
            role: 'client',
            avatarUrl: '',
            shippingAddress: { address_1: '', address_2: '', city: '', state: '', postcode: '', country: 'US' },
            billingInfo: { billingName: '', cardBrand: '', cardLast4: '', expMonth: '', expYear: '', billingAddress: '', subscriptionStatus: 'inactive' }
          };
    } catch {
      return {
        name: '',
        username: '',
        email: '',
        phone: '',
        password: '',
        membershipTier: 'basic',
        role: 'client',
        avatarUrl: '',
        shippingAddress: { address_1: '', address_2: '', city: '', state: '', postcode: '', country: 'US' },
        billingInfo: { billingName: '', cardBrand: '', cardLast4: '', expMonth: '', expYear: '', billingAddress: '', subscriptionStatus: 'inactive' }
      };
    }
  });

  const [paywallModal, setPaywallModal] = useState({
    isOpen: false,
    featureContext: ''
  });
  const [isUpgradingTier, setIsUpgradingTier] = useState(false);

  const effectiveMemberTier = String(userDetails?.membershipTier || 'basic').toLowerCase().trim();
  const isPaidMemberOrAdmin =
    userDetails?.role === 'admin' ||
    ['luminary', 'radiance', 'admin'].includes(effectiveMemberTier);
  const isFreeBasicMember = !isPaidMemberOrAdmin;

  const [accountForm, setAccountForm] = useState({
    name: userDetails?.name || '',
    username: userDetails?.username || '',
    email: userDetails?.email || '',
    phone: userDetails?.phone || '',
    avatarUrl: userDetails?.avatarUrl || '',
    newPassword: '',
    shippingAddress: {
      address_1: userDetails?.shippingAddress?.address_1 || '',
      address_2: userDetails?.shippingAddress?.address_2 || '',
      city: userDetails?.shippingAddress?.city || '',
      state: userDetails?.shippingAddress?.state || '',
      postcode: userDetails?.shippingAddress?.postcode || '',
      country: userDetails?.shippingAddress?.country || 'US'
    },
    billingInfo: {
      billingName: userDetails?.billingInfo?.billingName || userDetails?.name || '',
      cardBrand: userDetails?.billingInfo?.cardBrand || 'Visa',
      cardLast4: userDetails?.billingInfo?.cardLast4 || '',
      expMonth: userDetails?.billingInfo?.expMonth || '',
      expYear: userDetails?.billingInfo?.expYear || '',
      billingAddress: userDetails?.billingInfo?.billingAddress || ''
    }
  });
  const [isSavingAccount, setIsSavingAccount] = useState(false);
  const [savingSection, setSavingSection] = useState(''); // '' | 'avatar' | 'personal' | 'shipping' | 'billing' | 'all'
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarPendingSave, setAvatarPendingSave] = useState(false);
  const [isEditingPersonal, setIsEditingPersonal] = useState(false);
  const [isEditingShipping, setIsEditingShipping] = useState(false);
  const [isEditingBilling, setIsEditingBilling] = useState(false);
  const [isOpeningBillingPortal, setIsOpeningBillingPortal] = useState(false);
  const [accountStatusBanner, setAccountStatusBanner] = useState({ type: '', text: '' });

  useEffect(() => {
    setAccountForm(prev => ({
      ...prev,
      name: userDetails?.name || '',
      username: userDetails?.username || '',
      email: userDetails?.email || '',
      phone: userDetails?.phone || '',
      avatarUrl: userDetails?.avatarUrl || '',
      shippingAddress: {
        address_1: userDetails?.shippingAddress?.address_1 || '',
        address_2: userDetails?.shippingAddress?.address_2 || '',
        city: userDetails?.shippingAddress?.city || '',
        state: userDetails?.shippingAddress?.state || '',
        postcode: userDetails?.shippingAddress?.postcode || '',
        country: userDetails?.shippingAddress?.country || 'US'
      },
      billingInfo: {
        billingName: userDetails?.billingInfo?.billingName || userDetails?.name || '',
        cardBrand: userDetails?.billingInfo?.cardBrand || 'Visa',
        cardLast4: userDetails?.billingInfo?.cardLast4 || '',
        expMonth: userDetails?.billingInfo?.expMonth || '',
        expYear: userDetails?.billingInfo?.expYear || '',
        billingAddress: userDetails?.billingInfo?.billingAddress || ''
      }
    }));
  }, [
    userDetails?.name,
    userDetails?.username,
    userDetails?.email,
    userDetails?.phone,
    userDetails?.avatarUrl,
    userDetails?.shippingAddress,
    userDetails?.billingInfo
  ]);

  const handleAccountAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingAvatar(true);
    setAccountStatusBanner({ type: '', text: '' });
    try {
      const compressedDataUrl = await compressImageFileToDataUrl(file, 500, 0.85);
      setAccountForm(prev => ({ ...prev, avatarUrl: compressedDataUrl }));
      setAvatarPendingSave(true);
      setAccountStatusBanner({
        type: 'success',
        text: 'New portrait selected! Click "💾 Save Profile Picture" to save and sync it to your Sanctuary header.'
      });
    } catch (err) {
      setAccountStatusBanner({
        type: 'error',
        text: err.message || 'Could not process profile picture. Please try a JPG or PNG image.'
      });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSaveProfilePicture = async () => {
    const token = localStorage.getItem('token');
    setUserDetails(prev => ({ ...prev, avatarUrl: accountForm.avatarUrl || '' }));
    if (!token) {
      setAvatarPendingSave(false);
      setAccountStatusBanner({ type: 'success', text: 'Profile picture updated in your Sanctuary header!' });
      return;
    }

    setSavingSection('avatar');
    setIsSavingAccount(true);
    setAccountStatusBanner({ type: '', text: '' });
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/me/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ avatarUrl: accountForm.avatarUrl || '' })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAccountStatusBanner({
          type: 'error',
          text: data.error || 'Could not save your profile picture.'
        });
        return;
      }
      if (data.user) {
        setUserDetails(prev => ({ ...prev, ...data.user, password: '' }));
      }
      setAvatarPendingSave(false);
      setAccountStatusBanner({
        type: 'success',
        text: 'Profile picture saved and synced to your Sanctuary header ✧'
      });
    } catch {
      setAccountStatusBanner({
        type: 'error',
        text: 'Network error while saving your profile picture.'
      });
    } finally {
      setIsSavingAccount(false);
      setSavingSection('');
    }
  };

  const handleRemoveAccountAvatar = async () => {
    setAccountForm(prev => ({ ...prev, avatarUrl: '' }));
    setUserDetails(prev => ({ ...prev, avatarUrl: '' }));
    setAvatarPendingSave(false);
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/me/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ avatarUrl: '' })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.user) {
        setUserDetails(prev => ({ ...prev, ...data.user, password: '' }));
        setAccountStatusBanner({ type: 'success', text: 'Profile picture removed.' });
      }
    } catch {
      // Ignore network error on local removal
    }
  };

  const handleCancelAccountSection = (section) => {
    if (section === 'personal') {
      setAccountForm(prev => ({
        ...prev,
        name: userDetails?.name || '',
        username: userDetails?.username || '',
        email: userDetails?.email || '',
        phone: userDetails?.phone || '',
        newPassword: ''
      }));
      setIsEditingPersonal(false);
    } else if (section === 'shipping') {
      setAccountForm(prev => ({
        ...prev,
        shippingAddress: {
          address_1: userDetails?.shippingAddress?.address_1 || '',
          address_2: userDetails?.shippingAddress?.address_2 || '',
          city: userDetails?.shippingAddress?.city || '',
          state: userDetails?.shippingAddress?.state || '',
          postcode: userDetails?.shippingAddress?.postcode || '',
          country: userDetails?.shippingAddress?.country || 'US'
        }
      }));
      setIsEditingShipping(false);
    } else if (section === 'billing') {
      setAccountForm(prev => ({
        ...prev,
        billingInfo: {
          billingName: userDetails?.billingInfo?.billingName || userDetails?.name || '',
          cardBrand: userDetails?.billingInfo?.cardBrand || 'Visa',
          cardLast4: userDetails?.billingInfo?.cardLast4 || '',
          expMonth: userDetails?.billingInfo?.expMonth || '',
          expYear: userDetails?.billingInfo?.expYear || '',
          billingAddress: userDetails?.billingInfo?.billingAddress || ''
        }
      }));
      setIsEditingBilling(false);
    }
  };

  const handleSaveAccountSection = async (section = 'all', e = null) => {
    if (e && e.preventDefault) e.preventDefault();
    const token = localStorage.getItem('token');
    if (!token) {
      setAccountStatusBanner({ type: 'error', text: 'Please sign in again to save your account details.' });
      return;
    }

    setSavingSection(section);
    setIsSavingAccount(true);
    setAccountStatusBanner({ type: '', text: '' });
    try {
      let payload = {};
      if (section === 'personal') {
        payload = {
          name: accountForm.name,
          username: accountForm.username,
          email: accountForm.email,
          phone: accountForm.phone
        };
        if (accountForm.newPassword && accountForm.newPassword.trim().length > 0) {
          payload.newPassword = accountForm.newPassword.trim();
        }
      } else if (section === 'shipping') {
        payload = {
          shippingAddress: accountForm.shippingAddress
        };
      } else if (section === 'billing') {
        payload = {
          billingInfo: {
            ...accountForm.billingInfo,
            cardLast4: String(accountForm.billingInfo?.cardLast4 || '').replace(/\D/g, '').slice(-4)
          }
        };
      } else {
        payload = {
          name: accountForm.name,
          username: accountForm.username,
          email: accountForm.email,
          phone: accountForm.phone,
          avatarUrl: accountForm.avatarUrl,
          shippingAddress: accountForm.shippingAddress,
          billingInfo: {
            ...accountForm.billingInfo,
            cardLast4: String(accountForm.billingInfo?.cardLast4 || '').replace(/\D/g, '').slice(-4)
          }
        };
        if (accountForm.newPassword && accountForm.newPassword.trim().length > 0) {
          payload.newPassword = accountForm.newPassword.trim();
        }
      }

      const res = await fetch(`${API_BASE_URL}/api/users/me/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAccountStatusBanner({
          type: 'error',
          text: data.error || 'Could not update your account profile. Please verify your details.'
        });
        return;
      }

      if (data.user) {
        setUserDetails(prev => ({
          ...prev,
          ...data.user,
          password: ''
        }));
      }

      if (section === 'personal' || section === 'all') {
        setAccountForm(prev => ({ ...prev, newPassword: '' }));
        setIsEditingPersonal(false);
      }
      if (section === 'shipping' || section === 'all') {
        setIsEditingShipping(false);
      }
      if (section === 'billing' || section === 'all') {
        setIsEditingBilling(false);
      }
      if (section === 'all') {
        setAvatarPendingSave(false);
      }

      const sectionLabelMap = {
        personal: 'Personal & Account Info saved successfully ✧',
        shipping: 'Shipping Address updated & saved ✧',
        billing: 'Billing Information updated & saved ✧',
        all: data.message || 'All Account Info, Shipping Address, and Billing Details have been saved ✧'
      };
      setAccountStatusBanner({
        type: 'success',
        text: sectionLabelMap[section] || sectionLabelMap.all
      });
    } catch (err) {
      console.error('Save Account Profile Error:', err);
      setAccountStatusBanner({
        type: 'error',
        text: 'Network error while saving your profile. Please try again.'
      });
    } finally {
      setIsSavingAccount(false);
      setSavingSection('');
    }
  };

  const handleSaveAccountProfile = (e) => handleSaveAccountSection('all', e);

  const handleOpenStripeBillingPortal = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setAccountStatusBanner({ type: 'error', text: 'Please sign in to access the Stripe Billing Portal.' });
      return;
    }
    setIsOpeningBillingPortal(true);
    setAccountStatusBanner({ type: '', text: '' });
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/me/billing-portal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ returnUrl: window.location.href })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      setAccountStatusBanner({
        type: 'error',
        text: data.error || 'Could not open live Stripe Billing Portal. You can still update and save your card record directly below.'
      });
    } catch {
      setAccountStatusBanner({
        type: 'error',
        text: 'Network error while connecting to the Stripe Billing Portal.'
      });
    } finally {
      setIsOpeningBillingPortal(false);
    }
  };

  const handleReorderSingleItem = (item) => {
    if (!item) return;
    const matchedProduct = backendProducts.find(
      p =>
        (item.productId && String(p._id) === String(item.productId)) ||
        (item.sku && p.sku === item.sku) ||
        (item.title && p.title === item.title)
    );
    const cartCandidate = matchedProduct
      ? {
          ...matchedProduct,
          sku: item.sku || matchedProduct.sku || String(matchedProduct._id || item.title),
          price: Number(item.price || matchedProduct.price || 0),
          selectedVariantName: item.variantName || ''
        }
      : {
          _id: item.productId || item.sku || item.title,
          title: item.title || 'Boutique Ritual Essential',
          sku: item.sku || `REORDER-${Date.now()}`,
          price: Number(item.price || 0),
          imageUrl: item.imageUrl || '',
          selectedVariantName: item.variantName || ''
        };
    handleAddToCart(cartCandidate);
    setIsCartOpen(true);
  };

  const handleReorderFullOrder = (order) => {
    const items = Array.isArray(order?.items) ? order.items : [];
    if (items.length === 0) return;
    items.forEach(item => {
      const qty = Math.max(1, Number(item.quantity) || 1);
      for (let i = 0; i < qty; i += 1) {
        handleReorderSingleItem(item);
      }
    });
    setIsCartOpen(true);
  };

  const openPaywallModal = (featureContext = '') => {
    setPaywallModal({
      isOpen: true,
      featureContext:
        featureContext ||
        "Upgrade to The Luminary Circle ($49/mo) or The Radiance Elite ($119/mo) to unlock the Personalized Beauty Blueprint Quiz and 1-on-1 Consultations with Susan."
    });
  };

  const closePaywallModal = () => {
    if (isUpgradingTier) return;
    setPaywallModal({ isOpen: false, featureContext: '' });
  };

  const [activeMemberTab, setActiveMemberTab] = useState(() => {
    return localStorage.getItem('activeMemberTab') || 'Blueprint';
  });

  const [hasCompletedQuiz, setHasCompletedQuiz] = useState(() => {
    return localStorage.getItem('hasCompletedQuiz') === 'true';
  });

  const [quizAnswers, setQuizAnswers] = useState(() => {
    try {
      const savedAnswers = localStorage.getItem('quizAnswers');
      return savedAnswers ? JSON.parse(savedAnswers) : { skinType: '', primaryGoal: '', climate: '', skinSensitivity: '', complexion: '', undertone: '', eyeColor: '', faceShape: '', makeupVibe: '', routineFocus: '' };
    } catch {
      return { skinType: '', primaryGoal: '', climate: '', skinSensitivity: '', complexion: '', undertone: '', eyeColor: '', faceShape: '', makeupVibe: '', routineFocus: '' };
    }
  });

  const [blueprintAnalysis, setBlueprintAnalysis] = useState(() => {
    try {
      const savedAnalysis = localStorage.getItem('blueprintAnalysis');
      return savedAnalysis ? JSON.parse(savedAnalysis) : null;
    } catch {
      return null;
    }
  });

  const [quizPhotoDataUrl, setQuizPhotoDataUrl] = useState(() => {
    try {
      return localStorage.getItem('sbc_quiz_photo') || '';
    } catch {
      return '';
    }
  });

  const [aiPhotoAnalysis, setAiPhotoAnalysis] = useState(() => {
    try {
      const savedPhotoAi = localStorage.getItem('aiPhotoAnalysis');
      return savedPhotoAi ? JSON.parse(savedPhotoAi) : null;
    } catch {
      return null;
    }
  });
  const [isProcessingQuizPhoto, setIsProcessingQuizPhoto] = useState(false);

  const defaultBoutiqueFilterState = {
    onlyBlueprintMatch: false,
    skinType: 'All',
    skinConcern: 'All',
    ritualStep: 'All',
    onlySensitiveSafe: false,
    searchQuery: ''
  };

  const [boutiqueFilters, setBoutiqueFilters] = useState(defaultBoutiqueFilterState);

  const resetBoutiqueFilters = () => setBoutiqueFilters(defaultBoutiqueFilterState);

  const jumpToBoutiqueWithFilter = (customFilter = {}) => {
    setBoutiqueFilters({
      ...defaultBoutiqueFilterState,
      ...customFilter
    });
    if (customFilter.onlyBlueprintMatch) {
      trackSiteEvent('FILTER_USED', {
        page: 'Member Sanctuary: Blueprint',
        filterType: 'Blueprint Match',
        filterValue: 'Best Match for My Blueprint'
      });
    } else if (customFilter.skinType) {
      trackSiteEvent('FILTER_USED', {
        page: 'Member Sanctuary: Blueprint',
        filterType: 'Skin Type',
        filterValue: customFilter.skinType
      });
    } else if (customFilter.skinConcern) {
      trackSiteEvent('FILTER_USED', {
        page: 'Member Sanctuary: Blueprint',
        filterType: 'Skin Condition',
        filterValue: customFilter.skinConcern
      });
    } else if (customFilter.ritualStep) {
      trackSiteEvent('FILTER_USED', {
        page: 'Member Sanctuary: Blueprint',
        filterType: 'Ritual Step',
        filterValue: customFilter.ritualStep
      });
    } else if (customFilter.onlySensitiveSafe) {
      trackSiteEvent('FILTER_USED', {
        page: 'Member Sanctuary: Blueprint',
        filterType: 'Sensitivity',
        filterValue: 'High-Sensitivity Safe Only'
      });
    }
    setActiveMemberTab('Boutique');
  };

  const [isLoading, setIsLoading] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false); 
  const [backendProducts, setBackendProducts] = useState([]);
  const [selectedTier, setSelectedTier] = useState('luminary');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [adminData, setAdminData] = useState({ users: [], blueprints: [], orders: [] });
  const [userRecommendations, setUserRecommendations] = useState([]);
  const [userOrders, setUserOrders] = useState([]);
  const [inboxItems, setInboxItems] = useState([]);
  const [memberVideoLink, setMemberVideoLink] = useState('');
  const [activeMemberVideoUrl, setActiveMemberVideoUrl] = useState('');

  const [forgotEmail, setForgotEmail] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetToken, setResetToken] = useState(null);
  const [loginCredentials, setLoginCredentials] = useState({ email: '', password: '' });
  const [oauthSandboxProvider, setOauthSandboxProvider] = useState('');

  // Sync state to Local Storage
  useEffect(() => { localStorage.setItem('currentStep', step); }, [step]);
  useEffect(() => { localStorage.setItem('ritualCart', JSON.stringify(cart)); }, [cart]);
  const memberContentRef = React.useRef(null);
  useEffect(() => {
    localStorage.setItem('activeMemberTab', activeMemberTab);
    if (memberContentRef.current) {
      memberContentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [activeMemberTab]);

  // Analytics Phase 2: Automatic Page View & Quiz Funnel Telemetry
  useEffect(() => {
    if (step === 6 || step === 21) return; // Skip Admin portal & loading transition
    if (step === 5) return; // Handled by the activeMemberTab effect below

    const stepPageMap = {
      0: 'Public Landing Porch',
      1: 'Public Boutique',
      2: 'Paid Membership Tiers',
      3: 'Paid Tier Registration',
      4: 'Member Sign In',
      7: 'Free Membership Registration',
      8: 'Password Reset Request',
      9: 'Set New Password'
    };

    let pageName = stepPageMap[step] || '';
    if (!pageName && step >= 11 && step <= 20) {
      pageName = `Blueprint Quiz Step ${step - 10}`;
    }

    if (pageName) {
      trackSiteEvent('PAGE_VIEW', { page: pageName });
    }
    if (step === 11 && !hasCompletedQuiz) {
      trackSiteEvent('QUIZ_STARTED', { page: 'Blueprint Quiz Step 1' });
    }
  }, [step, hasCompletedQuiz]);

  // Analytics Phase 2: Track Member Sanctuary Tab Views
  useEffect(() => {
    if (step === 5 && activeMemberTab) {
      trackSiteEvent('PAGE_VIEW', {
        page: `Member Sanctuary: ${activeMemberTab}`
      });
    }
  }, [step, activeMemberTab]);

  // Analytics Phase 2: Track Product Detail Modal Opens (PRODUCT_VIEW)
  useEffect(() => {
    if (!selectedProduct) return;
    const meta = deriveProductBlueprintMeta(selectedProduct);
    const price = Number(selectedProduct.variants?.[0]?.price ?? selectedProduct.price ?? 0);
    const currentPage = step === 5 ? `Member Sanctuary: ${activeMemberTab}` : 'Public Boutique';
    trackSiteEvent('PRODUCT_VIEW', {
      page: currentPage,
      productId: selectedProduct._id || null,
      productTitle: selectedProduct.title || 'Untitled Product',
      ritualStep: meta.ritualStep,
      cartValueUsd: price,
      metadata: {
        skinTypes: meta.skinTypes,
        skinConcerns: meta.skinConcerns
      }
    });
  }, [selectedProduct, step, activeMemberTab]);
  useEffect(() => { localStorage.setItem('hasCompletedQuiz', hasCompletedQuiz); }, [hasCompletedQuiz]);
  useEffect(() => { localStorage.setItem('quizAnswers', JSON.stringify(quizAnswers)); }, [quizAnswers]);
  useEffect(() => {
    if (blueprintAnalysis) localStorage.setItem('blueprintAnalysis', JSON.stringify(blueprintAnalysis));
    else localStorage.removeItem('blueprintAnalysis');
  }, [blueprintAnalysis]);

  useEffect(() => {
    try {
      if (quizPhotoDataUrl) localStorage.setItem('sbc_quiz_photo', quizPhotoDataUrl);
      else localStorage.removeItem('sbc_quiz_photo');
    } catch (e) {}
  }, [quizPhotoDataUrl]);

  useEffect(() => {
    try {
      if (aiPhotoAnalysis) localStorage.setItem('aiPhotoAnalysis', JSON.stringify(aiPhotoAnalysis));
      else localStorage.removeItem('aiPhotoAnalysis');
    } catch (e) {}
  }, [aiPhotoAnalysis]);
  
  useEffect(() => {
    const safeUser = { ...userDetails, password: '' };
    localStorage.setItem('authUser', JSON.stringify(safeUser));
  }, [userDetails]);

  // General Boot Sequence
  useEffect(() => {
    const fetchBackendData = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/products`);
        if (response.ok) {
          const data = await response.json();
          setBackendProducts(data);
        }
      } catch (error) {
        console.error('Failed to connect to backend data:', error);
      }
    };
    fetchBackendData();
  }, []);

  const syncMemberBlueprintStatus = async (tokenToUse) => {
    const activeToken = tokenToUse || localStorage.getItem('token');
    if (!activeToken) return false;
    try {
      const resBp = await fetch(`${API_BASE_URL}/api/users/me/blueprint`, {
        headers: { 'Authorization': `Bearer ${activeToken}` }
      });
      if (resBp.ok) {
        const bpData = await resBp.json();
        if (bpData.hasCompletedQuiz && bpData.blueprint) {
          setHasCompletedQuiz(true);
          setQuizAnswers({
            skinType: bpData.blueprint.skinType || '',
            primaryGoal: bpData.blueprint.primaryGoal || '',
            climate: bpData.blueprint.climate || '',
            skinSensitivity: bpData.blueprint.skinSensitivity || '',
            complexion: bpData.blueprint.complexion || '',
            undertone: bpData.blueprint.undertone || '',
            eyeColor: bpData.blueprint.eyeColor || '',
            faceShape: bpData.blueprint.faceShape || '',
            makeupVibe: bpData.blueprint.makeupVibe || '',
            routineFocus: bpData.blueprint.routineFocus || ''
          });
          if (bpData.blueprintAnalysis || bpData.blueprint.blueprintAnalysis) {
            setBlueprintAnalysis(bpData.blueprintAnalysis || bpData.blueprint.blueprintAnalysis);
          }
          const remotePhoto = bpData.skinPhotoUrl || bpData.blueprint.skinPhotoUrl || '';
          if (remotePhoto) setQuizPhotoDataUrl(remotePhoto);
          const remotePhotoAi =
            bpData.aiPhotoAnalysis ||
            bpData.blueprint.aiPhotoAnalysis ||
            bpData.blueprintAnalysis?.aiPhotoAnalysis ||
            bpData.blueprint.blueprintAnalysis?.aiPhotoAnalysis ||
            null;
          if (remotePhotoAi) setAiPhotoAnalysis(remotePhotoAi);
          return true;
        } else {
          setHasCompletedQuiz(false);
          setBlueprintAnalysis(null);
          setAiPhotoAnalysis(null);
          return false;
        }
      }
    } catch (err) {
      console.error('Failed to sync member blueprint status:', err);
    }
    return false;
  };

  // Prevent Free ('basic') members or members who already completed their one-time Blueprint Quiz from accessing quiz steps 11-20
  useEffect(() => {
    if (step >= 11 && step <= 20) {
      if (isFreeBasicMember) {
        setStep(5);
        setActiveMemberTab('Blueprint');
        openPaywallModal("Upgrade to The Luminary Circle ($49/mo) or The Radiance Elite ($119/mo) to unlock Susan's 10-Step Beauty Blueprint Quiz.");
        return;
      }
      if (hasCompletedQuiz) {
        setStep(5);
        setActiveMemberTab('Blueprint');
      }
    }
    // eslint-disable-next-line
  }, [hasCompletedQuiz, step, isFreeBasicMember]);

  // Restore Dashboard state if a user refreshes mid-session
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const fetchDashboardData = async () => {
      try {
        const resMe = await fetch(`${API_BASE_URL}/api/users/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (resMe.status === 401 || resMe.status === 403) { handleLogOut(); return; }
        if (resMe.ok) {
          const meData = await resMe.json();
          if (meData.user) {
            setUserDetails(prev => ({
              ...prev,
              ...meData.user,
              password: ''
            }));
            setSelectedTier(meData.user.membershipTier || 'basic');
          }
        }

        await syncMemberBlueprintStatus(token);

        const resRecs = await fetch(`${API_BASE_URL}/api/users/me/recommendations`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (resRecs.status === 401 || resRecs.status === 403) { handleLogOut(); return; }
        if (resRecs.ok) setUserRecommendations(await resRecs.json());

        const resOrders = await fetch(`${API_BASE_URL}/api/users/me/orders`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (resOrders.ok) setUserOrders(await resOrders.json());

        const resInbox = await fetch(`${API_BASE_URL}/api/users/me/inbox`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (resInbox.ok) setInboxItems(await resInbox.json());

      } catch (err) {
        console.error('Failed to fetch dashboard data', err);
      }
    };

    if (step === 5 || (step >= 11 && step <= 20)) {
      fetchDashboardData();
    }
    // eslint-disable-next-line
  }, [step, activeMemberTab]);

  // Restore Admin Data if a user refreshes mid-session
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (step === 6 && token) {
      fetchAdminData(token);
    }
    // eslint-disable-next-line
  }, [step]);

  // Listen for SUSAN_SOCIAL_AUTH_COMPLETE messages posted from the OAuth 2.0 Popup Window
  useEffect(() => {
    const handleOAuthPopupMessage = async (event) => {
      const msg = event?.data;
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'SUSAN_SOCIAL_AUTH_ERROR' && msg.error) {
        alert(`Social Sign-Up Notice: ${msg.error}`);
        return;
      }
      if (msg.type === 'SUSAN_SOCIAL_AUTH_COMPLETE' && msg.token && msg.user) {
        const tierChosen = String(msg.membershipTier || selectedTier || 'basic').toLowerCase();
        const isPaidSub = Boolean(msg.isSubscribing) && ['luminary', 'radiance'].includes(tierChosen);
        await handleSocialAuthSuccess(
          { token: msg.token, user: msg.user, provider: msg.provider || 'google' },
          {
            tierOverride: tierChosen,
            subscribingOverride: isPaidSub,
            goToStep1: !isPaidSub && tierChosen === 'basic'
          }
        );
      }
    };
    window.addEventListener('message', handleOAuthPopupMessage);
    return () => window.removeEventListener('message', handleOAuthPopupMessage);
    // eslint-disable-next-line
  }, [selectedTier]);

  // URL Parameter Catchers (Stripe Returns, Password Reset, and 6-Provider Social OAuth 2.0 Callbacks)
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);

    if (query.get('oauth_error')) {
      const errMsg = query.get('oauth_error');
      window.history.replaceState(null, '', window.location.pathname);
      alert(`Social Sign-In Notice: ${errMsg}`);
      setStep(4);
      return;
    }

    if (query.get('oauth_sandbox_provider')) {
      const sbProv = query.get('oauth_sandbox_provider');
      const sbTier = query.get('oauth_tier') || 'luminary';
      const sbSub = query.get('oauth_sub') === 'true';
      window.history.replaceState(null, '', window.location.pathname);
      setSelectedTier(sbTier);
      setIsSubscribing(sbSub);
      setOauthSandboxProvider(sbProv);
      if (![3, 4, 7].includes(step)) {
        setStep(4);
      }
      return;
    }

    // Catch URL hash #access_token=... if an Implicit Grant provider returns directly to the frontend
    if (window.location.hash && window.location.hash.includes('access_token=')) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const hashAccessToken = hashParams.get('access_token') || '';
      const hashIdToken = hashParams.get('id_token') || '';
      const pendingTier = sessionStorage.getItem('sbc_pending_oauth_tier') || selectedTier || 'basic';
      const pendingSub = sessionStorage.getItem('sbc_pending_oauth_subscribing') === 'true';
      window.history.replaceState(null, '', window.location.pathname);
      if (hashAccessToken || hashIdToken) {
        (async () => {
          try {
            const verifyRes = await fetch(`${API_BASE_URL}/api/auth/google/verify-token`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                accessToken: hashAccessToken,
                idToken: hashIdToken,
                membershipTier: pendingTier,
                isSubscribing: pendingSub
              })
            });
            const verifyData = await verifyRes.json().catch(() => ({}));
            if (verifyRes.ok && verifyData.token && verifyData.user) {
              await handleSocialAuthSuccess(
                { token: verifyData.token, user: verifyData.user, provider: 'google' },
                {
                  tierOverride: pendingTier,
                  subscribingOverride: pendingSub && ['luminary', 'radiance'].includes(String(pendingTier).toLowerCase()),
                  goToStep1: !pendingSub && String(pendingTier).toLowerCase() === 'basic'
                }
              );
            }
          } catch (e) {}
        })();
        return;
      }
    }

    if (query.get('oauth_token')) {
      const oauthToken = query.get('oauth_token');
      const oauthProvider = query.get('oauth_provider') || 'google';
      const subscribeTier = query.get('oauth_subscribe_tier') || '';
      window.history.replaceState(null, '', window.location.pathname);

      (async () => {
        try {
          localStorage.setItem('token', oauthToken);
          const meRes = await fetch(`${API_BASE_URL}/api/users/me`, {
            headers: { 'Authorization': `Bearer ${oauthToken}` }
          });
          if (meRes.ok) {
            const meData = await meRes.json();
            if (meData.user) {
              const isNewOAuthUser = query.get('oauth_is_new') === 'true';
              const resolvedOAuthTier = String(subscribeTier || meData.user.membershipTier || 'basic').toLowerCase();
              await handleSocialAuthSuccess(
                { token: oauthToken, user: meData.user, provider: oauthProvider },
                {
                  tierOverride: resolvedOAuthTier,
                  subscribingOverride: Boolean(subscribeTier) && ['luminary', 'radiance'].includes(resolvedOAuthTier),
                  goToStep1: isNewOAuthUser && !subscribeTier && resolvedOAuthTier === 'basic'
                }
              );
              return;
            }
          }
        } catch (err) {
          console.error('OAuth token hydration error:', err);
        }
      })();
      return;
    }
    
    if (query.get('success')) {
      const tierStr = String(query.get('tier') || 'luminary').toLowerCase().trim();
      const sessionId = String(query.get('session_id') || '').trim();
      window.history.replaceState(null, '', window.location.pathname);

      const token = localStorage.getItem('token');
      if (token) {
        (async () => {
          try {
            const confirmRes = await fetch(`${API_BASE_URL}/api/users/me/confirm-upgrade`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({ tier: tierStr, sessionId })
            });
            const confirmData = await confirmRes.json().catch(() => ({}));
            if (confirmRes.ok && confirmData.user) {
              setUserDetails(prev => ({ ...prev, ...confirmData.user, password: '' }));
              setSelectedTier(confirmData.user.membershipTier || tierStr);
              setIsSubscribing(true);
              setPaywallModal({ isOpen: false, featureContext: '' });
            } else {
              alert(
                confirmData.error ||
                  'Your Stripe Checkout session could not be verified. Please complete checkout to activate your paid tier.'
              );
            }
          } catch (e) {
            console.error('Stripe confirm-upgrade verification error:', e);
          }
          setStep(5);
        })();
      } else {
        setStep(4);
      }
    }

    if (query.get('portal_return')) {
      window.history.replaceState(null, '', window.location.pathname);
      const token = localStorage.getItem('token');
      if (token) {
        setStep(5);
        setActiveMemberTab('Account Info');
      }
    }

    if (query.get('canceled')) {
      window.history.replaceState(null, '', window.location.pathname);
      const token = localStorage.getItem('token');
      if (token) {
        setStep(5);
        setActiveMemberTab('Boutique');
      } else {
        setStep(0);
      }
    }
    
    if (query.get('cart_success')) {
       window.history.replaceState(null, '', window.location.pathname);
       setCart([]);
       alert("Thank you! Your ritual essentials are being prepared for you.");
    }

    if (query.get('reset_token')) {
       setResetToken(query.get('reset_token'));
       window.history.replaceState(null, '', window.location.pathname);
       setStep(9); 
    }
    // eslint-disable-next-line
  }, []);

  const fetchAdminData = async (token) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/dashboard`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 401 || res.status === 403) { handleLogOut(); return; }
      if (res.ok) {
        const data = await res.json();
        setAdminData(data);
      }
    } catch (error) {
      console.error('Failed to fetch admin data', error);
    }
  };

  const handleAddToCart = (product) => {
    if (product) {
      const meta = deriveProductBlueprintMeta(product);
      const itemPrice = Number(product.price ?? product.variants?.[0]?.price ?? 0);
      trackSiteEvent('ADD_TO_CART', {
        page: step === 5 ? `Member Sanctuary: ${activeMemberTab}` : 'Public Boutique',
        productId: product._id || null,
        productTitle: product.title || 'Untitled Product',
        ritualStep: meta.ritualStep,
        cartValueUsd: itemPrice
      });
    }
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.sku === product.sku);
      if (existingItem) {
        return prevCart.map(item => item.sku === product.sku ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prevCart, { ...product, quantity: 1 }];
    });
  };

  const handleUpdateQuantity = (sku, delta) => {
    setCart(prevCart => prevCart.map(item => {
      if (item.sku === sku) {
        const newQty = item.quantity + delta;
        return newQty > 0 ? { ...item, quantity: newQty } : null;
      }
      return item;
    }).filter(Boolean));
  };

  const handleRemoveFromCart = (sku) => {
    const removedItem = cart.find(item => item.sku === sku);
    if (removedItem) {
      trackSiteEvent('REMOVE_FROM_CART', {
        page: step === 5 ? `Member Sanctuary: ${activeMemberTab}` : 'Public Boutique',
        productId: removedItem._id || null,
        productTitle: removedItem.title || sku,
        cartValueUsd: Number(removedItem.price || 0)
      });
    }
    setCart(prevCart => prevCart.filter(item => item.sku !== sku));
  };

  const getActiveMemberDiscount = () => {
    const isSignedIn = Boolean(localStorage.getItem('token'));
    if (!isSignedIn) return { rate: 0, label: '' };
    const activeTier = String(userDetails.membershipTier || selectedTier || '').toLowerCase().trim();
    if (activeTier === 'radiance') {
      return { rate: 0.25, label: '25% Radiance Elite Member Discount' };
    }
    if (activeTier === 'luminary') {
      return { rate: 0.10, label: '10% Luminary Circle Member Discount' };
    }
    return { rate: 0, label: '' };
  };

  const [cartShippingInfo, setCartShippingInfo] = useState({
    loading: false,
    rates: buildClientDefaultCjCarriers(120),
    optimalCarrier: buildClientDefaultCjCarriers(120)[0],
    selectedLogisticName: 'CJPacket Sensitive Pro',
    shippingCostUsd: 7.84,
    showAllMethods: false
  });

  useEffect(() => {
    if (!Array.isArray(cart) || cart.length === 0) return;
    let cancelled = false;
    setCartShippingInfo(prev => ({ ...prev, loading: true }));
    fetch(`${API_BASE_URL}/api/cart/shipping-rates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: cart, countryCode: 'US' })
    })
      .then(r => r.json())
      .then(data => {
        if (cancelled || !data) return;
        const rates = Array.isArray(data.rates) && data.rates.length > 0 ? data.rates : buildClientDefaultCjCarriers(120);
        const opt = data.optimalCarrier || rates.find(r => r.isOptimal) || rates[0];
        setCartShippingInfo(prev => ({
          ...prev,
          loading: false,
          rates,
          optimalCarrier: opt,
          selectedLogisticName: opt?.logisticName || 'CJPacket Sensitive Pro',
          shippingCostUsd: Number(opt?.shippingCostUsd || 7.84)
        }));
      })
      .catch(() => {
        if (!cancelled) setCartShippingInfo(prev => ({ ...prev, loading: false }));
      });
    return () => {
      cancelled = true;
    };
  }, [cart]);

  const calculateCartSubtotal = () =>
    cart.reduce((total, item) => total + ((Number(item.price) || 0) * (Number(item.quantity) || 1)), 0);

  // Member discounts (10%/25%) apply ONLY to the product portion — never discounting the CJ shipping cost!
  const calculateCartTotal = () => {
    const { rate } = getActiveMemberDiscount();
    const total = cart.reduce((sum, item) => {
      const qty = Math.max(1, Number(item.quantity) || 1);
      const unitPrice = Math.max(0, Number(item.price) || 0);
      const unitShip = Math.max(5.25, Number(item.shippingCostUsd || cartShippingInfo.shippingCostUsd || 7.84));
      const unitWholesale = Math.max(0.85, Number(item.wholesalePriceUsd || 2.00));
      const productPortion = Math.max(unitWholesale + 6.00, unitPrice - unitShip);
      const discountedProductPortion = Number((productPortion * (1 - rate)).toFixed(2));
      const safeUnitTotal = Math.max(unitWholesale + unitShip + 6.00, discountedProductPortion + unitShip);
      return sum + (safeUnitTotal * qty);
    }, 0);
    return total.toFixed(2);
  };

  const handleCartCheckout = async () => {
    trackSiteEvent('CHECKOUT_INITIATED', {
      page: step === 5 ? `Member Sanctuary: ${activeMemberTab}` : 'Public Boutique',
      cartValueUsd: Number(calculateCartTotal()) || 0,
      metadata: {
        itemCount: cart.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0)
      }
    });
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const activeTier = String(userDetails.membershipTier || selectedTier || '').toLowerCase().trim();
      const res = await fetch(`${API_BASE_URL}/api/cart-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          items: cart,
          selectedLogisticName: cartShippingInfo.selectedLogisticName || 'CJPacket Sensitive Pro',
          ...(userDetails.email ? { customerEmail: userDetails.email } : {}),
          ...(activeTier ? { membershipTier: activeTier } : {})
        })
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Checkout initialization failed.');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Network error during checkout.');
    }
    setIsLoading(false);
  };

  const handleAnswer = (field, value) => {
    const updatedAnswers = { ...quizAnswers, [field]: value };
    setQuizAnswers(updatedAnswers);
    if (step < 20) setStep(step + 1); 
    else submitQuiz(updatedAnswers); 
  };

  const submitQuiz = async (finalData) => {
    if (hasCompletedQuiz) {
      setStep(5);
      return;
    }
    trackSiteEvent('QUIZ_COMPLETED', {
      page: 'Blueprint Quiz Completed',
      metadata: {
        skinType: finalData?.skinType || '',
        primaryGoal: finalData?.primaryGoal || '',
        skinSensitivity: finalData?.skinSensitivity || '',
        climate: finalData?.climate || ''
      }
    });
    setStep(21); 
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const payloadToSend = {
        ...finalData,
        ...((effectiveMemberTier === 'radiance' || effectiveMemberTier === 'admin') && quizPhotoDataUrl
          ? { skinPhotoDataUrl: quizPhotoDataUrl }
          : {})
      };
      const res = await fetch(`${API_BASE_URL}/api/consultations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payloadToSend), 
      });
      if (res.ok) {
        const savedConsultation = await res.json().catch(() => ({}));
        if (savedConsultation?.blueprintAnalysis) {
          setBlueprintAnalysis(savedConsultation.blueprintAnalysis);
        }
        if (savedConsultation?.aiPhotoAnalysis || savedConsultation?.blueprintAnalysis?.aiPhotoAnalysis) {
          setAiPhotoAnalysis(savedConsultation.aiPhotoAnalysis || savedConsultation.blueprintAnalysis.aiPhotoAnalysis);
        }
        if (savedConsultation?.skinPhotoUrl) {
          setQuizPhotoDataUrl(savedConsultation.skinPhotoUrl);
        }
      } else if (res.status === 402) {
        setIsLoading(false);
        setStep(5);
        setActiveMemberTab('Blueprint');
        openPaywallModal("Upgrade to The Luminary Circle ($49/mo) or The Radiance Elite ($119/mo) to unlock and save your Personalized Beauty Blueprint.");
        return;
      } else if (res.status === 403) {
        const lockedData = await res.json().catch(() => ({}));
        if (lockedData.blueprint) {
          setQuizAnswers({
            skinType: lockedData.blueprint.skinType || '',
            primaryGoal: lockedData.blueprint.primaryGoal || '',
            climate: lockedData.blueprint.climate || '',
            skinSensitivity: lockedData.blueprint.skinSensitivity || '',
            complexion: lockedData.blueprint.complexion || '',
            undertone: lockedData.blueprint.undertone || '',
            eyeColor: lockedData.blueprint.eyeColor || '',
            faceShape: lockedData.blueprint.faceShape || '',
            makeupVibe: lockedData.blueprint.makeupVibe || '',
            routineFocus: lockedData.blueprint.routineFocus || ''
          });
          if (lockedData.blueprintAnalysis || lockedData.blueprint.blueprintAnalysis) {
            setBlueprintAnalysis(lockedData.blueprintAnalysis || lockedData.blueprint.blueprintAnalysis);
          }
        }
      }
    } catch (error) {
      console.error('Failed to save consultation to backend:', error);
    }
    setTimeout(() => { 
      setIsLoading(false); 
      setHasCompletedQuiz(true);
      setStep(5);
    }, 2500);
  };

  const handleInputChange = (e) => setUserDetails({ ...userDetails, [e.target.name]: e.target.value });
  const handleLoginInputChange = (e) => setLoginCredentials({ ...loginCredentials, [e.target.name]: e.target.value });

  // Triggers a live Stripe subscription checkout for an existing signed-in Free ('basic') or Luminary member upgrading tiers
  const handleTriggerStripeUpgrade = async (targetTier = 'luminary') => {
    const cleanTargetTier = String(targetTier || 'luminary').toLowerCase().trim() === 'radiance' ? 'radiance' : 'luminary';
    const token = localStorage.getItem('token');
    if (!token) {
      setSelectedTier(cleanTargetTier);
      setIsSubscribing(true);
      closePaywallModal();
      setStep(3);
      return;
    }

    setIsUpgradingTier(true);
    try {
      const stripeRes = await fetch(`${API_BASE_URL}/api/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ tier: cleanTargetTier })
      });
      const stripeData = await stripeRes.json().catch(() => ({}));
      if (stripeRes.ok && stripeData.url) {
        window.location.href = stripeData.url;
        return;
      }

      alert(
        stripeData.error ||
          'Unable to start Stripe Checkout session. Please verify your STRIPE_SECRET_KEY configuration on the server.'
      );
    } catch (err) {
      console.error('Membership upgrade error:', err);
      alert('Network error while connecting to Stripe Checkout.');
    }
    setIsUpgradingTier(false);
  };

  const handleCreateAccount = async () => {
    setIsLoading(true);
    try {
      const regRes = await fetch(`${API_BASE_URL}/api/users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...userDetails, membershipTier: selectedTier })
      });
      const regData = await regRes.json();
      
      if (!regRes.ok) {
        alert(regData.error || 'Failed to create account');
        setIsLoading(false);
        return;
      }

      localStorage.setItem('token', regData.token);
      setHasCompletedQuiz(false);
      
      // Account starts at 'basic' until Stripe Checkout confirms payment
      setUserDetails(prev => ({ 
        ...prev,
        ...regData.user,
        name: regData.user.name, 
        email: regData.user.email,
        membershipTier: regData.user.membershipTier || 'basic',
        password: ''
      }));

      if (isSubscribing) {
        const stripeRes = await fetch(`${API_BASE_URL}/api/create-checkout-session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${regData.token}` },
          body: JSON.stringify({ tier: selectedTier }),
        });
        
        const stripeData = await stripeRes.json().catch(() => ({}));
        if (stripeData.url) {
          window.location.href = stripeData.url;
          return;
        }
      }
      setIsLoading(false);
      setStep(5);
    } catch (err) {
      console.error('Failed to save user account:', err);
      setIsLoading(false);
    }
  };

  const handleFreeMembershipSubmit = async () => {
    setIsLoading(true);
    try {
      const regRes = await fetch(`${API_BASE_URL}/api/users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...userDetails, membershipTier: 'basic' })
      });
      const regData = await regRes.json();
      
      if (!regRes.ok) {
        alert(regData.error || 'Failed to create account');
        setIsLoading(false);
        return;
      }

      localStorage.setItem('token', regData.token);
      setHasCompletedQuiz(false);
      setSelectedTier('basic');
      setIsSubscribing(false);
      setUserDetails(prev => ({
        ...prev,
        ...regData.user,
        name: regData.user?.name || prev.name,
        email: regData.user?.email || prev.email,
        membershipTier: 'basic',
        role: regData.user?.role || 'client',
        password: ''
      }));
      setIsLoading(false);
      setActiveMemberTab('Blueprint');
      setStep(5); 
    } catch (err) {
      console.error('Failed to save user account:', err);
      setIsLoading(false);
      alert('Network error during registration.');
    }
  };

  const handleLoginSubmit = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginCredentials)
      });
      const data = await res.json();
      
      if (res.ok) {
        localStorage.setItem('token', data.token);
        const actualTier = data.user.membershipTier || 'basic';
        setUserDetails(prev => ({ 
          ...prev,
          ...data.user,
          name: data.user.name, 
          email: data.user.email,
          membershipTier: actualTier,
          role: data.user.role || 'client',
          password: ''
        }));
        setSelectedTier(actualTier);
        setIsSubscribing(actualTier !== 'basic' && actualTier !== 'admin');
        
        const userRole = data.user.role;
        const isLegacyAdmin = actualTier === 'admin';
        
        if (userRole === 'admin' || isLegacyAdmin) {
          setStep(6);
          fetchAdminData(data.token);
        } else {
          await syncMemberBlueprintStatus(data.token);
          setStep(5);
        }
      } else {
        alert(data.error || 'Login failed');
      }
    } catch (err) {
      alert('An error occurred while logging in');
    }
    setIsLoading(false);
  };

  const handleSocialAuthSuccess = async (data, options = {}) => {
    if (!data || !data.token || !data.user) return;
    setIsLoading(true);
    try {
      localStorage.setItem('token', data.token);
      const userObj = data.user;
      const userRole = userObj.role || 'client';
      const isSusanAdmin = userRole === 'admin' || userObj.membershipTier === 'admin';
      const actualDbTier = isSusanAdmin ? 'admin' : (userObj.membershipTier || 'basic');
      const requestedPaidTier = options.tierOverride || selectedTier || 'luminary';

      setUserDetails(prev => ({
        ...prev,
        ...userObj,
        name: userObj.name || prev.name,
        email: userObj.email || prev.email,
        membershipTier: actualDbTier,
        role: isSusanAdmin ? 'admin' : userRole,
        authProvider: userObj.authProvider || data.provider || 'local',
        avatarUrl: userObj.avatarUrl || '',
        socialProfiles: userObj.socialProfiles || {},
        password: ''
      }));

      setSelectedTier(actualDbTier);

      if (isSusanAdmin) {
        setIsSubscribing(false);
        setStep(6);
        fetchAdminData(data.token);
        setIsLoading(false);
        return;
      }

      if (options.subscribingOverride && ['luminary', 'radiance'].includes(String(requestedPaidTier).toLowerCase())) {
        setIsSubscribing(true);
        const stripeRes = await fetch(`${API_BASE_URL}/api/create-checkout-session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${data.token}`
          },
          body: JSON.stringify({ tier: String(requestedPaidTier).toLowerCase() })
        });
        const stripeData = await stripeRes.json().catch(() => ({}));
        if (stripeData.url) {
          window.location.href = stripeData.url;
          return;
        }
      }

      setIsSubscribing(actualDbTier === 'luminary' || actualDbTier === 'radiance');
      await syncMemberBlueprintStatus(data.token);
      setIsLoading(false);
      setStep(5);
    } catch (err) {
      console.error('Social auth completion error:', err);
    }
    setIsLoading(false);
  };

  const handleLogOut = () => {
    // Clear out the browser memory
    localStorage.removeItem('token');
    localStorage.removeItem('authUser');
    localStorage.removeItem('currentStep');
    localStorage.removeItem('ritualCart');
    localStorage.removeItem('activeMemberTab');
    localStorage.removeItem('hasCompletedQuiz');
    localStorage.removeItem('quizAnswers');
    localStorage.removeItem('blueprintAnalysis');
    localStorage.removeItem('sbc_quiz_photo');
    localStorage.removeItem('aiPhotoAnalysis');
    localStorage.removeItem('adminActiveTab');
    setQuizPhotoDataUrl('');
    setAiPhotoAnalysis(null);

    // Reset all states back to default
    setUserDetails({ name: '', email: '', password: '', membershipTier: '', role: 'client' });
    setLoginCredentials({ email: '', password: '' });
    setSelectedTier('luminary');
    setHasCompletedQuiz(false);
    setCart([]);
    setAdminData({ users: [], blueprints: [], orders: [] });
    setUserRecommendations([]);
    setUserOrders([]);
    setInboxItems([]);
    
    // Send them back to the front porch
    setStep(0);
  };

  const handleForgotPassword = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message + ' ✧');
        setStep(0);
      } else {
        alert(data.error || 'Failed to send reset email.');
      }
    } catch (error) {
      alert('Network error while requesting password reset.');
    }
    setIsLoading(false);
  };

  const handleResetPassword = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/reset-password/${resetToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: resetPassword })
      });
      const data = await res.json();
      if (res.ok) {
        alert('Password reset successfully. Please log in with your new password. ✧');
        setStep(4);
      } else {
        alert(data.error || 'Failed to reset password.');
      }
    } catch (error) {
      alert('Network error while resetting password.');
    }
    setIsLoading(false);
  };

  const currentPathname = typeof window !== 'undefined' ? String(window.location.pathname || '').toLowerCase() : '';
  if (currentPathname === '/privacy' || currentPathname === '/terms') {
    const isPrivacy = currentPathname === '/privacy';
    return (
      <div style={{ width: '100%', minHeight: '100vh', backgroundColor: '#FFF9F9', padding: '40px 20px', boxSizing: 'border-box', fontFamily: "'Cormorant Garamond', serif", color: '#5C5454' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto', backgroundColor: '#FFFFFF', border: '1.5px solid #E8C5C8', borderRadius: '24px', padding: '40px 36px', boxShadow: '0 15px 40px rgba(179, 139, 143, 0.18)', textAlign: 'left' }}>
          <h1 style={{ color: '#B38B8F', fontSize: '2.4rem', margin: '0 0 6px 0' }}>
            {isPrivacy ? "Privacy Policy — Susan's Beauty Consulting" : "Terms of Service — Susan's Beauty Consulting"}
          </h1>
          <p style={{ fontFamily: 'sans-serif', fontSize: '0.88rem', color: '#8A797A', borderBottom: '1px solid #E8C5C8', paddingBottom: '14px', marginBottom: '22px' }}>
            Effective Date: October 2026 • Domain: susansbeautyconsulting.com
          </p>
          {isPrivacy ? (
            <div style={{ fontFamily: 'sans-serif', fontSize: '0.95rem', lineHeight: '1.7' }}>
              <h3 style={{ color: '#5C5454' }}>1. Information We Collect</h3>
              <p>When you sign in or create a membership with Susan's Beauty Consulting using Google, Facebook, LinkedIn, X, TikTok, Reddit, or email/password, we collect your basic profile information (name, email address, and profile avatar) and your Personalized Beauty Blueprint preferences.</p>
              <h3 style={{ color: '#5C5454' }}>2. How We Use Your Information</h3>
              <p>We use your information exclusively to create and authenticate your membership account, personalize your skincare and beauty recommendations, fulfill your boutique and subscription box orders, and send transactional account updates.</p>
              <h3 style={{ color: '#5C5454' }}>3. Data Protection & Security</h3>
              <p>We never sell or rent your personal data. Payment processing is handled securely via Stripe, and social sign-in is authenticated via official OAuth 2.0 endpoints.</p>
              <h3 style={{ color: '#5C5454' }}>4. Contact & Account Deletion</h3>
              <p>You may request access to, correction of, or deletion of your account data at any time by contacting <strong>susan.coke@susansbeautyconsulting.com</strong>.</p>
            </div>
          ) : (
            <div style={{ fontFamily: 'sans-serif', fontSize: '0.95rem', lineHeight: '1.7' }}>
              <h3 style={{ color: '#5C5454' }}>1. Membership & Boutique Services</h3>
              <p>Susan's Beauty Consulting provides personalized skincare and beauty consultations, curated membership ritual boxes (Free Membership, The Luminary Circle, and The Radiance Elite), and boutique skincare essentials.</p>
              <h3 style={{ color: '#5C5454' }}>2. Account Registration & Social Sign-In</h3>
              <p>You may register or sign in using your email address or an authorized social account (Google, Facebook, LinkedIn, X, TikTok, or Reddit). You are responsible for maintaining the confidentiality of your account credentials.</p>
              <h3 style={{ color: '#5C5454' }}>3. Subscriptions, Billing & Cancellations</h3>
              <p>Paid memberships (Luminary Circle and Radiance Elite) are billed monthly via Stripe and may be managed or cancelled at any time from your Member Sanctuary dashboard or by contacting support.</p>
              <h3 style={{ color: '#5C5454' }}>4. Contact Information</h3>
              <p>For questions regarding these Terms, please contact <strong>susan.coke@susansbeautyconsulting.com</strong>.</p>
            </div>
          )}
          <div style={{ marginTop: '28px' }}>
            <button
              type="button"
              onClick={() => { window.location.href = '/'; }}
              style={{ backgroundColor: '#F2D4D7', border: '1px solid #B38B8F', borderRadius: '22px', padding: '10px 22px', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.15rem', fontWeight: 'bold', color: '#5C5454', cursor: 'pointer' }}
            >
              ← Return to Susan's Beauty Consulting
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', minHeight: '100vh', display: 'flex', alignItems: 'center', position: 'relative' }}>
      
      <GlobalPublicLaunchStyles />
      {isLoading && <FallingSparkles/>}

      <MembershipUpgradeModal
        isOpen={paywallModal.isOpen}
        onClose={closePaywallModal}
        featureContext={paywallModal.featureContext}
        currentTier={effectiveMemberTier}
        isUpgrading={isUpgradingTier}
        onSelectUpgradeTier={handleTriggerStripeUpgrade}
      />

      <ProductDetailModal product={selectedProduct} onClose={() => setSelectedProduct(null)} onAddToCart={handleAddToCart} userBlueprint={quizAnswers} hasCompletedQuiz={hasCompletedQuiz} />

      {step === 1 && (
        <div style={{ position: 'fixed', top: '30px', right: '30px', zIndex: 1000 }}>
          <button
            onClick={() => setIsCartOpen(!isCartOpen)}
            style={{ backgroundColor: '#F2D4D7', border: '1px solid #B38B8F', borderRadius: '30px', padding: '10px 22px', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.1rem', color: '#5C5454', cursor: 'pointer', boxShadow: '0 4px 15px rgba(232, 197, 200, 0.4)', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <span>🛍️ Ritual Bag</span>
            <span style={{ backgroundColor: '#B38B8F', color: '#FFFFFF', borderRadius: '50%', padding: '2px 8px', fontSize: '0.9rem', fontWeight: 'bold' }}>
              {cart.reduce((sum, item) => sum + item.quantity, 0)}
            </span>
          </button>
        </div>
      )}

      {isCartOpen && (
        <div className="ritual-bag-drawer" style={{ position: 'fixed', top: 0, right: 0, width: '380px', height: '100vh', backgroundColor: '#FFF9F9', borderLeft: '1px solid #E8C5C8', boxShadow: '-5px 0 25px rgba(232, 197, 200, 0.3)', zIndex: 1100, display: 'flex', flexDirection: 'column', padding: '25px', boxSizing: 'border-box', animation: 'fadeIn 0.3s ease' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E8C5C8', paddingBottom: '15px' }}>
            <h3 style={{ fontFamily: "'Alex Brush', cursive", fontSize: '2.5rem', color: '#B38B8F', margin: 0 }}>Your Ritual Bag</h3>
            <button onClick={() => setIsCartOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#8A797A' }}>✕</button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', margin: '20px 0' }}>
            {cart.length === 0 ? (
              <p style={{ fontFamily: "'Cormorant Garamond', serif", color: '#8A797A', fontStyle: 'italic', textAlign: 'center', marginTop: '50px' }}>Your ritual bag is currently empty.</p>
            ) : (
              cart.map((item) => (
                <div key={item.sku} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px solid rgba(232, 197, 200, 0.3)', paddingBottom: '15px' }}>
                  <div style={{ flex: 1, paddingRight: '10px' }}>
                    <h4 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.1rem', color: '#5C5454', margin: '0 0 5px 0' }}>
                      {item.title || 'Product'} {item.selectedVariantName && item.selectedVariantName !== item.sku ? `(${item.selectedVariantName})` : ''}
                    </h4>
                    <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1rem', color: '#B38B8F', margin: 0, fontWeight: 'bold' }}>
                      ${(item.price * item.quantity).toFixed(2)}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button onClick={() => handleUpdateQuantity(item.sku, -1)} style={{ background: '#F2D4D7', border: '1px solid #E8C5C8', borderRadius: '5px', cursor: 'pointer', width: '25px', height: '25px' }}>-</button>
                    <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.1rem', color: '#5C5454' }}>{item.quantity}</span>
                    <button onClick={() => handleUpdateQuantity(item.sku, 1)} style={{ background: '#F2D4D7', border: '1px solid #E8C5C8', borderRadius: '5px', cursor: 'pointer', width: '25px', height: '25px' }}>+</button>
                    <button onClick={() => handleRemoveFromCart(item.sku)} style={{ background: 'none', border: 'none', color: '#A89999', cursor: 'pointer', fontSize: '1rem', marginLeft: '5px' }}>🗑️</button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={{ borderTop: '1px solid #E8C5C8', paddingTop: '18px' }}>
            {(() => {
              const subtotal = calculateCartSubtotal();
              const { rate, label } = getActiveMemberDiscount();
              const discountAmount = subtotal * rate;
              return (
                <>
                  {rate > 0 && cart.length > 0 && (
                    <div style={{ marginBottom: '12px', padding: '10px 12px', backgroundColor: '#FFF0F2', borderRadius: '10px', border: '1px solid #E8C5C8' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', color: '#736A6A', marginBottom: '4px' }}>
                        <span>Subtotal:</span>
                        <span>${subtotal.toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', color: '#B38B8F', fontWeight: 'bold' }}>
                        <span>✧ {label}:</span>
                        <span>-${discountAmount.toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.3rem', color: '#5C5454' }}>Total:</span>
                    <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.5rem', fontWeight: 'bold', color: '#B38B8F' }}>${calculateCartTotal()}</span>
                  </div>
                  {cart.length > 0 && (
                    <div style={{ backgroundColor: '#F6FBF7', border: '1px solid #A5D6A7', borderRadius: '10px', padding: '9px 11px', marginBottom: '12px', fontFamily: 'sans-serif', fontSize: '0.76rem', color: '#5C5454' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                        <span>
                          ✈️ <strong>Auto-Selected Optimal Shipping:</strong>
                        </span>
                        <span style={{ color: '#2E7D32', fontWeight: 'bold' }}>
                          Included (${Number(cartShippingInfo.shippingCostUsd || 7.84).toFixed(2)})
                        </span>
                      </div>
                      <div style={{ marginTop: '3px', color: '#2E7D32', fontWeight: 'bold', fontSize: '0.78rem' }}>
                        ★ {cartShippingInfo.selectedLogisticName} ({cartShippingInfo.optimalCarrier?.deliveryTime || '5-11 Days'} • Least Expensive & Most Efficient)
                      </div>
                      <button
                        type="button"
                        onClick={() => setCartShippingInfo(prev => ({ ...prev, showAllMethods: !prev.showAllMethods }))}
                        style={{ marginTop: '5px', background: 'none', border: 'none', padding: 0, color: '#B38B8F', fontSize: '0.72rem', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        {cartShippingInfo.showAllMethods
                          ? '▲ Hide all CJ shipping methods'
                          : `▼ View all ${(cartShippingInfo.rates || []).length} available CJ shipping methods & prices`}
                      </button>
                      {cartShippingInfo.showAllMethods && (
                        <div style={{ marginTop: '6px', maxHeight: '120px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '3px', borderTop: '1px solid #E8C5C8', paddingTop: '5px' }}>
                          {(cartShippingInfo.rates || []).map((r, idx) => {
                            const isOpt = r.logisticName === cartShippingInfo.selectedLogisticName;
                            return (
                              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', padding: '2px 4px', borderRadius: '4px', backgroundColor: isOpt ? '#FFFFFF' : 'transparent', fontWeight: isOpt ? 'bold' : 'normal', color: isOpt ? '#2E7D32' : '#736A6A' }}>
                                <span>{isOpt ? '★ ' : ''}{r.logisticName} ({r.deliveryTime || '5-11d'})</span>
                                <span>${Number(r.shippingCostUsd || 0).toFixed(2)}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                  <p style={{ margin: '0 0 14px 0', fontSize: '0.78rem', color: '#8A797A', textAlign: 'center', fontFamily: 'sans-serif' }}>
                    ✈️ Shipping address & phone collected securely at Stripe Checkout
                  </p>
                </>
              );
            })()}
            <button 
              onClick={handleCartCheckout}
              disabled={cart.length === 0}
              style={{ width: '100%', backgroundColor: cart.length === 0 ? '#E8C5C8' : '#F2D4D7', border: '1px solid #B38B8F', borderRadius: '25px', padding: '12px', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.2rem', color: '#5C5454', cursor: cart.length === 0 ? 'not-allowed' : 'pointer' }}
            >
              Secure Checkout ✧
            </button>
          </div>
        </div>
      )}

      <EmpowermentContainer>
        
        {step === 0 && (
          <div style={{ animation: 'fadeIn 1s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '25px' }}>
              <img src={logo} alt="Susan's Beauty Consulting Logo" style={{ width: '160px', height: '160px', objectFit: 'contain' }} />
            </div>
            <h1 style={{ fontSize: '4.8rem', margin: '0 0 20px 0', color: '#B38B8F', fontFamily: "'Alex Brush', cursive", fontWeight: '400', lineHeight: '1.1' }}>Susan's Beauty Consulting</h1>
            <p style={{ fontSize: '1.5rem', lineHeight: '1.9', fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', color: '#736A6A', margin: '15px auto', maxWidth: '680px' }}>Gracefully unveil the most luminous version of yourself. Through bespoke skincare rituals and refined makeup artistry, we illuminate your natural essence.</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '30px auto' }}>
              <div style={{ width: '80px', height: '1px', backgroundColor: '#E8C5C8' }}></div>
              <span style={{ color: '#E8C5C8', margin: '0 15px', fontSize: '1.2rem' }}>✧</span>
              <div style={{ width: '80px', height: '1px', backgroundColor: '#E8C5C8' }}></div>
            </div>
            
            <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '22px', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center' }}>
                <EmpowermentButton text="Free Membership" onClick={() => { setSelectedTier('basic'); setStep(7); }} />
                <EmpowermentButton text="Join Paid Membership" onClick={() => setStep(2)} />
              </div>

              {/* Landing Page Instant Social Membership Sign-Up Card */}
              <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.86)', border: '1.5px solid #E8C5C8', borderRadius: '24px', padding: '22px 26px', maxWidth: '540px', width: '100%', boxShadow: '0 10px 30px rgba(232, 197, 200, 0.22)', boxSizing: 'border-box' }}>
                <SocialAuthButtonGrid
                  mode="signup"
                  titleText="✨ Create Your Membership Instantly with Social Sign-Up"
                  showTierSelector={true}
                  selectedTier={selectedTier || 'basic'}
                  isSubscribing={['luminary', 'radiance'].includes(String(selectedTier || '').toLowerCase())}
                  onTierChange={(nextTier, nextSub) => {
                    setSelectedTier(nextTier);
                    setIsSubscribing(nextSub);
                  }}
                  onSocialAuthSuccess={(data) => {
                    const chosenTier = String(data.membershipTier || selectedTier || 'basic').toLowerCase();
                    const isPaid = ['luminary', 'radiance'].includes(chosenTier);
                    handleSocialAuthSuccess(data, {
                      tierOverride: chosenTier,
                      subscribingOverride: isPaid,
                      goToStep1: !isPaid
                    });
                  }}
                />
              </div>

              <p style={{ cursor: 'pointer', color: '#A89999', textDecoration: 'underline', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.15rem', transition: 'color 0.3s ease', marginTop: '4px' }} onClick={() => setStep(4)} onMouseOver={(e) => e.target.style.color = '#736A6A'} onMouseOut={(e) => e.target.style.color = '#A89999'}>
                Already a member? Sign in to your dashboard
              </p>
            </div>
          </div>
        )}

        {step === 1 && (
          <div style={{ animation: 'fadeIn 1s ease', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <img src={logo} alt="Logo" style={{ width: '60px', height: '60px', objectFit: 'contain' }} />
                <h1 style={{ fontSize: '3.8rem', margin: 0, color: '#B38B8F', fontFamily: "'Alex Brush', cursive", fontWeight: '400' }}>The Boutique</h1>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                {localStorage.getItem('token') && (
                  <button
                    onClick={() => setStep(5)}
                    style={{ backgroundColor: '#FFF0F2', border: '1px solid #B38B8F', borderRadius: '20px', padding: '8px 18px', color: '#5C5454', fontFamily: "'Cormorant Garamond', serif", fontWeight: 'bold', cursor: 'pointer', fontSize: '1.05rem' }}
                  >
                    📝 My Sanctuary →
                  </button>
                )}
                <button onClick={() => setStep(0)} style={{ background: 'none', border: '1px solid #E8C5C8', borderRadius: '20px', padding: '8px 20px', color: '#736A6A', fontFamily: "'Cormorant Garamond', serif", cursor: 'pointer', fontSize: '1.1rem', transition: 'all 0.3s ease' }} onMouseOver={(e) => { e.target.style.backgroundColor = '#F2D4D7'; }} onMouseOut={(e) => { e.target.style.backgroundColor = 'transparent'; }}>← Home</button>
              </div>
            </div>

            <BoutiqueSmartFilterSection
              products={backendProducts}
              quizAnswers={quizAnswers}
              hasCompletedQuiz={hasCompletedQuiz}
              boutiqueFilters={boutiqueFilters}
              setBoutiqueFilters={setBoutiqueFilters}
              onResetFilters={resetBoutiqueFilters}
              onAddToCart={handleAddToCart}
              onCardClick={setSelectedProduct}
              onGoToBlueprintTab={localStorage.getItem('token') ? () => { setActiveMemberTab('Blueprint'); setStep(5); } : null}
            />
          </div>
        )}

        {step === 2 && (
          <div style={{ animation: 'fadeIn 1.5s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '15px' }}>
              <img src={logo} alt="Logo" style={{ width: '100px', height: '100px', objectFit: 'contain' }} />
            </div>
            <h1 style={{ fontSize: '4.2rem', margin: '0 0 10px 0', color: '#B38B8F', fontFamily: "'Alex Brush', cursive", fontWeight: '400', lineHeight: '1.1' }}>Elevate Your Ritual</h1>
            <p style={{ fontSize: '1.4rem', lineHeight: '1.8', fontFamily: "'Cormorant Garamond', serif", color: '#736A6A', margin: '15px auto 35px', maxWidth: '600px' }}>Join our exclusive membership to unlock Susan's famous Personalized Beauty Consultation Quiz and bespoke product curation.</p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '30px', flexWrap: 'wrap', marginBottom: '35px' }}>
              <div style={{ border: '1px solid rgba(232, 197, 200, 0.6)', borderRadius: '20px', padding: '40px 30px', backgroundColor: 'rgba(255, 255, 255, 0.7)', flex: '1', minWidth: '300px', maxWidth: '400px', boxShadow: '0 10px 30px rgba(232, 197, 200, 0.15)' }}>
                <h3 style={{ fontSize: '2.2rem', color: '#8A797A', fontFamily: "'Cormorant Garamond', serif", margin: '0 0 10px 0' }}>The Luminary Circle</h3>
                <p style={{ fontSize: '1.8rem', color: '#5C5454', margin: '0 0 25px 0', fontFamily: "'Alex Brush', cursive" }}>$49 <span style={{fontSize: '1rem', fontFamily: 'sans-serif', fontStyle: 'italic', color: '#A89999'}}>/ month</span></p>
                <ul style={{ textAlign: 'left', listStyle: 'none', padding: 0, margin: '0 0 35px 0', color: '#736A6A', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.25rem', lineHeight: '2' }}>
                  <li><span style={{color: '#E8C5C8', marginRight: '10px'}}>✧</span> Full access to the Curation Quiz</li>
                  <li><span style={{color: '#E8C5C8', marginRight: '10px'}}>✧</span> 3-piece skin care ritual box</li>
                  <li><span style={{color: '#E8C5C8', marginRight: '10px'}}>✧</span> Quarterly 1-on-1 consultation</li>
                  <li><span style={{color: '#E8C5C8', marginRight: '10px'}}>✧</span> 10% boutique discount</li>
                </ul>
                <EmpowermentButton text="Select Luminary" onClick={() => { setSelectedTier('luminary'); setIsSubscribing(true); setStep(3); }} />
              </div>

              <div style={{ border: '1px solid rgba(179, 139, 143, 0.8)', borderRadius: '20px', padding: '40px 30px', backgroundColor: 'rgba(255, 255, 255, 0.9)', flex: '1', minWidth: '300px', maxWidth: '400px', boxShadow: '0 10px 30px rgba(179, 139, 143, 0.25)' }}>
                <h3 style={{ fontSize: '2.2rem', color: '#B38B8F', fontFamily: "'Cormorant Garamond', serif", margin: '0 0 10px 0', fontWeight: 'bold' }}>The Radiance Elite</h3>
                <p style={{ fontSize: '1.8rem', color: '#5C5454', margin: '0 0 25px 0', fontFamily: "'Alex Brush', cursive" }}>$119 <span style={{fontSize: '1rem', fontFamily: 'sans-serif', fontStyle: 'italic', color: '#A89999'}}>/ month</span></p>
                <ul style={{ textAlign: 'left', listStyle: 'none', padding: 0, margin: '0 0 35px 0', color: '#736A6A', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.25rem', lineHeight: '2' }}>
                  <li><span style={{color: '#B38B8F', marginRight: '10px'}}>✧</span> Full access to the Curation Quiz</li>
                  <li><span style={{color: '#B38B8F', marginRight: '10px'}}>✧</span> 5-piece premium skin care ritual box</li>
                  <li><span style={{color: '#B38B8F', marginRight: '10px'}}>✧</span> Monthly 1-on-1 consultations</li>
                  <li><span style={{color: '#B38B8F', marginRight: '10px'}}>✧</span> 25% off the boutique</li>
                </ul>
                <EmpowermentButton text="Select Radiance" onClick={() => { setSelectedTier('radiance'); setIsSubscribing(true); setStep(3); }} />
              </div>
            </div>

            <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.88)', border: '1.5px solid #E8C5C8', borderRadius: '24px', padding: '22px 26px', maxWidth: '540px', margin: '0 auto 25px auto', boxShadow: '0 8px 25px rgba(232, 197, 200, 0.2)' }}>
              <SocialAuthButtonGrid
                mode="subscribe"
                titleText="✨ Or Sign Up Directly for Your Chosen Membership Tier:"
                showTierSelector={true}
                selectedTier={selectedTier === 'basic' ? 'luminary' : selectedTier}
                isSubscribing={true}
                onTierChange={(nextTier, nextSub) => {
                  setSelectedTier(nextTier);
                  setIsSubscribing(nextSub);
                }}
                onSocialAuthSuccess={(data) => {
                  const chosenTier = String(data.membershipTier || selectedTier || 'luminary').toLowerCase();
                  const isPaid = ['luminary', 'radiance'].includes(chosenTier);
                  handleSocialAuthSuccess(data, {
                    tierOverride: chosenTier,
                    subscribingOverride: isPaid,
                    goToStep1: !isPaid
                  });
                }}
              />
            </div>
            
            <p style={{ cursor: 'pointer', color: '#A89999', textDecoration: 'underline', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.1rem', transition: 'color 0.3s ease' }} onClick={() => setStep(0)} onMouseOver={(e) => e.target.style.color = '#736A6A'} onMouseOut={(e) => e.target.style.color = '#A89999'}>← Back to Home</p>
          </div>
        )}

        {step === 3 && (
          <div style={{ animation: 'fadeIn 1s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '15px' }}>
              <img src={logo} alt="Logo" style={{ width: '100px', height: '100px', objectFit: 'contain' }} />
            </div>
            <h1 style={{ fontSize: '4.2rem', margin: '0 0 10px 0', color: '#B38B8F', fontFamily: "'Alex Brush', cursive", fontWeight: '400', lineHeight: '1.1' }}>
              Join {selectedTier === 'radiance' ? 'The Radiance Elite' : 'The Luminary Circle'}
            </h1>
            <p style={{ fontSize: '1.4rem', lineHeight: '1.8', fontFamily: "'Cormorant Garamond', serif", color: '#736A6A', margin: '15px auto 35px', maxWidth: '600px' }}>Enter your details below to create your account before proceeding to Stripe secure checkout.</p>

            {isLoading ? (
              <EmpowermentLoader text="Connecting to payment gateway..."/>
            ) : (
              <div style={{ maxWidth: '460px', margin: '0 auto' }}>
                <SocialAuthButtonGrid
                  mode="subscribe"
                  titleText="✨ 1-Click Social Sign-Up (Then Proceed to Stripe Checkout)"
                  showBottomDivider={true}
                  initialSandboxProvider={oauthSandboxProvider}
                  selectedTier={selectedTier}
                  isSubscribing={true}
                  onSocialAuthSuccess={(data) =>
                    handleSocialAuthSuccess(data, {
                      tierOverride: selectedTier,
                      subscribingOverride: true
                    })
                  }
                />

                <ElegantInput name="name" onChange={handleInputChange} placeholder="Your First Name" type="text" value={userDetails.name}/>
                <ElegantInput name="email" onChange={handleInputChange} placeholder="Email Address" type="email" value={userDetails.email}/>
                <ElegantInput name="password" onChange={handleInputChange} placeholder="Create a Password" type="password" value={userDetails.password}/>
                
                <div style={{ marginTop: '30px' }}>
                  <EmpowermentButton text="Proceed to Checkout" onClick={handleCreateAccount}/>
                </div>
                <p style={{ cursor: 'pointer', color: '#A89999', textDecoration: 'underline', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.1rem', marginTop: '20px', transition: 'color 0.3s ease' }} onClick={() => setStep(2)} onMouseOver={(e) => e.target.style.color = '#736A6A'} onMouseOut={(e) => e.target.style.color = '#A89999'}>← Back to Tiers</p>
              </div>
            )}
          </div>
        )}

        {step === 7 && (
          <div style={{ animation: 'fadeIn 1s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '15px' }}>
              <img src={logo} alt="Logo" style={{ width: '100px', height: '100px', objectFit: 'contain' }} />
            </div>
            <h1 style={{ fontSize: '4.2rem', margin: '0 0 10px 0', color: '#B38B8F', fontFamily: "'Alex Brush', cursive", fontWeight: '400', lineHeight: '1.1' }}>Free Membership</h1>
            <p style={{ fontSize: '1.4rem', lineHeight: '1.8', fontFamily: "'Cormorant Garamond', serif", color: '#736A6A', margin: '15px auto 25px', maxWidth: '600px' }}>Sign up instantly with your favorite social account or enter your details below to start shopping our curated boutique.</p>

            {isLoading ? (
              <EmpowermentLoader text="Creating your free membership..."/>
            ) : (
              <div style={{ maxWidth: '460px', margin: '0 auto' }}>
                <SocialAuthButtonGrid
                  mode="free"
                  titleText="✨ Instant 1-Click Free Membership Sign-Up"
                  showBottomDivider={true}
                  initialSandboxProvider={oauthSandboxProvider}
                  selectedTier="basic"
                  isSubscribing={false}
                  onSocialAuthSuccess={(data) =>
                    handleSocialAuthSuccess(data, {
                      tierOverride: 'basic',
                      subscribingOverride: false,
                      goToStep1: true
                    })
                  }
                />

                <ElegantInput name="name" onChange={handleInputChange} placeholder="Your First Name" type="text" value={userDetails.name}/>
                <ElegantInput name="email" onChange={handleInputChange} placeholder="Email Address" type="email" value={userDetails.email}/>
                <ElegantInput name="password" onChange={handleInputChange} placeholder="Create a Password" type="password" value={userDetails.password}/>
                
                <div style={{ marginTop: '30px' }}>
                  <EmpowermentButton text="Start Shopping ✧" onClick={handleFreeMembershipSubmit}/>
                </div>
                <p style={{ cursor: 'pointer', color: '#A89999', textDecoration: 'underline', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.1rem', marginTop: '20px', transition: 'color 0.3s ease' }} onClick={() => setStep(0)} onMouseOver={(e) => e.target.style.color = '#736A6A'} onMouseOut={(e) => e.target.style.color = '#A89999'}>← Back to Home</p>
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div style={{ animation: 'fadeIn 1s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '15px' }}>
              <img src={logo} alt="Logo" style={{ width: '100px', height: '100px', objectFit: 'contain' }} />
            </div>
            <h1 style={{ fontSize: '4.2rem', margin: '0 0 10px 0', color: '#B38B8F', fontFamily: "'Alex Brush', cursive", fontWeight: '400', lineHeight: '1.1' }}>Welcome Back</h1>
            <p style={{ fontSize: '1.4rem', lineHeight: '1.8', fontFamily: "'Cormorant Garamond', serif", color: '#736A6A', margin: '15px auto 25px', maxWidth: '600px' }}>Sign in to access your dashboard and personalized blueprint.</p>

            {isLoading ? (
              <EmpowermentLoader text="Verifying credentials securely..."/>
            ) : (
              <div style={{ maxWidth: '460px', margin: '0 auto' }}>
                <SocialAuthButtonGrid
                  mode="login"
                  showBottomDivider={true}
                  initialSandboxProvider={oauthSandboxProvider}
                  selectedTier={selectedTier}
                  isSubscribing={false}
                  onSocialAuthSuccess={(data) =>
                    handleSocialAuthSuccess(data, {
                      subscribingOverride: false
                    })
                  }
                />

                <ElegantInput name="email" onChange={handleLoginInputChange} placeholder="Email Address" type="email" value={loginCredentials.email}/>
                <ElegantInput name="password" onChange={handleLoginInputChange} placeholder="Password" type="password" value={loginCredentials.password}/>
                
                <div style={{ marginTop: '30px' }}>
                  <EmpowermentButton text="Sign In" onClick={handleLoginSubmit}/>
                </div>

                <p style={{ cursor: 'pointer', color: '#A89999', fontFamily: "'Cormorant Garamond', serif", fontSize: '1rem', marginTop: '20px', transition: 'color 0.3s ease' }} onClick={() => setStep(8)} onMouseOver={(e) => e.target.style.color = '#736A6A'} onMouseOut={(e) => e.target.style.color = '#A89999'}>Forgot your password?</p>

                <p style={{ cursor: 'pointer', color: '#A89999', textDecoration: 'underline', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.1rem', marginTop: '10px', transition: 'color 0.3s ease' }} onClick={() => setStep(0)} onMouseOver={(e) => e.target.style.color = '#736A6A'} onMouseOut={(e) => e.target.style.color = '#A89999'}>← Back to Home</p>
              </div>
            )}
          </div>
        )}

        {step === 8 && (
          <div style={{ animation: 'fadeIn 1s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '15px' }}>
              <img src={logo} alt="Logo" style={{ width: '100px', height: '100px', objectFit: 'contain' }} />
            </div>
            <h1 style={{ fontSize: '4.2rem', margin: '0 0 10px 0', color: '#B38B8F', fontFamily: "'Alex Brush', cursive", fontWeight: '400', lineHeight: '1.1' }}>Reset Password</h1>
            <p style={{ fontSize: '1.4rem', lineHeight: '1.8', fontFamily: "'Cormorant Garamond', serif", color: '#736A6A', margin: '15px auto 35px', maxWidth: '600px' }}>Enter your email address and we'll send you a link to securely reset your password.</p>

            {isLoading ? (
              <EmpowermentLoader text="Dispatching reset link..."/>
            ) : (
              <div style={{ maxWidth: '400px', margin: '0 auto' }}>
                <ElegantInput name="forgotEmail" onChange={(e) => setForgotEmail(e.target.value)} placeholder="Email Address" type="email" value={forgotEmail}/>
                
                <div style={{ marginTop: '35px' }}>
                  <EmpowermentButton text="Send Reset Link" onClick={handleForgotPassword}/>
                </div>

                <p style={{ cursor: 'pointer', color: '#A89999', textDecoration: 'underline', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.1rem', marginTop: '20px', transition: 'color 0.3s ease' }} onClick={() => setStep(4)} onMouseOver={(e) => e.target.style.color = '#736A6A'} onMouseOut={(e) => e.target.style.color = '#A89999'}>← Back to Sign In</p>
              </div>
            )}
          </div>
        )}

        {step === 9 && (
          <div style={{ animation: 'fadeIn 1s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '15px' }}>
              <img src={logo} alt="Logo" style={{ width: '100px', height: '100px', objectFit: 'contain' }} />
            </div>
            <h1 style={{ fontSize: '4.2rem', margin: '0 0 10px 0', color: '#B38B8F', fontFamily: "'Alex Brush', cursive", fontWeight: '400', lineHeight: '1.1' }}>Create New Password</h1>
            <p style={{ fontSize: '1.4rem', lineHeight: '1.8', fontFamily: "'Cormorant Garamond', serif", color: '#736A6A', margin: '15px auto 35px', maxWidth: '600px' }}>Enter your new security credentials below.</p>

            {isLoading ? (
              <EmpowermentLoader text="Updating secure credentials..."/>
            ) : (
              <div style={{ maxWidth: '400px', margin: '0 auto' }}>
                <ElegantInput name="resetPassword" onChange={(e) => setResetPassword(e.target.value)} placeholder="New Password (min 6 chars)" type="password" value={resetPassword}/>
                
                <div style={{ marginTop: '35px' }}>
                  <EmpowermentButton text="Update Password" onClick={handleResetPassword}/>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 5 && (
          <div className="sanctuary-shell" style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', background: 'inherit', backgroundColor: 'transparent', position: 'fixed', top: 0, left: 0, zIndex: 500, boxSizing: 'border-box' }}>
            
            {/* Sidebar Navigation */}
            <div className="sanctuary-sidebar" style={{ width: '260px', height: '100%', overflowY: 'auto', flexShrink: 0, backgroundColor: 'rgba(255, 255, 255, 0.78)', backdropFilter: 'blur(8px)', borderRight: '1px solid #E8C5C8', display: 'flex', flexDirection: 'column', padding: '30px 0', boxShadow: '2px 0 15px rgba(232, 197, 200, 0.2)', boxSizing: 'border-box' }}>
              <div style={{ textAlign: 'center', marginBottom: '25px' }}>
                <img src={logo} alt="Susan's Logo" style={{ width: '80px', height: '80px', objectFit: 'contain', marginBottom: '10px' }} />
                <h2 style={{ fontFamily: "'Alex Brush', cursive", color: '#B38B8F', fontSize: '2.5rem', margin: 0, fontWeight: '400' }}>My Sanctuary</h2>
              </div>

              <div className="sanctuary-nav-list" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', padding: '0 20px' }}>
                {['Blueprint', 'Boutique', 'Inbox', 'Consultations', 'Order History', 'Account Info'].map(tab => {
                  const isLockedForFree = isFreeBasicMember && tab === 'Consultations';
                  return (
                    <button
                      key={tab}
                      onClick={() => {
                        setActiveMemberTab(tab);
                        if (isLockedForFree) {
                          openPaywallModal("Upgrade to The Luminary Circle ($49/mo — Quarterly Consultations) or The Radiance Elite ($119/mo — Monthly Consultations) to book 1-on-1 sessions with Susan.");
                        }
                      }}
                      style={{
                        padding: '12px 18px', textAlign: 'left', border: 'none', borderRadius: '12px',
                        backgroundColor: activeMemberTab === tab ? '#F2D4D7' : 'transparent',
                        color: activeMemberTab === tab ? '#5C5454' : '#8A797A',
                        fontFamily: "'Cormorant Garamond', serif", fontSize: '1.2rem', cursor: 'pointer',
                        transition: 'all 0.3s ease', fontWeight: activeMemberTab === tab ? 'bold' : 'normal',
                        boxShadow: activeMemberTab === tab ? '0 4px 10px rgba(232, 197, 200, 0.3)' : 'none',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                      }}
                    >
                      <span>
                        {tab === 'Blueprint' && '📝 '}
                        {tab === 'Boutique' && '🛍️ '}
                        {tab === 'Inbox' && '💌 '}
                        {tab === 'Consultations' && '🎥 '}
                        {tab === 'Order History' && '📦 '}
                        {tab === 'Account Info' && '👤 '}
                        {tab}
                      </span>
                      {isLockedForFree && (
                        <span style={{ fontSize: '0.85rem', color: '#B38B8F' }} title="Paid Membership Required">
                          🔒
                        </span>
                      )}
                      {tab === 'Order History' && userOrders.length > 0 && (
                        <span style={{ fontSize: '0.75rem', fontFamily: 'sans-serif', backgroundColor: '#FFF0F2', color: '#B38B8F', border: '1px solid #E8C5C8', borderRadius: '12px', padding: '2px 8px', fontWeight: 'bold' }}>
                          {userOrders.length}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div style={{ padding: '20px 20px 0 20px' }}>
                <button onClick={handleLogOut} style={{ width: '100%', padding: '12px', border: '1px solid #E8C5C8', backgroundColor: 'transparent', color: '#736A6A', borderRadius: '12px', cursor: 'pointer', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.1rem', transition: 'all 0.3s ease' }} onMouseOver={(e) => { e.target.style.backgroundColor = '#FFF0F2'; }} onMouseOut={(e) => { e.target.style.backgroundColor = 'transparent'; }}>
                  Sign Out
                </button>
              </div>
            </div>

            {/* Main Content Area */}
            <div ref={memberContentRef} className="sanctuary-main" style={{ flex: 1, height: '100%', padding: '50px', overflowY: 'auto', WebkitOverflowScrolling: 'touch', boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '30px', borderBottom: '1px solid rgba(232, 197, 200, 0.4)', paddingBottom: '15px' }}>
                <h1 style={{ fontFamily: "'Cormorant Garamond', serif", color: '#5C5454', fontSize: '2.8rem', margin: 0 }}>
                  {activeMemberTab}
                </h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {userDetails.avatarUrl ? (
                      <img
                        src={userDetails.avatarUrl}
                        alt={userDetails.name || 'Member'}
                        onClick={() => setActiveMemberTab('Account Info')}
                        title="Click to manage your Profile Picture & Account Info"
                        style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #B38B8F', cursor: 'pointer', boxShadow: '0 2px 8px rgba(179, 139, 143, 0.25)' }}
                      />
                    ) : (
                      <div
                        onClick={() => setActiveMemberTab('Account Info')}
                        title="Click to upload a Profile Picture in Account Info"
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          backgroundColor: '#FFF0F2',
                          border: '1.5px solid #B38B8F',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#B38B8F',
                          fontWeight: 'bold',
                          fontFamily: "'Cormorant Garamond', serif",
                          fontSize: '1.15rem',
                          cursor: 'pointer'
                        }}
                      >
                        {(userDetails.name || userDetails.username || userDetails.email || 'M').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', color: '#A89999', fontSize: '1.2rem' }}>
                      Welcome, {userDetails.name || 'Valued Member'}
                    </span>
                    <span
                      onClick={() => {
                        if (effectiveMemberTier !== 'radiance') {
                          openPaywallModal(
                            effectiveMemberTier === 'luminary'
                              ? 'Upgrade to The Radiance Elite ($119/mo) for Monthly 1-on-1 Consultations, AI Skin Photo Analysis, and 25% off the Boutique!'
                              : 'Upgrade to The Luminary Circle ($49/mo) or The Radiance Elite ($119/mo) to unlock the Beauty Blueprint Quiz and 1-on-1 Consultations!'
                          );
                        }
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '4px 12px',
                        borderRadius: '16px',
                        fontSize: '0.78rem',
                        fontFamily: 'sans-serif',
                        fontWeight: 'bold',
                        cursor: effectiveMemberTier !== 'radiance' ? 'pointer' : 'default',
                        backgroundColor:
                          effectiveMemberTier === 'radiance'
                            ? '#F4F0FF'
                            : effectiveMemberTier === 'luminary'
                            ? '#FFF0F2'
                            : '#F7F2F2',
                        color:
                          effectiveMemberTier === 'radiance'
                            ? '#5E35B1'
                            : effectiveMemberTier === 'luminary'
                            ? '#B38B8F'
                            : '#736A6A',
                        border:
                          effectiveMemberTier === 'radiance'
                            ? '1.5px solid #D1C4E9'
                            : effectiveMemberTier === 'luminary'
                            ? '1.5px solid #B38B8F'
                            : '1px solid #E8C5C8'
                      }}
                      title={effectiveMemberTier !== 'radiance' ? 'Click to view tier upgrade options' : 'Radiance Elite Active'}
                    >
                      {effectiveMemberTier === 'radiance'
                        ? '💎 Radiance Elite (Monthly Consults • AI Vision • 25% Off)'
                        : effectiveMemberTier === 'luminary'
                        ? '✨ Luminary Circle (Quarterly Consults • 10% Off • Upgrade ↗)'
                        : '🌿 Free Member (Basic Access • Upgrade ↗)'}
                    </span>
                    {userDetails.authProvider && userDetails.authProvider !== 'local' && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#FFF0F2', border: '1px solid #E8C5C8', borderRadius: '16px', padding: '3px 10px', fontSize: '0.75rem', fontFamily: 'sans-serif', color: '#5C5454', fontWeight: 'bold' }}>
                        <SocialProviderBrandIcon provider={userDetails.authProvider} size={13} />
                        <span>
                          {SOCIAL_OAUTH_PROVIDERS_META.find(p => p.key === userDetails.authProvider)?.label || userDetails.authProvider} Verified ✧
                        </span>
                      </span>
                    )}
                  </div>
                  <button onClick={() => setIsCartOpen(!isCartOpen)} style={{ backgroundColor: '#F2D4D7', border: '1px solid #B38B8F', borderRadius: '30px', padding: '10px 22px', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.1rem', color: '#5C5454', cursor: 'pointer', boxShadow: '0 4px 15px rgba(232, 197, 200, 0.4)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>🛍️ Ritual Bag</span>
                    <span style={{ backgroundColor: '#B38B8F', color: '#FFFFFF', borderRadius: '50%', padding: '2px 8px', fontSize: '0.9rem', fontWeight: 'bold' }}>
                      {cart.reduce((sum, item) => sum + item.quantity, 0)}
                    </span>
                  </button>
                </div>
              </div>

              {/* TABS CONTENT */}
              
              {/* 1. BLUEPRINT TAB */}
              {activeMemberTab === 'Blueprint' && (
                <div style={{ animation: 'fadeIn 0.5s ease' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '25px' }}>
                    <p style={{ fontSize: '1.3rem', lineHeight: '1.6', fontFamily: "'Cormorant Garamond', serif", color: '#736A6A', margin: 0 }}>
                      {effectiveMemberTier === 'radiance'
                        ? "💎 Radiance Elite Member — Full Quiz, AI Photo Analysis & Monthly Consultations Unlocked."
                        : effectiveMemberTier === 'luminary'
                        ? "✨ Luminary Circle Member — Full Quiz & Quarterly Consultations Unlocked."
                        : "🌿 Free Sanctuary Member — Boutique & Account Access Active (Upgrade to Unlock Quiz & Consultations)."}
                    </p>
                    {isFreeBasicMember && (
                      <button
                        type="button"
                        onClick={() => openPaywallModal("Elevate your membership to Luminary Circle ($49/mo) or Radiance Elite ($119/mo) to unlock the Beauty Blueprint Quiz and 1-on-1 Consultations.")}
                        style={{
                          background: 'linear-gradient(135deg, #B38B8F 0%, #D4A5A9 100%)',
                          color: '#FFFFFF',
                          border: 'none',
                          padding: '9px 18px',
                          borderRadius: '20px',
                          fontFamily: "'Cormorant Garamond', serif",
                          fontSize: '1.05rem',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          boxShadow: '0 4px 12px rgba(179, 139, 143, 0.3)'
                        }}
                      >
                        ✨ Upgrade Membership ✧
                      </button>
                    )}
                  </div>

                  {!hasCompletedQuiz ? (
                    <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.88)', border: isFreeBasicMember ? '1.5px dashed #B38B8F' : '1px solid #E8C5C8', borderRadius: '18px', padding: '40px', boxShadow: '0 4px 15px rgba(232, 197, 200, 0.15)', marginBottom: '40px' }}>
                      {isFreeBasicMember && (
                        <span style={{ display: 'inline-block', backgroundColor: '#FFF0F2', color: '#B38B8F', border: '1px solid #B38B8F', borderRadius: '16px', padding: '4px 14px', fontSize: '0.78rem', fontWeight: 'bold', fontFamily: 'sans-serif', marginBottom: '12px' }}>
                          🔒 Paid Membership Feature • Luminary ($49/mo) & Radiance ($119/mo)
                        </span>
                      )}
                      <h3 style={{ fontSize: '2.2rem', color: '#5C5454', fontFamily: "'Cormorant Garamond', serif", margin: '0 0 15px 0' }}>
                        {isFreeBasicMember ? "Unlock Susan's Personalized Beauty Blueprint Quiz" : "Unlock Your Bespoke Routine"}
                      </h3>
                      <p style={{ fontSize: '1.2rem', color: '#736A6A', fontFamily: "'Cormorant Garamond', serif", marginBottom: '12px' }}>
                        {isFreeBasicMember
                          ? "Paid members receive exclusive access to Susan's 10-step Beauty Blueprint Quiz, custom AM/PM ritual architecture, and monthly curated skincare boxes."
                          : "As a paid member, you have exclusive access to Susan's Beauty Blueprint curation process. Take the quiz to generate your custom products."}
                      </p>
                      <p style={{ fontSize: '1rem', color: '#B38B8F', fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', marginBottom: '30px' }}>
                        🔒 Note: Your Beauty Blueprint is a one-time personal curation and will be permanently locked to your membership profile upon completion.
                      </p>
                      <EmpowermentButton
                        text={isFreeBasicMember ? "Unlock the Consultation Quiz 🔒" : "Start the Consultation"}
                        onClick={() => {
                          if (isFreeBasicMember) {
                            openPaywallModal("Upgrade to The Luminary Circle ($49/mo) or The Radiance Elite ($119/mo) to take Susan's 10-Step Personalized Beauty Blueprint Quiz.");
                            return;
                          }
                          if (!hasCompletedQuiz) setStep(11);
                        }}
                      />
                    </div>
                  ) : (() => {
                    const dossier = generateClientBlueprintDossier(quizAnswers, blueprintAnalysis);
                    const recLabels = dossier.recommendedLabels || {};
                    const shoppingBadges = Array.isArray(recLabels.allBadges) ? recLabels.allBadges : [];
                    const amSteps = Array.isArray(dossier.amRitual) ? dossier.amRitual : [];
                    const pmSteps = Array.isArray(dossier.pmRitual) ? dossier.pmRitual : [];
                    const heroList = Array.isArray(dossier.heroIngredients) ? dossier.heroIngredients : [];
                    const avoidList = Array.isArray(dossier.avoidIngredients) ? dossier.avoidIngredients : [];
                    const artistry = dossier.artistryProfile || {};
                    const activePhotoAi = aiPhotoAnalysis || dossier.aiPhotoAnalysis || blueprintAnalysis?.aiPhotoAnalysis || null;

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', marginBottom: '45px', textAlign: 'left' }}>
                        {/* Lock Status Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', padding: '12px 18px', backgroundColor: 'rgba(255, 255, 255, 0.9)', border: '1px solid #E8C5C8', borderRadius: '12px' }}>
                          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.15rem', color: '#5C5454', fontWeight: 'bold' }}>
                            🔒 Permanent Bespoke Beauty Blueprint Dossier — Locked to Your Personal Profile
                          </span>
                          <button
                            type="button"
                            onClick={() => jumpToBoutiqueWithFilter({ onlyBlueprintMatch: true })}
                            style={{ backgroundColor: '#F2D4D7', border: '1px solid #B38B8F', color: '#5C5454', padding: '6px 15px', borderRadius: '18px', fontFamily: "'Cormorant Garamond', serif", fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer' }}
                          >
                            ✨ Shop My Matched Boutique Essentials →
                          </button>
                        </div>

                        {/* Section 1: Executive Skin Archetype & Boutique Label Guide */}
                        <div style={{ backgroundColor: '#FFFFFF', border: '1.5px solid #B38B8F', borderRadius: '20px', padding: '28px', boxShadow: '0 8px 25px rgba(232, 197, 200, 0.2)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
                            <div>
                              <span style={{ fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', color: '#B38B8F', fontFamily: 'sans-serif' }}>
                                ✧ Your Bespoke Skin Archetype & Prescription
                              </span>
                              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2.3rem', color: '#5C5454', margin: '4px 0 0 0' }}>
                                {dossier.archetypeTitle}
                              </h2>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              {recLabels.routineTier && (
                                <span style={{ backgroundColor: '#FFF0F2', color: '#B38B8F', border: '1px solid #E8C5C8', padding: '5px 12px', borderRadius: '15px', fontSize: '0.8rem', fontWeight: 'bold', fontFamily: 'sans-serif' }}>
                                  ✨ {recLabels.routineTier}
                                </span>
                              )}
                              {recLabels.climateContext && (
                                <span style={{ backgroundColor: '#FFF9F9', color: '#5C5454', border: '1px solid #E8C5C8', padding: '5px 12px', borderRadius: '15px', fontSize: '0.8rem', fontFamily: 'sans-serif' }}>
                                  🌤️ {recLabels.climateContext}
                                </span>
                              )}
                            </div>
                          </div>

                          <p style={{ fontFamily: 'sans-serif', fontSize: '0.98rem', color: '#5C5454', lineHeight: '1.65', margin: '0 0 20px 0', backgroundColor: '#FFF9F9', padding: '16px 18px', borderRadius: '12px', borderLeft: '4px solid #B38B8F' }}>
                            {dossier.executiveSummary}
                          </p>

                          {/* Clickable Boutique Label Guide */}
                          <div style={{ backgroundColor: '#FFF0F2', borderRadius: '14px', padding: '18px 20px', border: '1px solid #E8C5C8' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                              <div>
                                <strong style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.35rem', color: '#5C5454', display: 'block' }}>
                                  🏷️ Your Boutique Product Label Cheat-Sheet
                                </strong>
                                <span style={{ fontSize: '0.85rem', color: '#736A6A', fontFamily: 'sans-serif' }}>
                                  Every product in the Boutique is tagged by Skin Type and Skin Condition. Click any badge below to shop matching products:
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => jumpToBoutiqueWithFilter({ onlyBlueprintMatch: true })}
                                style={{ backgroundColor: '#B38B8F', color: '#FFFFFF', border: 'none', padding: '8px 16px', borderRadius: '18px', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.02rem', fontWeight: 'bold', cursor: 'pointer' }}
                              >
                                ✨ Filter Boutique by All My Labels →
                              </button>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px' }}>
                              {shoppingBadges.map((b, idx) => (
                                <div
                                  key={idx}
                                  onClick={() => {
                                    if (b.filterType === 'skinType') {
                                      jumpToBoutiqueWithFilter({ skinType: b.filterValue });
                                    } else if (b.filterType === 'skinConcern') {
                                      jumpToBoutiqueWithFilter({ skinConcern: b.filterValue });
                                    } else if (b.filterType === 'sensitivity') {
                                      jumpToBoutiqueWithFilter({ onlySensitiveSafe: b.filterValue === 'safe' });
                                    } else {
                                      jumpToBoutiqueWithFilter({ onlyBlueprintMatch: true });
                                    }
                                  }}
                                  style={{
                                    backgroundColor: '#FFFFFF',
                                    border: '1.5px solid #B38B8F',
                                    borderRadius: '12px',
                                    padding: '12px 14px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between',
                                    gap: '6px',
                                    transition: 'transform 0.2s ease'
                                  }}
                                  onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
                                  onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
                                >
                                  <div>
                                    <span style={{ fontSize: '0.7rem', color: '#8A797A', fontFamily: 'sans-serif', fontWeight: 'bold', textTransform: 'uppercase' }}>
                                      {b.category}
                                    </span>
                                    <strong style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.2rem', color: '#5C5454', marginTop: '2px' }}>
                                      ✓ {b.label}
                                    </strong>
                                    <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#736A6A', fontFamily: 'sans-serif', lineHeight: '1.4' }}>
                                      {b.description}
                                    </p>
                                  </div>
                                  <span style={{ fontSize: '0.76rem', color: '#B38B8F', fontWeight: 'bold', fontFamily: 'sans-serif', marginTop: '4px' }}>
                                    Shop This Label in Boutique →
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Section 1.5: 💎 Radiance Elite AI Visual Skin Photo Analysis (or Luminary Upgrade Callout) */}
                        {(activePhotoAi || quizPhotoDataUrl) ? (
                          <div
                            style={{
                              backgroundColor: '#FFFFFF',
                              border: '2px solid #B38B8F',
                              borderRadius: '20px',
                              padding: '28px',
                              boxShadow: '0 10px 28px rgba(179, 139, 143, 0.22)'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '18px', borderBottom: '1px solid #E8C5C8', paddingBottom: '14px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                                {quizPhotoDataUrl && (
                                  <img
                                    src={quizPhotoDataUrl}
                                    alt="Uploaded Skin Canvas"
                                    style={{
                                      width: '78px',
                                      height: '78px',
                                      borderRadius: '50%',
                                      objectFit: 'cover',
                                      border: '2.5px solid #B38B8F',
                                      boxShadow: '0 4px 12px rgba(179, 139, 143, 0.3)'
                                    }}
                                  />
                                )}
                                <div>
                                  <span style={{ fontSize: '0.78rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.8px', color: '#5E35B1', backgroundColor: '#F4F0FF', border: '1px solid #D1C4E9', padding: '3px 10px', borderRadius: '12px', fontFamily: 'sans-serif' }}>
                                    💎 Radiance Elite Exclusive • Multimodal Vision AI
                                  </span>
                                  <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2rem', color: '#5C5454', margin: '6px 0 0 0' }}>
                                    Odie AI Visual Skin & Complexion Analysis
                                  </h3>
                                </div>
                              </div>

                              <div style={{ backgroundColor: '#FFF0F2', border: '1.5px solid #B38B8F', borderRadius: '16px', padding: '10px 16px', textAlign: 'center' }}>
                                <span style={{ display: 'block', fontSize: '0.72rem', fontWeight: 'bold', color: '#8A797A', fontFamily: 'sans-serif', textTransform: 'uppercase' }}>
                                  Visual Radiance Index
                                </span>
                                <strong style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.9rem', color: '#B38B8F' }}>
                                  {activePhotoAi?.radianceScore || 92} / 100 ✧
                                </strong>
                              </div>
                            </div>

                            <p style={{ fontFamily: 'sans-serif', fontSize: '0.96rem', color: '#5C5454', lineHeight: '1.65', backgroundColor: '#FFF9F9', padding: '15px 18px', borderRadius: '12px', borderLeft: '4px solid #B38B8F', margin: '0 0 18px 0' }}>
                              {activePhotoAi?.visualComplexionSummary ||
                                `Odie's visual complexion scan evaluated your uploaded photo alongside your ${quizAnswers.skinType} skin profile and ${quizAnswers.primaryGoal} goal to tailor your daily ritual.`}
                            </p>

                            {Array.isArray(activePhotoAi?.detectedObservations) && activePhotoAi.detectedObservations.length > 0 && (
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '14px', marginBottom: '18px' }}>
                                {activePhotoAi.detectedObservations.map((obs, idx) => (
                                  <div key={idx} style={{ backgroundColor: '#FFF9F9', border: '1px solid #E8C5C8', borderRadius: '14px', padding: '14px 16px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                                      <strong style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.15rem', color: '#5C5454' }}>
                                        {obs.zoneOrTrait}
                                      </strong>
                                      <span style={{ backgroundColor: '#FFF0F2', color: '#B38B8F', border: '1px solid #E8C5C8', borderRadius: '10px', padding: '2px 8px', fontSize: '0.7rem', fontFamily: 'sans-serif', fontWeight: 'bold' }}>
                                        {obs.focusPriority}
                                      </span>
                                    </div>
                                    <p style={{ margin: 0, fontSize: '0.84rem', color: '#736A6A', fontFamily: 'sans-serif', lineHeight: '1.45' }}>
                                      {obs.observation}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}

                            {Array.isArray(activePhotoAi?.targetedPhotoRecommendations) && activePhotoAi.targetedPhotoRecommendations.length > 0 && (
                              <div style={{ backgroundColor: '#F6FBF7', border: '1px solid #A5D6A7', borderRadius: '14px', padding: '14px 18px' }}>
                                <strong style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.25rem', color: '#2E7D32', display: 'block', marginBottom: '8px' }}>
                                  ✨ Targeted Visual Scan Recommendations:
                                </strong>
                                <ul style={{ margin: 0, paddingLeft: '20px', fontFamily: 'sans-serif', fontSize: '0.86rem', color: '#5C5454', lineHeight: '1.65' }}>
                                  {activePhotoAi.targetedPhotoRecommendations.map((rec, i) => (
                                    <li key={i} style={{ marginBottom: '4px' }}>{rec}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        ) : effectiveMemberTier === 'luminary' ? (
                          <div style={{ backgroundColor: '#FFF9F9', border: '1.5px dashed #B38B8F', borderRadius: '18px', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
                            <div>
                              <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#5E35B1', backgroundColor: '#F4F0FF', border: '1px solid #D1C4E9', padding: '2px 10px', borderRadius: '10px', fontFamily: 'sans-serif' }}>
                                💎 Radiance Elite Benefit
                              </span>
                              <h4 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.45rem', color: '#5C5454', margin: '6px 0 4px 0' }}>
                                Unlock Odie AI Skin Photo Analysis & Monthly 1-on-1 Consultations
                              </h4>
                              <p style={{ margin: 0, fontSize: '0.86rem', color: '#736A6A', fontFamily: 'sans-serif' }}>
                                As a Luminary Circle member, you receive quarterly consultations (1 every 3 months) and 10% off. Upgrade to Radiance Elite ($119/mo) for monthly consultations, AI photo analysis, and 25% off.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                openPaywallModal(
                                  'Upgrade to The Radiance Elite ($119/mo) to unlock AI Skin Photo Analysis, Monthly 1-on-1 Consultations, a 5-Piece Monthly Ritual Box, and 25% off the Boutique!'
                                )
                              }
                              style={{
                                background: 'linear-gradient(135deg, #B38B8F 0%, #D4A5A9 100%)',
                                color: '#FFFFFF',
                                border: 'none',
                                padding: '10px 18px',
                                borderRadius: '20px',
                                fontFamily: "'Cormorant Garamond', serif",
                                fontSize: '1.05rem',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              💎 Upgrade to Radiance →
                            </button>
                          </div>
                        ) : null}

                        {/* Section 2: Bespoke AM & PM Ritual Architecture */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '22px' }}>
                          {/* Morning Protection Ritual */}
                          <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8C5C8', borderRadius: '20px', padding: '24px', boxShadow: '0 6px 20px rgba(232, 197, 200, 0.15)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #E8C5C8', paddingBottom: '10px' }}>
                              <div>
                                <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.65rem', color: '#5C5454', margin: 0 }}>
                                  ☀️ Morning Protection & Radiance Ritual
                                </h3>
                                <span style={{ fontSize: '0.82rem', color: '#8A797A', fontFamily: 'sans-serif' }}>
                                  Tailored for {quizAnswers.skinType} Skin • {quizAnswers.climate} Climate
                                </span>
                              </div>
                              <span style={{ backgroundColor: '#FFF0F2', color: '#B38B8F', padding: '4px 10px', borderRadius: '12px', fontSize: '0.76rem', fontWeight: 'bold', fontFamily: 'sans-serif' }}>
                                {amSteps.length} Steps
                              </span>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                              {amSteps.map((st, idx) => (
                                <div key={`am-${idx}`} style={{ backgroundColor: '#FFF9F9', border: '1px solid #E8C5C8', borderRadius: '12px', padding: '12px 14px' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px', marginBottom: '4px' }}>
                                    <strong style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.15rem', color: '#5C5454' }}>
                                      Step {st.stepNumber}: {st.title}
                                    </strong>
                                    <button
                                      type="button"
                                      onClick={() => jumpToBoutiqueWithFilter({ ritualStep: st.lookForLabel })}
                                      style={{ backgroundColor: '#F2D4D7', border: '1px solid #B38B8F', color: '#5C5454', borderRadius: '12px', padding: '3px 9px', fontSize: '0.73rem', fontFamily: 'sans-serif', fontWeight: 'bold', cursor: 'pointer' }}
                                    >
                                      Shop {st.lookForLabel} →
                                    </button>
                                  </div>
                                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#736A6A', fontFamily: 'sans-serif', lineHeight: '1.5' }}>
                                    {st.instruction}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Evening Renewal Ritual */}
                          <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8C5C8', borderRadius: '20px', padding: '24px', boxShadow: '0 6px 20px rgba(232, 197, 200, 0.15)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #E8C5C8', paddingBottom: '10px' }}>
                              <div>
                                <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.65rem', color: '#5C5454', margin: 0 }}>
                                  🌙 Evening Cellular Renewal Ritual
                                </h3>
                                <span style={{ fontSize: '0.82rem', color: '#8A797A', fontFamily: 'sans-serif' }}>
                                  Focused on {quizAnswers.primaryGoal} & Overnight Barrier Repair
                                </span>
                              </div>
                              <span style={{ backgroundColor: '#FFF0F2', color: '#B38B8F', padding: '4px 10px', borderRadius: '12px', fontSize: '0.76rem', fontWeight: 'bold', fontFamily: 'sans-serif' }}>
                                {pmSteps.length} Steps
                              </span>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                              {pmSteps.map((st, idx) => (
                                <div key={`pm-${idx}`} style={{ backgroundColor: '#FFF9F9', border: '1px solid #E8C5C8', borderRadius: '12px', padding: '12px 14px' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px', marginBottom: '4px' }}>
                                    <strong style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.15rem', color: '#5C5454' }}>
                                      Step {st.stepNumber}: {st.title}
                                    </strong>
                                    <button
                                      type="button"
                                      onClick={() => jumpToBoutiqueWithFilter({ ritualStep: st.lookForLabel })}
                                      style={{ backgroundColor: '#F2D4D7', border: '1px solid #B38B8F', color: '#5C5454', borderRadius: '12px', padding: '3px 9px', fontSize: '0.73rem', fontFamily: 'sans-serif', fontWeight: 'bold', cursor: 'pointer' }}
                                    >
                                      Shop {st.lookForLabel} →
                                    </button>
                                  </div>
                                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#736A6A', fontFamily: 'sans-serif', lineHeight: '1.5' }}>
                                    {st.instruction}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Section 3: Ingredient Sanctuary (Hero Actives vs. Ingredients to Avoid) */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '22px' }}>
                          {/* Hero Ingredients to Seek */}
                          <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #A5D6A7', borderRadius: '20px', padding: '24px', boxShadow: '0 6px 20px rgba(232, 197, 200, 0.12)' }}>
                            <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.65rem', color: '#2E7D32', margin: '0 0 6px 0' }}>
                              🌿 Hero Actives & Ingredients to Seek
                            </h3>
                            <p style={{ margin: '0 0 14px 0', fontSize: '0.85rem', color: '#736A6A', fontFamily: 'sans-serif' }}>
                              Prioritize these actives on Boutique product cards for your {quizAnswers.skinType} skin and {quizAnswers.primaryGoal} goal:
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              {heroList.map((hero, idx) => (
                                <div key={`hero-${idx}`} style={{ backgroundColor: '#F6FBF7', border: '1px solid #A5D6A7', borderRadius: '12px', padding: '11px 14px' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                                    <strong style={{ color: '#2E7D32', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.15rem' }}>
                                      ✦ {hero.name}
                                    </strong>
                                    {hero.targetConcern && (
                                      <button
                                        type="button"
                                        onClick={() => jumpToBoutiqueWithFilter({ skinConcern: hero.targetConcern })}
                                        style={{ backgroundColor: '#FFFFFF', border: '1px solid #A5D6A7', color: '#2E7D32', borderRadius: '10px', padding: '2px 8px', fontSize: '0.72rem', fontFamily: 'sans-serif', fontWeight: 'bold', cursor: 'pointer' }}
                                      >
                                        Shop {hero.targetConcern} →
                                      </button>
                                    )}
                                  </div>
                                  <p style={{ margin: '4px 0 0 0', fontSize: '0.84rem', color: '#5C5454', fontFamily: 'sans-serif', lineHeight: '1.45' }}>
                                    {hero.benefit}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Ingredients & Textures to Avoid */}
                          <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #FFE082', borderRadius: '20px', padding: '24px', boxShadow: '0 6px 20px rgba(232, 197, 200, 0.12)' }}>
                            <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.65rem', color: '#B26A00', margin: '0 0 6px 0' }}>
                              🛡️ Formulas & Habits to Avoid ({quizAnswers.skinSensitivity} Sensitivity)
                            </h3>
                            <p style={{ margin: '0 0 14px 0', fontSize: '0.85rem', color: '#736A6A', fontFamily: 'sans-serif' }}>
                              Protect your moisture barrier in {quizAnswers.climate} conditions by avoiding or buffering these:
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              {avoidList.map((av, idx) => (
                                <div key={`avoid-${idx}`} style={{ backgroundColor: '#FFF8E7', border: '1px solid #FFE082', borderRadius: '12px', padding: '11px 14px' }}>
                                  <strong style={{ color: '#B26A00', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.12rem', display: 'block' }}>
                                    ⚠️ {av.name}
                                  </strong>
                                  <p style={{ margin: '4px 0 0 0', fontSize: '0.84rem', color: '#5C5454', fontFamily: 'sans-serif', lineHeight: '1.45' }}>
                                    {av.reason}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Section 4: Complexion, Undertone & Artistry Harmony Guide */}
                        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8C5C8', borderRadius: '20px', padding: '26px', boxShadow: '0 6px 20px rgba(232, 197, 200, 0.15)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '16px', borderBottom: '1px solid #E8C5C8', paddingBottom: '12px' }}>
                            <div>
                              <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.75rem', color: '#5C5454', margin: 0 }}>
                                💄 Complexion, Undertone & Facial Artistry Guide
                              </h3>
                              <span style={{ fontSize: '0.86rem', color: '#B38B8F', fontFamily: 'sans-serif', fontWeight: 'bold' }}>
                                {artistry.headline} • {quizAnswers.eyeColor} Eyes • {quizAnswers.faceShape} Silhouette
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => jumpToBoutiqueWithFilter({ ritualStep: 'Makeup & Artistry' })}
                              style={{ backgroundColor: '#F2D4D7', border: '1px solid #B38B8F', color: '#5C5454', padding: '8px 16px', borderRadius: '18px', fontFamily: "'Cormorant Garamond', serif", fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer' }}
                            >
                              💄 Shop Luminous Makeup & Artistry →
                            </button>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                            <div style={{ backgroundColor: '#FFF9F9', border: '1px solid #E8C5C8', borderRadius: '12px', padding: '14px' }}>
                              <strong style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.15rem', color: '#B38B8F', display: 'block', marginBottom: '4px' }}>
                                Complexion & Undertone Base
                              </strong>
                              <p style={{ margin: 0, fontSize: '0.85rem', color: '#5C5454', fontFamily: 'sans-serif', lineHeight: '1.5' }}>
                                {artistry.foundationAndBase}
                              </p>
                            </div>
                            <div style={{ backgroundColor: '#FFF9F9', border: '1px solid #E8C5C8', borderRadius: '12px', padding: '14px' }}>
                              <strong style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.15rem', color: '#B38B8F', display: 'block', marginBottom: '4px' }}>
                                Blush, Lip & Glow Palette
                              </strong>
                              <p style={{ margin: 0, fontSize: '0.85rem', color: '#5C5454', fontFamily: 'sans-serif', lineHeight: '1.5' }}>
                                {artistry.blushAndLipHarmony}
                              </p>
                            </div>
                            <div style={{ backgroundColor: '#FFF9F9', border: '1px solid #E8C5C8', borderRadius: '12px', padding: '14px' }}>
                              <strong style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.15rem', color: '#B38B8F', display: 'block', marginBottom: '4px' }}>
                                {quizAnswers.eyeColor} Eye Enhancement
                              </strong>
                              <p style={{ margin: 0, fontSize: '0.85rem', color: '#5C5454', fontFamily: 'sans-serif', lineHeight: '1.5' }}>
                                {artistry.eyeEnhancement}
                              </p>
                            </div>
                            <div style={{ backgroundColor: '#FFF9F9', border: '1px solid #E8C5C8', borderRadius: '12px', padding: '14px' }}>
                              <strong style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.15rem', color: '#B38B8F', display: 'block', marginBottom: '4px' }}>
                                {quizAnswers.faceShape} Sculpting & Placement
                              </strong>
                              <p style={{ margin: 0, fontSize: '0.85rem', color: '#5C5454', fontFamily: 'sans-serif', lineHeight: '1.5' }}>
                                {artistry.sculptingPlacement}
                              </p>
                            </div>
                            <div style={{ backgroundColor: '#FFF9F9', border: '1px solid #E8C5C8', borderRadius: '12px', padding: '14px' }}>
                              <strong style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.15rem', color: '#B38B8F', display: 'block', marginBottom: '4px' }}>
                                {quizAnswers.makeupVibe} Signature Finish
                              </strong>
                              <p style={{ margin: 0, fontSize: '0.85rem', color: '#5C5454', fontFamily: 'sans-serif', lineHeight: '1.5' }}>
                                {artistry.signatureFinish}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Section 5: Your 10-Point Diagnostic Profile Summary Cards */}
                        <div>
                          <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.6rem', color: '#5C5454', margin: '0 0 12px 0' }}>
                            Your 10-Point Diagnostic Profile Reference
                          </h3>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px', textAlign: 'left' }}>
                            <BlueprintCard label="Skin Temperament" value={quizAnswers.skinType}/>
                            <BlueprintCard label="Primary Vision" value={quizAnswers.primaryGoal}/>
                            <BlueprintCard label="Climate Context" value={quizAnswers.climate}/>
                            <BlueprintCard label="Skin Sensitivity" value={quizAnswers.skinSensitivity}/>
                            <BlueprintCard label="Complexion Canvas" value={quizAnswers.complexion}/>
                            <BlueprintCard label="Undertone" value={quizAnswers.undertone}/>
                            <BlueprintCard label="Eye Color" value={quizAnswers.eyeColor}/>
                            <BlueprintCard label="Facial Silhouette" value={quizAnswers.faceShape}/>
                            <BlueprintCard label="Signature Aesthetic" value={quizAnswers.makeupVibe}/>
                            <BlueprintCard label="Regimen Focus" value={quizAnswers.routineFocus}/>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  <div style={{ textAlign: 'left', backgroundColor: 'rgba(255, 255, 255, 0.85)', border: '1px solid #E8C5C8', borderRadius: '15px', padding: '30px', boxShadow: '0 4px 15px rgba(232, 197, 200, 0.15)', marginBottom: '40px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }}>
                      <div>
                        <h3 style={{ fontSize: '2.2rem', color: '#5C5454', fontFamily: "'Cormorant Garamond', serif", margin: '0 0 5px 0' }}>
                          Susan's Bespoke Curation For You ✧
                        </h3>
                        <p style={{ margin: 0, color: '#8A797A', fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontSize: '1.15rem' }}>
                          Hand-selected essentials tailored to your beauty blueprint and personal consultations.
                        </p>
                      </div>
                      {inboxItems.length > 0 && (
                        <button
                          onClick={() => setActiveMemberTab('Inbox')}
                          style={{ backgroundColor: '#FFF0F2', border: '1px solid #B38B8F', color: '#5C5454', padding: '8px 16px', borderRadius: '20px', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.05rem', cursor: 'pointer' }}
                        >
                          💌 View Susan's Notes ({inboxItems.length})
                        </button>
                      )}
                    </div>

                    {userRecommendations.length > 0 ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
                        {userRecommendations.map((product) => (
                          <ProductCard
                            key={product._id || product.title}
                            product={product}
                            onAddToCart={handleAddToCart}
                            onCardClick={setSelectedProduct}
                            userBlueprint={quizAnswers}
                            hasCompletedQuiz={hasCompletedQuiz}
                          />
                        ))}
                      </div>
                    ) : (
                      <p style={{ color: '#8A797A', fontStyle: 'italic', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.2rem', margin: 0 }}>
                        Complete your consultation quiz above or check back soon as Susan curates your personalized ritual essentials.
                      </p>
                    )}
                  </div>

                  {userOrders.length > 0 && (
                    <div style={{ textAlign: 'left', backgroundColor: 'rgba(255, 255, 255, 0.8)', border: '1px solid #E8C5C8', borderRadius: '15px', padding: '30px', boxShadow: '0 4px 15px rgba(232, 197, 200, 0.15)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
                        <h3 style={{ fontSize: '2.2rem', color: '#5C5454', fontFamily: "'Cormorant Garamond', serif", margin: 0 }}>Recent Orders</h3>
                        <button
                          type="button"
                          onClick={() => setActiveMemberTab('Order History')}
                          style={{
                            backgroundColor: '#FFF0F2',
                            color: '#B38B8F',
                            border: '1px solid #B38B8F',
                            borderRadius: '20px',
                            padding: '8px 18px',
                            fontFamily: "'Cormorant Garamond', serif",
                            fontSize: '1.05rem',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                          }}
                        >
                          📦 View Full Order History & Re-Order ({userOrders.length}) →
                        </button>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        {userOrders.map((order, idx) => (
                          <div key={order._id || idx} style={{ padding: '15px', border: '1px solid #E8C5C8', borderRadius: '10px', backgroundColor: '#FFF9F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                            <div>
                              <p style={{ margin: '0 0 5px 0', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.1rem', color: '#5C5454', fontWeight: 'bold' }}>Order Date: {new Date(order.createdAt).toLocaleDateString()}</p>
                              <p style={{ margin: '0 0 5px 0', fontFamily: 'sans-serif', fontSize: '0.9rem', color: '#8A797A' }}>Total: ${(order.totalAmount || 0).toFixed(2)}</p>
                              <p style={{ margin: 0, fontFamily: 'sans-serif', fontSize: '0.9rem', color: '#8A797A' }}>Status: <span style={{ color: order.status === 'SHIPPED' ? '#B38B8F' : '#A89999', fontWeight: 'bold' }}>{order.status || 'Pending'}</span></p>
                            </div>
                            {order.tracking_code && (
                              <div style={{ backgroundColor: '#FFF0F2', padding: '10px 15px', borderRadius: '8px', border: '1px solid #E8C5C8' }}>
                                <p style={{ margin: '0 0 3px 0', fontSize: '0.85rem', color: '#A89999' }}>Tracking Number</p>
                                <p style={{ margin: 0, fontSize: '1.1rem', color: '#B38B8F', fontWeight: 'bold' }}>{order.tracking_code}</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 2. INBOX TAB */}
              {activeMemberTab === 'Inbox' && (
                <div style={{ animation: 'fadeIn 0.5s ease' }}>
                  <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.15rem', color: '#8A797A', fontStyle: 'italic', marginBottom: '30px' }}>Your private messages and hand-selected curations from Susan.</p>
                  
                  {inboxItems.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      {inboxItems.map((item) => (
                        <div key={item._id} style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', backgroundColor: '#FFFFFF', padding: '20px', borderRadius: '15px', border: '1px solid #E8C5C8', boxShadow: '0 4px 15px rgba(232, 197, 200, 0.1)' }}>
                          <div style={{ flex: '1 1 250px', maxWidth: '300px' }}>
                            {item.productId ? (
                              <ProductCard product={item.productId} onAddToCart={handleAddToCart} onCardClick={setSelectedProduct} userBlueprint={quizAnswers} hasCompletedQuiz={hasCompletedQuiz} />
                            ) : (
                              <p style={{ color: '#A89999', fontStyle: 'italic' }}>Product no longer available.</p>
                            )}
                          </div>
                          <div style={{ flex: '2 1 300px', display: 'flex', flexDirection: 'column', justifyContent: 'center', backgroundColor: '#FFF9F9', padding: '25px', borderRadius: '12px', border: '1px dashed #E8C5C8' }}>
                            <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.1rem', color: '#B38B8F', fontStyle: 'italic', margin: '0 0 15px 0' }}>Received: {new Date(item.createdAt).toLocaleDateString()}</p>
                            <p style={{ fontFamily: 'sans-serif', fontSize: '1.1rem', color: '#5C5454', lineHeight: '1.6', margin: 0 }}>"{item.message}"</p>
                            <p style={{ fontFamily: "'Alex Brush', cursive", fontSize: '1.8rem', color: '#B38B8F', margin: '20px 0 0 0' }}>Warmly, Susan</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ padding: '50px', textAlign: 'center', backgroundColor: '#FFFFFF', border: '1px dashed #E8C5C8', borderRadius: '15px' }}>
                      <p style={{ color: '#8A797A', fontStyle: 'italic', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.3rem' }}>Your inbox is currently empty. Complete your Blueprint to receive Susan's exclusive curations.</p>
                    </div>
                  )}
                </div>
              )}

              {/* 3. BOUTIQUE TAB */}
              {activeMemberTab === 'Boutique' && (
                <div style={{ animation: 'fadeIn 0.5s ease' }}>
                  <BoutiqueSmartFilterSection
                    products={backendProducts}
                    quizAnswers={quizAnswers}
                    hasCompletedQuiz={hasCompletedQuiz}
                    boutiqueFilters={boutiqueFilters}
                    setBoutiqueFilters={setBoutiqueFilters}
                    onResetFilters={resetBoutiqueFilters}
                    onAddToCart={handleAddToCart}
                    onCardClick={setSelectedProduct}
                    onGoToBlueprintTab={() => setActiveMemberTab('Blueprint')}
                  />
                </div>
              )}

              {/* 4. CONSULTATIONS TAB */}
              {activeMemberTab === 'Consultations' && (
                <div style={{ animation: 'fadeIn 0.5s ease', display: 'flex', flexDirection: 'column', gap: '30px' }}>
                  {isFreeBasicMember ? (
                    <div style={{ backgroundColor: '#FFFFFF', padding: '45px 35px', borderRadius: '22px', border: '2px dashed #B38B8F', boxShadow: '0 10px 30px rgba(232, 197, 200, 0.2)', textAlign: 'center' }}>
                      <span style={{ display: 'inline-block', backgroundColor: '#FFF0F2', color: '#B38B8F', border: '1px solid #B38B8F', borderRadius: '18px', padding: '5px 16px', fontSize: '0.82rem', fontWeight: 'bold', fontFamily: 'sans-serif', marginBottom: '14px' }}>
                        🔒 Paid Membership Sanctuary Benefit
                      </span>
                      <h2 style={{ fontFamily: "'Cormorant Garamond', serif", color: '#5C5454', marginTop: 0, fontSize: '2.4rem', marginBottom: '12px' }}>
                        1-on-1 Live Video Consultations with Susan
                      </h2>
                      <p style={{ color: '#736A6A', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.3rem', maxWidth: '640px', margin: '0 auto 28px auto', lineHeight: '1.6' }}>
                        Private 1-on-1 skincare and beauty consultations are reserved for <strong>The Luminary Circle</strong> (1 consultation every 3 months / quarterly) and <strong>The Radiance Elite</strong> (1 consultation every month).
                      </p>
                      <EmpowermentButton
                        text="View Membership Tiers & Upgrade ✧"
                        onClick={() =>
                          openPaywallModal("Choose The Luminary Circle ($49/mo — Quarterly Consultations) or The Radiance Elite ($119/mo — Monthly Consultations) to book live 1-on-1 sessions with Susan.")
                        }
                      />
                    </div>
                  ) : (
                    <div style={{ backgroundColor: '#FFFFFF', padding: '40px', borderRadius: '20px', border: '1px solid #E8C5C8', boxShadow: '0 10px 30px rgba(232, 197, 200, 0.15)' }}>
                      <h2 style={{ fontFamily: "'Cormorant Garamond', serif", color: '#B38B8F', marginTop: 0, fontSize: '2.2rem' }}>
                        Book & Manage Your Consultation with Susan
                      </h2>
                      <p style={{ color: '#736A6A', fontFamily: 'sans-serif', fontSize: '1rem', marginBottom: '25px' }}>
                        Select any date on Susan's live calendar below to book a 1-on-1 consultation, or view updates if Susan reschedules your session.
                      </p>

                      <MemberCalendar
                        userTier={effectiveMemberTier}
                        onOpenPaywallModal={openPaywallModal}
                        onJoinVideoRoom={(link) => {
                          const normalized = normalizeRoomUrl(link);
                          setMemberVideoLink(normalized);
                          setActiveMemberVideoUrl(normalized);
                        }}
                      />
                    </div>
                  )}

                  <div style={{ backgroundColor: '#FFFFFF', padding: '40px', borderRadius: '20px', border: '1px solid #E8C5C8', boxShadow: '0 10px 30px rgba(232, 197, 200, 0.15)' }}>
                    <h2 style={{ fontFamily: "'Cormorant Garamond', serif", color: '#B38B8F', marginTop: 0, fontSize: '2.2rem' }}>Join Active Video Sanctuary</h2>
                    <p style={{ color: '#736A6A', fontFamily: 'sans-serif', fontSize: '1rem', marginBottom: '20px' }}>
                      Click "🎥 Join Video Room" on your scheduled consultation above, or paste a private room link from Susan below to enter your live 1-on-1 studio.
                    </p>
                    <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                      <input
                        type="text"
                        value={memberVideoLink}
                        onChange={(e) => setMemberVideoLink(e.target.value)}
                        placeholder="Paste meeting link (e.g., https://meet.jit.si/SusansBoutique_Consultation_...)"
                        style={{ flex: 1, minWidth: '250px', padding: '15px', borderRadius: '12px', border: '1px solid #E8C5C8', outline: 'none', fontFamily: 'sans-serif', fontSize: '1rem', backgroundColor: '#FFF9F9' }}
                      />
                      {!activeMemberVideoUrl ? (
                        <button
                          type="button"
                          onClick={() => {
                            const url = normalizeRoomUrl(memberVideoLink);
                            if (!url) {
                              alert('Please paste a valid consultation room link or click "Join Video Room" on a scheduled appointment.');
                              return;
                            }
                            setActiveMemberVideoUrl(url);
                          }}
                          style={{ backgroundColor: '#B38B8F', border: 'none', padding: '15px 30px', borderRadius: '12px', color: '#FFFFFF', cursor: 'pointer', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.2rem', transition: 'background-color 0.3s ease' }}
                        >
                          Enter Room ✧
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setActiveMemberVideoUrl('')}
                          style={{ backgroundColor: '#5C5454', border: 'none', padding: '15px 30px', borderRadius: '12px', color: '#FFFFFF', cursor: 'pointer', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.2rem' }}
                        >
                          Leave Room
                        </button>
                      )}
                    </div>

                    {activeMemberVideoUrl && (
                      <div style={{ marginTop: '25px', width: '100%', height: '600px', borderRadius: '15px', overflow: 'hidden', border: '1px solid #E8C5C8', boxShadow: '0 10px 30px rgba(232, 197, 200, 0.2)' }}>
                        <iframe
                          allow="camera; microphone; fullscreen; display-capture; autoplay"
                          src={activeMemberVideoUrl}
                          style={{ width: '100%', height: '100%', border: '0' }}
                          title="Member Consultation Room"
                        ></iframe>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 5. ORDER HISTORY TAB */}
              {activeMemberTab === 'Order History' && (
                <div style={{ animation: 'fadeIn 0.5s ease', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  <div style={{ backgroundColor: '#FFFFFF', padding: '28px 32px', borderRadius: '18px', border: '1px solid #E8C5C8', boxShadow: '0 6px 20px rgba(232, 197, 200, 0.14)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    <div>
                      <span style={{ display: 'inline-block', backgroundColor: '#FFF0F2', color: '#B38B8F', border: '1px solid #E8C5C8', borderRadius: '14px', padding: '3px 12px', fontSize: '0.76rem', fontWeight: 'bold', fontFamily: 'sans-serif', marginBottom: '8px' }}>
                        📦 SANCTUARY BOUTIQUE ARCHIVE
                      </span>
                      <h2 style={{ fontFamily: "'Cormorant Garamond', serif", color: '#5C5454', fontSize: '2.1rem', margin: '0 0 6px 0' }}>
                        Your Ritual Order History
                      </h2>
                      <p style={{ margin: 0, color: '#736A6A', fontFamily: 'sans-serif', fontSize: '0.94rem' }}>
                        Track active shipments, review past boutique curations, and replenish your favorite skincare essentials in one click.
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                      <div style={{ backgroundColor: '#FFF9F9', border: '1px solid #E8C5C8', borderRadius: '12px', padding: '10px 18px', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.75rem', fontFamily: 'sans-serif', color: '#8A797A', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                          Total Orders
                        </div>
                        <div style={{ fontSize: '1.5rem', fontFamily: "'Cormorant Garamond', serif", color: '#5C5454', fontWeight: 'bold' }}>
                          {userOrders.length}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveMemberTab('Boutique')}
                        style={{
                          backgroundColor: '#B38B8F',
                          color: '#FFFFFF',
                          border: 'none',
                          borderRadius: '22px',
                          padding: '11px 22px',
                          fontFamily: "'Cormorant Garamond', serif",
                          fontSize: '1.1rem',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          boxShadow: '0 4px 12px rgba(179, 139, 143, 0.25)'
                        }}
                      >
                        🛍️ Shop the Boutique ✧
                      </button>
                    </div>
                  </div>

                  {userOrders.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
                      {userOrders.map((order, idx) => {
                        const orderIdShort = order.shortId || String(order._id || '').slice(-6).toUpperCase() || `ORD-${idx + 1}`;
                        const orderDateStr = order.createdAt
                          ? new Date(order.createdAt).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })
                          : 'Recent Order';
                        const rawStatus = String(order.status || 'Pending').toUpperCase();
                        const isDelivered = rawStatus.includes('DELIVERED');
                        const isShipped = rawStatus.includes('SHIPPED');
                        const isPaidProcessing = rawStatus.includes('PAID') || rawStatus.includes('PROCESSING');
                        const statusBadgeStyle = isDelivered
                          ? { bg: '#E8F5E9', color: '#2E7D32', border: '#A5D6A7', label: '✓ Delivered' }
                          : isShipped
                          ? { bg: '#F4F0FF', color: '#5E35B1', border: '#D1C4E9', label: '🚚 Shipped' }
                          : isPaidProcessing
                          ? { bg: '#FFF0F2', color: '#B38B8F', border: '#E8C5C8', label: '✨ Paid • Preparing Ritual' }
                          : { bg: '#FFF8E1', color: '#8D6E63', border: '#FFE082', label: order.status || 'Pending' };

                        const shipAddr = order.shipping_address || {};
                        const hasShipAddr = Boolean(shipAddr.address_1 || shipAddr.city || shipAddr.postcode);
                        const orderItems = Array.isArray(order.items) ? order.items : [];

                        return (
                          <div
                            key={order._id || idx}
                            style={{
                              backgroundColor: '#FFFFFF',
                              borderRadius: '18px',
                              border: '1px solid #E8C5C8',
                              boxShadow: '0 6px 20px rgba(232, 197, 200, 0.14)',
                              overflow: 'hidden'
                            }}
                          >
                            {/* Order Top Header Bar */}
                            <div
                              style={{
                                backgroundColor: '#FFF9F9',
                                borderBottom: '1px solid #E8C5C8',
                                padding: '18px 26px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                flexWrap: 'wrap',
                                gap: '14px'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '22px', flexWrap: 'wrap' }}>
                                <div>
                                  <div style={{ fontSize: '0.73rem', fontFamily: 'sans-serif', color: '#8A797A', textTransform: 'uppercase', letterSpacing: '0.7px' }}>
                                    Order Reference
                                  </div>
                                  <div style={{ fontSize: '1.25rem', fontFamily: "'Cormorant Garamond', serif", color: '#5C5454', fontWeight: 'bold' }}>
                                    #{orderIdShort}
                                  </div>
                                </div>
                                <div>
                                  <div style={{ fontSize: '0.73rem', fontFamily: 'sans-serif', color: '#8A797A', textTransform: 'uppercase', letterSpacing: '0.7px' }}>
                                    Order Date
                                  </div>
                                  <div style={{ fontSize: '0.96rem', fontFamily: 'sans-serif', color: '#5C5454', fontWeight: 'bold' }}>
                                    {orderDateStr}
                                  </div>
                                </div>
                                <div>
                                  <div style={{ fontSize: '0.73rem', fontFamily: 'sans-serif', color: '#8A797A', textTransform: 'uppercase', letterSpacing: '0.7px' }}>
                                    Total Investment
                                  </div>
                                  <div style={{ fontSize: '1.05rem', fontFamily: 'sans-serif', color: '#B38B8F', fontWeight: 'bold' }}>
                                    ${Number(order.totalAmount || 0).toFixed(2)}
                                  </div>
                                </div>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                <span
                                  style={{
                                    backgroundColor: statusBadgeStyle.bg,
                                    color: statusBadgeStyle.color,
                                    border: `1px solid ${statusBadgeStyle.border}`,
                                    borderRadius: '18px',
                                    padding: '6px 14px',
                                    fontSize: '0.82rem',
                                    fontFamily: 'sans-serif',
                                    fontWeight: 'bold'
                                  }}
                                >
                                  {statusBadgeStyle.label}
                                </span>
                                {orderItems.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => handleReorderFullOrder(order)}
                                    style={{
                                      backgroundColor: '#5C5454',
                                      color: '#FFFFFF',
                                      border: 'none',
                                      borderRadius: '18px',
                                      padding: '8px 16px',
                                      fontFamily: "'Cormorant Garamond', serif",
                                      fontSize: '1rem',
                                      fontWeight: 'bold',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    ↻ Re-Order / Add to Ritual Bag
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Order Body: Itemized Products + Shipping & Tracking */}
                            <div style={{ padding: '24px 26px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                              {orderItems.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                  {orderItems.map((item, itemIdx) => (
                                    <div
                                      key={`${order._id || idx}-item-${itemIdx}`}
                                      style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        flexWrap: 'wrap',
                                        gap: '14px',
                                        padding: '14px 16px',
                                        borderRadius: '14px',
                                        backgroundColor: '#FFFDFD',
                                        border: '1px solid #F2D4D7'
                                      }}
                                    >
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: '1 1 260px' }}>
                                        {item.imageUrl ? (
                                          <img
                                            src={item.imageUrl}
                                            alt={item.title || 'Product'}
                                            style={{
                                              width: '62px',
                                              height: '62px',
                                              borderRadius: '10px',
                                              objectFit: 'cover',
                                              border: '1px solid #E8C5C8',
                                              backgroundColor: '#FFF9F9',
                                              flexShrink: 0
                                            }}
                                          />
                                        ) : (
                                          <div
                                            style={{
                                              width: '62px',
                                              height: '62px',
                                              borderRadius: '10px',
                                              backgroundColor: '#FFF0F2',
                                              border: '1px solid #E8C5C8',
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              fontSize: '1.5rem',
                                              flexShrink: 0
                                            }}
                                          >
                                            ✨
                                          </div>
                                        )}
                                        <div>
                                          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.25rem', color: '#5C5454', fontWeight: 'bold' }}>
                                            {item.title || 'Boutique Ritual Essential'}
                                          </div>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginTop: '4px', fontSize: '0.84rem', fontFamily: 'sans-serif', color: '#8A797A' }}>
                                            <span>Qty: <strong>{item.quantity || 1}</strong></span>
                                            <span>•</span>
                                            <span>Unit: <strong>${Number(item.price || 0).toFixed(2)}</strong></span>
                                            {item.variantName && (
                                              <>
                                                <span>•</span>
                                                <span style={{ color: '#B38B8F', fontWeight: 'bold' }}>Variant: {item.variantName}</span>
                                              </>
                                            )}
                                          </div>
                                        </div>
                                      </div>

                                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                        <div style={{ textAlign: 'right' }}>
                                          <div style={{ fontSize: '0.74rem', fontFamily: 'sans-serif', color: '#8A797A' }}>Subtotal</div>
                                          <div style={{ fontSize: '1rem', fontFamily: 'sans-serif', color: '#5C5454', fontWeight: 'bold' }}>
                                            ${(Number(item.price || 0) * Math.max(1, Number(item.quantity) || 1)).toFixed(2)}
                                          </div>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => handleReorderSingleItem(item)}
                                          style={{
                                            backgroundColor: '#FFF0F2',
                                            color: '#B38B8F',
                                            border: '1px solid #B38B8F',
                                            borderRadius: '16px',
                                            padding: '7px 14px',
                                            fontSize: '0.85rem',
                                            fontFamily: 'sans-serif',
                                            fontWeight: 'bold',
                                            cursor: 'pointer'
                                          }}
                                        >
                                          + Add to Ritual Bag
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p style={{ margin: 0, color: '#8A797A', fontStyle: 'italic', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.1rem' }}>
                                  Curated Sanctuary Boutique Order
                                </p>
                              )}

                              {/* Shipping Address & Tracking Row */}
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '14px', paddingTop: '6px' }}>
                                <div style={{ backgroundColor: '#FFF9F9', border: '1px solid #E8C5C8', borderRadius: '12px', padding: '14px 18px' }}>
                                  <div style={{ fontSize: '0.75rem', fontFamily: 'sans-serif', color: '#B38B8F', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '5px' }}>
                                    📍 Shipping Destination
                                  </div>
                                  {hasShipAddr ? (
                                    <div style={{ fontSize: '0.9rem', fontFamily: 'sans-serif', color: '#5C5454', lineHeight: '1.5' }}>
                                      {shipAddr.name && <div style={{ fontWeight: 'bold' }}>{shipAddr.name}</div>}
                                      <div>
                                        {shipAddr.address_1}
                                        {shipAddr.address_2 ? `, ${shipAddr.address_2}` : ''}
                                      </div>
                                      <div>
                                        {[shipAddr.city, shipAddr.state, shipAddr.postcode].filter(Boolean).join(', ')}
                                        {shipAddr.country ? ` (${shipAddr.country})` : ''}
                                      </div>
                                    </div>
                                  ) : (
                                    <div style={{ fontSize: '0.88rem', fontFamily: 'sans-serif', color: '#8A797A', fontStyle: 'italic' }}>
                                      Saved Sanctuary Member Address ({order.customerEmail || userDetails.email || 'On File'})
                                    </div>
                                  )}
                                </div>

                                <div style={{ backgroundColor: order.tracking_code ? '#F4F0FF' : '#FFF9F9', border: order.tracking_code ? '1px solid #D1C4E9' : '1px solid #E8C5C8', borderRadius: '12px', padding: '14px 18px' }}>
                                  <div style={{ fontSize: '0.75rem', fontFamily: 'sans-serif', color: order.tracking_code ? '#5E35B1' : '#B38B8F', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '5px' }}>
                                    🚚 Live Courier & Tracking
                                  </div>
                                  {order.tracking_code ? (
                                    <div>
                                      <div style={{ fontSize: '0.84rem', fontFamily: 'sans-serif', color: '#5C5454', marginBottom: '3px' }}>
                                        Carrier: <strong>{order.logisticName || 'Express Sanctuary Courier'}</strong>
                                      </div>
                                      <div style={{ fontSize: '1.05rem', fontFamily: 'monospace', color: '#5E35B1', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                                        {order.tracking_code}
                                      </div>
                                    </div>
                                  ) : (
                                    <div style={{ fontSize: '0.88rem', fontFamily: 'sans-serif', color: '#8A797A' }}>
                                      Carrier: <strong>{order.logisticName || 'Sanctuary Priority Fulfillment'}</strong>
                                      <div style={{ fontStyle: 'italic', marginTop: '3px' }}>
                                        Tracking number will appear automatically as soon as your parcel dispatches.
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ padding: '55px 35px', textAlign: 'center', backgroundColor: '#FFFFFF', border: '1px dashed #E8C5C8', borderRadius: '18px' }}>
                      <div style={{ fontSize: '2.6rem', marginBottom: '10px' }}>🛍️</div>
                      <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2rem', color: '#5C5454', margin: '0 0 10px 0' }}>
                        No Boutique Orders Yet
                      </h3>
                      <p style={{ color: '#8A797A', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.25rem', maxWidth: '520px', margin: '0 auto 24px auto' }}>
                        Explore Susan's curated skincare essentials in the Boutique to begin your personalized beauty ritual.
                      </p>
                      <EmpowermentButton text="Browse the Boutique ✧" onClick={() => setActiveMemberTab('Boutique')} />
                    </div>
                  )}
                </div>
              )}

              {/* 6. ACCOUNT INFO TAB */}
              {activeMemberTab === 'Account Info' && (
                <div style={{ animation: 'fadeIn 0.5s ease', display: 'flex', flexDirection: 'column', gap: '26px' }}>
                  {/* Top Master Action Bar */}
                  <div style={{ backgroundColor: '#FFFFFF', padding: '22px 28px', borderRadius: '18px', border: '1px solid #E8C5C8', boxShadow: '0 6px 20px rgba(232, 197, 200, 0.14)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    <div>
                      <span style={{ display: 'inline-block', backgroundColor: '#FFF0F2', color: '#B38B8F', border: '1px solid #E8C5C8', borderRadius: '14px', padding: '3px 12px', fontSize: '0.75rem', fontWeight: 'bold', fontFamily: 'sans-serif', marginBottom: '6px' }}>
                        👤 MEMBER PROFILE & BILLING COMMAND
                      </span>
                      <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2.05rem', color: '#5C5454', margin: '0 0 4px 0' }}>
                        Account Info, Shipping & Billing
                      </h2>
                      <p style={{ margin: 0, fontSize: '0.9rem', fontFamily: 'sans-serif', color: '#736A6A' }}>
                        Click <strong>✏️ Update</strong> on any card below to edit that section, or use <strong>💾 Save All Account Changes</strong> to save everything at once.
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingPersonal(true);
                          setIsEditingShipping(true);
                          setIsEditingBilling(true);
                        }}
                        style={{
                          backgroundColor: '#FFF0F2',
                          color: '#5C5454',
                          border: '1px solid #B38B8F',
                          borderRadius: '22px',
                          padding: '10px 20px',
                          fontFamily: "'Cormorant Garamond', serif",
                          fontSize: '1.08rem',
                          fontWeight: 'bold',
                          cursor: 'pointer'
                        }}
                      >
                        ✏️ Update All Fields
                      </button>
                      <button
                        type="button"
                        disabled={isSavingAccount}
                        onClick={() => handleSaveAccountSection('all')}
                        style={{
                          background: 'linear-gradient(135deg, #B38B8F 0%, #D4A5A9 100%)',
                          color: '#FFFFFF',
                          border: 'none',
                          borderRadius: '22px',
                          padding: '11px 24px',
                          fontFamily: "'Cormorant Garamond', serif",
                          fontSize: '1.12rem',
                          fontWeight: 'bold',
                          cursor: isSavingAccount ? 'wait' : 'pointer',
                          boxShadow: '0 4px 14px rgba(179, 139, 143, 0.3)'
                        }}
                      >
                        {savingSection === 'all' ? '⏳ Saving All Changes...' : '💾 Save All Account Changes ✧'}
                      </button>
                    </div>
                  </div>

                  {accountStatusBanner.text && (
                    <div
                      style={{
                        padding: '15px 22px',
                        borderRadius: '14px',
                        backgroundColor: accountStatusBanner.type === 'error' ? '#FFEBEE' : '#E8F5E9',
                        color: accountStatusBanner.type === 'error' ? '#C62828' : '#2E7D32',
                        border: `1px solid ${accountStatusBanner.type === 'error' ? '#EF9A9A' : '#A5D6A7'}`,
                        fontFamily: 'sans-serif',
                        fontSize: '0.95rem',
                        fontWeight: 'bold',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <span>{accountStatusBanner.type === 'error' ? '⚠️ ' : '✓ '}{accountStatusBanner.text}</span>
                      <button
                        type="button"
                        onClick={() => setAccountStatusBanner({ type: '', text: '' })}
                        style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 'bold' }}
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {/* Top Grid: Profile Picture Uploader + Membership Tier Card */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
                    {/* Profile Picture Uploader Card */}
                    <div style={{ backgroundColor: '#FFFFFF', borderRadius: '18px', border: avatarPendingSave ? '2px solid #B38B8F' : '1px solid #E8C5C8', padding: '28px', boxShadow: '0 6px 20px rgba(232, 197, 200, 0.14)', display: 'flex', alignItems: 'center', gap: '22px', flexWrap: 'wrap' }}>
                      <div style={{ position: 'relative', width: '108px', height: '108px', flexShrink: 0 }}>
                        {accountForm.avatarUrl ? (
                          <img
                            src={accountForm.avatarUrl}
                            alt={accountForm.name || 'Member Avatar'}
                            style={{
                              width: '108px',
                              height: '108px',
                              borderRadius: '50%',
                              objectFit: 'cover',
                              border: '3px solid #B38B8F',
                              boxShadow: '0 6px 18px rgba(179, 139, 143, 0.28)'
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: '108px',
                              height: '108px',
                              borderRadius: '50%',
                              backgroundColor: '#FFF0F2',
                              border: '2.5px dashed #B38B8F',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontFamily: "'Cormorant Garamond', serif",
                              fontSize: '2.6rem',
                              color: '#B38B8F',
                              fontWeight: 'bold'
                            }}
                          >
                            {(accountForm.name || accountForm.username || accountForm.email || 'M').charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>

                      <div style={{ flex: 1, minWidth: '210px' }}>
                        <span style={{ display: 'inline-block', backgroundColor: '#FFF0F2', color: '#B38B8F', border: '1px solid #E8C5C8', borderRadius: '14px', padding: '3px 10px', fontSize: '0.74rem', fontWeight: 'bold', fontFamily: 'sans-serif', marginBottom: '6px' }}>
                          📸 SANCTUARY PORTRAIT
                        </span>
                        <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.65rem', color: '#5C5454', margin: '0 0 6px 0' }}>
                          Profile Picture
                        </h3>
                        <p style={{ margin: '0 0 14px 0', fontSize: '0.86rem', fontFamily: 'sans-serif', color: '#736A6A', lineHeight: '1.45' }}>
                          Choose a new portrait and click <strong>Save Profile Picture</strong> to update your Sanctuary header.
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                          <label
                            style={{
                              display: 'inline-block',
                              backgroundColor: '#FFF0F2',
                              color: '#5C5454',
                              border: '1px solid #B38B8F',
                              borderRadius: '18px',
                              padding: '8px 15px',
                              fontSize: '0.86rem',
                              fontFamily: 'sans-serif',
                              fontWeight: 'bold',
                              cursor: isUploadingAvatar ? 'wait' : 'pointer'
                            }}
                          >
                            {isUploadingAvatar ? '⏳ Processing...' : '📷 Choose / Update Photo'}
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleAccountAvatarUpload}
                              style={{ display: 'none' }}
                              disabled={isUploadingAvatar}
                            />
                          </label>

                          <button
                            type="button"
                            disabled={isSavingAccount}
                            onClick={handleSaveProfilePicture}
                            style={{
                              backgroundColor: '#B38B8F',
                              color: '#FFFFFF',
                              border: 'none',
                              borderRadius: '18px',
                              padding: '8px 16px',
                              fontSize: '0.86rem',
                              fontFamily: 'sans-serif',
                              fontWeight: 'bold',
                              cursor: isSavingAccount ? 'wait' : 'pointer',
                              boxShadow: '0 4px 12px rgba(179, 139, 143, 0.28)'
                            }}
                          >
                            {savingSection === 'avatar' ? '⏳ Saving...' : '💾 Save Profile Picture'}
                          </button>

                          {accountForm.avatarUrl && (
                            <button
                              type="button"
                              onClick={handleRemoveAccountAvatar}
                              style={{
                                backgroundColor: 'transparent',
                                color: '#8A797A',
                                border: '1px solid #E8C5C8',
                                borderRadius: '18px',
                                padding: '7px 14px',
                                fontSize: '0.82rem',
                                fontFamily: 'sans-serif',
                                cursor: 'pointer'
                              }}
                            >
                              🗑️ Remove Photo
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Membership Tier Status & Upgrade Card */}
                    <div
                      style={{
                        backgroundColor: effectiveMemberTier === 'radiance' ? '#FAF7FF' : '#FFFFFF',
                        borderRadius: '18px',
                        border: effectiveMemberTier === 'radiance' ? '1.5px solid #D1C4E9' : '1px solid #E8C5C8',
                        padding: '28px',
                        boxShadow: '0 6px 20px rgba(232, 197, 200, 0.14)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>
                          <span style={{ fontSize: '0.75rem', fontFamily: 'sans-serif', color: effectiveMemberTier === 'radiance' ? '#5E35B1' : '#B38B8F', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.7px' }}>
                            Active Sanctuary Tier
                          </span>
                          <span
                            style={{
                              backgroundColor: effectiveMemberTier === 'radiance' ? '#EDE7F6' : effectiveMemberTier === 'luminary' ? '#FFF0F2' : '#F5F0F0',
                              color: effectiveMemberTier === 'radiance' ? '#5E35B1' : effectiveMemberTier === 'luminary' ? '#B38B8F' : '#736A6A',
                              borderRadius: '14px',
                              padding: '4px 12px',
                              fontSize: '0.78rem',
                              fontFamily: 'sans-serif',
                              fontWeight: 'bold'
                            }}
                          >
                            {effectiveMemberTier === 'radiance'
                              ? '💎 $119 / month'
                              : effectiveMemberTier === 'luminary'
                              ? '✨ $49 / month'
                              : '🌿 $0 / month (Free)'}
                          </span>
                        </div>
                        <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.8rem', color: '#5C5454', margin: '0 0 8px 0' }}>
                          {effectiveMemberTier === 'radiance'
                            ? 'The Radiance Elite'
                            : effectiveMemberTier === 'luminary'
                            ? 'The Luminary Circle'
                            : 'Free Sanctuary Member'}
                        </h3>
                        <p style={{ margin: '0 0 16px 0', fontSize: '0.88rem', fontFamily: 'sans-serif', color: '#736A6A', lineHeight: '1.5' }}>
                          {effectiveMemberTier === 'radiance'
                            ? 'Includes Monthly 1-on-1 Consultations (every 30 days), Odie AI Skin Photo Analysis on your Blueprint Quiz, and 25% off the Boutique.'
                            : effectiveMemberTier === 'luminary'
                            ? 'Includes Quarterly 1-on-1 Consultations (1 every 90 days), full 10-Step Beauty Blueprint Quiz access, and 10% off the Boutique.'
                            : 'Includes Boutique shopping and Account management. Upgrade to unlock the 10-Step Beauty Blueprint Quiz and 1-on-1 Consultations with Susan.'}
                        </p>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        {effectiveMemberTier !== 'radiance' ? (
                          <button
                            type="button"
                            onClick={() =>
                              openPaywallModal(
                                effectiveMemberTier === 'luminary'
                                  ? 'Upgrade from The Luminary Circle to The Radiance Elite ($119/mo) to unlock Monthly Consultations, AI Skin Photo Analysis, and 25% off the Boutique.'
                                  : 'Upgrade your Free Sanctuary account to The Luminary Circle ($49/mo) or The Radiance Elite ($119/mo).'
                              )
                            }
                            style={{
                              background: effectiveMemberTier === 'luminary'
                                ? 'linear-gradient(135deg, #5E35B1 0%, #7E57C2 100%)'
                                : 'linear-gradient(135deg, #B38B8F 0%, #D4A5A9 100%)',
                              color: '#FFFFFF',
                              border: 'none',
                              borderRadius: '20px',
                              padding: '10px 20px',
                              fontFamily: "'Cormorant Garamond', serif",
                              fontSize: '1.08rem',
                              fontWeight: 'bold',
                              cursor: 'pointer',
                              boxShadow: '0 4px 12px rgba(94, 53, 177, 0.2)'
                            }}
                          >
                            {effectiveMemberTier === 'luminary'
                              ? '💎 Upgrade to The Radiance Elite ($119/mo) ✧'
                              : '✨ View Membership Tiers & Upgrade ✧'}
                          </button>
                        ) : (
                          <div style={{ fontSize: '0.84rem', fontFamily: 'sans-serif', color: '#5E35B1', fontWeight: 'bold' }}>
                            ✓ Highest Sanctuary Tier Unlocked
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Account, Shipping & Billing Form */}
                  <form onSubmit={handleSaveAccountProfile} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {/* Section 1: Personal & Account Details */}
                    <div
                      style={{
                        backgroundColor: '#FFFFFF',
                        borderRadius: '18px',
                        border: isEditingPersonal ? '2px solid #B38B8F' : '1px solid #E8C5C8',
                        padding: '30px',
                        boxShadow: '0 6px 20px rgba(232, 197, 200, 0.12)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '6px' }}>
                        <div>
                          <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.85rem', color: '#5C5454', margin: 0 }}>
                            1. Personal & Account Details
                          </h3>
                          <p style={{ margin: '4px 0 0 0', fontSize: '0.9rem', fontFamily: 'sans-serif', color: '#8A797A' }}>
                            Manage your display name, unique Sanctuary username, email address, phone number, and password.
                          </p>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                          {!isEditingPersonal ? (
                            <button
                              type="button"
                              onClick={() => setIsEditingPersonal(true)}
                              style={{
                                backgroundColor: '#FFF0F2',
                                color: '#5C5454',
                                border: '1px solid #B38B8F',
                                borderRadius: '18px',
                                padding: '9px 18px',
                                fontFamily: 'sans-serif',
                                fontSize: '0.86rem',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                              }}
                            >
                              ✏️ Update Account Info
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => handleCancelAccountSection('personal')}
                                style={{
                                  backgroundColor: 'transparent',
                                  color: '#8A797A',
                                  border: '1px solid #E8C5C8',
                                  borderRadius: '18px',
                                  padding: '8px 15px',
                                  fontFamily: 'sans-serif',
                                  fontSize: '0.84rem',
                                  cursor: 'pointer'
                                }}
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                disabled={isSavingAccount}
                                onClick={() => handleSaveAccountSection('personal')}
                                style={{
                                  backgroundColor: '#B38B8F',
                                  color: '#FFFFFF',
                                  border: 'none',
                                  borderRadius: '18px',
                                  padding: '9px 18px',
                                  fontFamily: 'sans-serif',
                                  fontSize: '0.86rem',
                                  fontWeight: 'bold',
                                  cursor: isSavingAccount ? 'wait' : 'pointer',
                                  boxShadow: '0 4px 12px rgba(179, 139, 143, 0.28)'
                                }}
                              >
                                {savingSection === 'personal' ? '⏳ Saving...' : '💾 Save Account Info'}
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '18px', marginTop: '20px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.82rem', fontFamily: 'sans-serif', color: '#5C5454', fontWeight: 'bold', marginBottom: '6px' }}>
                            Full Name
                          </label>
                          <input
                            type="text"
                            value={accountForm.name}
                            readOnly={!isEditingPersonal}
                            onClick={() => { if (!isEditingPersonal) setIsEditingPersonal(true); }}
                            onChange={(e) => setAccountForm(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="Jane Doe"
                            required
                            style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: isEditingPersonal ? '1.5px solid #B38B8F' : '1px solid #E8C5C8', backgroundColor: isEditingPersonal ? '#FFFFFF' : '#FFF9F9', fontFamily: 'sans-serif', fontSize: '0.95rem', boxSizing: 'border-box' }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.82rem', fontFamily: 'sans-serif', color: '#5C5454', fontWeight: 'bold', marginBottom: '6px' }}>
                            Username
                          </label>
                          <input
                            type="text"
                            value={accountForm.username}
                            readOnly={!isEditingPersonal}
                            onClick={() => { if (!isEditingPersonal) setIsEditingPersonal(true); }}
                            onChange={(e) => setAccountForm(prev => ({ ...prev, username: e.target.value }))}
                            placeholder="janedoe_glow"
                            style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: isEditingPersonal ? '1.5px solid #B38B8F' : '1px solid #E8C5C8', backgroundColor: isEditingPersonal ? '#FFFFFF' : '#FFF9F9', fontFamily: 'sans-serif', fontSize: '0.95rem', boxSizing: 'border-box' }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.82rem', fontFamily: 'sans-serif', color: '#5C5454', fontWeight: 'bold', marginBottom: '6px' }}>
                            Email Address
                          </label>
                          <input
                            type="email"
                            value={accountForm.email}
                            readOnly={!isEditingPersonal}
                            onClick={() => { if (!isEditingPersonal) setIsEditingPersonal(true); }}
                            onChange={(e) => setAccountForm(prev => ({ ...prev, email: e.target.value }))}
                            placeholder="jane@example.com"
                            required
                            style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: isEditingPersonal ? '1.5px solid #B38B8F' : '1px solid #E8C5C8', backgroundColor: isEditingPersonal ? '#FFFFFF' : '#FFF9F9', fontFamily: 'sans-serif', fontSize: '0.95rem', boxSizing: 'border-box' }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.82rem', fontFamily: 'sans-serif', color: '#5C5454', fontWeight: 'bold', marginBottom: '6px' }}>
                            Phone Number
                          </label>
                          <input
                            type="tel"
                            value={accountForm.phone}
                            readOnly={!isEditingPersonal}
                            onClick={() => { if (!isEditingPersonal) setIsEditingPersonal(true); }}
                            onChange={(e) => setAccountForm(prev => ({ ...prev, phone: e.target.value }))}
                            placeholder="(555) 234-5678"
                            style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: isEditingPersonal ? '1.5px solid #B38B8F' : '1px solid #E8C5C8', backgroundColor: isEditingPersonal ? '#FFFFFF' : '#FFF9F9', fontFamily: 'sans-serif', fontSize: '0.95rem', boxSizing: 'border-box' }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.82rem', fontFamily: 'sans-serif', color: '#5C5454', fontWeight: 'bold', marginBottom: '6px' }}>
                            Update Password <span style={{ fontWeight: 'normal', color: '#8A797A' }}>(Optional)</span>
                          </label>
                          <input
                            type="password"
                            value={accountForm.newPassword}
                            readOnly={!isEditingPersonal}
                            onClick={() => { if (!isEditingPersonal) setIsEditingPersonal(true); }}
                            onChange={(e) => setAccountForm(prev => ({ ...prev, newPassword: e.target.value }))}
                            placeholder="Leave blank to keep current password"
                            style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: isEditingPersonal ? '1.5px solid #B38B8F' : '1px solid #E8C5C8', backgroundColor: isEditingPersonal ? '#FFFFFF' : '#FFF9F9', fontFamily: 'sans-serif', fontSize: '0.95rem', boxSizing: 'border-box' }}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #F5E6E8' }}>
                        {!isEditingPersonal && (
                          <button
                            type="button"
                            onClick={() => setIsEditingPersonal(true)}
                            style={{
                              backgroundColor: '#FFF0F2',
                              color: '#5C5454',
                              border: '1px solid #B38B8F',
                              borderRadius: '18px',
                              padding: '9px 18px',
                              fontFamily: 'sans-serif',
                              fontSize: '0.86rem',
                              fontWeight: 'bold',
                              cursor: 'pointer'
                            }}
                          >
                            ✏️ Update Account Info
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={isSavingAccount}
                          onClick={() => handleSaveAccountSection('personal')}
                          style={{
                            backgroundColor: '#B38B8F',
                            color: '#FFFFFF',
                            border: 'none',
                            borderRadius: '18px',
                            padding: '9px 20px',
                            fontFamily: 'sans-serif',
                            fontSize: '0.86rem',
                            fontWeight: 'bold',
                            cursor: isSavingAccount ? 'wait' : 'pointer',
                            boxShadow: '0 4px 12px rgba(179, 139, 143, 0.25)'
                          }}
                        >
                          {savingSection === 'personal' ? '⏳ Saving Account Info...' : '💾 Save Account Info'}
                        </button>
                      </div>
                    </div>

                    {/* Section 2: Default Shipping Address */}
                    <div
                      style={{
                        backgroundColor: '#FFFFFF',
                        borderRadius: '18px',
                        border: isEditingShipping ? '2px solid #B38B8F' : '1px solid #E8C5C8',
                        padding: '30px',
                        boxShadow: '0 6px 20px rgba(232, 197, 200, 0.12)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '6px' }}>
                        <div>
                          <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.85rem', color: '#5C5454', margin: 0 }}>
                            2. Shipping Address
                          </h3>
                          <p style={{ margin: '4px 0 0 0', fontSize: '0.9rem', fontFamily: 'sans-serif', color: '#8A797A' }}>
                            Your saved delivery destination for Boutique orders and curated beauty boxes.
                          </p>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                          {!isEditingShipping ? (
                            <button
                              type="button"
                              onClick={() => setIsEditingShipping(true)}
                              style={{
                                backgroundColor: '#FFF0F2',
                                color: '#5C5454',
                                border: '1px solid #B38B8F',
                                borderRadius: '18px',
                                padding: '9px 18px',
                                fontFamily: 'sans-serif',
                                fontSize: '0.86rem',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                              }}
                            >
                              ✏️ Update Shipping Address
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => handleCancelAccountSection('shipping')}
                                style={{
                                  backgroundColor: 'transparent',
                                  color: '#8A797A',
                                  border: '1px solid #E8C5C8',
                                  borderRadius: '18px',
                                  padding: '8px 15px',
                                  fontFamily: 'sans-serif',
                                  fontSize: '0.84rem',
                                  cursor: 'pointer'
                                }}
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                disabled={isSavingAccount}
                                onClick={() => handleSaveAccountSection('shipping')}
                                style={{
                                  backgroundColor: '#B38B8F',
                                  color: '#FFFFFF',
                                  border: 'none',
                                  borderRadius: '18px',
                                  padding: '9px 18px',
                                  fontFamily: 'sans-serif',
                                  fontSize: '0.86rem',
                                  fontWeight: 'bold',
                                  cursor: isSavingAccount ? 'wait' : 'pointer',
                                  boxShadow: '0 4px 12px rgba(179, 139, 143, 0.28)'
                                }}
                              >
                                {savingSection === 'shipping' ? '⏳ Saving...' : '💾 Save Shipping Address'}
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '18px', marginTop: '20px' }}>
                        <div style={{ gridColumn: '1 / -1' }}>
                          <label style={{ display: 'block', fontSize: '0.82rem', fontFamily: 'sans-serif', color: '#5C5454', fontWeight: 'bold', marginBottom: '6px' }}>
                            Street Address
                          </label>
                          <input
                            type="text"
                            value={accountForm.shippingAddress.address_1}
                            readOnly={!isEditingShipping}
                            onClick={() => { if (!isEditingShipping) setIsEditingShipping(true); }}
                            onChange={(e) =>
                              setAccountForm(prev => ({
                                ...prev,
                                shippingAddress: { ...prev.shippingAddress, address_1: e.target.value }
                              }))
                            }
                            placeholder="123 Rosewater Boulevard"
                            style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: isEditingShipping ? '1.5px solid #B38B8F' : '1px solid #E8C5C8', backgroundColor: isEditingShipping ? '#FFFFFF' : '#FFF9F9', fontFamily: 'sans-serif', fontSize: '0.95rem', boxSizing: 'border-box' }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.82rem', fontFamily: 'sans-serif', color: '#5C5454', fontWeight: 'bold', marginBottom: '6px' }}>
                            Apartment, Suite, or Unit <span style={{ fontWeight: 'normal', color: '#8A797A' }}>(Optional)</span>
                          </label>
                          <input
                            type="text"
                            value={accountForm.shippingAddress.address_2}
                            readOnly={!isEditingShipping}
                            onClick={() => { if (!isEditingShipping) setIsEditingShipping(true); }}
                            onChange={(e) =>
                              setAccountForm(prev => ({
                                ...prev,
                                shippingAddress: { ...prev.shippingAddress, address_2: e.target.value }
                              }))
                            }
                            placeholder="Suite 4B"
                            style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: isEditingShipping ? '1.5px solid #B38B8F' : '1px solid #E8C5C8', backgroundColor: isEditingShipping ? '#FFFFFF' : '#FFF9F9', fontFamily: 'sans-serif', fontSize: '0.95rem', boxSizing: 'border-box' }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.82rem', fontFamily: 'sans-serif', color: '#5C5454', fontWeight: 'bold', marginBottom: '6px' }}>
                            City
                          </label>
                          <input
                            type="text"
                            value={accountForm.shippingAddress.city}
                            readOnly={!isEditingShipping}
                            onClick={() => { if (!isEditingShipping) setIsEditingShipping(true); }}
                            onChange={(e) =>
                              setAccountForm(prev => ({
                                ...prev,
                                shippingAddress: { ...prev.shippingAddress, city: e.target.value }
                              }))
                            }
                            placeholder="Beverly Hills"
                            style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: isEditingShipping ? '1.5px solid #B38B8F' : '1px solid #E8C5C8', backgroundColor: isEditingShipping ? '#FFFFFF' : '#FFF9F9', fontFamily: 'sans-serif', fontSize: '0.95rem', boxSizing: 'border-box' }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.82rem', fontFamily: 'sans-serif', color: '#5C5454', fontWeight: 'bold', marginBottom: '6px' }}>
                            State / Province
                          </label>
                          <input
                            type="text"
                            value={accountForm.shippingAddress.state}
                            readOnly={!isEditingShipping}
                            onClick={() => { if (!isEditingShipping) setIsEditingShipping(true); }}
                            onChange={(e) =>
                              setAccountForm(prev => ({
                                ...prev,
                                shippingAddress: { ...prev.shippingAddress, state: e.target.value }
                              }))
                            }
                            placeholder="CA"
                            style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: isEditingShipping ? '1.5px solid #B38B8F' : '1px solid #E8C5C8', backgroundColor: isEditingShipping ? '#FFFFFF' : '#FFF9F9', fontFamily: 'sans-serif', fontSize: '0.95rem', boxSizing: 'border-box' }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.82rem', fontFamily: 'sans-serif', color: '#5C5454', fontWeight: 'bold', marginBottom: '6px' }}>
                            ZIP / Postal Code
                          </label>
                          <input
                            type="text"
                            value={accountForm.shippingAddress.postcode}
                            readOnly={!isEditingShipping}
                            onClick={() => { if (!isEditingShipping) setIsEditingShipping(true); }}
                            onChange={(e) =>
                              setAccountForm(prev => ({
                                ...prev,
                                shippingAddress: { ...prev.shippingAddress, postcode: e.target.value }
                              }))
                            }
                            placeholder="90210"
                            style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: isEditingShipping ? '1.5px solid #B38B8F' : '1px solid #E8C5C8', backgroundColor: isEditingShipping ? '#FFFFFF' : '#FFF9F9', fontFamily: 'sans-serif', fontSize: '0.95rem', boxSizing: 'border-box' }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.82rem', fontFamily: 'sans-serif', color: '#5C5454', fontWeight: 'bold', marginBottom: '6px' }}>
                            Country
                          </label>
                          <input
                            type="text"
                            value={accountForm.shippingAddress.country}
                            readOnly={!isEditingShipping}
                            onClick={() => { if (!isEditingShipping) setIsEditingShipping(true); }}
                            onChange={(e) =>
                              setAccountForm(prev => ({
                                ...prev,
                                shippingAddress: { ...prev.shippingAddress, country: e.target.value }
                              }))
                            }
                            placeholder="US"
                            style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: isEditingShipping ? '1.5px solid #B38B8F' : '1px solid #E8C5C8', backgroundColor: isEditingShipping ? '#FFFFFF' : '#FFF9F9', fontFamily: 'sans-serif', fontSize: '0.95rem', boxSizing: 'border-box' }}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #F5E6E8' }}>
                        {!isEditingShipping && (
                          <button
                            type="button"
                            onClick={() => setIsEditingShipping(true)}
                            style={{
                              backgroundColor: '#FFF0F2',
                              color: '#5C5454',
                              border: '1px solid #B38B8F',
                              borderRadius: '18px',
                              padding: '9px 18px',
                              fontFamily: 'sans-serif',
                              fontSize: '0.86rem',
                              fontWeight: 'bold',
                              cursor: 'pointer'
                            }}
                          >
                            ✏️ Update Shipping Address
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={isSavingAccount}
                          onClick={() => handleSaveAccountSection('shipping')}
                          style={{
                            backgroundColor: '#B38B8F',
                            color: '#FFFFFF',
                            border: 'none',
                            borderRadius: '18px',
                            padding: '9px 20px',
                            fontFamily: 'sans-serif',
                            fontSize: '0.86rem',
                            fontWeight: 'bold',
                            cursor: isSavingAccount ? 'wait' : 'pointer',
                            boxShadow: '0 4px 12px rgba(179, 139, 143, 0.25)'
                          }}
                        >
                          {savingSection === 'shipping' ? '⏳ Saving Shipping Address...' : '💾 Save Shipping Address'}
                        </button>
                      </div>
                    </div>

                    {/* Section 3: Billing Information */}
                    <div
                      style={{
                        backgroundColor: '#FFFFFF',
                        borderRadius: '18px',
                        border: isEditingBilling ? '2px solid #B38B8F' : '1px solid #E8C5C8',
                        padding: '30px',
                        boxShadow: '0 6px 20px rgba(232, 197, 200, 0.12)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '6px' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                            <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.85rem', color: '#5C5454', margin: 0 }}>
                              3. Billing Information
                            </h3>
                            <span style={{ fontSize: '0.76rem', fontFamily: 'sans-serif', color: '#8A797A', backgroundColor: '#FFF9F9', border: '1px solid #E8C5C8', borderRadius: '12px', padding: '3px 10px' }}>
                              🔒 Encrypted Stripe Billing Record
                            </span>
                          </div>
                          <p style={{ margin: '4px 0 0 0', fontSize: '0.9rem', fontFamily: 'sans-serif', color: '#8A797A' }}>
                            Update and save your preferred payment card summary & billing address, or launch the live Stripe Customer Billing Portal.
                          </p>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            disabled={isOpeningBillingPortal}
                            onClick={handleOpenStripeBillingPortal}
                            style={{
                              backgroundColor: '#F4F0FF',
                              color: '#5E35B1',
                              border: '1px solid #D1C4E9',
                              borderRadius: '18px',
                              padding: '9px 16px',
                              fontFamily: 'sans-serif',
                              fontSize: '0.84rem',
                              fontWeight: 'bold',
                              cursor: isOpeningBillingPortal ? 'wait' : 'pointer'
                            }}
                          >
                            {isOpeningBillingPortal ? '⏳ Connecting to Stripe...' : '💳 Open Live Stripe Billing Portal ↗'}
                          </button>

                          {!isEditingBilling ? (
                            <button
                              type="button"
                              onClick={() => setIsEditingBilling(true)}
                              style={{
                                backgroundColor: '#FFF0F2',
                                color: '#5C5454',
                                border: '1px solid #B38B8F',
                                borderRadius: '18px',
                                padding: '9px 18px',
                                fontFamily: 'sans-serif',
                                fontSize: '0.86rem',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                              }}
                            >
                              ✏️ Update Billing Info
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => handleCancelAccountSection('billing')}
                                style={{
                                  backgroundColor: 'transparent',
                                  color: '#8A797A',
                                  border: '1px solid #E8C5C8',
                                  borderRadius: '18px',
                                  padding: '8px 15px',
                                  fontFamily: 'sans-serif',
                                  fontSize: '0.84rem',
                                  cursor: 'pointer'
                                }}
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                disabled={isSavingAccount}
                                onClick={() => handleSaveAccountSection('billing')}
                                style={{
                                  backgroundColor: '#B38B8F',
                                  color: '#FFFFFF',
                                  border: 'none',
                                  borderRadius: '18px',
                                  padding: '9px 18px',
                                  fontFamily: 'sans-serif',
                                  fontSize: '0.86rem',
                                  fontWeight: 'bold',
                                  cursor: isSavingAccount ? 'wait' : 'pointer',
                                  boxShadow: '0 4px 12px rgba(179, 139, 143, 0.28)'
                                }}
                              >
                                {savingSection === 'billing' ? '⏳ Saving...' : '💾 Save Billing Info'}
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '18px', marginTop: '20px' }}>
                        <div style={{ gridColumn: 'span 2' }}>
                          <label style={{ display: 'block', fontSize: '0.82rem', fontFamily: 'sans-serif', color: '#5C5454', fontWeight: 'bold', marginBottom: '6px' }}>
                            Cardholder Name
                          </label>
                          <input
                            type="text"
                            value={accountForm.billingInfo.billingName}
                            readOnly={!isEditingBilling}
                            onClick={() => { if (!isEditingBilling) setIsEditingBilling(true); }}
                            onChange={(e) =>
                              setAccountForm(prev => ({
                                ...prev,
                                billingInfo: { ...prev.billingInfo, billingName: e.target.value }
                              }))
                            }
                            placeholder="Jane Doe"
                            style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: isEditingBilling ? '1.5px solid #B38B8F' : '1px solid #E8C5C8', backgroundColor: isEditingBilling ? '#FFFFFF' : '#FFF9F9', fontFamily: 'sans-serif', fontSize: '0.95rem', boxSizing: 'border-box' }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.82rem', fontFamily: 'sans-serif', color: '#5C5454', fontWeight: 'bold', marginBottom: '6px' }}>
                            Card Brand
                          </label>
                          <select
                            value={accountForm.billingInfo.cardBrand || 'Visa'}
                            disabled={!isEditingBilling}
                            onChange={(e) =>
                              setAccountForm(prev => ({
                                ...prev,
                                billingInfo: { ...prev.billingInfo, cardBrand: e.target.value }
                              }))
                            }
                            style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: isEditingBilling ? '1.5px solid #B38B8F' : '1px solid #E8C5C8', backgroundColor: isEditingBilling ? '#FFFFFF' : '#FFF9F9', fontFamily: 'sans-serif', fontSize: '0.95rem', boxSizing: 'border-box' }}
                          >
                            <option value="Visa">Visa</option>
                            <option value="Mastercard">Mastercard</option>
                            <option value="American Express">American Express</option>
                            <option value="Discover">Discover</option>
                          </select>
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.82rem', fontFamily: 'sans-serif', color: '#5C5454', fontWeight: 'bold', marginBottom: '6px' }}>
                            Last 4 Digits of Card
                          </label>
                          <input
                            type="text"
                            maxLength={4}
                            value={accountForm.billingInfo.cardLast4}
                            readOnly={!isEditingBilling}
                            onClick={() => { if (!isEditingBilling) setIsEditingBilling(true); }}
                            onChange={(e) =>
                              setAccountForm(prev => ({
                                ...prev,
                                billingInfo: { ...prev.billingInfo, cardLast4: e.target.value.replace(/\D/g, '').slice(0, 4) }
                              }))
                            }
                            placeholder="4242"
                            style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: isEditingBilling ? '1.5px solid #B38B8F' : '1px solid #E8C5C8', backgroundColor: isEditingBilling ? '#FFFFFF' : '#FFF9F9', fontFamily: 'sans-serif', fontSize: '0.95rem', boxSizing: 'border-box' }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.82rem', fontFamily: 'sans-serif', color: '#5C5454', fontWeight: 'bold', marginBottom: '6px' }}>
                            Exp. Month (MM)
                          </label>
                          <input
                            type="text"
                            maxLength={2}
                            value={accountForm.billingInfo.expMonth}
                            readOnly={!isEditingBilling}
                            onClick={() => { if (!isEditingBilling) setIsEditingBilling(true); }}
                            onChange={(e) =>
                              setAccountForm(prev => ({
                                ...prev,
                                billingInfo: { ...prev.billingInfo, expMonth: e.target.value.replace(/\D/g, '').slice(0, 2) }
                              }))
                            }
                            placeholder="08"
                            style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: isEditingBilling ? '1.5px solid #B38B8F' : '1px solid #E8C5C8', backgroundColor: isEditingBilling ? '#FFFFFF' : '#FFF9F9', fontFamily: 'sans-serif', fontSize: '0.95rem', boxSizing: 'border-box' }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.82rem', fontFamily: 'sans-serif', color: '#5C5454', fontWeight: 'bold', marginBottom: '6px' }}>
                            Exp. Year (YYYY)
                          </label>
                          <input
                            type="text"
                            maxLength={4}
                            value={accountForm.billingInfo.expYear}
                            readOnly={!isEditingBilling}
                            onClick={() => { if (!isEditingBilling) setIsEditingBilling(true); }}
                            onChange={(e) =>
                              setAccountForm(prev => ({
                                ...prev,
                                billingInfo: { ...prev.billingInfo, expYear: e.target.value.replace(/\D/g, '').slice(0, 4) }
                              }))
                            }
                            placeholder="2028"
                            style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: isEditingBilling ? '1.5px solid #B38B8F' : '1px solid #E8C5C8', backgroundColor: isEditingBilling ? '#FFFFFF' : '#FFF9F9', fontFamily: 'sans-serif', fontSize: '0.95rem', boxSizing: 'border-box' }}
                          />
                        </div>

                        <div style={{ gridColumn: '1 / -1' }}>
                          <label style={{ display: 'block', fontSize: '0.82rem', fontFamily: 'sans-serif', color: '#5C5454', fontWeight: 'bold', marginBottom: '6px' }}>
                            Billing Address
                          </label>
                          <input
                            type="text"
                            value={accountForm.billingInfo.billingAddress}
                            readOnly={!isEditingBilling}
                            onClick={() => { if (!isEditingBilling) setIsEditingBilling(true); }}
                            onChange={(e) =>
                              setAccountForm(prev => ({
                                ...prev,
                                billingInfo: { ...prev.billingInfo, billingAddress: e.target.value }
                              }))
                            }
                            placeholder="123 Rosewater Boulevard, Beverly Hills, CA 90210"
                            style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: isEditingBilling ? '1.5px solid #B38B8F' : '1px solid #E8C5C8', backgroundColor: isEditingBilling ? '#FFFFFF' : '#FFF9F9', fontFamily: 'sans-serif', fontSize: '0.95rem', boxSizing: 'border-box' }}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #F5E6E8' }}>
                        {!isEditingBilling && (
                          <button
                            type="button"
                            onClick={() => setIsEditingBilling(true)}
                            style={{
                              backgroundColor: '#FFF0F2',
                              color: '#5C5454',
                              border: '1px solid #B38B8F',
                              borderRadius: '18px',
                              padding: '9px 18px',
                              fontFamily: 'sans-serif',
                              fontSize: '0.86rem',
                              fontWeight: 'bold',
                              cursor: 'pointer'
                            }}
                          >
                            ✏️ Update Billing Info
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={isSavingAccount}
                          onClick={() => handleSaveAccountSection('billing')}
                          style={{
                            backgroundColor: '#B38B8F',
                            color: '#FFFFFF',
                            border: 'none',
                            borderRadius: '18px',
                            padding: '9px 20px',
                            fontFamily: 'sans-serif',
                            fontSize: '0.86rem',
                            fontWeight: 'bold',
                            cursor: isSavingAccount ? 'wait' : 'pointer',
                            boxShadow: '0 4px 12px rgba(179, 139, 143, 0.25)'
                          }}
                        >
                          {savingSection === 'billing' ? '⏳ Saving Billing Info...' : '💾 Save Billing Info'}
                        </button>
                      </div>
                    </div>

                    {/* Master Save All Footer Row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', backgroundColor: '#FFF9F9', padding: '20px 26px', borderRadius: '18px', border: '1px solid #E8C5C8' }}>
                      <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.15rem', color: '#736A6A', fontStyle: 'italic' }}>
                        All changes sync immediately with your Sanctuary profile and Boutique checkout defaults.
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditingPersonal(true);
                            setIsEditingShipping(true);
                            setIsEditingBilling(true);
                          }}
                          style={{
                            backgroundColor: '#FFFFFF',
                            color: '#5C5454',
                            border: '1px solid #B38B8F',
                            borderRadius: '25px',
                            padding: '13px 24px',
                            fontFamily: "'Cormorant Garamond', serif",
                            fontSize: '1.15rem',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                          }}
                        >
                          ✏️ Update All Fields
                        </button>
                        <button
                          type="submit"
                          disabled={isSavingAccount}
                          style={{
                            background: 'linear-gradient(135deg, #B38B8F 0%, #D4A5A9 100%)',
                            color: '#FFFFFF',
                            border: 'none',
                            borderRadius: '25px',
                            padding: '14px 34px',
                            fontFamily: "'Cormorant Garamond', serif",
                            fontSize: '1.25rem',
                            fontWeight: 'bold',
                            cursor: isSavingAccount ? 'wait' : 'pointer',
                            boxShadow: '0 8px 22px rgba(179, 139, 143, 0.35)'
                          }}
                        >
                          {savingSection === 'all' ? '⏳ Saving All Account Changes...' : '💾 Save All Account Changes ✧'}
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              )}

            </div>
          </div>
        )}

        {step === 6 && (
          <AdminDashboard
            adminData={adminData}
            onLogout={handleLogOut}
            backendProducts={backendProducts}
            onProductDeleted={(deletedId) => setBackendProducts(prev => prev.filter(p => p._id !== deletedId))}
            onCatalogUpdated={(updatedCatalog) => setBackendProducts(updatedCatalog)}
            onRefreshAdminData={() => {
              const token = localStorage.getItem('token');
              if (token) fetchAdminData(token);
            }}
          />
        )}

        {/* ---------------- CONSULTATION QUIZ STEPS 11-21 ---------------- */}
        
        {step === 11 && (
          <div style={{ animation: 'fadeIn 1s ease' }}>
            <ProgressDots currentStep={1} totalSteps={10} />
            <h2 style={{ fontSize: '3rem', color: '#B38B8F', fontFamily: "'Alex Brush', cursive", margin: '0 0 20px 0' }}>Discover Your Temperament</h2>
            <p style={{ fontSize: '1.4rem', color: '#736A6A', fontFamily: "'Cormorant Garamond', serif", marginBottom: '30px' }}>How does your skin naturally behave throughout the day?</p>
            <QuizOptionButton text="Balanced & Harmonious (Normal)" onClick={() => handleAnswer('skinType', 'Normal')} />
            <QuizOptionButton text="Dewy to Oily (Produces excess shine)" onClick={() => handleAnswer('skinType', 'Oily')} />
            <QuizOptionButton text="Thirsty & Tight (Dry)" onClick={() => handleAnswer('skinType', 'Dry')} />
            <QuizOptionButton text="Combination (Oily T-zone, dry cheeks)" onClick={() => handleAnswer('skinType', 'Combination')} />
          </div>
        )}

        {step === 12 && (
          <div style={{ animation: 'fadeIn 1s ease' }}>
            <ProgressDots currentStep={2} totalSteps={10} />
            <h2 style={{ fontSize: '3rem', color: '#B38B8F', fontFamily: "'Alex Brush', cursive", margin: '0 0 20px 0' }}>Your Primary Vision</h2>
            <p style={{ fontSize: '1.4rem', color: '#736A6A', fontFamily: "'Cormorant Garamond', serif", marginBottom: '30px' }}>What is the main focus of your bespoke routine?</p>
            <QuizOptionButton text="Age-Defying Radiance" onClick={() => handleAnswer('primaryGoal', 'Anti-Aging')} />
            <QuizOptionButton text="Clearing Blemishes & Texture" onClick={() => handleAnswer('primaryGoal', 'Acne/Texture')} />
            <QuizOptionButton text="Deep Hydration & Plumping" onClick={() => handleAnswer('primaryGoal', 'Hydration')} />
            <QuizOptionButton text="Brightening & Even Tone" onClick={() => handleAnswer('primaryGoal', 'Brightening')} />
          </div>
        )}

        {step === 13 && (
          <div style={{ animation: 'fadeIn 1s ease' }}>
            <ProgressDots currentStep={3} totalSteps={10} />
            <h2 style={{ fontSize: '3rem', color: '#B38B8F', fontFamily: "'Alex Brush', cursive", margin: '0 0 20px 0' }}>Your Climate Context</h2>
            <p style={{ fontSize: '1.4rem', color: '#736A6A', fontFamily: "'Cormorant Garamond', serif", marginBottom: '30px' }}>What environment surrounds you daily?</p>
            <QuizOptionButton text="Arid & Dry" onClick={() => handleAnswer('climate', 'Dry')} />
            <QuizOptionButton text="Humid & Tropical" onClick={() => handleAnswer('climate', 'Humid')} />
            <QuizOptionButton text="Temperate & Mild" onClick={() => handleAnswer('climate', 'Temperate')} />
            <QuizOptionButton text="Cold & Harsh" onClick={() => handleAnswer('climate', 'Cold')} />
          </div>
        )}

        {step === 14 && (
          <div style={{ animation: 'fadeIn 1s ease' }}>
            <ProgressDots currentStep={4} totalSteps={10} />
            <h2 style={{ fontSize: '3rem', color: '#B38B8F', fontFamily: "'Alex Brush', cursive", margin: '0 0 20px 0' }}>Skin Sensitivity</h2>
            <p style={{ fontSize: '1.4rem', color: '#736A6A', fontFamily: "'Cormorant Garamond', serif", marginBottom: '30px' }}>Does your skin react easily to new ingredients?</p>
            <QuizOptionButton text="Highly Sensitive (Often reacts)" onClick={() => handleAnswer('skinSensitivity', 'High')} />
            <QuizOptionButton text="Moderately Sensitive (Occasional redness)" onClick={() => handleAnswer('skinSensitivity', 'Moderate')} />
            <QuizOptionButton text="Resilient (Rarely reacts)" onClick={() => handleAnswer('skinSensitivity', 'Low')} />
          </div>
        )}

        {step === 15 && (
          <div style={{ animation: 'fadeIn 1s ease' }}>
            <ProgressDots currentStep={5} totalSteps={10} />
            <h2 style={{ fontSize: '3rem', color: '#B38B8F', fontFamily: "'Alex Brush', cursive", margin: '0 0 20px 0' }}>Your Complexion Canvas</h2>
            <p style={{ fontSize: '1.4rem', color: '#736A6A', fontFamily: "'Cormorant Garamond', serif", marginBottom: '30px' }}>How would you describe your overall skin tone?</p>
            <QuizOptionButton text="Porcelain to Fair" onClick={() => handleAnswer('complexion', 'Fair')} />
            <QuizOptionButton text="Light to Medium" onClick={() => handleAnswer('complexion', 'Medium')} />
            <QuizOptionButton text="Tan to Olive" onClick={() => handleAnswer('complexion', 'Olive')} />
            <QuizOptionButton text="Deep to Rich" onClick={() => handleAnswer('complexion', 'Deep')} />
          </div>
        )}

        {step === 16 && (
          <div style={{ animation: 'fadeIn 1s ease' }}>
            <ProgressDots currentStep={6} totalSteps={10} />
            <h2 style={{ fontSize: '3rem', color: '#B38B8F', fontFamily: "'Alex Brush', cursive", margin: '0 0 20px 0' }}>Unveiling Your Undertone</h2>
            <p style={{ fontSize: '1.4rem', color: '#736A6A', fontFamily: "'Cormorant Garamond', serif", marginBottom: '30px' }}>Do your veins appear more blue, green, or a mix?</p>
            <QuizOptionButton text="Cool (Blue/Purple veins, hints of pink)" onClick={() => handleAnswer('undertone', 'Cool')} />
            <QuizOptionButton text="Warm (Green veins, hints of peach/gold)" onClick={() => handleAnswer('undertone', 'Warm')} />
            <QuizOptionButton text="Neutral (Mix of both)" onClick={() => handleAnswer('undertone', 'Neutral')} />
          </div>
        )}

        {step === 17 && (
          <div style={{ animation: 'fadeIn 1s ease' }}>
            <ProgressDots currentStep={7} totalSteps={10} />
            <h2 style={{ fontSize: '3rem', color: '#B38B8F', fontFamily: "'Alex Brush', cursive", margin: '0 0 20px 0' }}>Eye Color</h2>
            <p style={{ fontSize: '1.4rem', color: '#736A6A', fontFamily: "'Cormorant Garamond', serif", marginBottom: '30px' }}>What color are your eyes?</p>
            <QuizOptionButton text="Deep Brown to Black" onClick={() => handleAnswer('eyeColor', 'Brown')} />
            <QuizOptionButton text="Blue to Grey" onClick={() => handleAnswer('eyeColor', 'Blue')} />
            <QuizOptionButton text="Green to Hazel" onClick={() => handleAnswer('eyeColor', 'Green')} />
          </div>
        )}

        {step === 18 && (
          <div style={{ animation: 'fadeIn 1s ease' }}>
            <ProgressDots currentStep={8} totalSteps={10} />
            <h2 style={{ fontSize: '3rem', color: '#B38B8F', fontFamily: "'Alex Brush', cursive", margin: '0 0 20px 0' }}>Facial Silhouette</h2>
            <p style={{ fontSize: '1.4rem', color: '#736A6A', fontFamily: "'Cormorant Garamond', serif", marginBottom: '30px' }}>How would you describe your natural face shape?</p>
            <QuizOptionButton text="Oval (Softly rounded, balanced)" onClick={() => handleAnswer('faceShape', 'Oval')} />
            <QuizOptionButton text="Round (Fuller cheeks, soft angles)" onClick={() => handleAnswer('faceShape', 'Round')} />
            <QuizOptionButton text="Square/Heart (Strong jawline or wider forehead)" onClick={() => handleAnswer('faceShape', 'Square/Heart')} />
          </div>
        )}

        {step === 19 && (
          <div style={{ animation: 'fadeIn 1s ease' }}>
            <ProgressDots currentStep={9} totalSteps={10} />
            <h2 style={{ fontSize: '3rem', color: '#B38B8F', fontFamily: "'Alex Brush', cursive", margin: '0 0 20px 0' }}>Signature Aesthetic</h2>
            <p style={{ fontSize: '1.4rem', color: '#736A6A', fontFamily: "'Cormorant Garamond', serif", marginBottom: '30px' }}>What is your preferred makeup style?</p>
            <QuizOptionButton text="Barely There (No-makeup makeup)" onClick={() => handleAnswer('makeupVibe', 'Natural')} />
            <QuizOptionButton text="Soft Glam (Elevated everyday elegance)" onClick={() => handleAnswer('makeupVibe', 'Soft Glam')} />
            <QuizOptionButton text="Full Glam (Bold, sculpted, dramatic)" onClick={() => handleAnswer('makeupVibe', 'Full Glam')} />
          </div>
        )}

        {step === 20 && (
          <div style={{ animation: 'fadeIn 1s ease' }}>
            <ProgressDots currentStep={10} totalSteps={10} />
            <h2 style={{ fontSize: '3rem', color: '#B38B8F', fontFamily: "'Alex Brush', cursive", margin: '0 0 12px 0' }}>Regimen Focus & Visual Scan</h2>
            <p style={{ fontSize: '1.35rem', color: '#736A6A', fontFamily: "'Cormorant Garamond', serif", marginBottom: '22px' }}>
              Final Step: Upload your optional skin photo for AI analysis (Radiance Elite) and choose your preferred daily ritual depth.
            </p>

            {/* Radiance Elite Exclusive: AI Skin Photo Upload Box */}
            {(effectiveMemberTier === 'radiance' || effectiveMemberTier === 'admin') ? (
              <div
                style={{
                  maxWidth: '520px',
                  margin: '0 auto 28px auto',
                  backgroundColor: '#FFFFFF',
                  border: '2px solid #B38B8F',
                  borderRadius: '20px',
                  padding: '22px',
                  boxShadow: '0 8px 24px rgba(179, 139, 143, 0.2)',
                  textAlign: 'center'
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    backgroundColor: '#F4F0FF',
                    color: '#5E35B1',
                    border: '1px solid #D1C4E9',
                    borderRadius: '14px',
                    padding: '3px 12px',
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    fontFamily: 'sans-serif',
                    marginBottom: '8px'
                  }}
                >
                  💎 Radiance Elite Exclusive Feature
                </span>
                <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.55rem', color: '#5C5454', margin: '0 0 6px 0' }}>
                  Upload a Skin Photo for Odie AI Visual Analysis
                </h3>
                <p style={{ fontFamily: 'sans-serif', fontSize: '0.85rem', color: '#736A6A', margin: '0 0 14px 0', lineHeight: '1.45' }}>
                  Upload a clear, natural-light selfie or close-up so Odie's Multimodal Vision AI can analyze your visible skin tone, texture, and hydration balance alongside your quiz answers.
                </p>

                {quizPhotoDataUrl ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <img
                      src={quizPhotoDataUrl}
                      alt="Skin Quiz Upload Preview"
                      style={{
                        width: '110px',
                        height: '110px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '3px solid #B38B8F',
                        boxShadow: '0 6px 16px rgba(179, 139, 143, 0.3)'
                      }}
                    />
                    <span style={{ fontSize: '0.8rem', color: '#2E7D32', fontWeight: 'bold', fontFamily: 'sans-serif' }}>
                      ✓ Photo Ready for Odie AI Vision Analysis
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuizPhotoDataUrl('')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#8A797A',
                        fontSize: '0.8rem',
                        textDecoration: 'underline',
                        cursor: 'pointer'
                      }}
                    >
                      Remove / Replace Photo
                    </button>
                  </div>
                ) : (
                  <label
                    style={{
                      display: 'inline-block',
                      backgroundColor: '#FFF0F2',
                      border: '1.5px dashed #B38B8F',
                      color: '#5C5454',
                      padding: '12px 22px',
                      borderRadius: '18px',
                      fontFamily: "'Cormorant Garamond', serif",
                      fontSize: '1.12rem',
                      fontWeight: 'bold',
                      cursor: isProcessingQuizPhoto ? 'wait' : 'pointer'
                    }}
                  >
                    {isProcessingQuizPhoto ? '⏳ Optimizing Photo...' : '📷 Choose or Take Skin Photo (Optional)'}
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setIsProcessingQuizPhoto(true);
                        try {
                          const dataUrl = await compressImageFileToDataUrl(file, 900, 0.82);
                          setQuizPhotoDataUrl(dataUrl);
                        } catch (err) {
                          alert(err.message || 'Could not process selected photo.');
                        }
                        setIsProcessingQuizPhoto(false);
                      }}
                    />
                  </label>
                )}
              </div>
            ) : (
              <div
                style={{
                  maxWidth: '520px',
                  margin: '0 auto 26px auto',
                  backgroundColor: 'rgba(255, 255, 255, 0.85)',
                  border: '1.5px dashed #B38B8F',
                  borderRadius: '18px',
                  padding: '16px 20px',
                  textAlign: 'center'
                }}
              >
                <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#5E35B1', backgroundColor: '#F4F0FF', border: '1px solid #D1C4E9', padding: '2px 10px', borderRadius: '10px', fontFamily: 'sans-serif' }}>
                  🔒 Radiance Elite Exclusive
                </span>
                <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.15rem', color: '#5C5454', margin: '8px 0 10px 0' }}>
                  Want to upload a photo with your quiz for <strong>Odie AI Visual Skin Analysis</strong>?
                </p>
                <button
                  type="button"
                  onClick={() =>
                    openPaywallModal(
                      'Upgrade to The Radiance Elite ($119/mo) to upload a skin photo with your quiz for Odie Multimodal Vision AI Analysis and unlock Monthly 1-on-1 Consultations!'
                    )
                  }
                  style={{
                    backgroundColor: '#FFF0F2',
                    border: '1px solid #B38B8F',
                    color: '#5C5454',
                    padding: '7px 16px',
                    borderRadius: '16px',
                    fontFamily: 'sans-serif',
                    fontSize: '0.8rem',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  💎 Upgrade to Radiance Elite to Unlock Photo AI →
                </button>
              </div>
            )}

            <p style={{ fontSize: '1.3rem', color: '#5C5454', fontFamily: "'Cormorant Garamond', serif", fontWeight: 'bold', marginBottom: '16px' }}>
              Select your preferred regimen focus to generate your Blueprint:
            </p>
            <QuizOptionButton text="Minimalist (3 steps max, fast & effective)" onClick={() => handleAnswer('routineFocus', 'Minimalist')} />
            <QuizOptionButton text="Balanced (Moderate steps, focused results)" onClick={() => handleAnswer('routineFocus', 'Balanced')} />
            <QuizOptionButton text="Luxurious (Multi-step indulgence)" onClick={() => handleAnswer('routineFocus', 'Luxurious')} />
          </div>
        )}

        {step === 21 && (
          <div style={{ animation: 'fadeIn 1s ease' }}>
             <EmpowermentLoader text="Odie, Susan's AI Assistant, is analyzing your profile..."/>
          </div>
        )}

      </EmpowermentContainer>
    </div>
  );
}

export default App;

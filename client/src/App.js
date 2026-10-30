import React, { useState, useEffect } from 'react';
import './App.css';
import logo from "./susans-logo.png";

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

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
const evaluateBlueprintMatch import React, { useState, useEffect } from 'react';
import './App.css';
import logo from "./susans-logo.png";

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

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
const evaluateBlueprintMatch  String(val).split(',').map(v => v.trim()).filter(Boolean);
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

const MemberCalendar = ({ onJoinVideoRoom }) => {
  const [appointments, setAppointments] = useState([]);
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
        setAppointments(Array.isArray(data) ? data : []);
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
        setStatusBanner({ type: 'error', text: data.error || 'Could not schedule consultation.' });
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

  const handleDayClick = (dayNumber) => {
    if (isScheduling && editingApptId) return;
    const pad = (n) => String(n).padStart(2, '0');
    const slot = `${currentDate.getFullYear()}-${pad(currentDate.getMonth() + 1)}-${pad(dayNumber)}T09:00`;
    setFormState(prev => ({ ...prev, startTime: slot }));
    setIsScheduling(true);
  };

  const myUpcomingAppointments = appointments.filter(a => a.isMine);

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
            if (isScheduling) resetForm();
            else setIsScheduling(true);
          }}
          style={{ backgroundColor: '#F2D4D7', border: '1px solid #B38B8F', padding: '10px 22px', borderRadius: '25px', fontFamily: "'Cormorant Garamond', serif", color: '#5C5454', cursor: 'pointer', fontSize: '1.1rem' }}
        >
          {isScheduling ? 'Close Scheduler' : '+ Book Consultation with Susan ✧'}
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
  'CJPacket Sensitive',
  'USPS+',
  'CJPacket Ordinary',
  'CJ Liquid Direct',
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

const computeClientProductPriceBreakdown = (prod = {}) => {
  const retailPrice = Number(prod.variants?.[0]?.price ?? prod.price ?? 0);
  const markupMultiplier = Number(prod.markupMultiplier || 6.5) || 6.5;
  const rawWholesale = Number(prod.wholesalePriceUsd ?? prod.variants?.[0]?.wholesalePriceUsd ?? 0);
  const wholesalePriceUsd = rawWholesale > 0
    ? Number(rawWholesale.toFixed(2))
    : Number(Math.max(0.50, retailPrice / markupMultiplier).toFixed(2));
  const selectedLogisticName = String(prod.selectedLogisticName || 'CJPacket Sensitive').trim() || 'CJPacket Sensitive';
  const shippingCostUsd = Number(Number(prod.shippingCostUsd ?? 4.49).toFixed(2));
  const shippingIncludedInPrice = prod.shippingIncludedInPrice !== false;
  const customLabelEnabled = Boolean(prod.customLabelConfig?.enabled);
  const customLabelName = prod.customLabelConfig?.packagingName || "Susan's Rose-Gold Custom Box & Seal";
  const customLabelCostUsd = customLabelEnabled
    ? Number(Number(prod.customLabelConfig?.packagingCostUsd || 0.65).toFixed(2))
    : 0;
  const computedRetail = Number(
    ((wholesalePriceUsd * markupMultiplier) + (shippingIncludedInPrice ? shippingCostUsd : 0) + customLabelCostUsd).toFixed(2)
  );

  return {
    wholesalePriceUsd,
    markupMultiplier,
    selectedLogisticName,
    shippingCostUsd,
    shippingIncludedInPrice,
    customLabelEnabled,
    customLabelName,
    customLabelCostUsd,
    retailPrice: retailPrice > 0 ? Number(retailPrice.toFixed(2)) : computedRetail,
    computedRetail
  };
};

const AdminInventory = ({ onCatalogUpdated, onOpenTestsTab, onOpenBoxesTab }) => {
  const [inventory, setInventory] = useState([]);
  const [createForm, setCreateForm] = useState({
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
  const [editModalData, setEditModalData] = useState(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isAutoLabeling, setIsAutoLabeling] = useState(false);
  const [quotingProductId, setQuotingProductId] = useState(null);
  const [togglingLabelProductId, setTogglingLabelProductId] = useState(null);
  const [isBulkUpdatingShipping, setIsBulkUpdatingShipping] = useState(false);

  const [globalShippingControl, setGlobalShippingControl] = useState({
    selectedLogisticName: 'CJPacket Sensitive',
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

  useEffect(() => {
    fetchInventory();
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
      recalculateFromWholesale: true,
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

            {/* Live All-In Price Breakdown Banner inside Modal */}
            {(() => {
              const w = parseFloat(editModalData.wholesalePriceUsd) || 0;
              const m = parseFloat(editModalData.markupMultiplier) || 6.5;
              const s = editModalData.shippingIncludedInPrice ? (parseFloat(editModalData.shippingCostUsd) || 0) : 0;
              const l = editModalData.customLabelEnabled ? (parseFloat(editModalData.customLabelCostUsd) || 0.65) : 0;
              const calcTotal = Number(((w * m) + s + l).toFixed(2));

              return (
                <div style={{ backgroundColor: '#FFF0F2', border: '1px solid #B38B8F', borderRadius: '14px', padding: '12px 16px', marginBottom: '16px', fontFamily: 'sans-serif', fontSize: '0.84rem', color: '#5C5454' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <strong>All-In Price Breakdown:</strong>
                    <span style={{ color: '#2E7D32', fontWeight: 'bold', fontSize: '0.95rem' }}>
                      Wholesale: ${w.toFixed(2)} × {m} + CJ Shipping ({editModalData.selectedLogisticName}): ${s.toFixed(2)} + Custom Label: ${l.toFixed(2)} = Retail: ${calcTotal.toFixed(2)}
                    </span>
                  </div>
                </div>
              );
            })()}

            <form onSubmit={handleSaveModalEdit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.05rem', color: '#5C5454', marginBottom: '4px', fontWeight: 'bold' }}>Product Title</label>
                <input
                  required
                  type="text"
                  value={editModalData.title}
                  onChange={e => setEditModalData({ ...editModalData, title: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #E8C5C8', backgroundColor: '#FFFFFF', outline: 'none', fontFamily: 'sans-serif', fontSize: '0.92rem', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#5C5454', marginBottom: '4px', fontWeight: 'bold', fontFamily: 'sans-serif' }}>CJ Wholesale ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editModalData.wholesalePriceUsd}
                    onChange={e => setEditModalData({ ...editModalData, wholesalePriceUsd: e.target.value, recalculateFromWholesale: true })}
                    style={{ width: '100%', padding: '9px', borderRadius: '8px', border: '1px solid #E8C5C8', backgroundColor: '#FFFFFF', fontFamily: 'sans-serif', fontSize: '0.9rem', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#5C5454', marginBottom: '4px', fontWeight: 'bold', fontFamily: 'sans-serif' }}>Markup (e.g. 6.5x)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editModalData.markupMultiplier}
                    onChange={e => setEditModalData({ ...editModalData, markupMultiplier: e.target.value, recalculateFromWholesale: true })}
                    style={{ width: '100%', padding: '9px', borderRadius: '8px', border: '1px solid #E8C5C8', backgroundColor: '#FFFFFF', fontFamily: 'sans-serif', fontSize: '0.9rem', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#5C5454', marginBottom: '4px', fontWeight: 'bold', fontFamily: 'sans-serif' }}>CJ Shipping ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editModalData.shippingCostUsd}
                    onChange={e => setEditModalData({ ...editModalData, shippingCostUsd: e.target.value, recalculateFromWholesale: true })}
                    style={{ width: '100%', padding: '9px', borderRadius: '8px', border: '1px solid #E8C5C8', backgroundColor: '#FFFFFF', fontFamily: 'sans-serif', fontSize: '0.9rem', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#5C5454', marginBottom: '4px', fontWeight: 'bold', fontFamily: 'sans-serif' }}>Retail Price ($)</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    value={editModalData.price}
                    onChange={e => setEditModalData({ ...editModalData, price: e.target.value, recalculateFromWholesale: false })}
                    style={{ width: '100%', padding: '9px', borderRadius: '8px', border: '1px solid #E8C5C8', backgroundColor: '#FFFFFF', fontFamily: 'sans-serif', fontSize: '0.9rem', boxSizing: 'border-box' }}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", color: '#5C5454', margin: 0, fontSize: '2.2rem' }}>Boutique Inventory</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
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

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(265px, 1fr))', gap: '20px' }}>
            {inventory.map(prod => {
              const displayImage = prod.imageUrl && prod.imageUrl.startsWith('//') ? `https:${prod.imageUrl}` : prod.imageUrl;
              const meta = deriveProductBlueprintMeta(prod);
              const bd = computeClientProductPriceBreakdown(prod);

              return (
                <div key={prod._id} style={{ backgroundColor: '#FFFFFF', border: bd.customLabelEnabled ? '1.5px solid #B38B8F' : '1px solid #E8C5C8', borderRadius: '15px', padding: '15px', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 15px rgba(232, 197, 200, 0.12)' }}>
                  <div style={{ width: '100%', height: '140px', backgroundColor: '#FFF0F2', borderRadius: '10px', marginBottom: '10px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                    <span style={{ position: 'absolute', top: '6px', left: '6px', backgroundColor: 'rgba(92, 84, 84, 0.85)', color: '#FFFFFF', padding: '3px 8px', borderRadius: '10px', fontSize: '0.68rem', fontFamily: "'Cormorant Garamond', serif", fontWeight: 'bold' }}>
                      {meta.ritualStep}
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

                  {/* All-In Price Breakdown Box on Card */}
                  <div style={{ backgroundColor: '#FFF0F2', border: '1px solid #E8C5C8', borderRadius: '10px', padding: '8px 10px', marginBottom: '10px', fontFamily: 'sans-serif', fontSize: '0.73rem', color: '#5C5454' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                      <span style={{ color: '#8A797A' }}>Retail ({bd.shippingIncludedInPrice ? 'Ship Incl.' : 'Excl. Ship'}):</span>
                      <strong style={{ fontSize: '1.05rem', color: '#B38B8F' }}>${bd.retailPrice.toFixed(2)}</strong>
                    </div>
                    <div style={{ color: '#736A6A', lineHeight: '1.4' }}>
                      Wholesale: <strong>${bd.wholesalePriceUsd.toFixed(2)}</strong> + CJ Shipping ({bd.selectedLogisticName}): <strong>${bd.shippingCostUsd.toFixed(2)}</strong>
                      {bd.customLabelEnabled ? ` + Custom Label: $${bd.customLabelCostUsd.toFixed(2)}` : ''} = <strong>${bd.retailPrice.toFixed(2)}</strong>
                    </div>
                  </div>

                  {/* Per-Card CJ Shipping Carrier Dropdown & Custom Label Toggle */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px', backgroundColor: '#FFF9F9', padding: '8px', borderRadius: '8px', border: '1px solid #E8C5C8' }}>
                    <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                      <select
                        value={bd.selectedLogisticName}
                        disabled={quotingProductId === prod._id}
                        onChange={(e) => handleFetchProductShippingQuote(prod._id, e.target.value)}
                        style={{ flex: 1, padding: '5px 6px', borderRadius: '6px', border: '1px solid #E8C5C8', fontSize: '0.72rem', fontFamily: 'sans-serif', color: '#5C5454', backgroundColor: '#FFFFFF' }}
                      >
                        {CJ_CARRIER_OPTIONS.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        title="Fetch live CJ freight quote & recalculate retail price"
                        disabled={quotingProductId === prod._id}
                        onClick={() => handleFetchProductShippingQuote(prod._id, bd.selectedLogisticName)}
                        style={{ backgroundColor: '#F2D4D7', border: '1px solid #B38B8F', color: '#5C5454', borderRadius: '6px', padding: '5px 8px', fontSize: '0.72rem', fontWeight: 'bold', cursor: 'pointer' }}
                      >
                        {quotingProductId === prod._id ? '⏳' : '✈️ Quote'}
                      </button>
                    </div>

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
                      ✎ Edit
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

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              disabled={isSyncingCj || isCleaningCj}
              onClick={() => handleCjSyncOrClean(false)}
              style={{ backgroundColor: '#F2D4D7', border: '1px solid #B38B8F', color: '#5C5454', padding: '10px 18px', borderRadius: '22px', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.05rem', fontWeight: 'bold', cursor: (isSyncingCj || isCleaningCj) ? 'not-allowed' : 'pointer' }}
            >
              {isSyncingCj ? '⏳ Syncing Beauty & Skincare...' : '🔄 Sync Beauty & Skincare'}
            </button>

            <button
              type="button"
              disabled={isSyncingCj || isCleaningCj}
              onClick={() => handleCjSyncOrClean(true)}
              style={{ backgroundColor: '#FFF9F9', border: '1px solid #E8C5C8', color: '#5C5454', padding: '10px 18px', borderRadius: '22px', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.05rem', cursor: (isSyncingCj || isCleaningCj) ? 'not-allowed' : 'pointer' }}
            >
              {isCleaningCj ? '⏳ Cleaning...' : '🧹 Clean Non-Beauty Items'}
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
              style={{ backgroundColor: '#B38B8F', border: 'none', color: '#FFFFFF', padding: '10px 18px', borderRadius: '22px', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.05rem', cursor: isTestingWebhooks ? 'not-allowed' : 'pointer' }}
            >
              {isTestingWebhooks ? '⏳ Testing Webhooks...' : '🧪 Test CJ & Stripe Webhooks'}
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
          <div style={{ marginTop: '18px', padding: '16px', borderRadius: '12px', backgroundColor: '#FFF9F9', border: '1px solid #E8C5C8', fontFamily: 'sans-serif', fontSize: '0.9rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <strong style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.25rem', color: '#5C5454' }}>
                Webhook & Public Launch Readiness Report ({webhookReport.overallStatus})
              </strong>
              <button
                type="button"
                onClick={() => setWebhookReport(null)}
                style={{ background: 'none', border: 'none', color: '#8A797A', cursor: 'pointer', fontSize: '0.85rem', textDecoration: 'underline' }}
              >
                Hide Report
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
              <div style={{ backgroundColor: '#FFFFFF', padding: '12px', borderRadius: '8px', border: '1px solid #E8C5C8' }}>
                <strong style={{ color: '#5C5454', display: 'block', marginBottom: '4px' }}>
                  {webhookReport.checks?.cjWebhookParser?.passed ? '✅' : '⚠️'} CJ v2 Webhook Parser
                </strong>
                <span style={{ color: '#736A6A', fontSize: '0.85rem' }}>
                  Nested <code>params</code> & test order IDs handled without CastError.
                </span>
              </div>
              <div style={{ backgroundColor: '#FFFFFF', padding: '12px', borderRadius: '8px', border: '1px solid #E8C5C8' }}>
                <strong style={{ color: '#5C5454', display: 'block', marginBottom: '4px' }}>
                  {webhookReport.checks?.stripeToCjFulfillment?.passed ? '✅' : '⚠️'} Stripe → CJ Fulfillment
                </strong>
                <span style={{ color: '#736A6A', fontSize: '0.85rem' }}>
                  Extracts Stripe shipping address & phone into CJ <code>createOrderV2</code>.
                </span>
              </div>
              <div style={{ backgroundColor: '#FFFFFF', padding: '12px', borderRadius: '8px', border: '1px solid #E8C5C8' }}>
                <strong style={{ color: '#5C5454', display: 'block', marginBottom: '4px' }}>
                  🔐 Environment Keys
                </strong>
                <span style={{ color: '#736A6A', fontSize: '0.82rem', display: 'block' }}>
                  Stripe Key: {webhookReport.checks?.environment?.stripeSecretConfigured ? '✓' : 'Missing'} | Webhook: {webhookReport.checks?.environment?.stripeWebhookSecretConfigured ? '✓' : 'Missing'}
                </span>
                <span style={{ color: '#736A6A', fontSize: '0.82rem', display: 'block' }}>
                  CJ Token: {webhookReport.checks?.environment?.cjAccessTokenConfigured ? '✓' : 'Missing'} | SMTP: {webhookReport.checks?.environment?.smtpConfigured ? '✓' : 'Missing'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const AdminFinancesAndOrders = ({ onEmailCustomer, onOrdersUpdated, onAskOdie }) => {
  const [telemetry, setTelemetry] = useState(null);
  const [isLoadingFinances, setIsLoadingFinances] = useState(false);
  const [isSyncingCjOrders, setIsSyncingCjOrders] = useState(false);
  const [pipelineFilter, setPipelineFilter] = useState('ALL'); // 'ALL' | 'PRESENT' | 'FUTURE' | 'PAST'
  const [searchQuery, setSearchQuery] = useState('');
  const [statusBanner, setStatusBanner] = useState({ type: '', text: '' });
  const [editingOrderMap, setEditingOrderMap] = useState({});
  const [savingOrderId, setSavingOrderId] = useState(null);
  const [updatingCjLogisticsId, setUpdatingCjLogisticsId] = useState(null);
  const [orderCjCarrierOptionsMap, setOrderCjCarrierOptionsMap] = useState({});

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
    allocateFromStripe: true,
    payUnpaidCjOrders: true,
    notes: ''
  });
  const [lastBridgeResult, setLastBridgeResult] = useState(null);

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

  useEffect(() => {
    fetchFinancesAndOrders(false);
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

  const stripeBal = telemetry?.stripeBalance || {};
  const cjBal = telemetry?.cjBalance || {};
  const counts = telemetry?.orderPipeline?.counts || { total: 0, past: 0, present: 0, future: 0, scheduledMemberBoxes: 0 };
  const summary = telemetry?.summaryMetrics || {};
  const futureProj = telemetry?.futureProjections || { scheduledMemberBoxes: [] };
  const recentTransfers = telemetry?.recentTransfers || [];

  // Live Money Dump & CJ Wholesale Reserve Math
  const availableStripeUsd = Number(stripeBal.availableUsd || 0);
  const activeUnshippedCostUsd = Number(cjBal.activeUnshippedCostUsd || 0);
  const cjWalletAvailableUsd = Number(cjBal.availableUsd || 0);
  const uncoveredCjWholesaleUsd = Number(Math.max(0, activeUnshippedCostUsd - cjWalletAvailableUsd).toFixed(2));
  const reserveAppliedUsd = moneyDumpForm.reserveForActiveOrders ? uncoveredCjWholesaleUsd : 0;
  const maxSafeStripeDumpUsd = Number(Math.max(0, availableStripeUsd - reserveAppliedUsd).toFixed(2));

  const rawOrders =
    pipelineFilter === 'PAST'
      ? (telemetry?.orderPipeline?.past || [])
      : pipelineFilter === 'PRESENT'
      ? (telemetry?.orderPipeline?.present || [])
      : pipelineFilter === 'FUTURE'
      ? (telemetry?.orderPipeline?.future || [])
      : (telemetry?.orderPipeline?.all || []);

  const cleanSearch = searchQuery.trim().toLowerCase();
  const filteredOrders = rawOrders.filter(ord => {
    if (!cleanSearch) return true;
    const haystack = `${ord.shortId || ''} ${ord._id || ''} ${ord.customerName || ''} ${ord.customerEmail || ''} ${ord.status || ''} ${ord.tracking_code || ''} ${(ord.items || []).map(i => i.title).join(' ')}`.toLowerCase();
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

        {/* 2. CJ Dropshipping Wallet Balance Card */}
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
                {cjBal.connected ? '✓ CJ API LIVE' : '⚠️ CHECK TOKEN'}
              </span>
            </div>

            <div style={{ backgroundColor: '#FFF9F9', border: '1px solid #E8C5C8', borderRadius: '14px', padding: '16px', marginBottom: '14px' }}>
              <p style={{ margin: '0 0 4px 0', fontSize: '0.85rem', color: '#8A797A', fontFamily: 'sans-serif' }}>Available CJ Wallet Funds (USD)</p>
              <p style={{ margin: 0, fontFamily: "'Cormorant Garamond', serif", fontSize: '2.4rem', color: '#B38B8F', fontWeight: 'bold' }}>
                ${Number(cjBal.availableUsd || 0).toFixed(2)}
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px', fontFamily: 'sans-serif', fontSize: '0.88rem' }}>
              <div style={{ backgroundColor: '#FFF0F2', padding: '10px', borderRadius: '10px' }}>
                <span style={{ color: '#8A797A', display: 'block', fontSize: '0.78rem' }}>Active Unshipped Cost</span>
                <strong style={{ color: '#5C5454', fontSize: '1.05rem' }}>${Number(cjBal.activeUnshippedCostUsd || 0).toFixed(2)}</strong>
              </div>
              <div style={{ backgroundColor: '#FFF0F2', padding: '10px', borderRadius: '10px' }}>
                <span style={{ color: '#8A797A', display: 'block', fontSize: '0.78rem' }}>Frozen / Credit</span>
                <strong style={{ color: '#5C5454', fontSize: '1.05rem' }}>${Number((cjBal.frozenUsd || 0) + (cjBal.nonWithdrawableUsd || 0)).toFixed(2)}</strong>
              </div>
            </div>

            {cjBal.error && (
              <p style={{ margin: '0 0 10px 0', fontSize: '0.82rem', color: '#B26A00', fontFamily: 'sans-serif' }}>
                ℹ️ {cjBal.error}
              </p>
            )}
          </div>

          <div style={{ borderTop: '1px solid #E8C5C8', paddingTop: '10px', fontSize: '0.82rem', fontFamily: 'sans-serif' }}>
            {cjBal.walletCoversActiveOrders !== false ? (
              <span style={{ color: '#2E7D32', fontWeight: 'bold' }}>
                ✓ Wallet balance covers all active unshipped orders
              </span>
            ) : (
              <span style={{ color: '#C62828', fontWeight: 'bold' }}>
                ⚠️ Top up CJ Wallet to fulfill active unshipped orders
              </span>
            )}
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
            <p style={{ margin: '0 0 16px 0', fontSize: '0.88rem', color: '#8A797A', fontFamily: 'sans-serif', lineHeight: '1.45' }}>
              Allocate wholesale funds from Stripe (`CJ DROPSHIP` payout earmark) and automatically pay open CJ Dropshipping orders directly from your CJ Wallet (`POST /shopping/pay/payBalance`).
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

      {/* Row 2: Past, Present & Future Order Pipeline Monitor */}
      <div style={{ backgroundColor: '#FFFFFF', padding: '28px', borderRadius: '20px', border: '1px solid #E8C5C8', boxShadow: '0 10px 30px rgba(232, 197, 200, 0.15)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {[
              { id: 'ALL', label: `All Orders (${counts.total || 0})` },
              { id: 'PRESENT', label: `🟢 Present — Active & In-Transit (${counts.present || 0})` },
              { id: 'FUTURE', label: `🔮 Future — Pending & Ritual Boxes (${(counts.future || 0) + (counts.scheduledMemberBoxes || 0)})` },
              { id: 'PAST', label: `🏛️ Past — Completed & Delivered (${counts.past || 0})` }
            ].map(tabBtn => (
              <button
                key={tabBtn.id}
                type="button"
                onClick={() => setPipelineFilter(tabBtn.id)}
                style={{
                  padding: '10px 16px',
                  borderRadius: '20px',
                  border: pipelineFilter === tabBtn.id ? '1.5px solid #B38B8F' : '1px solid #E8C5C8',
                  backgroundColor: pipelineFilter === tabBtn.id ? '#F2D4D7' : '#FFF9F9',
                  color: '#5C5454',
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: '1.05rem',
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
            placeholder="Search by customer, email, #OrderID, or tracking..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ minWidth: '260px', flex: '1 1 260px', maxWidth: '360px', padding: '10px 16px', borderRadius: '20px', border: '1px solid #E8C5C8', backgroundColor: '#FFF9F9', outline: 'none', fontFamily: 'sans-serif', fontSize: '0.9rem' }}
          />
        </div>

        {/* Future Recurring Member Ritual Box Schedule (shown in FUTURE or ALL view) */}
        {(pipelineFilter === 'FUTURE' || pipelineFilter === 'ALL') && Array.isArray(futureProj.scheduledMemberBoxes) && futureProj.scheduledMemberBoxes.length > 0 && (
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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

              return (
                <div key={order._id} style={{ padding: '20px', backgroundColor: '#FFF9F9', border: '1px solid #E8C5C8', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid rgba(232, 197, 200, 0.4)', paddingBottom: '12px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <strong style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.35rem', color: '#5C5454' }}>
                          Order #{order.shortId} — {order.customerName}
                        </strong>
                        <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold', fontFamily: 'sans-serif', backgroundColor: badge.backgroundColor, color: badge.color, border: badge.border }}>
                          {badge.label}
                        </span>
                        <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '0.75rem', fontFamily: 'sans-serif', backgroundColor: '#FFFFFF', color: '#B38B8F', border: '1px solid #E8C5C8', fontWeight: 'bold' }}>
                          Status: {order.status}
                        </span>
                      </div>
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.88rem', color: '#736A6A', fontFamily: 'sans-serif' }}>
                        📧 {order.customerEmail} • Placed {new Date(order.createdAt).toLocaleString()}
                        {formattedAddress ? ` • ✈️ Ship To: ${formattedAddress}` : ''}
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
                        </span>
                      ))}
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
                      {savingOrderId === order._id ? 'Saving...' : 'Save & Update ✧'}
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

  const tabs = ['Inbox', 'Finances', 'Boxes', 'Analytics', 'Outbox', 'Curation', 'Calendar', 'Inventory', 'Tests', 'Video', 'Odie'];
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

            {/* Right Column: Global Order Feed */}
            <div style={{ backgroundColor: '#FFFFFF', padding: '30px', borderRadius: '20px', border: '1px solid #E8C5C8', boxShadow: '0 10px 30px rgba(232, 197, 200, 0.15)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }}>
                <h2 style={{ fontFamily: "'Cormorant Garamond', serif", color: '#B38B8F', margin: 0, fontSize: '2.2rem' }}>Global Orders</h2>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ backgroundColor: '#FFF0F2', color: '#B38B8F', padding: '5px 12px', borderRadius: '20px', fontSize: '0.9rem', fontWeight: 'bold', border: '1px solid #E8C5C8' }}>
                    Total: {adminData.orders?.length || 0}
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveTab('Boxes')}
                    style={{ backgroundColor: '#FFF0F2', border: '1px solid #B38B8F', color: '#5C5454', padding: '5px 12px', borderRadius: '20px', fontSize: '0.85rem', fontFamily: "'Cormorant Garamond', serif", fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    🎁 Monthly Boxes →
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('Finances')}
                    style={{ backgroundColor: '#F2D4D7', border: '1px solid #B38B8F', color: '#5C5454', padding: '5px 12px', borderRadius: '20px', fontSize: '0.85rem', fontFamily: "'Cormorant Garamond', serif", fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    💸 Balances & Pipeline →
                  </button>
                </div>
              </div>

              {(!adminData.orders || adminData.orders.length === 0) ? (
                <p style={{ color: '#8A797A', fontStyle: 'italic', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.2rem' }}>No orders have been placed yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  {adminData.orders.map(order => (
                    <div key={order._id} style={{ padding: '20px', backgroundColor: '#FFF9F9', border: '1px solid #E8C5C8', borderRadius: '15px', transition: 'transform 0.2s ease' }} onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <strong style={{ color: '#5C5454', fontSize: '1.1rem' }}>{order.customerEmail || 'Anonymous Checkout'}</strong>
                        <span style={{ color: '#B38B8F', fontWeight: 'bold', fontSize: '1.2rem' }}>${(order.totalAmount || 0).toFixed(2)}</span>
                      </div>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                         <p style={{ margin: 0, fontSize: '0.9rem', color: '#736A6A' }}>Status: <span style={{ fontWeight: 'bold', color: order.status === 'SHIPPED' ? '#B38B8F' : '#8A797A' }}>{order.status}</span></p>
                         <p style={{ margin: 0, fontSize: '0.8rem', color: '#A89999' }}>{new Date(order.createdAt).toLocaleDateString()}</p>
                      </div>

                      <button 
                        onClick={() => {
                          setEmailForm({ ...emailForm, to: order.customerEmail || '', subject: `Update regarding order ${order._id.slice(-6)}` });
                          emailFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }}
                        style={{ background: 'transparent', border: '1px solid #B38B8F', borderRadius: '20px', padding: '8px 15px', fontSize: '0.95rem', color: '#5C5454', cursor: 'pointer', fontFamily: "'Cormorant Garamond', serif", transition: 'all 0.3s ease', width: '100%' }}
                        onMouseOver={(e) => { e.target.style.backgroundColor = '#F2D4D7'; }} 
                        onMouseOut={(e) => { e.target.style.backgroundColor = 'transparent'; }}
                      >
                        ✉ Email Customer
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
          </div>
          </div>
        )}

        {activeTab === 'Finances' && (
          <AdminFinancesAndOrders
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
      return savedUser ? JSON.parse(savedUser) : { name: '', email: '', password: '', membershipTier: '', role: 'client' };
    } catch {
      return { name: '', email: '', password: '', membershipTier: '', role: 'client' };
    }
  });

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
          return true;
        } else {
          setHasCompletedQuiz(false);
    setBlueprintAnalysis(null);
          return false;
        }
      }
    } catch (err) {
      console.error('Failed to sync member blueprint status:', err);
    }
    return false;
  };

  // Prevent members who have already completed their one-time Blueprint Quiz from accessing quiz steps 11-20
  useEffect(() => {
    if (hasCompletedQuiz && step >= 11 && step <= 20) {
      setStep(5);
      setActiveMemberTab('Blueprint');
    }
  }, [hasCompletedQuiz, step]);

  // Restore Dashboard state if a user refreshes mid-session
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const fetchDashboardData = async () => {
      try {
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

  // URL Parameter Catchers
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    
    if (query.get('success')) {
      const tierStr = query.get('tier') || 'luminary';
      window.history.replaceState(null, '', window.location.pathname);
      setSelectedTier(tierStr);
      setUserDetails(prev => ({ ...prev, name: 'Valued Member' }));
      setIsSubscribing(true);
      setStep(5);
    }

    if (query.get('canceled')) {
      window.history.replaceState(null, '', window.location.pathname);
      setStep(0);
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

  const calculateCartSubtotal = () =>
    cart.reduce((total, item) => total + ((Number(item.price) || 0) * (Number(item.quantity) || 1)), 0);

  const calculateCartTotal = () => {
    const subtotal = calculateCartSubtotal();
    const { rate } = getActiveMemberDiscount();
    return (subtotal * (1 - rate)).toFixed(2);
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
      const res = await fetch(`${API_BASE_URL}/api/consultations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(finalData), 
      });
      if (res.ok) {
        const savedConsultation = await res.json().catch(() => ({}));
        if (savedConsultation?.blueprintAnalysis) {
          setBlueprintAnalysis(savedConsultation.blueprintAnalysis);
        }
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
      
      setUserDetails(prev => ({ 
        ...prev, 
        name: regData.user.name, 
        email: regData.user.email,
        membershipTier: regData.user.membershipTier
      }));

      if (isSubscribing) {
        const stripeRes = await fetch(`${API_BASE_URL}/api/create-checkout-session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${regData.token}` },
          body: JSON.stringify({ tier: selectedTier }),
        });
        
        const stripeData = await stripeRes.json();
        if (stripeData.url) window.location.href = stripeData.url;
      }
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
      setIsLoading(false);
      setStep(1); 
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
        setUserDetails(prev => ({ 
          ...prev, 
          name: data.user.name, 
          email: data.user.email,
          membershipTier: data.user.membershipTier,
          role: data.user.role || 'client'
        }));
        setSelectedTier(data.user.membershipTier);
        setIsSubscribing(data.user.membershipTier !== 'basic' && data.user.membershipTier !== 'admin');
        
        const userRole = data.user.role;
        const isLegacyAdmin = data.user.membershipTier === 'admin';
        
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
    localStorage.removeItem('adminActiveTab');

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

  return (
    <div style={{ width: '100%', minHeight: '100vh', display: 'flex', alignItems: 'center', position: 'relative' }}>
      
      <GlobalPublicLaunchStyles />
      {isLoading && <FallingSparkles/>}

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
                  <p style={{ margin: '0 0 14px 0', fontSize: '0.8rem', color: '#8A797A', textAlign: 'center', fontFamily: 'sans-serif' }}>
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '40px auto' }}>
              <div style={{ width: '80px', height: '1px', backgroundColor: '#E8C5C8' }}></div>
              <span style={{ color: '#E8C5C8', margin: '0 15px', fontSize: '1.2rem' }}>✧</span>
              <div style={{ width: '80px', height: '1px', backgroundColor: '#E8C5C8' }}></div>
            </div>
            
            <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center' }}>
                <EmpowermentButton text="Free Membership" onClick={() => { setSelectedTier('basic'); setStep(7); }} />
                <EmpowermentButton text="Join Paid Membership" onClick={() => setStep(2)} />
              </div>
              <p style={{ cursor: 'pointer', color: '#A89999', textDecoration: 'underline', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.1rem', transition: 'color 0.3s ease', marginTop: '10px' }} onClick={() => setStep(4)} onMouseOver={(e) => e.target.style.color = '#736A6A'} onMouseOut={(e) => e.target.style.color = '#A89999'}>
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
              <div style={{ maxWidth: '400px', margin: '0 auto' }}>
                <ElegantInput name="name" onChange={handleInputChange} placeholder="Your First Name" type="text" value={userDetails.name}/>
                <ElegantInput name="email" onChange={handleInputChange} placeholder="Email Address" type="email" value={userDetails.email}/>
                <ElegantInput name="password" onChange={handleInputChange} placeholder="Create a Password" type="password" value={userDetails.password}/>
                
                <div style={{ marginTop: '35px' }}>
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
            <p style={{ fontSize: '1.4rem', lineHeight: '1.8', fontFamily: "'Cormorant Garamond', serif", color: '#736A6A', margin: '15px auto 35px', maxWidth: '600px' }}>Enter your details below to join our community and start shopping our curated boutique.</p>

            {isLoading ? (
              <EmpowermentLoader text="Creating your free membership..."/>
            ) : (
              <div style={{ maxWidth: '400px', margin: '0 auto' }}>
                <ElegantInput name="name" onChange={handleInputChange} placeholder="Your First Name" type="text" value={userDetails.name}/>
                <ElegantInput name="email" onChange={handleInputChange} placeholder="Email Address" type="email" value={userDetails.email}/>
                <ElegantInput name="password" onChange={handleInputChange} placeholder="Create a Password" type="password" value={userDetails.password}/>
                
                <div style={{ marginTop: '35px' }}>
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
            <p style={{ fontSize: '1.4rem', lineHeight: '1.8', fontFamily: "'Cormorant Garamond', serif", color: '#736A6A', margin: '15px auto 35px', maxWidth: '600px' }}>Sign in to access your dashboard and personalized blueprint.</p>

            {isLoading ? (
              <EmpowermentLoader text="Verifying credentials securely..."/>
            ) : (
              <div style={{ maxWidth: '400px', margin: '0 auto' }}>
                <ElegantInput name="email" onChange={handleLoginInputChange} placeholder="Email Address" type="email" value={loginCredentials.email}/>
                <ElegantInput name="password" onChange={handleLoginInputChange} placeholder="Password" type="password" value={loginCredentials.password}/>
                
                <div style={{ marginTop: '35px' }}>
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

              <div className="sanctuary-nav-list" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', padding: '0 20px' }}>
                {['Blueprint', 'Boutique', 'Inbox', 'Consultations'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveMemberTab(tab)}
                    style={{
                      padding: '12px 20px', textAlign: 'left', border: 'none', borderRadius: '12px',
                      backgroundColor: activeMemberTab === tab ? '#F2D4D7' : 'transparent',
                      color: activeMemberTab === tab ? '#5C5454' : '#8A797A',
                      fontFamily: "'Cormorant Garamond', serif", fontSize: '1.25rem', cursor: 'pointer',
                      transition: 'all 0.3s ease', fontWeight: activeMemberTab === tab ? 'bold' : 'normal',
                      boxShadow: activeMemberTab === tab ? '0 4px 10px rgba(232, 197, 200, 0.3)' : 'none'
                    }}
                  >
                    {tab === 'Blueprint' && '📝 '}
                    {tab === 'Boutique' && '🛍️ '}
                    {tab === 'Inbox' && '💌 '}
                    {tab === 'Consultations' && '🎥 '}
                    {tab}
                  </button>
                ))}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <span style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', color: '#A89999', fontSize: '1.2rem' }}>Welcome, {userDetails.name || 'Valued Member'}</span>
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
                  <p style={{ fontSize: '1.3rem', lineHeight: '1.6', fontFamily: "'Cormorant Garamond', serif", color: '#736A6A', margin: '0 0 30px 0', maxWidth: '600px' }}>
                    {selectedTier === 'radiance' ? "🌟 Radiance Elite Member — Premium Access Verified." : selectedTier === 'luminary' ? "✨ Luminary Circle Member — Subscription Verified." : "✨ Access verified."}
                  </p>

                  {!hasCompletedQuiz ? (
                    <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', border: '1px solid #E8C5C8', borderRadius: '15px', padding: '40px', boxShadow: '0 4px 15px rgba(232, 197, 200, 0.15)', marginBottom: '40px' }}>
                      <h3 style={{ fontSize: '2.2rem', color: '#5C5454', fontFamily: "'Cormorant Garamond', serif", margin: '0 0 15px 0' }}>Unlock Your Bespoke Routine</h3>
                      <p style={{ fontSize: '1.2rem', color: '#736A6A', fontFamily: "'Cormorant Garamond', serif", marginBottom: '12px' }}>As a member, you have exclusive access to Susan's Beauty Blueprint curation process. Take the quiz to generate your custom products.</p>
                      <p style={{ fontSize: '1rem', color: '#B38B8F', fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', marginBottom: '30px' }}>
                        🔒 Note: Your Beauty Blueprint is a one-time personal curation and will be permanently locked to your membership profile upon completion.
                      </p>
                      <EmpowermentButton text="Start the Consultation" onClick={() => { if (!hasCompletedQuiz) setStep(11); }} />
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
                      <h3 style={{ fontSize: '2.2rem', color: '#5C5454', fontFamily: "'Cormorant Garamond', serif", margin: '0 0 20px 0' }}>Order History</h3>
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
                  <div style={{ backgroundColor: '#FFFFFF', padding: '40px', borderRadius: '20px', border: '1px solid #E8C5C8', boxShadow: '0 10px 30px rgba(232, 197, 200, 0.15)' }}>
                    <h2 style={{ fontFamily: "'Cormorant Garamond', serif", color: '#B38B8F', marginTop: 0, fontSize: '2.2rem' }}>
                      Book & Manage Your Consultation with Susan
                    </h2>
                    <p style={{ color: '#736A6A', fontFamily: 'sans-serif', fontSize: '1rem', marginBottom: '25px' }}>
                      Select any date on Susan's live calendar below to book a 1-on-1 consultation, or view updates if Susan reschedules your session.
                    </p>

                    <MemberCalendar
                      onJoinVideoRoom={(link) => {
                        const normalized = normalizeRoomUrl(link);
                        setMemberVideoLink(normalized);
                        setActiveMemberVideoUrl(normalized);
                      }}
                    />
                  </div>

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
            <h2 style={{ fontSize: '3rem', color: '#B38B8F', fontFamily: "'Alex Brush', cursive", margin: '0 0 20px 0' }}>Regimen Focus</h2>
            <p style={{ fontSize: '1.4rem', color: '#736A6A', fontFamily: "'Cormorant Garamond', serif", marginBottom: '30px' }}>Do you prefer a minimalist routine or a luxurious multi-step ritual?</p>
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

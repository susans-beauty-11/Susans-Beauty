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
const evaluateBlueprintMatch 

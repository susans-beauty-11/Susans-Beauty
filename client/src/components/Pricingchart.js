import React, { useState } from 'react';

const TIERS = [
  {
    id: 'essential',
    name: 'Essential Sanctuary',
    tagline: 'Daily Barrier Maintenance & Member Pricing',
    price: 19,
    period: '/month',
    badge: 'ESSENTIAL TIER',
    highlight: false,
    creditMatch: '100% Store Credit Match ($19/mo added to your Vault)',
    ctaLabel: 'Start Essential ($19/mo) ✧',
    features: [
      'Full 10-Step Beauty Blueprint Skin Diagnostic Quiz',
      '$19 Monthly Boutique Store Credit (rolls over)',
      'Member-Only 20% Savings on Curated Skincare',
      '24/7 Access to Ask Lily AI Skincare Concierge',
      'Seasonal Winter & Summer Barrier Transition Guides'
    ]
  },
  {
    id: 'luminary',
    name: 'The Luminary Circle VIP',
    tagline: 'Curated 3-Piece Monthly Ritual + Founding Perks',
    price: 49,
    period: '/month',
    badge: 'MOST POPULAR • FOUNDING 50',
    highlight: true,
    creditMatch: '100% Store Credit Match ($49/mo added to your Vault)',
    ctaLabel: 'Claim Luminary VIP Spot ($49/mo) ✧',
    features: [
      'Everything in Essential + Founding 50 Lifetime Price Lock',
      'Curated 3-Piece Monthly Skincare Ritual Box Shipped Free',
      '100% Dollar-for-Dollar Store Credit Match ($49/mo)',
      'Quarterly 1-on-1 Consultation with Susan Coke',
      'Priority Access to Limited-Batch Clinical Formulations'
    ]
  },
  {
    id: 'radiance',
    name: 'The Radiance Elite All-Access',
    tagline: '5-Piece Ritual Box + VIP AI Photo Analysis + Mystery Box',
    price: 119,
    period: '/month',
    badge: 'ALL-ACCESS + FREE MYSTERY BOX',
    highlight: false,
    creditMatch: '100% Store Credit Match ($119/mo) + Free Mystery Box',
    ctaLabel: 'Claim Radiance Elite + Mystery Box ($119/mo) ✧',
    features: [
      '60-Second VIP AI Skin Photo Barrier & Hydration Analysis',
      'Curated 5-Piece Full-Size Monthly Skincare Ritual Box',
      'Complimentary Luxury Founder’s Mystery Box ($150+ Value)',
      'Monthly 1-on-1 Private Video or Sanctuary Consultation with Susan',
      '100% Store Credit Match ($119/mo) + 35% VIP Boutique Discount'
    ]
  }
];

const PricingChart = ({
  onSelectTier,
  onCheckout,
  onSubscribe,
  user,
  currentUser,
  apiBaseUrl,
  foundingSpotsRemaining = 47,
  loadingTier: externalLoadingTier = null
}) => {
  const [internalLoadingTier, setInternalLoadingTier] = useState(null);
  const [checkoutError, setCheckoutError] = useState('');

  const activeUser = user || currentUser || null;
  const activeLoadingTier = externalLoadingTier || internalLoadingTier;

  const resolvedApiBase =
    apiBaseUrl ||
    process.env.REACT_APP_API_URL ||
    (typeof window !== 'undefined' && window.location.hostname === 'localhost'
      ? 'http://localhost:5000'
      : '');

  const handleTierAction = async (tierObj) => {
    setCheckoutError('');
    const customHandler = onSelectTier || onCheckout || onSubscribe;

    if (typeof customHandler === 'function') {
      try {
        setInternalLoadingTier(tierObj.id);
        await customHandler(tierObj.id, tierObj);
      } catch (err) {
        setCheckoutError(err?.message || 'Unable to start checkout. Please try again.');
      } finally {
        setInternalLoadingTier(null);
      }
      return;
    }

    try {
      setInternalLoadingTier(tierObj.id);
      const token =
        typeof localStorage !== 'undefined'
          ? localStorage.getItem('token') || localStorage.getItem('sbc_token')
          : null;

      const headers = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      const payload = {
        tier: tierObj.id,
        membershipTier: tierObj.id,
        plan: tierObj.id,
        price: tierObj.price,
        email: activeUser?.email || undefined,
        userId: activeUser?._id || activeUser?.id || undefined,
        includesVipMysteryBox: tierObj.id === 'radiance'
      };

      const endpoints = [
        `${resolvedApiBase}/api/membership/checkout`,
        `${resolvedApiBase}/api/create-checkout-session`,
        `${resolvedApiBase}/api/stripe/create-subscription-session`
      ];

      let sessionUrl = null;
      let lastError = 'Unable to initialize Stripe checkout session.';

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
          });
          const data = await response.json().catch(() => ({}));
          if (response.ok && (data.url || data.checkoutUrl || data.sessionUrl)) {
            sessionUrl = data.url || data.checkoutUrl || data.sessionUrl;
            break;
          }
          if (data?.error || data?.message) {
            lastError = data.error || data.message;
          }
        } catch (innerErr) {
          lastError = innerErr.message || lastError;
        }
      }

      if (sessionUrl && typeof window !== 'undefined') {
        window.location.href = sessionUrl;
        return;
      }

      setCheckoutError(lastError);
    } catch (err) {
      setCheckoutError(err?.message || 'Checkout connection error. Please try again.');
    } finally {
      setInternalLoadingTier(null);
    }
  };

  return (
    <section
      id="pricing-tiers"
      style={{
        maxWidth: '1080px',
        margin: '36px auto',
        padding: '0 16px',
        textAlign: 'center'
      }}
    >
      <div style={{ marginBottom: '26px' }}>
        <span
          style={{
            display: 'inline-block',
            backgroundColor: '#FFF0F2',
            color: '#C62828',
            border: '1px solid #B38B8F',
            borderRadius: '20px',
            padding: '6px 16px',
            fontFamily: 'sans-serif',
            fontSize: '0.78rem',
            fontWeight: 'bold',
            letterSpacing: '0.5px',
            marginBottom: '12px'
          }}
        >
          🔴 FOUNDING 50 ENROLLMENT OPEN • {foundingSpotsRemaining} SPOTS REMAINING
        </span>

        <h2
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: '2.4rem',
            color: '#5C5454',
            margin: '0 0 10px 0',
            lineHeight: '1.2'
          }}
        >
          Choose Your Sanctuary Membership Tier
        </h2>

        <p
          style={{
            fontFamily: 'sans-serif',
            fontSize: '0.96rem',
            color: '#736A6A',
            maxWidth: '680px',
            margin: '0 auto',
            lineHeight: '1.6'
          }}
        >
          Every Founding Membership includes a <strong>100% Dollar-for-Dollar Store Credit Match</strong> in your Boutique Vault and a <strong>Lifetime Founding Price Lock</strong>. Cancel or switch tiers anytime in one click.
        </p>
      </div>

      {checkoutError && (
        <div
          style={{
            maxWidth: '640px',
            margin: '0 auto 20px auto',
            backgroundColor: '#FFF0F2',
            border: '1px solid #C62828',
            color: '#C62828',
            padding: '12px 16px',
            borderRadius: '12px',
            fontFamily: 'sans-serif',
            fontSize: '0.88rem'
          }}
        >
          ⚠️ {checkoutError}
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
          gap: '22px',
          alignItems: 'stretch'
        }}
      >
        {TIERS.map((tier) => {
          const isCurrentLoading = activeLoadingTier === tier.id;
          return (
            <div
              key={tier.id}
              style={{
                backgroundColor: '#FFFFFF',
                border: tier.highlight ? '2.5px solid #B38B8F' : '1.5px solid #E8C5C8',
                borderRadius: '24px',
                padding: '28px 24px',
                boxShadow: tier.highlight
                  ? '0 16px 38px rgba(179, 139, 143, 0.28)'
                  : '0 8px 24px rgba(179, 139, 143, 0.12)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                textAlign: 'left',
                position: 'relative'
              }}
            >
              <div>
                <div
                  style={{
                    display: 'inline-block',
                    backgroundColor: tier.highlight ? '#B38B8F' : '#FFF0F2',
                    color: tier.highlight ? '#FFFFFF' : '#B38B8F',
                    borderRadius: '14px',
                    padding: '4px 12px',
                    fontFamily: 'sans-serif',
                    fontSize: '0.72rem',
                    fontWeight: 'bold',
                    letterSpacing: '0.5px',
                    marginBottom: '12px'
                  }}
                >
                  {tier.badge}
                </div>

                <h3
                  style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: '1.75rem',
                    color: '#5C5454',
                    margin: '0 0 6px 0'
                  }}
                >
                  {tier.name}
                </h3>

                <p
                  style={{
                    fontFamily: 'sans-serif',
                    fontSize: '0.84rem',
                    color: '#8A797A',
                    margin: '0 0 16px 0',
                    lineHeight: '1.45'
                  }}
                >
                  {tier.tagline}
                </p>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: '4px',
                    marginBottom: '12px'
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'Cormorant Garamond', serif",
                      fontSize: '2.75rem',
                      fontWeight: 'bold',
                      color: '#5C5454',
                      lineHeight: '1'
                    }}
                  >
                    ${tier.price}
                  </span>
                  <span
                    style={{
                      fontFamily: 'sans-serif',
                      fontSize: '0.9rem',
                      color: '#8A797A'
                    }}
                  >
                    {tier.period}
                  </span>
                </div>

                <div
                  style={{
                    backgroundColor: '#FFF9F9',
                    border: '1px solid #E8C5C8',
                    borderRadius: '12px',
                    padding: '10px 12px',
                    fontFamily: 'sans-serif',
                    fontSize: '0.8rem',
                    color: '#5C5454',
                    fontWeight: 600,
                    marginBottom: '18px'
                  }}
                >
                  💵 {tier.creditMatch}
                </div>

                <ul
                  style={{
                    listStyle: 'none',
                    padding: 0,
                    margin: '0 0 24px 0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}
                >
                  {tier.features.map((feat, idx) => (
                    <li
                      key={idx}
                      style={{
                        fontFamily: 'sans-serif',
                        fontSize: '0.86rem',
                        color: '#5C5454',
                        lineHeight: '1.45',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '8px'
                      }}
                    >
                      <span style={{ color: '#B38B8F', fontWeight: 'bold' }}>✓</span>
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                type="button"
                disabled={Boolean(activeLoadingTier)}
                onClick={() => handleTierAction(tier)}
                style={{
                  width: '100%',
                  background: tier.highlight
                    ? 'linear-gradient(135deg, #B38B8F 0%, #D4A5A9 100%)'
                    : '#FFF0F2',
                  color: tier.highlight ? '#FFFFFF' : '#5C5454',
                  border: tier.highlight ? 'none' : '1.5px solid #B38B8F',
                  borderRadius: '26px',
                  padding: '14px 20px',
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: '1.18rem',
                  fontWeight: 'bold',
                  cursor: activeLoadingTier ? 'wait' : 'pointer',
                  boxShadow: tier.highlight
                    ? '0 8px 20px rgba(179, 139, 143, 0.32)'
                    : 'none',
                  opacity: activeLoadingTier && !isCurrentLoading ? 0.65 : 1
                }}
              >
                {isCurrentLoading ? 'Opening Secure Stripe Checkout...' : tier.ctaLabel}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default PricingChart;
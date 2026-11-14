import React from 'react';

const AboutSusan = ({
  onStartQuiz,
  onStartDiagnostic,
  onClaimSpot,
  onCtaClick,
  foundingSpotsRemaining = 47
}) => {
  const handlePrimaryAction = () => {
    const callback = onStartDiagnostic || onStartQuiz || onClaimSpot || onCtaClick;
    if (typeof callback === 'function') {
      callback();
      return;
    }
    const pricingEl =
      document.getElementById('pricing-tiers') ||
      document.getElementById('membership-tiers') ||
      document.getElementById('founding-tiers');
    if (pricingEl) {
      pricingEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const credentials = [
    {
      icon: '🏆',
      title: '5-Time Regional Beauty Consultant',
      detail: 'Five years of hands-on regional skincare diagnostics and product curation for thousands of women across Kansas.'
    },
    {
      icon: '🔬',
      title: 'Barrier-First Formulation Philosophy',
      detail: 'Focused on rebuilding the stratum corneum with physiological 3:1:1 ceramides, cholesterol, and non-comedogenic humectants.'
    },
    {
      icon: '🤖',
      title: 'Precision AI + Human Curation',
      detail: 'Combines 60-second computer-vision skin diagnostics with Susan’s personal 1-on-1 routine reviews and monthly ritual boxes.'
    }
  ];

  return (
    <section
      id="about-susan"
      style={{
        maxWidth: '980px',
        margin: '36px auto',
        padding: '0 16px',
        textAlign: 'left'
      }}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '1.5px solid #E8C5C8',
          borderRadius: '24px',
          padding: '36px 30px',
          boxShadow: '0 12px 34px rgba(179, 139, 143, 0.16)'
        }}
      >
        <div
          style={{
            display: 'inline-block',
            backgroundColor: '#FFF0F2',
            color: '#B38B8F',
            border: '1px solid #B38B8F',
            borderRadius: '20px',
            padding: '5px 14px',
            fontFamily: 'sans-serif',
            fontSize: '0.76rem',
            fontWeight: 'bold',
            letterSpacing: '0.6px',
            textTransform: 'uppercase',
            marginBottom: '14px'
          }}
        >
          ✧ Meet Your Founder & Senior Aesthetic Consultant
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '28px',
            alignItems: 'center'
          }}
        >
          <div>
            <h2
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: '2.25rem',
                color: '#5C5454',
                margin: '0 0 12px 0',
                lineHeight: '1.2'
              }}
            >
              “You Don’t Need Another 12-Step Hype Routine. You Need the Exact Actives Your Skin Barrier Is Asking For.”
            </h2>

            <p
              style={{
                fontFamily: 'sans-serif',
                fontSize: '0.96rem',
                color: '#5C5454',
                lineHeight: '1.7',
                margin: '0 0 14px 0'
              }}
            >
              Hi, I’m <strong>Susan Coke</strong>, founder of <strong>Susan’s Beauty Consulting</strong>. During my five years serving as a 5-time recognized Regional Beauty Consultant at Walgreens in Salina, Kansas, I spoke with hundreds of women over 35 who had drawers full of expensive creams that either left their skin tight and flaky by midday or triggered stubborn breakouts.
            </p>

            <p
              style={{
                fontFamily: 'sans-serif',
                fontSize: '0.95rem',
                color: '#736A6A',
                lineHeight: '1.7',
                margin: '0 0 20px 0'
              }}
            >
              Most sudden fine lines, dullness, and sensitivity in your 30s, 40s, and 50s aren’t permanent aging—they’re subclinical barrier dehydration paired with natural lipid decline. I built the Sanctuary so you never have to guess in a store aisle again: our <strong>60-Second VIP AI Skin Diagnostic</strong> and <strong>10-Step Beauty Blueprint</strong> pinpoint whether your skin needs water-binding humectants or barrier-sealing ceramides, and match every dollar of your Founding Membership 100% in your Boutique Vault.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
              <button
                type="button"
                onClick={handlePrimaryAction}
                style={{
                  background: 'linear-gradient(135deg, #B38B8F 0%, #D4A5A9 100%)',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '28px',
                  padding: '13px 26px',
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: '1.2rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  boxShadow: '0 6px 18px rgba(179, 139, 143, 0.32)'
                }}
              >
                Unlock My Custom Skin Blueprint ✧
              </button>
              <span
                style={{
                  fontFamily: 'sans-serif',
                  fontSize: '0.82rem',
                  color: '#8A797A',
                  fontWeight: 600
                }}
              >
                🔴 Only {foundingSpotsRemaining} of 50 Founding Member spots left
              </span>
            </div>
          </div>

          <div
            style={{
              backgroundColor: '#FFF9F9',
              border: '1px solid #E8C5C8',
              borderRadius: '20px',
              padding: '22px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}
          >
            <div
              style={{
                borderBottom: '1px solid #E8C5C8',
                paddingBottom: '12px',
                marginBottom: '2px'
              }}
            >
              <div
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: '1.45rem',
                  fontWeight: 'bold',
                  color: '#5C5454'
                }}
              >
                Why Women 35–65 Trust Susan’s Sanctuary
              </div>
              <div
                style={{
                  fontFamily: 'sans-serif',
                  fontSize: '0.8rem',
                  color: '#8A797A'
                }}
              >
                Clinical Barrier Science • Zero Retail Markup Guessing
              </div>
            </div>

            {credentials.map((item, index) => (
              <div
                key={index}
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #F0D9DC',
                  borderRadius: '14px',
                  padding: '12px 14px'
                }}
              >
                <div
                  style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: '1.12rem',
                    fontWeight: 'bold',
                    color: '#5C5454',
                    marginBottom: '4px'
                  }}
                >
                  {item.icon} {item.title}
                </div>
                <div
                  style={{
                    fontFamily: 'sans-serif',
                    fontSize: '0.83rem',
                    color: '#736A6A',
                    lineHeight: '1.5'
                  }}
                >
                  {item.detail}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutSusan;
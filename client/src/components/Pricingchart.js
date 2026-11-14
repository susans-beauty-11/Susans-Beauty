import React, { useState } from 'react';

const TIERS = [
  {
    id: 'essential',
    name: 'Essential Glow',
    priceId: 'price_essential_tier', // Replace with live Stripe Price ID or map on backend
    price: 19,
    tagline: 'Digital skin diagnostics & member store access for self-guided routines.',
    badge: null,
    highlighted: false,
    ctaText: 'Start Essential',
    features: [
      { text: 'Monthly AI Skin Analysis & Routine Update', included: true },
      { text: '10% Off All Boutique Skincare Products', included: true },
      { text: 'Seasonal Skincare Guide & Ingredient Tracker', included: true },
      { text: 'Standard Salon & Virtual Booking Access', included: true },
      { text: 'Monthly Curated Mystery Box', included: false },
      { text: 'Priority VIP Booking Line with Susan', included: false },
      { text: '1-on-1 Live Video Consultation with Susan', included: false },
    ],
  },
  {
    id: 'luminary',
    name: 'Luminary VIP',
    priceId: 'price_luminary_tier', // Replace with live Stripe Price ID
    price: 49,
    tagline: 'Our signature Founding Member tier with AI diagnostics and a monthly product box.',
    badge: 'Most Popular • Founding 50',
    highlighted: true,
    ctaText: 'Claim Luminary Spot',
    features: [
      { text: 'Unlimited AI Skin Analysis & Custom Routine', included: true },
      { text: '15% Off All Boutique Skincare Products', included: true },
      { text: 'Monthly Mystery Box ($85+ Retail Value)', included: true },
      { text: 'Priority Booking for Salon & Consultations', included: true },
      { text: 'Free Shipping on All Store Orders', included: true },
      { text: 'Quarterly 15-Min Check-In with Susan', included: true },
      { text: 'Monthly 1-on-1 Deep-Dive Consultation', included: false },
    ],
  },
  {
    id: 'radiance',
    name: 'Radiance All-Access',
    priceId: 'price_radiance_tier', // Replace with live Stripe Price ID
    price: 119,
    tagline: 'Complete concierge beauty care, deluxe full-size box, and direct 1-on-1 access to Susan.',
    badge: 'Ultimate Concierge',
    highlighted: false,
    ctaText: 'Join Radiance VIP',
    features: [
      { text: 'Unlimited AI Skin Analysis & Dynamic Tracking', included: true },
      { text: '25% Off All Boutique Skincare Products', included: true },
      { text: 'Deluxe Monthly Mystery Box ($200+ Retail Value)', included: true },
      { text: 'First-in-Line VIP Booking & Emergency Slots', included: true },
      { text: 'Free Expedited Shipping on All Orders', included: true },
      { text: 'Monthly 30-Min 1-on-1 Consultation with Susan', included: true },
      { text: 'Custom Seasonal Regimen Formulated by Susan', included: true },
    ],
  },
];

const COMPARISON_ROWS = [
  {
    feature: 'AI Skin Analysis & Routine Builder',
    description: 'Instant photo-based diagnostics for hydration, texture, and seasonal shifts',
    essential: '1 Scan / Month',
    luminary: 'Unlimited Scans',
    radiance: 'Unlimited + Trend Tracking',
  },
  {
    feature: 'Monthly Curated Mystery Box',
    description: 'Hand-selected skincare & haircare tailored to your skin profile',
    essential: false,
    luminary: 'Standard Box ($85+ Value)',
    radiance: 'Deluxe Full-Size ($200+ Value)',
  },
  {
    feature: 'Priority Salon & Consultation Booking',
    description: 'Skip the waitlist for peak appointments and seasonal prep',
    essential: 'Standard Access',
    luminary: '48-Hr Priority Window',
    radiance: 'First-in-Line + Reserved VIP Slots',
  },
  {
    feature: 'Direct Consultations with Susan',
    description: 'Private virtual or in-person skin and beauty coaching',
    essential: false,
    luminary: 'Quarterly 15-Min Check-In',
    radiance: 'Monthly 30-Min Private Session',
  },
  {
    feature: 'Member Boutique Discount',
    description: 'Automatic savings on every product order all year round',
    essential: '10% Off',
    luminary: '15% Off',
    radiance: '25% Off',
  },
  {
    feature: 'Shipping Perks',
    description: 'Delivery on boutique orders and monthly membership boxes',
    essential: 'Standard Rates',
    luminary: 'Free Standard Shipping',
    radiance: 'Free Expedited Shipping',
  },
  {
    feature: 'Founding 50 Member Bonus Gift',
    description: 'Exclusive welcome kit locked in for the first 50 members',
    essential: false,
    luminary: true,
    radiance: true,
  },
];

const CheckIcon = ({ className = 'w-5 h-5 text-emerald-600' }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
  </svg>
);

const CrossIcon = ({ className = 'w-5 h-5 text-stone-300' }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

export default function PricingChart({ spotsRemaining = 14, onSelectTier }) {
  const [loadingTier, setLoadingTier] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const handleTierCheckout = async (tier) => {
    setErrorMsg('');

    // If parent App.js passes a custom checkout handler, delegate to it
    if (typeof onSelectTier === 'function') {
      onSelectTier(tier);
      return;
    }

    // Default built-in Stripe checkout session request to server.js
    try {
      setLoadingTier(tier.id);
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tierId: tier.id,
          priceId: tier.priceId,
          tierName: tier.name,
          price: tier.price,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to start checkout. Please try again.');
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      setErrorMsg(err.message || 'Checkout connection error. Please try again.');
    } finally {
      setLoadingTier(null);
    }
  };

  const renderMatrixCell = (value, isHighlighted = false) => {
    if (value === true) {
      return (
        <div className="flex justify-center">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-50 text-emerald-600">
            <CheckIcon className="w-4 h-4" />
          </span>
        </div>
      );
    }
    if (value === false) {
      return (
        <div className="flex justify-center">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-stone-100 text-stone-400">
            <CrossIcon className="w-4 h-4" />
          </span>
        </div>
      );
    }
    return (
      <span
        className={`text-sm font-medium ${
          isHighlighted ? 'text-rose-900 font-semibold' : 'text-stone-700'
        }`}
      >
        {value}
      </span>
    );
  };

  return (
    <section id="membership-tiers" className="py-16 px-4 sm:px-6 lg:px-8 bg-stone-50 text-stone-900">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-rose-100 border border-rose-200 text-rose-900 text-xs sm:text-sm font-semibold tracking-wide uppercase mb-4">
            <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse" />
            Founding 50 Enrollment Open • {spotsRemaining} Spots Remaining
          </div>
          <h2 className="text-3xl sm:text-4xl font-serif font-bold tracking-tight text-stone-900 mb-4">
            Transparent Membership Tiers. Zero Hidden Fees.
          </h2>
          <p className="text-base sm:text-lg text-stone-600 leading-relaxed">
            Know exactly what you receive every month before you join. Whether you want AI-guided
            skincare diagnostics or a full-size monthly beauty box curated by Susan, every tier
            can be paused or canceled anytime with one click.
          </p>
        </div>

        {/* Error Banner */}
        {errorMsg && (
          <div className="max-w-xl mx-auto mb-8 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm text-center">
            {errorMsg}
          </div>
        )}

        {/* Mobile-First 3-Tier Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch mb-16">
          {TIERS.map((tier) => {
            const isBusy = loadingTier === tier.id;
            return (
              <div
                key={tier.id}
                className={`relative flex flex-col rounded-2xl transition-all duration-200 ${
                  tier.highlighted
                    ? 'bg-white border-2 border-rose-500 shadow-xl lg:-translate-y-2'
                    : 'bg-white border border-stone-200 shadow-sm hover:shadow-md'
                }`}
              >
                {/* Top Badge */}
                {tier.badge && (
                  <div
                    className={` -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider whitespace-nowrap shadow-sm ${
                      tier.highlighted
                        ? 'bg-rose-600 text-white'
                        : 'bg-stone-900 text-amber-200'
                    }`}
                  >
                    {tier.badge}
                  </div>
                )}

                <div className="p-6 sm:p-8 flex-1 flex flex-col">
                  <div className="mb-6">
                    <h3 className="text-xl font-bold text-stone-900 mb-2">{tier.name}</h3>
                    <p className="text-sm text-stone-600 min-h-[40px]">{tier.tagline}</p>
                  </div>

                  {/* Price Block */}
                  <div className="mb-6 pb-6 border-b border-stone-100">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl sm:text-5xl font-extrabold tracking-tight text-stone-900">
                        ${tier.price}
                      </span>
                      <span className="text-sm font-medium text-stone-500">/ month</span>
                    </div>
                    <p className="text-xs text-stone-500 mt-1">
                      Locked-in Founding Member rate • Cancel anytime
                    </p>
                  </div>

                  {/* Feature Checklist */}
                  <ul className="space-y-3.5 mb-8 flex-1">
                    {tier.features.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-3 text-sm">
                        <span className="mt-0.5 shrink-0">
                          {item.included ? (
                            <CheckIcon className="w-5 h-5 text-emerald-600" />
                          ) : (
                            <CrossIcon className="w-5 h-5 text-stone-300" />
                          )}
                        </span>
                        <span
                          className={
                            item.included
                              ? 'text-stone-800 font-medium'
                              : 'text-stone-400 line-through'
                          }
                        >
                          {item.text}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA Button */}
                  <button
                    type="button"
                    onClick={() => handleTierCheckout(tier)}
                    disabled={isBusy}
                    className={`w-full py-3.5 px-6 rounded-xl font-semibold text-sm sm:text-base transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                      tier.highlighted
                        ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-md focus:ring-rose-500'
                        : 'bg-stone-900 hover:bg-stone-800 text-white focus:ring-stone-900'
                    } ${isBusy ? 'opacity-70 cursor-wait' : ''}`}
                  >
                    {isBusy ? 'Securing Your Spot...' : tier.ctaText}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Side-by-Side Detailed Feature Comparison Matrix */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="p-6 sm:p-8 border-b border-stone-200 bg-stone-50/60">
            <h3 className="text-xl sm:text-2xl font-serif font-bold text-stone-900">
              Side-by-Side Benefit Comparison
            </h3>
            <p className="text-sm text-stone-600 mt-1">
              Compare every deliverable across Essential, Luminary, and Radiance memberships.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[640px]">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50/40">
                  <th className="py-4 px-6 text-xs font-bold uppercase tracking-wider text-stone-500 w-2/5">
                    Membership Deliverable
                  </th>
                  <th className="py-4 px-4 text-center text-sm font-bold text-stone-800 w-1/5">
                    Essential
                    <span className="block text-xs font-normal text-stone-500 mt-0.5">$19/mo</span>
                  </th>
                  <th className="py-4 px-4 text-center text-sm font-bold text-rose-900 bg-rose-50/60 w-1/5">
                    Luminary VIP
                    <span className="block text-xs font-semibold text-rose-600 mt-0.5">$49/mo</span>
                  </th>
                  <th className="py-4 px-4 text-center text-sm font-bold text-stone-800 w-1/5">
                    Radiance
                    <span className="block text-xs font-normal text-stone-500 mt-0.5">$119/mo</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {COMPARISON_ROWS.map((row, index) => (
                  <tr key={index} className="hover:bg-stone-50/50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="font-semibold text-stone-900 text-sm">{row.feature}</div>
                      <div className="text-xs text-stone-500 mt-0.5">{row.description}</div>
                    </td>
                    <td className="py-4 px-4 text-center">{renderMatrixCell(row.essential)}</td>
                    <td className="py-4 px-4 text-center bg-rose-50/30">
                      {renderMatrixCell(row.luminary, true)}
                    </td>
                    <td className="py-4 px-4 text-center">{renderMatrixCell(row.radiance)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-stone-200 bg-stone-50/40">
                  <td className="py-4 px-6 text-xs text-stone-500 font-medium">
                    100% Secure Checkout via Stripe • Cancel Anytime
                  </td>
                  {TIERS.map((tier) => (
                    <td
                      key={tier.id}
                      className={`py-4 px-4 text-center ${
                        tier.highlighted ? 'bg-rose-50/60' : ''
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleTierCheckout(tier)}
                        disabled={loadingTier === tier.id}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
                          tier.highlighted
                            ? 'bg-rose-600 hover:bg-rose-700 text-white'
                            : 'bg-stone-900 hover:bg-stone-800 text-white'
                        }`}
                      >
                        {loadingTier === tier.id ? 'Loading...' : `Select ${tier.name.split(' ')[0]}`}
                      </button>
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Bottom Risk-Reversal Guarantee */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-6 text-xs sm:text-sm text-stone-600 text-center">
          <div className="flex items-center gap-2">
            <CheckIcon className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>No long-term contracts or cancellation fees</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckIcon className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Keep your Founding 50 pricing for life</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckIcon className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>256-bit SSL encrypted Stripe checkout</span>
          </div>
        </div>
      </div>
    </section>
  );
}

import React, { useState } from 'react';

const CREDENTIALS = [
  {
    title: '#1 Regional Beauty Consultant — 5 Years Running',
    description:
      'Recognized five consecutive years for clinical skin intuition, personalized regimen design, and unmatched client retention across the region.',
  },
  {
    title: 'Rooted in Kindness, Compassion & Zero Judgment',
    description:
      'No intimidating beauty counters or pushy upsells. Every session is a warm, supportive conversation built around your real life, budget, and comfort.',
  },
  {
    title: 'A Vision to Make Every Woman Feel Truly Seen',
    description:
      'Combining hands-on expertise with smart AI diagnostics so you never have to guess which ingredients your skin actually needs as the seasons change.',
  },
];

const STATS = [
  { value: '5 Years', label: 'Leading Regional Consultant' },
  { value: '1-on-1', label: 'Compassionate, Personal Care' },
  { value: '100%', label: 'Tailored to Your Unique Glow' },
];

const AwardIcon = ({ className = 'w-6 h-6 text-rose-600' }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
    />
  </svg>
);

const HeartSparkleIcon = ({ className = 'w-5 h-5 text-rose-600' }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
    />
  </svg>
);

const CheckBadgeIcon = ({ className = 'w-5 h-5 text-emerald-600' }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M5 13l4 4L19 7" />
  </svg>
);

export default function AboutSusan({
  photoUrl = '', // Pass Susan's portrait URL here (e.g., "/images/susan-portrait.jpg")
  onExploreTiers,
  onStartConsultation,
}) {
  const [imageError, setImageError] = useState(false);

  const handleScrollToTiers = () => {
    if (typeof onExploreTiers === 'function') {
      onExploreTiers();
      return;
    }
    const section = document.getElementById('membership-tiers');
    if (section) {
      section.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSecondaryAction = () => {
    if (typeof onStartConsultation === 'function') {
      onStartConsultation();
      return;
    }
    const aiSection = document.getElementById('ai-consultation');
    if (aiSection) {
      aiSection.scrollIntoView({ behavior: 'smooth' });
    } else {
      handleScrollToTiers();
    }
  };

  const showCustomPhoto = Boolean(photoUrl) && !imageError;

  return (
    <section
      id="about-susan"
      className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 bg-white text-stone-900 overflow-hidden"
    >
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left Column: Portrait Placeholder & Floating Credentials (Stacks on top on mobile) */}
          <div className="lg:col-span-5 relative">
            {/* Decorative Warm Aura Backdrop */}
            <div
              className=" -inset-4 bg-gradient-to-tr from-rose-100/80 via-amber-50/60 to-stone-100 rounded-3xl -z-10 transform -rotate-1"
              aria-hidden="true"
            />

            <div className="relative rounded-2xl overflow-hidden border border-stone-200 bg-stone-100 shadow-xl aspect-[4/5] flex flex-col justify-between">
              {showCustomPhoto ? (
                <img
                  src={photoUrl}
                  alt="Susan — Leading Regional Beauty Consultant"
                  onError={() => setImageError(true)}
                  className="w-full h-full object-cover object-center"
                />
              ) : (
                /* Styled Portrait Placeholder until photoUrl is provided */
                <div className="w-full h-full bg-gradient-to-b from-rose-50 via-stone-100 to-stone-200 flex flex-col items-center justify-center p-8 text-center">
                  <div className="w-24 h-24 rounded-full bg-white/90 border border-rose-200 shadow-sm flex items-center justify-center mb-4">
                    <HeartSparkleIcon className="w-10 h-10 text-rose-500" />
                  </div>
                  <p className="font-serif text-xl font-bold text-stone-800">
                    Susan&apos;s Portrait
                  </p>
                  <p className="text-xs text-stone-500 max-w-xs mt-1">
                    Pass <code className="bg-white/80 px-1.5 py-0.5 rounded">photoUrl</code> prop or
                    drop your salon portrait into <code className="bg-white/80 px-1.5 py-0.5 rounded">/public</code>
                  </p>
                </div>
              )}

              {/* Bottom Glassmorphic Quote Overlay */}
              <div className=" inset-x-0 bottom-0 p-5 sm:p-6 bg-gradient-to-t from-stone-950/90 via-stone-900/75 to-transparent text-white">
                <p className="text-sm sm:text-base font-serif italic text-rose-50 leading-snug mb-2">
                  &ldquo;True beauty care isn&apos;t about changing who you are—it&apos;s about
                  giving you the care, confidence, and kindness to see how radiant you already
                  are.&rdquo;
                </p>
                <div className="flex items-center justify-between text-xs text-stone-300">
                  <span className="font-semibold tracking-wide uppercase text-amber-200">
                    — Susan, Founder &amp; Lead Consultant
                  </span>
                  <span>5x Regional Honoree</span>
                </div>
              </div>
            </div>

            {/* Floating 5-Year Award Badge */}
            <div className="mt-4 sm:mt-0 sm: sm:-top-5 sm:-right-5 bg-white rounded-2xl p-4 shadow-lg border border-rose-100 flex items-center gap-3.5 max-w-xs">
              <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
                <AwardIcon className="w-7 h-7 text-rose-600" />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-rose-600">
                  Proven Excellence
                </div>
                <div className="text-sm font-bold text-stone-900 leading-tight">
                  Leading Regional Beauty Consultant 5 Years in a Row
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Empathy, Vision & Resume Copy */}
          <div className="lg:col-span-7">
            {/* Eyebrow Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-50 border border-rose-200 text-rose-900 text-xs font-semibold uppercase tracking-wider mb-4">
              <HeartSparkleIcon className="w-4 h-4 text-rose-600" />
              Meet Susan • Heart-Led Beauty &amp; Skin Expertise
            </div>

            {/* Headline */}
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-bold text-stone-900 tracking-tight leading-tight mb-6">
              Where Five Years of Regional Excellence Meets Unconditional Kindness.
            </h2>

            {/* Lead Story Paragraphs */}
            <div className="space-y-4 text-base sm:text-lg text-stone-600 leading-relaxed mb-8">
              <p>
                If you have ever felt overwhelmed by 10-step routines, rushed through an impersonal
                salon chair, or sold expensive jars that sat untouched in your bathroom drawer, you
                already know why Susan built this platform.
              </p>
              <p>
                Named the <strong className="text-stone-900 font-semibold">leading beauty consultant in the region for five consecutive years</strong>,
                Susan didn&apos;t earn her reputation through high-pressure sales. She earned it
                through <strong className="text-stone-900 font-semibold">genuine compassion, deep listening, and an unmistakable gift</strong> for
                making every woman who sits across from her feel heard, valued, and effortlessly
                beautiful in her own skin.
              </p>
              <p>
                Her vision for the <strong className="text-stone-900 font-semibold">Founding 50 Membership</strong> is simple:
                bring the warmth of a private, one-on-one consultation directly to your home—pairing
                her hands-on curation with instant AI skin analysis so your routine evolves right
                alongside your skin, your schedule, and the changing seasons.
              </p>
            </div>

            {/* 3 Core Authority & Empathy Pillars */}
            <div className="space-y-4 mb-8">
              {CREDENTIALS.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-4 p-4 rounded-xl bg-stone-50 border border-stone-200/80 hover:border-rose-200 transition-colors"
                >
                  <div className="mt-0.5 w-6 h-6 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
                    <CheckBadgeIcon className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-stone-900">
                      {item.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-stone-600 mt-1 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Key Stats Bar */}
            <div className="grid grid-cols-3 gap-4 py-6 border-y border-stone-200 mb-8">
              {STATS.map((stat, idx) => (
                <div key={idx} className="text-center sm:text-left">
                  <div className="text-2xl sm:text-3xl font-serif font-extrabold text-rose-700">
                    {stat.value}
                  </div>
                  <div className="text-xs sm:text-sm font-medium text-stone-600 mt-0.5">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <button
                type="button"
                onClick={handleScrollToTiers}
                className="px-7 py-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm sm:text-base shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 text-center"
              >
                Explore Founding 50 Memberships
              </button>
              <button
                type="button"
                onClick={handleSecondaryAction}
                className="px-7 py-4 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-900 font-semibold text-sm sm:text-base border border-stone-300 transition-all focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2 text-center"
              >
                Try Free AI Skin Check
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

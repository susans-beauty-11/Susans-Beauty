import React from "react";
import SkinTagBadge from "./SkinTagBadge";

export default function ProductKnowledgeBridge({ product, onNavigateTag, onOpenDiagnostic }) {
  if (!product) return null;
  const { activeIngredients = [], targetConcerns = [], seoAnswerCapsule } = product;

  return (
    <div className="mt-6 border-t border-stone-200 pt-5 space-y-4">
      {targetConcerns.length > 0 && (
        <div>
          <span className="block text-xs font-semibold uppercase tracking-wider text-stone-500 mb-1.5">
            Formulated For Concerns
          </span>
          <div className="flex flex-wrap">
            {targetConcerns.map((c) => (
              <SkinTagBadge key={c.slug} type="concern" slug={c.slug} label={c.name || c.slug.replace(/-/g, " ")} onClick={onNavigateTag} />
            ))}
          </div>
        </div>
      )}

      {activeIngredients.length > 0 && (
        <div>
          <span className="block text-xs font-semibold uppercase tracking-wider text-stone-500 mb-1.5">
            Key Active Ingredients
          </span>
          <div className="flex flex-wrap">
            {activeIngredients.map((i) => (
              <SkinTagBadge key={i.slug} type="ingredient" slug={i.slug} label={i.name || i.slug.replace(/-/g, " ")} onClick={onNavigateTag} />
            ))}
          </div>
        </div>
      )}

      {seoAnswerCapsule && (
        <div className="rounded-lg bg-stone-50 p-3.5 border border-stone-200 text-sm text-stone-700">
          <strong className="block text-stone-900 font-medium mb-1">Susan's Formulation Insight:</strong>
          {seoAnswerCapsule}
        </div>
      )}

      <div className="bg-rose-50/60 rounded-lg p-3 text-xs text-rose-900 flex items-center justify-between">
        <span>Not sure if this matches your current skin barrier state?</span>
        <button type="button" onClick={onOpenDiagnostic} className="font-semibold underline ml-2 hover:text-rose-700 shrink-0">
          Take Skin Diagnostic →
        </button>
      </div>
    </div>
  );
}

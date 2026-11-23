import React from "react";

export default function SkinTagBadge({ type = "ingredient", slug, label, onClick }) {
  const path = type === "ingredient" ? `/ingredients/${slug}` : `/concerns/${slug}`;
  const styles =
    type === "ingredient"
      ? "bg-stone-100 text-stone-800 border-stone-300 hover:bg-stone-200"
      : "bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100";

  return (
    <a
      href={path}
      onClick={(e) => {
        if (onClick) {
          e.preventDefault();
          onClick({ type, slug });
        }
      }}
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border transition-colors mr-2 mb-2 ${styles}`}
    >
      <span className="mr-1">{type === "ingredient" ? "🧪" : "✨"}</span>
      {label}
    </a>
  );
}

import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

/**
 * items: [{ label, to? }] — last item has no `to` (current page)
 */
export default function DrillBreadcrumb({ items }) {
  if (!items?.length) return null;
  return (
    <nav className="flex flex-wrap items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400 mb-4" aria-label="Breadcrumb" data-testid="drill-breadcrumb">
      {items.map((it, i) => (
        <React.Fragment key={i}>
          {i > 0 && <ChevronRight className="w-3 h-3 text-zinc-400 flex-shrink-0" aria-hidden />}
          {it.to ? (
            <Link to={it.to} className="font-medium text-blue-700 dark:text-blue-400 hover:underline">
              {it.label}
            </Link>
          ) : (
            <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate max-w-[min(100%,280px)]">{it.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}

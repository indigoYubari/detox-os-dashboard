"use client";

import { useState } from "react";

interface StatTooltipProps {
  explanation: string;
  children: React.ReactNode;
}

export function StatTooltip({ explanation, children }: StatTooltipProps) {
  const [visible, setVisible] = useState(false);

  return (
    <span className="relative inline-flex items-center gap-1">
      {children}
      <button
        type="button"
        aria-label="Forklaring"
        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 text-gray-500 text-[10px] font-bold hover:bg-gray-300 transition-colors flex-shrink-0"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
      >
        ?
      </button>
      {visible && (
        <span
          role="tooltip"
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 rounded-lg bg-gray-900 text-white text-xs px-3 py-2 shadow-lg pointer-events-none"
        >
          {explanation}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </span>
      )}
    </span>
  );
}

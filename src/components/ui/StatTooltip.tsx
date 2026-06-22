"use client"

import { useState, useRef, useEffect } from "react"
import { createPortal } from "react-dom"

interface StatTooltipProps {
  explanation: string
  children: React.ReactNode
}

export function StatTooltip({ explanation, children }: StatTooltipProps) {
  const [visible, setVisible] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  function show() {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setCoords({
        top: r.top + window.scrollY - 8,
        left: r.left + r.width / 2 + window.scrollX,
      })
    }
    setVisible(true)
  }

  return (
    <span className="relative inline-flex items-center gap-1">
      {children}
      <button
        ref={btnRef}
        type="button"
        aria-label="Forklaring"
        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 text-gray-500 text-[10px] font-bold hover:bg-gray-300 transition-colors flex-shrink-0"
        onMouseEnter={show}
        onMouseLeave={() => setVisible(false)}
        onFocus={show}
        onBlur={() => setVisible(false)}
      >
        ?
      </button>
      {mounted && visible && createPortal(
        <span
          role="tooltip"
          className="absolute z-[9999] w-56 rounded-lg bg-gray-900 text-white text-xs px-3 py-2 shadow-lg pointer-events-none"
          style={{
            top: coords.top,
            left: coords.left,
            transform: "translate(-50%, -100%)",
            position: "absolute",
          }}
        >
          {explanation}
        </span>,
        document.body
      )}
    </span>
  )
}

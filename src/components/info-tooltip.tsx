"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/** Кружок «i»: при наведении показывает пояснение у курсора. */
export function InfoTooltip({ text }: { text: string }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  function show(x: number, y: number) {
    const width = 320;
    const left = Math.min(Math.max(8, x + 14), window.innerWidth - width - 8);
    const top = Math.min(Math.max(8, y + 16), window.innerHeight - 160);
    setPos({ x: left, y: top });
  }

  return (
    <>
      <span
        role="button"
        tabIndex={0}
        aria-label={text}
        title={text}
        onMouseEnter={(e) => show(e.clientX, e.clientY)}
        onMouseMove={(e) => show(e.clientX, e.clientY)}
        onMouseLeave={() => setPos(null)}
        onFocus={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          show(rect.left, rect.bottom);
        }}
        onBlur={() => setPos(null)}
        className="ml-1 inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-ink-700 align-middle text-[10px] text-slate-500 outline-none transition-colors hover:border-accent/60 hover:text-accent focus:border-accent/60"
      >
        i
      </span>

      {mounted && pos
        ? createPortal(
            <div
              style={{ left: pos.x, top: pos.y, width: 320 }}
              className="pointer-events-none fixed z-50 rounded-lg border border-ink-700 bg-ink-950/95 p-3 text-xs leading-relaxed text-slate-200 shadow-xl"
            >
              {text}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

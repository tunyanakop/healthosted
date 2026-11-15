"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

const CloseContext = createContext<(() => void) | null>(null);

/** Форма может закрыть свой контейнер после успешного сохранения. */
export function useFormClose(): (() => void) | null {
  return useContext(CloseContext);
}

export function AddDrawer({
  label,
  children,
  hint,
  defaultOpen = false,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  if (!open) {
    return (
      <div className="mb-4">
        <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
          + {label}
        </button>
        {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
      </div>
    );
  }

  return (
    <section className="mb-4 card">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-medium">{label}</h2>
        <button
          type="button"
          className="text-xs text-slate-400 transition-colors hover:text-accent"
          onClick={() => setOpen(false)}
        >
          закрыть
        </button>
      </div>
      <CloseContext.Provider value={() => setOpen(false)}>{children}</CloseContext.Provider>
    </section>
  );
}

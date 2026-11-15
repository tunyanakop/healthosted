"use client";

import { useState } from "react";

type Check = {
  name: string;
  url: string;
  ok: boolean;
  status: number;
  ms: number;
  error: string | null;
};

export function DiagnoseButton() {
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/environment/diagnose");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Не удалось запустить диагностику");
        return;
      }
      setChecks(data.results ?? []);
    } catch {
      setError("Сеть недоступна");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3">
      <button type="button" className="btn" onClick={run} disabled={busy}>
        {busy ? "Проверяю источники…" : "Проверить источники данных"}
      </button>

      {error ? <p className="mt-2 text-sm text-rose-400">{error}</p> : null}

      {checks ? (
        <ul className="mt-3 space-y-1 text-sm">
          {checks.map((c) => (
            <li key={c.name} className="flex flex-wrap items-baseline justify-between gap-2">
              <span className={c.ok ? "text-slate-300" : "text-rose-300"}>
                {c.ok ? "✓" : "✕"} {c.name}
              </span>
              <span className="text-xs text-slate-500">
                {c.ok ? `HTTP ${c.status}` : c.error} · {c.ms} мс
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {checks && checks.some((c) => !c.ok) ? (
        <p className="mt-2 text-xs text-slate-500">
          Если падают все — сервер не выпускает наружу или блокирует DNS. Если только
          воздух и пыльца — недоступен air-quality-api.open-meteo.com; погода при этом
          подтянется из резервного источника (MET Norway или wttr.in).
        </p>
      ) : null}
    </div>
  );
}

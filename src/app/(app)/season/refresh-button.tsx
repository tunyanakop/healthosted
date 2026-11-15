"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RefreshButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/environment?refresh=1");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Источник недоступен");
        return;
      }
      router.refresh();
    } catch {
      setError("Сеть недоступна");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="flex items-center gap-2">
      <button type="button" className="btn" onClick={refresh} disabled={busy}>
        {busy ? "Обновляю…" : "Обновить данные"}
      </button>
      {error ? <span className="text-xs text-rose-400">{error}</span> : null}
    </span>
  );
}

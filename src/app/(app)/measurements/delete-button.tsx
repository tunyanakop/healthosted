"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (!window.confirm("Удалить запись?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/measurements/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        window.alert(data.error ?? "Не удалось удалить");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="text-xs text-slate-500 transition-colors hover:text-rose-400"
      title="Удалить"
    >
      {busy ? "…" : "удалить"}
    </button>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LabActions({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    if (!window.confirm("Удалить панель со всеми показателями и файлами?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/labs/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        window.alert(data.error ?? "Не удалось удалить");
        return;
      }
      router.push("/labs");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3 text-xs">
      <Link href={`/labs/${id}/edit`} className="text-slate-400 transition-colors hover:text-accent">
        параметры
      </Link>
      <button
        type="button"
        onClick={onDelete}
        disabled={busy}
        className="text-slate-500 transition-colors hover:text-rose-400"
      >
        {busy ? "…" : "удалить"}
      </button>
    </div>
  );
}

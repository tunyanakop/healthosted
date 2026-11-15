"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MEDBOOK_TYPES } from "@/lib/medbook";
import { useFormClose } from "@/components/add-drawer";

export type MedBookInitial = {
  id?: string;
  type: string;
  number: string;
  issuer: string;
  issuedAt: string;
  validUntil: string;
  notes: string;
};

export function MedBookForm({
  initial,
  mode = "create",
}: {
  initial?: MedBookInitial;
  mode?: "create" | "edit";
}) {
  const router = useRouter();
  const close = useFormClose();
  const [form, setForm] = useState<MedBookInitial>(
    initial ?? {
      type: "fluorography",
      number: "",
      issuer: "",
      issuedAt: "",
      validUntil: "",
      notes: "",
    },
  );
  const [status, setStatus] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  function update<K extends keyof MedBookInitial>(field: K, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(mode === "edit" ? `/api/medbook/${form.id}` : "/api/medbook", {
        method: mode === "edit" ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus({ kind: "err", text: data.error ?? "Не удалось сохранить" });
        return;
      }

      if (mode === "create") {
        setForm({ type: "fluorography", number: "", issuer: "", issuedAt: "", validUntil: "", notes: "" });
        router.refresh();
        if (close) close();
        else setStatus({ kind: "ok", text: "Записано" });
      } else {
        router.push("/medbook");
        router.refresh();
      }
    } catch {
      setStatus({ kind: "err", text: "Сеть недоступна" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="type">Тип документа</label>
          <select
            id="type"
            className="input"
            value={form.type}
            onChange={(e) => update("type", e.target.value)}
          >
            {MEDBOOK_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="number">Номер</label>
          <input
            id="number"
            className="input"
            value={form.number}
            onChange={(e) => update("number", e.target.value)}
            placeholder="необязательно"
          />
        </div>
        <div>
          <label className="label" htmlFor="issuer">Кем выдан</label>
          <input
            id="issuer"
            className="input"
            value={form.issuer}
            onChange={(e) => update("issuer", e.target.value)}
            placeholder="поликлиника, центр"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="issuedAt">Дата выдачи</label>
          <input
            id="issuedAt"
            type="date"
            className="input"
            value={form.issuedAt}
            onChange={(e) => update("issuedAt", e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="validUntil">Действует до</label>
          <input
            id="validUntil"
            type="date"
            className="input"
            value={form.validUntil}
            onChange={(e) => update("validUntil", e.target.value)}
          />
          <p className="mt-1 text-xs text-slate-500">
            Пусто — считается бессрочным (например, прививка из календаря).
          </p>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="notes">Заметки</label>
        <textarea
          id="notes"
          className="input min-h-[72px] resize-y"
          value={form.notes}
          onChange={(e) => update("notes", e.target.value)}
        />
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Сохраняю…" : mode === "edit" ? "Сохранить" : "Добавить документ"}
        </button>
        {status ? (
          <span className={status.kind === "ok" ? "text-sm text-emerald-400" : "text-sm text-rose-400"}>
            {status.text}
          </span>
        ) : null}
      </div>
    </form>
  );
}

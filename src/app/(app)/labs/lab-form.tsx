"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LAB_TEMPLATES } from "@/lib/lab-templates";
import { useFormClose } from "@/components/add-drawer";
import { PanelContextFields, emptyContext, type PanelContext } from "./context-fields";

export type LabPanelInitial = {
  id?: string;
  takenAt: string;
  kind: string;
  labName: string;
  notes: string;
  context?: PanelContext;
};

function today(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export function LabPanelForm({
  initial,
  mode = "create",
  sex = null,
}: {
  initial?: LabPanelInitial;
  mode?: "create" | "edit";
  sex?: string | null;
}) {
  const router = useRouter();
  const close = useFormClose();
  const [form, setForm] = useState<LabPanelInitial>(
    initial ?? { takenAt: today(), kind: "cbc", labName: "", notes: "" },
  );
  const [context, setContext] = useState<PanelContext>(
    initial?.context ?? emptyContext(initial?.kind ?? "cbc"),
  );
  const [status, setStatus] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  function update<K extends keyof LabPanelInitial>(field: K, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(mode === "edit" ? `/api/labs/${form.id}` : "/api/labs", {
        method: mode === "edit" ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          specimen: context.specimen,
          pregnant: context.pregnant,
          trimester: context.pregnant ? context.trimester : "",
          menopause: context.menopause,
          cyclePhase: context.cyclePhase,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus({ kind: "err", text: data.error ?? "Не удалось сохранить" });
        return;
      }

      if (mode === "edit") {
        router.push(`/labs/${form.id}`);
        router.refresh();
      } else {
        router.push(`/labs/${data.item.id}`);
        router.refresh();
      }
      if (close) close();
    } catch {
      setStatus({ kind: "err", text: "Сеть недоступна" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="panel-kind">Тип исследования</label>
          <select
            id="panel-kind"
            className="input"
            value={form.kind}
            onChange={(e) => update("kind", e.target.value)}
          >
            {LAB_TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="panel-lab">Лаборатория</label>
          <input
            id="panel-lab"
            className="input"
            value={form.labName}
            onChange={(e) => update("labName", e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="panel-date">Дата сдачи</label>
          <input
            id="panel-date"
            type="date"
            className="input"
            value={form.takenAt}
            onChange={(e) => update("takenAt", e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="panel-notes">Заметка</label>
          <input
            id="panel-notes"
            className="input"
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
          />
        </div>
      </div>

      <PanelContextFields sex={sex} value={context} onChange={setContext} />

      <div className="flex items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Сохраняю…" : "Сохранить"}
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

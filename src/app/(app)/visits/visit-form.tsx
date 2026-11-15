"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useFormClose } from "@/components/add-drawer";

export type VisitInitial = {
  id?: string;
  visitedAt: string;
  doctorName: string;
  specialty: string;
  clinic: string;
  reason: string;
  diagnosis: string;
  conclusion: string;
  recommendations: string;
  conditionId: string;
};

export type ConditionOption = { id: string; title: string };

function today(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export function VisitForm({
  conditions,
  initial,
  mode = "create",
}: {
  conditions: ConditionOption[];
  initial?: VisitInitial;
  mode?: "create" | "edit";
}) {
  const router = useRouter();
  const close = useFormClose();
  const [form, setForm] = useState<VisitInitial>(
    initial ?? {
      visitedAt: today(),
      doctorName: "",
      specialty: "",
      clinic: "",
      reason: "",
      diagnosis: "",
      conclusion: "",
      recommendations: "",
      conditionId: "",
    },
  );
  const [status, setStatus] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  function update<K extends keyof VisitInitial>(field: K, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(mode === "edit" ? `/api/visits/${form.id}` : "/api/visits", {
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
        setForm((prev) => ({
          ...prev,
          doctorName: "",
          reason: "",
          diagnosis: "",
          conclusion: "",
          recommendations: "",
        }));
        router.refresh();
        if (close) close();
        else setStatus({ kind: "ok", text: "Визит записан" });
      } else {
        router.push("/visits");
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
          <label className="label" htmlFor="visitedAt">Дата</label>
          <input
            id="visitedAt"
            type="date"
            className="input"
            value={form.visitedAt}
            onChange={(e) => update("visitedAt", e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="doctorName">Врач</label>
          <input
            id="doctorName"
            className="input"
            value={form.doctorName}
            onChange={(e) => update("doctorName", e.target.value)}
            placeholder="Иванов И. И."
          />
        </div>
        <div>
          <label className="label" htmlFor="specialty">Специальность</label>
          <input
            id="specialty"
            className="input"
            value={form.specialty}
            onChange={(e) => update("specialty", e.target.value)}
            placeholder="терапевт"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="clinic">Клиника</label>
          <input
            id="clinic"
            className="input"
            value={form.clinic}
            onChange={(e) => update("clinic", e.target.value)}
            placeholder="поликлиника №1"
          />
        </div>
        <div>
          <label className="label" htmlFor="conditionId">Связанное состояние</label>
          <select
            id="conditionId"
            className="input"
            value={form.conditionId}
            onChange={(e) => update("conditionId", e.target.value)}
          >
            <option value="">— не связано —</option>
            {conditions.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="reason">Причина обращения</label>
        <input
          id="reason"
          className="input"
          value={form.reason}
          onChange={(e) => update("reason", e.target.value)}
          placeholder="боль в животе, плановый осмотр…"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="diagnosis">Диагноз</label>
          <input
            id="diagnosis"
            className="input"
            value={form.diagnosis}
            onChange={(e) => update("diagnosis", e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="conclusion">Заключение</label>
          <input
            id="conclusion"
            className="input"
            value={form.conclusion}
            onChange={(e) => update("conclusion", e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="recommendations">Назначения и рекомендации</label>
        <textarea
          id="recommendations"
          className="input min-h-[88px] resize-y"
          value={form.recommendations}
          onChange={(e) => update("recommendations", e.target.value)}
          placeholder="препараты, дозировки, повторный приём"
        />
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Сохраняю…" : mode === "edit" ? "Сохранить" : "Добавить визит"}
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

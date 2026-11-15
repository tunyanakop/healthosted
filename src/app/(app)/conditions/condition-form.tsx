"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { STATUSES } from "@/lib/conditions";
import { VIRUS_KINDS } from "@/lib/season";
import { useFormClose } from "@/components/add-drawer";

export type ConditionInitial = {
  id?: string;
  title: string;
  icd10: string;
  status: string;
  onsetAt: string;
  resolvedAt: string;
  notes: string;
  seasonalKind: string;
  severity: string;
};

const EMPTY: ConditionInitial = {
  title: "",
  icd10: "",
  status: "active",
  onsetAt: "",
  resolvedAt: "",
  notes: "",
  seasonalKind: "",
  severity: "moderate",
};

export function ConditionForm({
  initial,
  mode = "create",
  presetSeasonal = false,
}: {
  initial?: ConditionInitial;
  mode?: "create" | "edit";
  presetSeasonal?: boolean;
}) {
  const router = useRouter();
  const close = useFormClose();

  const [form, setForm] = useState<ConditionInitial>(() => {
    if (initial) return initial;
    if (presetSeasonal) {
      return { ...EMPTY, title: VIRUS_KINDS.arvi, seasonalKind: "arvi", status: "active" };
    }
    return EMPTY;
  });
  const [status, setStatus] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  function update<K extends keyof ConditionInitial>(field: K, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function toggleSeasonal(checked: boolean) {
    setForm((prev) => {
      if (!checked) return { ...prev, seasonalKind: "", severity: "moderate" };
      const kind = prev.seasonalKind || "arvi";
      const title =
        prev.title.trim() === "" || Object.values(VIRUS_KINDS).includes(prev.title)
          ? VIRUS_KINDS[kind] ?? prev.title
          : prev.title;
      return { ...prev, seasonalKind: kind, title };
    });
  }

  function changeVirusKind(next: string) {
    setForm((prev) => {
      const shouldRename = prev.title.trim() === "" || Object.values(VIRUS_KINDS).includes(prev.title);
      return {
        ...prev,
        seasonalKind: next,
        title: shouldRename ? (VIRUS_KINDS[next] ?? prev.title) : prev.title,
      };
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);

    const payload = {
      title: form.title,
      icd10: form.icd10,
      status: form.status,
      onsetAt: form.onsetAt,
      resolvedAt: form.resolvedAt,
      notes: form.notes,
      seasonalKind: form.seasonalKind,
      severity: form.seasonalKind ? form.severity : "",
    };

    try {
      const res = await fetch(
        mode === "edit" ? `/api/conditions/${form.id}` : "/api/conditions",
        {
          method: mode === "edit" ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus({ kind: "err", text: data.error ?? "Не удалось сохранить" });
        return;
      }

      if (mode === "create") {
        setForm(EMPTY);
        router.refresh();
        if (close) close();
        else setStatus({ kind: "ok", text: "Записано" });
      } else {
        router.push("/conditions");
        router.refresh();
      }
    } catch {
      setStatus({ kind: "err", text: "Сеть недоступна" });
    } finally {
      setBusy(false);
    }
  }

  const seasonal = form.seasonalKind !== "";

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <div>
          <label className="label" htmlFor="title">Название</label>
          <input
            id="title"
            className="input"
            value={form.title}
            onChange={(e) => update("title", e.target.value)}
            placeholder="Гастрит, мигрень, перелом…"
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="icd10">МКБ-10</label>
          <input
            id="icd10"
            className="input"
            value={form.icd10}
            onChange={(e) => update("icd10", e.target.value.toUpperCase())}
            placeholder="K29.7"
            maxLength={12}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="status">Статус</label>
          <select
            id="status"
            className="input"
            value={form.status}
            onChange={(e) => update("status", e.target.value)}
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="onsetAt">Начало</label>
          <input
            id="onsetAt"
            type="date"
            className="input"
            value={form.onsetAt}
            onChange={(e) => update("onsetAt", e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="resolvedAt">Окончание</label>
          <input
            id="resolvedAt"
            type="date"
            className="input"
            value={form.resolvedAt}
            onChange={(e) => update("resolvedAt", e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-lg border border-ink-800 p-3">
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={seasonal}
            onChange={(e) => toggleSeasonal(e.target.checked)}
          />
          сезонная инфекция (ОРВИ, грипп, COVID) — учитывается в прогнозе риска
        </label>

        {seasonal ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="seasonalKind">Что было</label>
              <select
                id="seasonalKind"
                className="input"
                value={form.seasonalKind}
                onChange={(e) => changeVirusKind(e.target.value)}
              >
                {Object.entries(VIRUS_KINDS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="severity">Тяжесть</label>
              <select
                id="severity"
                className="input"
                value={form.severity}
                onChange={(e) => update("severity", e.target.value)}
              >
                <option value="mild">лёгкая</option>
                <option value="moderate">средняя</option>
                <option value="severe">тяжёлая</option>
              </select>
            </div>
          </div>
        ) : null}
      </div>

      <div>
        <label className="label" htmlFor="notes">Заметки</label>
        <textarea
          id="notes"
          className="input min-h-[88px] resize-y"
          value={form.notes}
          onChange={(e) => update("notes", e.target.value)}
          placeholder="Обстоятельства, назначения, наблюдения"
        />
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Сохраняю…" : mode === "edit" ? "Сохранить" : "Добавить"}
        </button>
        {mode === "edit" ? (
          <button type="button" className="btn" onClick={() => router.push("/conditions")}>
            Отмена
          </button>
        ) : null}
        {status ? (
          <span className={status.kind === "ok" ? "text-sm text-emerald-400" : "text-sm text-rose-400"}>
            {status.text}
          </span>
        ) : null}
      </div>
    </form>
  );
}

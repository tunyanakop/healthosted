"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export type AllergyItem = {
  id: string;
  name: string;
  category: string;
  severity: string;
  months: string | null;
  notes: string | null;
  active: boolean;
};

export const CATEGORY_LABEL: Record<string, string> = {
  pollen: "пыльца",
  mold: "плесень",
  dust: "пыль",
  animal: "животные",
  food: "еда",
  medication: "лекарства",
  other: "другое",
};

export const SEVERITY_LABEL: Record<string, string> = {
  mild: "лёгкая",
  moderate: "средняя",
  severe: "тяжёлая",
};

const MONTHS_SHORT = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

function monthsText(months: string | null): string {
  if (!months) return "круглый год";
  return months
    .split(",")
    .map((m) => MONTHS_SHORT[Number(m) - 1])
    .filter(Boolean)
    .join(", ");
}

export function AllergiesEditor({ items }: { items: AllergyItem[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("pollen");
  const [severity, setSeverity] = useState("moderate");
  const [months, setMonths] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  function toggleMonth(m: number) {
    setMonths((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m].sort((a, b) => a - b)));
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/allergies", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          category,
          severity,
          months: months.join(","),
          active: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Не удалось добавить");
        return;
      }
      setName("");
      setMonths([]);
      setShowForm(false);
      router.refresh();
    } catch {
      setError("Сеть недоступна");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Удалить аллерген?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/allergies/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Не удалось удалить");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(item: AllergyItem) {
    setBusy(true);
    try {
      const res = await fetch(`/api/allergies/${item.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: item.name,
          category: item.category,
          severity: item.severity,
          months: item.months ?? "",
          notes: item.notes ?? "",
          active: !item.active,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Не удалось изменить");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {items.length === 0 ? (
        <p className="muted">Аллергии не указаны. Добавь — и появится персональный прогноз.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className={a.active ? "" : "text-slate-500 line-through"}>
                {a.name}
                <span className="ml-2 text-xs text-slate-500">
                  {CATEGORY_LABEL[a.category] ?? a.category} · {SEVERITY_LABEL[a.severity] ?? a.severity} ·{" "}
                  {monthsText(a.months)}
                </span>
              </span>
              <span className="flex items-center gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => toggleActive(a)}
                  disabled={busy}
                  className="text-slate-500 hover:text-accent"
                >
                  {a.active ? "скрыть" : "вернуть"}
                </button>
                <button
                  type="button"
                  onClick={() => remove(a.id)}
                  disabled={busy}
                  className="text-slate-500 hover:text-rose-400"
                >
                  удалить
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {showForm ? (
      <form onSubmit={add} className="border-t border-ink-800 pt-4">
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
          <div>
            <label className="label" htmlFor="allergy-name">Аллерген</label>
            <input
              id="allergy-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="берёза, кошки, пенициллин"
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="allergy-category">Тип</label>
            <select
              id="allergy-category"
              className="input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="allergy-severity">Тяжесть</label>
            <select
              id="allergy-severity"
              className="input"
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
            >
              {Object.entries(SEVERITY_LABEL).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3">
          <span className="label">Месяцы обострения (пусто — круглый год)</span>
          <div className="flex flex-wrap gap-1">
            {MONTHS_SHORT.map((m, i) => {
              const value = i + 1;
              const on = months.includes(value);
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => toggleMonth(value)}
                  className={`rounded border px-2 py-1 text-xs transition-colors ${
                    on
                      ? "border-accent/60 bg-accent/15 text-accent"
                      : "border-ink-700 text-slate-400 hover:border-accent/40"
                  }`}
                >
                  {m}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Сохраняю…" : "Добавить аллергию"}
          </button>
          {error ? <span className="text-sm text-rose-400">{error}</span> : null}
        </div>
      </form>
      ) : (
        <button type="button" className="btn btn-primary" onClick={() => setShowForm(true)}>
          + добавить аллергию
        </button>
      )}
    </div>
  );
}

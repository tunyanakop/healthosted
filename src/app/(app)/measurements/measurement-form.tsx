"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { KINDS } from "@/lib/measurements";
import { useFormClose } from "@/components/add-drawer";

function todayLocal(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export function MeasurementForm() {
  const router = useRouter();
  const close = useFormClose();
  const [kind, setKind] = useState("weight");
  const [value, setValue] = useState("");
  const [value2, setValue2] = useState("");
  const [measuredAt, setMeasuredAt] = useState(todayLocal());
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const meta = KINDS.find((k) => k.kind === kind) ?? KINDS[0];

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/measurements", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, value, value2, measuredAt, note }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus({ kind: "err", text: data.error ?? "Не удалось сохранить" });
        return;
      }
      setValue("");
      setValue2("");
      setNote("");
      router.refresh();
      if (close) close();
      else setStatus({ kind: "ok", text: "Записано" });
    } catch {
      setStatus({ kind: "err", text: "Сеть недоступна" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="kind">Показатель</label>
          <select
            id="kind"
            className="input"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value);
              setValue2("");
            }}
          >
            {KINDS.map((k) => (
              <option key={k.kind} value={k.kind}>{k.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="measuredAt">Дата</label>
          <input
            id="measuredAt"
            type="date"
            className="input"
            value={measuredAt}
            onChange={(e) => setMeasuredAt(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="value">
            {meta.secondary ? "Систолическое" : "Значение"} ({meta.unit})
          </label>
          <input
            id="value"
            type="number"
            inputMode="decimal"
            step={meta.step}
            min={meta.min}
            max={meta.max}
            className="input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            required
          />
        </div>

        {meta.secondary ? (
          <div>
            <label className="label" htmlFor="value2">Диастолическое ({meta.secondUnit})</label>
            <input
              id="value2"
              type="number"
              inputMode="decimal"
              step={1}
              min={20}
              max={200}
              className="input"
              value={value2}
              onChange={(e) => setValue2(e.target.value)}
              required
            />
          </div>
        ) : null}
      </div>

      <div>
        <label className="label" htmlFor="note">Заметка</label>
        <input
          id="note"
          className="input"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="необязательно"
        />
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Сохраняю…" : "Добавить"}
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

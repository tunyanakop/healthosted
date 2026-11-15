"use client";

import { useState } from "react";

type Initial = {
  email: string;
  name: string;
  birthDate: string;
  sex: string;
  bloodType: string;
};

export function ProfileForm({ initial }: { initial: Initial }) {
  const [form, setForm] = useState(initial);
  const [status, setStatus] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  function update(field: keyof Initial, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          birthDate: form.birthDate,
          sex: form.sex,
          bloodType: form.bloodType,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus({ kind: "err", text: data.error ?? "Не удалось сохранить" });
      } else {
        setStatus({ kind: "ok", text: "Сохранено" });
      }
    } catch {
      setStatus({ kind: "err", text: "Сеть недоступна" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" className="input" value={form.email} disabled />
      </div>
      <div>
        <label className="label" htmlFor="name">Имя</label>
        <input
          id="name"
          className="input"
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
          autoComplete="name"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="birthDate">Дата рождения</label>
          <input
            id="birthDate"
            type="date"
            className="input"
            value={form.birthDate}
            onChange={(e) => update("birthDate", e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="sex">Пол</label>
          <select
            id="sex"
            className="input"
            value={form.sex}
            onChange={(e) => update("sex", e.target.value)}
          >
            <option value="">не указан</option>
            <option value="male">мужской</option>
            <option value="female">женский</option>
            <option value="other">другой</option>
          </select>
        </div>
      </div>
      <div>
        <label className="label" htmlFor="bloodType">Группа крови</label>
        <select
          id="bloodType"
          className="input"
          value={form.bloodType}
          onChange={(e) => update("bloodType", e.target.value)}
        >
          <option value="">не указана</option>
          <option value="O(I)">O(I)</option>
          <option value="A(II)">A(II)</option>
          <option value="B(III)">B(III)</option>
          <option value="AB(IV)">AB(IV)</option>
        </select>
      </div>

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

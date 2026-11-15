"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Settings = {
  latitude: number | null;
  longitude: number | null;
  locationName: string | null;
  envEnabled: boolean;
  incidence: string | null;
};

type Found = { name: string; country: string | null; admin: string | null; lat: number; lon: number };

export function EnvironmentSettings({ initial }: { initial: Settings }) {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings>(initial);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Found[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResults([]);
    try {
      const res = await fetch(`/api/location/search?q=${encodeURIComponent(query)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Не удалось найти город");
        return;
      }
      setResults(data.results ?? []);
      if ((data.results ?? []).length === 0) setError("Ничего не найдено");
    } catch {
      setError("Сеть недоступна");
    } finally {
      setBusy(false);
    }
  }

  async function save(next: Partial<Settings> & { latitude: number; longitude: number }) {
    setBusy(true);
    setError(null);
    try {
      const payload = {
        latitude: next.latitude,
        longitude: next.longitude,
        locationName: next.locationName ?? settings.locationName ?? "",
        envEnabled: next.envEnabled ?? settings.envEnabled,
        incidence: next.incidence === undefined ? settings.incidence ?? "" : next.incidence,
      };
      const res = await fetch("/api/environment", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Не удалось сохранить");
        return;
      }
      setSettings(data.settings);
      setResults([]);
      setQuery("");
      setSaved("Сохранено");
      router.refresh();
    } catch {
      setError("Сеть недоступна");
    } finally {
      setBusy(false);
    }
  }

  const hasLocation = settings.latitude != null && settings.longitude != null;

  return (
    <div className="space-y-4">
      <form onSubmit={search} className="flex flex-wrap items-end gap-2">
        <div className="min-w-[200px] flex-1">
          <label className="label" htmlFor="city">Город</label>
          <input
            id="city"
            className="input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ереван, Москва, Берлин…"
          />
        </div>
        <button type="submit" className="btn" disabled={busy || query.trim().length < 2}>
          {busy ? "Ищу…" : "Найти"}
        </button>
      </form>

      {results.length > 0 ? (
        <ul className="space-y-1">
          {results.map((r) => (
            <li key={`${r.lat},${r.lon}`}>
              <button
                type="button"
                className="btn w-full justify-start"
                disabled={busy}
                onClick={() =>
                  save({
                    latitude: r.lat,
                    longitude: r.lon,
                    locationName: [r.name, r.admin, r.country].filter(Boolean).join(", "),
                    envEnabled: true,
                  })
                }
              >
                {r.name}
                <span className="ml-2 text-xs text-slate-500">
                  {[r.admin, r.country].filter(Boolean).join(", ")} · {r.lat.toFixed(2)}, {r.lon.toFixed(2)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {hasLocation ? (
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="text-slate-300">
            {settings.locationName ?? "локация задана"}{" "}
            <span className="text-xs text-slate-500">
              ({settings.latitude!.toFixed(2)}, {settings.longitude!.toFixed(2)})
            </span>
          </span>

          <label className="flex items-center gap-2 text-slate-400">
            <input
              type="checkbox"
              checked={settings.envEnabled}
              disabled={busy}
              onChange={(e) =>
                save({
                  latitude: settings.latitude!,
                  longitude: settings.longitude!,
                  envEnabled: e.target.checked,
                })
              }
            />
            получать данные о среде (Open-Meteo)
          </label>

          <label className="flex items-center gap-2 text-slate-400">
            заболеваемость в городе
            <select
              className="input w-auto py-1"
              value={settings.incidence ?? ""}
              disabled={busy}
              onChange={(e) =>
                save({
                  latitude: settings.latitude!,
                  longitude: settings.longitude!,
                  incidence: e.target.value,
                })
              }
            >
              <option value="">не указана</option>
              <option value="low">низкая</option>
              <option value="medium">средняя</option>
              <option value="high">высокая</option>
            </select>
          </label>
        </div>
      ) : (
        <p className="text-xs text-slate-500">
          Пока локация не задана, риск считается только по сезону и твоей истории.
        </p>
      )}

      {error ? <p className="text-sm text-rose-400">{error}</p> : null}
      {saved ? <p className="text-sm text-emerald-400">{saved}</p> : null}

      <p className="text-xs text-slate-500">
        Запросы к Open-Meteo уходят с координатами и IP сервера. Данные о твоём здоровье
        наружу не передаются — только координаты города.
      </p>
    </div>
  );
}

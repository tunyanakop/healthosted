import "server-only";
import dns from "node:dns";
import { prisma } from "@/lib/db";

// В контейнерах без IPv6 резолв AAAA-первым даёт таймауты на connect.
try {
  dns.setDefaultResultOrder("ipv4first");
} catch {
  // среда без поддержки опции — не критично
}

export type Pollen = {
  alder: number | null;
  birch: number | null;
  grass: number | null;
  mugwort: number | null;
  olive: number | null;
  ragweed: number | null;
};

export type EnvSource = "open-meteo" | "met.no" | "wttr.in";

export type EnvData = {
  fetchedAt: string;
  temperature: number | null;
  apparent: number | null;
  humidity: number | null;
  precipitation: number | null;
  windSpeed: number | null;
  weatherCode: number | null;
  weatherLabel?: string | null;
  aqi: number | null;
  pm25: number | null;
  pm10: number | null;
  ozone: number | null;
  pollen: Pollen;
  pollenAvailable: boolean;
  sources?: { weather: EnvSource | null; air: EnvSource | null };
};

export const POLLEN_LABEL: Record<keyof Pollen, string> = {
  alder: "ольха",
  birch: "берёза",
  grass: "злаки",
  mugwort: "полынь",
  olive: "олива",
  ragweed: "амброзия",
};

export const SOURCE_LABEL: Record<EnvSource, string> = {
  "open-meteo": "Open-Meteo",
  "met.no": "MET Norway",
  "wttr.in": "wttr.in",
};

const CACHE_TTL_MS = 30 * 60 * 1000;
const TIMEOUT_MS = 10_000;
const USER_AGENT = "HealtHosted/0.4.0 (self-hosted personal health archive)";

export function cacheKey(lat: number, lon: number): string {
  return `${lat.toFixed(3)},${lon.toFixed(3)}`;
}

export function weatherText(code: number | null): string {
  if (code == null) return "нет данных";
  if (code === 0) return "ясно";
  if (code <= 3) return "переменная облачность";
  if (code <= 48) return "туман";
  if (code <= 57) return "морось";
  if (code <= 67) return "дождь";
  if (code <= 77) return "снег";
  if (code <= 82) return "ливень";
  if (code <= 86) return "снегопад";
  return "гроза";
}

export function aqiBand(aqi: number | null): { label: string; tone: "ok" | "warn" | "bad" } | null {
  if (aqi == null) return null;
  if (aqi <= 20) return { label: "хорошо", tone: "ok" };
  if (aqi <= 40) return { label: "приемлемо", tone: "ok" };
  if (aqi <= 60) return { label: "умеренно", tone: "warn" };
  if (aqi <= 80) return { label: "плохо", tone: "bad" };
  return { label: "очень плохо", tone: "bad" };
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function getJson(url: string, headers: Record<string, string> = {}) {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: "application/json", "user-agent": USER_AGENT, ...headers },
      cache: "no-store",
    });
    if (!res.ok) return { ok: false as const, status: res.status, data: null, error: `HTTP ${res.status}` };
    return { ok: true as const, status: res.status, data: (await res.json()) as Record<string, unknown>, error: null };
  } catch (error) {
    const name = error instanceof Error ? error.name : "Error";
    const message = error instanceof Error ? error.message : String(error);
    const reason = name === "TimeoutError" ? `таймаут ${TIMEOUT_MS / 1000} с` : message;
    return { ok: false as const, status: 0, data: null, error: reason };
  }
}

// ---------- погода ----------

type WeatherSlice = {
  temperature: number | null;
  apparent: number | null;
  humidity: number | null;
  precipitation: number | null;
  windSpeed: number | null;
  weatherCode: number | null;
  weatherLabel: string | null;
};

async function weatherOpenMeteo(lat: number, lon: number): Promise<WeatherSlice | null> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    "&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,wind_speed_10m,weather_code" +
    "&timezone=auto";

  const res = await getJson(url);
  if (!res.ok || !res.data) return null;

  const c = (res.data.current ?? {}) as Record<string, unknown>;
  if (c.temperature_2m === undefined) return null;

  return {
    temperature: num(c.temperature_2m),
    apparent: num(c.apparent_temperature),
    humidity: num(c.relative_humidity_2m),
    precipitation: num(c.precipitation),
    windSpeed: num(c.wind_speed_10m),
    weatherCode: num(c.weather_code),
    weatherLabel: null,
  };
}

const MET_SYMBOL: [RegExp, string][] = [
  [/clearsky/i, "ясно"],
  [/fair/i, "малооблачно"],
  [/partlycloudy/i, "переменная облачность"],
  [/cloudy/i, "облачно"],
  [/fog/i, "туман"],
  [/drizzle/i, "морось"],
  [/rain/i, "дождь"],
  [/sleet/i, "мокрый снег"],
  [/snow/i, "снег"],
  [/thunder/i, "гроза"],
];

function metLabel(symbol: string | null): string | null {
  if (!symbol) return null;
  for (const [re, label] of MET_SYMBOL) if (re.test(symbol)) return label;
  return null;
}

async function weatherMetNo(lat: number, lon: number): Promise<WeatherSlice | null> {
  const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`;
  const res = await getJson(url);
  if (!res.ok || !res.data) return null;

  const properties = res.data.properties as Record<string, unknown> | undefined;
  const series = properties?.timeseries as Record<string, unknown>[] | undefined;
  const first = series?.[0];
  if (!first) return null;

  const data = first.data as Record<string, unknown> | undefined;
  const instant = (data?.instant as Record<string, unknown> | undefined)?.details as
    | Record<string, unknown>
    | undefined;
  if (!instant) return null;

  const nextBlock = (data?.next_1_hours ?? data?.next_6_hours) as
    | Record<string, unknown>
    | undefined;
  const next = nextBlock?.details as Record<string, unknown> | undefined;
  const summary = nextBlock?.summary as Record<string, unknown> | undefined;
  const symbol = typeof summary?.symbol_code === "string" ? summary.symbol_code : null;

  const windMs = num(instant.wind_speed);

  return {
    temperature: num(instant.air_temperature),
    apparent: null,
    humidity: num(instant.relative_humidity),
    precipitation: num(next?.precipitation_amount),
    windSpeed: windMs != null ? Math.round(windMs * 36) / 10 : null,
    weatherCode: null,
    weatherLabel: metLabel(symbol),
  };
}

async function weatherWttr(lat: number, lon: number): Promise<WeatherSlice | null> {
  const url = `https://wttr.in/${lat},${lon}?format=j1`;
  const res = await getJson(url);
  if (!res.ok || !res.data) return null;

  const current = (res.data.current_condition as Record<string, unknown>[] | undefined)?.[0];
  if (!current) return null;

  const desc = (current.weatherDesc as Record<string, unknown>[] | undefined)?.[0]?.value;
  const toNum = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  return {
    temperature: toNum(current.temp_C),
    apparent: toNum(current.FeelsLikeC),
    humidity: toNum(current.humidity),
    precipitation: toNum(current.precipMM),
    windSpeed: toNum(current.windspeedKmph),
    weatherCode: null,
    weatherLabel: typeof desc === "string" ? desc : null,
  };
}

// ---------- воздух и пыльца ----------

type AirSlice = {
  aqi: number | null;
  pm25: number | null;
  pm10: number | null;
  ozone: number | null;
  pollen: Pollen;
};

async function airOpenMeteo(lat: number, lon: number): Promise<AirSlice | null> {
  const url =
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}` +
    "&current=pm10,pm2_5,ozone,european_aqi,alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,olive_pollen,ragweed_pollen";

  const res = await getJson(url);
  if (!res.ok || !res.data) return null;

  const c = (res.data.current ?? {}) as Record<string, unknown>;
  if (c.pm2_5 === undefined && c.european_aqi === undefined) return null;

  return {
    aqi: num(c.european_aqi),
    pm25: num(c.pm2_5),
    pm10: num(c.pm10),
    ozone: num(c.ozone),
    pollen: {
      alder: num(c.alder_pollen),
      birch: num(c.birch_pollen),
      grass: num(c.grass_pollen),
      mugwort: num(c.mugwort_pollen),
      olive: num(c.olive_pollen),
      ragweed: num(c.ragweed_pollen),
    },
  };
}

// ---------- сборка ----------

export async function fetchEnvironment(lat: number, lon: number): Promise<EnvData | null> {
  const airEnabled = process.env.ENV_AIR_PROVIDER !== "none";

  const providers: { source: EnvSource; load: (la: number, lo: number) => Promise<WeatherSlice | null> }[] = [
    { source: "open-meteo", load: weatherOpenMeteo },
    { source: "met.no", load: weatherMetNo },
    { source: "wttr.in", load: weatherWttr },
  ];

  // ENV_WEATHER_PROVIDER=met.no — принудительный выбор, если основной источник блокируется
  const preferred = process.env.ENV_WEATHER_PROVIDER as EnvSource | undefined;
  const ordered = preferred
    ? [
        ...providers.filter((p) => p.source === preferred),
        ...providers.filter((p) => p.source !== preferred),
      ]
    : providers;

  const primary = ordered[0];
  const [firstWeather, air] = await Promise.all([
    primary.load(lat, lon),
    airEnabled ? airOpenMeteo(lat, lon) : Promise.resolve(null),
  ]);

  let weather: WeatherSlice | null = firstWeather;
  let weatherSource: EnvSource | null = firstWeather ? primary.source : null;

  for (const provider of ordered.slice(1)) {
    if (weather) break;
    weather = await provider.load(lat, lon);
    if (weather) weatherSource = provider.source;
  }

  if (!weather && !air) return null;

  const emptyPollen: Pollen = {
    alder: null, birch: null, grass: null, mugwort: null, olive: null, ragweed: null,
  };
  const pollen = air?.pollen ?? emptyPollen;

  return {
    fetchedAt: new Date().toISOString(),
    temperature: weather?.temperature ?? null,
    apparent: weather?.apparent ?? null,
    humidity: weather?.humidity ?? null,
    precipitation: weather?.precipitation ?? null,
    windSpeed: weather?.windSpeed ?? null,
    weatherCode: weather?.weatherCode ?? null,
    weatherLabel: weather?.weatherLabel ?? null,
    aqi: air?.aqi ?? null,
    pm25: air?.pm25 ?? null,
    pm10: air?.pm10 ?? null,
    ozone: air?.ozone ?? null,
    pollen,
    pollenAvailable: Object.values(pollen).some((v) => v != null && v > 0),
    sources: { weather: weatherSource, air: air ? "open-meteo" : null },
  };
}

export type EnvResult = {
  env: EnvData;
  cached: boolean;
  stale: boolean;
  updatedAt: string;
};

export async function getEnvironment(
  lat: number,
  lon: number,
  options: { force?: boolean } = {},
): Promise<EnvResult | null> {
  const key = cacheKey(lat, lon);
  const row = await prisma.envCache.findUnique({ where: { key } });

  const fresh = row && Date.now() - row.fetchedAt.getTime() < CACHE_TTL_MS && !options.force;

  if (row && fresh) {
    try {
      return {
        env: JSON.parse(row.payload) as EnvData,
        cached: true,
        stale: false,
        updatedAt: row.fetchedAt.toISOString(),
      };
    } catch {
      // битый кэш — перезапрашиваем
    }
  }

  const env = await fetchEnvironment(lat, lon);

  if (!env) {
    if (row) {
      try {
        return {
          env: JSON.parse(row.payload) as EnvData,
          cached: true,
          stale: true,
          updatedAt: row.fetchedAt.toISOString(),
        };
      } catch {
        return null;
      }
    }
    return null;
  }

  await prisma.envCache
    .upsert({
      where: { key },
      create: { key, fetchedAt: new Date(), payload: JSON.stringify(env) },
      update: { fetchedAt: new Date(), payload: JSON.stringify(env) },
    })
    .catch(() => undefined);

  return { env, cached: false, stale: false, updatedAt: env.fetchedAt };
}

export async function searchLocation(query: string): Promise<
  { name: string; country: string | null; admin: string | null; lat: number; lon: number }[]
> {
  const url =
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}` +
    "&count=5&language=ru&format=json";

  const res = await getJson(url);
  const results = Array.isArray(res.data?.results) ? (res.data.results as Record<string, unknown>[]) : [];

  return results
    .map((r) => ({
      name: String(r.name ?? ""),
      country: (r.country as string | null) ?? null,
      admin: (r.admin1 as string | null) ?? null,
      lat: Number(r.latitude),
      lon: Number(r.longitude),
    }))
    .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lon) && r.name);
}

export type ProviderCheck = {
  name: string;
  url: string;
  ok: boolean;
  status: number;
  ms: number;
  error: string | null;
};

/** Диагностика: кто именно недоступен с этого сервера и почему. */
export async function diagnoseProviders(lat: number, lon: number): Promise<ProviderCheck[]> {
  const checks: { name: string; url: string }[] = [
    {
      name: "Open-Meteo погода",
      url: `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m`,
    },
    {
      name: "Open-Meteo воздух/пыльца",
      url: `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi`,
    },
    {
      name: "Open-Meteo геокодинг",
      url: "https://geocoding-api.open-meteo.com/v1/search?name=Moscow&count=1&language=ru",
    },
    {
      name: "MET Norway (резерв погоды)",
      url: `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`,
    },
    {
      name: "wttr.in (резерв погоды)",
      url: `https://wttr.in/${lat},${lon}?format=j1`,
    },
  ];

  const results = await Promise.all(
    checks.map(async (check) => {
      const started = Date.now();
      try {
        const res = await fetch(check.url, {
          signal: AbortSignal.timeout(TIMEOUT_MS),
          headers: { accept: "application/json", "user-agent": USER_AGENT },
          cache: "no-store",
        });
        return {
          name: check.name,
          url: check.url,
          ok: res.ok,
          status: res.status,
          ms: Date.now() - started,
          error: res.ok ? null : `HTTP ${res.status}`,
        };
      } catch (error) {
        const name = error instanceof Error ? error.name : "Error";
        const message = error instanceof Error ? error.message : String(error);
        return {
          name: check.name,
          url: check.url,
          ok: false,
          status: 0,
          ms: Date.now() - started,
          error:
            name === "TimeoutError"
              ? `таймаут ${TIMEOUT_MS / 1000} с`
              : message.slice(0, 200),
        };
      }
    }),
  );

  return results;
}

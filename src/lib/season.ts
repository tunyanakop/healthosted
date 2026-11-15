/**
 * Персональная модель сезонного риска.
 *
 * Это НЕ медицинский прогноз и не эпидемиологические данные: бесплатного источника
 * заболеваемости по региону нет. Модель складывает известные факторы (сезонность,
 * время с последней болезни, возраст, хронические состояния, вакцинация, среда)
 * и показывает вклад каждого — чтобы решение принимал человек, а не «чёрный ящик».
 */

export type Band = "low" | "moderate" | "high";
export type Factor = { label: string; delta: number; note?: string };
export type Risk = {
  score: number;
  band: Band;
  factors: Factor[];
  advice: string[];
};

export type EnvInput = {
  temperature: number | null;
  humidity: number | null;
  precipitation: number | null;
  windSpeed: number | null;
  pm25: number | null;
  aqi: number | null;
  pollen: Record<string, number | null>;
  pollenAvailable: boolean;
} | null;

/** Базовая сезонность ОРВИ/гриппа для умеренного климата, 0–100. Январь → декабрь. */
export const MONTH_BASE = [58, 52, 43, 32, 22, 14, 10, 12, 21, 34, 46, 54];

export const MONTH_LABEL = [
  "январь", "февраль", "март", "апрель", "май", "июнь",
  "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь",
];

export const BAND_META: Record<Band, { label: string; text: string; badge: string; bar: string }> = {
  low: {
    label: "низкий",
    text: "text-emerald-300",
    badge: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
    bar: "bg-emerald-400",
  },
  moderate: {
    label: "умеренный",
    text: "text-amber-300",
    badge: "border-amber-500/40 bg-amber-500/10 text-amber-300",
    bar: "bg-amber-400",
  },
  high: {
    label: "высокий",
    text: "text-rose-300",
    badge: "border-rose-500/40 bg-rose-500/10 text-rose-300",
    bar: "bg-rose-400",
  },
};

export function bandOf(score: number): Band {
  if (score < 30) return "low";
  if (score < 60) return "moderate";
  return "high";
}

export const VIRUS_KINDS: Record<string, string> = {
  flu: "грипп",
  arvi: "ОРВИ",
  covid: "COVID-19",
  other: "другое",
};

export function daysBetween(a: Date, b: Date): number {
  return Math.floor(Math.abs(b.getTime() - a.getTime()) / 86_400_000);
}

export function ageOf(birthDate: Date | null, now: Date): number | null {
  if (!birthDate) return null;
  let years = now.getFullYear() - birthDate.getFullYear();
  const m = now.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) years -= 1;
  return years >= 0 ? years : null;
}

export type VirusInput = {
  now: Date;
  birthDate: Date | null;
  episodes: { kind: string; startedAt: Date }[];
  chronicActive: number;
  vaccinatedRecent: boolean;
  env: EnvInput;
  incidence: string | null; // low | medium | high
};

export function computeVirusRisk(input: VirusInput): Risk {
  const { now, episodes, env } = input;
  const month = now.getMonth();
  const factors: Factor[] = [];

  const base = MONTH_BASE[month];
  factors.push({
    label: `сезон (${MONTH_LABEL[month]})`,
    delta: base,
    note: "базовая сезонность ОРВИ в умеренном климате",
  });

  let score = base;

  const last = [...episodes].sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())[0];
  if (last) {
    const days = daysBetween(last.startedAt, now);
    const kind = VIRUS_KINDS[last.kind] ?? last.kind;
    if (days < 120) {
      score *= 0.6;
      factors.push({
        label: `${kind} ${days} дн. назад`,
        delta: -Math.round(base * 0.4),
        note: "недавняя болезнь — иммунитет ещё свежий",
      });
    } else if (days < 240) {
      score *= 0.8;
      factors.push({
        label: `${kind} ${days} дн. назад`,
        delta: -Math.round(base * 0.2),
        note: "иммунитет частично сохраняется",
      });
    } else {
      factors.push({
        label: `последняя болезнь ${Math.round(days / 30)} мес. назад`,
        delta: 0,
        note: "защита после перенесённой инфекции уже не учитывается",
      });
    }
  } else {
    factors.push({ label: "болезней в архиве нет", delta: 0, note: "нет данных о перенесённых ОРВИ" });
  }

  const age = ageOf(input.birthDate, now);
  if (age != null) {
    if (age < 5) {
      score += 8;
      factors.push({ label: `возраст ${age}`, delta: 8, note: "дети болеют чаще" });
    } else if (age >= 65) {
      score += 8;
      factors.push({ label: `возраст ${age}`, delta: 8, note: "старший возраст — выше риск тяжёлого течения" });
    }
  }

  if (input.chronicActive > 0) {
    const delta = Math.min(12, input.chronicActive * 3);
    score += delta;
    factors.push({
      label: `активных состояний: ${input.chronicActive}`,
      delta,
      note: "хронические болезни повышают риск осложнений",
    });
  }

  if (input.vaccinatedRecent) {
    score -= 12;
    factors.push({ label: "вакцинация за последний год", delta: -12, note: "снижает риск и тяжесть" });
  }

  if (env) {
    if (env.temperature != null && env.temperature < 5) {
      score += 5;
      factors.push({ label: `на улице ${Math.round(env.temperature)}°C`, delta: 5, note: "холодный воздух и скученность в помещениях" });
    }
    if (env.humidity != null && env.humidity < 35) {
      score += 5;
      factors.push({ label: `влажность ${Math.round(env.humidity)}%`, delta: 5, note: "сухой воздух хуже для слизистых" });
    }
    if (env.pm25 != null && env.pm25 > 25) {
      score += 4;
      factors.push({ label: `PM2.5 ${Math.round(env.pm25)} мкг/м³`, delta: 4, note: "загрязнённый воздух раздражает дыхательные пути" });
    }
  }

  if (input.incidence === "medium") {
    score += 8;
    factors.push({ label: "заболеваемость в городе: средняя", delta: 8, note: "указано вручную" });
  } else if (input.incidence === "high") {
    score += 18;
    factors.push({ label: "заболеваемость в городе: высокая", delta: 18, note: "указано вручную" });
  }

  const clamped = Math.max(5, Math.min(95, Math.round(score)));
  const band = bandOf(clamped);

  const advice: string[] = [];
  if (band === "high") {
    advice.push("В транспорте и людных местах — маска, руки мыть или антисептик после улицы.");
    advice.push("Проветривать комнаты 2–3 раза в день по 10 минут, не сушить воздух отоплением.");
    advice.push("При первых симптомах — остаться дома и не идти «на ногах»: так меньше осложнений.");
  } else if (band === "moderate") {
    advice.push("Мыть руки после улицы и транспорта, не трогать лицо руками.");
    advice.push("Сон 7–8 часов и регулярная физическая нагрузка снижают риск заметнее, чем витамины.");
    advice.push("Проветривание и увлажнение воздуха в отопительный сезон.");
  } else {
    advice.push("Сезон спокойный: поддерживай сон, питание и активность.");
    advice.push("Если планируешь вакцинацию от гриппа — лучший период сентябрь–ноябрь.");
  }

  return { score: clamped, band, factors, advice };
}

const POLLEN_KEYS: { key: string; match: RegExp }[] = [
  { key: "birch", match: /бер[её]з|birch/i },
  { key: "alder", match: /ольх|alder/i },
  { key: "grass", match: /злак|трав|газон|grass|тимофеев|еж[аи]|рожь/i },
  { key: "mugwort", match: /полын|mugwort/i },
  { key: "olive", match: /олив|olive/i },
  { key: "ragweed", match: /амброз|ragweed/i },
];

export type AllergyInput = {
  name: string;
  category: string;
  severity: string;
  months: string | null;
};

function monthMatches(months: string | null, month: number): boolean {
  if (!months) return true;
  const list = months
    .split(/[,\s]+/)
    .map((v) => Number(v))
    .filter((v) => Number.isInteger(v) && v >= 1 && v <= 12);
  return list.length === 0 ? true : list.includes(month + 1);
}

export function computeAllergyRisk(
  allergies: AllergyInput[],
  now: Date,
  env: EnvInput,
): Risk | null {
  const active = allergies.filter((a) => a.category);
  if (active.length === 0) return null;

  const month = now.getMonth();
  const factors: Factor[] = [];
  const advice = new Set<string>();
  let score = 0;

  for (const allergy of active) {
    const candidate = allergyScore(allergy, month, env);
    if (candidate == null) continue;

    if (candidate.score > score) score = candidate.score;
    if (candidate.score >= 25) {
      factors.push({
        label: `${allergy.name}: ${candidate.label}`,
        delta: candidate.score,
      });
    }
    candidate.advice.forEach((a) => advice.add(a));
  }

  if (env) {
    if (env.windSpeed != null && env.windSpeed > 20) {
      score += 8;
      factors.push({ label: `ветер ${Math.round(env.windSpeed)} км/ч`, delta: 8, note: "разносит пыльцу" });
    }
    if (env.precipitation != null && env.precipitation > 2) {
      score -= 12;
      factors.push({ label: `осадки ${env.precipitation.toFixed(1)} мм`, delta: -12, note: "дождь прибивает пыльцу" });
    }
    if (env.pm25 != null && env.pm25 > 25) {
      score += 6;
      factors.push({ label: `PM2.5 ${Math.round(env.pm25)} мкг/м³`, delta: 6, note: "добавляет раздражение слизистых" });
    }
  }

  const clamped = Math.max(0, Math.min(95, Math.round(score)));
  const band = bandOf(clamped);

  if (band === "high") {
    advice.add("Держи окна закрытыми в сухую ветреную погоду, проветривай после дождя.");
    advice.add("После улицы — душ и смена одежды, чтобы не тащить пыльцу в комнату.");
    advice.add("Антигистаминные — только по назначению врача, схему обсуди заранее.");
  } else if (band === "moderate") {
    advice.add("Следи за самочувствием и держи назначенные препараты под рукой.");
    advice.add("Прогулки лучше после дождя и вечером, когда пыльца оседает.");
  } else {
    advice.add("Сейчас спокойный период по твоим аллергенам.");
  }

  return { score: clamped, band, factors, advice: [...advice] };
}

function allergyScore(
  allergy: AllergyInput,
  month: number,
  env: EnvInput,
): { score: number; label: string; advice: string[] } | null {
  const severityMult = allergy.severity === "severe" ? 1.2 : allergy.severity === "mild" ? 0.9 : 1;
  const inSeason = monthMatches(allergy.months, month);

  if (allergy.category === "pollen") {
    const rule = POLLEN_KEYS.find((r) => r.match.test(allergy.name));
    const value = rule && env?.pollen ? (env.pollen[rule.key] ?? null) : null;

    if (value != null) {
      const raw = Math.min(100, Math.round(value * 8));
      return {
        score: Math.round(raw * severityMult),
        label: `пыльца ${Math.round(value)} зёрен/м³`,
        advice: ["Пыльцевой прогноз — модельный (CAMS); в Закавказье он может занижать уровень."],
      };
    }

    if (inSeason) {
      return { score: Math.round(45 * severityMult), label: "сезон аллергена", advice: [] };
    }
    return { score: Math.round(10 * severityMult), label: "вне сезона", advice: [] };
  }

  if (allergy.category === "mold") {
    const humidity = env?.humidity ?? null;
    const temperature = env?.temperature ?? null;
    if (humidity != null && humidity > 70 && (temperature ?? 0) > 5) {
      return {
        score: Math.round(Math.min(95, 40 + (humidity - 70) * 2) * severityMult),
        label: `влажность ${Math.round(humidity)}% — растут споры`,
        advice: ["Следи за влажностью в ванной и кухне: вытяжка, проветривание, без ковров у стен."],
      };
    }
    return { score: Math.round(15 * severityMult), label: "влажность в норме", advice: [] };
  }

  if (allergy.category === "dust") {
    const heating = month <= 3 || month >= 9;
    return {
      score: Math.round((heating ? 30 : 18) * severityMult),
      label: heating ? "отопительный сезон — сухой воздух, пыль" : "вне отопительного сезона",
      advice: ["Влажная уборка 1–2 раза в неделю и стирка постели при 60 °C."],
    };
  }

  return null; // животные, еда, лекарства — от среды не зависят
}

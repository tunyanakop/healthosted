import { describe, expect, it } from "vitest";
import {
  MONTH_BASE,
  bandOf,
  computeAllergyRisk,
  computeVirusRisk,
  daysBetween,
  ageOf,
  type EnvInput,
} from "@/lib/season";

const NOW = new Date("2026-11-15T12:00:00Z");

const emptyEnv: EnvInput = null;

const coldDryEnv: EnvInput = {
  temperature: -5,
  humidity: 25,
  precipitation: 0,
  windSpeed: 10,
  pm25: 40,
  aqi: 45,
  pollen: {},
  pollenAvailable: false,
};

describe("season helpers", () => {
  it("bandOf на границах", () => {
    expect(bandOf(0)).toBe("low");
    expect(bandOf(29)).toBe("low");
    expect(bandOf(30)).toBe("moderate");
    expect(bandOf(59)).toBe("moderate");
    expect(bandOf(60)).toBe("high");
  });

  it("daysBetween и ageOf", () => {
    expect(daysBetween(new Date("2026-11-01T00:00:00Z"), NOW)).toBe(14);
    expect(ageOf(new Date("1990-05-17T00:00:00Z"), NOW)).toBe(36);
    expect(ageOf(new Date("1990-12-31T00:00:00Z"), NOW)).toBe(35);
    expect(ageOf(null, NOW)).toBeNull();
  });

  it("сезонность выше зимой, чем летом", () => {
    expect(MONTH_BASE[0]).toBeGreaterThan(MONTH_BASE[6]);
  });
});

describe("computeVirusRisk", () => {
  const base = {
    now: NOW,
    birthDate: new Date("1990-05-17T00:00:00Z"),
    episodes: [],
    chronicActive: 0,
    vaccinatedRecent: false,
    env: emptyEnv,
    incidence: null,
  };

  it("считает ноябрьский риск умеренным без факторов", () => {
    const risk = computeVirusRisk(base);
    expect(risk.score).toBe(MONTH_BASE[10]);
    expect(risk.band).toBe("moderate");
    expect(risk.factors.length).toBeGreaterThan(0);
  });

  it("свежая болезнь снижает риск", () => {
    const withRecent = computeVirusRisk({
      ...base,
      episodes: [{ kind: "arvi", startedAt: new Date("2026-10-20T00:00:00Z") }],
    });
    expect(withRecent.score).toBeLessThan(computeVirusRisk(base).score);
    expect(withRecent.factors.some((f) => f.label.includes("26 дн."))).toBe(true);
  });

  it("хронические состояния и вакцинация двигают оценку", () => {
    const chronic = computeVirusRisk({ ...base, chronicActive: 3 });
    expect(chronic.score).toBeGreaterThan(computeVirusRisk(base).score);

    const vaccinated = computeVirusRisk({ ...base, vaccinatedRecent: true });
    expect(vaccinated.score).toBeLessThan(computeVirusRisk(base).score);
  });

  it("сухой холодный воздух и грязный воздух добавляют риск", () => {
    const cold = computeVirusRisk({ ...base, env: coldDryEnv });
    expect(cold.score).toBeGreaterThan(computeVirusRisk(base).score);
    expect(cold.factors.some((f) => f.label.includes("°C"))).toBe(true);
  });

  it("высокая заболеваемость в городе добавляет заметно", () => {
    const high = computeVirusRisk({ ...base, incidence: "high" });
    expect(high.score).toBeGreaterThanOrEqual(computeVirusRisk(base).score + 15);
  });

  it("не выходит за границы 5..95", () => {
    const extreme = computeVirusRisk({
      ...base,
      chronicActive: 20,
      env: coldDryEnv,
      incidence: "high",
    });
    expect(extreme.score).toBeLessThanOrEqual(95);
    expect(extreme.score).toBeGreaterThanOrEqual(5);
  });
});

describe("computeAllergyRisk", () => {
  it("без аллергий возвращает null", () => {
    expect(computeAllergyRisk([], NOW, emptyEnv)).toBeNull();
  });

  it("высокая пыльца берёзы даёт высокий риск", () => {
    const env: EnvInput = {
      temperature: 18,
      humidity: 50,
      precipitation: 0,
      windSpeed: 25,
      pm25: 30,
      aqi: 40,
      pollen: { birch: 60, grass: 0 },
      pollenAvailable: true,
    };
    const risk = computeAllergyRisk(
      [{ name: "берёза", category: "pollen", severity: "moderate", months: "4,5" }],
      new Date("2026-05-01T12:00:00Z"),
      env,
    );
    expect(risk).not.toBeNull();
    expect(risk!.score).toBeGreaterThanOrEqual(60);
    expect(risk!.band).toBe("high");
    expect(risk!.advice.length).toBeGreaterThan(0);
  });

  it("вне сезона и без пыльцы риск низкий", () => {
    const risk = computeAllergyRisk(
      [{ name: "берёза", category: "pollen", severity: "moderate", months: "3,4" }],
      new Date("2026-11-15T12:00:00Z"),
      null,
    );
    expect(risk!.band).toBe("low");
  });

  it("дождь снижает, ветер повышает", () => {
    const allergy = [{ name: "амброзия", category: "pollen", severity: "moderate", months: null }];
    const dry = computeAllergyRisk(allergy, NOW, {
      temperature: 20, humidity: 40, precipitation: 0, windSpeed: 30, pm25: 5, aqi: 10,
      pollen: { ragweed: 20 }, pollenAvailable: true,
    })!;
    const rainy = computeAllergyRisk(allergy, NOW, {
      temperature: 20, humidity: 80, precipitation: 8, windSpeed: 5, pm25: 5, aqi: 10,
      pollen: { ragweed: 20 }, pollenAvailable: true,
    })!;
    expect(dry.score).toBeGreaterThan(rainy.score);
  });

  it("плесень реагирует на влажность", () => {
    const allergy = [{ name: "плесень в ванной", category: "mold", severity: "moderate", months: null }];
    const humid = computeAllergyRisk(allergy, NOW, {
      temperature: 22, humidity: 85, precipitation: 0, windSpeed: 5, pm25: 5, aqi: 10,
      pollen: {}, pollenAvailable: false,
    })!;
    const dry = computeAllergyRisk(allergy, NOW, {
      temperature: 22, humidity: 45, precipitation: 0, windSpeed: 5, pm25: 5, aqi: 10,
      pollen: {}, pollenAvailable: false,
    })!;
    expect(humid.score).toBeGreaterThan(dry.score);
    expect(humid.factors.some((f) => f.label.includes("влажность"))).toBe(true);
  });

  it("тяжёлая аллергия даёт больший риск, чем лёгкая", () => {
    const env: EnvInput = {
      temperature: 18, humidity: 50, precipitation: 0, windSpeed: 5, pm25: 5, aqi: 10,
      pollen: { grass: 10 }, pollenAvailable: true,
    };
    const severe = computeAllergyRisk(
      [{ name: "злаки", category: "pollen", severity: "severe", months: null }], NOW, env)!;
    const mild = computeAllergyRisk(
      [{ name: "злаки", category: "pollen", severity: "mild", months: null }], NOW, env)!;
    expect(severe.score).toBeGreaterThan(mild.score);
  });
});

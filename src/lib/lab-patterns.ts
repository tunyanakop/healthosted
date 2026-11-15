/**
 * Паттерны сочетаний показателей.
 *
 * Детерминированно, без ИИ: набор правил «если такие-то отклонения вместе — это похоже
 * на такую-то картину». Формулировки намеренно осторожные: паттерн — повод обсудить
 * с врачом и перепроверить, а не диагноз.
 */

export type ResultLite = {
  code: string;
  flag: string;
  value: number | null;
  unit: string | null;
};

export type PatternMatch = {
  id: string;
  title: string;
  severity: "attention" | "info";
  summary: string;
  next: string;
  supportedBy: { code: string; value: string }[];
  missing: string[];
};

type Pattern = {
  id: string;
  title: string;
  severity: "attention" | "info";
  requires: string[];
  optional?: string[];
  match: (r: Map<string, ResultLite>) => boolean;
  summary: string;
  next: string;
};

const low = (r: Map<string, ResultLite>, code: string) => r.get(code)?.flag === "low";
const high = (r: Map<string, ResultLite>, code: string) => r.get(code)?.flag === "high";
const crit = (r: Map<string, ResultLite>, code: string) => r.get(code)?.flag === "critical";
const normal = (r: Map<string, ResultLite>, code: string) => r.get(code)?.flag === "normal";
const has = (r: Map<string, ResultLite>, code: string) => r.has(code);
const num = (r: Map<string, ResultLite>, code: string) => r.get(code)?.value ?? null;

export const PATTERNS: Pattern[] = [
  {
    id: "iron_deficiency",
    title: "Картина железодефицита",
    severity: "attention",
    requires: ["HGB", "MCV"],
    optional: ["FERR", "FE"],
    match: (r) => low(r, "HGB") && low(r, "MCV"),
    summary:
      "Низкий гемоглобин вместе с уменьшенными эритроцитами (MCV↓) — типичная картина дефицита железа.",
    next:
      "Обычно проверяют ферритин и железо, ищут источник потерь. Приём железа — только по назначению врача: бесконтрольно можно перегрузить организм.",
  },
  {
    id: "b12_folate",
    title: "Картина дефицита B12 или фолатов",
    severity: "attention",
    requires: ["HGB", "MCV"],
    optional: ["B12", "FOL"],
    match: (r) => low(r, "HGB") && high(r, "MCV"),
    summary:
      "Анемия с крупными эритроцитами (MCV↑) чаще связана с дефицитом витамина B12 или фолиевой кислоты.",
    next: "Проверить B12 и фолаты. Дефицит B12 важно не тянуть: он влияет на нервы, а не только на кровь.",
  },
  {
    id: "anemia_isolated",
    title: "Снижение гемоглобина",
    severity: "info",
    requires: ["HGB"],
    match: (r) => low(r, "HGB") && !has(r, "MCV"),
    summary: "Гемоглобин ниже нормы без данных об объёме эритроцитов — причину по одному числу не определить.",
    next: "Для понимания нужен общий анализ крови целиком: MCV, ферритин, при необходимости B12.",
  },
  {
    id: "erythrocytosis",
    title: "Повышение гемоглобина и гематокрита",
    severity: "attention",
    requires: ["HGB", "HCT"],
    match: (r) => high(r, "HGB") && high(r, "HCT"),
    summary: "Оба показателя выше нормы — кровь более «густая», чем обычно.",
    next:
      "Частая причина — обезвоживание: повторить анализ на нормальном питье. Если сохраняется — обсудить с врачом.",
  },
  {
    id: "thrombocytopenia",
    title: "Низкие тромбоциты",
    severity: "attention",
    requires: ["PLT"],
    match: (r) => low(r, "PLT") || crit(r, "PLT"),
    summary: "Тромбоциты ниже нормы — снижена способность крови останавливать кровотечение.",
    next:
      "Важно исключить ошибку: пересдать. При повторном снижении или синяках/кровоточивости — к врачу без откладывания.",
  },
  {
    id: "bacterial_inflammation",
    title: "Картина бактериального воспаления",
    severity: "attention",
    requires: ["WBC", "CRP"],
    optional: ["NEUT", "PCT"],
    match: (r) => high(r, "WBC") && high(r, "CRP") && (!has(r, "NEUT") || high(r, "NEUT")),
    summary:
      "Лейкоциты и СРБ повышены одновременно — чаще всего это бактериальная инфекция или другое активное воспаление.",
    next: "Обсудить с врачом: нужны жалобы, осмотр и иногда посев. Антибиотики без назначения не принимать.",
  },
  {
    id: "viral_pattern",
    title: "Картина, характерная для вирусной инфекции",
    severity: "info",
    requires: ["WBC", "LYMPH"],
    match: (r) => !high(r, "WBC") && high(r, "LYMPH"),
    summary: "Лейкоциты не повышены, а лимфоциты выше нормы — так часто выглядит вирусная инфекция.",
    next: "Обычно достаточно наблюдения и симптоматического лечения. Если состояние ухудшается — к врачу.",
  },
  {
    id: "chronic_inflammation",
    title: "Признаки вялотекущего воспаления",
    severity: "info",
    requires: ["CRP", "ESR"],
    match: (r) => high(r, "CRP") && high(r, "ESR"),
    summary: "СРБ и СОЭ повышены вместе — воспаление есть, но по этим двум тестам его причину не найти.",
    next: "Сопоставить с жалобами и историей: где именно воспаление, покажут другие обследования.",
  },
  {
    id: "dyslipidemia",
    title: "Атерогенный липидный профиль",
    severity: "attention",
    requires: ["LDL", "HDL"],
    optional: ["TG", "CHOL"],
    match: (r) => high(r, "LDL") && low(r, "HDL"),
    summary:
      "«Плохой» холестерин повышен, «хороший» снижен — сочетание, которое повышает сердечно-сосудистый риск.",
    next:
      "Обсудить с врачом тактику: питание, активность, при показаниях — препараты. Повторный липидный профиль натощак.",
  },
  {
    id: "metabolic",
    title: "Метаболические изменения",
    severity: "attention",
    requires: ["GLU", "TG"],
    optional: ["HDL", "HBA1C"],
    match: (r) => high(r, "GLU") && high(r, "TG"),
    summary: "Повышенная глюкоза вместе с высокими триглицеридами — картина, характерная для нарушения углеводного обмена.",
    next: "Проверить HbA1c и обсудить с врачом питание и активность; не начинать препараты самостоятельно.",
  },
  {
    id: "prediabetes",
    title: "Зона предиабета",
    severity: "info",
    requires: ["HBA1C"],
    match: (r) => {
      const v = num(r, "HBA1C");
      return v != null && v >= 5.7 && v < 6.5;
    },
    summary: "HbA1c в диапазоне 5.7–6.4% — это ещё не диабет, но уже не норма.",
    next: "Обычно помогает изменение питания и активности; контроль через 3–6 месяцев.",
  },
  {
    id: "hypothyroid",
    title: "Картина гипотиреоза",
    severity: "attention",
    requires: ["TSH", "FT4"],
    match: (r) => high(r, "TSH") && low(r, "FT4"),
    summary: "ТТГ повышен при сниженном свободном Т4 — щитовидная железа работает недостаточно.",
    next: "К эндокринологу: нужна оценка симптомов и, как правило, подтверждающий анализ.",
  },
  {
    id: "hyperthyroid",
    title: "Картина гипертиреоза",
    severity: "attention",
    requires: ["TSH", "FT4"],
    match: (r) => low(r, "TSH") && high(r, "FT4"),
    summary: "ТТГ снижен при повышенном свободном Т4 — избыток гормонов щитовидной железы.",
    next: "К эндокринологу в ближайшее время: важно исключить тиреотоксикоз.",
  },
  {
    id: "cholestasis",
    title: "Признаки холестаза",
    severity: "attention",
    requires: ["GGT", "ALP"],
    optional: ["DBIL"],
    match: (r) => high(r, "GGT") && high(r, "ALP"),
    summary: "ГГТ и щелочная фосфатаза повышены вместе — это может указывать на затруднение оттока желчи.",
    next: "Обсудить с врачом УЗИ желчных путей и приём лекарств, влияющих на печень.",
  },
  {
    id: "hepatocellular",
    title: "Признаки нагрузки на печень",
    severity: "attention",
    requires: ["ALT", "AST"],
    match: (r) => high(r, "ALT") && high(r, "AST"),
    summary: "АЛТ и АСТ повышены — ферменты выходят из клеток печени при их повреждении.",
    next: "Исключить алкоголь и гепатотоксичные препараты, обсудить с врачом дообследование.",
  },
  {
    id: "kidney",
    title: "Снижение фильтрационной функции почек",
    severity: "attention",
    requires: ["CREA"],
    optional: ["EGFR", "UREA"],
    match: (r) => high(r, "CREA") && (!has(r, "EGFR") || low(r, "EGFR")),
    summary: "Креатинин повышен, расчётная СКФ снижена — почки фильтруют хуже обычного.",
    next:
      "Повторить на нормальном питье, проверить давление и сахар. Стойкое снижение СКФ — к нефрологу.",
  },
  {
    id: "hyperkalemia",
    title: "Высокий калий",
    severity: "attention",
    requires: ["K"],
    match: (r) => high(r, "K") || crit(r, "K"),
    summary: "Калий выше нормы влияет на сердечный ритм.",
    next: "Пересдать без длинного жгута; при подтверждении — срочно к врачу, особенно на фоне болезней почек.",
  },
  {
    id: "hyponatremia",
    title: "Низкий натрий",
    severity: "attention",
    requires: ["NA"],
    match: (r) => low(r, "NA"),
    summary: "Натрий ниже нормы — нарушен водно-солевой баланс.",
    next: "Обсудить с врачом питьевой режим и лекарства; при спутанности или судорогах — срочно.",
  },
  {
    id: "hypercalcemia",
    title: "Высокий кальций",
    severity: "attention",
    requires: ["CA"],
    match: (r) => high(r, "CA"),
    summary: "Кальций выше нормы может быть связан с паращитовидными железами, витамином D или другими причинами.",
    next: "К врачу для дообследования: нужен повторный анализ и оценка паратгормона.",
  },
  {
    id: "vitd_low",
    title: "Низкий витамин D",
    severity: "info",
    requires: ["VITD"],
    match: (r) => low(r, "VITD"),
    summary: "Уровень 25-OH витамина D ниже нормы.",
    next: "Обсудить дозировку добавки с врачом: больше — не значит лучше.",
  },
  {
    id: "iron_stores",
    title: "Низкие запасы железа",
    severity: "info",
    requires: ["FERR"],
    match: (r) => low(r, "FERR"),
    summary: "Ферритин ниже нормы — запас железа в организме истощён, даже если гемоглобин ещё в норме.",
    next: "Обсудить с врачом приём железа и поиск причины потерь.",
  },
];

export function matchPatterns(results: ResultLite[]): PatternMatch[] {
  const map = new Map<string, ResultLite>();
  for (const r of results) map.set(r.code, r);

  const matches: PatternMatch[] = [];

  for (const pattern of PATTERNS) {
    const requiredPresent = pattern.requires.every((code) => map.has(code));
    if (!requiredPresent) continue;
    if (!pattern.match(map)) continue;

    const supportedBy = pattern.requires
      .map((code) => map.get(code))
      .filter((r): r is ResultLite => Boolean(r))
      .map((r) => ({
        code: r.code,
        value: `${r.value ?? "—"}${r.unit ? ` ${r.unit}` : ""}`,
      }));

    const missing = (pattern.optional ?? []).filter((code) => !map.has(code));

    matches.push({
      id: pattern.id,
      title: pattern.title,
      severity: pattern.severity,
      summary: pattern.summary,
      next: pattern.next,
      supportedBy,
      missing,
    });
  }

  return matches.sort((a, b) =>
    a.severity === b.severity ? 0 : a.severity === "attention" ? -1 : 1,
  );
}

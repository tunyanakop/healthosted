export type Kind =
  | "weight"
  | "height"
  | "bp"
  | "pulse"
  | "temp"
  | "spo2"
  | "glucose";

export type KindMeta = {
  kind: Kind;
  label: string;
  short: string;
  unit: string;
  secondUnit?: string;
  min: number;
  max: number;
  step: number;
  secondary?: boolean;
};

export const KINDS: KindMeta[] = [
  { kind: "weight", label: "Вес", short: "Вес", unit: "кг", min: 2, max: 500, step: 0.1 },
  { kind: "height", label: "Рост", short: "Рост", unit: "см", min: 30, max: 300, step: 0.5 },
  {
    kind: "bp",
    label: "Давление",
    short: "АД",
    unit: "мм рт.ст.",
    secondUnit: "мм рт.ст.",
    min: 40,
    max: 300,
    step: 1,
    secondary: true,
  },
  { kind: "pulse", label: "Пульс", short: "Пульс", unit: "уд/мин", min: 20, max: 250, step: 1 },
  { kind: "temp", label: "Температура", short: "T°", unit: "°C", min: 30, max: 45, step: 0.1 },
  { kind: "spo2", label: "Сатурация", short: "SpO₂", unit: "%", min: 50, max: 100, step: 1 },
  { kind: "glucose", label: "Глюкоза", short: "Глюкоза", unit: "ммоль/л", min: 0.5, max: 50, step: 0.1 },
];

export const KIND_MAP: Record<Kind, KindMeta> = Object.fromEntries(
  KINDS.map((k) => [k.kind, k]),
) as Record<Kind, KindMeta>;

export function isKind(value: string): value is Kind {
  return value in KIND_MAP;
}

export function formatValue(
  kind: string,
  value: number,
  value2?: number | null,
): string {
  const meta = KIND_MAP[kind as Kind];
  if (!meta) return `${value}`;
  const main = Number.isInteger(value) ? `${value}` : value.toFixed(1);
  if (meta.secondary && value2 != null) {
    return `${main}/${value2} ${meta.unit}`;
  }
  return `${main} ${meta.unit}`;
}

/** ИМТ по последним росту и весу. Возвращает null, если данных не хватает. */
export function bmi(
  weightKg: number | null | undefined,
  heightCm: number | null | undefined,
): number | null {
  if (!weightKg || !heightCm) return null;
  const meters = heightCm / 100;
  if (meters <= 0) return null;
  const value = weightKg / (meters * meters);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 10) / 10;
}

export function bmiCategory(value: number): { label: string; tone: "low" | "ok" | "warn" | "bad" } {
  if (value < 18.5) return { label: "недостаточный вес", tone: "warn" };
  if (value < 25) return { label: "норма", tone: "ok" };
  if (value < 30) return { label: "избыточный вес", tone: "warn" };
  return { label: "ожирение", tone: "bad" };
}

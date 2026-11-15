import { infoFor } from "@/lib/test-descriptions";

export type InterpretResult = {
  name: string;
  testCode: string | null;
  value: string;
  unit: string | null;
  flag: string;
  appliedNote: string | null;
};

export type InterpretItem = {
  name: string;
  value: string;
  flag: string;
  text: string;
  reference: string | null;
};

export type Interpretation = {
  critical: InterpretItem[];
  high: InterpretItem[];
  low: InterpretItem[];
  normalCount: number;
  empty: boolean;
};

function textFor(result: InterpretResult): string {
  const info = infoFor(result.testCode);
  if (!info) return "Пояснение для этого показателя пока не добавлено.";

  if (result.flag === "high" && info.high) {
    return `${info.what} Выше нормы бывает при: ${info.high}.`;
  }
  if (result.flag === "low" && info.low) {
    return `${info.what} Ниже нормы бывает при: ${info.low}.`;
  }
  if (result.flag === "critical") {
    const cause = info.high ?? info.low;
    return cause
      ? `${info.what} Критическое значение требует быстрой оценки врача. Типичные причины: ${cause}.`
      : `${info.what} Критическое значение требует быстрой оценки врача.`;
  }
  return info.what;
}

function toItem(result: InterpretResult): InterpretItem {
  return {
    name: result.name,
    value: `${result.value}${result.unit ? ` ${result.unit}` : ""}`,
    flag: result.flag,
    text: textFor(result),
    reference: result.appliedNote,
  };
}

export function interpretResults(results: InterpretResult[]): Interpretation {
  const critical: InterpretItem[] = [];
  const high: InterpretItem[] = [];
  const low: InterpretItem[] = [];
  let normalCount = 0;

  for (const result of results) {
    if (result.flag === "critical") critical.push(toItem(result));
    else if (result.flag === "high") high.push(toItem(result));
    else if (result.flag === "low") low.push(toItem(result));
    else if (result.flag === "normal") normalCount += 1;
  }

  return { critical, high, low, normalCount, empty: results.length === 0 };
}

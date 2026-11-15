import { interpretResults, type InterpretItem, type InterpretResult } from "@/lib/lab-interpretation";

function Group({
  title,
  items,
  tone,
}: {
  title: string;
  items: InterpretItem[];
  tone: "critical" | "high" | "low";
}) {
  if (items.length === 0) return null;

  const styles =
    tone === "critical"
      ? "border-rose-500/50 bg-rose-500/10"
      : tone === "high"
        ? "border-rose-500/25 bg-rose-500/5"
        : "border-sky-500/25 bg-sky-500/5";

  return (
    <div className={`rounded-lg border p-3 ${styles}`}>
      <h3 className="mb-2 text-sm font-medium text-slate-200">{title}</h3>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={`${item.name}-${i}`} className="text-sm">
            <p className="text-slate-200">
              {item.name}: <span className="font-medium">{item.value}</span>
              {item.reference ? (
                <span className="ml-2 text-xs text-slate-500">{item.reference}</span>
              ) : null}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{item.text}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LabInterpretation({ results }: { results: InterpretResult[] }) {
  const interpretation = interpretResults(results);
  if (interpretation.empty) return null;

  const nothingAbnormal =
    interpretation.critical.length === 0 &&
    interpretation.high.length === 0 &&
    interpretation.low.length === 0;

  return (
    <section className="card">
      <h2 className="mb-1 font-medium">Расшифровка</h2>
      <p className="mb-3 text-xs text-slate-500">
        Объяснения собраны из справочника показателей: что это и с чем обычно связаны
        отклонения. Это не диагноз и не назначение — оценивать должен врач.
      </p>

      {nothingAbnormal ? (
        <p className="text-sm text-emerald-300">
          Все показатели ({interpretation.normalCount}) в пределах референса.
        </p>
      ) : (
        <div className="space-y-3">
          <Group title="Критические значения" items={interpretation.critical} tone="critical" />
          <Group title="Выше нормы" items={interpretation.high} tone="high" />
          <Group title="Ниже нормы" items={interpretation.low} tone="low" />
        </div>
      )}

      {!nothingAbnormal && interpretation.normalCount > 0 ? (
        <p className="mt-3 text-xs text-slate-500">
          Ещё {interpretation.normalCount} показателей в пределах референса.
        </p>
      ) : null}

      <p className="mt-3 text-xs text-slate-500">
        Диагноз по одному анализу не ставится: значение оценивается вместе с жалобами,
        осмотром и другими исследованиями. Критические значения — повод связаться с врачом,
        а не самостоятельно менять лечение.
      </p>
    </section>
  );
}

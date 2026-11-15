import { matchPatterns, type ResultLite } from "@/lib/lab-patterns";

export type PatternInput = {
  testCode: string | null;
  value: string;
  numericValue: number | null;
  unit: string | null;
  flag: string;
};

export function LabPatterns({ results }: { results: PatternInput[] }) {
  const lite: ResultLite[] = results
    .filter((r) => r.testCode)
    .map((r) => ({
      code: r.testCode as string,
      flag: r.flag,
      value: r.numericValue,
      unit: r.unit,
    }));

  if (lite.length === 0) return null;

  const matches = matchPatterns(lite);

  return (
    <section className="card">
      <h2 className="mb-1 font-medium">Возможные сочетания</h2>
      <p className="mb-3 text-xs text-slate-500">
        Правила сопоставляют отклонения между собой. Это не диагноз: сочетание лишь
        подсказывает, в какую сторону смотреть, и требует подтверждения врачом.
      </p>

      {matches.length === 0 ? (
        <p className="text-sm text-slate-400">
          Явных сочетаний не найдено. Если все показатели в норме — это ожидаемо.
        </p>
      ) : (
        <div className="space-y-3">
          {matches.map((m) => (
            <article
              key={m.id}
              className={`rounded-lg border p-3 ${
                m.severity === "attention"
                  ? "border-amber-500/40 bg-amber-500/5"
                  : "border-ink-700 bg-ink-900/40"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-medium text-slate-100">{m.title}</h3>
                <span
                  className={`rounded border px-1.5 py-0.5 text-[10px] ${
                    m.severity === "attention"
                      ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                      : "border-ink-700 text-slate-400"
                  }`}
                >
                  {m.severity === "attention" ? "стоит обсудить с врачом" : "к сведению"}
                </span>
              </div>

              <p className="mt-1 text-sm text-slate-300">{m.summary}</p>

              <p className="mt-2 text-xs text-slate-500">
                Подтверждают: {m.supportedBy.map((s) => `${s.code} ${s.value}`).join(", ")}
                {m.missing.length > 0
                  ? ` · уточнят: ${m.missing.join(", ")}`
                  : ""}
              </p>

              <p className="mt-1 text-xs text-slate-400">{m.next}</p>
            </article>
          ))}
        </div>
      )}

      <p className="mt-3 text-xs text-slate-500">
        Правила не учитывают жалобы, осмотр и историю болезней — только числа в этой панели.
        Решение о тактике принимает врач.
      </p>
    </section>
  );
}

import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { KIND_MAP, bmi, bmiCategory, formatValue, type Kind } from "@/lib/measurements";
import { STATUS_MAP, durationLabel, isConditionStatus } from "@/lib/conditions";
import { expiry, typeLabel } from "@/lib/medbook";
import { FLAG_META, formatRef, isAbnormal, type LabFlag } from "@/lib/labs";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

function age(birthDate: Date | null): number | null {
  if (!birthDate) return null;
  const now = new Date();
  let years = now.getFullYear() - birthDate.getFullYear();
  const m = now.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) years -= 1;
  return years >= 0 ? years : null;
}

const SEX: Record<string, string> = { male: "мужской", female: "женский", other: "другой" };

export default async function ReportsPage() {
  const user = await requireUser();
  const now = new Date();

  const [measurements, conditions, visits, medbook, panels] = await Promise.all([
    prisma.measurement.findMany({ where: { userId: user.id }, orderBy: { measuredAt: "desc" } }),
    prisma.condition.findMany({
      where: { userId: user.id },
      orderBy: [{ status: "asc" }, { onsetAt: "desc" }],
    }),
    prisma.visit.findMany({
      where: { userId: user.id },
      orderBy: { visitedAt: "desc" },
      take: 6,
      include: { condition: { select: { title: true } } },
    }),
    prisma.medBookEntry.findMany({ where: { userId: user.id }, orderBy: { validUntil: "asc" } }),
    prisma.labPanel.findMany({
      where: { userId: user.id },
      orderBy: { takenAt: "desc" },
      take: 2,
      include: { results: { orderBy: { name: "asc" } } },
    }),
  ]);

  const latest = (kind: Kind) => measurements.find((m) => m.kind === kind);
  const bmiValue = bmi(latest("weight")?.value, latest("height")?.value);
  const bmiInfo = bmiValue != null ? bmiCategory(bmiValue) : null;
  const years = age(user.birthDate);

  const vitals: { label: string; value: string }[] = [];
  const pushVital = (kind: Kind) => {
    const m = latest(kind);
    if (m) vitals.push({ label: KIND_MAP[kind].label, value: formatValue(kind, m.value, m.value2) });
  };
  pushVital("height");
  pushVital("weight");
  pushVital("bp");
  pushVital("pulse");
  pushVital("temp");
  pushVital("spo2");
  pushVital("glucose");
  if (bmiValue != null && bmiInfo) {
    vitals.push({ label: "ИМТ", value: `${bmiValue.toFixed(1)} (${bmiInfo.label})` });
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <PageHeader title="Сводка для врача" subtitle={`Сформировано ${now.toLocaleString("ru-RU")}`} />
        <div className="flex gap-2">
          <PrintButton />
          <a href="/api/export" className="btn no-print">
            Скачать архив
          </a>
        </div>
      </div>

      <section className="card mb-4 print-break">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Пациент
        </h2>
        <p className="text-lg">{user.name ?? "имя не указано"}</p>
        <p className="text-sm text-slate-300">
          {user.birthDate ? `Дата рождения: ${user.birthDate.toLocaleDateString("ru-RU")}` : "Дата рождения не указана"}
          {years != null ? ` (${years} лет)` : ""}
          {user.sex ? ` · пол: ${SEX[user.sex] ?? user.sex}` : ""}
          {user.bloodType ? ` · кровь: ${user.bloodType}` : ""}
        </p>
        <p className="text-xs text-slate-500">{user.email}</p>
      </section>

      {vitals.length > 0 ? (
        <section className="card mb-4 print-break">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Последние показатели
          </h2>
          <div className="grid gap-1 text-sm sm:grid-cols-2">
            {vitals.map((v) => (
              <p key={v.label} className="flex justify-between gap-4 border-b border-ink-800/60 py-1">
                <span className="text-slate-400">{v.label}</span>
                <span>{v.value}</span>
              </p>
            ))}
          </div>
        </section>
      ) : null}

      <section className="card mb-4 print-break">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Состояния
        </h2>
        {conditions.length === 0 ? (
          <p className="muted">Записей нет.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-700 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="py-1 pr-3 font-medium">Диагноз</th>
                <th className="py-1 pr-3 font-medium">МКБ-10</th>
                <th className="py-1 pr-3 font-medium">Период</th>
                <th className="py-1 font-medium">Статус</th>
              </tr>
            </thead>
            <tbody>
              {conditions.map((c) => (
                <tr key={c.id} className="border-b border-ink-800/60 last:border-0">
                  <td className="py-1 pr-3">{c.title}</td>
                  <td className="py-1 pr-3 text-slate-400">{c.icd10 ?? "—"}</td>
                  <td className="py-1 pr-3 text-slate-400">
                    {c.onsetAt ? c.onsetAt.toLocaleDateString("ru-RU") : "—"} →{" "}
                    {c.resolvedAt ? c.resolvedAt.toLocaleDateString("ru-RU") : "н.в."}
                    {durationLabel(c.onsetAt, c.resolvedAt) ? ` (${durationLabel(c.onsetAt, c.resolvedAt)})` : ""}
                  </td>
                  <td className="py-1">
                    {isConditionStatus(c.status) ? STATUS_MAP[c.status].label : c.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {panels.map((p) => (
        <section key={p.id} className="card mb-4 print-break">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Анализы · {p.takenAt.toLocaleDateString("ru-RU")}
            {p.labName ? ` · ${p.labName}` : ""}
          </h2>
          {p.results.length === 0 ? (
            <p className="muted">Показателей нет.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-700 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="py-1 pr-3 font-medium">Показатель</th>
                  <th className="py-1 pr-3 font-medium">Значение</th>
                  <th className="py-1 pr-3 font-medium">Референс</th>
                  <th className="py-1 font-medium">Оценка</th>
                </tr>
              </thead>
              <tbody>
                {p.results.map((r) => {
                  const meta =
                    FLAG_META[(r.flag as LabFlag) in FLAG_META ? (r.flag as LabFlag) : "unknown"];
                  return (
                    <tr key={r.id} className="border-b border-ink-800/60 last:border-0">
                      <td className="py-1 pr-3">{r.name}</td>
                      <td className={`py-1 pr-3 font-medium ${isAbnormal(r.flag) ? meta.text : ""}`}>
                        {r.value} {r.unit ?? ""}
                      </td>
                      <td className="py-1 pr-3 text-slate-400">
                        {formatRef(r.refMin, r.refMax, r.unit)}
                      </td>
                      <td className="py-1">{isAbnormal(r.flag) ? meta.label : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      ))}

      {visits.length > 0 ? (
        <section className="card mb-4 print-break">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Посещения
          </h2>
          <ul className="space-y-2 text-sm">
            {visits.map((v) => (
              <li key={v.id}>
                <span className="text-slate-400">{v.visitedAt.toLocaleDateString("ru-RU")}</span>
                {" · "}
                {v.doctorName ?? "врач не указан"}
                {v.specialty ? `, ${v.specialty}` : ""}
                {v.condition ? ` · ${v.condition.title}` : ""}
                {v.diagnosis ? ` · диагноз: ${v.diagnosis}` : ""}
                {v.recommendations ? (
                  <span className="block text-slate-400">Назначено: {v.recommendations}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="card print-break">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Медкнижка
        </h2>
        {medbook.length === 0 ? (
          <p className="muted">Записей нет.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {medbook.map((m) => {
              const e = expiry(m.validUntil, now);
              return (
                <li key={m.id} className="flex flex-wrap justify-between gap-2">
                  <span>{typeLabel(m.type)}</span>
                  <span className="text-slate-400">
                    до {m.validUntil ? m.validUntil.toLocaleDateString("ru-RU") : "—"} · {e.label}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="mt-6 text-xs text-slate-500">
        Документ сформирован автоматически из личного архива HealtHosted и не является
        медицинским заключением.
      </p>
    </>
  );
}

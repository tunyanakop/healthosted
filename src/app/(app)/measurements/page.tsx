import { PageHeader } from "@/components/page-header";
import { AddDrawer } from "@/components/add-drawer";
import { LineChart } from "@/components/line-chart";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { KIND_MAP, bmi, bmiCategory, formatValue, type Kind } from "@/lib/measurements";
import { MeasurementForm } from "./measurement-form";
import { DeleteButton } from "./delete-button";

export const dynamic = "force-dynamic";

const TONE: Record<string, string> = {
  ok: "text-emerald-400",
  warn: "text-amber-400",
  bad: "text-rose-400",
  low: "text-sky-400",
};

export default async function MeasurementsPage() {
  const user = await requireUser();

  const items = await prisma.measurement.findMany({
    where: { userId: user.id },
    orderBy: { measuredAt: "desc" },
    take: 500,
  });

  const latest = (kind: Kind) => items.find((m) => m.kind === kind);
  const latestWeight = latest("weight");
  const latestHeight = latest("height");

  const bmiValue = bmi(latestWeight?.value, latestHeight?.value);
  const bmiInfo = bmiValue != null ? bmiCategory(bmiValue) : null;

  const weightPoints = items
    .filter((m) => m.kind === "weight")
    .slice(0, 60)
    .map((m) => ({ at: m.measuredAt, value: m.value }));

  const SUMMARY: Kind[] = ["weight", "height", "bp", "pulse"];
  const summary = SUMMARY.map((kind) => {
    const item = latest(kind);
    return item ? { kind, text: formatValue(item.kind, item.value, item.value2) } : null;
  }).filter((x): x is { kind: Kind; text: string } => x !== null);

  return (
    <>
      <PageHeader
        title="Измерения"
        subtitle="Рост, вес, давление, пульс, температура, сатурация, глюкоза"
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {summary.map((s) => (
          <div key={s.kind} className="card">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              {KIND_MAP[s.kind].label}
            </p>
            <p className="mt-1 text-lg font-medium">{s.text}</p>
          </div>
        ))}
        {bmiValue != null && bmiInfo ? (
          <div className="card">
            <p className="text-xs uppercase tracking-wide text-slate-400">ИМТ</p>
            <p className="mt-1 text-lg font-medium">
              {bmiValue.toFixed(1)}{" "}
              <span className={`text-sm ${TONE[bmiInfo.tone]}`}>{bmiInfo.label}</span>
            </p>
          </div>
        ) : null}
      </div>

      <AddDrawer label="Добавить измерение">
        <MeasurementForm />
      </AddDrawer>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-2 font-medium">Динамика веса</h2>
          {weightPoints.length >= 2 ? (
            <LineChart points={weightPoints} unit="кг" />
          ) : (
            <p className="muted">Добавь минимум два взвешивания — появится график.</p>
          )}
        </section>
      </div>

      <section className="mt-4 card">
        <h2 className="mb-3 font-medium">История</h2>
        {items.length === 0 ? (
          <p className="muted">Пока пусто. Первая запись — выше в форме.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-700 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="py-2 pr-3 font-medium">Дата</th>
                  <th className="py-2 pr-3 font-medium">Показатель</th>
                  <th className="py-2 pr-3 font-medium">Значение</th>
                  <th className="py-2 pr-3 font-medium">Заметка</th>
                  <th className="py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {items.slice(0, 100).map((m) => (
                  <tr key={m.id} className="border-b border-ink-800/60 last:border-0">
                    <td className="whitespace-nowrap py-2 pr-3 text-slate-300">
                      {m.measuredAt.toLocaleDateString("ru-RU")}
                    </td>
                    <td className="py-2 pr-3">{KIND_MAP[m.kind as Kind]?.label ?? m.kind}</td>
                    <td className="py-2 pr-3 font-medium">
                      {formatValue(m.kind, m.value, m.value2)}
                    </td>
                    <td className="py-2 pr-3 text-slate-400">{m.note ?? "—"}</td>
                    <td className="py-2 text-right">
                      <DeleteButton id={m.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

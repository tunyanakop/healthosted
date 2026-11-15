import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { LineChart } from "@/components/line-chart";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { KIND_MAP, bmi, bmiCategory, formatValue, type Kind } from "@/lib/measurements";
import { STATUS_MAP, durationLabel, isChronicActive, isConditionStatus } from "@/lib/conditions";
import { expiry, typeLabel } from "@/lib/medbook";
import { FLAG_META, isAbnormal, type LabFlag } from "@/lib/labs";
import { getEnvironment } from "@/lib/environment";
import { BAND_META, computeAllergyRisk, computeVirusRisk } from "@/lib/season";

export const dynamic = "force-dynamic";

function toneClass(tone: string): string {
  if (tone === "ok") return "text-emerald-400";
  if (tone === "bad") return "text-rose-400";
  return "text-amber-400";
}

export default async function DashboardPage() {
  const user = await requireUser();
  const now = new Date();

  const [measurements, conditions, medbook, visits, panels, profile, allergies, episodes, vaccinations] = await Promise.all([
    prisma.measurement.findMany({
      where: { userId: user.id },
      orderBy: { measuredAt: "desc" },
      take: 120,
    }),
    prisma.condition.findMany({
      where: { userId: user.id },
      orderBy: { onsetAt: "desc" },
      take: 50,
    }),
    prisma.medBookEntry.findMany({ where: { userId: user.id } }),
    prisma.visit.findMany({
      where: { userId: user.id },
      orderBy: { visitedAt: "desc" },
      take: 3,
      include: { condition: { select: { title: true } } },
    }),
    prisma.labPanel.findMany({
      where: { userId: user.id },
      orderBy: { takenAt: "desc" },
      take: 3,
      include: { results: { orderBy: { name: "asc" } } },
    }),
    prisma.user.findUnique({
      where: { id: user.id },
      select: {
        birthDate: true,
        latitude: true,
        longitude: true,
        envEnabled: true,
        incidence: true,
      },
    }),
    prisma.allergy.findMany({ where: { userId: user.id, active: true } }),
    prisma.condition.findMany({
      where: { userId: user.id, seasonalKind: { not: null } },
      orderBy: { onsetAt: "desc" },
      take: 20,
    }),
    prisma.medBookEntry.count({
      where: {
        userId: user.id,
        type: "vaccination",
        issuedAt: { gte: new Date(Date.now() - 365 * 86_400_000) },
      },
    }),
  ]);

  const envResult =
    profile?.envEnabled && profile.latitude != null && profile.longitude != null
      ? await getEnvironment(profile.latitude, profile.longitude)
      : null;
  const env = envResult?.env ?? null;

  const virusRisk = computeVirusRisk({
    now,
    birthDate: profile?.birthDate ?? null,
    episodes: episodes.map((e) => ({
      kind: e.seasonalKind ?? "other",
      startedAt: e.onsetAt ?? e.createdAt,
    })),
    chronicActive: conditions.filter(isChronicActive).length,
    vaccinatedRecent: vaccinations > 0,
    env,
    incidence: profile?.incidence ?? null,
  });

  const allergyRisk = computeAllergyRisk(
    allergies.map((a) => ({
      name: a.name,
      category: a.category,
      severity: a.severity,
      months: a.months,
    })),
    now,
    env,
  );

  const latest = (kind: Kind) => measurements.find((m) => m.kind === kind);
  const bmiValue = bmi(latest("weight")?.value, latest("height")?.value);
  const bmiInfo = bmiValue != null ? bmiCategory(bmiValue) : null;

  const weightPoints = measurements
    .filter((m) => m.kind === "weight")
    .slice(0, 40)
    .map((m) => ({ at: m.measuredAt, value: m.value }));

  const activeConditions = conditions.filter(isChronicActive);
  const attention = medbook.filter((m) => {
    const e = expiry(m.validUntil, now);
    return e.state === "expired" || e.state === "soon";
  });

  const latestPanel = panels[0];
  const abnormal = latestPanel ? latestPanel.results.filter((r) => isAbnormal(r.flag)) : [];

  const greeting = `Здравствуй${user.name ? `, ${user.name}` : ""}`;

  return (
    <>
      <PageHeader
        title={greeting}
        subtitle={now.toLocaleDateString("ru-RU", {
          day: "numeric",
          month: "long",
          year: "numeric",
          weekday: "long",
        })}
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <p className="text-xs uppercase tracking-wide text-slate-400">Вес / ИМТ</p>
          <p className="mt-1 text-lg font-medium">
            {latest("weight") ? formatValue("weight", latest("weight")!.value) : "—"}
          </p>
          {bmiValue != null && bmiInfo ? (
            <p className={`text-xs ${toneClass(bmiInfo.tone)}`}>
              ИМТ {bmiValue.toFixed(1)} · {bmiInfo.label}
            </p>
          ) : (
            <p className="text-xs text-slate-500">добавь рост и вес</p>
          )}
        </div>

        <div className="card">
          <p className="text-xs uppercase tracking-wide text-slate-400">Давление / пульс</p>
          <p className="mt-1 text-lg font-medium">
            {latest("bp") ? formatValue("bp", latest("bp")!.value, latest("bp")!.value2) : "—"}
          </p>
          <p className="text-xs text-slate-500">
            {latest("pulse") ? `${formatValue("pulse", latest("pulse")!.value)}` : "пульс не записан"}
          </p>
        </div>

        <div className="card">
          <p className="text-xs uppercase tracking-wide text-slate-400">Активные состояния</p>
          <p className="mt-1 text-lg font-medium">{activeConditions.length}</p>
          <p className="text-xs text-slate-500">
            {activeConditions[0] ? activeConditions[0].title : "хронических нет"}
          </p>
        </div>

        <div className="card">
          <p className="text-xs uppercase tracking-wide text-slate-400">Медкнижка</p>
          <p className="mt-1 text-lg font-medium">
            {attention.length > 0 ? `внимание: ${attention.length}` : "в порядке"}
          </p>
          <p className="text-xs text-slate-500">
            {attention.length > 0
              ? attention.map((a) => typeLabel(a.type)).join(", ")
              : "просрочек нет"}
          </p>
        </div>
      </div>

      <section className="mb-4 card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium">Сезонный риск</h2>
          <Link href="/season" className="text-xs text-slate-400 hover:text-accent">
            подробнее →
          </Link>
        </div>

        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">ОРВИ и грипп</p>
            <p className={`mt-1 text-lg font-medium ${BAND_META[virusRisk.band].text}`}>
              {BAND_META[virusRisk.band].label} · {virusRisk.score}/100
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Аллергия</p>
            {allergyRisk ? (
              <p className={`mt-1 text-lg font-medium ${BAND_META[allergyRisk.band].text}`}>
                {BAND_META[allergyRisk.band].label} · {allergyRisk.score}/100
              </p>
            ) : (
              <p className="mt-1 text-sm text-slate-500">добавь аллергены в разделе «Сезон»</p>
            )}
          </div>
        </div>

        <p className="mt-2 text-xs text-slate-500">{virusRisk.advice[0]}</p>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="font-medium">Вес</h2>
            <Link href="/measurements" className="text-xs text-slate-400 hover:text-accent">
              все измерения →
            </Link>
          </div>
          {weightPoints.length >= 2 ? (
            <LineChart points={weightPoints} unit="кг" height={140} />
          ) : (
            <p className="muted">Минимум два взвешивания — и появится график.</p>
          )}
        </section>

        <section className="card">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="font-medium">Последние анализы</h2>
            <Link href="/labs" className="text-xs text-slate-400 hover:text-accent">
              все анализы →
            </Link>
          </div>
          {latestPanel ? (
            <div>
              <p className="text-sm text-slate-300">
                {latestPanel.takenAt.toLocaleDateString("ru-RU")}
                {latestPanel.labName ? ` · ${latestPanel.labName}` : ""}
              </p>
              {abnormal.length > 0 ? (
                <ul className="mt-2 space-y-1 text-sm">
                  {abnormal.slice(0, 5).map((r) => {
                    const meta = FLAG_META[(r.flag as LabFlag) in FLAG_META ? (r.flag as LabFlag) : "unknown"];
                    return (
                      <li key={r.id} className="flex items-center justify-between gap-3">
                        <span className="text-slate-300">{r.name}</span>
                        <span className={meta.text}>
                          {r.value} {r.unit ?? ""} · {meta.label}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-emerald-400">всё в норме</p>
              )}
            </div>
          ) : (
            <p className="muted">Анализов ещё нет.</p>
          )}
        </section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="card">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="font-medium">История болезней</h2>
            <Link href="/conditions" className="text-xs text-slate-400 hover:text-accent">
              все →
            </Link>
          </div>
          {conditions.length === 0 ? (
            <p className="muted">Пока пусто.</p>
          ) : (
            <ul className="space-y-2">
              {conditions.slice(0, 4).map((c) => {
                const meta = isConditionStatus(c.status) ? STATUS_MAP[c.status] : null;
                return (
                  <li key={c.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate text-slate-300">{c.title}</span>
                    <span className="flex shrink-0 items-center gap-2 text-xs text-slate-500">
                      {durationLabel(c.onsetAt, c.resolvedAt)}
                      {meta ? (
                        <span className={`rounded border px-1.5 py-0.5 text-[10px] ${meta.badge}`}>
                          {meta.label}
                        </span>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="card">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="font-medium">Последние визиты</h2>
            <Link href="/visits" className="text-xs text-slate-400 hover:text-accent">
              все →
            </Link>
          </div>
          {visits.length === 0 ? (
            <p className="muted">Визитов ещё нет.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {visits.map((v) => (
                <li key={v.id} className="flex items-baseline justify-between gap-3">
                  <span className="text-slate-300">
                    {v.visitedAt.toLocaleDateString("ru-RU")}
                    {v.doctorName ? ` · ${v.doctorName}` : ""}
                  </span>
                  <span className="truncate text-xs text-slate-500">
                    {v.condition?.title ?? v.specialty ?? v.reason ?? ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/reports" className="btn btn-primary">
          Сводка для врача
        </Link>
        <a href="/api/export" className="btn">
          Скачать архив (zip)
        </a>
      </div>
    </>
  );
}

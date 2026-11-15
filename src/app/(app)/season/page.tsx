import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import {
  getEnvironment,
  aqiBand,
  weatherText,
  POLLEN_LABEL,
  SOURCE_LABEL,
  type EnvData,
} from "@/lib/environment";
import {
  BAND_META,
  computeAllergyRisk,
  computeVirusRisk,
  daysBetween,
  VIRUS_KINDS,
  type Risk,
} from "@/lib/season";
import { EnvironmentSettings } from "./environment-settings";
import { AllergiesEditor, CATEGORY_LABEL } from "./allergies-editor";
import { RefreshButton } from "./refresh-button";
import { DiagnoseButton } from "./diagnose-button";

export const dynamic = "force-dynamic";

function RiskCard({
  title,
  risk,
  note,
}: {
  title: string;
  risk: Risk;
  note?: string;
}) {
  const meta = BAND_META[risk.band];

  return (
    <section className="card">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-medium">{title}</h2>
        <span className={`rounded border px-2 py-0.5 text-xs ${meta.badge}`}>
          риск {meta.label} · {risk.score}/100
        </span>
      </div>

      <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-ink-800">
        <div className={`h-full ${meta.bar}`} style={{ width: `${risk.score}%` }} />
      </div>

      <ul className="space-y-1 text-sm">
        {risk.factors.map((f, i) => (
          <li key={i} className="flex items-start justify-between gap-3">
            <span className="text-slate-300">
              {f.label}
              {f.note ? <span className="block text-xs text-slate-500">{f.note}</span> : null}
            </span>
            <span
              className={
                f.delta > 0 ? "text-rose-300" : f.delta < 0 ? "text-emerald-300" : "text-slate-500"
              }
            >
              {f.delta > 0 ? `+${f.delta}` : f.delta < 0 ? `${f.delta}` : "—"}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-3 border-t border-ink-800 pt-3">
        <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Что делать</p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">
          {risk.advice.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ul>
      </div>

      {note ? <p className="mt-2 text-xs text-slate-500">{note}</p> : null}
    </section>
  );
}

function EnvPanel({ env }: { env: EnvData }) {
  const aqi = aqiBand(env.aqi);
  const pollenEntries = Object.entries(env.pollen)
    .filter(([, v]) => v != null && v > 0)
    .map(([k, v]) => `${POLLEN_LABEL[k as keyof typeof POLLEN_LABEL] ?? k} ${Number(v).toFixed(1)}`);

  return (
    <section className="card">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-medium">Среда сейчас</h2>
        <span className="text-xs text-slate-500">
          {new Date(env.fetchedAt).toLocaleString("ru-RU")} · Open-Meteo / CAMS
        </span>
      </div>

      <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <p className="flex justify-between gap-2 border-b border-ink-800/60 py-1">
          <span className="text-slate-400">Погода</span>
          <span>{env.weatherLabel ?? weatherText(env.weatherCode)}</span>
        </p>
        <p className="flex justify-between gap-2 border-b border-ink-800/60 py-1">
          <span className="text-slate-400">Температура</span>
          <span>
            {env.temperature != null ? `${env.temperature.toFixed(1)} °C` : "—"}
            {env.apparent != null ? (
              <span className="text-xs text-slate-500"> (ощущается {env.apparent.toFixed(1)})</span>
            ) : null}
          </span>
        </p>
        <p className="flex justify-between gap-2 border-b border-ink-800/60 py-1">
          <span className="text-slate-400">Влажность</span>
          <span>{env.humidity != null ? `${Math.round(env.humidity)} %` : "—"}</span>
        </p>
        <p className="flex justify-between gap-2 border-b border-ink-800/60 py-1">
          <span className="text-slate-400">Ветер</span>
          <span>{env.windSpeed != null ? `${Math.round(env.windSpeed)} км/ч` : "—"}</span>
        </p>
        <p className="flex justify-between gap-2 border-b border-ink-800/60 py-1">
          <span className="text-slate-400">Осадки</span>
          <span>{env.precipitation != null ? `${env.precipitation.toFixed(1)} мм` : "—"}</span>
        </p>
        <p className="flex justify-between gap-2 border-b border-ink-800/60 py-1">
          <span className="text-slate-400">Качество воздуха</span>
          <span className={aqi?.tone === "bad" ? "text-rose-300" : aqi?.tone === "warn" ? "text-amber-300" : "text-emerald-300"}>
            {env.aqi != null ? `${env.aqi} EAQI` : "—"}
            {aqi ? ` · ${aqi.label}` : ""}
          </span>
        </p>
        <p className="flex justify-between gap-2 border-b border-ink-800/60 py-1">
          <span className="text-slate-400">PM2.5 / PM10</span>
          <span>
            {env.pm25 != null ? Math.round(env.pm25) : "—"} / {env.pm10 != null ? Math.round(env.pm10) : "—"} мкг/м³
          </span>
        </p>
        <p className="flex justify-between gap-2 border-b border-ink-800/60 py-1">
          <span className="text-slate-400">Пыльца</span>
          <span className="text-right">
            {pollenEntries.length > 0 ? pollenEntries.join(", ") + " зёрен/м³" : "вне сезона или нет данных"}
          </span>
        </p>
      </div>

      <p className="mt-2 text-xs text-slate-500">
        Пыльцевой прогноз — модельный (CAMS). За пределами Европы он может занижать
        концентрации, поэтому сезонность аллергена учитывается и без него.
      </p>

      {env.sources ? (
        <p className="mt-1 text-xs text-slate-600">
          источники: погода — {env.sources.weather ? SOURCE_LABEL[env.sources.weather] : "нет данных"},
          воздух и пыльца — {env.sources.air ? SOURCE_LABEL[env.sources.air] : "нет данных"}
        </p>
      ) : null}
    </section>
  );
}

export default async function SeasonPage() {
  const sessionUser = await requireUser();

  const profile = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      birthDate: true,
      latitude: true,
      longitude: true,
      locationName: true,
      envEnabled: true,
      incidence: true,
    },
  });

  const [allergies, episodes, chronicActive, vaccinations] = await Promise.all([
    prisma.allergy.findMany({
      where: { userId: sessionUser.id, active: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.condition.findMany({
      where: { userId: sessionUser.id, seasonalKind: { not: null } },
      orderBy: { onsetAt: "desc" },
      take: 30,
    }),
    prisma.condition.count({
      where: { userId: sessionUser.id, status: "active", seasonalKind: null },
    }),
    prisma.medBookEntry.count({
      where: {
        userId: sessionUser.id,
        type: "vaccination",
        issuedAt: { gte: new Date(Date.now() - 365 * 86_400_000) },
      },
    }),
  ]);

  const now = new Date();
  const hasCoords = profile?.latitude != null && profile?.longitude != null;
  const envResult =
    profile?.envEnabled && hasCoords
      ? await getEnvironment(profile.latitude!, profile.longitude!)
      : null;
  const env = envResult?.env ?? null;

  const virus = computeVirusRisk({
    now,
    birthDate: profile?.birthDate ?? null,
    episodes: episodes.map((e) => ({
      kind: e.seasonalKind ?? "other",
      startedAt: e.onsetAt ?? e.createdAt,
    })),
    chronicActive,
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

  const lastEpisode = episodes[0];

  return (
    <>
      <PageHeader
        title="Сезон и аллергии"
        subtitle="Персональная оценка риска по сезону, истории болезней и среде за окном"
      />

      <section className="mb-4 card">
        <h2 className="mb-3 font-medium">Локация и данные о среде</h2>
        <EnvironmentSettings
          initial={{
            latitude: profile?.latitude ?? null,
            longitude: profile?.longitude ?? null,
            locationName: profile?.locationName ?? null,
            envEnabled: profile?.envEnabled ?? false,
            incidence: profile?.incidence ?? null,
          }}
        />
      </section>

      {env ? (
        <div className="mb-4">
          <div className="mb-2 flex justify-end">
            <RefreshButton />
          </div>
          <EnvPanel env={env} />
        </div>
      ) : profile?.envEnabled && hasCoords ? (
        <div className="mb-4 card">
          <p className="muted">
            Источник данных о среде недоступен с этого сервера. Риск посчитан по сезону и
            истории болезней, без погоды.
          </p>
          <DiagnoseButton />
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <RiskCard
          title="Риск сезонной вирусной инфекции"
          risk={virus}
          note={
            lastEpisode
              ? `Последняя болезнь: ${
                  VIRUS_KINDS[lastEpisode.seasonalKind ?? "other"] ?? lastEpisode.title
                }, ${daysBetween(lastEpisode.onsetAt ?? lastEpisode.createdAt, now)} дн. назад.`
              : "История болезней пуста — модель опирается только на сезон и среду."
          }
        />

        {allergyRisk ? (
          <RiskCard
            title="Аллергический риск"
            risk={allergyRisk}
            note={`Учтено аллергенов: ${allergies.length}. Категории: ${[
              ...new Set(allergies.map((a) => CATEGORY_LABEL[a.category] ?? a.category)),
            ].join(", ")}.`}
          />
        ) : (
          <section className="card">
            <h2 className="mb-2 font-medium">Аллергический риск</h2>
            <p className="muted">
              Аллергии не указаны. Добавь их ниже — появится прогноз по пыльце, плесени и пыли.
            </p>
          </section>
        )}
      </div>

      <section className="mt-4 card">
        <h2 className="mb-3 font-medium">Мои аллергии</h2>
        <AllergiesEditor
          items={allergies.map((a) => ({
            id: a.id,
            name: a.name,
            category: a.category,
            severity: a.severity,
            months: a.months,
            notes: a.notes,
            active: a.active,
          }))}
        />
      </section>

      <section className="mt-4 card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium">Перенесённые ОРВИ и грипп</h2>
          <Link href="/conditions?new=seasonal" className="btn">
            + добавить в истории болезней
          </Link>
        </div>

        {episodes.length === 0 ? (
          <p className="muted">
            Записей нет. Отметь перенесённую инфекцию — она попадёт в «Историю болезней»
            и в модель риска.
          </p>
        ) : (
          <ul className="divide-y divide-ink-800/60 text-sm">
            {episodes.map((e) => {
              const start = e.onsetAt ?? e.createdAt;
              const days = daysBetween(start, now);
              return (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    <span className="text-slate-200">{e.title}</span>
                    <span className="ml-2 text-xs text-slate-500">
                      {start.toLocaleDateString("ru-RU")}
                      {e.resolvedAt ? ` — ${e.resolvedAt.toLocaleDateString("ru-RU")}` : ""}
                      {" · "}
                      {e.severity === "severe" ? "тяжёлая" : e.severity === "mild" ? "лёгкая" : "средняя"}
                      {" · "}
                      {days} дн. назад
                    </span>
                  </span>
                  <Link href={`/conditions/${e.id}`} className="text-xs text-slate-500 hover:text-accent">
                    изменить
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="mt-6 text-xs text-slate-500">
        Оценка риска — эвристика, а не медицинский прогноз: она складывает сезонность,
        время с последней болезни, возраст, хронические состояния, вакцинацию и погоду.
        Эпидемиологических данных по региону в свободном доступе нет, поэтому уровень
        заболеваемости в городе можно указать вручную. Решения о лечении и вакцинации
        принимай с врачом.
      </p>
    </>
  );
}

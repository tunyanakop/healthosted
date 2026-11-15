import { PageHeader } from "@/components/page-header";
import { AddDrawer } from "@/components/add-drawer";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { STATUS_MAP, isConditionStatus } from "@/lib/conditions";
import { VisitForm } from "./visit-form";
import { VisitActions } from "./visit-actions";
import { Attachments } from "@/components/attachments";

export const dynamic = "force-dynamic";

function fmt(date: Date): string {
  return date.toLocaleDateString("ru-RU");
}

export default async function VisitsPage() {
  const user = await requireUser();

  const [visits, conditions] = await Promise.all([
    prisma.visit.findMany({
      where: { userId: user.id },
      orderBy: { visitedAt: "desc" },
      include: {
        condition: { select: { id: true, title: true, status: true } },
        attachments: { orderBy: { createdAt: "asc" } },
      },
    }),
    prisma.condition.findMany({
      where: { userId: user.id },
      orderBy: { title: "asc" },
      select: { id: true, title: true },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Посещения врача"
        subtitle="Кто, когда, с чем пришёл и что назначили. Сканы и PDF — прямо к визиту"
      />

      <AddDrawer label="Добавить посещение врача">
        <VisitForm conditions={conditions} />
      </AddDrawer>

      {visits.length === 0 ? (
        <div className="card muted">Визитов пока нет. Первый — в форме выше.</div>
      ) : (
        <div className="space-y-3">
          {visits.map((v) => (
            <article key={v.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <h3 className="font-medium">{fmt(v.visitedAt)}</h3>
                    {v.doctorName ? <span className="text-sm text-slate-300">{v.doctorName}</span> : null}
                    {v.specialty ? (
                      <span className="rounded border border-ink-700 px-1.5 py-0.5 text-[10px] text-slate-400">
                        {v.specialty}
                      </span>
                    ) : null}
                    {v.condition ? (
                      <a
                        href={`/conditions/${v.condition.id}`}
                        className={`rounded border px-1.5 py-0.5 text-[10px] hover:underline ${
                          isConditionStatus(v.condition.status)
                            ? STATUS_MAP[v.condition.status].badge
                            : "border-ink-700 text-slate-300"
                        }`}
                      >
                        {v.condition.title}
                      </a>
                    ) : null}
                  </div>

                  {v.clinic ? <p className="mt-1 text-xs text-slate-500">{v.clinic}</p> : null}

                  <dl className="mt-2 space-y-1 text-sm">
                    {v.reason ? (
                      <div className="flex gap-2">
                        <dt className="w-28 shrink-0 text-xs text-slate-500">Причина</dt>
                        <dd className="text-slate-300">{v.reason}</dd>
                      </div>
                    ) : null}
                    {v.diagnosis ? (
                      <div className="flex gap-2">
                        <dt className="w-28 shrink-0 text-xs text-slate-500">Диагноз</dt>
                        <dd className="text-slate-300">{v.diagnosis}</dd>
                      </div>
                    ) : null}
                    {v.conclusion ? (
                      <div className="flex gap-2">
                        <dt className="w-28 shrink-0 text-xs text-slate-500">Заключение</dt>
                        <dd className="text-slate-300">{v.conclusion}</dd>
                      </div>
                    ) : null}
                    {v.recommendations ? (
                      <div className="flex gap-2">
                        <dt className="w-28 shrink-0 text-xs text-slate-500">Назначения</dt>
                        <dd className="whitespace-pre-line text-slate-300">{v.recommendations}</dd>
                      </div>
                    ) : null}
                  </dl>
                </div>

                <VisitActions id={v.id} />
              </div>

              <Attachments
                uploadUrl={`/api/visits/${v.id}/attachments`}
                items={v.attachments.map((a) => ({
                  id: a.id,
                  filename: a.filename,
                  size: a.size,
                  mime: a.mime,
                }))}
              />
            </article>
          ))}
        </div>
      )}
    </>
  );
}

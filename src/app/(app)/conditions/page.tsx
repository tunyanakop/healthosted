import { PageHeader } from "@/components/page-header";
import { AddDrawer } from "@/components/add-drawer";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { STATUS_MAP, durationLabel, isConditionStatus } from "@/lib/conditions";
import { VIRUS_KINDS } from "@/lib/season";
import { ConditionForm } from "./condition-form";
import { ConditionActions } from "./condition-actions";

export const dynamic = "force-dynamic";

function fmt(date: Date | null): string {
  return date ? date.toLocaleDateString("ru-RU") : "—";
}

export default async function ConditionsPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const openSeasonal = params.new === "seasonal";

  const items = await prisma.condition.findMany({
    where: { userId: user.id },
    orderBy: [{ onsetAt: "desc" }, { createdAt: "desc" }],
    include: { _count: { select: { visits: true } } },
  });

  const groups = ["active", "remission", "resolved"] as const;

  return (
    <>
      <PageHeader
        title="История болезней"
        subtitle="Диагнозы и состояния: что было, когда началось и чем закончилось"
      />

      <AddDrawer
        label="Добавить болезнь или состояние"
        defaultOpen={openSeasonal}
      >
        <ConditionForm presetSeasonal={openSeasonal} />
      </AddDrawer>

      {items.length === 0 ? (
        <div className="card muted">Пока пусто. Первая запись — в форме выше.</div>
      ) : (
        <div className="space-y-6">
          {groups.map((status) => {
            const list = items.filter((i) => i.status === status);
            if (list.length === 0) return null;
            const meta = STATUS_MAP[status];

            return (
              <section key={status}>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-300">
                  <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                  {meta.label}
                  <span className="text-xs text-slate-500">{list.length}</span>
                </h2>

                <div className="space-y-3">
                  {list.map((item) => {
                    const duration = durationLabel(item.onsetAt, item.resolvedAt);
                    const badge = isConditionStatus(item.status)
                      ? STATUS_MAP[item.status].badge
                      : "border-ink-700 text-slate-300";

                    return (
                      <article key={item.id} className="card">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-medium">{item.title}</h3>
                              {item.icd10 ? (
                                <span className="rounded border border-ink-700 px-1.5 py-0.5 text-[10px] text-slate-400">
                                  {item.icd10}
                                </span>
                              ) : null}
                              <span className={`rounded border px-1.5 py-0.5 text-[10px] ${badge}`}>
                                {isConditionStatus(item.status)
                                  ? STATUS_MAP[item.status].label
                                  : item.status}
                              </span>
                              {item.seasonalKind ? (
                                <span className="rounded border border-cyan-500/40 bg-cyan-500/10 px-1.5 py-0.5 text-[10px] text-cyan-300">
                                  {VIRUS_KINDS[item.seasonalKind] ?? item.seasonalKind}
                                </span>
                              ) : null}
                            </div>

                            <p className="mt-1 text-xs text-slate-400">
                              {fmt(item.onsetAt)} → {fmt(item.resolvedAt)}
                              {duration ? ` · ${duration}` : ""}
                              {item._count.visits > 0 ? ` · визитов: ${item._count.visits}` : ""}
                            </p>

                            {item.notes ? (
                              <p className="mt-2 whitespace-pre-line text-sm text-slate-300">
                                {item.notes}
                              </p>
                            ) : null}
                          </div>

                          <ConditionActions id={item.id} />
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}

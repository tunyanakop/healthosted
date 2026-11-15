import { PageHeader } from "@/components/page-header";
import { AddDrawer } from "@/components/add-drawer";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { FLAG_META, isAbnormal, type LabFlag } from "@/lib/labs";
import { kindLabel } from "@/lib/lab-templates";
import { LabCreateForm } from "./create-form";

export const dynamic = "force-dynamic";

export default async function LabsPage() {
  const user = await requireUser();

  const panels = await prisma.labPanel.findMany({
    where: { userId: user.id },
    orderBy: { takenAt: "desc" },
    include: {
      results: { orderBy: { name: "asc" } },
      _count: { select: { attachments: true } },
    },
  });

  return (
    <>
      <PageHeader
        title="Анализы"
        subtitle="Панели по датам и типам исследований: показатели с референсами, отклонения подсвечиваются"
      />

      <AddDrawer
        label="Добавить анализ"
        hint="Выбери тип исследования — поля подставятся автоматически"
      >
        <LabCreateForm sex={user.sex} />
      </AddDrawer>

      {panels.length === 0 ? (
        <div className="card muted">
          Анализов пока нет. Нажми «Добавить анализ», выбери тип — и заполни то, что есть в бланке.
        </div>
      ) : (
        <div className="space-y-3">
          {panels.map((p) => {
            const abnormal = p.results.filter((r) => isAbnormal(r.flag));
            return (
              <article key={p.id} className="card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium">{p.takenAt.toLocaleDateString("ru-RU")}</h3>
                      <span className="rounded border border-ink-700 px-1.5 py-0.5 text-[10px] text-slate-400">
                        {kindLabel(p.kind)}
                      </span>
                      {p.labName ? (
                        <span className="text-sm text-slate-300">{p.labName}</span>
                      ) : null}
                      {abnormal.length > 0 ? (
                        <span className="rounded border border-rose-500/40 bg-rose-500/10 px-1.5 py-0.5 text-[10px] text-rose-300">
                          отклонений: {abnormal.length}
                        </span>
                      ) : p.results.length > 0 ? (
                        <span className="rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-300">
                          всё в норме
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-1 text-xs text-slate-500">
                      показателей: {p.results.length}
                      {p._count.attachments > 0 ? ` · файлов: ${p._count.attachments}` : ""}
                    </p>

                    {p.notes ? <p className="mt-1 text-xs text-slate-400">{p.notes}</p> : null}

                    {abnormal.length > 0 ? (
                      <p className="mt-2 text-xs text-slate-400">
                        {abnormal
                          .slice(0, 4)
                          .map(
                            (r) =>
                              `${r.name}: ${r.value} ${r.unit ?? ""} (${
                                FLAG_META[r.flag as LabFlag]?.label ?? r.flag
                              })`,
                          )
                          .join(" · ")}
                        {abnormal.length > 4 ? ` · ещё ${abnormal.length - 4}` : ""}
                      </p>
                    ) : null}
                  </div>

                  <a href={`/labs/${p.id}`} className="btn">
                    Открыть
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}

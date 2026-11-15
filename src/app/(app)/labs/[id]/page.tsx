import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Attachments } from "@/components/attachments";
import { LabInterpretation } from "@/components/lab-interpretation";
import { LabPatterns } from "@/components/lab-patterns";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { isAbnormal, isCritical } from "@/lib/labs";
import { kindLabel } from "@/lib/lab-templates";
import { LabActions } from "../lab-actions";
import { ResultsGrid } from "./results-grid";

export const dynamic = "force-dynamic";

export default async function LabPanelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const panel = await prisma.labPanel.findFirst({
    where: { id, userId: user.id },
    include: {
      results: { orderBy: { name: "asc" } },
      attachments: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!panel) notFound();

  const abnormal = panel.results.filter((r) => isAbnormal(r.flag));
  const critical = panel.results.filter((r) => isCritical(r.flag));

  return (
    <>
      <PageHeader
        title={panel.takenAt.toLocaleDateString("ru-RU")}
        subtitle={`${kindLabel(panel.kind)}${panel.labName ? ` · ${panel.labName}` : ""}`}
      />

      {critical.length > 0 ? (
        <div className="mb-4 card border-rose-500/50 bg-rose-500/10">
          <p className="text-sm font-medium text-rose-100">
            Критическое значение:{" "}
            {critical.map((r) => `${r.name} — ${r.value} ${r.unit ?? ""}`).join("; ")}
          </p>
          <p className="mt-1 text-xs text-rose-200/80">
            Это не диагноз, но такие значения обычно требуют быстрой консультации врача.
          </p>
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        {abnormal.length > 0 ? (
          <span className="rounded border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-xs text-rose-300">
            отклонений: {abnormal.length} из {panel.results.length}
          </span>
        ) : panel.results.length > 0 ? (
          <span className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300">
            все показатели в норме
          </span>
        ) : (
          <span className="rounded border border-ink-700 px-2 py-1 text-xs text-slate-400">
            показатели не заполнены
          </span>
        )}
        {panel.notes ? <span className="text-xs text-slate-400">{panel.notes}</span> : null}
        <div className="ml-auto">
          <LabActions id={panel.id} />
        </div>
      </div>

      <ResultsGrid
        panelId={panel.id}
        kind={panel.kind}
        initial={panel.results.map((r) => ({
          name: r.name,
          value: r.value,
          unit: r.unit,
          refMin: r.refMin,
          refMax: r.refMax,
          testCode: r.testCode,
          appliedNote: r.appliedNote,
          flag: r.flag,
          numericValue: r.numericValue,
        }))}
      />

      <div className="mt-4">
        <LabPatterns
          results={panel.results.map((r) => ({
            testCode: r.testCode,
            value: r.value,
            numericValue: r.numericValue,
            unit: r.unit,
            flag: r.flag,
          }))}
        />
      </div>

      <div className="mt-4">
        <LabInterpretation
          results={panel.results.map((r) => ({
            name: r.name,
            testCode: r.testCode,
            value: r.value,
            unit: r.unit,
            flag: r.flag,
            appliedNote: r.appliedNote,
          }))}
        />
      </div>

      <section className="mt-4 card">
        <h2 className="mb-1 font-medium">Файлы результата</h2>
        <p className="mb-2 text-xs text-slate-500">
          PDF из лаборатории или фото бланка — хранятся в томе, доступны только тебе.
        </p>
        <Attachments
          uploadUrl={`/api/labs/${panel.id}/attachments`}
          items={panel.attachments.map((a) => ({
            id: a.id,
            filename: a.filename,
            size: a.size,
            mime: a.mime,
          }))}
        />
      </section>
    </>
  );
}

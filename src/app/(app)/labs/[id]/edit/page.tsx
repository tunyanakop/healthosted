import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { LabPanelForm } from "../../lab-form";

export const dynamic = "force-dynamic";

export default async function EditLabPanelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const panel = await prisma.labPanel.findFirst({ where: { id, userId: user.id } });
  if (!panel) notFound();

  return (
    <>
      <PageHeader
        title="Изменить панель"
        subtitle={panel.takenAt.toLocaleDateString("ru-RU")}
      />
      <section className="card">
        <LabPanelForm
          mode="edit"
          sex={user.sex}
          initial={{
            id: panel.id,
            takenAt: panel.takenAt.toISOString().slice(0, 10),
            kind: panel.kind ?? "custom",
            labName: panel.labName ?? "",
            context: {
              specimen: panel.specimen ?? "any",
              pregnant: Boolean(panel.pregnant),
              trimester: panel.trimester ? String(panel.trimester) : "1",
              menopause: Boolean(panel.menopause),
              cyclePhase: panel.cyclePhase ?? "",
            },
            notes: panel.notes ?? "",
          }}
        />
      </section>
    </>
  );
}

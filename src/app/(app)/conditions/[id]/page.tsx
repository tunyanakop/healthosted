import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { ConditionForm } from "../condition-form";

export const dynamic = "force-dynamic";

export default async function EditConditionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const item = await prisma.condition.findFirst({ where: { id, userId: user.id } });
  if (!item) notFound();

  return (
    <>
      <PageHeader title="Изменить состояние" subtitle={item.title} />
      <section className="card">
        <ConditionForm
          mode="edit"
          initial={{
            id: item.id,
            title: item.title,
            icd10: item.icd10 ?? "",
            status: item.status,
            onsetAt: item.onsetAt ? item.onsetAt.toISOString().slice(0, 10) : "",
            resolvedAt: item.resolvedAt ? item.resolvedAt.toISOString().slice(0, 10) : "",
            notes: item.notes ?? "",
            seasonalKind: item.seasonalKind ?? "",
            severity: item.severity ?? "moderate",
          }}
        />
      </section>
    </>
  );
}

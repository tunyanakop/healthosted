import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { VisitForm } from "../visit-form";

export const dynamic = "force-dynamic";

export default async function EditVisitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const [visit, conditions] = await Promise.all([
    prisma.visit.findFirst({ where: { id, userId: user.id } }),
    prisma.condition.findMany({
      where: { userId: user.id },
      orderBy: { title: "asc" },
      select: { id: true, title: true },
    }),
  ]);

  if (!visit) notFound();

  return (
    <>
      <PageHeader
        title="Изменить визит"
        subtitle={visit.visitedAt.toLocaleDateString("ru-RU")}
      />
      <section className="card">
        <VisitForm
          mode="edit"
          conditions={conditions}
          initial={{
            id: visit.id,
            visitedAt: visit.visitedAt.toISOString().slice(0, 10),
            doctorName: visit.doctorName ?? "",
            specialty: visit.specialty ?? "",
            clinic: visit.clinic ?? "",
            reason: visit.reason ?? "",
            diagnosis: visit.diagnosis ?? "",
            conclusion: visit.conclusion ?? "",
            recommendations: visit.recommendations ?? "",
            conditionId: visit.conditionId ?? "",
          }}
        />
      </section>
    </>
  );
}

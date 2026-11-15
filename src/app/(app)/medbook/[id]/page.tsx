import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { typeLabel } from "@/lib/medbook";
import { MedBookForm } from "../medbook-form";

export const dynamic = "force-dynamic";

export default async function EditMedBookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const item = await prisma.medBookEntry.findFirst({ where: { id, userId: user.id } });
  if (!item) notFound();

  return (
    <>
      <PageHeader title="Изменить документ" subtitle={typeLabel(item.type)} />
      <section className="card">
        <MedBookForm
          mode="edit"
          initial={{
            id: item.id,
            type: item.type,
            number: item.number ?? "",
            issuer: item.issuer ?? "",
            issuedAt: item.issuedAt ? item.issuedAt.toISOString().slice(0, 10) : "",
            validUntil: item.validUntil ? item.validUntil.toISOString().slice(0, 10) : "",
            notes: item.notes ?? "",
          }}
        />
      </section>
    </>
  );
}

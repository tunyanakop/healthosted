import { PageHeader } from "@/components/page-header";
import { AddDrawer } from "@/components/add-drawer";
import { Attachments } from "@/components/attachments";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { expiry, SOON_DAYS, typeLabel, urgencyRank } from "@/lib/medbook";
import { MedBookForm } from "./medbook-form";
import { MedBookActions } from "./medbook-actions";

export const dynamic = "force-dynamic";

function fmt(date: Date | null): string {
  return date ? date.toLocaleDateString("ru-RU") : "—";
}

export default async function MedBookPage() {
  const user = await requireUser();

  const items = await prisma.medBookEntry.findMany({
    where: { userId: user.id },
    include: { attachments: { orderBy: { createdAt: "asc" } } },
  });

  const now = new Date();
  const sorted = [...items].sort((a, b) => {
    const rank = urgencyRank(a.validUntil, now) - urgencyRank(b.validUntil, now);
    if (rank !== 0) return rank;
    const at = a.validUntil?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const bt = b.validUntil?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return at - bt;
  });

  const attention = sorted.filter((i) => {
    const e = expiry(i.validUntil, now);
    return e.state === "expired" || e.state === "soon";
  });

  return (
    <>
      <PageHeader
        title="Медкнижка"
        subtitle="Флюорография, медосмотр, санминимум, прививки — со сроками и сканами"
      />

      {attention.length > 0 ? (
        <div className="mb-4 card border-amber-500/30 bg-amber-500/5">
          <p className="text-sm text-amber-200">
            Требует внимания: {attention.map((i) => typeLabel(i.type)).join(", ")}.{" "}
            {attention.some((i) => expiry(i.validUntil, now).state === "expired")
              ? "Есть просроченные документы."
              : `Что-то истекает в ближайшие ${SOON_DAYS} дней.`}
          </p>
        </div>
      ) : null}

      <AddDrawer label="Добавить документ">
        <MedBookForm />
      </AddDrawer>

      {sorted.length === 0 ? (
        <div className="card muted">
          Записей нет. Начни с флюорографии или медосмотра — дальше система сама напомнит о сроках.
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {sorted.map((item) => {
            const e = expiry(item.validUntil, now);
            return (
              <article key={item.id} className="card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium">{typeLabel(item.type)}</h3>
                      <span className={`rounded border px-1.5 py-0.5 text-[10px] ${e.badge}`}>
                        {e.label}
                      </span>
                    </div>

                    <p className="mt-1 text-xs text-slate-400">
                      выдано {fmt(item.issuedAt)} · до {fmt(item.validUntil)}
                      {item.number ? ` · № ${item.number}` : ""}
                    </p>
                    {item.issuer ? (
                      <p className="mt-0.5 text-xs text-slate-500">{item.issuer}</p>
                    ) : null}
                    {item.notes ? (
                      <p className="mt-2 whitespace-pre-line text-sm text-slate-300">{item.notes}</p>
                    ) : null}
                  </div>

                  <MedBookActions id={item.id} />
                </div>

                <Attachments
                  uploadUrl={`/api/medbook/${item.id}/attachments`}
                  items={item.attachments.map((a) => ({
                    id: a.id,
                    filename: a.filename,
                    size: a.size,
                    mime: a.mime,
                  }))}
                />
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}

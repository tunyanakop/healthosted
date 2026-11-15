import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { clientIp, jsonError, readJson, sameOrigin } from "@/lib/http";
import { firstIssue, medbookSchema } from "@/lib/validation";
import { getSessionUser } from "@/lib/session";
import { deleteUpload } from "@/lib/storage";

export const dynamic = "force-dynamic";

const toDate = (value?: string) => (value ? new Date(`${value}T00:00:00.000Z`) : null);

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!sameOrigin(req)) return jsonError("Запрос отклонён", 403);

  const user = await getSessionUser();
  if (!user) return jsonError("Требуется вход", 401);

  const { id } = await params;
  const existing = await prisma.medBookEntry.findFirst({ where: { id, userId: user.id } });
  if (!existing) return jsonError("Запись не найдена", 404);

  const body = await readJson(req);
  if (body === undefined) return jsonError("Некорректный JSON", 400);

  const parsed = medbookSchema.safeParse(body);
  if (!parsed.success) return jsonError(firstIssue(parsed.error), 422);

  const { type, number, issuer, issuedAt, validUntil, notes } = parsed.data;

  const item = await prisma.medBookEntry.update({
    where: { id },
    data: {
      type,
      number: number ?? null,
      issuer: issuer ?? null,
      issuedAt: toDate(issuedAt),
      validUntil: toDate(validUntil),
      notes: notes ?? null,
    },
  });

  await audit(user.id, "update", "medbook", id, clientIp(req));
  return Response.json({ item });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!sameOrigin(req)) return jsonError("Запрос отклонён", 403);

  const user = await getSessionUser();
  if (!user) return jsonError("Требуется вход", 401);

  const { id } = await params;
  const existing = await prisma.medBookEntry.findFirst({
    where: { id, userId: user.id },
    include: { attachments: true },
  });
  if (!existing) return jsonError("Запись не найдена", 404);

  await prisma.medBookEntry.delete({ where: { id } });
  await Promise.all(existing.attachments.map((a) => deleteUpload(a.storedPath)));
  await audit(user.id, "delete", "medbook", id, clientIp(req));

  return Response.json({ ok: true });
}

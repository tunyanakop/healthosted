import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { clientIp, jsonError, readJson, sameOrigin } from "@/lib/http";
import { firstIssue, visitSchema } from "@/lib/validation";
import { getSessionUser } from "@/lib/session";
import { deleteUpload } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!sameOrigin(req)) return jsonError("Запрос отклонён", 403);

  const user = await getSessionUser();
  if (!user) return jsonError("Требуется вход", 401);

  const { id } = await params;
  const existing = await prisma.visit.findFirst({ where: { id, userId: user.id } });
  if (!existing) return jsonError("Запись не найдена", 404);

  const body = await readJson(req);
  if (body === undefined) return jsonError("Некорректный JSON", 400);

  const parsed = visitSchema.safeParse(body);
  if (!parsed.success) return jsonError(firstIssue(parsed.error), 422);

  const { conditionId, ...rest } = parsed.data;

  if (conditionId) {
    const owns = await prisma.condition.findFirst({
      where: { id: conditionId, userId: user.id },
      select: { id: true },
    });
    if (!owns) return jsonError("Состояние не найдено", 422);
  }

  const item = await prisma.visit.update({
    where: { id },
    data: {
      visitedAt: new Date(`${rest.visitedAt}T00:00:00.000Z`),
      doctorName: rest.doctorName ?? null,
      specialty: rest.specialty ?? null,
      clinic: rest.clinic ?? null,
      reason: rest.reason ?? null,
      diagnosis: rest.diagnosis ?? null,
      conclusion: rest.conclusion ?? null,
      recommendations: rest.recommendations ?? null,
      conditionId: conditionId ?? null,
    },
  });

  await audit(user.id, "update", "visit", id, clientIp(req));
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
  const existing = await prisma.visit.findFirst({
    where: { id, userId: user.id },
    include: { attachments: true },
  });
  if (!existing) return jsonError("Запись не найдена", 404);

  await prisma.visit.delete({ where: { id } });
  await Promise.all(existing.attachments.map((a) => deleteUpload(a.storedPath)));
  await audit(user.id, "delete", "visit", id, clientIp(req));

  return Response.json({ ok: true });
}

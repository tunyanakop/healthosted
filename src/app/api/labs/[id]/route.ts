import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { clientIp, jsonError, readJson, sameOrigin } from "@/lib/http";
import { firstIssue, labPanelSchema } from "@/lib/validation";
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
  const existing = await prisma.labPanel.findFirst({ where: { id, userId: user.id } });
  if (!existing) return jsonError("Панель не найдена", 404);

  const body = await readJson(req);
  if (body === undefined) return jsonError("Некорректный JSON", 400);

  const parsed = labPanelSchema.safeParse(body);
  if (!parsed.success) return jsonError(firstIssue(parsed.error), 422);

  const item = await prisma.labPanel.update({
    where: { id },
    data: {
      takenAt: new Date(`${parsed.data.takenAt}T00:00:00.000Z`),
      kind: parsed.data.kind ?? null,
      specimen: parsed.data.specimen ?? null,
      pregnant: parsed.data.pregnant ?? null,
      trimester: parsed.data.trimester ?? null,
      menopause: parsed.data.menopause ?? null,
      cyclePhase: parsed.data.cyclePhase ?? null,
      labName: parsed.data.labName ?? null,
      notes: parsed.data.notes ?? null,
    },
  });

  await audit(user.id, "update", "labPanel", id, clientIp(req));
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
  const existing = await prisma.labPanel.findFirst({
    where: { id, userId: user.id },
    include: { attachments: true },
  });
  if (!existing) return jsonError("Панель не найдена", 404);

  await prisma.labPanel.delete({ where: { id } });
  await Promise.all(existing.attachments.map((a) => deleteUpload(a.storedPath)));
  await audit(user.id, "delete", "labPanel", id, clientIp(req));

  return Response.json({ ok: true });
}

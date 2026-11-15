import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { clientIp, jsonError, readJson, sameOrigin } from "@/lib/http";
import { allergySchema, firstIssue } from "@/lib/validation";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!sameOrigin(req)) return jsonError("Запрос отклонён", 403);

  const user = await getSessionUser();
  if (!user) return jsonError("Требуется вход", 401);

  const { id } = await params;
  const existing = await prisma.allergy.findFirst({ where: { id, userId: user.id } });
  if (!existing) return jsonError("Аллергия не найдена", 404);

  const body = await readJson(req);
  if (body === undefined) return jsonError("Некорректный JSON", 400);

  const parsed = allergySchema.safeParse(body);
  if (!parsed.success) return jsonError(firstIssue(parsed.error), 422);

  const item = await prisma.allergy.update({
    where: { id },
    data: {
      name: parsed.data.name,
      category: parsed.data.category,
      severity: parsed.data.severity,
      months: parsed.data.months ?? null,
      notes: parsed.data.notes ?? null,
      active: parsed.data.active,
    },
  });

  await audit(user.id, "update", "allergy", id, clientIp(req));
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
  const existing = await prisma.allergy.findFirst({ where: { id, userId: user.id } });
  if (!existing) return jsonError("Аллергия не найдена", 404);

  await prisma.allergy.delete({ where: { id } });
  await audit(user.id, "delete", "allergy", id, clientIp(req));

  return Response.json({ ok: true });
}

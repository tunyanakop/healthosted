import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { clientIp, jsonError, readJson, sameOrigin } from "@/lib/http";
import { firstIssue, visitSchema } from "@/lib/validation";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return jsonError("Требуется вход", 401);

  const items = await prisma.visit.findMany({
    where: { userId: user.id },
    orderBy: { visitedAt: "desc" },
    include: {
      condition: { select: { id: true, title: true } },
      attachments: { orderBy: { createdAt: "asc" } },
    },
  });

  return Response.json({ items });
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return jsonError("Запрос отклонён", 403);

  const user = await getSessionUser();
  if (!user) return jsonError("Требуется вход", 401);

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

  const item = await prisma.visit.create({
    data: {
      userId: user.id,
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

  await audit(user.id, "create", "visit", item.id, clientIp(req));
  return Response.json({ item }, { status: 201 });
}

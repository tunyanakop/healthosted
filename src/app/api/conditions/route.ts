import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { clientIp, jsonError, readJson, sameOrigin } from "@/lib/http";
import { conditionSchema, firstIssue } from "@/lib/validation";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const toDate = (value?: string) => (value ? new Date(`${value}T00:00:00.000Z`) : null);

export async function GET() {
  const user = await getSessionUser();
  if (!user) return jsonError("Требуется вход", 401);

  const items = await prisma.condition.findMany({
    where: { userId: user.id },
    orderBy: [{ status: "asc" }, { onsetAt: "desc" }, { createdAt: "desc" }],
    include: { _count: { select: { visits: true } } },
  });

  return Response.json({ items });
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return jsonError("Запрос отклонён", 403);

  const user = await getSessionUser();
  if (!user) return jsonError("Требуется вход", 401);

  const body = await readJson(req);
  if (body === undefined) return jsonError("Некорректный JSON", 400);

  const parsed = conditionSchema.safeParse(body);
  if (!parsed.success) return jsonError(firstIssue(parsed.error), 422);

  const { title, icd10, status, onsetAt, resolvedAt, notes, seasonalKind, severity } = parsed.data;

  const item = await prisma.condition.create({
    data: {
      userId: user.id,
      title,
      icd10: icd10 ?? null,
      status,
      onsetAt: toDate(onsetAt),
      resolvedAt: toDate(resolvedAt),
      notes: notes ?? null,
      seasonalKind: seasonalKind ?? null,
      severity: seasonalKind ? (severity ?? "moderate") : null,
    },
  });

  await audit(user.id, "create", "condition", item.id, clientIp(req));
  return Response.json({ item }, { status: 201 });
}

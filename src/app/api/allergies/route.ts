import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { clientIp, jsonError, readJson, sameOrigin } from "@/lib/http";
import { allergySchema, firstIssue } from "@/lib/validation";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return jsonError("Требуется вход", 401);

  const items = await prisma.allergy.findMany({
    where: { userId: user.id },
    orderBy: [{ active: "desc" }, { createdAt: "asc" }],
  });

  return Response.json({ items });
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return jsonError("Запрос отклонён", 403);

  const user = await getSessionUser();
  if (!user) return jsonError("Требуется вход", 401);

  const body = await readJson(req);
  if (body === undefined) return jsonError("Некорректный JSON", 400);

  const parsed = allergySchema.safeParse(body);
  if (!parsed.success) return jsonError(firstIssue(parsed.error), 422);

  const item = await prisma.allergy.create({
    data: {
      userId: user.id,
      name: parsed.data.name,
      category: parsed.data.category,
      severity: parsed.data.severity,
      months: parsed.data.months ?? null,
      notes: parsed.data.notes ?? null,
      active: parsed.data.active,
    },
  });

  await audit(user.id, "create", "allergy", item.id, clientIp(req));
  return Response.json({ item }, { status: 201 });
}

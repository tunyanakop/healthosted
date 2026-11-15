import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { clientIp, jsonError, readJson, sameOrigin } from "@/lib/http";
import { firstIssue, measurementSchema } from "@/lib/validation";
import { isKind } from "@/lib/measurements";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return jsonError("Требуется вход", 401);

  const url = new URL(req.url);
  const kind = url.searchParams.get("kind");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 200) || 200, 500);

  const items = await prisma.measurement.findMany({
    where: {
      userId: user.id,
      ...(kind && isKind(kind) ? { kind } : {}),
    },
    orderBy: { measuredAt: "desc" },
    take: limit,
  });

  return Response.json({ items });
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return jsonError("Запрос отклонён", 403);

  const user = await getSessionUser();
  if (!user) return jsonError("Требуется вход", 401);

  const body = await readJson(req);
  if (body === undefined) return jsonError("Некорректный JSON", 400);

  const parsed = measurementSchema.safeParse(body);
  if (!parsed.success) return jsonError(firstIssue(parsed.error), 422);

  const { kind, value, value2, measuredAt, note } = parsed.data;
  const iso = measuredAt.length === 10 ? `${measuredAt}T00:00:00.000Z` : `${measuredAt}:00.000Z`;

  const item = await prisma.measurement.create({
    data: {
      userId: user.id,
      kind,
      value,
      value2: kind === "bp" ? (value2 ?? null) : null,
      unit: undefined,
      measuredAt: new Date(iso),
      note: note ?? null,
    },
  });

  await audit(user.id, "create", "measurement", item.id, clientIp(req));

  return Response.json({ item }, { status: 201 });
}

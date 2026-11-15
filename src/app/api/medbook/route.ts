import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { clientIp, jsonError, readJson, sameOrigin } from "@/lib/http";
import { firstIssue, medbookSchema } from "@/lib/validation";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const toDate = (value?: string) => (value ? new Date(`${value}T00:00:00.000Z`) : null);

export async function GET() {
  const user = await getSessionUser();
  if (!user) return jsonError("Требуется вход", 401);

  const items = await prisma.medBookEntry.findMany({
    where: { userId: user.id },
    orderBy: [{ validUntil: "asc" }, { createdAt: "desc" }],
    include: { attachments: { orderBy: { createdAt: "asc" } } },
  });

  return Response.json({ items });
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return jsonError("Запрос отклонён", 403);

  const user = await getSessionUser();
  if (!user) return jsonError("Требуется вход", 401);

  const body = await readJson(req);
  if (body === undefined) return jsonError("Некорректный JSON", 400);

  const parsed = medbookSchema.safeParse(body);
  if (!parsed.success) return jsonError(firstIssue(parsed.error), 422);

  const { type, number, issuer, issuedAt, validUntil, notes } = parsed.data;

  const item = await prisma.medBookEntry.create({
    data: {
      userId: user.id,
      type,
      number: number ?? null,
      issuer: issuer ?? null,
      issuedAt: toDate(issuedAt),
      validUntil: toDate(validUntil),
      notes: notes ?? null,
    },
  });

  await audit(user.id, "create", "medbook", item.id, clientIp(req));
  return Response.json({ item }, { status: 201 });
}

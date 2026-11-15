import { audit } from "@/lib/audit";
import { clientIp, jsonError, sameOrigin } from "@/lib/http";
import { destroySession, getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return jsonError("Запрос отклонён", 403);

  const user = await getSessionUser();
  await destroySession();
  if (user) await audit(user.id, "logout", "user", user.id, clientIp(req));

  return Response.json({ ok: true });
}

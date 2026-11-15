import { prisma } from "@/lib/db";

export async function audit(
  userId: string | null,
  action: string,
  entityType?: string,
  entityId?: string,
  ip?: string | null,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entityType: entityType ?? null,
        entityId: entityId ?? null,
        ip: ip ?? null,
      },
    });
  } catch {
    // аудит не должен ронять основной сценарий
  }
}

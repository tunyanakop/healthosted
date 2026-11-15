import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "ok",
      db: "ok",
      version: env.appVersion,
      uptimeSec: Math.round(process.uptime()),
      ts: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      { status: "error", db: "unreachable", version: env.appVersion },
      { status: 503 },
    );
  }
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getSessionUser()) redirect("/dashboard");
  const userCount = await prisma.user.count();

  return (
    <>
      <h1 className="mb-1 text-lg font-semibold">Вход</h1>
      <p className="mb-5 muted">Личный медицинский архив</p>

      <LoginForm />

      {userCount === 0 ? (
        <p className="mt-4 text-sm text-slate-400">
          Аккаунтов ещё нет.{" "}
          <Link href="/register" className="text-accent hover:underline">
            Создать первый
          </Link>
        </p>
      ) : null}
    </>
  );
}

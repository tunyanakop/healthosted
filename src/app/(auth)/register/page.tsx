import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { RegisterForm } from "./register-form";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  if (await getSessionUser()) redirect("/dashboard");
  const userCount = await prisma.user.count();
  if (userCount > 0) redirect("/login");

  return (
    <>
      <h1 className="mb-1 text-lg font-semibold">Первый запуск</h1>
      <p className="mb-5 muted">
        Создай единственный аккаунт владельца. Регистрация закроется после этого.
      </p>

      <RegisterForm />

      <p className="mt-4 text-sm text-slate-400">
        Уже есть аккаунт?{" "}
        <Link href="/login" className="text-accent hover:underline">
          Войти
        </Link>
      </p>
    </>
  );
}

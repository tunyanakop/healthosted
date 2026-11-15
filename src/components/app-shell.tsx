import Link from "next/link";
import type { ReactNode } from "react";
import { LogoutButton } from "@/components/logout-button";

const NAV = [
  { href: "/dashboard", label: "Дашборд" },
  { href: "/measurements", label: "Измерения" },
  { href: "/conditions", label: "Болезни" },
  { href: "/visits", label: "Посещения" },
  { href: "/medbook", label: "Медкнижка" },
  { href: "/labs", label: "Анализы" },
  { href: "/season", label: "Сезон" },
  { href: "/reports", label: "Отчёт" },
  { href: "/settings", label: "Настройки" },
];

export function AppShell({
  user,
  children,
}: {
  user: { name: string | null; email: string };
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-ink-700/80 bg-ink-900/40 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg border border-accent/40 bg-accent/10 text-accent">
              ⚕
            </span>
            <span className="text-sm font-semibold tracking-tight">
              Healt<span className="text-accent">Hosted</span>
            </span>
          </Link>

          <nav className="flex flex-wrap gap-1 text-sm">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-2.5 py-1.5 text-slate-300 transition-colors hover:bg-ink-800 hover:text-accent"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-xs text-slate-400 sm:inline">
              {user.name || user.email}
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>

      <footer className="mx-auto max-w-6xl px-4 pb-8 pt-4 text-xs text-slate-500">
        HealtHosted 0.4.0 · локальный архив, данные не уходят наружу
      </footer>
    </div>
  );
}

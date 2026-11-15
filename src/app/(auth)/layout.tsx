export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg border border-accent/40 bg-accent/10 text-accent">
            ⚕
          </span>
          <span className="text-lg font-semibold tracking-tight">
            Healt<span className="text-accent">Hosted</span>
          </span>
        </div>
        <div className="card">{children}</div>
        <p className="mt-4 text-center text-xs text-slate-500">
          Локальный архив. Данные остаются на твоём сервере.
        </p>
      </div>
    </div>
  );
}

import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/session";
import { ProfileForm } from "./profile-form";
import { PasswordForm } from "./password-form";

export default async function SettingsPage() {
  const user = await requireUser();

  return (
    <>
      <PageHeader title="Настройки" subtitle="Профиль, пароль, данные" />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-4 font-medium">Профиль</h2>
          <ProfileForm
            initial={{
              email: user.email,
              name: user.name ?? "",
              birthDate: user.birthDate
                ? user.birthDate.toISOString().slice(0, 10)
                : "",
              sex: user.sex ?? "",
              bloodType: user.bloodType ?? "",
            }}
          />
        </section>

        <section className="card">
          <h2 className="mb-4 font-medium">Пароль</h2>
          <PasswordForm />
        </section>
      </div>
    </>
  );
}

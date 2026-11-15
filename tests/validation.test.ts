import { describe, expect, it } from "vitest";
import {
  loginSchema,
  passwordChangeSchema,
  profileSchema,
  registerSchema,
} from "@/lib/validation";

describe("validation", () => {
  it("нормализует email", () => {
    const parsed = registerSchema.parse({
      email: "  User@Example.COM ",
      password: "12345678",
    });
    expect(parsed.email).toBe("user@example.com");
  });

  it("требует минимум 8 символов в пароле", () => {
    expect(registerSchema.safeParse({ email: "a@b.co", password: "short" }).success).toBe(false);
    expect(registerSchema.safeParse({ email: "a@b.co", password: "longenough" }).success).toBe(true);
  });

  it("отвергает кривой email", () => {
    expect(loginSchema.safeParse({ email: "nope", password: "12345678" }).success).toBe(false);
  });

  it("позволяет очистить профиль пустыми строками", () => {
    const parsed = profileSchema.parse({ name: "", birthDate: "", sex: "", bloodType: "" });
    expect(parsed.name).toBeUndefined();
    expect(parsed.birthDate).toBeUndefined();
    expect(parsed.sex).toBeUndefined();
    expect(parsed.bloodType).toBeUndefined();
  });

  it("принимает корректную дату рождения", () => {
    const parsed = profileSchema.parse({ birthDate: "1990-05-17" });
    expect(parsed.birthDate).toBe("1990-05-17");
  });

  it("требует текущий пароль при смене", () => {
    expect(
      passwordChangeSchema.safeParse({ currentPassword: "", newPassword: "12345678" }).success,
    ).toBe(false);
  });
});

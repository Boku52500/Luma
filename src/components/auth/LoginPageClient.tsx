"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FormField, formInputClass } from "@/components/ui/FormField";
import { AuthLayout } from "./AuthLayout";
import { useAuth } from "@/hooks/useAuth";
import { validateLogin, safeInternalPath } from "@/lib/authValidation";

export function LoginPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isLoggedIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const redirectTo = safeInternalPath(searchParams.get("redirect"));

  // Already logged in (or just logged in this render) — no reason to show the form.
  useEffect(() => {
    if (isLoggedIn) router.replace(redirectTo);
  }, [isLoggedIn, redirectTo, router]);

  const errors = validateLogin({ email, password });
  const getError = (field: "email" | "password") => (touched[field] || submitted ? errors[field] : undefined);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (Object.keys(errors).length > 0) return;

    setFormError(null);
    const result = await login(email, password);
    if (!result.ok) {
      setFormError(result.message);
      return;
    }
    setFormError(null);
    router.push(redirectTo);
  };

  return (
    <AuthLayout
      title="შესვლა"
      subtitle="შედით თქვენს Luma ანგარიშში"
      footer={
        <p className="text-small text-text-muted">
          არ გაქვთ ანგარიში?{" "}
          <Link href="/register" className="font-semibold text-brand-600 hover:text-brand-700">
            ახალი მომხმარებლის რეგისტრაცია
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <FormField id="email" label="ელ. ფოსტა" required error={getError("email")}>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="example@mail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, email: true }))}
            aria-invalid={Boolean(getError("email"))}
            aria-describedby={getError("email") ? "email-error" : undefined}
            className={formInputClass(Boolean(getError("email")))}
          />
        </FormField>

        <FormField id="password" label="პაროლი" required error={getError("password")}>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, password: true }))}
            aria-invalid={Boolean(getError("password"))}
            aria-describedby={getError("password") ? "password-error" : undefined}
            className={formInputClass(Boolean(getError("password")))}
          />
        </FormField>

        {formError ? (
          <p role="alert" className="text-small flex items-start gap-1.5 text-danger-500">
            <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2.25} />
            {formError}
          </p>
        ) : null}

        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-small font-medium text-brand-600 hover:text-brand-700">
            პაროლის აღდგენა
          </Link>
        </div>

        <Button type="submit" size="lg" className="w-full">
          შესვლა
        </Button>
      </form>
    </AuthLayout>
  );
}

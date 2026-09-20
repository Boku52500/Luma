"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FormField, formInputClass } from "@/components/ui/FormField";
import { AuthLayout } from "./AuthLayout";
import { useAuth } from "@/hooks/useAuth";
import { validateRegister, safeInternalPath } from "@/lib/authValidation";
import { formatGeorgianPhoneInput } from "@/lib/checkoutValidation";
import { cn } from "@/lib/utils";

export function RegisterPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { register, isLoggedIn } = useAuth();

  const [values, setValues] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const redirectTo = safeInternalPath(searchParams.get("redirect"));

  useEffect(() => {
    if (isLoggedIn) router.replace(redirectTo);
  }, [isLoggedIn, redirectTo, router]);

  const errors = validateRegister(values);
  const getError = (field: keyof typeof values) => (touched[field] || submitted ? errors[field] : undefined);

  const setField = (field: keyof typeof values, value: string) => setValues((v) => ({ ...v, [field]: value }));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (Object.keys(errors).length > 0) return;

    setFormError(null);
    const result = await register(values);
    if (!result.ok) {
      setFormError(result.message);
      return;
    }
    setFormError(null);
    router.push(redirectTo);
  };

  return (
    <AuthLayout
      title="რეგისტრაცია"
      subtitle="შექმენით Luma ანგარიში რამდენიმე წამში"
      footer={
        <p className="text-small text-text-muted">
          უკვე გაქვთ ანგარიში?{" "}
          <Link href="/login" className="font-semibold text-brand-600 hover:text-brand-700">
            შესვლა
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField id="firstName" label="სახელი" required error={getError("firstName")}>
            <input
              id="firstName"
              type="text"
              autoComplete="given-name"
              value={values.firstName}
              onChange={(e) => setField("firstName", e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, firstName: true }))}
              aria-invalid={Boolean(getError("firstName"))}
              aria-describedby={getError("firstName") ? "firstName-error" : undefined}
              className={formInputClass(Boolean(getError("firstName")))}
            />
          </FormField>

          <FormField id="lastName" label="გვარი" required error={getError("lastName")}>
            <input
              id="lastName"
              type="text"
              autoComplete="family-name"
              value={values.lastName}
              onChange={(e) => setField("lastName", e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, lastName: true }))}
              aria-invalid={Boolean(getError("lastName"))}
              aria-describedby={getError("lastName") ? "lastName-error" : undefined}
              className={formInputClass(Boolean(getError("lastName")))}
            />
          </FormField>
        </div>

        <FormField id="phone" label="ტელეფონის ნომერი" required error={getError("phone")}>
          <div
            className={cn(
              "flex items-stretch overflow-hidden rounded-[var(--radius-sm)] border bg-surface focus-within:ring-4",
              getError("phone")
                ? "border-danger-300 focus-within:border-danger-500 focus-within:ring-danger-100"
                : "border-border-strong focus-within:border-brand-500 focus-within:ring-brand-100"
            )}
          >
            <span className="flex shrink-0 items-center border-r border-border bg-surface-2 px-3 text-[0.9375rem] font-medium text-text-muted">
              +995
            </span>
            <input
              id="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="5XX XX XX XX"
              value={values.phone}
              onChange={(e) => setField("phone", formatGeorgianPhoneInput(e.target.value))}
              onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
              aria-invalid={Boolean(getError("phone"))}
              aria-describedby={getError("phone") ? "phone-error" : undefined}
              className="h-11 w-full min-w-0 border-0 bg-transparent px-3 text-[0.9375rem] text-text placeholder:text-text-faint focus:outline-none focus:ring-0"
            />
          </div>
        </FormField>

        <FormField id="email" label="ელ. ფოსტა" required error={getError("email")}>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="example@mail.com"
            value={values.email}
            onChange={(e) => setField("email", e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, email: true }))}
            aria-invalid={Boolean(getError("email"))}
            aria-describedby={getError("email") ? "email-error" : undefined}
            className={formInputClass(Boolean(getError("email")))}
          />
        </FormField>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField id="password" label="პაროლი" required error={getError("password")}>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              value={values.password}
              onChange={(e) => setField("password", e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, password: true }))}
              aria-invalid={Boolean(getError("password"))}
              aria-describedby={getError("password") ? "password-error" : undefined}
              className={formInputClass(Boolean(getError("password")))}
            />
          </FormField>

          <FormField id="confirmPassword" label="პაროლის გამეორება" required error={getError("confirmPassword")}>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={values.confirmPassword}
              onChange={(e) => setField("confirmPassword", e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, confirmPassword: true }))}
              aria-invalid={Boolean(getError("confirmPassword"))}
              aria-describedby={getError("confirmPassword") ? "confirmPassword-error" : undefined}
              className={formInputClass(Boolean(getError("confirmPassword")))}
            />
          </FormField>
        </div>

        {formError ? (
          <p role="alert" className="text-small flex items-start gap-1.5 text-danger-500">
            <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2.25} />
            {formError}
          </p>
        ) : null}

        <Button type="submit" size="lg" className="w-full">
          რეგისტრაცია
        </Button>
      </form>
    </AuthLayout>
  );
}

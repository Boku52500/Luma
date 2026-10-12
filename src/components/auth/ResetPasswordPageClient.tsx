"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FormField, formInputClass } from "@/components/ui/FormField";
import { AuthLayout } from "./AuthLayout";
import { MIN_PASSWORD_LENGTH } from "@/lib/authValidation";
import { completePasswordReset } from "@/server/actions/auth";

export function ResetPasswordPageClient() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const passwordError =
    submitted && !password
      ? "შეიყვანეთ ახალი პაროლი"
      : submitted && password.length < MIN_PASSWORD_LENGTH
        ? `პაროლი უნდა შედგებოდეს მინიმუმ ${MIN_PASSWORD_LENGTH} სიმბოლოსგან`
        : undefined;
  const confirmError =
    submitted && !confirmPassword
      ? "გაიმეორეთ პაროლი"
      : submitted && confirmPassword !== password
        ? "პაროლები არ ემთხვევა"
        : undefined;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    setMessage(null);
    if (!token || password.length < MIN_PASSWORD_LENGTH || password !== confirmPassword) return;
    const result = await completePasswordReset({ token, password, confirmPassword });
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setDone(true);
  }

  if (!token) {
    return (
      <AuthLayout title="პაროლის აღდგენა">
        <p className="text-small text-text-muted">ბმული არასწორია ან ვადაგასულია.</p>
        <Button href="/forgot-password" variant="secondary" className="mt-4">
          ხელახალი მოთხოვნა
        </Button>
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout title="პაროლი განახლდა">
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-brand-50">
            <Info className="size-7 text-brand-700" strokeWidth={1.5} />
          </span>
          <p className="text-body text-text-muted">ახლა შეგიძლიათ შეხვიდეთ ახალი პაროლით.</p>
          <Button href="/login">შესვლა</Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="ახალი პაროლი"
      footer={
        <p className="text-small text-text-muted">
          <Link href="/login" className="font-semibold text-brand-800 hover:text-brand-900">
            შესვლაზე დაბრუნება
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <FormField id="password" label="ახალი პაროლი" required error={passwordError}>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={formInputClass(Boolean(passwordError))}
          />
        </FormField>
        <FormField id="confirmPassword" label="გაიმეორეთ პაროლი" required error={confirmError}>
          <input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={formInputClass(Boolean(confirmError))}
          />
        </FormField>
        {message ? (
          <p role="alert" className="text-small text-danger-600">
            {message}
          </p>
        ) : null}
        <Button type="submit" size="lg" className="w-full">
          პაროლის შენახვა
        </Button>
      </form>
    </AuthLayout>
  );
}

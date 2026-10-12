"use client";

import { useState } from "react";
import Link from "next/link";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FormField, formInputClass } from "@/components/ui/FormField";
import { AuthLayout } from "./AuthLayout";
import { validateForgotPassword } from "@/lib/authValidation";
import { requestPasswordReset } from "@/server/actions/auth";

export function ForgotPasswordPageClient() {
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [done, setDone] = useState(false);

  const errors = validateForgotPassword(email);
  const error = touched || submitted ? errors.email : undefined;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (errors.email) return;
    await requestPasswordReset({ email });
    setDone(true);
  };

  if (done) {
    return (
      <AuthLayout title="პაროლის აღდგენა">
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-brand-50">
            <Info className="size-7 text-brand-700" strokeWidth={1.5} />
          </span>
          <div>
            <p className="text-body font-semibold text-text">თუ ეს ელ. ფოსტა რეგისტრირებულია, გამოგიგზავნით აღდგენის ბმულს.</p>
            <p className="text-small mt-1.5 text-text-muted">
              იგივე პასუხს ვაბრუნებთ ყოველთვის, რომ ანგარიშის არსებობა არ გამოჩნდეს.
            </p>
          </div>
          <Button href="/login" variant="secondary" className="mt-1">
            შესვლაზე დაბრუნება
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="პაროლის აღდგენა"
      subtitle="შეიყვანეთ ელ. ფოსტა. თუ ეს ელ. ფოსტა რეგისტრირებულია, გამოგიგზავნით აღდგენის ბმულს."
      footer={
        <p className="text-small text-text-muted">
          გაგახსენდათ პაროლი?{" "}
          <Link href="/login" className="font-semibold text-brand-800 hover:text-brand-900">
            შესვლა
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <FormField id="email" label="ელ. ფოსტა" required error={error}>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="example@mail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setTouched(true)}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "email-error" : undefined}
            className={formInputClass(Boolean(error))}
          />
        </FormField>

        <Button type="submit" size="lg" className="w-full">
          ბმულის მოთხოვნა
        </Button>
      </form>
    </AuthLayout>
  );
}

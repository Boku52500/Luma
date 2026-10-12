import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "outline-on-ink" | "ghost";
type Size = "sm" | "md" | "lg";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-brand-600 text-white hover:bg-brand-700 hover:text-white active:bg-brand-800 active:text-white disabled:text-white focus-visible:text-white shadow-xs",
  secondary:
    "bg-white text-ink-900 border border-border-strong hover:bg-surface-2 active:bg-bg-subtle",
  "outline-on-ink":
    "border border-white/25 text-white hover:bg-white/10 active:bg-white/15",
  ghost: "text-ink-900 hover:bg-black/[0.04] active:bg-black/[0.06]",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-9 px-3.5 text-[0.8125rem] gap-1.5 rounded-[var(--radius-sm)]",
  md: "h-11 px-5 type-btn gap-2 rounded-[var(--radius-md)]",
  lg: "h-[3.25rem] px-7 text-[1rem] gap-2.5 rounded-[var(--radius-md)]",
};

interface CommonProps {
  variant?: Variant;
  size?: Size;
  className?: string;
  children?: React.ReactNode;
}

type ButtonAsButton = CommonProps &
  React.ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };

type ButtonAsLink = CommonProps &
  React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

export type ButtonProps = ButtonAsButton | ButtonAsLink;

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonProps) {
  const classes = cn(
    "inline-flex items-center justify-center whitespace-nowrap font-semibold transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2",
    sizeClasses[size],
    variantClasses[variant],
    className
  );

  if ("href" in props && props.href) {
    const { href, ...rest } = props as ButtonAsLink;
    return (
      <Link href={href} className={classes} {...rest}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} {...(props as ButtonAsButton)}>
      {children}
    </button>
  );
}

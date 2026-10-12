import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function SectionHeading({
  eyebrow,
  title,
  description,
  href,
  hrefLabel = "ყველას ნახვა",
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  href?: string;
  hrefLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div>
        {eyebrow ? (
          <p className="text-label mb-2 text-brand-800">{eyebrow}</p>
        ) : null}
        <h2 className="text-h2 text-text">{title}</h2>
        {description ? (
          <p className="text-body mt-1.5 max-w-xl text-text-muted">{description}</p>
        ) : null}
      </div>
      {href ? (
        <Link
          href={href}
          className="text-btn group inline-flex shrink-0 items-center gap-1 text-brand-800 transition-colors hover:text-brand-900"
        >
          {hrefLabel}
          <ArrowUpRight
            className="size-4 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            strokeWidth={2.25}
          />
        </Link>
      ) : null}
    </div>
  );
}

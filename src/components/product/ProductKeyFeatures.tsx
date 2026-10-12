import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Easy-to-scan highlight grid for the "ძირითადი მახასიათებლები" section. */
export function ProductKeyFeatures({ features, className }: { features: string[]; className?: string }) {
  if (!features.length) return null;

  return (
    <ul className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2", className)}>
      {features.map((feature) => (
        <li key={feature} className="flex items-start gap-2.5 rounded-[var(--radius-md)] border border-border bg-surface p-4">
          <CheckCircle2 className="mt-0.5 size-[18px] shrink-0 text-brand-800" strokeWidth={1.75} />
          <span className="text-small text-text">{feature}</span>
        </li>
      ))}
    </ul>
  );
}

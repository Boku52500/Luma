import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

/** Simple, reusable breadcrumb trail for category/product/info pages. */
export function Breadcrumbs({ items, className }: { items: BreadcrumbItem[]; className?: string }) {
  return (
    <nav aria-label="საიტის მარშრუტი" className={cn("flex", className)}>
      <ol className="flex flex-wrap items-center gap-1.5 text-small text-text-faint">
        <li className="flex items-center gap-1.5">
          <Link href="/" className="flex items-center gap-1 transition-colors hover:text-brand-800">
            <Home className="size-3.5" strokeWidth={2} />
            მთავარი
          </Link>
        </li>
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={item.label} className="flex items-center gap-1.5">
              <ChevronRight className="size-3.5 text-border-strong" strokeWidth={2} />
              {item.href && !isLast ? (
                <Link href={item.href} className="transition-colors hover:text-brand-800">
                  {item.label}
                </Link>
              ) : (
                <span className={cn(isLast && "font-medium text-text")} aria-current={isLast ? "page" : undefined}>
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

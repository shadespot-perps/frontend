import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function PageShell({
  title,
  subtitle,
  actions,
  children,
  className,
  width = "xl",
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  width?: "lg" | "xl" | "2xl";
}) {
  const widthClass =
    width === "lg" ? "max-w-5xl" : width === "2xl" ? "max-w-[1600px]" : "max-w-[1200px]";

  return (
    <div className={cn(widthClass, "mx-auto px-4 py-6 sm:px-6 sm:py-8 animate-fade-in", className)}>
      {(title || subtitle || actions) && (
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            {title ? (
              <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
                {title}
              </h1>
            ) : null}
            {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      )}
      {children}
    </div>
  );
}


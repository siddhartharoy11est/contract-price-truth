import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  children,
  actions,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 border-b pb-5 sm:flex-row sm:items-start sm:justify-between">
      <div className="max-w-4xl">
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {children && (
          <div className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{children}</div>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

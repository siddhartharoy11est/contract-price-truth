import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { roleById } from "@/data/roles";
import type { RoleId } from "@/data/types";
import { useDemo } from "@/lib/demo-store";

/** Shows children only to the given simulated role, otherwise a switch shortcut. */
export function RoleGate({ role, children, action }: { role: RoleId; children: ReactNode; action?: string }) {
  const { state, setRole } = useDemo();
  if (state.role === role) return <>{children}</>;
  const r = roleById(role);
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
      <span>{action ?? "This step"} is for {r.short} ({r.name}).</span>
      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setRole(role)}>
        Switch to {r.name}
      </Button>
    </div>
  );
}

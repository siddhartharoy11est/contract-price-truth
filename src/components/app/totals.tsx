import { useDerived } from "@/lib/demo-store";
import { formatINR } from "@/lib/money";

export function DiscrepancyTotals() {
  const d = useDerived();
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="surface px-4 py-3">
          <p className="text-xs font-medium text-muted-foreground">Potential discrepancies</p>
          <p className="tabular mt-1 text-xl font-semibold text-warning">
            {formatINR(d.potentialPaise)}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Open investigations with a verified price, not yet confirmed.
          </p>
        </div>
        <div className="surface px-4 py-3">
          <p className="text-xs font-medium text-muted-foreground">Confirmed discrepancies</p>
          <p className="tabular mt-1 text-xl font-semibold text-danger">
            {formatINR(d.confirmedPaise)}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Confirmed by Procurement. Never added to the potential total.
          </p>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Recovery is not tracked. Detecting a discrepancy is not the same as recovering money.
      </p>
    </div>
  );
}

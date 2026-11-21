/** Which recent activity events the dashboard list shows: the latest few, or all of them. */
export const ACTIVITY_PREVIEW = 5;

export function selectActivity<T extends { at: string }>(
  events: readonly T[],
  expanded: boolean,
  limit = ACTIVITY_PREVIEW,
): { shown: T[]; total: number; canExpand: boolean } {
  const sorted = [...events].sort((a, b) => b.at.localeCompare(a.at));
  return {
    shown: expanded ? sorted : sorted.slice(0, limit),
    total: sorted.length,
    canExpand: sorted.length > limit,
  };
}

import { describe, expect, it } from "vitest";
import { selectActivity } from "./activity-list";

const events = Array.from({ length: 8 }, (_, i) => ({
  at: `2026-11-0${i + 1}T10:00:00Z`,
  text: `Event ${i + 1}`,
}));

describe("selectActivity", () => {
  it("shows the latest 5, newest first, and expands to all", () => {
    const collapsed = selectActivity(events, false);
    expect(collapsed.shown.map((e) => e.text)).toEqual([
      "Event 8",
      "Event 7",
      "Event 6",
      "Event 5",
      "Event 4",
    ]);
    expect(collapsed.total).toBe(8);
    expect(collapsed.canExpand).toBe(true);
    const open = selectActivity(events, true);
    expect(open.shown).toHaveLength(8);
    expect(open.shown[7]?.text).toBe("Event 1");
  });

  it("offers no toggle at 5 events or fewer", () => {
    const r = selectActivity(events.slice(0, 5), false);
    expect(r.shown).toHaveLength(5);
    expect(r.canExpand).toBe(false);
  });
});

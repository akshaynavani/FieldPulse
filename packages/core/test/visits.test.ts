import { describe, expect, it } from "vitest";
import {
  accountsDueForVisit,
  formatMoney,
  haversineKm,
  isOnSite,
  planRoute,
  relativeDay,
} from "../src/index.js";
import { account } from "./fixtures.js";

describe("geo", () => {
  it("measures SF to LA at roughly 559 km", () => {
    const km = haversineKm({ lat: 37.7749, lng: -122.4194 }, { lat: 34.0522, lng: -118.2437 });
    expect(km).toBeGreaterThan(550);
    expect(km).toBeLessThan(570);
  });

  it("detects on-site check-ins", () => {
    expect(isOnSite({ lat: 37.7749, lng: -122.4194 }, { lat: 37.7752, lng: -122.4190 })).toBe(true);
    expect(isOnSite({ lat: 37.7749, lng: -122.4194 }, { lat: 37.8, lng: -122.4 })).toBe(false);
  });
});

describe("accountsDueForVisit", () => {
  const now = new Date("2026-10-08T12:00:00Z");

  it("applies tier cadence and puts never-visited first", () => {
    const due = accountsDueForVisit(
      [
        account("Fresh A", { tier: "A", lastVisitAt: "2026-10-01T12:00:00.000Z" }),
        account("Stale A", { tier: "A", lastVisitAt: "2026-09-01T12:00:00.000Z" }),
        account("Never", { tier: "C" }),
        account("Recent C", { tier: "C", lastVisitAt: "2026-09-01T12:00:00.000Z" }),
      ],
      now,
    );
    expect(due.map((d) => d.account.name)).toEqual(["Never", "Stale A"]);
    expect(due[1]!.daysOverdue).toBe(23);
  });
});

describe("planRoute", () => {
  it("returns an empty route for no stops", () => {
    expect(planRoute({ lat: 0, lng: 0 }, [])).toEqual([]);
  });

  it("visits points along a line in order", () => {
    const stops = [3, 1, 4, 2].map((x) => ({ name: `p${x}`, location: { lat: 0, lng: x / 10 } }));
    const route = planRoute({ lat: 0, lng: 0 }, stops);
    expect(route.map((r) => r.item.name)).toEqual(["p1", "p2", "p3", "p4"]);
    expect(route.at(-1)!.cumulativeKm).toBeCloseTo(haversineKm({ lat: 0, lng: 0 }, { lat: 0, lng: 0.4 }));
  });
});

describe("format", () => {
  it("formats cents as currency", () => {
    expect(formatMoney(1_234_567)).toBe("$12,345.67");
    expect(formatMoney(125_000_000, "USD", true)).toBe("$1.3M");
  });

  it("describes relative days", () => {
    const now = new Date("2026-10-08T12:00:00Z");
    expect(relativeDay("2026-10-08T01:00:00Z", now)).toBe("today");
    expect(relativeDay("2026-10-11T01:00:00Z", now)).toBe("in 3 days");
    expect(relativeDay("2026-10-06T01:00:00Z", now)).toBe("2 days ago");
  });
});

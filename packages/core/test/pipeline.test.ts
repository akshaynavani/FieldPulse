import { describe, expect, it } from "vitest";
import {
  allowedNextStages,
  canTransition,
  computeQuotaProgress,
  groupByStage,
  quarterBounds,
  summarizePipeline,
  weightedAmount,
  winRate,
} from "../src/index.js";
import { deal } from "./fixtures.js";

describe("stage transitions", () => {
  it("allows advancing, one step back and closing", () => {
    expect(canTransition("prospecting", "proposal")).toBe(true);
    expect(canTransition("proposal", "qualified")).toBe(true);
    expect(canTransition("proposal", "prospecting")).toBe(false);
    expect(canTransition("qualified", "closed_lost")).toBe(true);
  });

  it("only reopens closed deals into negotiation", () => {
    expect(allowedNextStages("closed_won")).toEqual(["negotiation"]);
    expect(canTransition("closed_lost", "prospecting")).toBe(false);
  });

  it("rejects no-op transitions", () => {
    expect(canTransition("qualified", "qualified")).toBe(false);
  });
});

describe("pipeline aggregation", () => {
  const deals = [
    deal("prospecting", 100_000),
    deal("proposal", 200_000),
    deal("negotiation", 400_000),
    deal("closed_won", 500_000, { closedAt: "2026-10-02T10:00:00.000Z" }),
    deal("closed_lost", 50_000, { closedAt: "2026-10-03T10:00:00.000Z", lostReason: "Price" }),
  ];

  it("weights by stage probability", () => {
    expect(weightedAmount(deals[2]!)).toBe(300_000);
  });

  it("computes win rate from closed deals only", () => {
    expect(winRate(deals)).toBe(0.5);
    expect(winRate([deal("qualified", 1)])).toBeNull();
  });

  it("summarises open and weighted totals", () => {
    const summary = summarizePipeline(deals, 2_000_000, new Date("2026-10-08T12:00:00Z"));
    expect(summary.totalOpenCents).toBe(700_000);
    expect(summary.totalWeightedCents).toBe(10_000 + 100_000 + 300_000);
    expect(summary.stages).toHaveLength(6);
  });

  it("groups by stage ordered by close date", () => {
    const board = groupByStage([
      deal("qualified", 1, { expectedCloseDate: "2026-12-01" }),
      deal("qualified", 1, { expectedCloseDate: "2026-11-01" }),
    ]);
    expect(board.qualified.map((d) => d.expectedCloseDate)).toEqual(["2026-11-01", "2026-12-01"]);
    expect(board.proposal).toEqual([]);
  });
});

describe("quota", () => {
  it("finds calendar quarter bounds", () => {
    const { start, end } = quarterBounds(new Date("2026-10-08T00:00:00Z"));
    expect(start.toISOString().slice(0, 10)).toBe("2026-10-01");
    expect(end.toISOString().slice(0, 10)).toBe("2026-12-31");
  });

  it("ignores wins from previous quarters and open deals closing later", () => {
    const now = new Date("2026-10-08T12:00:00Z");
    const progress = computeQuotaProgress(
      [
        deal("closed_won", 300_000, { closedAt: "2026-10-05T00:00:00.000Z" }),
        deal("closed_won", 900_000, { closedAt: "2026-09-29T00:00:00.000Z" }),
        deal("negotiation", 400_000, { expectedCloseDate: "2026-12-20" }),
        deal("negotiation", 400_000, { expectedCloseDate: "2027-01-20" }),
      ],
      1_000_000,
      now,
    );
    expect(progress.closedWonCents).toBe(300_000);
    expect(progress.weightedOpenCents).toBe(300_000);
    expect(progress.attainment).toBeCloseTo(0.3);
    expect(progress.projectedAttainment).toBeCloseTo(0.6);
    expect(progress.daysRemaining).toBe(84);
  });

  it("handles a zero target", () => {
    expect(computeQuotaProgress([], 0).attainment).toBe(0);
  });
});

import { Router } from "express";
import type { PipelineSummary } from "@fieldpulse/contracts";
import { summarizePipeline } from "@fieldpulse/core";
import { asyncHandler } from "../errors.js";
import { currentUser, scopeFor } from "../middleware/auth.js";
import type { Deps } from "./deps.js";

export function pipelineRouter({ repo, now }: Deps): Router {
  const router = Router();

  router.get(
    "/summary",
    asyncHandler(async (req, res) => {
      const deals = await repo.listDeals(scopeFor(req), {});
      // Aggregation lives in @fieldpulse/core so the mobile app can compute the
      // exact same numbers from cached deals while offline.
      const body: PipelineSummary = summarizePipeline(deals, currentUser(req).quarterlyQuotaCents, now());
      res.json(body);
    }),
  );

  return router;
}

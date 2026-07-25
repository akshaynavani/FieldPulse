import { Router } from "express";
import type { CreateDeal, DealListQuery, DealListResponse, UpdateDealStage } from "@fieldpulse/contracts";
import { CreateDealSchema, DealListQuerySchema, UpdateDealStageSchema } from "@fieldpulse/contracts";
import { allowedNextStages, canTransition, isOpen } from "@fieldpulse/core";
import { HttpError, asyncHandler, notFound } from "../errors.js";
import { currentUser, scopeFor } from "../middleware/auth.js";
import { uuidParam, validQuery, validateBody, validateQuery } from "../middleware/validate.js";
import type { Deps } from "./deps.js";

export function dealsRouter({ repo, now }: Deps): Router {
  const router = Router();
  router.param("id", uuidParam);

  router.get(
    "/",
    validateQuery(DealListQuerySchema),
    asyncHandler(async (req, res) => {
      const deals = await repo.listDeals(scopeFor(req), validQuery<DealListQuery>(req));
      const body: DealListResponse = { deals };
      res.json(body);
    }),
  );

  router.post(
    "/",
    validateBody(CreateDealSchema),
    asyncHandler(async (req, res) => {
      const data = req.body as CreateDeal;
      const account = await repo.getAccount(scopeFor(req), data.accountId);
      if (!account) throw notFound("Account");
      const deal = await repo.createDeal(currentUser(req).id, data);
      res.status(201).json(deal);
    }),
  );

  router.patch(
    "/:id/stage",
    validateBody(UpdateDealStageSchema),
    asyncHandler(async (req, res) => {
      const { stage, lostReason, expectedUpdatedAt } = req.body as UpdateDealStage;
      const deal = await repo.getDeal(scopeFor(req), req.params.id!);
      if (!deal) throw notFound("Deal");

      // Same transition rules the clients use to decide which buttons to show.
      if (!canTransition(deal.stage, stage)) {
        const allowed = allowedNextStages(deal.stage).join(", ") || "none";
        throw new HttpError(
          "invalid_transition",
          `Cannot move deal from ${deal.stage} to ${stage}. Allowed: ${allowed}`,
        );
      }

      const closing = !isOpen(stage);
      const result = await repo.updateDeal(
        deal.id,
        {
          stage,
          lostReason: stage === "closed_lost" ? (lostReason ?? null) : null,
          closedAt: closing ? now() : null,
        },
        expectedUpdatedAt,
      );
      if (result === "conflict") {
        throw new HttpError("conflict", "Deal was modified by someone else; refresh and retry");
      }
      res.json(result);
    }),
  );

  return router;
}

import { Router } from "express";
import type { CompleteVisit, ScheduleVisit, VisitListQuery, VisitListResponse } from "@fieldpulse/contracts";
import { CompleteVisitSchema, ScheduleVisitSchema, VisitListQuerySchema } from "@fieldpulse/contracts";
import { HttpError, asyncHandler, notFound } from "../errors.js";
import { currentUser, scopeFor } from "../middleware/auth.js";
import { uuidParam, validQuery, validateBody, validateQuery } from "../middleware/validate.js";
import type { Deps } from "./deps.js";

export function visitsRouter({ repo }: Deps): Router {
  const router = Router();
  router.param("id", uuidParam);

  router.get(
    "/",
    validateQuery(VisitListQuerySchema),
    asyncHandler(async (req, res) => {
      const visits = await repo.listVisits(scopeFor(req), validQuery<VisitListQuery>(req));
      const body: VisitListResponse = { visits };
      res.json(body);
    }),
  );

  router.post(
    "/",
    validateBody(ScheduleVisitSchema),
    asyncHandler(async (req, res) => {
      const data = req.body as ScheduleVisit;
      const account = await repo.getAccount(scopeFor(req), data.accountId);
      if (!account) throw notFound("Account");
      const visit = await repo.scheduleVisit(currentUser(req).id, data);
      res.status(201).json(visit);
    }),
  );

  router.post(
    "/:id/complete",
    validateBody(CompleteVisitSchema),
    asyncHandler(async (req, res) => {
      const visit = await repo.getVisit(scopeFor(req), req.params.id!);
      if (!visit) throw notFound("Visit");
      if (visit.completedAt) throw new HttpError("conflict", "Visit is already completed");
      const updated = await repo.completeVisit(visit.id, req.body as CompleteVisit);
      res.json(updated);
    }),
  );

  return router;
}

import { Router } from "express";
import type {
  AccountDetail,
  AccountListQuery,
  AccountListResponse,
  CreateAccount,
  CreateContact,
  UpdateAccount,
} from "@fieldpulse/contracts";
import {
  AccountListQuerySchema,
  CreateAccountSchema,
  CreateContactSchema,
  UpdateAccountSchema,
} from "@fieldpulse/contracts";
import { asyncHandler, notFound } from "../errors.js";
import { currentUser, scopeFor } from "../middleware/auth.js";
import { uuidParam, validQuery, validateBody, validateQuery } from "../middleware/validate.js";
import type { Deps } from "./deps.js";

export function accountsRouter({ repo }: Deps): Router {
  const router = Router();
  router.param("id", uuidParam);

  router.get(
    "/",
    validateQuery(AccountListQuerySchema),
    asyncHandler(async (req, res) => {
      const q = validQuery<AccountListQuery>(req);
      const { items, total } = await repo.listAccounts(scopeFor(req), q);
      const body: AccountListResponse = { items, total, page: q.page, pageSize: q.pageSize };
      res.json(body);
    }),
  );

  router.get(
    "/:id",
    asyncHandler(async (req, res) => {
      const account = await repo.getAccount(scopeFor(req), req.params.id!);
      if (!account) throw notFound("Account");
      const body: AccountDetail = { ...account, contacts: await repo.listContacts(account.id) };
      res.json(body);
    }),
  );

  router.post(
    "/",
    validateBody(CreateAccountSchema),
    asyncHandler(async (req, res) => {
      const account = await repo.createAccount(currentUser(req).id, req.body as CreateAccount);
      res.status(201).json(account);
    }),
  );

  router.patch(
    "/:id",
    validateBody(UpdateAccountSchema),
    asyncHandler(async (req, res) => {
      const updated = await repo.updateAccount(scopeFor(req), req.params.id!, req.body as UpdateAccount);
      if (!updated) throw notFound("Account");
      res.json(updated);
    }),
  );

  router.post(
    "/:id/contacts",
    validateBody(CreateContactSchema),
    asyncHandler(async (req, res) => {
      const account = await repo.getAccount(scopeFor(req), req.params.id!);
      if (!account) throw notFound("Account");
      const contact = await repo.addContact(account.id, req.body as CreateContact);
      res.status(201).json(contact);
    }),
  );

  return router;
}

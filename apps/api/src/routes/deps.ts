import type { Repository } from "../repositories/types.js";
import type { SessionService } from "../services/sessions.js";

export interface Deps {
  repo: Repository;
  sessions: SessionService;
  now: () => Date;
}

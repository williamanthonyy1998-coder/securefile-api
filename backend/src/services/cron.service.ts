import { taskAndTrashSweep } from "./taskWorker";
import { AppError } from "../utils/errors";

class CronService {
  assertAuthorized(supplied: string | undefined) {
    const secret = process.env.CRON_SECRET;

    if (!secret || supplied !== secret) {
      throw new AppError("Unauthorized", 401);
    }
  }

  async runMaintenance() {
    const result = await taskAndTrashSweep();

    return {
      ok: true,
      ranAt: new Date().toISOString(),
      result,
    };
  }
}

export const cronService = new CronService();

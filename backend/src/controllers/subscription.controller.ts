import { Request, Response, NextFunction } from "express";

import { AuthedRequest } from "../middleware/auth";
import { subscriptionService } from "../services/subscription.service";
import { AppError } from "../utils/errors";

export async function getMySubscription(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user?.companyId) {
      throw new AppError("No company", 400);
    }
    return res.json(await subscriptionService.getMine(req.user.companyId));
  } catch (error) {
    next(error);
  }
}

export async function quoteSubscription(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    return res.json(subscriptionService.getQuote(req.body || {}));
  } catch (error) {
    next(error);
  }
}

export async function changeQuote(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user?.companyId) {
      throw new AppError("No company", 400);
    }
    return res.json(
      await subscriptionService.getChangeQuote(
        req.user.companyId,
        req.body || {},
      ),
    );
  } catch (error) {
    next(error);
  }
}

export async function cancelSubscription(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user?.companyId) {
      throw new AppError("No company", 400);
    }
    return res.json(await subscriptionService.cancel(req.user.companyId));
  } catch (error) {
    next(error);
  }
}

export async function reactivateSubscription(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user?.companyId) {
      throw new AppError("No company", 400);
    }
    return res.json(await subscriptionService.reactivate(req.user.companyId));
  } catch (error) {
    next(error);
  }
}

export async function checkoutSubscription(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user?.companyId) {
      throw new AppError("No company", 400);
    }
    return res.json(
      await subscriptionService.checkout(req.user.companyId, req.body || {}),
    );
  } catch (error) {
    next(error);
  }
}

export async function stripeWebhook(
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  const result = await subscriptionService.handleStripeWebhook(
    req.body as Buffer,
    String(req.headers["stripe-signature"] || ""),
  );
  if (result.kind === "text") {
    return res.status(result.status).send(result.body);
  }
  return res.json(result.body);
}

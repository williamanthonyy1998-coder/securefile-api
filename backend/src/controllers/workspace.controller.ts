import { Response, NextFunction } from "express";

import { AuthedRequest } from "../middleware/auth";
import { AppError } from "../utils/errors";
import { answerAi } from "../services/ai";
import { workspaceRequestService } from "../services/workspace-request.service";
import { workspaceApprovalService } from "../services/workspace-approval.service";
import { workspaceTaskService } from "../services/workspace-task.service";
import { workspaceMailService } from "../services/workspace-mail.service";
import { workspaceNotificationService } from "../services/workspace-notification.service";

function requireCompany(req: AuthedRequest) {
  if (!req.user?.companyId) {
    throw new AppError("No company", 400);
  }

  return req.user.companyId;
}

export async function listRequests(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const companyId = requireCompany(req);
    const rows = await workspaceRequestService.listRequests(
      req.user!.id,
      companyId,
    );
    return res.json(rows);
  } catch (error) {
    next(error);
  }
}

export async function deleteRequest(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const companyId = requireCompany(req);
    await workspaceRequestService.deleteRequest(
      String(req.params.id),
      req.user!.id,
      companyId,
    );
    return res.status(204).end();
  } catch (error) {
    next(error);
  }
}

export async function createRequest(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const companyId = requireCompany(req);
    const result = await workspaceRequestService.createRequest(
      req.user!.id,
      companyId,
      req.body || {},
    );
    return res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function listApprovals(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const companyId = requireCompany(req);
    const rows = await workspaceApprovalService.listApprovals(
      req.user!.id,
      companyId,
    );
    return res.json(rows);
  } catch (error) {
    next(error);
  }
}

export async function listApprovalResources(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const companyId = requireCompany(req);
    const rows = await workspaceApprovalService.listApprovalResources(
      String(req.params.id),
      req.user!.id,
      req.user!.role,
      companyId,
      req.query.q ? String(req.query.q) : undefined,
    );
    return res.json(rows);
  } catch (error) {
    next(error);
  }
}

export async function resolveApproval(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const companyId = requireCompany(req);
    const result = await workspaceApprovalService.resolveApproval(
      String(req.params.id),
      req.user!.id,
      req.user!.role,
      companyId,
      req.body || {},
    );
    return res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function listTasks(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const companyId = requireCompany(req);
    const rows = await workspaceTaskService.listTasks(
      req.user!.id,
      req.user!.role,
      companyId,
      {
        fileId: req.query.fileId ? String(req.query.fileId) : undefined,
        folderId: req.query.folderId ? String(req.query.folderId) : undefined,
      },
    );
    return res.json(rows);
  } catch (error) {
    next(error);
  }
}

export async function createTask(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const companyId = requireCompany(req);
    const task = await workspaceTaskService.createTask(
      req.user!.id,
      req.user!.role,
      companyId,
      req.body || {},
    );
    return res.status(201).json(task);
  } catch (error) {
    next(error);
  }
}

export async function updateTaskStatus(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const companyId = requireCompany(req);
    const updated = await workspaceTaskService.updateTaskStatus(
      String(req.params.id),
      req.user!.id,
      companyId,
      req.body?.status,
    );
    return res.json(updated);
  } catch (error) {
    next(error);
  }
}

export async function submitTaskSolution(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const companyId = requireCompany(req);
    const result = await workspaceTaskService.submitSolution(
      String(req.params.id),
      req.user!.id,
      companyId,
      req.file,
    );
    return res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function listEmails(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const companyId = requireCompany(req);
    const rows = await workspaceMailService.listEmails(
      req.user!.id,
      req.user!.email,
      companyId,
      req.query.box ? String(req.query.box) : undefined,
    );
    return res.json(rows);
  } catch (error) {
    next(error);
  }
}

export async function getEmailStatus(
  _req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    return res.json(workspaceMailService.getEmailStatus());
  } catch (error) {
    next(error);
  }
}

export async function sendWorkspaceEmail(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const companyId = requireCompany(req);
    const result = await workspaceMailService.sendEmail(
      req.user!.id,
      companyId,
      req.body || {},
    );
    return res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function listNotifications(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const rows = await workspaceNotificationService.listUnread(req.user!.id);
    return res.json(rows);
  } catch (error) {
    next(error);
  }
}

export async function markNotificationRead(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await workspaceNotificationService.markRead(
      String(req.params.id),
      req.user!.id,
    );
    return res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function markAllNotificationsRead(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await workspaceNotificationService.markAllRead(
      req.user!.id,
    );
    return res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function askAi(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const message = String(req.body?.message || "")
      .trim()
      .slice(0, 8000);

    if (!message) {
      throw new AppError("Message required", 400);
    }

    const rawHistory = Array.isArray(req.body?.history) ? req.body.history : [];
    const history = rawHistory
      .filter(
        (x: { role?: string; content?: unknown }) =>
          x &&
          ["user", "assistant"].includes(String(x.role)) &&
          typeof x.content === "string",
      )
      .slice(-12)
      .map((x: { role: string; content: string }) => ({
        role: x.role,
        content: String(x.content).slice(0, 6000),
      }));

    const webEnabled = req.body?.webSearchEnabled !== false;
    const result = await answerAi(req, message, history, webEnabled);
    return res.json(result);
  } catch (error) {
    next(error);
  }
}

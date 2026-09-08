import crypto from "node:crypto";
import path from "node:path";
import { PrismaClient, TaskPriority, TaskStatus } from "@prisma/client";

import { db } from "../db";
import { AppError } from "../utils/errors";
import { safeFilename } from "../utils/security";
import { getFileAccess, getFolderAccess } from "./access";
import { notify } from "./notify";
import { sendUserEmail } from "./email";
import { putObject } from "./storage";

export interface CreateTaskInput {
  assigneeId?: string;
  title?: string;
  description?: string;
  fileId?: string;
  folderId?: string;
  startPage?: number | string | null;
  endPage?: number | string | null;
  priority?: string;
  dueAt?: string | Date | null;
}

class WorkspaceTaskService {
  constructor(private readonly db: PrismaClient) {}

  async listTasks(
    userId: string,
    role: string,
    companyId: string,
    filters: { fileId?: string; folderId?: string },
  ) {
    const fileFilter = filters.fileId ? { fileId: filters.fileId } : {};
    const folderFilter = filters.folderId ? { folderId: filters.folderId } : {};

    const where =
      role === "COMPANY_ADMIN"
        ? {
            companyId,
            deletedAt: null,
            ...fileFilter,
            ...folderFilter,
          }
        : {
            companyId,
            assigneeId: userId,
            deletedAt: null,
            ...fileFilter,
            ...folderFilter,
          };

    return this.db.task.findMany({
      where,
      include: {
        assignee: { select: { id: true, uniqueName: true, email: true } },
        file: { select: { id: true, name: true, mimeType: true } },
        folder: { select: { id: true, name: true } },
      },
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      take: 200,
    });
  }

  async createTask(
    userId: string,
    role: string,
    companyId: string,
    input: CreateTaskInput,
  ) {
    const assigneeId = String(input.assigneeId || "");
    const title = String(input.title || "")
      .trim()
      .slice(0, 180);
    const description = String(input.description || "")
      .trim()
      .slice(0, 4000);
    const fileId = input.fileId ? String(input.fileId) : undefined;
    const folderId = input.folderId ? String(input.folderId) : undefined;
    const startPage =
      input.startPage !== "" && input.startPage != null
        ? Number(input.startPage)
        : undefined;
    const endPage =
      input.endPage !== "" && input.endPage != null
        ? Number(input.endPage)
        : undefined;
    const priority = String(input.priority || "MEDIUM").toUpperCase();
    const dueAt = input.dueAt ? new Date(input.dueAt) : null;

    if (!assigneeId || !title) {
      throw new AppError("Assignee and task title are required", 400);
    }

    if ((fileId ? 1 : 0) + (folderId ? 1 : 0) > 1) {
      throw new AppError("Choose either a file or a folder", 400);
    }

    if (
      fileId &&
      !(await getFileAccess(userId, role, companyId, fileId, "view"))
    ) {
      throw new AppError("You cannot assign this file", 403);
    }

    if (
      folderId &&
      !(await getFolderAccess(userId, role, companyId, folderId, "view"))
    ) {
      throw new AppError("You cannot assign this folder", 403);
    }

    if ((startPage !== undefined || endPage !== undefined) && !fileId) {
      throw new AppError("Page range is available only for files", 400);
    }

    if (
      startPage !== undefined &&
      (!Number.isInteger(startPage) || startPage < 1)
    ) {
      throw new AppError("Start page must be a positive whole number", 400);
    }

    if (endPage !== undefined && (!Number.isInteger(endPage) || endPage < 1)) {
      throw new AppError("End page must be a positive whole number", 400);
    }

    if (
      startPage !== undefined &&
      endPage !== undefined &&
      startPage > endPage
    ) {
      throw new AppError(
        "End page must be greater than or equal to start page",
        400,
      );
    }

    if (!["LOW", "MEDIUM", "HIGH", "URGENT"].includes(priority)) {
      throw new AppError("Invalid priority", 400);
    }

    if (dueAt && Number.isNaN(dueAt.getTime())) {
      throw new AppError("Invalid due date", 400);
    }

    if (dueAt && dueAt <= new Date()) {
      throw new AppError("Due date must be in the future", 400);
    }

    const assignee = await this.db.user.findFirst({
      where: {
        id: assigneeId,
        companyId,
        status: "ACTIVE",
        role: { in: ["EMPLOYEE", "CLIENT"] },
      },
    });

    if (!assignee) {
      throw new AppError("Assignee not found", 404);
    }

    const task = await this.db.task.create({
      data: {
        companyId,
        createdById: userId,
        assigneeId,
        title,
        description,
        fileId,
        folderId,
        startPage,
        endPage,
        priority: priority as TaskPriority,
        dueAt,
      },
    });

    await notify(
      assignee.id,
      "New task assigned",
      `${title}${dueAt ? " — due " + dueAt.toLocaleString() : ""}`,
      companyId,
      "TASK_ASSIGNED",
      true,
      { entityId: task.id },
    );

    await sendUserEmail(
      assignee.email,
      "SecureFile task assigned",
      `<p>You have a new task: <strong>${title}</strong>.</p>${description ? `<p>${description}</p>` : ""}${startPage || endPage ? `<p>Pages: ${startPage || 1}–${endPage || "end"}</p>` : ""}`,
    ).catch(() => {});

    return task;
  }

  async updateTaskStatus(
    taskId: string,
    userId: string,
    companyId: string,
    statusInput?: string,
  ) {
    const task = await this.db.task.findFirst({
      where: { id: taskId, companyId, deletedAt: null },
    });

    if (!task) {
      throw new AppError("Task not found", 404);
    }

    if (task.assigneeId !== userId) {
      throw new AppError("Only the assigned user can update task status", 403);
    }

    const status = String(statusInput || "").toUpperCase();

    if (
      !["PENDING", "STARTED", "PARTIALLY_COMPLETED", "COMPLETED"].includes(
        status,
      )
    ) {
      throw new AppError("Invalid task status", 400);
    }

    const updated = await this.db.task.update({
      where: { id: task.id },
      data: { status: status as TaskStatus },
    });

    await notify(
      task.createdById,
      "Task status updated",
      `${task.title} is now ${status.replace("_", " ").toLowerCase()}.`,
      task.companyId,
      status === "COMPLETED" ? "TASK_COMPLETED" : "TASK_STARTED",
      true,
      { entityId: task.id },
    );

    return updated;
  }

  async submitSolution(
    taskId: string,
    userId: string,
    companyId: string,
    file: Express.Multer.File | undefined,
  ) {
    const task = await this.db.task.findFirst({
      where: { id: taskId, companyId, deletedAt: null },
    });

    if (!task) {
      throw new AppError("Task not found", 404);
    }

    if (task.assigneeId !== userId) {
      throw new AppError("Only the assignee can submit a solution", 403);
    }

    if (!file) {
      throw new AppError("Solution file required", 400);
    }

    const key = `solution-${crypto.randomUUID()}${path.extname(file.originalname)}`;
    await putObject(key, file.buffer, file.mimetype || "application/octet-stream");

    const createdFile = await this.db.file.create({
      data: {
        companyId,
        ownerId: userId,
        name: safeFilename(file.originalname),
        storageKey: key,
        mimeType: file.mimetype || "application/octet-stream",
        sizeBytes: file.size,
        source: "UPLOAD",
      },
    });

    await this.db.company.update({
      where: { id: companyId },
      data: { storageUsedBytes: { increment: file.size } },
    });

    const updated = await this.db.task.update({
      where: { id: task.id },
      data: { solutionKey: key, status: "COMPLETED" },
    });

    await notify(
      task.createdById,
      "Task completed",
      task.title,
      task.companyId,
      "TASK_COMPLETED",
      true,
      { entityId: task.id },
    );

    return { task: updated, fileId: createdFile.id };
  }
}

export const workspaceTaskService = new WorkspaceTaskService(db);

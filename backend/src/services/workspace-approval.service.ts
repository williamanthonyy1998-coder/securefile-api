import { PrismaClient, RequestStatus } from "@prisma/client";

import { db } from "../db";
import { AppError } from "../utils/errors";
import { getFileAccess, getFolderAccess } from "./access";
import { notify } from "./notify";
import { sendUserEmail } from "./email";

export interface ResolveApprovalInput {
  status?: string;
  fileId?: string;
  folderId?: string;
}

class WorkspaceApprovalService {
  constructor(private readonly db: PrismaClient) {}

  async listApprovals(userId: string, companyId: string) {
    return this.db.approval.findMany({
      where: {
        companyId,
        approverId: userId,
        requesterId: { not: userId },
      },
      include: {
        requester: {
          select: { id: true, uniqueName: true, email: true, role: true },
        },
        accessRequest: true,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async listApprovalResources(
    approvalId: string,
    userId: string,
    role: string,
    companyId: string,
    query?: string,
  ) {
    const approval = await this.db.approval.findFirst({
      where: {
        id: approvalId,
        companyId,
        approverId: userId,
        status: "PENDING",
      },
      include: { accessRequest: true },
    });

    if (!approval) {
      throw new AppError("Approval request not found", 404);
    }

    const q = String(
      query || approval.accessRequest?.requestedName || "",
    ).trim();
    const type = approval.accessRequest?.requestedType || "FILE";
    const out: Array<{ id: string; name: string; type: "FILE" | "FOLDER" }> =
      [];

    if (type === "FILE") {
      const rows = await this.db.file.findMany({
        where: {
          companyId,
          deletedAt: null,
          name: { contains: q, mode: "insensitive" },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      });

      for (const f of rows) {
        if (await getFileAccess(userId, role, companyId, f.id, "share")) {
          out.push({ id: f.id, name: f.name, type: "FILE" });
        }
      }
    } else {
      const rows = await this.db.folder.findMany({
        where: {
          companyId,
          deletedAt: null,
          name: { contains: q, mode: "insensitive" },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      });

      for (const f of rows) {
        if (await getFolderAccess(userId, role, companyId, f.id, "share")) {
          out.push({ id: f.id, name: f.name, type: "FOLDER" });
        }
      }
    }

    return out;
  }

  async resolveApproval(
    approvalId: string,
    userId: string,
    role: string,
    companyId: string,
    input: ResolveApprovalInput,
  ) {
    const status = String(input.status || "").toUpperCase();

    if (!["APPROVED", "REJECTED"].includes(status)) {
      throw new AppError("Approval status must be APPROVED or REJECTED", 400);
    }

    const a = await this.db.approval.findFirst({
      where: {
        id: approvalId,
        companyId,
        approverId: userId,
        requesterId: { not: userId },
        status: "PENDING",
      },
      include: { accessRequest: true },
    });

    if (!a) {
      throw new AppError("Approval not found or already resolved", 404);
    }

    let fileId = a.fileId || undefined;
    let folderId = a.folderId || undefined;
    let resourceOwnerId = userId;

    if (status === "APPROVED") {
      fileId = input.fileId ? String(input.fileId) : fileId;
      folderId = input.folderId ? String(input.folderId) : folderId;

      if ((fileId ? 1 : 0) + (folderId ? 1 : 0) !== 1) {
        throw new AppError(
          "Before approving, select the actual file or folder that fulfills the request.",
          400,
        );
      }

      const allowed = fileId
        ? await getFileAccess(userId, role, a.companyId, fileId, "share")
        : await getFolderAccess(userId, role, a.companyId, folderId!, "share");

      if (!allowed) {
        throw new AppError(
          "You do not have Share permission for the selected resource.",
          403,
        );
      }

      resourceOwnerId = allowed.ownerId || userId;
    }

    const result = await this.db.$transaction(async (tx) => {
      const approval = await tx.approval.update({
        where: { id: approvalId },
        data: {
          status: status as RequestStatus,
          fileId,
          folderId,
        },
      });

      const request = await tx.accessRequest.update({
        where: { id: a.accessRequestId! },
        data: {
          status: status as RequestStatus,
          fileId,
          folderId,
        },
      });

      if (status === "APPROVED") {
        const existing = await tx.share.findFirst({
          where: {
            companyId: a.companyId,
            recipientId: a.requesterId,
            ...(fileId ? { fileId } : { folderId }),
          },
        });

        if (existing) {
          await tx.share.update({
            where: { id: existing.id },
            data: { canView: true, canDownload: a.canDownload },
          });
        } else {
          await tx.share.create({
            data: {
              companyId: a.companyId,
              ownerId: resourceOwnerId,
              recipientId: a.requesterId,
              fileId,
              folderId,
              type: "INTERNAL",
              canView: true,
              canDownload: a.canDownload,
            },
          });
        }
      }

      return { approval, request };
    });

    const requester = await this.db.user.findUnique({
      where: { id: a.requesterId },
      select: { email: true },
    });

    await notify(
      a.requesterId,
      status === "APPROVED"
        ? "Access request approved"
        : "Access request rejected",
      status === "APPROVED"
        ? "The requested resource has been shared with you."
        : "Your access request was rejected.",
      a.companyId,
      status === "APPROVED"
        ? "ACCESS_REQUEST_APPROVED"
        : "ACCESS_REQUEST_REJECTED",
      true,
      { entityId: a.id },
    );

    if (requester) {
      await sendUserEmail(
        requester.email,
        `SecureFile request ${status.toLowerCase()}`,
        status === "APPROVED"
          ? "<p>Your requested resource has been shared with your SecureFile account.</p>"
          : "<p>Your access request was rejected.</p>",
      ).catch(() => {});
    }

    return result;
  }
}

export const workspaceApprovalService = new WorkspaceApprovalService(db);

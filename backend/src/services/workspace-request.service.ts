import { PrismaClient, ResourceType } from "@prisma/client";

import { db } from "../db";
import { AppError } from "../utils/errors";
import { notify } from "./notify";
import { sendUserEmail } from "./email";

export interface CreateAccessRequestInput {
  targetUserId?: string;
  requestedName?: string;
  requestedType?: string;
  note?: string;
  canDownload?: boolean;
}

class WorkspaceRequestService {
  constructor(private readonly db: PrismaClient) {}

  async listRequests(userId: string, companyId: string) {
    return this.db.accessRequest.findMany({
      where: { companyId, requesterId: userId },
      include: {
        targetUser: {
          select: { id: true, uniqueName: true, email: true, role: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async deleteRequest(requestId: string, userId: string, companyId: string) {
    const row = await this.db.accessRequest.findFirst({
      where: { id: requestId, companyId, requesterId: userId },
    });

    if (!row) {
      throw new AppError("Request not found", 404);
    }

    if (row.status !== "PENDING") {
      throw new AppError("Only pending requests can be deleted", 409);
    }

    await this.db.accessRequest.delete({ where: { id: row.id } });
  }

  async createRequest(
    userId: string,
    companyId: string,
    input: CreateAccessRequestInput,
  ) {
    const targetUserId = String(input.targetUserId || "");
    const requestedName = String(input.requestedName || "")
      .trim()
      .slice(0, 180);
    const requestedType = String(input.requestedType || "FILE").toUpperCase();
    const note = String(input.note || "")
      .trim()
      .slice(0, 2000);
    const canDownload = Boolean(input.canDownload);

    if (!targetUserId || targetUserId === userId) {
      throw new AppError("Choose another active user as the approver.", 400);
    }

    if (requestedName.length < 2) {
      throw new AppError(
        "Enter the file or folder name you are requesting.",
        400,
      );
    }

    if (!["FILE", "FOLDER"].includes(requestedType)) {
      throw new AppError("Invalid requested resource type.", 400);
    }

    const target = await this.db.user.findFirst({
      where: { id: targetUserId, companyId, status: "ACTIVE" },
    });

    if (!target) {
      throw new AppError("Approver not found.", 404);
    }

    const [ownedFiles, ownedFolders, shareCount] = await Promise.all([
      this.db.file.count({
        where: { companyId, ownerId: target.id, deletedAt: null },
      }),
      this.db.folder.count({
        where: { companyId, ownerId: target.id, deletedAt: null },
      }),
      this.db.share.count({
        where: { companyId, recipientId: target.id, canShare: true },
      }),
    ]);

    if (
      !["COMPANY_ADMIN", "SUPER_ADMIN"].includes(target.role) &&
      ownedFiles + ownedFolders + shareCount === 0
    ) {
      throw new AppError(
        "That user is not an authorized resource owner/approver.",
        400,
      );
    }

    const duplicate = await this.db.accessRequest.findFirst({
      where: {
        companyId,
        requesterId: userId,
        targetUserId,
        status: "PENDING",
        requestedName,
        requestedType: requestedType as ResourceType,
      },
    });

    if (duplicate) {
      throw new AppError(
        "You already have a pending request for this resource name and approver.",
        409,
      );
    }

    const result = await this.db.$transaction(async (tx) => {
      const request = await tx.accessRequest.create({
        data: {
          companyId,
          requesterId: userId,
          targetUserId,
          requestedName,
          requestedType: requestedType as ResourceType,
          note,
          canDownload,
        },
      });

      await tx.approval.create({
        data: {
          companyId,
          requesterId: userId,
          approverId: targetUserId,
          accessRequestId: request.id,
          canDownload,
          note,
        },
      });

      return request;
    });

    const requester = await this.db.user.findUnique({
      where: { id: userId },
      select: { uniqueName: true, email: true },
    });

    const message = `${requester?.uniqueName || requester?.email || "A user"} is requesting ${requestedType.toLowerCase()} “${requestedName}”.${note ? " Reason: " + note : ""}`;

    await notify(
      targetUserId,
      "New access request",
      message,
      companyId,
      "ACCESS_REQUESTED",
      true,
      { entityId: result.id },
    );

    await sendUserEmail(
      target.email,
      "SecureFile access request",
      `<p>${message}</p><p>Open SecureFile → Approvals to review and fulfill this request.</p>`,
    ).catch(() => {});

    return result;
  }
}

export const workspaceRequestService = new WorkspaceRequestService(db);

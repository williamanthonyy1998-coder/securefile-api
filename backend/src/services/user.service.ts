import type { Prisma, Role } from "@prisma/client";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

import { env } from "../config/env";
import { db } from "../db";
import { AppError } from "../utils/errors";
import { hashToken, randomToken } from "../utils/security";
import { sendUserEmail } from "./email";
import { notify, notifyCompanyUsers } from "./notify";

const createUserSchema = z.object({
  email: z.string().trim().email("Enter a valid email address").max(320),
  name: z.string().trim().min(2, "Name is required").max(120),
  password: z.string().min(10, "Password must be at least 10 characters").max(128),
  role: z.enum(["EMPLOYEE", "CLIENT"]).default("EMPLOYEE"),
  folderIds: z.array(z.string()).optional().default([]),
  personalFolderAllowed: z.boolean().default(true),
});

function escapeHtml(value: string) {
  return value.replace(
    /[&<>\"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}

class UserService {
  constructor(private readonly db: PrismaClient) {}

  private companyUserWhere(companyId: string, id?: string) {
    return {
      ...(id ? { id } : {}),
      companyId,
      role: { in: ["EMPLOYEE", "CLIENT"] as Role[] },
    };
  }

  async listUsers(companyId: string) {
    return this.db.user.findMany({
      where: { companyId },
      select: {
        id: true,
        email: true,
        uniqueName: true,
        role: true,
        status: true,
        emailVerifiedAt: true,
        personalFolderAllowed: true,
        createdAt: true,
        _count: { select: { ownedFiles: true, ownedFolders: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async listChatUsers(userId: string) {
    const currentUserRecord = await this.db.user.findUnique({
      where: { id: userId },
      select: { id: true, companyId: true, role: true },
    });

    if (!currentUserRecord) {
      throw new AppError("User not found", 404);
    }

    if (!currentUserRecord.companyId) {
      throw new AppError("No company", 400);
    }

    let allowedRoles: string[];

    switch (currentUserRecord.role) {
      case "EMPLOYEE":
        allowedRoles = ["EMPLOYEE", "COMPANY_ADMIN"];
        break;
      case "CLIENT":
        allowedRoles = ["COMPANY_ADMIN"];
        break;
      case "COMPANY_ADMIN":
        allowedRoles = ["EMPLOYEE", "CLIENT", "COMPANY_ADMIN"];
        break;
      default:
        allowedRoles = [];
        break;
    }

    return this.db.user.findMany({
      where: {
        companyId: currentUserRecord.companyId,
        id: { not: currentUserRecord.id },
        role: { in: allowedRoles as Role[] },
        status: "ACTIVE",
      },
      select: {
        id: true,
        email: true,
        uniqueName: true,
        role: true,
        status: true,
        emailVerifiedAt: true,
        personalFolderAllowed: true,
        createdAt: true,
        _count: {
          select: {
            ownedFiles: true,
            ownedFolders: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async getMeta(companyId: string) {
    const [subscription, count] = await Promise.all([
      this.db.subscription.findUnique({
        where: { companyId },
        select: {
          users: true,
          storageGb: true,
          status: true,
          expiresAt: true,
          addons: true,
        },
      }),
      this.db.user.count({ where: { companyId } }),
    ]);

    return {
      purchasedSeats: subscription?.users ?? 0,
      usedSeats: count,
      remainingSeats: Math.max(0, (subscription?.users ?? 0) - count),
      storageGb: subscription?.storageGb ?? 0,
      status: subscription?.status ?? "NONE",
      expiresAt: subscription?.expiresAt ?? null,
      addons: subscription?.addons ?? {},
    };
  }

  async createUser(
    companyId: string,
    actorId: string,
    body: unknown,
  ) {
    const input = createUserSchema.safeParse(body);
    if (!input.success) {
      throw new AppError(
        input.error.issues[0]?.message ||
          "Valid name, email, password and role are required",
        400,
      );
    }

    const {
      email,
      name,
      password,
      role: userRole,
      folderIds,
      personalFolderAllowed,
    } = input.data;

    const sub = await this.db.subscription.findUnique({ where: { companyId } });
    const count = await this.db.user.count({ where: { companyId } });
    if (!sub || count >= sub.users) {
      throw new AppError("Purchased user limit reached", 409);
    }

    const normalizedEmail = email.toLowerCase().trim();
    if (await this.db.user.findUnique({ where: { email: normalizedEmail } })) {
      throw new AppError("Email already exists", 409);
    }

    const bcrypt = (await import("bcryptjs")).default;
    const passwordHash = await bcrypt.hash(password, 12);

    const u = await this.db.user.create({
      data: {
        companyId,
        email: normalizedEmail,
        uniqueName: name.trim(),
        passwordHash,
        role: userRole,
        // New company users remain invited until they accept the invitation.
        // The supplied temporary password is still usable for login; accepting
        // the invitation upgrades the account to ACTIVE and lets the user set
        // their own password.
        status: "INVITED",
        emailVerifiedAt: new Date(),
        personalFolderAllowed,
      },
    });

    if (personalFolderAllowed) {
      await this.db.folder.create({
        data: {
          companyId,
          ownerId: u.id,
          name: "Personal Folder",
          isPersonal: true,
        },
      });
    }

    for (const folderId of folderIds) {
      const folder = await this.db.folder.findFirst({
        where: {
          id: String(folderId),
          companyId,
          deletedAt: null,
          isPersonal: false,
        },
      });
      if (!folder) continue;
      await this.db.share.create({
        data: {
          companyId,
          folderId: folder.id,
          ownerId: actorId,
          recipientId: u.id,
          canView: true,
          canDownload: true,
          canUpload: false,
          canEdit: false,
          canDelete: false,
          canShare: false,
        },
      });
    }

    await this.db.verificationToken.updateMany({
      where: {
        userId: u.id,
        usedAt: null,
        type: { in: ["INVITATION", "PASSWORD_RESET"] },
      },
      data: { usedAt: new Date() },
    });

    const invitationToken = randomToken();
    await this.db.verificationToken.create({
      data: {
        userId: u.id,
        tokenHash: hashToken(invitationToken),
        type: "INVITATION",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    const resetToken = randomToken();
    await this.db.verificationToken.create({
      data: {
        userId: u.id,
        tokenHash: hashToken(resetToken),
        type: "PASSWORD_RESET",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    const invitationUrl = `${env.APP_URL}/accept-invitation?token=${encodeURIComponent(invitationToken)}`;
    const resetUrl = `${env.APP_URL}/reset-password?token=${encodeURIComponent(resetToken)}`;

    await notify(
      u.id,
      "Invitation sent",
      "Your SecureFile account invitation has been sent. Accept it to activate your account and set your own password.",
      companyId,
      "USER_INVITED",
      false,
    );

    let emailDelivered = false;
    try {
      await sendUserEmail(
        u.email,
        "Your SecureFile account is ready",
        `<p>Hello <strong>${u.uniqueName}</strong>,</p>
         <p>Your SecureFile account has been created and an invitation is waiting for you.</p>
         <p><strong>Email:</strong> ${u.email}<br/><strong>Temporary password:</strong> ${escapeHtml(password)}</p>
         <p><a href="${invitationUrl}">Accept invitation &amp; set a new password</a></p>
         <p>You may also sign in with the email and temporary password above. The invitation/password links expire in <strong>24 hours</strong>.</p>
         <p><a href="${resetUrl}">Reset / change your password</a></p>`,
      );
      emailDelivered = true;
    } catch (mailError) {
      console.error("USER_ACCOUNT_EMAIL_ERROR:", mailError);
    }

    return {
      id: u.id,
      email: u.email,
      name: u.uniqueName,
      role: u.role,
      status: u.status,
      personalFolderAllowed: u.personalFolderAllowed,
      emailDelivered,
      invitationUrl: env.NODE_ENV === "development" ? invitationUrl : undefined,
    };
  }

  async getPermissions(companyId: string, userId: string) {
    const user = await this.db.user.findFirst({
      where: this.companyUserWhere(companyId, userId),
    });
    if (!user) {
      throw new AppError("User not found", 404);
    }

    return this.db.share.findMany({
      where: {
        companyId,
        recipientId: user.id,
        folderId: { not: null },
      },
      include: { folder: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async updatePermissions(
    companyId: string,
    actorId: string,
    userId: string,
    folders: unknown,
  ) {
    const user = await this.db.user.findFirst({
      where: this.companyUserWhere(companyId, userId),
    });
    if (!user) {
      throw new AppError("User not found", 404);
    }

    const folderPermissions = Array.isArray(folders) ? folders : [];

    await this.db.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.share.deleteMany({
        where: {
          companyId,
          recipientId: user.id,
          folderId: { not: null },
          ownerId: actorId,
        },
      });

      for (const item of folderPermissions) {
        const folder = await tx.folder.findFirst({
          where: { id: String(item.folderId), companyId },
        });
        if (!folder) continue;
        await tx.share.create({
          data: {
            companyId,
            folderId: folder.id,
            ownerId: actorId,
            recipientId: user.id,
            canView: item.canView !== false,
            canDownload: item.canDownload !== false,
            canUpload: Boolean(item.canUpload),
            canEdit: Boolean(item.canEdit),
            canDelete: Boolean(item.canDelete),
            canShare: Boolean(item.canShare),
          },
        });
      }
    });

    return { ok: true };
  }

  async updateUser(
    companyId: string,
    userId: string,
    body: { name?: unknown; role?: unknown },
  ) {
    const user = await this.db.user.findFirst({
      where: this.companyUserWhere(companyId, userId),
    });
    if (!user) {
      throw new AppError("User not found", 404);
    }

    const data: Prisma.UserUpdateInput = {};
    if (body.name !== undefined) data.uniqueName = String(body.name).trim();
    if (
      body.role !== undefined &&
      ["EMPLOYEE", "CLIENT"].includes(String(body.role))
    ) {
      data.role = body.role as Role;
    }
    data.personalFolderAllowed = true;

    const updated = await this.db.user.update({
      where: { id: user.id },
      data,
    });

    if (data.personalFolderAllowed === true) {
      const existing = await this.db.folder.findFirst({
        where: {
          companyId: user.companyId!,
          ownerId: user.id,
          isPersonal: true,
        },
      });
      if (!existing) {
        await this.db.folder.create({
          data: {
            companyId: user.companyId!,
            ownerId: user.id,
            name: "Personal Folder",
            isPersonal: true,
          },
        });
      }
    }

    await notify(
      user.id,
      "Account updated",
      "Your SecureFile account details or role were updated by your Company Admin.",
      user.companyId!,
      "USER_ACTIVATED",
      true,
      { entityId: user.id },
    );

    return updated;
  }

  async updateStatus(companyId: string, userId: string, statusRaw: unknown) {
    const u = await this.db.user.findFirst({
      where: this.companyUserWhere(companyId, userId),
    });
    if (!u) {
      throw new AppError("User not found", 404);
    }

    const status = statusRaw === "ACTIVE" ? "ACTIVE" : "SUSPENDED";
    const updated = await this.db.user.update({
      where: { id: u.id },
      data: { status },
    });

    await notify(
      u.id,
      status === "ACTIVE" ? "Account activated" : "Account suspended",
      status === "ACTIVE"
        ? "Your SecureFile account has been activated."
        : "Your SecureFile account has been suspended. Contact your Company Admin if you need access restored.",
      u.companyId!,
      status === "ACTIVE" ? "USER_ACTIVATED" : "USER_SUSPENDED",
      true,
      { entityId: u.id },
    );

    return updated;
  }

  async resendInvitation(companyId: string, userId: string) {
    const u = await this.db.user.findFirst({
      where: this.companyUserWhere(companyId, userId),
    });
    if (!u) {
      throw new AppError("User not found", 404);
    }

    await this.db.verificationToken.updateMany({
      where: { userId: u.id, type: "INVITATION", usedAt: null },
      data: { usedAt: new Date() },
    });

    const token = randomToken();
    await this.db.verificationToken.create({
      data: {
        userId: u.id,
        tokenHash: hashToken(token),
        type: "INVITATION",
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
      },
    });

    const url = `${env.APP_URL}/accept-invitation?token=${encodeURIComponent(token)}`;
    await sendUserEmail(
      u.email,
      "Your SecureFile invitation",
      `<p><a href="${url}">Accept invitation</a></p><p>This invitation expires in 24 hours.</p>`,
    );
    await notify(
      u.id,
      "Invitation resent",
      "Your SecureFile invitation has been resent. The new invitation expires in 24 hours.",
      u.companyId!,
      "USER_INVITED",
      false,
      { entityId: u.id },
    );

    return {
      ok: true,
      invitationUrl: env.NODE_ENV === "development" ? url : undefined,
    };
  }

  async deleteUser(companyId: string, userId: string, actorId: string) {
    const u = await this.db.user.findFirst({
      where: this.companyUserWhere(companyId, userId),
    });
    if (!u) {
      throw new AppError("User not found", 404);
    }

    await this.db.user.delete({ where: { id: u.id } });
    await notifyCompanyUsers(
      u.companyId!,
      "User removed",
      `${u.uniqueName || u.email} was removed from the company workspace.`,
      "USER_SUSPENDED",
      { excludeUserId: actorId },
    );
  }

  async acceptInvitation(tokenRaw: unknown, passwordRaw: unknown) {
    const token = String(tokenRaw || "");
    const password = String(passwordRaw || "");

    if (password.length < 10) {
      throw new AppError("Password must be at least 10 characters", 400);
    }

    const row = await this.db.verificationToken.findFirst({
      where: {
        tokenHash: hashToken(token),
        type: "INVITATION",
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!row) {
      throw new AppError("Invalid or expired invitation", 400);
    }

    const bcrypt = (await import("bcryptjs")).default;
    const passwordHash = await bcrypt.hash(password, 12);
    const activated = await this.db.user.update({
      where: { id: row.userId },
      data: {
        passwordHash,
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
      },
    });
    await this.db.verificationToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    });
    await notifyCompanyUsers(
      activated.companyId!,
      "User activated",
      `${activated.uniqueName || activated.email} has activated their SecureFile account.`,
      "USER_ACTIVATED",
      { excludeUserId: activated.id },
    );

    return { ok: true };
  }
}

export const userService = new UserService(db);

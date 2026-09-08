import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";

import { env } from "../config/env";
import { db } from "../db";
import { AppError } from "../utils/errors";
import { safeFilename } from "../utils/security";
import { assertAllowedUploadType } from "../utils/uploadAllowlist";
import { jpegImagesToPdf } from "../utils/jpegPdf";
import {
  getFileAccess,
  getFolderAccess,
  listVisibleFolderIds,
} from "./access";
import { audit } from "./audit";
import { requireAddon } from "./entitlements";
import { notify, notifyCompanyAdmins } from "./notify";
import {
  isOpenXmlSpreadsheet,
  renderOpenXmlSpreadsheet,
} from "./spreadsheetPreview";
import {
  putObject,
  getObject,
  deleteObject,
  createSignedUploadUrl,
  createSignedReadUrl,
  remoteStorageConfigured,
  objectExists,
} from "./storage";

export interface UploadedFileInput {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

function publicMeta(f: { sizeBytes: bigint | number; [key: string]: unknown }) {
  return { ...f, sizeBytes: String(f.sizeBytes) };
}

class FileService {
  constructor(private readonly db: PrismaClient) {}

  private key() {
    return crypto.randomUUID();
  }

  private async assertStorage(companyId: string, additional: number) {
    const c = await this.db.company.findUnique({
      where: { id: companyId },
      select: { storageLimitGb: true, storageUsedBytes: true },
    });
    if (!c) throw new AppError("Company not found", 404);
    const limit = BigInt(Math.floor(c.storageLimitGb * 1024 * 1024 * 1024));
    if (c.storageUsedBytes + BigInt(additional) > limit) {
      throw new AppError("Storage limit exceeded", 413);
    }
  }

  private async saveUpload(file: UploadedFileInput, keyName: string) {
    await putObject(
      keyName,
      file.buffer,
      file.mimetype || "application/octet-stream",
    );
  }

  private normalizeSource(source: unknown) {
    return ["UPLOAD", "SCAN", "FAX"].includes(String(source))
      ? String(source)
      : "UPLOAD";
  }

  async createUploadTicket(
    userId: string,
    role: string,
    companyId: string,
    input: {
      size?: number;
      name?: string;
      mimeType?: string;
      folderId?: string;
      source?: string;
    },
  ) {
    if (!remoteStorageConfigured) {
      throw new AppError(
        "Direct uploads require Supabase Storage in production.",
        503,
      );
    }

    const size = Number(input.size || 0);
    const name = safeFilename(String(input.name || "file"));
    const mimeType = String(
      input.mimeType || "application/octet-stream",
    ).slice(0, 160);
    assertAllowedUploadType(mimeType, name);
    const folderId = input.folderId ? String(input.folderId) : undefined;

    if (!Number.isFinite(size) || size <= 0) {
      throw new AppError("A valid file size is required.", 400);
    }
    if (size > env.MAX_UPLOAD_MB * 1024 * 1024) {
      throw new AppError(
        `File exceeds the ${env.MAX_UPLOAD_MB} MB SecureFile limit.`,
        413,
      );
    }

    if (
      folderId &&
      !(await getFolderAccess(userId, role, companyId, folderId, "upload"))
    ) {
      throw new AppError("Folder upload permission denied", 403);
    }

    await this.assertStorage(companyId, size);
    const storageKey = `uploads/${companyId}/${userId}/${crypto.randomUUID()}`;
    const ticket = await createSignedUploadUrl(storageKey);

    return {
      ticket,
      name,
      mimeType,
      sizeBytes: size,
      folderId: folderId || null,
      source: this.normalizeSource(input.source),
    };
  }

  async commitUpload(
    userId: string,
    role: string,
    companyId: string,
    input: {
      storageKey?: string;
      name?: string;
      mimeType?: string;
      sizeBytes?: number;
      folderId?: string;
      checksum?: string;
      source?: string;
    },
  ) {
    if (!remoteStorageConfigured) {
      throw new AppError(
        "Direct uploads require Supabase Storage in production.",
        503,
      );
    }

    const storageKey = String(input.storageKey || "");
    const prefix = `uploads/${companyId}/${userId}/`;
    if (!storageKey.startsWith(prefix)) {
      throw new AppError("Invalid upload ticket.", 403);
    }

    const name = safeFilename(String(input.name || "file"));
    const mimeType = String(
      input.mimeType || "application/octet-stream",
    ).slice(0, 160);
    assertAllowedUploadType(mimeType, name);
    const size = Number(input.sizeBytes || 0);
    const folderId = input.folderId ? String(input.folderId) : undefined;

    if (!Number.isFinite(size) || size <= 0) {
      throw new AppError("Invalid file size.", 400);
    }

    if (
      folderId &&
      !(await getFolderAccess(userId, role, companyId, folderId, "upload"))
    ) {
      throw new AppError("Folder upload permission denied", 403);
    }

    await this.assertStorage(companyId, size);

    if (!(await objectExists(storageKey, size))) {
      throw new AppError("Uploaded object was not found in storage.", 400);
    }

    const source = this.normalizeSource(input.source);
    const f = await this.db.file.create({
      data: {
        companyId,
        ownerId: userId,
        folderId,
        name,
        storageKey,
        mimeType,
        sizeBytes: size,
        checksum: input.checksum ? String(input.checksum) : null,
        source: source as "UPLOAD" | "SCAN" | "FAX",
      },
    });

    await this.db.company.update({
      where: { id: companyId },
      data: { storageUsedBytes: { increment: size } },
    });

    await audit(companyId, userId, "UPLOAD", "FILE", f.id);
    await notifyCompanyAdmins(
      companyId,
      "New file uploaded",
      `${name} was uploaded to SecureFile.`,
      "FILE_UPLOADED",
      { excludeUserId: userId, email: true, entityId: f.id },
    );

    return publicMeta(f);
  }

  async getSignedUrl(
    userId: string,
    role: string,
    companyId: string,
    fileId: string,
    modeRaw: string,
  ) {
    const mode = String(modeRaw || "preview");
    if (mode !== "preview" && mode !== "download") {
      throw new AppError("Invalid signed URL mode.", 400);
    }

    if (mode === "preview") {
      await requireAddon(companyId, "preview");
    }

    const f = await getFileAccess(
      userId,
      role,
      companyId,
      fileId,
      mode === "download" ? "download" : "view",
    );

    if (!f) {
      throw new AppError(
        `${mode === "download" ? "Download" : "View"} permission denied`,
        403,
      );
    }

    const signed = await createSignedReadUrl(
      f.storageKey,
      mode === "download" ? f.name : undefined,
    );

    return {
      url: signed.signedUrl,
      expiresIn: signed.expiresIn,
      mimeType: f.mimeType,
      name: f.name,
    };
  }

  async listFiles(
    userId: string,
    role: string,
    companyId: string,
    query: { q?: string; folderId?: string; source?: string },
  ) {
    const q = String(query.q || "");
    const folderId = query.folderId ? String(query.folderId) : undefined;
    const sourceFilter = ["UPLOAD", "SCAN", "FAX"].includes(
      String(query.source),
    )
      ? String(query.source)
      : undefined;

    const visible =
      role === "COMPANY_ADMIN" || role === "SUPER_ADMIN"
        ? []
        : await listVisibleFolderIds(userId, role, companyId);

    if (
      folderId &&
      !(await getFolderAccess(userId, role, companyId, folderId, "view"))
    ) {
      throw new AppError("Folder view permission denied", 403);
    }

    const files = await this.db.file.findMany({
      where: {
        companyId,
        deletedAt: null,
        name: { contains: q, mode: "insensitive" },
        ...(sourceFilter
          ? { source: sourceFilter as "UPLOAD" | "SCAN" | "FAX" }
          : {}),
        ...(folderId
          ? { folderId }
          : role === "COMPANY_ADMIN" || role === "SUPER_ADMIN"
            ? { folder: { isPersonal: false } }
            : {
                OR: [{ ownerId: userId }, { folderId: { in: visible } }],
              }),
        NOT: { folder: { isPersonal: true, ownerId: { not: userId } } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        folder: { select: { id: true, name: true, isPersonal: true } },
      },
    });

    return files.map(publicMeta);
  }

  async uploadFile(
    userId: string,
    role: string,
    companyId: string,
    file: UploadedFileInput | undefined,
    input: { folderId?: string; source?: string },
  ) {
    if (!file) {
      throw new AppError("File and tenant required", 400);
    }

    assertAllowedUploadType(file.mimetype, file.originalname);

    const folderId = input.folderId || undefined;
    if (
      folderId &&
      !(await getFolderAccess(userId, role, companyId, folderId, "upload"))
    ) {
      throw new AppError("Upload permission denied", 403);
    }

    await this.assertStorage(companyId, file.size);
    const original = safeFilename(file.originalname);
    const storageKey = this.key();
    const checksum = crypto
      .createHash("sha256")
      .update(file.buffer)
      .digest("hex");

    await this.saveUpload(file, storageKey);

    try {
      const source = this.normalizeSource(input.source);
      const f = await this.db.file.create({
        data: {
          companyId,
          ownerId: userId,
          folderId,
          name: original,
          storageKey,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          checksum,
          source: source as "UPLOAD" | "SCAN" | "FAX",
        },
      });

      await this.db.company.update({
        where: { id: companyId },
        data: { storageUsedBytes: { increment: file.size } },
      });

      await audit(companyId, userId, "UPLOAD", "FILE", f.id);
      await notifyCompanyAdmins(
        companyId,
        "New file uploaded",
        `${original} was uploaded to SecureFile.`,
        "FILE_UPLOADED",
        { excludeUserId: userId, email: true, entityId: f.id },
      );

      return publicMeta(f);
    } catch (e) {
      await deleteObject(storageKey);
      throw e;
    }
  }

  async getFile(
    userId: string,
    role: string,
    companyId: string,
    fileId: string,
  ) {
    const f = await getFileAccess(userId, role, companyId, fileId, "view");
    if (!f) throw new AppError("View permission denied", 403);
    return publicMeta(f);
  }

  async downloadFile(
    userId: string,
    role: string,
    companyId: string,
    fileId: string,
  ) {
    const f = await getFileAccess(userId, role, companyId, fileId, "download");
    if (!f) throw new AppError("Download permission denied", 403);

    const data = await getObject(f.storageKey);
    if (!data) throw new AppError("Stored file missing", 404);

    return {
      data,
      mimeType: f.mimeType || "application/octet-stream",
      name: f.name,
      fileName: safeFilename(f.name),
    };
  }

  async previewFile(
    userId: string,
    role: string,
    companyId: string,
    fileId: string,
  ) {
    await requireAddon(companyId, "preview");

    const f = await getFileAccess(userId, role, companyId, fileId, "view");
    if (!f) throw new AppError("View permission denied", 403);

    const data = await getObject(f.storageKey);
    if (!data) throw new AppError("Stored file missing", 404);

    if (isOpenXmlSpreadsheet(f.mimeType || "", f.name)) {
      return {
        kind: "spreadsheet" as const,
        data: renderOpenXmlSpreadsheet(data, f.name),
        mimeType: "text/html; charset=utf-8",
      };
    }

    return {
      kind: "binary" as const,
      data,
      mimeType: f.mimeType || "application/octet-stream",
    };
  }

  async updateFile(
    userId: string,
    role: string,
    companyId: string,
    actorEmail: string | undefined,
    fileId: string,
    input: { name?: string; folderId?: string | null },
  ) {
    const f = await getFileAccess(userId, role, companyId, fileId, "edit");
    if (!f) throw new AppError("Edit permission denied", 403);

    if (
      input.name !== undefined &&
      f.ownerId !== userId &&
      role !== "COMPANY_ADMIN" &&
      role !== "SUPER_ADMIN"
    ) {
      await requireAddon(companyId, "rename");
    }

    const name = input.name ? safeFilename(String(input.name)) : f.name;
    const folderId =
      input.folderId === null ? null : input.folderId || f.folderId;

    if (
      folderId &&
      !(await getFolderAccess(userId, role, companyId, folderId, "upload"))
    ) {
      throw new AppError("Folder permission denied", 403);
    }

    const updated = await this.db.file.update({
      where: { id: f.id },
      data: { name, folderId },
    });

    const changed = name !== f.name || folderId !== f.folderId;
    if (changed) {
      if (f.ownerId) {
        await notify(
          f.ownerId,
          "File updated",
          `${f.name} was renamed or moved.`,
          f.companyId,
          "FILE_UPDATED",
          false,
          { entityId: f.id },
        );
      }

      await notifyCompanyAdmins(
        f.companyId,
        "File updated",
        `${f.name} was renamed or moved by ${actorEmail || "a user"}.`,
        "FILE_UPDATED",
        {
          excludeUserId: userId,
          entityId: f.id,
        },
      );
    }

    return publicMeta(updated);
  }

  async deleteFile(
    userId: string,
    role: string,
    companyId: string,
    actorEmail: string | undefined,
    fileId: string,
  ) {
    const f = await getFileAccess(userId, role, companyId, fileId, "delete");
    if (!f) throw new AppError("Delete permission denied", 403);

    await this.db.file.update({
      where: { id: f.id },
      data: { deletedAt: new Date() },
    });

    await audit(f.companyId, userId, "TRASH", "FILE", f.id);

    if (f.ownerId) {
      await notify(
        f.ownerId,
        "File moved to trash",
        `${f.name} was moved to Trash.`,
        f.companyId,
        "FILE_DELETED",
        true,
        { entityId: f.id },
      );
    }

    await notifyCompanyAdmins(
      f.companyId,
      "File moved to trash",
      `${f.name} was moved to Trash by ${actorEmail || "a user"}.`,
      "FILE_DELETED",
      {
        excludeUserId: userId,
        entityId: f.id,
      },
    );
  }

  async scanPages(
    userId: string,
    role: string,
    companyId: string,
    pages: UploadedFileInput[],
    input: { folderId?: string; name?: string },
  ) {
    await requireAddon(companyId, "scanner");

    if (!pages.length) {
      throw new AppError("At least one scanned page is required", 400);
    }

    const invalid = pages.find(
      (f) =>
        !["image/jpeg", "image/jpg"].includes(
          (f.mimetype || "").toLowerCase(),
        ),
    );
    if (invalid) {
      throw new AppError("Scanner pages must be JPEG images", 400);
    }

    const folderId = input.folderId ? String(input.folderId) : undefined;
    if (
      folderId &&
      !(await getFolderAccess(userId, role, companyId, folderId, "upload"))
    ) {
      throw new AppError("Folder upload permission denied", 403);
    }

    const pdf = jpegImagesToPdf(pages.map((f) => f.buffer));
    await this.assertStorage(companyId, pdf.length);

    const storageKey = `scan-${this.key()}`;
    await putObject(storageKey, pdf, "application/pdf");

    const name = safeFilename(
      String(input.name || "Scanned Document.pdf")
        .toLowerCase()
        .endsWith(".pdf")
        ? String(input.name || "Scanned Document.pdf")
        : `${String(input.name || "Scanned Document")}.pdf`,
    );

    try {
      const f = await this.db.file.create({
        data: {
          companyId,
          ownerId: userId,
          folderId,
          name,
          storageKey,
          mimeType: "application/pdf",
          sizeBytes: pdf.length,
          source: "SCAN",
        },
      });

      await this.db.company.update({
        where: { id: companyId },
        data: { storageUsedBytes: { increment: pdf.length } },
      });

      await notifyCompanyAdmins(
        companyId,
        "New scanned PDF",
        `${name} was saved from ${pages.length} scanned page${pages.length === 1 ? "" : "s"}.`,
        "SYSTEM",
        { excludeUserId: userId, email: true, entityId: f.id },
      );

      return publicMeta(f);
    } catch (e) {
      await deleteObject(storageKey);
      throw e;
    }
  }

  async scanPdf(
    userId: string,
    role: string,
    companyId: string,
    file: UploadedFileInput | undefined,
    input: { folderId?: string },
  ) {
    await requireAddon(companyId, "scanner");

    if (!file) {
      throw new AppError("PDF scan file required", 400);
    }
    if (file.mimetype !== "application/pdf") {
      throw new AppError("Scanned document must be PDF", 400);
    }

    const folderId = input.folderId ? String(input.folderId) : undefined;
    if (
      folderId &&
      !(await getFolderAccess(userId, role, companyId, folderId, "upload"))
    ) {
      throw new AppError("Folder upload permission denied", 403);
    }

    await this.assertStorage(companyId, file.size);
    const storageKey = `scan-${this.key()}`;
    await this.saveUpload(file, storageKey);

    const f = await this.db.file.create({
      data: {
        companyId,
        ownerId: userId,
        folderId,
        name: safeFilename(file.originalname),
        storageKey,
        mimeType: "application/pdf",
        sizeBytes: file.size,
        source: "SCAN",
      },
    });

    await this.db.company.update({
      where: { id: companyId },
      data: { storageUsedBytes: { increment: file.size } },
    });

    await notifyCompanyAdmins(
      companyId,
      "New scanned PDF",
      `${f.name} was saved from the scanner.`,
      "SYSTEM",
      { excludeUserId: userId, email: true, entityId: f.id },
    );

    return publicMeta(f);
  }

  async saveFaxDocument(
    userId: string,
    companyId: string,
    file: UploadedFileInput | undefined,
  ) {
    await requireAddon(companyId, "fax");

    if (!file) {
      throw new AppError("Fax document required", 400);
    }

    await this.assertStorage(companyId, file.size);
    const storageKey = `fax-${this.key()}`;
    await this.saveUpload(file, storageKey);

    const f = await this.db.file.create({
      data: {
        companyId,
        ownerId: userId,
        name: safeFilename(file.originalname),
        storageKey,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        source: "FAX",
      },
    });

    await this.db.company.update({
      where: { id: companyId },
      data: { storageUsedBytes: { increment: file.size } },
    });

    await notifyCompanyAdmins(
      companyId,
      "Fax document saved",
      `${f.name} was saved as a fax document.`,
      "FAX_RECEIVED",
      { excludeUserId: userId, entityId: f.id },
    );

    return publicMeta(f);
  }
}

export const fileService = new FileService(db);

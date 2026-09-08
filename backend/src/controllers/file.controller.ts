import { Response, NextFunction } from "express";

import { AuthedRequest } from "../middleware/auth";
import { fileService } from "../services/file.service";
import { AppError } from "../utils/errors";

function requireCompany(req: AuthedRequest) {
  if (!req.user?.companyId) {
    throw new AppError("Company required", 400);
  }
  return req.user.companyId;
}

function toUploadedFile(file: Express.Multer.File | undefined) {
  if (!file) return undefined;
  return {
    buffer: file.buffer,
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
  };
}

export async function createUploadTicket(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const companyId = requireCompany(req);
    const result = await fileService.createUploadTicket(
      req.user!.id,
      req.user!.role,
      companyId,
      {
        size: req.body?.size,
        name: req.body?.name,
        mimeType: req.body?.mimeType,
        folderId: req.body?.folderId,
        source: req.body?.source,
      },
    );
    return res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function commitUpload(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const companyId = requireCompany(req);
    const result = await fileService.commitUpload(
      req.user!.id,
      req.user!.role,
      companyId,
      {
        storageKey: req.body?.storageKey,
        name: req.body?.name,
        mimeType: req.body?.mimeType,
        sizeBytes: req.body?.sizeBytes,
        folderId: req.body?.folderId,
        checksum: req.body?.checksum,
        source: req.body?.source,
      },
    );
    return res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getSignedUrl(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const companyId = requireCompany(req);
    const result = await fileService.getSignedUrl(
      req.user!.id,
      req.user!.role,
      companyId,
      String(req.params.id),
      String(req.query.mode || "preview"),
    );
    return res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function listFiles(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user?.companyId) {
      throw new AppError("No company", 400);
    }

    const files = await fileService.listFiles(
      req.user.id,
      req.user.role,
      req.user.companyId,
      {
        q: req.query.q ? String(req.query.q) : undefined,
        folderId: req.query.folderId
          ? String(req.query.folderId)
          : undefined,
        source: req.query.source ? String(req.query.source) : undefined,
      },
    );

    res.setHeader("Cache-Control", "private, no-store");
    return res.json(files);
  } catch (error) {
    next(error);
  }
}

export async function uploadFile(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.file || !req.user?.companyId) {
      throw new AppError("File and tenant required", 400);
    }

    const result = await fileService.uploadFile(
      req.user.id,
      req.user.role,
      req.user.companyId,
      toUploadedFile(req.file),
      {
        folderId: req.body?.folderId,
        source: req.body?.source,
      },
    );

    return res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getFile(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const companyId = requireCompany(req);
    const result = await fileService.getFile(
      req.user!.id,
      req.user!.role,
      companyId,
      String(req.params.id),
    );
    return res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function downloadFile(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const companyId = requireCompany(req);
    const result = await fileService.downloadFile(
      req.user!.id,
      req.user!.role,
      companyId,
      String(req.params.id),
    );

    res.setHeader("Content-Type", result.mimeType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${result.fileName.replace(/"/g, "")}"; filename*=UTF-8''${encodeURIComponent(result.name)}`,
    );
    return res.send(result.data);
  } catch (error) {
    next(error);
  }
}

export async function previewFile(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const companyId = requireCompany(req);
    const result = await fileService.previewFile(
      req.user!.id,
      req.user!.role,
      companyId,
      String(req.params.id),
    );

    if (result.kind === "spreadsheet") {
      res.setHeader("Content-Type", result.mimeType);
      res.setHeader("Content-Disposition", "inline");
      return res.send(result.data);
    }

    res.type(result.mimeType);
    res.setHeader("Content-Disposition", "inline");
    return res.send(result.data);
  } catch (error) {
    next(error);
  }
}

export async function updateFile(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const companyId = requireCompany(req);
    const result = await fileService.updateFile(
      req.user!.id,
      req.user!.role,
      companyId,
      req.user!.email,
      String(req.params.id),
      {
        name: req.body?.name,
        folderId: req.body?.folderId,
      },
    );
    return res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function deleteFile(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const companyId = requireCompany(req);
    await fileService.deleteFile(
      req.user!.id,
      req.user!.role,
      companyId,
      req.user!.email,
      String(req.params.id),
    );
    return res.status(204).end();
  } catch (error) {
    next(error);
  }
}

export async function scanPages(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const companyId = requireCompany(req);
    const files = (req.files as Express.Multer.File[]) || [];
    const result = await fileService.scanPages(
      req.user!.id,
      req.user!.role,
      companyId,
      files.map((f) => ({
        buffer: f.buffer,
        originalname: f.originalname,
        mimetype: f.mimetype,
        size: f.size,
      })),
      {
        folderId: req.body?.folderId,
        name: req.body?.name,
      },
    );
    return res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function scanPdf(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const companyId = requireCompany(req);
    const result = await fileService.scanPdf(
      req.user!.id,
      req.user!.role,
      companyId,
      toUploadedFile(req.file),
      { folderId: req.body?.folderId },
    );
    return res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function saveFaxDocument(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const companyId = requireCompany(req);
    const result = await fileService.saveFaxDocument(
      req.user!.id,
      companyId,
      toUploadedFile(req.file),
    );
    return res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

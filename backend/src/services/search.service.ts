import { PrismaClient } from "@prisma/client";

import { db } from "../db";
import { listVisibleFolderIds } from "./access";

class SearchService {
  constructor(private readonly db: PrismaClient) {}

  async search(
    query: string,
    userId: string,
    role: string,
    companyId: string,
  ) {
    const q = query.trim();

    if (q.length < 2) {
      return { files: [], folders: [], users: [], tasks: [] };
    }

    const ids = await listVisibleFolderIds(userId, role, companyId);
    const isAdmin = role === "COMPANY_ADMIN";

    const [files, folders, users, tasks] = await Promise.all([
      this.db.file.findMany({
        where: {
          companyId,
          name: { contains: q, mode: "insensitive" },
          ...(isAdmin
            ? {}
            : { OR: [{ ownerId: userId }, { folderId: { in: ids } }] }),
        },
        take: 25,
        select: { id: true, name: true, mimeType: true },
      }),
      this.db.folder.findMany({
        where: {
          companyId,
          name: { contains: q, mode: "insensitive" },
          ...(isAdmin ? {} : { id: { in: ids } }),
        },
        take: 25,
        select: { id: true, name: true },
      }),
      this.db.user.findMany({
        where: {
          companyId,
          OR: [
            { email: { contains: q, mode: "insensitive" } },
            { uniqueName: { contains: q, mode: "insensitive" } },
          ],
        },
        take: 25,
        select: { id: true, email: true, uniqueName: true, role: true },
      }),
      this.db.task.findMany({
        where: {
          companyId,
          title: { contains: q, mode: "insensitive" },
          ...(isAdmin
            ? {}
            : { OR: [{ assigneeId: userId }, { createdById: userId }] }),
        },
        take: 25,
        select: { id: true, title: true, status: true },
      }),
    ]);

    return { files, folders, users, tasks };
  }
}

export const searchService = new SearchService(db);

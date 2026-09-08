import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../lib/axios";
import { downloadPrivateFile, getPrivatePreviewUrl } from "../lib/api";

export type FileSource = "UPLOAD" | "SCAN" | "FAX";

export type FolderItem = {
  id: string;
  companyId: string;
  ownerId?: string | null;
  parentId?: string | null;
  name: string;
  isPersonal?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type FileItem = {
  id: string;
  companyId?: string;
  ownerId?: string | null;
  folderId?: string | null;
  name: string;
  mimeType?: string;
  sizeBytes?: string | number;
  source?: FileSource | string;
  createdAt?: string;
  updatedAt?: string;
  folder?: { id?: string; name?: string } | null;
};

export type WorkspaceTask = {
  id: string;
  title: string;
  status?: string;
  startPage?: number | null;
  endPage?: number | null;
  assignee?: { uniqueName?: string; email?: string } | null;
};

export type CompanyUser = {
  id: string;
  email: string;
  uniqueName?: string;
  role?: string;
  status?: string;
};

export type GetFilesParams = {
  folderId?: string;
  q?: string;
};

export type CreateFolderPayload = {
  name: string;
  parentId?: string;
};

export type UpdateFolderPayload = {
  name?: string;
  parentId?: string | null;
};

export type UpdateFilePayload = {
  name?: string;
  folderId?: string | null;
};

export type UploadFilePayload = {
  file: File;
  folderId?: string;
  source?: FileSource;
  name?: string;
};

export type CreateSharePayload = {
  fileId?: string;
  folderId?: string;
  type: "INTERNAL" | "PUBLIC" | string;
  recipientId?: string;
  permissions: {
    view?: boolean;
    download?: boolean;
    upload?: boolean;
    edit?: boolean;
    delete?: boolean;
    share?: boolean;
  };
  password?: string;
  expiresAt?: string;
};

export type CreateTaskPayload = {
  fileId: string;
  assigneeId: string;
  title: string;
  description?: string;
  startPage?: number;
  endPage?: number;
  priority?: string;
  dueAt?: string;
};

export const fileKeys = {
  all: ["files"] as const,
  lists: ["files", "list"] as const,
  list: (params?: GetFilesParams) => ["files", "list", params] as const,
  detail: (fileId: string) => ["files", "detail", fileId] as const,
  preview: (fileId: string) => ["files", "preview", fileId] as const,
  folders: ["files", "folders"] as const,
  tasks: (fileId: string) => ["files", "tasks", fileId] as const,
  users: ["files", "users"] as const,
};

function invalidateFiles(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: fileKeys.all });
}

/* -------------------------------------------------------------------------- */
/* Queries                                                                    */
/* -------------------------------------------------------------------------- */

export function useFiles(params?: GetFilesParams) {
  return useQuery({
    queryKey: fileKeys.list(params),
    queryFn: async (): Promise<FileItem[]> => {
      const response = await api.get<FileItem[]>("/files", {
        params: {
          ...(params?.q ? { q: params.q } : {}),
          ...(!params?.q && params?.folderId
            ? { folderId: params.folderId }
            : {}),
        },
      });

      return Array.isArray(response.data) ? response.data : [];
    },
  });
}

export function useFolders() {
  return useQuery({
    queryKey: fileKeys.folders,
    queryFn: async (): Promise<FolderItem[]> => {
      const response = await api.get<FolderItem[]>("/folders");
      return Array.isArray(response.data) ? response.data : [];
    },
  });
}

export function useCompanyUsers(enabled = true) {
  return useQuery({
    queryKey: fileKeys.users,
    enabled,
    queryFn: async (): Promise<CompanyUser[]> => {
      const response = await api.get<CompanyUser[]>("/users");
      return Array.isArray(response.data) ? response.data : [];
    },
  });
}

export function useFileTasks(fileId?: string) {
  return useQuery({
    queryKey: fileKeys.tasks(fileId || ""),
    enabled: Boolean(fileId),
    queryFn: async (): Promise<WorkspaceTask[]> => {
      const response = await api.get<WorkspaceTask[]>("/workspace/tasks", {
        params: { fileId },
      });
      return Array.isArray(response.data) ? response.data : [];
    },
  });
}

export function useFilePreview(fileId?: string, fallbackMime = "") {
  return useQuery({
    queryKey: fileKeys.preview(fileId || ""),
    enabled: Boolean(fileId),
    staleTime: 0,
    gcTime: 0,
    queryFn: async () => {
      const result = await getPrivatePreviewUrl(String(fileId));
      return {
        url: result.url,
        mimeType: result.mimeType || fallbackMime || "",
      };
    },
  });
}

/* -------------------------------------------------------------------------- */
/* Mutations                                                                  */
/* -------------------------------------------------------------------------- */

export function useCreateFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateFolderPayload): Promise<FolderItem> => {
      const response = await api.post<FolderItem>("/folders", payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: fileKeys.folders });
      invalidateFiles(queryClient);
    },
  });
}

export function useUpdateFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      folderId,
      payload,
    }: {
      folderId: string;
      payload: UpdateFolderPayload;
    }): Promise<FolderItem> => {
      const response = await api.patch<FolderItem>(
        `/folders/${encodeURIComponent(folderId)}`,
        payload,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: fileKeys.folders });
      invalidateFiles(queryClient);
    },
  });
}

export function useDeleteFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (folderId: string): Promise<void> => {
      await api.delete(`/folders/${encodeURIComponent(folderId)}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: fileKeys.folders });
      invalidateFiles(queryClient);
    },
  });
}

export function useUpdateFile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      fileId,
      payload,
    }: {
      fileId: string;
      payload: UpdateFilePayload;
    }): Promise<FileItem> => {
      const response = await api.patch<FileItem>(
        `/files/${encodeURIComponent(fileId)}`,
        payload,
      );
      return response.data;
    },
    onSuccess: (_data, variables) => {
      invalidateFiles(queryClient);
      queryClient.invalidateQueries({
        queryKey: fileKeys.detail(variables.fileId),
      });
    },
  });
}

export function useDeleteFile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (fileId: string): Promise<void> => {
      await api.delete(`/files/${encodeURIComponent(fileId)}`);
    },
    onSuccess: (_data, fileId) => {
      invalidateFiles(queryClient);
      queryClient.removeQueries({ queryKey: fileKeys.preview(fileId) });
      queryClient.removeQueries({ queryKey: fileKeys.tasks(fileId) });
    },
  });
}

export function useDownloadFile() {
  return useMutation({
    mutationFn: async ({
      fileId,
      fileName,
    }: {
      fileId: string;
      fileName?: string;
    }) => {
      return downloadPrivateFile(fileId, fileName || "download");
    },
  });
}

export function useCreateShare() {
  return useMutation({
    mutationFn: async (payload: CreateSharePayload) => {
      const response = await api.post<{ publicToken?: string }>("/sharing", payload);
      return response.data;
    },
  });
}

export function useCreateFileTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateTaskPayload) => {
      const response = await api.post("/workspace/tasks", payload);
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: fileKeys.tasks(variables.fileId),
      });
    },
  });
}

export function filesErrorMessage(error: unknown, fallback = "Something went wrong") {
  if (!error) return fallback;
  if (typeof error === "string") return error;
  const anyError = error as {
    message?: string;
    response?: { data?: { error?: string; message?: string } };
  };
  return (
    anyError.response?.data?.error ||
    anyError.response?.data?.message ||
    anyError.message ||
    fallback
  );
}

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/axios";
import { assertAllowedUploadFile } from "../utils/uploadAllowlist";

export interface UploadedFile {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  folderId?: string | null;
  storageKey?: string | null;
  [key: string]: unknown;
}

interface UploadOptions {
  folderId?: string;
  source?: "UPLOAD" | "SCAN" | "FAX" | string;
  name?: string;
}

interface UseFileUploaderReturn {
  uploadFile: (file: File, options?: UploadOptions) => Promise<UploadedFile>;
  uploading: boolean;
  progress: number;
  error: string | null;
  reset: () => void;
}

export function useFileUploader(): UseFileUploaderReturn {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setUploading(false);
    setProgress(0);
    setError(null);
  }, []);

  const uploadFile = useCallback(
    async (file: File, options: UploadOptions = {}): Promise<UploadedFile> => {
      setUploading(true);
      setProgress(0);
      setError(null);

      try {
        assertAllowedUploadFile(file);

        const formData = new FormData();
        formData.append("file", file);

        if (options.folderId) {
          formData.append("folderId", options.folderId);
        }

        if (options.source) {
          formData.append("source", options.source);
        }

        if (options.name) {
          formData.append("name", options.name);
        }

        const response = await api.post<UploadedFile>("/files/upload", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          transformRequest: [
            (data, headers) => {
              // Drop default JSON content-type so the browser sets the boundary.
              if (headers && typeof headers === "object") {
                delete (headers as Record<string, unknown>)["Content-Type"];
              }
              return data;
            },
          ],
          onUploadProgress: (event) => {
            if (!event.total) return;
            setProgress(Math.round((event.loaded * 100) / event.total));
          },
        });

        setProgress(100);
        await queryClient.invalidateQueries({ queryKey: ["files"] });

        return response.data;
      } catch (err: unknown) {
        const anyErr = err as {
          message?: string;
          response?: { data?: { message?: string; error?: string } };
        };
        const message =
          anyErr?.response?.data?.message ||
          anyErr?.response?.data?.error ||
          anyErr?.message ||
          "File upload failed.";

        setError(message);
        throw new Error(message);
      } finally {
        setUploading(false);
      }
    },
    [queryClient],
  );

  return {
    uploadFile,
    uploading,
    progress,
    error,
    reset,
  };
}

export default useFileUploader;

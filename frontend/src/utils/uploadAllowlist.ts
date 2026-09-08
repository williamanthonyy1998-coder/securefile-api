const ALLOWED_EXTENSIONS = new Set([
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "csv",
  "ppt",
  "pptx",
  "txt",
  "rtf",
  "odt",
  "ods",
  "odp",
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "bmp",
  "tif",
  "tiff",
  "svg",
  "heic",
  "heif",
]);

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/rtf",
  "text/plain",
  "text/csv",
  "text/rtf",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/vnd.oasis.opendocument.presentation",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/bmp",
  "image/tiff",
  "image/svg+xml",
  "image/heic",
  "image/heif",
]);

export const UPLOAD_ACCEPT =
  ".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.txt,.rtf,.odt,.ods,.odp,.jpg,.jpeg,.png,.gif,.webp,.bmp,.tif,.tiff,.svg,.heic,.heif,image/*";

export const UPLOAD_TYPE_ERROR =
  "Only documents and images can be uploaded. Video, audio, and other file types are not allowed.";

function extensionOf(name: string) {
  const match = String(name || "")
    .trim()
    .toLowerCase()
    .match(/\.([a-z0-9]+)$/);
  return match?.[1] || "";
}

export function isAllowedUploadType(mimeType?: string | null, fileName?: string | null) {
  const mime = String(mimeType || "")
    .toLowerCase()
    .split(";")[0]
    .trim();
  const ext = extensionOf(fileName || "");

  if (ext && ALLOWED_EXTENSIONS.has(ext)) return true;
  if (mime && ALLOWED_MIME_TYPES.has(mime)) return true;
  if (mime.startsWith("image/")) return true;
  return false;
}

export function assertAllowedUploadFile(file: File) {
  if (isAllowedUploadType(file.type, file.name)) return;
  throw new Error(UPLOAD_TYPE_ERROR);
}

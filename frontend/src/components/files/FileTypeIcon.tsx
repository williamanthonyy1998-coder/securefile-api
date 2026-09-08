import {
  File,
  FileArchive,
  FileAudio,
  FileCode,
  FileImage,
  FileJson,
  FileSpreadsheet,
  FileText,
  FileType,
  FileVideo,
  type LucideIcon,
} from "lucide-react";

type FileTypeMeta = {
  Icon: LucideIcon;
  label: string;
  tone: string;
};

function extensionOf(name?: string) {
  const match = String(name || "")
    .trim()
    .toLowerCase()
    .match(/\.([a-z0-9]+)$/);
  return match?.[1] || "";
}

export function getFileTypeMeta(
  mimeType?: string | null,
  fileName?: string | null,
): FileTypeMeta {
  const mime = String(mimeType || "").toLowerCase();
  const ext = extensionOf(fileName || "");

  if (
    mime === "application/pdf" ||
    ext === "pdf"
  ) {
    return { Icon: FileText, label: "PDF", tone: "pdf" };
  }

  if (
    mime.includes("spreadsheet") ||
    mime.includes("excel") ||
    mime === "text/csv" ||
    ["xls", "xlsx", "csv", "ods"].includes(ext)
  ) {
    return { Icon: FileSpreadsheet, label: "Spreadsheet", tone: "excel" };
  }

  if (
    mime.includes("word") ||
    mime === "application/msword" ||
    ["doc", "docx", "odt", "rtf"].includes(ext)
  ) {
    return { Icon: FileType, label: "Document", tone: "word" };
  }

  if (
    mime.includes("presentation") ||
    mime.includes("powerpoint") ||
    ["ppt", "pptx", "odp"].includes(ext)
  ) {
    return { Icon: FileType, label: "Presentation", tone: "ppt" };
  }

  if (mime.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "tif", "tiff"].includes(ext)) {
    return { Icon: FileImage, label: "Image", tone: "image" };
  }

  if (mime.startsWith("video/") || ["mp4", "mov", "webm", "avi", "mkv"].includes(ext)) {
    return { Icon: FileVideo, label: "Video", tone: "video" };
  }

  if (mime.startsWith("audio/") || ["mp3", "wav", "ogg", "m4a", "flac"].includes(ext)) {
    return { Icon: FileAudio, label: "Audio", tone: "audio" };
  }

  if (
    mime.includes("zip") ||
    mime.includes("compressed") ||
    mime.includes("rar") ||
    mime.includes("7z") ||
    ["zip", "rar", "7z", "tar", "gz"].includes(ext)
  ) {
    return { Icon: FileArchive, label: "Archive", tone: "archive" };
  }

  if (mime === "application/json" || ext === "json") {
    return { Icon: FileJson, label: "JSON", tone: "code" };
  }

  if (
    mime.startsWith("text/") ||
    mime.includes("javascript") ||
    mime.includes("typescript") ||
    ["js", "ts", "tsx", "jsx", "html", "css", "xml", "md", "txt"].includes(ext)
  ) {
    return { Icon: FileCode, label: "Text", tone: "code" };
  }

  return { Icon: File, label: "File", tone: "default" };
}

export default function FileTypeIcon({
  mimeType,
  fileName,
  size = 16,
}: {
  mimeType?: string | null;
  fileName?: string | null;
  size?: number;
}) {
  const { Icon, label, tone } = getFileTypeMeta(mimeType, fileName);

  return (
    <span className={`file-type-icon file-type-icon--${tone}`} title={label}>
      <Icon size={size} aria-hidden />
    </span>
  );
}

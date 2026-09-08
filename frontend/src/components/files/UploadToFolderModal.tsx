import { FormEvent, useEffect, useState } from "react";
import { FolderPlus, UploadCloud, X } from "lucide-react";
import {
  filesErrorMessage,
  useCreateFolder,
  type FolderItem,
} from "../../api/files.api";
import { useFileUploader } from "../../hooks/useFileUploader";

type UploadToFolderModalProps = {
  file: File;
  folders: FolderItem[];
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
};

export default function UploadToFolderModal({
  file,
  folders,
  onClose,
  onSuccess,
  onError,
}: UploadToFolderModalProps) {
  const [targetFolderId, setTargetFolderId] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const createFolder = useCreateFolder();
  const { uploadFile, uploading, progress } = useFileUploader();

  useEffect(() => {
    setTargetFolderId("");
    setNewFolderName("");
  }, [file]);

  async function handleCreateFolder() {
    if (!newFolderName.trim() || createFolder.isPending) return;
    try {
      const created = await createFolder.mutateAsync({
        name: newFolderName.trim(),
      });
      setNewFolderName("");
      if (created?.id) setTargetFolderId(created.id);
      onSuccess("Folder created.");
    } catch (e) {
      onError(filesErrorMessage(e, "Unable to create folder."));
    }
  }

  async function upload(e?: FormEvent) {
    e?.preventDefault();
    if (uploading) return;
    try {
      await uploadFile(file, {
        folderId: targetFolderId || undefined,
        source: "UPLOAD",
      });
      const folderName = targetFolderId
        ? folders.find((f) => f.id === targetFolderId)?.name || "selected folder"
        : "root";
      onSuccess(`File uploaded to ${folderName}.`);
      onClose();
    } catch (err) {
      onError(filesErrorMessage(err, "Unable to upload file."));
    }
  }

  const busy = createFolder.isPending || uploading;

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="modal">
        <div className="modal-head">
          <div>
            <p className="eyebrow">Upload</p>
            <h2>Choose destination folder</h2>
            <p className="muted">{file.name}</p>
          </div>
          <button className="close-btn" disabled={busy} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <p className="muted">
          You are viewing all visible files. Select an existing folder, or
          create a new one, then upload.
        </p>

        <form onSubmit={upload}>
          <label>
            Destination folder
            <select
              value={targetFolderId}
              onChange={(e) => setTargetFolderId(e.target.value)}
              disabled={busy}
            >
              <option value="">Root / No folder</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                  {f.isPersonal ? " (Personal)" : ""}
                </option>
              ))}
            </select>
          </label>

          <div className="modal-section">Create folder</div>
          <div className="toolbar" style={{ marginBottom: 16 }}>
            <input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="New folder name"
              disabled={busy}
            />
            <button
              type="button"
              className="btn small secondary"
              disabled={!newFolderName.trim() || busy}
              onClick={handleCreateFolder}
            >
              <FolderPlus size={15} />
              {createFolder.isPending ? "Creating…" : "Create"}
            </button>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn secondary"
              disabled={busy}
              onClick={onClose}
            >
              Cancel
            </button>
            <button className="btn" disabled={busy}>
              <UploadCloud size={16} />
              {uploading ? `Uploading… ${progress}%` : "Upload here"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

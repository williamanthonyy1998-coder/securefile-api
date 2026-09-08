import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import FilePreviewModal from "../components/files/FilePreviewModal";
import UploadToFolderModal from "../components/files/UploadToFolderModal";
import FileActionsMenu from "../components/files/FileActionsMenu";
import FileTypeIcon from "../components/files/FileTypeIcon";
import FolderSidebar from "../components/files/FolderSidebar";
import {
  filesErrorMessage,
  useCompanyUsers,
  useCreateFileTask,
  useCreateFolder,
  useCreateShare,
  useDeleteFile,
  useDeleteFolder,
  useDownloadFile,
  useFilePreview,
  useFiles,
  useFileTasks,
  useFolders,
  useUpdateFile,
  useUpdateFolder,
  type FileItem,
  type FolderItem,
} from "../api/files.api";
import { useFileUploader } from "../hooks/useFileUploader";
import { UPLOAD_ACCEPT, assertAllowedUploadFile } from "../utils/uploadAllowlist";
import {
  Download,
  Edit3,
  Eye,
  FolderPlus,
  Share2,
  Trash2,
  UploadCloud,
  X,
  Folder,
  ChevronRight,
  Copy,
  ExternalLink,
  ClipboardPlus,
  Move,
} from "lucide-react";

const emptyPerms = {
  view: true,
  download: false,
  upload: false,
  edit: false,
  delete: false,
  share: false,
};

export default function Files() {
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const ref = useRef<HTMLInputElement>(null);
  const [folderId, setFolderId] = useState("");
  const [selected, setSelected] = useState<FileItem | null>(null);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [folderName, setFolderName] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [shareFile, setShareFile] = useState<FileItem | null>(null);
  const [shareFolder, setShareFolder] = useState<FolderItem | null>(null);
  const [shareType, setShareType] = useState("INTERNAL");
  const [shareRecipient, setShareRecipient] = useState("");
  const [sharePerms, setSharePerms] = useState({ ...emptyPerms });
  const [sharePassword, setSharePassword] = useState("");
  const [shareExpiry, setShareExpiry] = useState("");
  const [publicToken, setPublicToken] = useState("");
  const [taskFile, setTaskFile] = useState<FileItem | null>(null);
  const [taskForm, setTaskForm] = useState<any>({
    assigneeId: "",
    title: "",
    description: "",
    startPage: "",
    endPage: "",
    priority: "MEDIUM",
    dueAt: "",
  });
  const [addons, setAddons] = useState<any>({ preview: false, rename: false });
  const [moveItem, setMoveItem] = useState<{
    item: any;
    type: "FILE" | "FOLDER";
  } | null>(null);
  const [moveTarget, setMoveTarget] = useState("");
  const [pendingUploadFile, setPendingUploadFile] = useState<File | null>(null);

  const searchQuery = sp.get("q") || "";
  const filesQuery = useFiles({
    folderId: folderId || undefined,
    q: searchQuery || undefined,
  });
  const foldersQuery = useFolders();
  const previewQuery = useFilePreview(selected?.id, selected?.mimeType || "");
  const fileTasksQuery = useFileTasks(selected?.id);
  const usersQuery = useCompanyUsers(
    Boolean(shareFile || shareFolder || taskFile),
  );

  const createFolderMutation = useCreateFolder();
  const updateFolderMutation = useUpdateFolder();
  const deleteFolderMutation = useDeleteFolder();
  const updateFileMutation = useUpdateFile();
  const deleteFileMutation = useDeleteFile();
  const { uploadFile, uploading, progress } = useFileUploader();
  const downloadFileMutation = useDownloadFile();
  const createShareMutation = useCreateShare();
  const createTaskMutation = useCreateFileTask();

  const files = filesQuery.data ?? [];
  const folders = foldersQuery.data ?? [];
  const users = usersQuery.data ?? [];
  const fileTasks = fileTasksQuery.data ?? [];
  const preview = previewQuery.data?.url || "";
  const previewMime = previewQuery.data?.mimeType || selected?.mimeType || "";

  useEffect(() => {
    try {
      setAddons(JSON.parse(localStorage.getItem("sf_addons") || "{}"));
    } catch {}
  }, []);

  useEffect(() => {
    const url = previewQuery.data?.url;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [previewQuery.data?.url]);

  useEffect(() => {
    if (filesQuery.error) {
      setError(filesErrorMessage(filesQuery.error, "Unable to load files."));
    }
  }, [filesQuery.error]);

  useEffect(() => {
    if (previewQuery.error && selected) {
      setError(filesErrorMessage(previewQuery.error, "Preview unavailable."));
    }
  }, [previewQuery.error, selected]);

  async function upload(selectedFile?: File | null) {
    const f = selectedFile ?? ref.current?.files?.[0];
    if (!f) return;

    try {
      assertAllowedUploadFile(f);
    } catch (e) {
      setError(filesErrorMessage(e));
      if (ref.current) ref.current.value = "";
      return;
    }

    if (!folderId) {
      setPendingUploadFile(f);
      if (ref.current) ref.current.value = "";
      return;
    }

    try {
      await uploadFile(f, {
        folderId: folderId || undefined,
        source: "UPLOAD",
      });
      setNotice("File uploaded.");
      setError("");
    } catch (e) {
      setError(filesErrorMessage(e));
    }
    if (ref.current) ref.current.value = "";
  }

  function closePreview() {
    setSelected(null);
    setPreviewZoom(1);
  }

  async function createFolder() {
    if (!folderName.trim()) return;
    try {
      await createFolderMutation.mutateAsync({
        name: folderName,
        parentId: folderId || undefined,
      });
      setFolderName("");
      setNotice("Folder created.");
      setError("");
    } catch (e) {
      setError(filesErrorMessage(e));
    }
  }

  async function renameFile(f: FileItem) {
    const name = window.prompt("New file name", f.name);
    if (!name || name === f.name) return;
    try {
      await updateFileMutation.mutateAsync({
        fileId: f.id,
        payload: { name },
      });
      setNotice("File renamed.");
      setError("");
    } catch (e) {
      setError(filesErrorMessage(e));
    }
  }

  async function deleteFile(f: FileItem) {
    if (!confirm(`Delete "${f.name}"?`)) return;
    try {
      await deleteFileMutation.mutateAsync(f.id);
      if (selected?.id === f.id) closePreview();
      setNotice("File deleted.");
      setError("");
    } catch (e) {
      setError(filesErrorMessage(e));
    }
  }

  async function renameFolder(f: FolderItem) {
    const name = window.prompt("New folder name", f.name);
    if (!name || name === f.name) return;
    try {
      await updateFolderMutation.mutateAsync({
        folderId: f.id,
        payload: { name },
      });
      setNotice("Folder renamed.");
      setError("");
    } catch (e) {
      setError(filesErrorMessage(e));
    }
  }

  async function deleteFolder(f: FolderItem) {
    if (!confirm(`Delete folder "${f.name}" and its empty child structure?`))
      return;
    try {
      await deleteFolderMutation.mutateAsync(f.id);
      if (folderId === f.id) setFolderId("");
      setNotice("Folder deleted.");
      setError("");
    } catch (e) {
      setError(filesErrorMessage(e));
    }
  }

  function openPreview(f: FileItem) {
    setSelected(f);
    setPreviewZoom(1);
  }

  async function download(f: FileItem) {
    try {
      await downloadFileMutation.mutateAsync({
        fileId: f.id,
        fileName: f.name,
      });
    } catch (e) {
      setError(filesErrorMessage(e));
    }
  }

  function openFilePage(f: FileItem) {
    navigate(`/files/${encodeURIComponent(f.id)}/view`);
  }

  function openShare(f: FileItem) {
    setShareFile(f);
    setShareFolder(null);
    setPublicToken("");
    setShareType("INTERNAL");
    setShareRecipient("");
    setSharePerms({ ...emptyPerms });
    setSharePassword("");
    setShareExpiry("");
  }

  function openFolderShare(f: FolderItem) {
    setShareFolder(f);
    setShareFile(null);
    setPublicToken("");
    setShareType("INTERNAL");
    setShareRecipient("");
    setSharePerms({ ...emptyPerms });
    setSharePassword("");
    setShareExpiry("");
  }

  function openTask(f: FileItem) {
    setTaskFile(f);
    setTaskForm({
      assigneeId: "",
      title: `Review ${f.name}`,
      description: "",
      startPage: "",
      endPage: "",
      priority: "MEDIUM",
      dueAt: "",
    });
  }

  async function createTask() {
    if (!taskFile) return;
    try {
      await createTaskMutation.mutateAsync({
        ...taskForm,
        fileId: taskFile.id,
        startPage: taskForm.startPage ? +taskForm.startPage : undefined,
        endPage: taskForm.endPage ? +taskForm.endPage : undefined,
        dueAt: taskForm.dueAt
          ? new Date(taskForm.dueAt).toISOString()
          : undefined,
      });
      setNotice("Task assigned.");
      setError("");
      setTaskFile(null);
    } catch (e) {
      setError(filesErrorMessage(e));
    }
  }

  async function createShare() {
    if (!shareFile && !shareFolder) return;
    try {
      const d = await createShareMutation.mutateAsync({
        fileId: shareFile?.id,
        folderId: shareFolder?.id,
        type: shareType,
        recipientId: shareType === "INTERNAL" ? shareRecipient : undefined,
        permissions: sharePerms,
        password: sharePassword || undefined,
        expiresAt: shareExpiry || undefined,
      });
      setPublicToken(d.publicToken || "");
      setNotice("Share created.");
      setError("");
      if (shareType === "INTERNAL") {
        setShareFile(null);
        setShareFolder(null);
      }
    } catch (e) {
      setError(filesErrorMessage(e));
    }
  }

  function openMove(item: any, type: "FILE" | "FOLDER") {
    setMoveItem({ item, type });
    setMoveTarget(type === "FILE" ? item.folderId || "" : item.parentId || "");
  }

  async function confirmMove() {
    if (!moveItem) return;
    try {
      setError("");
      if (moveItem.type === "FILE") {
        await updateFileMutation.mutateAsync({
          fileId: moveItem.item.id,
          payload: { folderId: moveTarget || null },
        });
      } else {
        await updateFolderMutation.mutateAsync({
          folderId: moveItem.item.id,
          payload: { parentId: moveTarget || null },
        });
      }
      setNotice(
        `${moveItem.type === "FILE" ? "File" : "Folder"} moved successfully.`,
      );
      setMoveItem(null);
      setMoveTarget("");
    } catch (e) {
      setError(filesErrorMessage(e));
    }
  }

  const moving = updateFileMutation.isPending || updateFolderMutation.isPending;
  const taskUsers = users;
  const currentFolder = useMemo(
    () => folders.find((f) => f.id === folderId),
    [folders, folderId],
  );

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Workspace</p>
          <h1>Files</h1>
          <p>
            {sp.get("q")
              ? `Search results for “${sp.get("q")}”`
              : "Secure files, folders, sharing and permission-based access."}
          </p>
        </div>
        <div className="toolbar">
          <input
            ref={ref}
            type="file"
            accept={UPLOAD_ACCEPT}
            onChange={() => upload(ref.current?.files?.[0])}
          />
          <button
            className="btn"
            disabled={uploading}
            onClick={() => ref.current?.click()}
          >
            <UploadCloud size={16} />
            {uploading ? `Uploading… ${progress}%` : "Upload"}
          </button>
        </div>
      </div>

      {error && (
        <div className="error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}
      {notice && (
        <div className="success" style={{ marginBottom: 16 }}>
          {notice}
        </div>
      )}

      <div className="files-layout">
        <FolderSidebar
          folders={folders}
          selectedFolderId={folderId}
          onSelect={setFolderId}
        />

        <div className="panel files-main-panel">
          <div className="toolbar" style={{ marginBottom: 12 }}>
            <input
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="New folder name"
            />
            <button className="btn small" onClick={createFolder}>
              <FolderPlus size={15} /> Create
            </button>
          </div>

          {currentFolder ? (
            <div className="breadcrumb">
              <Folder size={15} /> {currentFolder.name}{" "}
              <ChevronRight size={14} />
              <button className="link-button" onClick={() => setFolderId("")}>
                All files
              </button>
            </div>
          ) : (
            !sp.get("q") && (
              <div className="breadcrumb">
                <Folder size={15} /> All visible files
              </div>
            )
          )}

          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Size</th>
                <th>Source</th>
                <th className="actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {folders
                .filter((f) => f.parentId === folderId && !sp.get("q"))
                .map((f) => (
                  <tr key={`folder-${f.id}`}>
                    <td>
                      <button
                        className="link-button"
                        onClick={() => setFolderId(f.id)}
                      >
                        <Folder
                          size={15}
                          style={{ verticalAlign: "middle", marginRight: 6 }}
                        />
                        {f.name}
                        {f.isPersonal && (
                          <span className="folder-badge">Personal</span>
                        )}
                      </button>
                    </td>
                    <td>{f.isPersonal ? "Personal folder" : "Folder"}</td>
                    <td>—</td>
                    <td>—</td>
                    <td className="actions-col">
                      <div className="row-actions">
                        <FileActionsMenu
                          items={[
                            {
                              key: "share",
                              label: f.isPersonal
                                ? "Share personal folder"
                                : "Share",
                              icon: <Share2 size={14} />,
                              onClick: () => openFolderShare(f),
                            },
                            ...(!f.isPersonal
                              ? [
                                  {
                                    key: "move",
                                    label: "Move",
                                    icon: <Move size={14} />,
                                    onClick: () =>
                                      openMove(f, "FOLDER" as const),
                                  },
                                  ...(addons.rename
                                    ? [
                                        {
                                          key: "rename",
                                          label: "Rename",
                                          icon: <Edit3 size={14} />,
                                          onClick: () => renameFolder(f),
                                        },
                                      ]
                                    : []),
                                  {
                                    key: "delete",
                                    label: "Delete",
                                    icon: <Trash2 size={14} />,
                                    danger: true,
                                    onClick: () => deleteFolder(f),
                                  },
                                ]
                              : []),
                          ]}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              {files.map((f) => (
                <tr key={f.id}>
                  <td>
                    <button
                      className="link-button file-name-button"
                      onClick={() => openPreview(f)}
                      onDoubleClick={() => openFilePage(f)}
                      title="Click to preview • Double-click to open"
                    >
                      <FileTypeIcon mimeType={f.mimeType} fileName={f.name} />
                      <span className="file-name-text">{f.name}</span>
                    </button>
                    <small style={{ display: "block", color: "#8a96a8" }}>
                      {f.folder?.name || "No folder"}
                    </small>
                  </td>
                  <td>{f.mimeType}</td>
                  <td>{(Number(f.sizeBytes) / 1024).toFixed(1)} KB</td>
                  <td>{f.source || "UPLOAD"}</td>
                  <td className="actions-col">
                    <div className="row-actions">
                      <FileActionsMenu
                        items={[
                          ...(addons.preview
                            ? [
                                {
                                  key: "preview",
                                  label: "Preview",
                                  icon: <Eye size={14} />,
                                  onClick: () => openPreview(f),
                                },
                                {
                                  key: "open-page",
                                  label: "Open in new page",
                                  icon: <ExternalLink size={14} />,
                                  onClick: () => openFilePage(f),
                                },
                              ]
                            : []),
                          {
                            key: "download",
                            label: "Download",
                            icon: <Download size={14} />,
                            onClick: () => download(f),
                          },
                          ...(addons.rename
                            ? [
                                {
                                  key: "rename",
                                  label: "Rename",
                                  icon: <Edit3 size={14} />,
                                  onClick: () => renameFile(f),
                                },
                              ]
                            : []),
                          {
                            key: "move",
                            label: "Move",
                            icon: <Move size={14} />,
                            onClick: () => openMove(f, "FILE" as const),
                          },
                          {
                            key: "share",
                            label: "Share",
                            icon: <Share2 size={14} />,
                            onClick: () => openShare(f),
                          },
                          ...(localStorage.getItem("sf_role") ===
                          "COMPANY_ADMIN"
                            ? [
                                {
                                  key: "task",
                                  label: "Assign task",
                                  icon: <ClipboardPlus size={14} />,
                                  onClick: () => openTask(f),
                                },
                              ]
                            : []),
                          {
                            key: "delete",
                            label: "Delete",
                            icon: <Trash2 size={14} />,
                            danger: true,
                            onClick: () => deleteFile(f),
                          },
                        ]}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!files.length &&
            !folders.filter((f) => f.parentId === folderId && !sp.get("q"))
              .length && (
              <div className="empty-company">
                <h3>No files here</h3>
                <p>Upload a file or create a folder to get started.</p>
              </div>
            )}
        </div>
      </div>

      {addons.preview && selected && (
        <FilePreviewModal
          file={selected}
          previewUrl={preview}
          previewMime={previewMime}
          zoom={previewZoom}
          fileTasks={fileTasks}
          onZoomChange={setPreviewZoom}
          onClose={closePreview}
          onOpenPage={() => openFilePage(selected)}
          onDownload={() => download(selected)}
        />
      )}

      {pendingUploadFile && (
        <UploadToFolderModal
          file={pendingUploadFile}
          folders={folders}
          onClose={() => setPendingUploadFile(null)}
          onSuccess={(message) => {
            setNotice(message);
            setError("");
          }}
          onError={(message) => setError(message)}
        />
      )}

      {moveItem && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) =>
            e.target === e.currentTarget && !moving && setMoveItem(null)
          }
        >
          <div className="modal">
            <div className="modal-head">
              <div>
                <p className="eyebrow">File Management</p>
                <h2>Move {moveItem.type === "FILE" ? "file" : "folder"}</h2>
                <p className="muted">{moveItem.item.name}</p>
              </div>
              <button
                className="close-btn"
                disabled={moving}
                onClick={() => setMoveItem(null)}
              >
                <X size={18} />
              </button>
            </div>
            <p className="muted">
              Choose the destination. Leaving the destination as root moves it
              out of the current folder.
            </p>
            <label>
              Destination folder
              <select
                value={moveTarget}
                onChange={(e) => setMoveTarget(e.target.value)}
              >
                <option value="">Root / My visible files</option>
                {folders
                  .filter((f) => {
                    if (f.isPersonal && moveItem.type === "FOLDER")
                      return false;
                    if (moveItem.type === "FILE") return true;
                    if (f.id === moveItem.item.id) return false;
                    let cursor = f.parentId;
                    while (cursor) {
                      if (cursor === moveItem.item.id) return false;
                      const parent = folders.find((x) => x.id === cursor);
                      cursor = parent?.parentId || "";
                    }
                    return true;
                  })
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                      {f.isPersonal ? " (Personal)" : ""}
                    </option>
                  ))}
              </select>
            </label>
            <div className="modal-actions">
              <button
                className="btn secondary"
                disabled={moving}
                onClick={() => setMoveItem(null)}
              >
                Cancel
              </button>
              <button className="btn" disabled={moving} onClick={confirmMove}>
                {moving ? "Moving..." : "Move here"}
              </button>
            </div>
          </div>
        </div>
      )}

      {taskFile && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-head">
              <div>
                <p className="eyebrow">Task Management</p>
                <h2>Assign task</h2>
                <p className="muted">{taskFile.name}</p>
              </div>
              <button className="close-btn" onClick={() => setTaskFile(null)}>
                <X size={18} />
              </button>
            </div>
            <label>
              Assignee
              <select
                value={taskForm.assigneeId}
                onChange={(e) =>
                  setTaskForm({ ...taskForm, assigneeId: e.target.value })
                }
              >
                <option value="">Select employee/client</option>
                {taskUsers
                  .filter(
                    (u: any) =>
                      u.id !== localStorage.getItem("sf_user_id") &&
                      (u.role === "EMPLOYEE" || u.role === "CLIENT"),
                  )
                  .map((u: any) => (
                    <option key={u.id} value={u.id}>
                      {u.uniqueName} — {u.email}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Task title
              <input
                value={taskForm.title}
                onChange={(e) =>
                  setTaskForm({ ...taskForm, title: e.target.value })
                }
              />
            </label>
            <label>
              Instructions
              <textarea
                rows={4}
                value={taskForm.description}
                onChange={(e) =>
                  setTaskForm({ ...taskForm, description: e.target.value })
                }
              />
            </label>
            <div className="grid2">
              <label>
                Start page
                <input
                  type="number"
                  min="1"
                  value={taskForm.startPage}
                  onChange={(e) =>
                    setTaskForm({ ...taskForm, startPage: e.target.value })
                  }
                />
              </label>
              <label>
                End page
                <input
                  type="number"
                  min="1"
                  value={taskForm.endPage}
                  onChange={(e) =>
                    setTaskForm({ ...taskForm, endPage: e.target.value })
                  }
                />
              </label>
            </div>
            <div className="grid2">
              <label>
                Priority
                <select
                  value={taskForm.priority}
                  onChange={(e) =>
                    setTaskForm({ ...taskForm, priority: e.target.value })
                  }
                >
                  {["LOW", "MEDIUM", "HIGH", "URGENT"].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label>
                Due date/time
                <input
                  type="datetime-local"
                  value={taskForm.dueAt}
                  onChange={(e) =>
                    setTaskForm({ ...taskForm, dueAt: e.target.value })
                  }
                />
              </label>
            </div>
            <div className="modal-actions">
              <button
                className="btn secondary"
                onClick={() => setTaskFile(null)}
              >
                Cancel
              </button>
              <button
                className="btn"
                disabled={!taskForm.assigneeId || !taskForm.title.trim()}
                onClick={createTask}
              >
                Assign task
              </button>
            </div>
          </div>
        </div>
      )}
      {(shareFile || shareFolder) && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) =>
            e.target === e.currentTarget &&
            (setShareFile(null), setShareFolder(null))
          }
        >
          <div className="modal">
            <div className="modal-head">
              <div>
                <p className="eyebrow">Sharing</p>
                <h2>Share {(shareFile || shareFolder)?.name}</h2>
              </div>
              <button
                className="close-btn"
                onClick={() => {
                  setShareFile(null);
                  setShareFolder(null);
                }}
              >
                <X size={18} />
              </button>
            </div>
            <label>
              Share type
              <select
                value={shareType}
                onChange={(e) => setShareType(e.target.value)}
              >
                <option value="INTERNAL">Internal company user</option>
                <option value="PUBLIC">Public link</option>
              </select>
            </label>
            {shareType === "INTERNAL" && (
              <label>
                Recipient
                <select
                  value={shareRecipient}
                  onChange={(e) => setShareRecipient(e.target.value)}
                >
                  <option value="">Choose a user</option>
                  {users
                    .filter((u) => u.id !== localStorage.getItem("sf_user_id"))
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.uniqueName} — {u.email}
                      </option>
                    ))}
                </select>
              </label>
            )}
            <div className="modal-section">Permissions</div>
            <div className="permission-checks" style={{ paddingLeft: 0 }}>
              {(
                [
                  "view",
                  "download",
                  "upload",
                  "edit",
                  "delete",
                  ...(addons.reshare ? ["share"] : []),
                ] as Array<keyof typeof sharePerms>
              ).map((k) => (
                <label className="tiny-check" key={k}>
                  <input
                    type="checkbox"
                    checked={!!sharePerms[k]}
                    onChange={(e) =>
                      setSharePerms({ ...sharePerms, [k]: e.target.checked })
                    }
                  />
                  {k}
                </label>
              ))}
            </div>
            {shareType === "PUBLIC" && (
              <>
                <label>
                  Password (optional)
                  <input
                    type="password"
                    value={sharePassword}
                    onChange={(e) => setSharePassword(e.target.value)}
                    placeholder="Protect this link"
                  />
                </label>
                <label>
                  Expires (optional)
                  <input
                    type="datetime-local"
                    value={shareExpiry}
                    onChange={(e) => setShareExpiry(e.target.value)}
                  />
                </label>
              </>
            )}
            {publicToken && (
              <div className="success">
                Public token created.{" "}
                <button
                  className="link-button"
                  onClick={() =>
                    navigator.clipboard.writeText(
                      `${window.location.origin}/public-share/${publicToken}`,
                    )
                  }
                >
                  <Copy size={14} /> Copy public link
                </button>
              </div>
            )}
            <div className="modal-actions">
              <button
                className="btn secondary"
                onClick={() => setShareFile(null)}
              >
                Close
              </button>
              <button className="btn" onClick={createShare}>
                <Share2 size={15} /> Create share
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

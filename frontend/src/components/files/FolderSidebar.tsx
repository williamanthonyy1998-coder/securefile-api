import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  Files as FilesIcon,
} from "lucide-react";

type FolderSidebarProps = {
  folders: any[];
  selectedFolderId: string;
  onSelect: (folderId: string) => void;
};

function isAncestorOf(
  folders: any[],
  ancestorId: string,
  folderId: string,
): boolean {
  let current = folders.find((f) => f.id === folderId);
  while (current?.parentId) {
    if (current.parentId === ancestorId) return true;
    current = folders.find((f) => f.id === current.parentId);
  }
  return false;
}

function FolderTreeItem({
  folder,
  folders,
  selectedFolderId,
  onSelect,
  depth,
}: {
  folder: any;
  folders: any[];
  selectedFolderId: string;
  onSelect: (folderId: string) => void;
  depth: number;
}) {
  const children = useMemo(
    () =>
      folders
        .filter((f) => f.parentId === folder.id)
        .sort((a, b) => String(a.name).localeCompare(String(b.name))),
    [folders, folder.id],
  );

  const shouldExpand =
    selectedFolderId === folder.id ||
    isAncestorOf(folders, folder.id, selectedFolderId);

  const [expanded, setExpanded] = useState(shouldExpand);

  useEffect(() => {
    if (shouldExpand) setExpanded(true);
  }, [shouldExpand]);

  const isActive = selectedFolderId === folder.id;

  return (
    <div className="folder-tree-item">
      <div
        className={`folder-tree-row ${isActive ? "active" : ""}`}
        style={{ paddingLeft: 10 + depth * 14 }}
      >
        {children.length ? (
          <button
            type="button"
            className="folder-tree-toggle"
            aria-label={expanded ? "Collapse folder" : "Expand folder"}
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <span className="folder-tree-spacer" />
        )}
        <button
          type="button"
          className="folder-tree-button"
          onClick={() => {
            onSelect(folder.id);
            if (children.length) setExpanded(true);
          }}
        >
          {isActive || expanded ? (
            <FolderOpen size={15} />
          ) : (
            <Folder size={15} />
          )}
          <span className="folder-tree-label" title={folder.name}>
            {folder.name}
          </span>
          {folder.isPersonal && <span className="folder-badge">Personal</span>}
        </button>
      </div>
      {expanded &&
        children.map((child) => (
          <FolderTreeItem
            key={child.id}
            folder={child}
            folders={folders}
            selectedFolderId={selectedFolderId}
            onSelect={onSelect}
            depth={depth + 1}
          />
        ))}
    </div>
  );
}

export default function FolderSidebar({
  folders,
  selectedFolderId,
  onSelect,
}: FolderSidebarProps) {
  const rootFolders = useMemo(
    () =>
      folders
        .filter((f) => !f.parentId)
        .sort((a, b) => {
          if (a.isPersonal && !b.isPersonal) return -1;
          if (!a.isPersonal && b.isPersonal) return 1;
          return String(a.name).localeCompare(String(b.name));
        }),
    [folders],
  );

  return (
    <aside className="panel folder-sidebar">
      <div className="folder-sidebar-head">
        <h2>Folders</h2>
        <p className="muted">Select a folder to browse its files</p>
      </div>

      <button
        type="button"
        className={`folder-tree-row root ${!selectedFolderId ? "active" : ""}`}
        onClick={() => onSelect("")}
      >
        <span className="folder-tree-spacer" />
        <span className="folder-tree-button">
          <FilesIcon size={15} />
          <span className="folder-tree-label">All visible files</span>
        </span>
      </button>

      <div className="folder-tree">
        {rootFolders.map((folder) => (
          <FolderTreeItem
            key={folder.id}
            folder={folder}
            folders={folders}
            selectedFolderId={selectedFolderId}
            onSelect={onSelect}
            depth={0}
          />
        ))}
        {!rootFolders.length && (
          <p className="muted folder-sidebar-empty">No folders yet.</p>
        )}
      </div>
    </aside>
  );
}

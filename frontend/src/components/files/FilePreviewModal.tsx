import {
  Download,
  Maximize2,
  RotateCcw,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

type FilePreviewModalProps = {
  file: any;
  previewUrl: string;
  previewMime: string;
  zoom: number;
  fileTasks: any[];
  onZoomChange: (zoom: number | ((current: number) => number)) => void;
  onClose: () => void;
  onOpenPage: () => void;
  onDownload: () => void;
};

export default function FilePreviewModal({
  file,
  previewUrl,
  previewMime,
  zoom,
  fileTasks,
  onZoomChange,
  onClose,
  onOpenPage,
  onDownload,
}: FilePreviewModalProps) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal file-preview-modal">
        <div className="modal-head">
          <div>
            <p className="eyebrow">Preview</p>
            <h2 title={file?.name}>{file?.name || "File preview"}</h2>
            {file?.mimeType && <p className="muted">{file.mimeType}</p>}
          </div>
          <div className="preview-controls">
            <button
              className="icon-btn"
              title="Zoom out"
              onClick={() =>
                onZoomChange((z) => Math.max(0.5, Number((z - 0.1).toFixed(2))))
              }
            >
              <ZoomOut size={15} />
            </button>
            <span className="zoom-value">{Math.round(zoom * 100)}%</span>
            <button
              className="icon-btn"
              title="Zoom in"
              onClick={() =>
                onZoomChange((z) => Math.min(3, Number((z + 0.1).toFixed(2))))
              }
            >
              <ZoomIn size={15} />
            </button>
            <button
              className="icon-btn"
              title="Reset zoom"
              onClick={() => onZoomChange(1)}
            >
              <RotateCcw size={15} />
            </button>
            <button
              className="icon-btn"
              title="Open file page"
              onClick={onOpenPage}
            >
              <Maximize2 size={15} />
            </button>
            <button className="close-btn" title="Close preview" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="preview-canvas">
          {previewUrl ? (
            previewMime.startsWith("image/") ? (
              <img
                src={previewUrl}
                alt={file?.name || "Preview"}
                className="preview-image"
                style={{ transform: `scale(${zoom})` }}
              />
            ) : (
              <iframe
                title="preview"
                src={previewUrl}
                className="preview-frame"
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: "top left",
                  width: `${100 / zoom}%`,
                  height: `${550 / zoom}px`,
                }}
              />
            )
          ) : (
            <div className="preview-unavailable">
              <p>
                Preview unavailable. Check that the Preview add-on is active.
              </p>
              <button className="btn small" onClick={onDownload}>
                <Download size={15} /> Download file
              </button>
            </div>
          )}
        </div>

        <div className="panel" style={{ marginTop: 12, marginBottom: 0 }}>
          <h3 style={{ marginTop: 0 }}>Assigned tasks</h3>
          {fileTasks.map((t: any) => (
            <div
              key={t.id}
              style={{
                padding: "9px 0",
                borderBottom: "1px solid #edf0f4",
              }}
            >
              <b>{t.title}</b>
              <small className="table-sub">
                {t.assignee?.uniqueName || "Assignee"} ·{" "}
                {t.startPage || t.endPage
                  ? `Pages ${t.startPage || 1}–${t.endPage || "end"}`
                  : "All pages"}{" "}
                · {t.status}
              </small>
            </div>
          ))}
          {!fileTasks.length && (
            <p className="muted">No tasks assigned to this file.</p>
          )}
        </div>
      </div>
    </div>
  );
}

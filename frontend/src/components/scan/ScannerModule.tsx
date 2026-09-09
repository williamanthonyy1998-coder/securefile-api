import { useEffect, useState } from "react";
import { api, directUpload } from "../../lib/api";
import { jpegPagesToPdfBlob } from "../../utils/jpegPdf";
import {
  Trash2,
  RefreshCw,
  ScanLine,
  Wifi,
  WifiOff,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import MobileCameraScanner from "./MobileCameraScanner";
import BluetoothScanner from "./BluetoothScanner";
import type { ScanPage } from "./types";

const SCANNER_BRIDGE = (
  import.meta.env.VITE_SCANNER_BRIDGE_URL || "http://127.0.0.1:8765"
).replace(/\/$/, "");

export default function ScannerModule({ setErr }: any) {
  const [bridgeOk, setBridgeOk] = useState<boolean | null>(null);
  const [pages, setPages] = useState<ScanPage[]>([]);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [source, setSource] = useState<"ADF" | "FLATBED">("ADF");
  const [batchPages, setBatchPages] = useState(25);
  const [resolution, setResolution] = useState(300);
  const [colorMode, setColorMode] = useState("COLOR");
  const [duplex, setDuplex] = useState(false);
  const [folderId, setFolderId] = useState("");
  const [folders, setFolders] = useState<any[]>([]);
  const [pdfName, setPdfName] = useState("Scanned Document.pdf");
  const [bridgeMessage, setBridgeMessage] = useState(
    "Checking scanner bridge...",
  );
  const [devices, setDevices] = useState<any[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<any>(null);
  const [driver, setDriver] = useState<"AUTO" | "WIA" | "TWAIN" | "ESCL">(
    "AUTO",
  );
  const [loadingDevices, setLoadingDevices] = useState(false);
  async function checkBridge() {
    try {
      const r = await fetch(`${SCANNER_BRIDGE}/health`, {
        signal: AbortSignal.timeout(2500),
      });
      if (!r.ok) throw new Error();
      const h: any = await r.json().catch(() => ({}));
      setBridgeOk(true);
      setBridgeMessage(
        h.naps2Installed
          ? "Universal scanner bridge connected"
          : "WIA scanner bridge connected",
      );
    } catch {
      setBridgeOk(false);
      setBridgeMessage(
        "Scanner bridge not connected. Start scanner-bridge on this Windows PC.",
      );
    }
  }
  async function refreshDevices() {
    setLoadingDevices(true);
    try {
      const r = await fetch(`${SCANNER_BRIDGE}/devices`, {
        signal: AbortSignal.timeout(30000),
      });
      const d: any = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || "Unable to list scanners.");
      const list = Array.isArray(d.devices) ? d.devices : [];
      setDevices(list);
      if (list.length && !selectedDevice) setSelectedDevice(list[0]);
      if (!list.length) setSelectedDevice(null);
      setBridgeOk(true);
      setBridgeMessage(
        list.length
          ? `${list.length} scanner device${list.length === 1 ? "" : "s"} available.`
          : "Bridge connected, but no scanner was detected.",
      );
    } catch (e: any) {
      setErr(e.message || "Unable to list scanner devices.");
      setBridgeOk(false);
      setBridgeMessage("Scanner device discovery failed.");
    } finally {
      setLoadingDevices(false);
    }
  }
  useEffect(() => {
    checkBridge();
    refreshDevices();
    api("/folders")
      .then((x: any) => setFolders(Array.isArray(x) ? x : []))
      .catch(() => {});
  }, []);
  async function scan() {
    try {
      setErr("");
      setBusy(true);
      const health = await fetch(`${SCANNER_BRIDGE}/health`, {
        signal: AbortSignal.timeout(2500),
      });
      if (!health.ok)
        throw new Error(
          "Scanner bridge is not connected. Start the SecureFile Scanner Bridge on this Windows workstation.",
        );
      if (!selectedDevice)
        throw new Error(
          "Select a scanner device first. Click Refresh scanners if the device is not listed.",
        );
      const effectiveDriver = driver === "AUTO" ? "auto" : driver.toLowerCase();
      const deviceValue = String(
        selectedDevice.id || selectedDevice.name || "",
      );
      const deviceName = String(selectedDevice.name || "");
      const r = await fetch(`${SCANNER_BRIDGE}/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driver: effectiveDriver,
          device: deviceValue,
          deviceName,
          source,
          pages:
            source === "FLATBED" ? 1 : Math.max(1, Math.min(100, batchPages)),
          resolutionDpi: resolution,
          colorMode,
          duplex: source === "ADF" && duplex,
        }),
      });
      const d: any = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || "Scanner failed.");
      const incoming = (d.pages || []).map((x: any) => ({
        id: crypto.randomUUID(),
        name: x.name,
        mimeType: x.mimeType || "image/jpeg",
        data: x.data,
      })) as ScanPage[];
      if (!incoming.length) throw new Error("The scanner returned no pages.");
      setPages((prev) => [...prev, ...incoming]);
      setBridgeOk(true);
      setBridgeMessage(
        `${incoming.length} page${incoming.length === 1 ? "" : "s"} scanned successfully via ${String(d.driver || effectiveDriver).toUpperCase()}.`,
      );
    } catch (e: any) {
      setErr(e.message || "Scanner failed.");
      setBridgeMessage(
        "Scanner error. Check the selected device, driver, paper, and bridge.",
      );
    } finally {
      setBusy(false);
    }
  }
  function addCameraPage(page: ScanPage) {
    setPages((prev) => [...prev, page]);
    setErr("");
  }
  function removePage(id: string) {
    setPages((prev) => prev.filter((p) => p.id !== id));
  }
  function movePage(index: number, direction: -1 | 1) {
    setPages((prev) => {
      const next = [...prev],
        to = index + direction;
      if (to < 0 || to >= next.length) return prev;
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });
  }
  function clearPages() {
    if (confirm("Remove all scanned pages from this draft?")) setPages([]);
  }
  async function savePdf() {
    if (!pages.length) return;
    try {
      setSaving(true);
      setErr("");
      const name =
        (pdfName.trim() || "Scanned Document").replace(/\.pdf$/i, "") + ".pdf";
      const pdfBlob = jpegPagesToPdfBlob(pages);
      const pdfFile = new File([pdfBlob], name, { type: "application/pdf" });
      await directUpload(pdfFile, {
        folderId: folderId || undefined,
        source: "SCAN",
        name,
      });
      setPages([]);
      setPdfName("Scanned Document.pdf");
      setErr("");
      setBridgeMessage(`Saved ${name} to SecureFile.`);
    } catch (e: any) {
      setErr(e.message || "Unable to create or save PDF.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="scanner-workspace">
      <div className="panel desktop-scanner-panel">
        <div className="scanner-status-row">
          <div>
            <h2 style={{ marginBottom: 4 }}>Physical Scanner</h2>
            <p className="muted">
              The browser connects to the SecureFile Scanner Bridge running on
              the same Windows PC as the scanner.
            </p>
          </div>
          <span
            className={`scanner-status ${bridgeOk === true ? "ok" : bridgeOk === false ? "bad" : ""}`}
          >
            {bridgeOk === true ? <Wifi size={14} /> : <WifiOff size={14} />}{" "}
            {bridgeMessage}
          </span>
        </div>
        <div className="scanner-controls grid2">
          <label>
            Scanner / device
            <select
              value={
                selectedDevice
                  ? JSON.stringify({
                      id: selectedDevice.id,
                      name: selectedDevice.name,
                      driver: selectedDevice.driver,
                    })
                  : ""
              }
              onChange={(e) => {
                try {
                  const v = JSON.parse(e.target.value);
                  setSelectedDevice(
                    devices.find(
                      (d: any) =>
                        d.id === v.id &&
                        d.name === v.name &&
                        d.driver === v.driver,
                    ) || null,
                  );
                } catch {
                  setSelectedDevice(null);
                }
              }}
            >
              <option value="">Select scanner device</option>
              {devices.map((d: any, i: number) => (
                <option
                  key={`${d.driver}-${d.id}-${i}`}
                  value={JSON.stringify({
                    id: d.id,
                    name: d.name,
                    driver: d.driver,
                  })}
                >
                  {d.name}
                  {d.manufacturer ? ` — ${d.manufacturer}` : ""} (
                  {String(d.driver || "WIA").toUpperCase()})
                </option>
              ))}
            </select>
          </label>
          <label>
            Driver
            <select
              value={driver}
              onChange={(e) => setDriver(e.target.value as any)}
            >
              <option value="AUTO">Auto (recommended)</option>
              <option value="WIA">WIA</option>
              <option value="TWAIN">TWAIN</option>
              <option value="ESCL">eSCL / Network</option>
            </select>
            <small className="muted">
              TWAIN/eSCL use NAPS2. WIA has a direct Windows fallback.
            </small>
          </label>
          <label>
            Scanner source
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as any)}
            >
              <option value="ADF">ADF / Document Feeder</option>
              <option value="FLATBED">Flatbed</option>
            </select>
          </label>
          <label>
            Pages per scan batch
            <input
              type="number"
              min="1"
              max="100"
              value={batchPages}
              disabled={source === "FLATBED"}
              onChange={(e) =>
                setBatchPages(Math.max(1, Math.min(100, +e.target.value || 1)))
              }
            />
            <small className="muted">
              ADF scans up to 100 pages per batch. Use Scan More for any total
              page count.
            </small>
          </label>
          <label>
            Resolution
            <select
              value={resolution}
              onChange={(e) => setResolution(+e.target.value)}
            >
              <option value="150">150 DPI</option>
              <option value="200">200 DPI</option>
              <option value="300">300 DPI</option>
              <option value="600">600 DPI</option>
            </select>
          </label>
          <label>
            Color mode
            <select
              value={colorMode}
              onChange={(e) => setColorMode(e.target.value)}
            >
              <option value="COLOR">Color</option>
              <option value="GRAY">Grayscale</option>
              <option value="BW">Black & White</option>
            </select>
          </label>
        </div>
        {source === "ADF" && (
          <label className="checkline scanner-duplex">
            <input
              type="checkbox"
              checked={duplex}
              onChange={(e) => setDuplex(e.target.checked)}
            />{" "}
            Scan both sides (duplex) when the scanner driver supports it
          </label>
        )}
        <div className="toolbar scanner-actions">
          <button
            className="btn secondary"
            disabled={busy || loadingDevices}
            onClick={refreshDevices}
          >
            <RefreshCw size={15} />
            {loadingDevices ? "Finding scanners..." : "Refresh scanners"}
          </button>
          <button
            className="btn"
            disabled={busy || saving || !selectedDevice}
            onClick={scan}
          >
            <ScanLine size={16} />
            {busy
              ? "Scanning..."
              : pages.length
                ? "Scan More Pages"
                : "Start Scan"}
          </button>
          <button
            className="btn secondary"
            disabled={busy}
            onClick={checkBridge}
          >
            Check connection
          </button>
          <span className="muted">
            {pages.length} page{pages.length === 1 ? "" : "s"} in current PDF
          </span>
        </div>
      </div>

      <div className="mobile-scanner-panel">
        <div className="mobile-scanner-title">
          <div>
            <p className="eyebrow">Mobile scanning</p>
            <h2>Scan from your phone</h2>
            <p className="muted">
              Choose your phone camera or connect a compatible BLE scanner. Both
              methods add pages to the same PDF draft.
            </p>
          </div>
          <ScanLine size={24} />
        </div>
        <MobileCameraScanner
          busy={busy || saving}
          onPage={addCameraPage}
          onError={setErr}
        />
        <BluetoothScanner
          busy={busy || saving}
          onPage={addCameraPage}
          onError={setErr}
        />
      </div>

      <div className="panel">
        <div className="scanner-preview-head">
          <div>
            <h2>Scanned Pages</h2>
            <p className="muted">
              Review, remove, or reorder pages before creating the final PDF.
            </p>
          </div>
          {pages.length > 0 && (
            <button className="btn secondary" onClick={clearPages}>
              Clear all
            </button>
          )}
        </div>
        {!pages.length ? (
          <div className="scanner-empty">
            <ScanLine size={34} />
            <b>No scanned pages yet</b>
            <span>Use the Windows scanner above or scan from your phone.</span>
          </div>
        ) : (
          <div className="scan-pages-grid">
            {pages.map((p, i) => (
              <div className="scan-page-card" key={p.id}>
                <div className="scan-page-image">
                  <img
                    src={`data:${p.mimeType};base64,${p.data}`}
                    alt={`Scanned page ${i + 1}`}
                  />
                  <span>Page {i + 1}</span>
                </div>
                <div className="scan-page-actions">
                  <button
                    className="icon-btn"
                    title="Move left"
                    disabled={i === 0}
                    onClick={() => movePage(i, -1)}
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    className="icon-btn"
                    title="Move right"
                    disabled={i === pages.length - 1}
                    onClick={() => movePage(i, 1)}
                  >
                    <ChevronRight size={14} />
                  </button>
                  <button
                    className="icon-btn danger"
                    title="Remove page"
                    onClick={() => removePage(p.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="panel scanner-save-panel">
        <div>
          <h2>Save as one PDF</h2>
          <p className="muted">
            Other company users cannot see the saved file unless you share it or
            grant permission. Company Admins retain administrative access.
          </p>
        </div>
        <div className="grid2">
          <label>
            PDF file name
            <input
              value={pdfName}
              onChange={(e) => setPdfName(e.target.value)}
              placeholder="e.g. Patient Records August 21.pdf"
            />
          </label>
          <label>
            Save in folder
            <select
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
            >
              <option value="">My visible root</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                  {f.isPersonal ? " (Personal)" : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="toolbar">
          <button
            className="btn"
            disabled={!pages.length || saving}
            onClick={savePdf}
          >
            {saving ? "Creating PDF..." : "Create PDF & Save"}
          </button>
          <span className="muted">
            {pages.length
              ? `${pages.length} pages will be combined into ${(pdfName.trim() || "Scanned Document").replace(/\.pdf$/i, "") + ".pdf"}`
              : "Scan pages first."}
          </span>
        </div>
      </div>
    </div>
  );
}

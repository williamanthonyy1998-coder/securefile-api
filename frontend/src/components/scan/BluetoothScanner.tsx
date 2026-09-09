import { useEffect, useRef, useState } from "react";
import { Bluetooth, Link2Off } from "lucide-react";

export default function BluetoothScanner({ onPage, onError, busy }: any) {
  const [device, setDevice] = useState<any>(null);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState("Not connected");
  const [supported, setSupported] = useState(true);
  const bufferRef = useRef<Uint8Array>(new Uint8Array());
  const listenersRef = useRef<any[]>([]);
  useEffect(() => {
    setSupported(Boolean((navigator as any).bluetooth));
    return () => {
      void disconnect();
    };
  }, []);
  function appendBytes(incoming: Uint8Array) {
    let buf = new Uint8Array(bufferRef.current.length + incoming.length);
    buf.set(bufferRef.current);
    buf.set(incoming, bufferRef.current.length);
    bufferRef.current = buf;
    while (true) {
      let start = -1,
        end = -1;
      for (let i = 0; i < buf.length - 1; i++) {
        if (buf[i] === 0xff && buf[i + 1] === 0xd8) {
          start = i;
          break;
        }
      }
      if (start < 0) {
        if (buf.length > 1024 * 1024 * 8) bufferRef.current = buf.slice(-1024);
        return;
      }
      for (let i = start + 2; i < buf.length - 1; i++) {
        if (buf[i] === 0xff && buf[i + 1] === 0xd9) {
          end = i + 2;
          break;
        }
      }
      if (end < 0) {
        bufferRef.current = buf.slice(start);
        return;
      }
      const jpeg = buf.slice(start, end);
      buf = buf.slice(end);
      bufferRef.current = buf;
      let binary = "";
      const chunk = 0x8000;
      for (let i = 0; i < jpeg.length; i += chunk)
        binary += String.fromCharCode(...jpeg.subarray(i, i + chunk));
      onPage({
        id: crypto.randomUUID(),
        name: `bluetooth-scan-${Date.now()}.jpg`,
        mimeType: "image/jpeg",
        data: btoa(binary),
      });
    }
  }
  async function discover(server: any) {
    const services = await server.getPrimaryServices();
    let count = 0;
    for (const service of services) {
      const chars = await service.getCharacteristics();
      for (const ch of chars) {
        if (ch.properties.notify || ch.properties.indicate) {
          await ch.startNotifications();
          const handler = (ev: any) => {
            const v = ev.target?.value;
            if (v)
              appendBytes(new Uint8Array(v.buffer, v.byteOffset, v.byteLength));
          };
          ch.addEventListener("characteristicvaluechanged", handler);
          listenersRef.current.push({ ch, handler });
          count++;
        } else if (ch.properties.read) {
          try {
            const v = await ch.readValue();
            if (v?.byteLength)
              appendBytes(new Uint8Array(v.buffer, v.byteOffset, v.byteLength));
          } catch {
            /* proprietary/read-on-demand characteristic */
          }
        }
      }
    }
    return count;
  }
  async function connect() {
    try {
      if (!supported)
        throw new Error(
          "Bluetooth is not available in this mobile browser. Use Chrome/Edge on Android with a BLE scanner, or use the phone camera scanner.",
        );
      setStatus("Choose your Bluetooth scanner…");
      const d = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
      });
      setDevice(d);
      d.addEventListener?.("gattserverdisconnected", () => {
        setConnected(false);
        setStatus("Scanner disconnected");
      });
      setStatus("Connecting…");
      const server = await d.gatt.connect();
      const count = await discover(server);
      setConnected(true);
      setStatus(
        count
          ? `Connected • listening on ${count} scan channel${count === 1 ? "" : "s"}`
          : "Connected • scanner protocol not exposed by this device",
      );
      if (!count)
        onError(
          "Bluetooth scanner connected, but it does not expose scan data through a browser-readable BLE characteristic. Many scanners use proprietary Bluetooth profiles; use the phone camera scanner or the vendor/WIA bridge for those devices.",
        );
    } catch (e: any) {
      setConnected(false);
      setStatus("Not connected");
      if (e?.name !== "NotFoundError")
        onError(e?.message || "Unable to connect to the Bluetooth scanner.");
    }
  }
  async function disconnect() {
    for (const { ch, handler } of listenersRef.current) {
      try {
        ch.removeEventListener("characteristicvaluechanged", handler);
        await ch.stopNotifications();
      } catch {}
    }
    listenersRef.current = [];
    try {
      if (device?.gatt?.connected) device.gatt.disconnect();
    } catch {}
    setConnected(false);
    setDevice(null);
    setStatus("Not connected");
    bufferRef.current = new Uint8Array();
  }
  return (
    <div className="mobile-bluetooth-card">
      <div className="mobile-scan-heading">
        <div>
          <h3>Bluetooth scanner</h3>
          <p className="muted">
            Connect a BLE scanner from the phone browser when the scanner
            exposes its scan data over Web Bluetooth.
          </p>
        </div>
        <Bluetooth size={20} />
      </div>
      <div className={`bluetooth-status ${connected ? "connected" : ""}`}>
        <span className="status-dot" />
        {status}
      </div>
      {!supported && (
        <div className="camera-error">
          Web Bluetooth is not available here. Camera scanning remains
          available.
        </div>
      )}
      <div className="camera-toolbar">
        <button
          className="btn"
          disabled={busy || connected || !supported}
          onClick={connect}
        >
          <Bluetooth size={16} /> Connect Bluetooth Scanner
        </button>
        {connected && (
          <button className="btn secondary" onClick={disconnect}>
            <Link2Off size={16} /> Disconnect
          </button>
        )}
      </div>
      <p className="camera-hint">
        Note: standard Bluetooth document scanners often use proprietary
        profiles. Chrome can only receive scan images when the device exposes a
        BLE GATT data characteristic.
      </p>
    </div>
  );
}

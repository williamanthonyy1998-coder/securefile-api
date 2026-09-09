import { useState } from "react";
import { RefreshCw } from "lucide-react";
import AiChatPanel from "../components/ai/AiChatPanel";

export default function AiChat() {
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [refresh, setRefresh] = useState(0);
  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Workspace</p>
          <h1>AI Chat Bot</h1>
          <p>Ask the configured SecureFile assistant.</p>
        </div>
        <button
          className="btn secondary"
          onClick={() => setRefresh((x) => x + 1)}
        >
          <RefreshCw size={15} /> Refresh
        </button>
      </div>
      {err && (
        <div className="error" style={{ marginBottom: 16 }}>
          {err}
        </div>
      )}
      {notice && (
        <div className="success" style={{ marginBottom: 16 }}>
          {notice}
        </div>
      )}
      <div key={refresh}>
        <AiChatPanel setErr={setErr} />
      </div>
    </>
  );
}

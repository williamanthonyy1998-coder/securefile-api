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
      <div key={refresh}>
        <AiChatPanel setErr={setErr} />
      </div>
    </>
  );
}

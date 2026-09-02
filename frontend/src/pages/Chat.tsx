import { useState } from "react";
import { RefreshCw } from "lucide-react";
import ChatWorkspace from "../components/chat/ChatWorkspace";

export default function Chat() {
  const [refresh, setRefresh] = useState(0);

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Workspace</p>
          <h1>Chat</h1>
          <p>Company-scoped secure messaging.</p>
        </div>
        <button
          className="btn secondary"
          onClick={() => setRefresh((x) => x + 1)}
        >
          <RefreshCw size={15} /> Refresh
        </button>
      </div>
      <ChatWorkspace key={refresh} />
    </>
  );
}

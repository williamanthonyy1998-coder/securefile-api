import { RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import ChatWorkspace from "../components/chat/ChatWorkspace";
import { chatKeys } from "../api/chat.api";

export default function Chat() {
  const queryClient = useQueryClient();

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
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: chatKeys.all });
            queryClient.invalidateQueries({ queryKey: ["users"] });
          }}
        >
          <RefreshCw size={15} /> Refresh
        </button>
      </div>
      <ChatWorkspace />
    </>
  );
}

import { useState } from "react";
import { api } from "../../lib/api";
import { Send } from "lucide-react";

export default function AiChatPanel({ setErr }: any) {
  const [q, setQ] = useState(""),
    [messages, setMessages] = useState<any[]>([]),
    [busy, setBusy] = useState(false),
    [webSearch, setWebSearch] = useState(true);
  async function ask() {
    const text = q.trim();
    if (!text || busy) return;
    const history = messages.map((x) => ({ role: x.role, content: x.content }));
    setMessages((m) => [...m, { role: "user", content: text }]);
    setQ("");
    setBusy(true);
    try {
      const d = await api("/workspace/ai", {
        method: "POST",
        body: JSON.stringify({
          message: text,
          history,
          webSearchEnabled: webSearch,
        }),
      });
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: d.answer,
          sources: d.sources || [],
          webSearched: Boolean(d.webSearched),
        },
      ]);
    } catch (e: any) {
      setErr(e.message);
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: "I could not complete that request. Please try again.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="ai-shell">
      <div className="panel ai-panel">
        <div className="ai-head">
          <div>
            <h2 style={{ marginBottom: 4 }}>SecureFile AI</h2>
            <p className="muted">
              Your private SecureFile assistant. It only uses resources
              available to your current login.
            </p>
          </div>
          <label className="ai-web-toggle">
            <input
              type="checkbox"
              checked={webSearch}
              onChange={(e) => setWebSearch(e.target.checked)}
            />
            <span>Web search when needed</span>
          </label>
        </div>
        <div className="ai-safety">
          🔒 Your SecureFile data stays scoped to your account. Other users'
          private files and workspace data are not included.
        </div>
        <div className="ai-messages">
          {!messages.length && (
            <div className="ai-empty">
              <Send size={24} />
              <h3>Ask SecureFile AI</h3>
              <p>
                Try: “What files do I have?”, “What tasks are due?”, “How do I
                send a fax?” or ask a general question.
              </p>
            </div>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`ai-message ${m.role === "user" ? "user" : "assistant"}`}
            >
              <div className="ai-bubble">{m.content}</div>
              {m.webSearched && m.sources?.length > 0 && (
                <div className="ai-sources">
                  <span>Web sources</span>
                  {m.sources.map((x: any, j: number) => (
                    <a key={j} href={x.url} target="_blank" rel="noreferrer">
                      {x.url}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
          {busy && (
            <div className="ai-message assistant">
              <div className="ai-bubble ai-typing">Thinking…</div>
            </div>
          )}
        </div>
        <div className="ai-composer">
          <textarea
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ask();
              }
            }}
            placeholder="Ask about your SecureFile workspace or anything else…"
            rows={2}
          />
          <button className="btn" disabled={!q.trim() || busy} onClick={ask}>
            <Send size={15} />
            {busy ? "Thinking…" : "Ask"}
          </button>
        </div>
      </div>
    </div>
  );
}

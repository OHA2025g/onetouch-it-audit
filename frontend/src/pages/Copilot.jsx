import React, { useEffect, useRef, useState } from "react";
import api from "@/api";
import { PageHeader, SectionHeader } from "@/components/Primitives";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Send, MessageSquare, Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

function MessageBubble({ role, content, sources }) {
  if (role === "user") {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[80%] bg-blue-700 dark:bg-blue-600 text-white px-4 py-2.5 rounded-sm text-sm">{content}</div>
      </div>
    );
  }
  return (
    <div className="flex gap-3 mb-4">
      <div className="w-8 h-8 bg-zinc-900 dark:bg-zinc-700 rounded-sm flex items-center justify-center flex-shrink-0">
        <Sparkles className="w-4 h-4 text-amber-400" />
      </div>
      <div className="flex-1 max-w-[80%]">
        <div className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm p-4 text-sm whitespace-pre-wrap leading-relaxed">{content}</div>
        {sources && sources.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Sources:</span>
            {sources.map((s, i) => <span key={i} className="text-[10px] px-1.5 py-0.5 bg-zinc-200 dark:bg-zinc-800 rounded-sm font-mono">{s}</span>)}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Copilot() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [convId, setConvId] = useState(null);
  const [suggested, setSuggested] = useState([]);
  const [conversations, setConversations] = useState([]);
  const scrollRef = useRef(null);

  useEffect(() => {
    api.get("/copilot/suggested-questions").then(r => setSuggested(r.data.questions || []));
    api.get("/copilot/conversations").then(r => setConversations(r.data || []));
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const send = async (q) => {
    const question = (q || input).trim();
    if (!question || busy) return;
    setInput("");
    setMessages(m => [...m, { role: "user", content: question }]);
    setBusy(true);
    try {
      const r = await api.post("/copilot/chat", { question, conversation_id: convId });
      setConvId(r.data.conversation_id);
      setMessages(m => [...m, { role: "assistant", content: r.data.answer, sources: r.data.sources }]);
      api.get("/copilot/conversations").then(r2 => setConversations(r2.data || []));
    } catch (e) {
      toast.error("Copilot error");
      setMessages(m => [...m, { role: "assistant", content: "Sorry, I encountered an error. Please retry.", sources: [] }]);
    } finally { setBusy(false); }
  };

  const newChat = () => { setMessages([]); setConvId(null); };
  const loadConv = (c) => { setConvId(c.conversation_id); setMessages(c.messages || []); };

  return (
    <div className="space-y-6 h-[calc(100vh-7rem)] flex flex-col" data-testid="copilot-page">
      <PageHeader eyebrow="ASK ANYTHING · CLAUDE SONNET 4.5" title="AI Audit Copilot" subtitle="Real-time access to your audit data. Plain-language answers."
        actions={<Button size="sm" variant="outline" className="rounded-sm" onClick={newChat} data-testid="new-chat-btn"><Plus className="w-3.5 h-3.5 mr-1" /> New Chat</Button>}
      />
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0">
        <div className="lg:col-span-3 space-y-4">
          <div className="crt-card p-4">
            <SectionHeader eyebrow="START WITH"><Sparkles className="w-3.5 h-3.5 inline-block mr-1" /> Suggestions</SectionHeader>
            <div className="space-y-1.5">
              {suggested.map((q, i) => (
                <button key={i} onClick={() => send(q)} className="w-full text-left p-2.5 text-xs border border-zinc-200 dark:border-zinc-800 rounded-sm hover:border-blue-400 dark:hover:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors" data-testid={`suggested-q-${i}`}>{q}</button>
              ))}
            </div>
          </div>
          <div className="crt-card p-4">
            <SectionHeader eyebrow="HISTORY"><MessageSquare className="w-3.5 h-3.5 inline-block mr-1" /> Recent</SectionHeader>
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {conversations.map(c => (
                <button key={c.conversation_id} onClick={() => loadConv(c)} className="w-full text-left p-2 text-xs border border-zinc-100 dark:border-zinc-800/60 rounded-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors truncate">{c.title}</button>
              ))}
              {conversations.length === 0 && <div className="text-xs text-zinc-400 py-4 text-center">No history yet</div>}
            </div>
          </div>
        </div>

        <div className="lg:col-span-9 crt-card flex flex-col min-h-0">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 min-h-0">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <div className="w-14 h-14 bg-blue-700 rounded-sm flex items-center justify-center mb-4"><ShieldCheck className="w-7 h-7 text-white" /></div>
                <h3 className="font-display font-black text-2xl tracking-tighter mb-2">Hello, CIO.</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-md">Ask me anything about your IT audit posture. I have real-time access to risks, controls, observations, vendors, and compliance data.</p>
              </div>
            )}
            {messages.map((m, i) => <MessageBubble key={i} {...m} />)}
            {busy && <MessageBubble role="assistant" content="Thinking…" />}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); send(); }} className="border-t border-zinc-200 dark:border-zinc-800 p-4 flex gap-2">
            <input value={input} onChange={e => setInput(e.target.value)} placeholder="Ask about risks, compliance, vendors, observations…" className="flex-1 h-10 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm text-sm outline-none focus:border-blue-500 dark:focus:border-blue-400" data-testid="copilot-input" />
            <Button type="submit" disabled={busy || !input.trim()} className="rounded-sm bg-blue-700 hover:bg-blue-800 h-10" data-testid="copilot-send-btn"><Send className="w-4 h-4" /></Button>
          </form>
        </div>
      </div>
    </div>
  );
}

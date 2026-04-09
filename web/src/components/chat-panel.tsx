"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import { sendChatMessage, type ChatResponse } from "../lib/chat-api";
import { ChatMessage } from "./chat-message";

interface Message {
  id: string;
  role: "user" | "agent";
  text: string;
  type?: ChatResponse["type"];
  data?: Record<string, unknown>;
}

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "agent",
  text: "Welcome to Sentinel. I can scan tokens, execute swaps, check your portfolio, and discover new opportunities.\n\nTry typing a command or use the quick actions below.",
  type: "text",
};

const QUICK_ACTIONS = [
  { label: "Scan Token", command: "/scan " },
  { label: "Swap", command: "/swap " },
  { label: "Portfolio", command: "/portfolio" },
  { label: "Discover", command: "/discover" },
];

let msgCounter = 0;
function nextId(): string {
  msgCounter += 1;
  return `msg-${msgCounter}-${Date.now()}`;
}

export function ChatPanel(): React.ReactNode {
  const { address } = useAccount();
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /* Auto-scroll to bottom when messages change */
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, loading]);

  const handleSend = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;

    const userMsg: Message = { id: nextId(), role: "user", text: msg };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const response = await sendChatMessage(msg, address);
      const agentMsg: Message = {
        id: nextId(),
        role: "agent",
        text: response.text,
        type: response.type,
        data: response.data,
      };
      setMessages((prev) => [...prev, agentMsg]);
    } catch {
      const errorMsg: Message = {
        id: nextId(),
        role: "agent",
        text: "Connection failed. Please check your network and try again.",
        type: "error",
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, loading, address]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleQuickAction = useCallback(
    (command: string) => {
      if (command.endsWith(" ")) {
        setInput(command);
        inputRef.current?.focus();
      } else {
        handleSend(command);
      }
    },
    [handleSend],
  );

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-6 lg:px-10 py-6 space-y-4">
        <div className="mx-auto max-w-[800px] space-y-4">
          {messages.map((m) => (
            <ChatMessage key={m.id} role={m.role} text={m.text} type={m.type} data={m.data} />
          ))}

          {/* Loading indicator */}
          {loading && (
            <div className="flex justify-start gap-2">
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#06b6d4]/20 flex items-center justify-center text-[10px] font-bold text-[#06b6d4] mt-0.5">
                S
              </div>
              <div className="px-3.5 py-2.5 rounded-2xl rounded-bl-md border bg-[#06b6d4]/[0.06] border-[#06b6d4]/10">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#06b6d4] animate-pulse" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#06b6d4] animate-pulse [animation-delay:0.2s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#06b6d4] animate-pulse [animation-delay:0.4s]" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick actions + Input */}
      <div className="border-t border-white/[0.06] px-4 md:px-6 lg:px-10 py-3">
        <div className="mx-auto max-w-[800px] space-y-3">
          {/* Quick actions */}
          <div className="flex flex-wrap gap-2">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.label}
                onClick={() => handleQuickAction(action.command)}
                disabled={loading}
                className="px-3 py-1.5 rounded-full text-[11px] font-medium bg-white/[0.04] border border-white/[0.06] text-[#a1a1aa] hover:text-[#fafafa] hover:bg-white/[0.08] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {action.label}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              placeholder="Type a command or ask Sentinel..."
              className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded-lg px-4 py-2.5 text-sm text-[#fafafa] placeholder:text-[#52525b] outline-none focus:border-[#06b6d4]/30 disabled:opacity-50 transition-colors"
            />
            <button
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              className="px-4 py-2.5 rounded-lg text-xs font-medium bg-[#06b6d4]/20 text-[#06b6d4] hover:bg-[#06b6d4]/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <span className="inline-block w-4 h-4 border-2 border-[#06b6d4]/30 border-t-[#06b6d4] rounded-full animate-spin" />
              ) : (
                "Send"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

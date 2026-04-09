"use client";

import type { ChatResponse } from "../lib/chat-api";

interface ChatMessageProps {
  role: "user" | "agent";
  text: string;
  type?: ChatResponse["type"];
  data?: Record<string, unknown>;
}

const VERDICT_COLORS: Record<string, string> = {
  SAFE: "#34d399",
  CAUTION: "#f59e0b",
  DANGEROUS: "#ef4444",
};

function VerdictBadge({ verdict }: { verdict: string }): React.ReactNode {
  const color = VERDICT_COLORS[verdict.toUpperCase()] ?? "#a1a1aa";
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
      style={{ color, border: `1px solid ${color}40`, backgroundColor: `${color}10` }}
    >
      {verdict}
    </span>
  );
}

function TxLink({ hash }: { hash: string }): React.ReactNode {
  const url = `https://www.okx.com/web3/explorer/xlayer/tx/${hash}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-[#06b6d4] hover:underline font-mono text-xs break-all"
    >
      {hash.slice(0, 10)}...{hash.slice(-8)}
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        <polyline points="15 3 21 3 21 9" />
        <line x1="10" y1="14" x2="21" y2="3" />
      </svg>
    </a>
  );
}

export function ChatMessage({ role, text, type, data }: ChatMessageProps): React.ReactNode {
  const isUser = role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] px-3.5 py-2.5 rounded-2xl rounded-br-md bg-white/[0.06] text-[#fafafa] text-sm leading-relaxed">
          {text}
        </div>
      </div>
    );
  }

  const isError = type === "error";
  const isHelp = type === "help";
  const isVerdict = type === "verdict";
  const isTransaction = type === "transaction";

  const bubbleClasses = [
    "max-w-[75%] px-3.5 py-2.5 rounded-2xl rounded-bl-md border text-sm leading-relaxed",
    isError
      ? "bg-[#ef4444]/[0.06] border-[#ef4444]/20 text-[#fafafa]"
      : "bg-[#06b6d4]/[0.06] border-[#06b6d4]/10 text-[#fafafa]",
  ].join(" ");

  return (
    <div className="flex justify-start gap-2">
      {/* Avatar */}
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#06b6d4]/20 flex items-center justify-center text-[10px] font-bold text-[#06b6d4] mt-0.5">
        S
      </div>

      <div className={bubbleClasses}>
        {isHelp ? (
          <pre className="whitespace-pre-wrap font-mono text-xs">{text}</pre>
        ) : (
          <p className="whitespace-pre-wrap">{text}</p>
        )}

        {isVerdict && data?.verdict != null ? (
          <div className="mt-2">
            <VerdictBadge verdict={String(data.verdict)} />
          </div>
        ) : null}

        {isTransaction && data?.txHash != null ? (
          <div className="mt-2">
            <TxLink hash={String(data.txHash)} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

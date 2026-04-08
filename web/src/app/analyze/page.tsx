"use client";

import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { scanToken, scanDapp, type Verdict, type DappScanResult } from "../../lib/api";
import { VerdictCard } from "../../components/verdict-card";
import { SecurityBreakdown } from "../../components/security-breakdown";
import { DappScanResultCard } from "../../components/dapp-scan-result";

type ScanKind = "token" | "domain" | null;

function detectKind(input: string): ScanKind {
  const v = input.trim();
  if (/^0x[a-fA-F0-9]{40,42}$/i.test(v)) return "token";
  if (v.includes(".")) return "domain";
  return null;
}

export default function AnalyzePage(): React.ReactNode {
  const [input, setInput] = useState("");

  const tokenMutation = useMutation({
    mutationFn: (addr: string) => scanToken(addr),
  });

  const dappMutation = useMutation({
    mutationFn: (domain: string) => scanDapp(domain),
  });

  const [lastDomain, setLastDomain] = useState("");

  const handleScan = useCallback(() => {
    const v = input.trim();
    if (!v) return;
    const kind = detectKind(v);
    if (kind === "token") {
      tokenMutation.mutate(v);
    } else if (kind === "domain") {
      setLastDomain(v);
      dappMutation.mutate(v);
    }
  }, [input, tokenMutation, dappMutation]);

  const handleRescan = useCallback(() => {
    const v = input.trim();
    if (detectKind(v) === "token") {
      tokenMutation.mutate(v);
    }
  }, [input, tokenMutation]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") handleScan();
    },
    [handleScan],
  );

  const kind = detectKind(input.trim());
  const isPending = tokenMutation.isPending || dappMutation.isPending;
  const verdict: Verdict | null = tokenMutation.data ?? null;
  const dappResult: DappScanResult | null = dappMutation.data ?? null;

  return (
    <div className="mx-auto max-w-[1400px] px-6 lg:px-10 py-8">
      {/* Scan Input */}
      <div className="mb-8">
        <div className="text-[10px] font-medium text-[#52525b] uppercase tracking-wider mb-2">
          Scan Token or Domain
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="0x... token address or example.com"
            className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded px-3 py-2 font-mono text-xs text-[#fafafa] placeholder:text-[#52525b] outline-none focus:border-white/[0.12] transition-colors"
          />
          <button
            onClick={handleScan}
            disabled={!kind || isPending}
            className="px-4 py-2 rounded text-xs font-medium bg-white/[0.06] text-[#fafafa] hover:bg-white/[0.1] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? "Scanning..." : "Scan"}
          </button>
        </div>
        {input.trim() && !kind && (
          <div className="mt-1.5 text-[11px] text-[#52525b] font-mono">
            Enter a valid token address (0x...) or domain name
          </div>
        )}
      </div>

      {/* Token Result */}
      {tokenMutation.isError && (
        <div className="mb-6 px-3 py-2 rounded border border-[#ef4444]/20 bg-[#ef4444]/[0.04] text-xs text-[#ef4444] font-mono">
          Scan failed. Check the address and try again.
        </div>
      )}

      {verdict && (
        <div className="space-y-6">
          <VerdictCard verdict={verdict} loading={tokenMutation.isPending} onRescan={handleRescan} />
          <SecurityBreakdown verdict={verdict} />
        </div>
      )}

      {/* Dapp Result */}
      {dappMutation.isError && (
        <div className="mb-6 px-3 py-2 rounded border border-[#ef4444]/20 bg-[#ef4444]/[0.04] text-xs text-[#ef4444] font-mono">
          Domain scan failed. Check the domain and try again.
        </div>
      )}

      {dappResult && <DappScanResultCard data={dappResult} domain={lastDomain} />}
    </div>
  );
}

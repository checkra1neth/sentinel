"use client";

import { useState } from "react";
import { Search, ArrowRight, Loader2 } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002";

interface ScanInputProps {
  onVerdictReceived: (v: Record<string, unknown>) => void;
}

export function ScanInput({ onVerdictReceived }: ScanInputProps): React.ReactNode {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleScan = async (): Promise<void> => {
    if (!address || loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/api/scan/${address}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Payment": JSON.stringify({
            signature: "0xsentinel",
            payer: "0x0000000000000000000000000000000000000000",
            serviceId: 2,
          }),
        },
      });
      if (!res.ok) throw new Error(`Scan failed: ${res.status}`);
      const data = (await res.json()) as { verdict?: Record<string, unknown> };
      onVerdictReceived(data.verdict ?? data);
      setAddress("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setLoading(false);
    }
  };

  const prefill = (addr: string): void => {
    setAddress(addr);
    setError("");
  };

  return (
    <div className="mb-8">
      <div
        className="flex items-center gap-2 rounded-lg border border-[#1a1d24] bg-[#0f1116] px-4 py-3
                    focus-within:border-[#6366f1]/50 focus-within:ring-1 focus-within:ring-[#6366f1]/20 transition-all"
      >
        <Search size={16} className="text-[#7a7f8a] shrink-0" />
        <input
          type="text"
          value={address}
          onChange={(e) => {
            setAddress(e.target.value);
            setError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleScan();
          }}
          placeholder="Enter token address to scan..."
          className="flex-1 bg-transparent text-[#e8eaed] font-mono text-sm placeholder:text-[#7a7f8a]/50
                     outline-none"
        />
        <button
          onClick={handleScan}
          disabled={!address || loading}
          className="shrink-0 flex items-center gap-2 rounded-md bg-[#6366f1] px-4 py-1.5 text-sm font-medium text-white
                     hover:bg-[#5558e6] hover:shadow-[0_0_12px_rgba(99,102,241,0.3)] disabled:opacity-40
                     disabled:cursor-not-allowed transition-all cursor-pointer"
        >
          {loading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <ArrowRight size={14} />
          )}
          {loading ? "Scanning..." : "Scan"}
        </button>
      </div>

      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

      {/* Sample tokens for quick scanning */}
      {!address && !loading && (
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-[#7a7f8a]/40 uppercase tracking-wider">
            Try:
          </span>
          {[
            { label: "DOGSHIT", addr: "0x70bf3e2b75d8832d7f790a87fffc1fa9d63dc5bb" },
            { label: "XDOG", addr: "0x0cc24c51bf89c00c5affbfcf5e856c25ecbdb48e" },
            { label: "USDT", addr: "0x1E4a5963aBFD975d8c9021ce480b42188849D41d" },
            { label: "WOKB", addr: "0xe538905cf8410324e03a5a23c1c177a474d59b2b" },
          ].map((sample) => (
            <button
              key={sample.addr}
              onClick={() => prefill(sample.addr)}
              className="rounded border border-[#1a1d24] bg-[#0f1116] px-2.5 py-1 text-[11px] text-[#7a7f8a]
                         hover:border-[#6366f1]/40 hover:text-[#e8eaed] transition-all cursor-pointer"
            >
              {sample.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

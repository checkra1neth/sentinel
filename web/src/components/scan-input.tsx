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
          "X-Caller": "0x8Ce01CF638681e12AFfD10e2feb1E7E3C50b7509",
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
        className="flex items-center gap-2 rounded-lg border border-[#27272a] bg-[#18181b] px-4 py-3
                    focus-within:border-[#8b5cf6]/50 focus-within:ring-1 focus-within:ring-[#8b5cf6]/20 transition-all"
      >
        <Search size={16} className="text-[#a1a1aa] shrink-0" />
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
          className="flex-1 bg-transparent text-[#fafafa] font-mono text-sm placeholder:text-[#a1a1aa]/50
                     outline-none"
        />
        <button
          onClick={handleScan}
          disabled={!address || loading}
          className="shrink-0 flex items-center gap-2 rounded-md bg-[#8b5cf6] px-4 py-1.5 text-sm font-medium text-white
                     hover:bg-[#7c3aed] hover:shadow-[0_6px_16px_-4px_rgba(0,0,0,0.5),_0_2px_4px_-1px_rgba(0,0,0,0.3)] disabled:opacity-40
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
          <span className="text-[11px] text-[#a1a1aa]/40 uppercase tracking-wider">
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
              className="rounded border border-[#27272a] bg-[#18181b] px-2.5 py-1 text-[11px] text-[#a1a1aa]
                         hover:border-[#8b5cf6]/40 hover:text-[#fafafa] transition-all cursor-pointer"
            >
              {sample.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

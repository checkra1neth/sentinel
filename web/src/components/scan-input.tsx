"use client";

import { useState } from "react";

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

  return (
    <div className="mb-6">
      <div className="flex gap-2">
        <input
          type="text"
          value={address}
          onChange={(e) => { setAddress(e.target.value); setError(""); }}
          onKeyDown={(e) => { if (e.key === "Enter") handleScan(); }}
          placeholder="Token address..."
          className="flex-1 bg-transparent border border-white/[0.06] rounded px-3 py-2 text-sm font-mono text-[#fafafa] placeholder:text-[#52525b] outline-none focus:border-[#06b6d4]/40 transition-colors"
        />
        <button
          onClick={handleScan}
          disabled={!address || loading}
          className="px-4 py-2 text-sm font-medium bg-[#06b6d4] text-[#09090b] rounded hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity cursor-pointer"
        >
          {loading ? "..." : "Scan"}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-[#ef4444]">{error}</p>}
    </div>
  );
}

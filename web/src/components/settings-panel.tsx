"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchSettings, updateSettings } from "../lib/api";

export function SettingsPanel(): React.ReactNode {
  const qc = useQueryClient();

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: fetchSettings,
  });

  const [scanInterval, setScanInterval] = useState("");
  const [riskThreshold, setRiskThreshold] = useState("");
  const [autoInvest, setAutoInvest] = useState(false);
  const [maxInvestment, setMaxInvestment] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!settings) return;
    const intervalMs = Number(settings.scanInterval ?? 0);
    setScanInterval(String(intervalMs > 0 ? Math.round(intervalMs / 60_000) : ""));
    setRiskThreshold(String(settings.riskThreshold ?? ""));
    setAutoInvest(Boolean(settings.autoInvest));
    setMaxInvestment(String(settings.maxInvestment ?? ""));
  }, [settings]);

  const save = useMutation({
    mutationFn: () =>
      updateSettings({
        scanInterval: Number(scanInterval) * 60_000,
        riskThreshold: Number(riskThreshold),
        autoInvest,
        maxInvestment: Number(maxInvestment),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2_000);
    },
  });

  return (
    <div className="mt-10">
      <h2 className="text-[10px] font-medium text-[#52525b] uppercase tracking-wider mb-4">
        Settings
      </h2>
      <div className="border border-white/[0.06] rounded px-5 py-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <label className="block">
            <span className="text-[10px] font-medium text-[#52525b] uppercase tracking-wider">
              Scan Interval (min)
            </span>
            <input
              type="number"
              min={1}
              value={scanInterval}
              onChange={(e) => setScanInterval(e.target.value)}
              className="mt-1 block w-full bg-white/[0.04] border border-white/[0.06] rounded px-3 py-2 text-xs font-mono text-[#fafafa] outline-none focus:border-white/[0.12]"
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-medium text-[#52525b] uppercase tracking-wider">
              Risk Threshold (0-100)
            </span>
            <input
              type="number"
              min={0}
              max={100}
              value={riskThreshold}
              onChange={(e) => setRiskThreshold(e.target.value)}
              className="mt-1 block w-full bg-white/[0.04] border border-white/[0.06] rounded px-3 py-2 text-xs font-mono text-[#fafafa] outline-none focus:border-white/[0.12]"
            />
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoInvest}
              onChange={(e) => setAutoInvest(e.target.checked)}
              className="accent-[#34d399]"
            />
            <span className="text-[10px] font-medium text-[#52525b] uppercase tracking-wider">
              Auto-Invest
            </span>
          </label>
          <label className="block">
            <span className="text-[10px] font-medium text-[#52525b] uppercase tracking-wider">
              Max Investment ($)
            </span>
            <input
              type="number"
              min={0}
              value={maxInvestment}
              onChange={(e) => setMaxInvestment(e.target.value)}
              className="mt-1 block w-full bg-white/[0.04] border border-white/[0.06] rounded px-3 py-2 text-xs font-mono text-[#fafafa] outline-none focus:border-white/[0.12]"
            />
          </label>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="border border-white/[0.06] rounded px-4 py-2 text-xs font-mono text-[#fafafa] hover:bg-white/[0.04] transition-colors disabled:opacity-40"
          >
            Save
          </button>
          {saved && (
            <span className="text-xs font-mono text-[#34d399]">Saved</span>
          )}
        </div>
      </div>
    </div>
  );
}

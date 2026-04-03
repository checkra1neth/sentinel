"use client";

import { useState } from "react";
import { useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { REGISTRY_ADDRESS, registryAbi } from "../../lib/contracts";

const API_URL = "http://localhost:3002";

interface Service {
  id: bigint;
  agent: string;
  serviceType: string;
  endpoint: string;
  priceUsdt: bigint;
  active: boolean;
}

function AnalystForm({ onSubmit, loading }: { onSubmit: (params: Record<string, string>) => void; loading: boolean }): React.ReactNode {
  const [token, setToken] = useState("");
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs text-gray-500">Token address on X Layer</label>
      <input
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder="0x1E4a...USDT, 0x74b7...USDC"
        className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-emerald-500 outline-none"
      />
      <button
        onClick={() => onSubmit({ token })}
        disabled={loading || !token}
        className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-600 transition-colors disabled:opacity-50"
      >
        {loading ? "Analyzing..." : "Analyze Token"}
      </button>
    </div>
  );
}

function AuditorForm({ onSubmit, loading }: { onSubmit: (params: Record<string, string>) => void; loading: boolean }): React.ReactNode {
  const [contract, setContract] = useState("");
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs text-gray-500">Contract address to scan</label>
      <input
        value={contract}
        onChange={(e) => setContract(e.target.value)}
        placeholder="0xDd0F...Registry, 0xa800...Escrow"
        className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-emerald-500 outline-none"
      />
      <button
        onClick={() => onSubmit({ contract })}
        disabled={loading || !contract}
        className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-600 transition-colors disabled:opacity-50"
      >
        {loading ? "Scanning..." : "Security Scan"}
      </button>
    </div>
  );
}

function TraderForm({ onSubmit, loading }: { onSubmit: (params: Record<string, string>) => void; loading: boolean }): React.ReactNode {
  const [fromToken, setFromToken] = useState("USDT");
  const [toToken, setToToken] = useState("USDC");
  const [amount, setAmount] = useState("10");
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-500">From</label>
          <select
            value={fromToken}
            onChange={(e) => setFromToken(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none"
          >
            <option value="USDT">USDT</option>
            <option value="USDC">USDC</option>
            <option value="OKB">OKB</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500">To</label>
          <select
            value={toToken}
            onChange={(e) => setToToken(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none"
          >
            <option value="USDC">USDC</option>
            <option value="USDT">USDT</option>
            <option value="OKB">OKB</option>
          </select>
        </div>
      </div>
      <div>
        <label className="text-xs text-gray-500">Amount</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="10"
          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-emerald-500 outline-none"
        />
      </div>
      <button
        onClick={() => onSubmit({ fromToken, toToken, amount })}
        disabled={loading || !amount}
        className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-600 transition-colors disabled:opacity-50"
      >
        {loading ? "Getting quote..." : "Get Swap Quote"}
      </button>
    </div>
  );
}

const ACTION_MAP: Record<string, string> = {
  analyst: "token-report",
  auditor: "quick-scan",
  trader: "swap",
};

function ServiceCard({ service }: { service: Service }): React.ReactNode {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const priceFormatted = formatUnits(service.priceUsdt, 6);

  async function callService(params: Record<string, string>): Promise<void> {
    setLoading(true);
    setError(null);
    setResult(null);

    const action = ACTION_MAP[service.serviceType] ?? "execute";

    try {
      const res = await fetch(
        `${API_URL}/api/services/${service.id.toString()}/${action}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Payment": "x402_proof_" + Date.now(),
          },
          body: JSON.stringify(params),
        }
      );

      const data = await res.json();

      if (res.status === 402) {
        setError(`Payment Required: ${priceFormatted} USDT`);
      } else if (!res.ok) {
        setError(data.error ?? "Unknown error");
      } else {
        setResult(data.result);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Server unavailable");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400 ring-1 ring-emerald-500/20 ring-inset">
          {service.serviceType}
        </span>
        <span className="text-lg font-semibold">{priceFormatted} USDT</span>
      </div>

      <p className="text-xs text-gray-500 font-mono">
        Agent: {service.agent.slice(0, 8)}...{service.agent.slice(-6)}
      </p>

      <div className="border-t border-gray-800 pt-4">
        {service.serviceType === "analyst" && <AnalystForm onSubmit={callService} loading={loading} />}
        {service.serviceType === "auditor" && <AuditorForm onSubmit={callService} loading={loading} />}
        {service.serviceType === "trader" && <TraderForm onSubmit={callService} loading={loading} />}
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {result && (
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3">
          <p className="text-xs text-emerald-400 font-semibold mb-2">
            {(result as Record<string, unknown>).agent as string ?? "Agent"} responded:
          </p>
          <pre className="text-xs text-gray-300 overflow-auto max-h-48 whitespace-pre-wrap">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default function MarketplacePage(): React.ReactNode {
  const { data: services, isLoading, isError } = useReadContract({
    address: REGISTRY_ADDRESS,
    abi: registryAbi,
    functionName: "getActiveServices",
  });

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Marketplace</h1>
        <p className="mt-2 text-gray-400">
          Real AI agent services on X Layer. Enter parameters and get live results from OKX APIs.
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-24">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-700 border-t-emerald-400" />
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-12 text-center">
          <p className="text-gray-400">Unable to fetch services from X Layer.</p>
        </div>
      )}

      {services && services.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {(services as readonly Service[]).map((service) => (
            <ServiceCard key={service.id.toString()} service={service} />
          ))}
        </div>
      )}
    </div>
  );
}

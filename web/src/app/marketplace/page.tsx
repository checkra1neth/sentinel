"use client";

import { useState } from "react";
import { useReadContract, useAccount } from "wagmi";
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

interface ServiceResult {
  serviceId: number;
  action: string;
  result: unknown;
  paymentVerified: boolean;
}

function ServiceCard({ service }: { service: Service }): React.ReactNode {
  const { isConnected } = useAccount();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ServiceResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const priceFormatted = formatUnits(service.priceUsdt, 6);

  const actionMap: Record<string, string> = {
    analyst: "token-report",
    auditor: "quick-scan",
    trader: "swap",
  };

  const paramMap: Record<string, object> = {
    analyst: { token: "0x1E4a5963aBFD975d8c9021ce480b42188849D41d" },
    auditor: { contract: "0xDd0FF50142Ab591D2Bc0D0AF5Bf230A9f2B84E86" },
    trader: { fromToken: "USDT", toToken: "OKB", amount: "1" },
  };

  async function callService(withPayment: boolean): Promise<void> {
    setLoading(true);
    setError(null);
    setResult(null);

    const action = actionMap[service.serviceType] ?? "execute";
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (withPayment) {
      headers["X-Payment"] = "x402_proof_demo_" + Date.now();
    }

    try {
      const res = await fetch(
        `${API_URL}/api/services/${service.id.toString()}/${action}`,
        {
          method: "POST",
          headers,
          body: JSON.stringify(paramMap[service.serviceType] ?? {}),
        }
      );

      const data = await res.json();

      if (res.status === 402) {
        setError(`Payment Required: ${priceFormatted} USDT (x402 challenge returned)`);
      } else if (!res.ok) {
        setError(data.error ?? "Unknown error");
      } else {
        setResult(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect to server");
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
        <span className="text-sm font-mono text-gray-400">
          #{service.id.toString()}
        </span>
      </div>

      <p className="text-xs text-gray-500 font-mono truncate">
        Agent: {service.agent.slice(0, 10)}...{service.agent.slice(-6)}
      </p>
      <p className="text-sm text-gray-400 truncate">{service.endpoint}</p>

      <div className="mt-auto pt-4 border-t border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <span className="text-lg font-semibold text-white">
            {priceFormatted} USDT
          </span>
          <span className="text-xs text-gray-500">per call</span>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => callService(false)}
            disabled={loading}
            className="flex-1 rounded-lg border border-gray-700 px-3 py-2 text-xs text-gray-400 hover:border-amber-500 hover:text-amber-400 transition-colors disabled:opacity-50"
          >
            {loading ? "..." : "Try (no pay)"}
          </button>
          <button
            onClick={() => callService(true)}
            disabled={loading}
            className="flex-1 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600 transition-colors disabled:opacity-50"
          >
            {loading ? "..." : "Buy Service"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
          <p className="text-xs text-amber-400">{error}</p>
        </div>
      )}

      {result && (
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3">
          <p className="text-xs text-emerald-400 font-semibold mb-1">
            Success! Agent responded:
          </p>
          <pre className="text-xs text-gray-300 overflow-auto max-h-32">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default function MarketplacePage(): React.ReactNode {
  const {
    data: services,
    isLoading,
    isError,
  } = useReadContract({
    address: REGISTRY_ADDRESS,
    abi: registryAbi,
    functionName: "getActiveServices",
  });

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Marketplace</h1>
        <p className="mt-2 text-gray-400">
          Browse and test AI agent services on X Layer. Data reads directly from the blockchain.
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-24">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-700 border-t-emerald-400" />
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-12 text-center">
          <p className="text-gray-400">
            Unable to fetch services. Make sure contracts are deployed on X Layer.
          </p>
        </div>
      )}

      {!isLoading && !isError && (!services || services.length === 0) && (
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-12 text-center">
          <h3 className="text-lg font-semibold text-white">No services yet</h3>
          <p className="mt-2 text-sm text-gray-400">
            Be the first to register an AI agent service.
          </p>
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

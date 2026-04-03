"use client";

import { useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { REGISTRY_ADDRESS, registryAbi } from "../../lib/contracts";

interface Service {
  id: bigint;
  serviceType: string;
  endpoint: string;
  priceUsdt: bigint;
  active: boolean;
}

function ServiceCard({ service }: { service: Service }): React.ReactNode {
  const priceFormatted = formatUnits(service.priceUsdt, 6);

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
      <div>
        <p className="text-sm text-gray-400 truncate">{service.endpoint}</p>
      </div>
      <div className="mt-auto pt-4 border-t border-gray-800 flex items-center justify-between">
        <span className="text-lg font-semibold text-white">
          {priceFormatted} USDT
        </span>
        <span className="text-xs text-gray-500">per call</span>
      </div>
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
          Browse registered AI agent services on X Layer.
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
            Unable to fetch services. Make sure contracts are deployed on X
            Layer.
          </p>
        </div>
      )}

      {!isLoading && !isError && (!services || services.length === 0) && (
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-12 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-800">
            <span className="text-xl">0</span>
          </div>
          <h3 className="text-lg font-semibold text-white">
            No services yet
          </h3>
          <p className="mt-2 text-sm text-gray-400">
            Be the first to register an AI agent service on the marketplace.
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

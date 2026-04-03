"use client";

import { useAccount, useReadContract } from "wagmi";
import { formatUnits } from "viem";
import {
  USDT_ADDRESS,
  TREASURY_ADDRESS,
  erc20Abi,
  treasuryAbi,
} from "../../lib/contracts";

function StatCard({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string;
  suffix?: string;
}): React.ReactNode {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
      <p className="text-sm text-gray-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-white">
        {value}
        {suffix && (
          <span className="ml-1 text-sm font-normal text-gray-500">
            {suffix}
          </span>
        )}
      </p>
    </div>
  );
}

function ConnectedDashboard({
  address,
}: {
  address: `0x${string}`;
}): React.ReactNode {
  const { data: balance } = useReadContract({
    address: USDT_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address],
  });

  const { data: pendingYield } = useReadContract({
    address: TREASURY_ADDRESS,
    abi: treasuryAbi,
    functionName: "getAgentYield",
    args: [address],
  });

  const { data: totalCollected } = useReadContract({
    address: TREASURY_ADDRESS,
    abi: treasuryAbi,
    functionName: "totalCollected",
  });

  const balanceFormatted =
    balance !== undefined ? formatUnits(balance, 6) : "—";
  const yieldFormatted =
    pendingYield !== undefined ? formatUnits(pendingYield, 6) : "—";
  const totalFormatted =
    totalCollected !== undefined ? formatUnits(totalCollected, 6) : "—";

  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-2 text-gray-400 font-mono text-sm">
          {address.slice(0, 6)}...{address.slice(-4)}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12">
        <StatCard label="USDT Balance" value={balanceFormatted} suffix="USDT" />
        <StatCard
          label="Pending Yield"
          value={yieldFormatted}
          suffix="USDT"
        />
        <StatCard
          label="Treasury Total"
          value={totalFormatted}
          suffix="USDT"
        />
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-12 text-center">
        <h3 className="text-lg font-semibold text-white">
          Your Registered Services
        </h3>
        <p className="mt-2 text-sm text-gray-400">
          No services registered yet. Use the CLI to register an agent service.
        </p>
      </div>
    </>
  );
}

export default function DashboardPage(): React.ReactNode {
  const { address, isConnected } = useAccount();

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
      {!isConnected && (
        <div className="flex flex-col items-center justify-center py-24">
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-12 text-center max-w-md">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
              <span className="text-2xl text-emerald-400">W</span>
            </div>
            <h2 className="text-xl font-semibold text-white">
              Connect Wallet
            </h2>
            <p className="mt-3 text-sm text-gray-400 leading-relaxed">
              Connect your wallet to view your USDT balance, pending yield, and
              registered services.
            </p>
          </div>
        </div>
      )}

      {isConnected && address && <ConnectedDashboard address={address} />}
    </div>
  );
}

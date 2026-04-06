"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { Wallet } from "lucide-react";

export function ConnectButton(): React.ReactNode {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-[#111827] px-3 py-1.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-40" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="text-xs font-mono text-slate-400">
            {address.slice(0, 6)}...{address.slice(-4)}
          </span>
        </div>
        <button
          onClick={() => disconnect()}
          className="rounded-lg border border-slate-800 px-3 py-1.5 text-xs text-slate-400 hover:border-red-500/50 hover:text-red-400 transition-all duration-200"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => connect({ connector: connectors[0] })}
      className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 transition-all duration-200"
    >
      <Wallet className="h-3.5 w-3.5" />
      Connect
    </button>
  );
}

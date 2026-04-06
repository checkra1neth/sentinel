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
        <div className="flex items-center gap-2 rounded-md border border-[#1a1d24] bg-[#0f1116] px-3 py-1.5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-[#34d399] opacity-40" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#34d399]" />
          </span>
          <span className="text-xs font-mono text-[#7a7f8a]">
            {address.slice(0, 6)}...{address.slice(-4)}
          </span>
        </div>
        <button
          onClick={() => disconnect()}
          className="rounded-md border border-[#1a1d24] px-3 py-1.5 text-xs text-[#7a7f8a] hover:border-[#ef4444]/40 hover:text-[#ef4444] transition-all duration-200"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => connect({ connector: connectors[0] })}
      className="inline-flex items-center gap-2 rounded-md bg-[#6366f1] px-4 py-1.5 text-xs font-semibold text-[#e8eaed] hover:bg-[#818cf8] transition-all duration-200"
    >
      <Wallet className="h-3.5 w-3.5" />
      Connect
    </button>
  );
}

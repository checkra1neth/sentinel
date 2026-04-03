"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";

export function ConnectButton(): React.ReactNode {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-xs font-mono text-gray-400">
          {address.slice(0, 6)}...{address.slice(-4)}
        </span>
        <button
          onClick={() => disconnect()}
          className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-400 hover:border-red-500 hover:text-red-400 transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => connect({ connector: connectors[0] })}
      className="rounded-lg bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 transition-colors"
    >
      Connect Wallet
    </button>
  );
}

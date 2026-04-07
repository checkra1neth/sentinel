"use client";

import { useState, useEffect } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";

export function ConnectButton(): React.ReactNode {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Prevent hydration mismatch — always render the same thing on server
  if (!mounted) {
    return (
      <button className="text-xs text-[#06b6d4] hover:text-[#fafafa] transition-colors cursor-pointer">
        Connect
      </button>
    );
  }

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono text-[#a1a1aa]">
          {address.slice(0, 6)}...{address.slice(-4)}
        </span>
        <button
          onClick={() => disconnect()}
          className="text-xs text-[#a1a1aa] hover:text-[#fafafa] transition-colors cursor-pointer"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => connect({ connector: injected() })}
      className="text-xs text-[#06b6d4] hover:text-[#fafafa] transition-colors cursor-pointer"
    >
      Connect
    </button>
  );
}

"use client";

import { useState, type ReactNode } from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { mainnet, polygon, bsc, arbitrum, optimism, base, zksync, fantom, avalanche } from "viem/chains";
import { xlayer } from "../lib/chains";

const wagmiConfig = createConfig({
  chains: [xlayer, mainnet, polygon, bsc, arbitrum, optimism, base, zksync, fantom, avalanche],
  connectors: [injected()],
  transports: {
    [xlayer.id]: http(),
    [mainnet.id]: http(),
    [polygon.id]: http(),
    [bsc.id]: http(),
    [arbitrum.id]: http(),
    [optimism.id]: http(),
    [base.id]: http(),
    [zksync.id]: http(),
    [fantom.id]: http(),
    [avalanche.id]: http(),
  },
});

export { wagmiConfig as config };

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data stays "fresh" for 60s — no background refetch in this window
        staleTime: 60_000,
        // Keep inactive queries in cache for 24 hours
        gcTime: 24 * 60 * 60 * 1000,
        // Don't refetch on window focus (prevents flicker on alt-tab)
        refetchOnWindowFocus: false,
        // Retry failed queries twice
        retry: 2,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 15_000),
      },
    },
  });
}

const persister =
  typeof window !== "undefined"
    ? createSyncStoragePersister({ storage: window.localStorage })
    : undefined;

export function Providers({ children }: { children: ReactNode }): ReactNode {
  const [queryClient] = useState(createQueryClient);

  if (!persister) {
    // SSR / build — no persistence
    return (
      <WagmiProvider config={wagmiConfig}>
        <PersistQueryClientProvider client={queryClient} persistOptions={{ persister: undefined as never }}>
          {children}
        </PersistQueryClientProvider>
      </WagmiProvider>
    );
  }

  return (
    <WagmiProvider config={wagmiConfig}>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister,
          // Max age of persisted cache — 24 hours
          maxAge: 24 * 60 * 60 * 1000,
          // Don't persist wagmi internal queries (they have their own cache)
          dehydrateOptions: {
            shouldDehydrateQuery: (query) => {
              const key = query.queryKey[0];
              // Skip wagmi internal queries
              if (typeof key === "string" && key.startsWith("wagmi")) return false;
              // Only persist successful queries
              return query.state.status === "success";
            },
          },
        }}
      >
        {children}
      </PersistQueryClientProvider>
    </WagmiProvider>
  );
}

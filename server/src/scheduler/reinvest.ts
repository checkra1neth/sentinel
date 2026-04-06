import cron from "node-cron";
import { type BaseAgent } from "../agents/base-agent.js";
import { onchainosDefi, onchainosSwap } from "../lib/onchainos.js";
import { getPool, getPoolInfo } from "../lib/uniswap.js";
import { createPublicClient, http, type Address } from "viem";
import { config } from "../config.js";
import type { AgentEvent } from "../types.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WOKB: Address = "0xe538905cf8410324e03A5A23C1c177a474D59b2b";
const ZERO_ADDRESS: Address = "0x0000000000000000000000000000000000000000";

// ---------------------------------------------------------------------------
// Reinvest Scheduler
// ---------------------------------------------------------------------------

export function startReinvestScheduler(
  agents: BaseAgent[],
  cronInterval?: string,
  onEvent?: (event: AgentEvent) => void,
): cron.ScheduledTask {
  const interval = cronInterval ?? config.cron.reinvestInterval;

  const emit = (agent: string, type: AgentEvent["type"], message: string, details?: Record<string, unknown>): void => {
    if (!onEvent) return;
    onEvent({
      timestamp: Date.now(),
      agent,
      type,
      message,
      details,
    });
  };

  const task = cron.schedule(interval, async () => {
    for (const agent of agents) {
      const { threshold, percent } = agent.reinvestConfig;

      try {
        // 1. Check USDT balance
        const balanceStr = await agent.wallet.getUsdtBalance();
        const balance = parseFloat(balanceStr) / 1e6; // USDT has 6 decimals

        emit(agent.name, "reinvest", `Balance check: ${balance.toFixed(2)} USDT (threshold: ${threshold})`, {
          balance,
          threshold,
        });

        // 2. Skip if below threshold
        if (balance < threshold) {
          emit(agent.name, "reinvest", `Balance ${balance.toFixed(2)} below threshold ${threshold} -> skip`, {
            balance,
            threshold,
          });
          continue;
        }

        // 3. Calculate reinvest amount
        const reinvestAmount = balance * percent / 100;
        const reinvestRaw = Math.floor(reinvestAmount * 1e6).toString();

        emit(agent.name, "reinvest", `Reinvesting ${reinvestAmount.toFixed(2)} USDT (${percent}% of ${balance.toFixed(2)})`, {
          reinvestAmount,
          percent,
        });

        // 4. Try to find a DeFi pool via OnchainOS
        const poolSearch = onchainosDefi.search("USDT");
        const pools = poolSearch.success ? poolSearch.data : null;

        // 5. Also check Uniswap USDT/WOKB pool
        let uniswapPoolAvailable = false;
        try {
          const xlayer = createPublicClient({ transport: http(config.xlayerRpcUrl) });
          const poolAddr = await getPool(xlayer, config.contracts.usdt, WOKB, 3000);
          if (poolAddr && poolAddr !== ZERO_ADDRESS) {
            const poolInfo = await getPoolInfo(xlayer, poolAddr);
            if (poolInfo.liquidity > 0n) {
              uniswapPoolAvailable = true;
              emit(agent.name, "reinvest", `Found Uniswap USDT/WOKB pool: ${poolAddr}`, {
                poolAddress: poolAddr,
                liquidity: poolInfo.liquidity.toString(),
              });
            }
          }
        } catch {
          // Uniswap pool not available
        }

        // 6 & 7. Try LP investment if pools available
        if (pools || uniswapPoolAvailable) {
          // Swap half to pair token
          const halfAmount = Math.floor(reinvestAmount * 1e6 / 2).toString();

          emit(agent.name, "reinvest", `Swapping ${halfAmount} USDT to WOKB for LP`, {
            halfAmount,
          });

          const swapResult = onchainosSwap.execute(
            config.contracts.usdt,
            WOKB,
            halfAmount,
            config.chainId,
          );

          if (swapResult.success) {
            emit(agent.name, "reinvest", "Swap succeeded, investing in LP", {
              swapData: swapResult.data,
            });

            // Invest via OnchainOS DeFi — search for best pool and invest
            const poolSearch = onchainosDefi.search("USDT", config.chainId, "DEX_POOL");
            const pools = poolSearch.success && poolSearch.data
              ? ((poolSearch.data as Record<string, unknown>).list ?? []) as Array<Record<string, unknown>>
              : [];
            const bestPool = Array.isArray(pools) && pools.length > 0
              ? [...pools].sort((a, b) => Number(b.tvl ?? 0) - Number(a.tvl ?? 0))[0]
              : null;
            const investResult = bestPool
              ? onchainosDefi.invest(
                  Number(bestPool.investmentId),
                  agent.walletAddress,
                  config.contracts.usdt,
                  halfAmount,
                  config.chainId,
                  10,
                )
              : { success: false, data: null, error: "No pool found" };

            if (investResult.success) {
              emit(agent.name, "reinvest", `LP investment succeeded for ${agent.name}`, {
                investData: investResult.data,
              });
            } else {
              emit(agent.name, "error", `LP investment failed: ${investResult.error}`, {
                error: investResult.error,
              });
            }
          } else {
            // 8. Fallback: simple USDT -> OKB swap
            emit(agent.name, "reinvest", "LP swap failed, falling back to simple USDT->OKB swap", {
              error: swapResult.error,
            });

            const fallbackResult = onchainosSwap.execute(
              config.contracts.usdt,
              WOKB,
              reinvestRaw,
            );

            emit(
              agent.name,
              fallbackResult.success ? "reinvest" : "error",
              fallbackResult.success
                ? `Fallback swap succeeded for ${agent.name}`
                : `Fallback swap failed: ${fallbackResult.error}`,
              { result: fallbackResult.data, error: fallbackResult.error },
            );
          }
        } else {
          // 8. No LP available: simple USDT -> OKB swap
          emit(agent.name, "reinvest", "No LP pools available, doing simple USDT->OKB swap");

          const fallbackResult = onchainosSwap.execute(
            config.contracts.usdt,
            WOKB,
            reinvestRaw,
          );

          emit(
            agent.name,
            fallbackResult.success ? "reinvest" : "error",
            fallbackResult.success
              ? `Simple swap succeeded for ${agent.name}`
              : `Simple swap failed: ${fallbackResult.error}`,
            { result: fallbackResult.data, error: fallbackResult.error },
          );
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        emit(agent.name, "error", `Reinvest error for ${agent.name}: ${message}`);
        agent.log(`Reinvest error: ${message}`);
      }
    }
  });

  console.log(`[scheduler] Reinvest scheduler started: ${interval}`);
  return task;
}

import cron from "node-cron";
import { type ExecutorAgent } from "../agents/executor-agent.js";
import { onchainosMarket, onchainosDefi } from "../lib/onchainos.js";
import { settings } from "../settings.js";
import { config } from "../config.js";
import type { AgentEvent } from "../types.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ManageLoopResult {
  task: cron.ScheduledTask;
  stop: () => void;
}

// ---------------------------------------------------------------------------
// Manage Cron Loop — position sync, stop-loss, auto-collect
// ---------------------------------------------------------------------------

export function startManageLoop(
  executor: ExecutorAgent,
  onEvent?: (event: AgentEvent) => void,
): ManageLoopResult {
  const emit = (
    type: AgentEvent["type"],
    message: string,
    details?: Record<string, unknown>,
  ): void => {
    if (!onEvent) return;
    onEvent({
      timestamp: Date.now(),
      agent: "manage-loop",
      type,
      message,
      details,
    });
  };

  const run = async (): Promise<void> => {
    const cfg = settings.get().manage;
    if (cfg.mode !== "auto") return;

    emit("log", "Manage loop started");

    // 1. Sync positions from chain
    try {
      const posResult = onchainosDefi.positions(executor.walletAddress, "xlayer");
      if (posResult.success) {
        emit("log", "Synced on-chain positions", { data: posResult.data });
      }
    } catch {
      /* position sync unavailable */
    }

    // 2. Check stop-loss for local positions
    if (cfg.stopLossEnabled) {
      const stopLossPct = settings.get().invest.stopLossPercent;

      for (const pos of executor.lpPositions) {
        try {
          const priceResult = onchainosMarket.price(pos.token, config.chainId);
          if (priceResult.success && priceResult.data) {
            const currentPrice = Number(
              (priceResult.data as Record<string, unknown>).price ?? 0,
            );
            const entryPrice = Number(pos.entryPrice ?? 0);

            if (entryPrice > 0 && currentPrice > 0) {
              const lossPct =
                ((entryPrice - currentPrice) / entryPrice) * 100;

              if (lossPct > stopLossPct) {
                emit("invest", `Stop-loss triggered for ${pos.tokenSymbol}: -${lossPct.toFixed(1)}%`, {
                  token: pos.token,
                  lossPct,
                  investmentId: pos.investmentId,
                });

                await executor.execute("exit", {
                  investmentId: pos.investmentId,
                });
              }
            }
          }
        } catch {
          /* price unavailable */
        }
      }
    }

    // 3. Auto-collect fees
    if (cfg.rebalanceEnabled) {
      try {
        await executor.execute("collect", {});
        emit("log", "Auto-collected LP fees");
      } catch (err) {
        emit(
          "error",
          `Fee collection failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    emit("log", "Manage loop complete");
  };

  const interval = settings.get().manage.collectFeesInterval;

  const task = cron.schedule(interval, () => {
    run().catch((err) => {
      emit(
        "error",
        `Manage loop error: ${err instanceof Error ? err.message : String(err)}`,
      );
    });
  });

  console.log(`[cron] Manage loop scheduled: ${interval}`);

  const stop = (): void => {
    task.stop();
    console.log("[cron] Manage loop stopped");
  };

  return { task, stop };
}

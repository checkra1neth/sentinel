# Backend Part 4: Manage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add portfolio management: enhanced portfolio with P&L, fee collection, position exits, stop-loss cron, wallet balances.

**Architecture:** New manage endpoints in router. New manage-loop cron scheduler. Extend executor with exit/collect actions. Use onchainosDefi (withdraw, collect, positions), onchainosPortfolio (totalValue, allBalances), onchainosMarket (price).

**Tech Stack:** TypeScript, Express, node-cron, existing onchainos.ts

**Spec:** `docs/superpowers/specs/2026-04-07-sentinel-full-backend-spec.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `server/src/agents/executor-agent.ts` | Modify | Add exit, collectFees actions |
| `server/src/scheduler/manage-loop.ts` | Create | Cron: sync positions, stop-loss, auto-collect |
| `server/src/router/service-router.ts` | Modify | Add /api/manage/* endpoints |
| `server/src/index.ts` | Modify | Register manage-loop cron |

---

### Task 1: Add exit and collectFees actions to Executor

**Files:**
- Modify: `server/src/agents/executor-agent.ts`

- [ ] **Step 1: Add new cases to execute() switch**

Add before `default:`:

```typescript
      case "exit":
        return this.exitPosition(
          params.investmentId as number,
          params.ratio as string | undefined,
        );
      case "collect":
        return this.collectFees();
```

- [ ] **Step 2: Add exitPosition method**

Add after previewInvestment method:

```typescript
  async exitPosition(
    investmentId: number,
    ratio: string = "1",
  ): Promise<Record<string, unknown>> {
    this.log(`Exiting position ${investmentId} (ratio: ${ratio})`);

    const result = onchainosDefi.withdraw(investmentId, this.walletAddress, config.chainId, ratio);

    if (result.success) {
      // Remove from local tracking if full exit
      if (ratio === "1") {
        this.lpPositions = this.lpPositions.filter(
          (p) => p.investmentId !== investmentId,
        );
      }

      this.emit({
        timestamp: Date.now(),
        agent: this.name,
        type: "invest",
        message: `Exited position ${investmentId} (${Number(ratio) * 100}%)`,
        details: { investmentId, ratio, data: result.data },
      });

      return { success: true, investmentId, ratio, data: result.data };
    }

    return { success: false, investmentId, error: "Withdraw failed" };
  }
```

- [ ] **Step 3: Add collectFees method**

```typescript
  async collectFees(): Promise<Record<string, unknown>> {
    this.log("Collecting LP fees");

    const results: Array<Record<string, unknown>> = [];

    // Collect V3 fees
    const collectResult = onchainosDefi.collect(this.walletAddress, config.chainId, "V3_FEE");

    if (collectResult.success) {
      results.push({ type: "V3_FEE", success: true, data: collectResult.data });
    }

    // Collect platform rewards
    const rewardResult = onchainosDefi.collect(this.walletAddress, config.chainId, "REWARD_PLATFORM");

    if (rewardResult.success) {
      results.push({ type: "REWARD_PLATFORM", success: true, data: rewardResult.data });
    }

    this.emit({
      timestamp: Date.now(),
      agent: this.name,
      type: "invest",
      message: `Collected fees: ${results.length} reward types`,
      details: { results },
    });

    return { success: true, collected: results };
  }
```

- [ ] **Step 4: Commit**

```bash
cd /Users/pavelmackevic/Projects/agentra
git add server/src/agents/executor-agent.ts
git commit -m "feat: add exit and collectFees actions to Executor

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Create manage-loop cron scheduler

**Files:**
- Create: `server/src/scheduler/manage-loop.ts`

- [ ] **Step 1: Create manage-loop.ts**

```typescript
import cron from "node-cron";
import { type ExecutorAgent } from "../agents/executor-agent.js";
import { onchainosMarket, onchainosDefi, onchainosPortfolio } from "../lib/onchainos.js";
import { settings } from "../settings.js";
import { config } from "../config.js";
import type { AgentEvent } from "../types.js";

export interface ManageLoopResult {
  task: cron.ScheduledTask;
  stop: () => void;
}

export function startManageLoop(
  executor: ExecutorAgent,
  onEvent?: (event: AgentEvent) => void,
): ManageLoopResult {
  const emit = (message: string, type: AgentEvent["type"] = "log", details?: Record<string, unknown>): void => {
    onEvent?.({
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

    emit("Manage loop started");

    // 1. Sync positions from chain
    try {
      const posResult = onchainosDefi.positions(executor.walletAddress, "xlayer");
      if (posResult.success) {
        emit("Synced on-chain positions", "log", { data: posResult.data });
      }
    } catch { /* */ }

    // 2. Check stop-loss for local positions
    if (cfg.stopLossEnabled) {
      for (const pos of executor.lpPositions) {
        try {
          const priceResult = onchainosMarket.price(pos.token, config.chainId);
          if (priceResult.success && priceResult.data) {
            const currentPrice = Number((priceResult.data as Record<string, unknown>).price ?? 0);
            const entryPrice = Number(pos.entryPrice ?? 0);

            if (entryPrice > 0 && currentPrice > 0) {
              const lossPct = ((entryPrice - currentPrice) / entryPrice) * 100;
              if (lossPct > cfg.stopLossPercent) {
                emit(`Stop-loss triggered for ${pos.tokenSymbol}: -${lossPct.toFixed(1)}%`, "invest", {
                  token: pos.token,
                  lossPct,
                  investmentId: pos.investmentId,
                });

                if (pos.investmentId) {
                  await executor.execute("exit", { investmentId: pos.investmentId });
                }
              }
            }
          }
        } catch { /* price unavailable */ }
      }
    }

    // 3. Auto-collect fees
    if (cfg.rebalanceEnabled) {
      try {
        await executor.execute("collect", {});
        emit("Auto-collected LP fees");
      } catch (err) {
        emit(`Fee collection failed: ${err instanceof Error ? err.message : String(err)}`, "error");
      }
    }

    emit("Manage loop complete");
  };

  const interval = settings.get().manage.collectFeesInterval;
  const task = cron.schedule(interval, () => {
    run().catch((err) => {
      emit(`Manage loop error: ${err instanceof Error ? err.message : String(err)}`, "error");
    });
  });

  emit(`Manage loop scheduled: ${interval}`);

  return {
    task,
    stop: () => { task.stop(); },
  };
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/pavelmackevic/Projects/agentra
git add server/src/scheduler/manage-loop.ts
git commit -m "feat: add manage-loop cron — position sync, stop-loss, auto-collect

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Add manage API endpoints + register cron

**Files:**
- Modify: `server/src/router/service-router.ts`
- Modify: `server/src/index.ts`

- [ ] **Step 1: Add manage endpoints to router**

Add these endpoints in service-router.ts BEFORE the `// ── Invest ──` section. Add needed imports at top:

```typescript
import { onchainosDefi, onchainosSwap, onchainosMarket, onchainosPortfolio } from "../lib/onchainos.js";
```

Note: `onchainosSwap` may already be imported — just add `onchainosMarket` and `onchainosPortfolio` to the existing import.

Endpoints:

```typescript
  // ── Manage ──

  router.get("/manage/portfolio", async (req: Request, res: Response): Promise<void> => {
    try {
      const executor = agents["3"] as unknown as { walletAddress: string; execute: (a: string, p: Record<string, unknown>) => Promise<unknown>; lpPositions: Array<Record<string, unknown>> } | undefined;
      if (!executor) { res.status(503).json({ error: "Executor not available" }); return; }

      // Get local positions with P&L
      const positions = executor.lpPositions.map((p: Record<string, unknown>) => ({
        ...p,
      }));

      // Get wallet balances
      let walletBalances: unknown = null;
      try {
        const balResult = onchainosPortfolio.allBalances(executor.walletAddress);
        if (balResult.success) walletBalances = balResult.data;
      } catch { /* */ }

      // Get total value
      let totalValue: unknown = null;
      try {
        const valResult = onchainosPortfolio.totalValue(executor.walletAddress);
        if (valResult.success) totalValue = valResult.data;
      } catch { /* */ }

      // Get on-chain DeFi positions
      let defiPositions: unknown = null;
      try {
        const posResult = onchainosDefi.positions(executor.walletAddress);
        if (posResult.success) defiPositions = posResult.data;
      } catch { /* */ }

      res.json({
        positions,
        totalPositions: positions.length,
        walletBalances,
        totalValue,
        defiPositions,
      });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  router.post("/manage/collect-all", async (_req: Request, res: Response): Promise<void> => {
    try {
      const executor = agents["3"];
      if (!executor) { res.status(503).json({ error: "Executor not available" }); return; }
      const result = await executor.execute("collect", {});
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  router.post("/manage/exit/:investmentId", async (req: Request, res: Response): Promise<void> => {
    try {
      const executor = agents["3"];
      if (!executor) { res.status(503).json({ error: "Executor not available" }); return; }
      const investmentId = Number(req.params.investmentId);
      const ratio = (req.body as Record<string, unknown>)?.ratio as string | undefined;
      const result = await executor.execute("exit", { investmentId, ratio });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  router.get("/manage/balances", async (_req: Request, res: Response): Promise<void> => {
    try {
      const balances: Record<string, unknown> = {};
      for (const [id, agent] of Object.entries(agents)) {
        try {
          const bal = await agent.wallet.getUsdtBalance();
          balances[agent.name] = { id, address: agent.walletAddress, usdtBalance: bal };
        } catch { /* */ }
      }
      res.json({ balances });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });
```

- [ ] **Step 2: Register manage-loop in index.ts**

Add import at top of index.ts:
```typescript
import { startManageLoop } from "./scheduler/manage-loop.js";
```

After the reinvest scheduler initialization (around line that starts `startReinvestScheduler`), add:
```typescript
const manageLoop = startManageLoop(
  agents["3"] as unknown as import("./agents/executor-agent.js").ExecutorAgent,
  (event) => eventBus.emit(event),
);
```

- [ ] **Step 3: Commit**

```bash
cd /Users/pavelmackevic/Projects/agentra
git add -A
git commit -m "feat: add manage endpoints + manage-loop cron — portfolio, collect, exit, balances

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Verify all manage endpoints

- [ ] **Step 1: Test portfolio**

```bash
curl -s http://localhost:3002/api/manage/portfolio | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'Positions: {d.get(\"totalPositions\", 0)}')
print(f'Wallet balances: {d.get(\"walletBalances\") is not None}')
print(f'Total value: {d.get(\"totalValue\") is not None}')
print(f'DeFi positions: {d.get(\"defiPositions\") is not None}')
"
```

- [ ] **Step 2: Test balances**

```bash
curl -s http://localhost:3002/api/manage/balances | python3 -m json.tool | head -20
```

- [ ] **Step 3: Test collect-all**

```bash
curl -s -X POST http://localhost:3002/api/manage/collect-all | python3 -m json.tool | head -10
```

- [ ] **Step 4: Commit verification**

```bash
git add -A
git commit -m "chore: verify manage endpoints — portfolio, balances, collect

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

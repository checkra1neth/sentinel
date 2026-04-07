# Backend Part 3: Invest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add investment preview, configurable strategy (LP/swap/auto), and swap quote endpoints. Settings-aware investment amounts.

**Architecture:** Extend executor-agent.ts with preview action, add invest/swap endpoints to router. Use existing onchainos wrappers (now fixed with correct CLI args).

**Tech Stack:** TypeScript, Express, existing onchainos.ts

**Spec:** `docs/superpowers/specs/2026-04-07-sentinel-full-backend-spec.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `server/src/agents/executor-agent.ts` | Modify | Add preview action, settings-aware amount |
| `server/src/router/service-router.ts` | Modify | Add /api/invest/* endpoints |

---

### Task 1: Add preview action and settings to Executor

**Files:**
- Modify: `server/src/agents/executor-agent.ts`

- [ ] **Step 1: Add settings import**

Add at top of executor-agent.ts:
```typescript
import { settings } from "../settings.js";
```

- [ ] **Step 2: Add preview action to execute() switch**

Read the existing `execute()` method. In the switch statement, add a new case before `default`:

```typescript
      case "preview":
        return this.previewInvestment(
          params.token as string,
          params.amount as string | undefined,
        );
```

- [ ] **Step 3: Add previewInvestment method**

Add this new method after the existing `investInToken()` method:

```typescript
  async previewInvestment(
    tokenSymbol: string,
    amount?: string,
  ): Promise<Record<string, unknown>> {
    const cfg = settings.get().invest;
    const investAmount = amount ?? String(cfg.maxPerPosition);

    // Search DeFi pools
    const poolSearch = onchainosDefi.search(tokenSymbol, config.chainId, "DEX_POOL");
    const pools: Array<Record<string, unknown>> = [];

    if (poolSearch.success && poolSearch.data) {
      const searchData = poolSearch.data as Record<string, unknown>;
      const list = (searchData.list ?? searchData) as Array<Record<string, unknown>>;
      if (Array.isArray(list)) {
        for (const p of list) {
          pools.push({
            investmentId: p.investmentId,
            name: p.name,
            platform: p.platformName,
            apr: p.rate,
            tvl: p.tvl,
          });
        }
      }
    }

    // Sort by TVL
    pools.sort((a, b) => Number(b.tvl ?? 0) - Number(a.tvl ?? 0));

    // Swap quote
    let swapQuote: Record<string, unknown> | null = null;
    try {
      const quoteResult = onchainosSwap.quote(
        config.contracts.usdt,
        tokenSymbol,
        investAmount,
        config.chainId,
      );
      if (quoteResult.success && quoteResult.data) {
        swapQuote = quoteResult.data as Record<string, unknown>;
      }
    } catch { /* quote unavailable */ }

    return {
      token: tokenSymbol,
      amount: investAmount,
      strategy: cfg.strategy,
      pools,
      bestPool: pools[0] ?? null,
      swapQuote,
    };
  }
```

- [ ] **Step 4: Make investInToken use settings for amount**

Find where `investAmount` is set in `investInToken()`. It currently receives amount as a parameter. At the start of the method, add settings fallback:

Find the line that sets `investAmount` (something like `const investAmount = ...`) and ensure it falls back to settings:

```typescript
    const investAmount = rawAmount || String(settings.get().invest.maxPerPosition);
```

- [ ] **Step 5: Commit**

```bash
cd /Users/pavelmackevic/Projects/agentra
git add server/src/agents/executor-agent.ts
git commit -m "feat: add preview action and settings-aware investment to Executor

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Add invest API endpoints

**Files:**
- Modify: `server/src/router/service-router.ts`

- [ ] **Step 1: Add invest endpoints**

In service-router.ts, add these endpoints BEFORE the `// ── Analyze ──` section:

```typescript
  // ── Invest ──

  router.post("/invest/preview", async (req: Request, res: Response): Promise<void> => {
    try {
      const executor = agents["3"];
      if (!executor) { res.status(503).json({ error: "Executor not available" }); return; }
      const { token, amount } = req.body as { token?: string; amount?: string };
      if (!token) { res.status(400).json({ error: "token required" }); return; }
      const result = await executor.execute("preview", { token, amount });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  router.post("/invest/execute", async (req: Request, res: Response): Promise<void> => {
    try {
      const executor = agents["3"];
      if (!executor) { res.status(503).json({ error: "Executor not available" }); return; }
      const { token, amount, tokenSymbol, riskScore } = req.body as {
        token?: string; amount?: string; tokenSymbol?: string; riskScore?: number;
      };
      if (!token) { res.status(400).json({ error: "token required" }); return; }
      const result = await executor.execute("invest", {
        token,
        amount: amount ?? String(settings.get().invest.maxPerPosition),
        tokenSymbol: tokenSymbol ?? token.slice(0, 8),
        riskScore: riskScore ?? 15,
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  router.post("/invest/swap", async (req: Request, res: Response): Promise<void> => {
    try {
      const { fromToken, toToken, amount } = req.body as {
        fromToken?: string; toToken?: string; amount?: string;
      };
      if (!fromToken || !toToken || !amount) {
        res.status(400).json({ error: "fromToken, toToken, amount required" });
        return;
      }
      const executor = agents["3"] as unknown as { walletAddress: string } | undefined;
      if (!executor) { res.status(503).json({ error: "Executor not available" }); return; }

      const result = onchainosSwap.execute(
        fromToken, toToken, amount, executor.walletAddress, config.chainId,
      );
      res.json({ success: result.success, data: result.data, error: result.success ? undefined : "Swap failed" });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });
```

Also add the needed imports if not already present:
```typescript
import { onchainosSwap } from "../lib/onchainos.js";
import { config } from "../config.js";
```

- [ ] **Step 2: Commit**

```bash
cd /Users/pavelmackevic/Projects/agentra
git add server/src/router/service-router.ts
git commit -m "feat: add /api/invest/preview, /execute, /swap endpoints

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Verify invest endpoints with real data

- [ ] **Step 1: Test preview**

```bash
curl -s -X POST http://localhost:3002/api/invest/preview \
  -H "Content-Type: application/json" \
  -d '{"token":"USDT"}' | python3 -m json.tool | head -30
```

Expected: JSON with pools array (at least Aave V3 USDT pool), bestPool, swapQuote.

- [ ] **Step 2: Test swap quote via preview**

```bash
curl -s -X POST http://localhost:3002/api/invest/preview \
  -H "Content-Type: application/json" \
  -d '{"token":"WOKB","amount":"1"}' | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'Pools: {len(d.get(\"pools\",[]))}')
print(f'Best pool: {d.get(\"bestPool\")}')
print(f'Swap quote: {d.get(\"swapQuote\") is not None}')
print(f'Strategy: {d.get(\"strategy\")}')
"
```

- [ ] **Step 3: Commit verification**

```bash
git add -A
git commit -m "chore: verify invest endpoints with real pool data

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

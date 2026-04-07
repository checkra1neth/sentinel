# Backend Part 1: Settings + Discover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add configurable settings system and expand Scanner to use all OKX discovery sources (all trenches stages, whale/degen signals, token search, bundle analysis).

**Architecture:** Settings stored in-memory with JSON file persistence. Scanner agent expanded to query configurable sources. New API endpoints for discovery feed, whale alerts, and manual scan trigger. Decision engine respects auto/manual mode.

**Tech Stack:** TypeScript, Express, node-cron, existing onchainos.ts wrapper

**Spec:** `docs/superpowers/specs/2026-04-07-sentinel-full-backend-spec.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `server/src/settings.ts` | Create | Settings store: load/save/get/update |
| `server/src/pending-store.ts` | Create | Queue for tokens awaiting manual action |
| `server/src/agents/scanner-agent.ts` | Modify | Add all trenches stages + whale/degen signals |
| `server/src/agents/decision-engine.ts` | Modify | Respect analyze/invest mode from settings |
| `server/src/router/service-router.ts` | Modify | Add /settings, /discover/*, /pending/* endpoints |
| `server/src/scheduler/cron-loop.ts` | Modify | Use settings.discover.interval dynamically |
| `server/src/index.ts` | Modify | Initialize settings, register new routes |

---

### Task 1: Create Settings Store

**Files:**
- Create: `server/src/settings.ts`

- [ ] **Step 1: Create settings.ts**

```typescript
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

export interface DiscoverSettings {
  mode: "auto" | "manual";
  interval: string;
  sources: string[];
  trackWhales: boolean;
  trackSmartMoney: boolean;
  trackDegen: boolean;
}

export interface AnalyzeSettings {
  mode: "auto" | "manual";
  useKline: boolean;
  useWhaleContext: boolean;
  riskThreshold: number;
}

export interface InvestSettings {
  mode: "auto" | "manual";
  maxPerPosition: number;
  strategy: "lp" | "swap" | "auto";
  stopLossPercent: number;
}

export interface ManageSettings {
  mode: "auto" | "manual";
  collectFeesInterval: string;
  rebalanceEnabled: boolean;
  stopLossEnabled: boolean;
}

export interface Settings {
  discover: DiscoverSettings;
  analyze: AnalyzeSettings;
  invest: InvestSettings;
  manage: ManageSettings;
}

const SETTINGS_PATH = join(process.cwd(), "settings.json");

const DEFAULTS: Settings = {
  discover: {
    mode: "auto",
    interval: "*/5 * * * *",
    sources: ["NEW", "MIGRATED", "TRENDING", "TOP_GAINERS"],
    trackWhales: true,
    trackSmartMoney: true,
    trackDegen: false,
  },
  analyze: {
    mode: "auto",
    useKline: true,
    useWhaleContext: true,
    riskThreshold: 40,
  },
  invest: {
    mode: "auto",
    maxPerPosition: 10,
    strategy: "auto",
    stopLossPercent: 20,
  },
  manage: {
    mode: "auto",
    collectFeesInterval: "0 */6 * * *",
    rebalanceEnabled: true,
    stopLossEnabled: true,
  },
};

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key]) && target[key] && typeof target[key] === "object") {
      result[key] = deepMerge(target[key] as Record<string, unknown>, source[key] as Record<string, unknown>);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

let current: Settings = { ...DEFAULTS };

export const settings = {
  load(): void {
    if (existsSync(SETTINGS_PATH)) {
      try {
        const raw = readFileSync(SETTINGS_PATH, "utf-8");
        const saved = JSON.parse(raw) as Partial<Settings>;
        current = deepMerge(DEFAULTS as unknown as Record<string, unknown>, saved as unknown as Record<string, unknown>) as unknown as Settings;
      } catch {
        current = { ...DEFAULTS };
      }
    }
  },

  get(): Settings {
    return current;
  },

  update(patch: Partial<Settings>): Settings {
    current = deepMerge(current as unknown as Record<string, unknown>, patch as unknown as Record<string, unknown>) as unknown as Settings;
    try {
      writeFileSync(SETTINGS_PATH, JSON.stringify(current, null, 2));
    } catch { /* write failure is non-fatal */ }
    return current;
  },
};
```

- [ ] **Step 2: Verify it compiles**

```bash
cd /Users/pavelmackevic/Projects/agentra/server && npx tsc --noEmit src/settings.ts 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add server/src/settings.ts
git commit -m "feat: add settings store with JSON persistence

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Create Pending Store

**Files:**
- Create: `server/src/pending-store.ts`

- [ ] **Step 1: Create pending-store.ts**

```typescript
export interface PendingToken {
  address: string;
  source: string;
  discoveredAt: number;
  status: "awaiting_analyze" | "awaiting_invest";
  verdict?: { riskScore: number; verdict: string; tokenSymbol: string };
}

const pending = new Map<string, PendingToken>();

export const pendingStore = {
  add(address: string, source: string, status: PendingToken["status"]): void {
    const key = address.toLowerCase();
    if (!pending.has(key)) {
      pending.set(key, { address: key, source, discoveredAt: Date.now(), status });
    }
  },

  setVerdict(address: string, verdict: PendingToken["verdict"]): void {
    const item = pending.get(address.toLowerCase());
    if (item) {
      item.verdict = verdict;
      item.status = "awaiting_invest";
    }
  },

  remove(address: string): boolean {
    return pending.delete(address.toLowerCase());
  },

  getByStatus(status: PendingToken["status"]): PendingToken[] {
    return Array.from(pending.values()).filter((t) => t.status === status);
  },

  get(address: string): PendingToken | undefined {
    return pending.get(address.toLowerCase());
  },

  all(): PendingToken[] {
    return Array.from(pending.values());
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add server/src/pending-store.ts
git commit -m "feat: add pending store for manual-mode token queue

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Expand Scanner Agent — all discovery sources

**Files:**
- Modify: `server/src/agents/scanner-agent.ts`

- [ ] **Step 1: Add new sources to discoverTokens()**

In `scanner-agent.ts`, add import for settings at the top:

```typescript
import { settings } from "../settings.js";
```

Replace the `discoverTokens()` method (lines ~81-158) with expanded version that reads settings:

```typescript
async discoverTokens(): Promise<TokenCandidate[]> {
  const cfg = settings.get().discover;
  const candidates: TokenCandidate[] = [];
  const seen = new Set<string>();

  const add = (address: string, source: string, name?: string): void => {
    const normalized = address.toLowerCase();
    if (seen.has(normalized)) return;
    seen.add(normalized);
    candidates.push({ address: normalized, source, name });
  };

  // Trenches — all configured stages
  for (const stage of cfg.sources) {
    try {
      const result = await onchainosTrenches.tokens(stage, config.chainId);
      if (result.success && Array.isArray(result.data)) {
        for (const t of result.data as Array<Record<string, string>>) {
          const addr = t.tokenAddress ?? t.address ?? t.token;
          if (addr) add(addr, `trenches_${stage.toLowerCase()}`, t.tokenSymbol ?? t.symbol);
        }
      }
    } catch { /* source unavailable */ }
  }

  // Smart money signals
  if (cfg.trackSmartMoney) {
    try {
      const result = await onchainosSignal.activities("smart_money", config.chainId);
      if (result.success && Array.isArray(result.data)) {
        for (const s of result.data as Array<Record<string, string>>) {
          const addr = s.tokenAddress ?? s.token;
          if (addr) add(addr, "smart_money", s.tokenSymbol);
        }
      }
    } catch { /* */ }
  }

  // Whale signals
  if (cfg.trackWhales) {
    try {
      const result = await onchainosSignal.activities("whale", config.chainId);
      if (result.success && Array.isArray(result.data)) {
        for (const s of result.data as Array<Record<string, string>>) {
          const addr = s.tokenAddress ?? s.token;
          if (addr) add(addr, "whale", s.tokenSymbol);
        }
      }
    } catch { /* */ }
  }

  // Degen signals
  if (cfg.trackDegen) {
    try {
      const result = await onchainosSignal.activities("degen", config.chainId);
      if (result.success && Array.isArray(result.data)) {
        for (const s of result.data as Array<Record<string, string>>) {
          const addr = s.tokenAddress ?? s.token;
          if (addr) add(addr, "degen", s.tokenSymbol);
        }
      }
    } catch { /* */ }
  }

  // Hot tokens
  try {
    const result = await onchainosToken.hotTokens();
    if (result.success && Array.isArray(result.data)) {
      for (const t of result.data as Array<Record<string, string>>) {
        const addr = t.tokenContractAddress ?? t.address ?? t.token;
        if (addr) add(addr, "hot_token", t.tokenSymbol ?? t.symbol);
      }
    }
  } catch { /* */ }

  this.emitEvent("log", `Discovered ${candidates.length} unique tokens from ${cfg.sources.length} trenches stages + signals`);
  return candidates;
}
```

- [ ] **Step 2: Verify server compiles**

```bash
cd /Users/pavelmackevic/Projects/agentra/server && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add server/src/agents/scanner-agent.ts
git commit -m "feat: expand scanner to all trenches stages + whale/degen signals

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Update Decision Engine — respect auto/manual mode

**Files:**
- Modify: `server/src/agents/decision-engine.ts`

- [ ] **Step 1: Add settings + pending store imports and mode checks**

Add imports at top of `decision-engine.ts`:

```typescript
import { settings } from "../settings.js";
import { pendingStore } from "../pending-store.js";
```

Replace `processToken()` method with mode-aware version:

```typescript
private async processToken(address: string, source: string): Promise<void> {
  const cfg = settings.get();

  // If analyze mode is manual — queue for user review
  if (cfg.analyze.mode === "manual") {
    pendingStore.add(address, source, "awaiting_analyze");
    this.emitEvent("log", `Queued ${address} for manual analysis (source: ${source})`);
    return;
  }

  // Auto-analyze
  this.emitEvent("buy_service", `Buying Analyst scan for ${address} (${source})`, {
    token: address,
    source,
  });

  const scanResult = await this.services.analyst.x402.buyService(
    this.services.analyst.serviceId,
    "scan",
    { token: address },
  );

  if (!scanResult.success) {
    this.emitEvent("error", `Analyst scan failed for ${address}: ${scanResult.error}`, { token: address });
    return;
  }

  const result = scanResult.result as Record<string, unknown> | undefined;
  const verdict = result?.verdict as string | undefined;
  const verdictLabel = (verdict ?? "UNKNOWN").toUpperCase();
  const riskScore = (result?.riskScore as number) ?? 100;
  const tokenSymbol = (result?.tokenSymbol as string) ?? address.slice(0, 8);

  this.emitEvent("scan", `${tokenSymbol} verdict: ${verdictLabel} (risk ${riskScore})`, {
    token: address,
    tokenSymbol,
    verdict: verdictLabel,
    riskScore,
  });

  if (verdictLabel === "SAFE") {
    // If invest mode is manual — queue for user review
    if (cfg.invest.mode === "manual") {
      pendingStore.add(address, source, "awaiting_invest");
      pendingStore.setVerdict(address, { riskScore, verdict: verdictLabel, tokenSymbol });
      this.emitEvent("log", `${tokenSymbol} is SAFE — queued for manual investment`);
      return;
    }

    // Auto-invest
    const amount = String(cfg.invest.maxPerPosition);
    this.emitEvent("buy_service", `${tokenSymbol} is SAFE (risk ${riskScore}) -> investing ${amount} USDT via Executor`, {
      token: address,
      riskScore,
    });

    const investResult = await this.services.executor.x402.buyService(
      this.services.executor.serviceId,
      "invest",
      { token: address, tokenSymbol, riskScore, amount },
    );

    if (investResult.success) {
      this.emitEvent("invest", `Invested ${amount} USDT in ${tokenSymbol}`, {
        token: address,
        amount,
        txHash: investResult.txHash,
      });
    } else {
      this.emitEvent("error", `Executor invest failed for ${tokenSymbol}: ${investResult.error}`, { token: address });
    }
  } else {
    this.emitEvent("scan", `${tokenSymbol} is ${verdictLabel} (risk ${riskScore}) — skipping`, { token: address, verdict: verdictLabel });
  }
}
```

- [ ] **Step 2: Verify compiles**

```bash
cd /Users/pavelmackevic/Projects/agentra/server && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add server/src/agents/decision-engine.ts
git commit -m "feat: decision engine respects auto/manual mode from settings

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Add new API endpoints — settings, discover, pending

**Files:**
- Modify: `server/src/router/service-router.ts`

- [ ] **Step 1: Add imports at top of service-router.ts**

```typescript
import { settings } from "../settings.js";
import { pendingStore } from "../pending-store.js";
import { ScannerAgent } from "../agents/scanner-agent.js";
import { onchainosSignal } from "../lib/onchainos.js";
```

- [ ] **Step 2: Add settings endpoints inside createServiceRouter()**

Add before the `return router;` at the end of the function:

```typescript
  // ── Settings ──

  router.get("/settings", (_req: Request, res: Response): void => {
    res.json(settings.get());
  });

  router.patch("/settings", (req: Request, res: Response): void => {
    const updated = settings.update(req.body ?? {});
    res.json(updated);
  });

  // ── Discover ──

  router.get("/discover/feed", async (req: Request, res: Response): Promise<void> => {
    try {
      const scanner = agents["1"] as ScannerAgent | undefined;
      if (!scanner) { res.status(503).json({ error: "Scanner not available" }); return; }
      const tokens = await scanner.discoverTokens();
      const limit = Number(req.query.limit ?? 50);
      res.json({ tokens: tokens.slice(0, limit) });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  router.get("/discover/whales", async (req: Request, res: Response): Promise<void> => {
    try {
      const limit = Number(req.query.limit ?? 20);
      const signals: Array<Record<string, unknown>> = [];

      for (const tracker of ["whale", "smart_money", "degen"]) {
        try {
          const result = await onchainosSignal.activities(tracker);
          if (result.success && Array.isArray(result.data)) {
            for (const s of result.data as Array<Record<string, unknown>>) {
              signals.push({ ...s, tracker });
            }
          }
        } catch { /* tracker unavailable */ }
      }

      res.json({ signals: signals.slice(0, limit) });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  router.post("/discover/scan", async (_req: Request, res: Response): Promise<void> => {
    try {
      const scanner = agents["1"] as ScannerAgent | undefined;
      if (!scanner) { res.status(503).json({ error: "Scanner not available" }); return; }
      const tokens = await scanner.autonomousLoop();
      res.json({ triggered: true, tokensFound: tokens.length, tokens });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  // ── Pending ──

  router.get("/pending/analyze", (_req: Request, res: Response): void => {
    res.json({ tokens: pendingStore.getByStatus("awaiting_analyze") });
  });

  router.get("/pending/invest", (_req: Request, res: Response): void => {
    res.json({ tokens: pendingStore.getByStatus("awaiting_invest") });
  });

  router.post("/pending/analyze/:token/approve", async (req: Request, res: Response): Promise<void> => {
    try {
      const { token } = req.params;
      const analyst = agents["2"];
      if (!analyst) { res.status(503).json({ error: "Analyst not available" }); return; }
      const result = await analyst.execute("scan", { token });
      pendingStore.remove(token);
      res.json({ result });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  router.post("/pending/invest/:token/approve", async (req: Request, res: Response): Promise<void> => {
    try {
      const { token } = req.params;
      const pending = pendingStore.get(token);
      const executor = agents["3"];
      if (!executor) { res.status(503).json({ error: "Executor not available" }); return; }
      const amount = String(settings.get().invest.maxPerPosition);
      const result = await executor.execute("invest", {
        token,
        tokenSymbol: pending?.verdict?.tokenSymbol ?? token.slice(0, 8),
        riskScore: pending?.verdict?.riskScore ?? 0,
        amount,
      });
      pendingStore.remove(token);
      res.json({ result });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  router.delete("/pending/:token", (req: Request, res: Response): void => {
    const removed = pendingStore.remove(req.params.token);
    res.json({ removed });
  });
```

- [ ] **Step 3: Verify compiles**

```bash
cd /Users/pavelmackevic/Projects/agentra/server && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add server/src/router/service-router.ts
git commit -m "feat: add settings, discover, pending API endpoints

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Initialize settings in index.ts

**Files:**
- Modify: `server/src/index.ts`

- [ ] **Step 1: Add settings import and initialization**

Add import at top:

```typescript
import { settings } from "./settings.js";
```

Add after line `const app = express();` (around line 20):

```typescript
settings.load();
```

- [ ] **Step 2: Verify server starts**

```bash
cd /Users/pavelmackevic/Projects/agentra/server && npx tsx src/index.ts &
sleep 3 && curl -s http://localhost:3002/api/settings | head -20
kill %1
```

Expected: JSON with default settings.

- [ ] **Step 3: Commit**

```bash
git add server/src/index.ts
git commit -m "feat: initialize settings on server startup

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Test all new endpoints

- [ ] **Step 1: Test settings endpoints**

```bash
# Get settings
curl -s http://localhost:3002/api/settings | python3 -m json.tool | head -20

# Update settings
curl -s -X PATCH http://localhost:3002/api/settings \
  -H "Content-Type: application/json" \
  -d '{"discover":{"mode":"manual"}}' | python3 -m json.tool | head -5

# Verify persistence
curl -s http://localhost:3002/api/settings | python3 -m json.tool | grep mode | head -1
```

- [ ] **Step 2: Test discover endpoints**

```bash
# Feed
curl -s http://localhost:3002/api/discover/feed?limit=5 | python3 -m json.tool | head -20

# Whales
curl -s http://localhost:3002/api/discover/whales?limit=5 | python3 -m json.tool | head -20

# Manual scan trigger
curl -s -X POST http://localhost:3002/api/discover/scan | python3 -m json.tool | head -10
```

- [ ] **Step 3: Test pending endpoints**

```bash
# Set to manual mode
curl -s -X PATCH http://localhost:3002/api/settings \
  -H "Content-Type: application/json" \
  -d '{"analyze":{"mode":"manual"}}'

# Trigger scan — should queue tokens
curl -s -X POST http://localhost:3002/api/discover/scan | python3 -m json.tool | head -5

# Check pending
curl -s http://localhost:3002/api/pending/analyze | python3 -m json.tool | head -20

# Reset to auto
curl -s -X PATCH http://localhost:3002/api/settings \
  -H "Content-Type: application/json" \
  -d '{"analyze":{"mode":"auto"}}'
```

- [ ] **Step 4: Commit test verification**

```bash
git add -A
git commit -m "chore: verify settings + discover + pending endpoints working

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

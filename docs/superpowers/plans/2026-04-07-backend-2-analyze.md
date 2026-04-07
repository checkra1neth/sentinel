# Backend Part 2: Enhanced Analyze Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance Analyst agent with kline price-action analysis, bundle detection, whale context, and configurable risk threshold. Add `/api/analyze/:token` endpoint.

**Architecture:** Add 3 new data sources to existing deepScan pipeline in analyst-agent.ts. Add new risk factors to scoring. Add analyze API endpoints. Respect settings.analyze config.

**Tech Stack:** TypeScript, existing onchainos.ts wrapper, existing analyst-agent.ts

**Spec:** `docs/superpowers/specs/2026-04-07-sentinel-full-backend-spec.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `server/src/agents/analyst-agent.ts` | Modify | Add kline, bundle, whale context to deepScan |
| `server/src/router/service-router.ts` | Modify | Add /api/analyze endpoints |

---

### Task 1: Add kline analysis + bundle check + settings to Analyst

**Files:**
- Modify: `server/src/agents/analyst-agent.ts`

- [ ] **Step 1: Add new imports**

Add to existing imports at top of `analyst-agent.ts`:

```typescript
import { onchainosMarket } from "../lib/onchainos.js";
import { settings } from "../settings.js";
```

Note: `onchainosTrenches` is already imported. `onchainosMarket` is new.

- [ ] **Step 2: Add kline analysis after Source F (price action) block**

In the `deepScan()` method, find the comment `// --- Source F: Price action (pump & dump signals) ---` (around line 373). AFTER that entire block (after the `crash_24h` risk push around line 383), add this new kline block:

```typescript
    // --- Source H: Kline candle analysis (volatility + trend) ---
    if (settings.get().analyze.useKline) {
      try {
        const klineResult = onchainosMarket.kline(tokenAddress, config.chainId);
        if (klineResult.success && Array.isArray(klineResult.data)) {
          const candles = klineResult.data as Array<{ o: string; h: string; l: string; c: string; vol: string; ts: string }>;
          if (candles.length >= 3) {
            // Volatility: average high-low range across candles
            const ranges = candles.slice(0, 12).map((c) => {
              const high = Number(c.h);
              const low = Number(c.l);
              const mid = (high + low) / 2;
              return mid > 0 ? ((high - low) / mid) * 100 : 0;
            });
            const avgVolatility = ranges.reduce((s, r) => s + r, 0) / ranges.length;

            if (avgVolatility > 30) {
              risks.push(`kline_high_volatility(${avgVolatility.toFixed(1)}%)`);
              riskScore += 12;
            } else if (avgVolatility > 15) {
              risks.push(`kline_moderate_volatility(${avgVolatility.toFixed(1)}%)`);
              riskScore += 5;
            }

            // Trend: count consecutive red candles (close < open)
            let redStreak = 0;
            for (const c of candles.slice(0, 6)) {
              if (Number(c.c) < Number(c.o)) redStreak++;
              else break;
            }
            if (redStreak >= 4) {
              risks.push(`kline_downtrend(${redStreak}_red_candles)`);
              riskScore += 8;
            }

            // Volume: check if recent volume is suspiciously low
            const recentVol = candles.slice(0, 3).reduce((s, c) => s + Number(c.vol), 0);
            if (recentVol < 100 && !isLargeCap) {
              risks.push("kline_dead_volume");
              riskScore += 8;
            }
          }
        }
      } catch { /* kline unavailable */ }
    }

    // --- Source I: Bundle analysis (suspicious bundled txs) ---
    try {
      const bundleResult = onchainosTrenches.tokenBundleInfo(tokenAddress);
      if (bundleResult.success && bundleResult.data) {
        const bundle = bundleResult.data as Record<string, string>;
        const totalBundlers = Number(bundle.totalBundlers ?? 0);
        if (totalBundlers > 5) {
          risks.push(`bundled_launch(${totalBundlers}_bundlers)`);
          riskScore += 20;
        } else if (totalBundlers > 0) {
          risks.push(`minor_bundling(${totalBundlers}_bundlers)`);
          riskScore += 5;
        }
      }
    } catch { /* bundle info unavailable */ }
```

- [ ] **Step 3: Update classifyVerdict to use settings threshold**

Replace the `classifyVerdict` function (around line 49):

```typescript
function classifyVerdict(score: number): Verdict["verdict"] {
  const threshold = settings.get().analyze.riskThreshold;
  if (score <= Math.floor(threshold * 0.375)) return "SAFE";  // default: 15
  if (score <= threshold) return "CAUTION";                     // default: 40
  return "DANGEROUS";
}
```

- [ ] **Step 4: Verify server compiles and restarts**

The tsx watch should auto-restart. Check logs for compilation errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/pavelmackevic/Projects/agentra
git add server/src/agents/analyst-agent.ts
git commit -m "feat: add kline analysis, bundle check, configurable risk threshold to Analyst

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Add analyze API endpoints

**Files:**
- Modify: `server/src/router/service-router.ts`

- [ ] **Step 1: Add analyze endpoints**

In `service-router.ts`, add these endpoints BEFORE the `// ── Settings ──` section:

```typescript
  // ── Analyze ──

  router.get("/analyze/:token", async (req: Request, res: Response): Promise<void> => {
    try {
      const { token } = req.params;
      const analyst = agents["2"];
      if (!analyst) { res.status(503).json({ error: "Analyst not available" }); return; }

      // Check cache first
      const cached = verdictStore.getByToken(token);
      if (cached && !req.query.fresh) {
        res.json({ verdict: cached, cached: true });
        return;
      }

      const result = await analyst.execute("scan", { token });
      res.json({ verdict: result, cached: false });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  router.post("/analyze/:token/rescan", async (req: Request, res: Response): Promise<void> => {
    try {
      const { token } = req.params;
      const analyst = agents["2"];
      if (!analyst) { res.status(503).json({ error: "Analyst not available" }); return; }
      const result = await analyst.execute("scan", { token });
      res.json({ verdict: result });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });
```

- [ ] **Step 2: Commit**

```bash
cd /Users/pavelmackevic/Projects/agentra
git add server/src/router/service-router.ts
git commit -m "feat: add /api/analyze/:token and /api/analyze/:token/rescan endpoints

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Verify with real token scan

- [ ] **Step 1: Test analyze endpoint with a real token from discover feed**

```bash
# Get a token from discover feed
TOKEN=$(curl -s "http://localhost:3002/api/discover/feed?limit=1" | python3 -c "import sys,json; print(json.load(sys.stdin)['tokens'][0]['address'])")
echo "Testing token: $TOKEN"

# Run analysis
curl -s "http://localhost:3002/api/analyze/$TOKEN" | python3 -m json.tool | head -40
```

Expected: verdict JSON with riskScore, verdict label, risks array (should include kline_* and/or bundle_* entries if data available).

- [ ] **Step 2: Verify kline data is being used**

Check if any of the new risk factors appear in the risks array:
```bash
curl -s "http://localhost:3002/api/analyze/$TOKEN" | python3 -c "
import sys, json
d = json.load(sys.stdin)
v = d.get('verdict', d)
print(f'Score: {v.get(\"riskScore\")} Verdict: {v.get(\"verdict\")}')
risks = v.get('risks', [])
kline_risks = [r for r in risks if 'kline' in r or 'bundle' in r]
print(f'Kline/bundle risks: {kline_risks}')
print(f'All risks: {risks}')
"
```

- [ ] **Step 3: Commit verification**

```bash
git add -A
git commit -m "chore: verify analyze endpoints with real token data

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

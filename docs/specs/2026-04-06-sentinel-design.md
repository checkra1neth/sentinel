# Sentinel — Self-Funding Security Oracle on X Layer

## Overview

**Sentinel** is an autonomous security oracle on X Layer that monitors every new and trending token, publishes verifiable threat verdicts on-chain, sells detailed reports via x402, and self-funds by investing in Uniswap LP positions on tokens it verified as safe — skin in the game.

**Hackathon:** OKX Build X Hackathon 2026
**Deadline:** April 15, 2026, 23:59 UTC
**Arenas:** Both (X Layer Arena + Skills Arena)
**Repo:** ~/Projects/agentra (pivot from Agentra marketplace)
**GitHub:** https://github.com/westerq/agentra

## Narrative

> "Most security tools tell you what's dangerous. Sentinel puts its own money on what's safe. It's the first AI security oracle that self-funds by investing in tokens it verified — skin in the game, on X Layer."

## What Already Exists (Reusable)

- **Smart Contracts:** Registry, Escrow, Treasury — deployed on X Layer mainnet
- **3 Agentic Wallets:** Scanner (0x38c7b765), Analyst (0x874370bc), Executor (0x75003502)
- **OnchainOS wrapper:** onchainos.ts — all 14 skills
- **Uniswap helper:** uniswap.ts — getPool, getPoolInfo, encodeSwapCalldata
- **OKX API:** okx-api.ts — HMAC signing, REST calls
- **x402 flow:** x402-client.ts + x402-middleware.ts
- **Event bus:** WebSocket broadcaster
- **Base infrastructure:** config, types, cron, Express, ws

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     SENTINEL                              │
│                                                           │
│  ┌───────────┐   x402    ┌───────────┐                   │
│  │  SCANNER   │─────────▶│  ANALYST   │                   │
│  │  Wallet A  │ 0.10 USDT│  Wallet B  │◀── External x402  │
│  └─────┬─────┘           └─────┬─────┘    (0.50 USDT)    │
│        │                       │                          │
│   dex-trenches            security scan                   │
│   dex-signal              bytecode probe                  │
│   dex-token               dev reputation                  │
│                                │                          │
│                    ┌───────────▼──────────┐               │
│                    │  VerdictRegistry.sol  │               │
│                    │  (on-chain events)    │               │
│                    └───────────┬──────────┘               │
│                                │                          │
│                         if SAFE│                          │
│                                │ x402 (0.05 USDT)        │
│                                ▼                          │
│                    ┌───────────────────┐                  │
│                    │    EXECUTOR       │                  │
│                    │    Wallet C       │                  │
│                    │                   │                  │
│                    │  Find Uniswap pool│                  │
│                    │  Invest in LP     │                  │
│                    │  "Skin in game"   │                  │
│                    └───────────────────┘                  │
│                                                           │
│   2% of each x402 payment ──▶ Treasury                   │
└──────────────────────────────────────────────────────────┘
```

## Three Agents

### Scanner Agent (Wallet A: 0x38c7b765...)

**Role:** Discovers new and trending tokens on X Layer.

**Cron every 5 min:**
1. `onchainosTrenches.tokens(196, "NEW")` — new launches
2. `onchainosTrenches.tokens(196, "MIGRATED")` — recently migrated
3. `onchainosSignal.activities("smart_money", 196)` — smart money buys
4. `onchainosToken.hotTokens()` — trending tokens
5. Deduplication — skips already-scanned tokens (in-memory Set)
6. For each new token → pays Analyst via x402 (0.10 USDT)

**OnchainOS skills:** `dex-trenches`, `dex-signal`, `dex-token`

### Analyst Agent (Wallet B: 0x874370bc...)

**Role:** Deep security scanning and verdict publishing.

**Triggered via x402 from Scanner or external client:**
1. `onchainosSecurity.tokenScan(token, 196)` — honeypot, proxy, mint, tax
2. `onchainosToken.priceInfo(token)` — price, marketcap, volume
3. `onchainosToken.advancedInfo(token)` — holder concentration, dev stats
4. `onchainosTrenches.devInfo(token)` — dev reputation, rug history
5. Bytecode probe via viem — owner, pausable, UUPS
6. Risk scoring:
   - Honeypot: 50 pts
   - Rug history: 40 pts
   - Mint function: 20 pts
   - Proxy/upgradeable: 15 pts
   - High tax (>5%): 15 pts
   - Concentrated holders (top10 > 70%): 10 pts
7. Verdict: SAFE (0-15), CAUTION (16-40), DANGEROUS (41+)
8. Publish on-chain → VerdictRegistry.publishVerdict()
9. If SAFE → pay Executor via x402 (0.05 USDT) to invest

**OnchainOS skills:** `security`, `dex-token`, `dex-trenches`, `dex-market`

### Executor Agent (Wallet C: 0x75003502...)

**Role:** Invests in safe tokens — skin in the game.

**Triggered via x402 from Analyst (only for SAFE tokens):**
1. `onchainosToken.liquidity(token)` — find Uniswap pools
2. `getPool()` + `getPoolInfo()` — check TVL, liquidity depth
3. If pool exists and sufficient liquidity:
   - `onchainosSwap.execute()` — swap USDT → safe token
   - Add to Uniswap LP via `onchainosDefi.invest()`
4. Track LP positions
5. Periodic: collect LP fees via `onchainosDefi.collect()`

**OnchainOS skills:** `dex-swap`, `dex-token`, `onchain-gateway`, `defi-invest`, `defi-portfolio`, Uniswap AI skills

## x402 Payment Chain

```
Scanner (0.10 USDT) → Analyst    = deep scan
External (0.50 USDT) → Analyst   = detailed report
Analyst (0.05 USDT) → Executor   = invest in safe token
─────────────────────────────────
2% of each → Treasury → reinvest cycle
```

Each full cycle = minimum 4 on-chain transactions.
At cron every 5 min = ~1,150 tx/day.

## New Contract: VerdictRegistry.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract VerdictRegistry {
    event Verdict(
        address indexed token,
        uint8 riskScore,
        string verdict,
        bool isHoneypot,
        bool hasRug,
        uint256 timestamp
    );

    address public sentinel;

    modifier onlySentinel() {
        require(msg.sender == sentinel, "Not sentinel");
        _;
    }

    constructor(address _sentinel) {
        sentinel = _sentinel;
    }

    function publishVerdict(
        address token,
        uint8 riskScore,
        string calldata verdict,
        bool isHoneypot,
        bool hasRug
    ) external onlySentinel {
        emit Verdict(token, riskScore, verdict, isHoneypot, hasRug, block.timestamp);
    }
}
```

Simple event-emitting contract. Anyone can read verdicts from event logs. Minimal gas.

## API Endpoints

```
GET  /api/health                       — server status
GET  /api/verdicts                     — last 50 verdicts (free, public)
GET  /api/verdicts/:token              — detailed report (x402 paywall, 0.50 USDT)
POST /api/scan/:token                  — manual scan request (x402, 0.10 USDT)
GET  /api/agents                       — 3 agents with balances
GET  /api/portfolio                    — Executor LP positions in safe tokens
GET  /api/stats                        — tokens scanned, threats found, accuracy, revenue
WS   /api/events                       — real-time verdict + agent activity feed
```

## Web Dashboard — Single Page Threat Feed

One page, three sections top to bottom:

### Stats Bar (top)
Four cards: Tokens Scanned, Threats Found, LP P&L, Agents Active

### Verdict Feed (main, scrollable, real-time via WebSocket)
Each verdict = card with:
- Color badge: green (SAFE), yellow (CAUTION), red (DANGEROUS)
- Token name + truncated address
- Risk score
- Key findings (honeypot, mint, tax, rug history)
- If SAFE: "LP invested: X USDT in pool"
- Timestamp (relative: "2min ago")

New verdicts appear at top in real-time.

### Agent Activity (bottom, compact)
Monospace log of agent actions — same LiveFeed component from current codebase, filtered for Sentinel events.

## Claude Code Skill: `sentinel` (5 commands)

| Command | Description | x402? |
|---------|-------------|-------|
| `/sentinel scan <token>` | Scan specific token, get verdict | 0.10 USDT |
| `/sentinel feed` | Last 20 verdicts (safe/caution/dangerous) | Free |
| `/sentinel report <token>` | Detailed security report | 0.50 USDT |
| `/sentinel portfolio` | Executor LP positions, P&L per safe token | Free |
| `/sentinel status` | Stats: scanned, threats, accuracy, revenue | Free |

Dependencies: `okx/onchainos-skills`, `Uniswap/uniswap-ai`

## OnchainOS Skills Integration (14 skills)

| Skill | Used By | Purpose |
|-------|---------|---------|
| `okx-agentic-wallet` | All 3 | Wallet operations, signing |
| `okx-x402-payment` | All 3 | Inter-agent payments |
| `okx-dex-trenches` | Scanner | New token discovery, dev reputation |
| `okx-dex-signal` | Scanner | Smart money/whale tracking |
| `okx-dex-token` | Scanner, Analyst | Token metadata, holders, liquidity |
| `okx-dex-market` | Analyst | Prices, volume |
| `okx-security` | Analyst | Honeypot, proxy, tax detection |
| `okx-dex-swap` | Executor | Token swaps |
| `okx-onchain-gateway` | Executor | Gas, tx simulation, broadcast |
| `okx-defi-invest` | Executor | LP provision |
| `okx-defi-portfolio` | Executor | Position tracking |
| `okx-wallet-portfolio` | All 3 | Balance queries |
| `okx-dex-market` | Analyst | Price data for verdicts |
| `okx-audit-log` | All 3 | Transaction logging |
| Uniswap AI skills | Executor | Pool analytics, LP management |

## File Changes (What to Rewrite vs Reuse)

### Reuse as-is
- `server/src/lib/onchainos.ts`
- `server/src/lib/okx-api.ts`
- `server/src/lib/uniswap.ts`
- `server/src/wallet/agentic-wallet.ts`
- `server/src/payments/x402-client.ts`
- `server/src/events/event-bus.ts`
- `server/src/agents/base-agent.ts`
- `server/src/contracts/client.ts`
- `server/src/config.ts`
- `server/src/types.ts` (extend)
- `web/src/lib/ws.ts`
- `web/src/components/agent-card.tsx`

### Rewrite
- `server/src/agents/scanner-agent.ts` (new, replaces analyst-agent.ts)
- `server/src/agents/analyst-agent.ts` (rewrite — security focus)
- `server/src/agents/executor-agent.ts` (new, replaces trader-agent.ts)
- `server/src/agents/decision-engine.ts` (update — Sentinel flow)
- `server/src/router/service-router.ts` (update — verdict endpoints)
- `server/src/scheduler/cron-loop.ts` (update — Scanner cycle)
- `server/src/index.ts` (update — wire Sentinel agents)
- `web/src/app/page.tsx` (rewrite — Threat Feed)
- `web/src/components/verdict-card.tsx` (new)
- `web/src/components/threat-stats.tsx` (new)
- `web/src/components/live-feed.tsx` (update — verdict events)

### New
- `contracts/src/VerdictRegistry.sol`
- `contracts/test/VerdictRegistry.t.sol`
- `server/src/contracts/verdict-registry.ts`
- `skill/` — all 5 skill files rewritten

## Prize Strategy

| Prize | How Sentinel wins it |
|-------|---------------------|
| **Main X Layer Arena** | Unique concept, real utility, deep integration, complete product |
| **Best x402 application** | Every scan + every report = x402 payment between agents |
| **Best economy loop** | Scanner→Analyst→Executor→LP fees→Scanner (self-funding) |
| **Most active agent** | ~1,150 tx/day from verdicts + x402 + LP operations |
| **Best MCP integration** | 5 focused skill commands, 14 OnchainOS skills deep in code |
| **Main Skills Arena** | Reusable security skill any agent can install |
| **Best data analyst** | Uses onchain data (signals, trenches, security) for autonomous decisions |
| **Best Uniswap integration** | Executor invests in LP pools of vetted tokens |

## Implementation Priority

### Phase 1 (Days 1-3): Core
1. VerdictRegistry.sol — deploy on X Layer
2. Scanner Agent — token discovery cron
3. Analyst Agent — security scan + on-chain verdict
4. Executor Agent — LP investment on safe tokens
5. Decision Engine — Scanner→Analyst→Executor flow
6. Wire everything in index.ts

### Phase 2 (Days 4-5): API + Web
7. Verdict endpoints + x402 paywall
8. Threat Feed dashboard (single page)
9. Verdict cards + stats + live feed

### Phase 3 (Days 6-7): Skill + Polish
10. Claude Code skill — 5 commands
11. Tests
12. README rewrite for Sentinel concept
13. AGENTS.md update

### Phase 4 (Days 8-9): Submit
14. Demo video
15. Post on X
16. Google Form submission

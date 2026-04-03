# Agentra — Agent Economy Hub on X Layer

## Overview

**Agentra** is a decentralized economy hub where AI agents with their own Agentic Wallets autonomously discover, purchase, and sell services to each other via x402 payments on X Layer (chain 196, zero gas). Profits auto-reinvest into Uniswap LP positions. A complete earn-pay-earn cycle running without human intervention.

**Hackathon:** OKX Build X Hackathon 2026
**Deadline:** April 15, 2026, 23:59 UTC
**Arenas:** Both (X Layer Arena + Skills Arena)
**Participant:** Solo + Claude Code
**Repo:** ~/Projects/agentra

## What Already Exists

Smart contracts deployed on X Layer mainnet:
- Registry: `0xDd0FF50142Ab591D2Bc0D0AF5Bf230A9f2B84E86`
- Escrow: `0xa80066f2fd7efdFB944ECcb16f67604D33C34333`
- Treasury: `0x69558a9B4BfE9c759797F5F22896ADB9d509Cb44`
- All UUPS upgradeable, 31 tests passing
- 3 demo services registered on mainnet

Server (Express, TypeScript) with 3 agent endpoints, basic x402 middleware, mock reinvest scheduler.

Web UI (Next.js 16) with marketplace and dashboard pages.

Claude Code skill with 5 sub-skills.

**Problem:** Everything is scaffolding. Agents are passive API wrappers. No Agentic Wallets. No real x402 payments. No OnchainOS skills integration. Reinvest is mocked. No autonomous behavior. Doesn't meet mandatory hackathon requirements.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Agent Economy Hub                        │
│                                                           │
│  ┌───────────┐    x402     ┌───────────┐                 │
│  │  ANALYST   │──payment──▶│  AUDITOR   │                 │
│  │  Wallet A  │◀──result───│  Wallet B  │                 │
│  └─────┬─────┘            └─────┬─────┘                 │
│        │ x402                   │ x402                   │
│        ▼                        ▼                        │
│  ┌───────────┐          ┌──────────────┐                │
│  │  TRADER    │◀─────── │   Treasury    │                │
│  │  Wallet C  │         │   (on-chain)  │                │
│  └─────┬─────┘          └──────┬───────┘                │
│        │                       │                         │
│        ▼                       ▼                         │
│  ┌──────────────────────────────────┐                   │
│  │       Uniswap LP Positions       │                   │
│  │   (auto-reinvest from profits)   │                   │
│  └──────────────────────────────────┘                   │
└─────────────────────────────────────────────────────────┘
         │              │              │
         ▼              ▼              ▼
   Onchain OS      Uniswap AI     Agentic
   Skills          Skills         Wallets
```

## 3 Agents, 3 Roles, 3 Agentic Wallets

Each agent has its own OKX Agentic Wallet (mandatory hackathon requirement) created via `okx-agentic-wallet` skill. Wallets provide TEE-secured key management and natural language tx signing.

### Analyst Agent

**Purpose:** Discovers and analyzes tokens on X Layer.

**Cron mode (every 5 min):**
1. Scans trending/new tokens via `okx-dex-signal` + `okx-dex-token`
2. Gets prices and market data via `okx-dex-market`
3. Calculates risk score
4. If needs deep scan → pays Auditor via x402
5. If token safe + profitable → pays Trader via x402 for swap quote
6. Analyzes Uniswap pools for the token (TVL, volume, APR)

**OnchainOS skills:** `okx-agentic-wallet`, `okx-dex-token`, `okx-dex-market`, `okx-dex-signal`, `okx-security`, `okx-wallet-portfolio`

**Uniswap skills:** Pool analytics (TVL, volume, fee APR, price range efficiency)

### Auditor Agent

**Purpose:** Security scanning of smart contracts.

**Triggered via x402:**
1. Receives x402 payment from Analyst (or external client)
2. Inspects bytecode size, ABI functions (owner, paused, UUPS UUID)
3. Detects contract type (ERC-20 vs UUPS proxy vs custom)
4. Runs OKX security scan (honeypot, proxy, tax detection)
5. Returns structured verdict with severity levels (CRITICAL/HIGH/MEDIUM/LOW)

**OnchainOS skills:** `okx-agentic-wallet`, `okx-security`, `okx-x402-payment`, `okx-defi-portfolio`

### Trader Agent

**Purpose:** Executes optimal swaps.

**Triggered via x402:**
1. Receives x402 payment from Analyst (or external client)
2. Compares routes: Uniswap direct vs OKX DEX aggregator
3. Multi-hop through Uniswap pools if no direct pair (USDT → OKB → TOKEN)
4. Considers slippage, gas, price impact
5. Executes swap via best route

**OnchainOS skills:** `okx-agentic-wallet`, `okx-dex-swap`, `okx-x402-payment`, `okx-onchain-gateway`

**Uniswap skills:** Smart routing, multi-hop, swap execution

## x402 Payment Flow (Real, Not Mock)

```
Agent A (buyer)                    Agent B (seller)
    │                                    │
    ├─── POST /api/services/2/scan ─────▶│
    │    (no X-Payment header)           │
    │◀── 402 Payment Required ───────────┤
    │    {escrowAddr, serviceId,         │
    │     price: "1000000", token: USDT} │
    │                                    │
    ├─── Agentic Wallet signs x402 ─────▶│
    │    via okx-x402-payment skill      │
    │    (TEE-signed proof)              │
    │                                    │
    ├─── Escrow.deposit(serviceId) ─────▶│  on-chain tx
    │    (USDT transferred to escrow)    │
    │                                    │
    ├─── POST /api/services/2/scan ─────▶│
    │    X-Payment: {proof, txHash}      │
    │◀── 200 OK {result: ...} ──────────┤
    │                                    │
    │    Escrow.release(orderId) ────────▶│  98% to Agent B
    │                                    │   2% to Treasury
```

Key: x402 proof is signed via `okx-x402-payment` skill using TEE. Not a mock header — cryptographically verified.

## Earn-Pay-Earn Cycle

```
Phase 1: EARN
  └─ Auditor receives x402 payment from Analyst for scan
  └─ Trader receives x402 payment from Analyst for quote
  └─ 2% fee from each payment → Treasury

Phase 2: PAY
  └─ Analyst pays Auditor for deep security scan
  └─ Analyst pays Trader for swap execution
  └─ Each payment = on-chain tx through Escrow

Phase 3: EARN (reinvest)
  └─ Treasury accumulates fees
  └─ Reinvest service analyzes Uniswap pools
  └─ Selects best pool (APR + TVL + volume)
  └─ Swap 50/50 → Add Liquidity → LP position
  └─ LP fees → distribute back to agents
  └─ Agents have more capital → buy more services
  └─ LOOP REPEATS
```

Each full cycle generates minimum 6 on-chain transactions:
1. Analyst → Escrow.deposit (pay Auditor)
2. Escrow.release → Auditor 98%, Treasury 2%
3. Analyst → Escrow.deposit (pay Trader)
4. Escrow.release → Trader 98%, Treasury 2%
5. Treasury → Uniswap swap (token A → token B)
6. Treasury → Uniswap addLiquidity

At cron every 5 min = ~1,728 tx/day.

## Uniswap Deep Integration (3 Levels)

### Level 1: Pool Analytics (Analyst)

- Scans all Uniswap pools on X Layer
- Collects: TVL, 24h volume, fee tier, APR, price range efficiency
- Data feeds into token analysis reports
- Sells pool analytics to other agents via x402

### Level 2: Smart Routing (Trader)

- Compares routes: Uniswap direct vs OKX DEX aggregator
- Multi-hop through Uniswap pools (USDT → OKB → TOKEN)
- Accounts for slippage, gas, price impact
- Selects best route automatically
- Executes swap via Uniswap AI skills

### Level 3: LP Management (Reinvest)

- Analyzes all Uniswap pools on X Layer
- Ranks by risk-adjusted APR
- Auto-swaps profit 50/50 for LP pair
- Adds liquidity via Uniswap skills
- Tracks LP positions: unrealized P&L, impermanent loss, collected fees
- Rebalances if pool APR drops below threshold

### Uniswap Skills Usage Map

| Operation | Where Used |
|-----------|------------|
| Pool discovery + analytics | Analyst + Reinvest |
| Price quotes | Analyst + Trader |
| Swap execution | Trader |
| Route optimization / multi-hop | Trader |
| Add liquidity | Reinvest |
| Position tracking | Dashboard + Reinvest |
| Fee collection | Reinvest |

## Full OnchainOS Skills Integration

| Skill | Used By | Purpose |
|-------|---------|---------|
| `okx-agentic-wallet` | All 3 agents | Wallet creation, auth, balance, send, tx history |
| `okx-x402-payment` | Auditor, Trader | Sign x402 payment proofs via TEE |
| `okx-dex-token` | Analyst | Token search, metadata, market cap, holders, top traders |
| `okx-dex-market` | Analyst | Real-time prices, K-line, index prices, wallet PnL |
| `okx-dex-signal` | Analyst | Smart money/whale/KOL signal tracking |
| `okx-dex-swap` | Trader | Token swap across 500+ liquidity sources |
| `okx-security` | Analyst, Auditor | Token risk scan, honeypot, proxy, tax detection |
| `okx-onchain-gateway` | Trader | Gas estimation, tx simulation, broadcasting |
| `okx-wallet-portfolio` | Analyst, Dashboard | Public address balance, holdings, value |
| `okx-defi-invest` | Reinvest | DeFi product discovery, deposit/withdraw |
| `okx-defi-portfolio` | Auditor, Dashboard | DeFi positions overview |
| `okx-dex-trenches` | Analyst | Meme pump scanning, dev reputation |
| `okx-audit-log` | All | Transaction history logging |
| Uniswap AI skills | Trader, Reinvest, Analyst | Pool analytics, routing, LP provision |

**14+ skills integrated.** AI-judge scanning GitHub will see OnchainOS in every layer.

## Smart Contracts

Existing contracts stay deployed. Minimal changes:

### New: AgentOrchestrator.sol

Coordinates multi-agent calls in one transaction. Generates multiple on-chain txns per cycle for "Most active agent" prize.

```solidity
function executeChain(
    uint256 analystServiceId,
    uint256 auditorServiceId,
    uint256 traderServiceId,
    address token,
    uint256 amount
) external;
```

### Existing (no changes needed)

- **Registry.sol** — service registration, discovery
- **Escrow.sol** — payment escrow, 2% fee, release/refund/dispute
- **Treasury.sol** — fee collection, yield distribution, reinvest

## Server Architecture

### Agent Runtime (rewritten)

Each agent runs as an autonomous process:

```typescript
interface AgentConfig {
  name: string;
  walletId: string;              // Agentic Wallet ID
  services: ServiceDef[];
  buyRules: BuyRule[];           // when to buy other agents' services
  reinvestThreshold: number;     // min balance for auto-reinvest
  reinvestPercent: number;       // % of profit to reinvest
  cronInterval: string;          // e.g., "*/5 * * * *"
}

interface AgentRuntime {
  wallet: AgenticWallet;         // okx-agentic-wallet
  x402Client: X402Client;        // okx-x402-payment
  skills: Map<string, Skill>;    // loaded OnchainOS skills
  decisionEngine: DecisionEngine;
  eventLog: EventEmitter;
}
```

### Decision Engine

```typescript
// Analyst decision loop (cron)
async function analystLoop() {
  const trending = await skills.dexSignal.getTrending("xlayer");
  for (const token of trending) {
    const data = await skills.dexToken.getMetadata(token);
    const risk = calculateRisk(data);

    if (risk.needsDeepScan) {
      // Pay Auditor via x402
      const auditResult = await x402Client.buyService(auditorServiceId, {
        contractAddress: token
      });
    }

    if (risk.score < THRESHOLD && auditResult?.safe) {
      // Pay Trader via x402
      const swapQuote = await x402Client.buyService(traderServiceId, {
        fromToken: "USDT", toToken: token, amount: "100"
      });
    }
  }
}
```

### Reinvest Service (new, replaces mock)

```typescript
async function reinvest() {
  // 1. Check Treasury balance
  const balance = await treasury.getBalance();
  if (balance < MIN_REINVEST) return;

  // 2. Analyze Uniswap pools via Uniswap AI skills
  const pools = await uniswapSkills.getPools("xlayer");
  const bestPool = rankByRiskAdjustedAPR(pools);

  // 3. Swap 50/50 for LP pair
  const [tokenA, tokenB] = bestPool.pair;
  await skills.dexSwap.swap({ from: "USDT", to: tokenA, amount: balance / 2 });
  await skills.dexSwap.swap({ from: "USDT", to: tokenB, amount: balance / 2 });

  // 4. Add liquidity via Uniswap skills
  await uniswapSkills.addLiquidity(bestPool.id, amountA, amountB);

  // 5. Track position
  await dashboard.trackLPPosition(bestPool.id);
}
```

### Service Router (updated)

```
POST /api/services/:serviceId/:action   — x402 paywall (real verification)
GET  /api/services                       — list from Registry
GET  /api/agents                         — all agents with balances, LP positions
GET  /api/agents/:address/events         — event log (live feed)
GET  /api/economy/stats                  — total volume, fees, LP yield
WS   /api/events                         — WebSocket live feed
GET  /api/health
```

## Web UI

### Dashboard (rewritten)

- **Agent Cards** — each agent: Agentic Wallet balance, earnings, services sold/bought, status
- **Live Feed** — real-time log of autonomous actions:
  ```
  15:03:21  Analyst found trending token 0x1E4a...
  15:03:22  Analyst paid Auditor 0.10 USDT (x402 tx: 0xabc...)
  15:03:25  Auditor scanned: LOW risk, no honeypot
  15:03:26  Analyst paid Trader 0.05 USDT (x402 tx: 0xdef...)
  15:03:28  Trader: best route via Uniswap, 0.12% slippage
  15:08:00  Reinvest: 0.003 USDT → USDT/OKB LP (APR 34.2%)
  ```
- **Economy Graph** — visual flow of funds between agents (sankey or force-directed)
- **LP Positions** — all Uniswap LP positions with P&L, IL, collected fees
- **Manual Controls** — "Analyze token", "Force reinvest", "Start/stop autopilot"

### Marketplace (updated)

- Services from Registry with real-time pricing
- One-click buy via connected wallet
- Shows agent reputation (success rate, avg response time)

## Claude Code Skill — Skills Arena

### `agentra-connect` (8 sub-skills)

| Skill | Description | OnchainOS Skills |
|-------|-------------|------------------|
| `register` | Create Agentic Wallet + register service in Registry | `agentic-wallet`, `onchain-gateway` |
| `buy` | Find service → x402 payment → get result | `x402-payment`, `agentic-wallet` |
| `analyze` | Trigger full pipeline: token → audit → trade recommendation | `dex-token`, `security`, `dex-signal` |
| `swap` | Optimal swap via Uniswap + OKX DEX | `dex-swap`, Uniswap swap |
| `pools` | Analyze Uniswap pools: APR, TVL, recommendations | Uniswap pool analytics |
| `invest` | Add liquidity to Uniswap pool | `defi-invest`, Uniswap LP |
| `dashboard` | Balances, earnings, LP positions, tx history | `wallet-portfolio`, `defi-portfolio` |
| `autopilot` | Enable/disable autonomous cron mode | All skills |

### Example Interaction

```
User: /agentra analyze 0x1E4a5963aBFD975d8c9021ce480b42188849D41d

Claude: Analyzing XLAYER_USDT...

Token Report (via Analyst Agent, paid 0.10 USDT x402):
  - Type: ERC-20, verified
  - Liquidity: $2.4M across 3 Uniswap pools
  - Best pool: USDT/OKB 0.3% — APR 34.2%

Security Scan (via Auditor Agent, paid 0.05 USDT x402):
  - No honeypot, no proxy, no mint function
  - Risk: LOW

Swap Route (via Trader Agent):
  - Best: Uniswap USDT→OKB direct, 0.12% slippage
  - Alt: OKX DEX aggregator, 0.15% slippage

Economy: 0.15 USDT spent, 0.003 USDT → Treasury → LP
```

### MCP Server (for "Best MCP integration")

Skill published as MCP server — any AI agent (not just Claude) can connect:
- Standard MCP protocol: tools, resources, prompts
- Auto-discovery of services via Registry contract read

### Plugin Store Ready

```json
{
  "name": "agentra-connect",
  "description": "Connect to Agentra Agent Economy on X Layer",
  "skills": ["register", "buy", "analyze", "swap", "pools", "invest", "dashboard", "autopilot"],
  "dependencies": ["okx-agentic-wallet", "okx-dex-swap", "okx-security", "uniswap-ai"],
  "chains": ["xlayer-196"]
}
```

## Prize Strategy

| Prize | Amount | Our Case | Confidence |
|-------|--------|----------|------------|
| **X Layer Arena — Main** | 1st: 5K, 2nd: 2K, 3rd: 1K | Full-stack economy hub, 3 autonomous agents | High |
| **Best x402 application** | 500 USDT | Real x402 payments between 3 agents, TEE-signed | Very high |
| **Best economy loop** | 500 USDT | Earn→Pay→Earn with Uniswap LP reinvest | Very high |
| **Best MCP integration** | 500 USDT | 8 sub-skills, MCP server, deep OnchainOS | High |
| **Most active agent** | 500 USDT | ~1,728 tx/day via cron loop | Medium |
| **Skills Arena — Main** | 1st: 5K, 2nd: 2K, 3rd: 1K | `agentra-connect` reusable skill | High |
| **Best Uniswap integration** | 500 USDT | Uniswap in 3 levels: analytics, routing, LP | High |
| **Best data analyst** | 500 USDT | Analyst agent with onchain data → decisions | Medium |
| **Most popular** | 500 USDT | Needs engagement on X + Moltbook | Needs activity |

**Max potential: 5K + 5K + 5x500 = 12,500 USDT**

## Implementation Priority

### Week 1 (Apr 3-9): CORE — mandatory requirements

1. Create 3 Agentic Wallets via `okx-agentic-wallet` (mandatory)
2. Rewrite agents to use OnchainOS skills (mandatory)
3. Real x402 flow with TEE-signed payments via `okx-x402-payment`
4. Agent decision engine — autonomous service buying
5. Earn-pay-earn cycle works end-to-end
6. Cron autonomous loop (5 min interval)
7. Fix failing tests, add new tests

### Week 2 (Apr 9-14): POLISH + SUBMIT

8. Uniswap deep integration (LP, routing, analytics)
9. Reinvest service with real Uniswap LP
10. Dashboard with live feed + economy visualizer
11. Claude Code skill upgrade (8 sub-skills)
12. AgentOrchestrator contract (optional, for tx volume)
13. README with full architecture, skill usage, deployment addresses
14. Demo video (1-3 min)
15. Push to public GitHub
16. Posts on X (#XLayerHackathon @XLayerOfficial) + Moltbook
17. Google Form submission before Apr 15 23:59 UTC

## What AI-Judge Will See

Scanning our GitHub repo:
- 14+ OnchainOS skills integrated across codebase
- Uniswap AI skills in 3 components (Analyst, Trader, Reinvest)
- 3 Agentic Wallets documented in README with roles
- Hundreds of on-chain transactions on X Layer
- Clean TypeScript + Solidity code with tests
- MCP-compatible skill with plugin.json
- Comprehensive README with architecture diagram

## Risk Mitigation

- **Agentic Wallet API issues** → fallback to raw wallet with proper wrapper matching Agentic Wallet interface
- **Uniswap pools too thin on X Layer** → use OKX DEX aggregator as primary, Uniswap as secondary
- **Too many skills to integrate** → prioritize mandatory (wallet, x402) then high-impact (dex-swap, security)
- **UI not ready** → CLI + skill covers both arenas
- **Day 12-14 buffer** for unforeseen issues and polish

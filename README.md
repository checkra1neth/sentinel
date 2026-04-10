# Sentinel — Autonomous Security Oracle on X Layer

> *A three-agent system that discovers tokens, publishes on-chain security verdicts, and invests its own capital in what it rates safe. If the verdict is wrong, the system loses money.*

---

## Judge Quick Reference

### Scoring Criteria — Evidence Map

| Criterion (25% each) | Where to find it in this project |
|----------------------|----------------------------------|
| **Onchain OS / Uniswap integration & innovation** | 11 Onchain OS skill categories used (wallet, swap, security, token, signal, market, defi, portfolio, trenches, gateway, payment). Uniswap v3 LP positions as financial accountability mechanism. [→ Section 5](#5-onchain-os-skills-used) |
| **X Layer ecosystem integration** | All 3 agents deployed on X Layer (chain 196). All 4 smart contracts on X Layer. USDT payment token. Zero-gas-fee execution for autonomous cron loops. [→ Section 7](#7-deployed-contracts--addresses) |
| **AI interactive experience** | Natural language chat interface: users send USDT to a TEE wallet and interact via text commands (`swap 10 USDT to ETH`, `scan 0x1234...`). All swaps are security-gated — DANGEROUS tokens blocked automatically. [→ Section 8](#8-working-mechanics) |
| **Product completeness** | Full stack: 4 smart contracts (Foundry, 31 tests), TypeScript server with 3 autonomous agents, Next.js 16 web UI, cron-based autonomous pipeline, x402 paywalled API. [→ Section 9](#9-product-completeness) |

### Special Prize Eligibility

| Special Prize | Evidence |
|--------------|----------|
| **Best x402 application** | x402 is used at two levels: (1) external API paywall (0.10 USDT/scan, 0.50 USDT/report), (2) inter-agent payments — the Decision Engine literally buys Analyst scans and Executor investments via x402. [→ Section 6](#6-x402-machine-payments) |
| **Best economy loop** | Earn (x402 scan fees) → Pay (on-chain verdict publishing gas) → Earn (Uniswap v3 LP fees from SAFE tokens). Self-sustaining with no subsidies. [→ Section 4](#4-earn-pay-earn-economic-loop) |
| **Most active agent** | Three agents fire on cron (every 5–15 min): Scanner queries Onchain OS, Analyst publishes verdicts on-chain, Executor opens/manages LP positions. Every action goes through Onchain OS API. |
| **Best Uniswap integration** | Executor agent uses Uniswap v3 to back every SAFE verdict with a real LP position. Uses `defi search`, `defi deposit`, `defi redeem`, `defi positions` + direct pool contract reads (sqrtPriceX96, tick parameters). |
| **Best MCP integration** | All 11 Onchain OS skill categories called via MCP-compatible CLI. ERC-8004 agent identity + reputation on-chain. |

### Mandatory Requirements Checklist

- [x] Part of project built on X Layer (all contracts on chain 196)
- [x] Agentic Wallet as onchain identity (3 TEE wallets, roles documented in [AGENTS.md](AGENTS.md))
- [x] Core module from Onchain OS skills (11 skill categories used)
- [x] Public GitHub repo with README
- [x] Project intro, architecture, deployment addresses, skill usage, working mechanics, team

---

## Table of Contents

1. [Project Introduction](#1-project-introduction)
2. [Architecture](#2-architecture)
3. [Three-Agent Pipeline](#3-three-agent-pipeline)
4. [Earn-Pay-Earn Economic Loop](#4-earn-pay-earn-economic-loop)
5. [Onchain OS Skills Used](#5-onchain-os-skills-used)
6. [x402 Machine Payments](#6-x402-machine-payments)
7. [Deployed Contracts & Addresses](#7-deployed-contracts--addresses)
8. [Working Mechanics](#8-working-mechanics)
9. [Product Completeness](#9-product-completeness)
10. [Innovations](#10-innovations)
11. [Team](#11-team)
12. [Project Positioning in X Layer Ecosystem](#12-project-positioning-in-x-layer-ecosystem)
13. [How to Run](#13-how-to-run)

---

## 1. Project Introduction

Most security tools publish risk scores with no accountability. Sentinel changes that: the **Executor agent locks real USDT into Uniswap v3 LP positions for every token rated SAFE**. If the analysis is wrong, Sentinel loses money. Aligned incentives at the protocol level.

The system runs autonomously, 24/7, on X Layer:
- **Scanner** discovers new tokens via smart money signals and trending activity
- **Analyst** performs deep security analysis across 5 dimensions and publishes verdicts on-chain
- **Executor** invests in tokens rated SAFE via Uniswap v3 LP; exits if a verdict is downgraded

External users and AI agents access the oracle via x402 micropayments (0.10 USDT per scan, 0.50 USDT per full report). The revenue covers gas costs, and surplus goes into the LP portfolio — completing a self-sustaining economic loop.

---

## 2. Architecture

```
                    ┌───────────────────────────────────────────────────────────┐
                    │                   Sentinel System                          │
                    │                                                            │
  X Layer           │  ┌────────────┐  candidates   ┌────────────┐              │
  new tokens ──────►│  │  Scanner   │──────────────►│  Analyst   │              │
                    │  │            │               │            │              │
  x402 manual ─────►│  │ 0x38c7...  │               │ 0x8743...  │              │
  scan requests     │  │            │               │            │              │
                    │  │ Discovers: │               │ Checks:    │              │
                    │  │ - new list.│               │ - bytecode │              │
                    │  │ - smart $  │               │ - honeypot │              │
                    │  │ - trending │               │ - tax/mint │              │
                    │  └────────────┘               │ - holders  │              │
                    │        │                      │ - liquidity│              │
                    │   ERC-8183                    └─────┬──────┘              │
                    │   job protocol                      │                     │
                    │        │                   SAFE verdict only              │
                    │        │                            ▼                     │
                    │        │                   ┌────────────────┐             │
                    │        │                   │    Executor    │             │
                    │        │                   │  0x7500...     │             │
                    │        │                   │                │             │
                    │        │                   │  Invests in    │             │
                    │        │                   │  SAFE tokens   │             │
                    │        │                   │  via Uniswap   │             │
                    │        │                   │  v3 LP         │             │
                    │        │                   └────────┬───────┘             │
                    │        │                            │                     │
                    │        ▼                            ▼                     │
                    │  ┌──────────────┐       ┌──────────────────┐              │
                    │  │  Verdict     │       │  Uniswap v3 LP   │              │
                    │  │  Registry    │       │  Positions       │              │
                    │  │  (on-chain)  │       │  (on-chain)      │              │
                    │  └──────────────┘       └──────────────────┘              │
                    │                                                            │
                    │  ┌──────────────────────────────────────────────────┐     │
                    │  │              Chat Interface (Web UI)              │     │
                    │  │  Per-user TEE wallet  │  Natural language chat   │     │
                    │  │  Swap / Scan / DeFi   │  Security-gated swaps   │     │
                    │  └──────────────────────────────────────────────────┘     │
                    └───────────────────────────────────────────────────────────┘
                             │               │              │
                             ▼               ▼              ▼
                       Onchain OS       Uniswap v3      GoPlus / DeFiLlama
                       (11 skills)      (X Layer)       (external oracle data)
```

---

## 3. Three-Agent Pipeline

Each agent has a dedicated, TEE-secured Agentic Wallet and communicates with others via the ERC-8183 job protocol.

```
┌──────────────────────────────────────────────────────────────────────┐
│  Agent          │  Wallet                        │  Onchain OS Skills │
├──────────────────────────────────────────────────────────────────────┤
│  Scanner        │  0x38c7b7651b42cd5d0e9fe1909f  │  tracker, signal,  │
│  (Discovery)    │  52b6fd8e044db2                │  token, trenches   │
│                 │  accountId: b4473b86-...        │                    │
│                 │  Cron: every 15 minutes         │                    │
├──────────────────────────────────────────────────────────────────────┤
│  Analyst        │  0x874370bc9352bfa4b39c22fa82b  │  security, token,  │
│  (Security)     │  89f4ca952ce03                  │  market, gateway,  │
│                 │  accountId: 54fd24b8-...        │  wallet, payment   │
│                 │  Cron: every 5 minutes          │                    │
├──────────────────────────────────────────────────────────────────────┤
│  Executor       │  0x7500350249e155fdacb27dc0a12  │  swap, defi,       │
│  (Investment)   │  f5198b158ee00                  │  portfolio, wallet │
│                 │  accountId: 8ff99bf5-...        │                    │
│                 │  Cron: every 4 hours            │                    │
└──────────────────────────────────────────────────────────────────────┘
```

**ERC-8183 Job Flow (agent-to-agent):**

```
Decision Engine creates job for Analyst:
  createJob(analystWallet, 0.10 USDT) → jobId=7
  fundJob(7) → USDT locked in SentinelCommerce contract
    → Analyst runs 5-stage security analysis
  submitResult(7, keccak256(verdict)) → result hash on-chain
  completeJob(7) → USDT released to Analyst

If verdict = SAFE:
  createJob(executorWallet, amount) → jobId=8
  fundJob(8) → USDT locked
    → Executor opens Uniswap v3 LP position
  submitResult(8, keccak256(txHash))
  completeJob(8) → USDT released to Executor
```

**ERC-8004 Agent Identity & Reputation:**

Each agent is registered on the ERC-8004 Identity Registry (`0x8004A169...`) with a metadata URI. After every completed job, a reputation signal is submitted to the ERC-8004 Reputation Registry (`0x8004BAa1...`), building a public on-chain track record.

---

## 4. Earn-Pay-Earn Economic Loop

```
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│   EARN              │     │   PAY               │     │   EARN              │
│                     │     │                     │     │                     │
│  External users     │     │  Sentinel covers    │     │  Executor opens     │
│  and AI agents pay  │     │  operations:        │     │  Uniswap v3 LP      │
│  via x402:          │     │  - On-chain verdict │     │  positions for      │
│                     │ ──► │    publishing gas   │ ──► │  SAFE tokens.       │
│  0.10 USDT / scan   │     │  - ERC-8183 inter-  │     │                     │
│  0.50 USDT / report │     │    agent job fees   │     │  Good verdicts →    │
│                     │     │  - ERC-8004 rep.    │     │  LP fees earned.    │
│  Revenue → Analyst  │     │    signal gas       │     │  Bad verdicts →     │
│  wallet             │     │                     │     │  impermanent loss.  │
└─────────────────────┘     └─────────────────────┘     └─────────────────────┘
        ▲                                                         │
        └─────────────────── surplus capital reinvested ─────────┘
```

The loop is self-correcting: wrong verdicts reduce the portfolio, reducing capital available for future investments, creating financial pressure to improve analysis accuracy. No external subsidy. No token issuance.

---

## 5. Onchain OS Skills Used

Sentinel calls **11 Onchain OS skill categories** across all three agents. Every call goes through the `onchainos` CLI wrapper in `server/src/lib/onchainos.ts`.

| Skill Category | Commands Used | Used By | Purpose |
|---------------|---------------|---------|---------|
| **wallet** | `balance`, `send`, `contract-call`, `sign-message`, `switch`, `status`, `history` | All 3 agents | Identity, transfers, contract interactions, TEE signing |
| **payment** | `x402-pay` | Analyst, Decision Engine | Sign x402 payment proofs for inter-agent and external payments |
| **security** | `token-scan`, `tx-scan`, `dapp-scan`, `sig-scan`, `approvals` | Analyst | Token honeypot/tax/proxy detection; pre-execution tx simulation |
| **swap** | `chains`, `liquidity`, `approve`, `quote`, `execute` | Executor, Chat | DEX swaps on X Layer for LP entry/exit and user chat commands |
| **token** | `info`, `price-info`, `holders`, `hot-tokens`, `advanced-info`, `top-trader`, `trades`, `cluster-overview`, `cluster-top-holders` | Scanner, Analyst | Token metadata, holder concentration, cluster analysis |
| **signal/tracker** | `activities`, `list`, `leaderboard-list` | Scanner | Smart money activity tracking, whale signals |
| **market** | `price`, `prices`, `kline`, `index` | Analyst | Real-time pricing for report enrichment |
| **defi** | `search`, `detail`, `prepare`, `calculate-entry`, `deposit`, `redeem`, `claim`, `positions`, `position-detail` | Executor | Uniswap v3 pool lookup, LP entry/exit, position tracking |
| **portfolio** | `total-value`, `all-balances`, `overview`, `dex-history`, `recent-pnl`, `token-pnl` | Executor, Chat | Wallet balances, LP PnL, DEX trade history |
| **trenches** | `tokens`, `token-details`, `token-dev-info`, `similar-tokens`, `token-bundle-info`, `aped-wallet` | Scanner, Analyst | New meme token discovery, dev rug history, bundle/sniper detection |
| **gateway** | `gas`, `gas-limit`, `simulate`, `broadcast`, `orders` | Analyst | Pre-execution simulation, gas estimation, tx broadcasting |

### Uniswap Skills

| Skill | Usage |
|-------|-------|
| `defi search` | Find Uniswap v3 pools for SAFE-rated tokens |
| `defi prepare` | Get V3 tick parameters for LP position entry |
| `defi calculate-entry` | Compute exact token amounts for LP entry |
| `defi deposit` | Generate calldata to add Uniswap v3 liquidity |
| `defi redeem` | Generate calldata to exit LP position |
| `defi positions` | Track open LP positions and accumulated fees |

---

## 6. x402 Machine Payments

x402 is used at **two levels** simultaneously:

### Level 1 — External API Paywall

```
External caller (AI agent or user)        Sentinel API
         │                                     │
         │  GET /api/verdicts/:token            │
         │ ────────────────────────────────────►│
         │                                     │
         │  HTTP 402 + payment requirements    │
         │ ◄────────────────────────────────── │
         │                                     │
         │  Sign x402 via onchainos payment    │
         │  x402-pay (EIP-3009 auth)           │
         │ ────────────────────────────────────►│
         │                                     │  verify + settle
         │  200 OK + full security report      │
         │ ◄────────────────────────────────── │
```

| Endpoint | Price | Description |
|----------|-------|-------------|
| `POST /api/scan/:token` | 0.10 USDT | Deep security scan |
| `GET /api/verdicts/:token` | 0.50 USDT | Full report with LP data |
| `GET /api/verdicts` | Free | Last 50 verdicts |
| `GET /api/portfolio` | Free | Executor positions |

### Level 2 — Inter-Agent Payments

The Decision Engine buys services from other agents using the same x402 protocol internally:

```typescript
// Decision Engine buys an Analyst scan:
const scanResult = await this.services.analyst.x402.buyService(
  this.services.analyst.serviceId,  // service registered in Registry contract
  "scan",
  { token: address },
);

// If SAFE, buys Executor investment:
const investResult = await this.services.executor.x402.buyService(
  this.services.executor.serviceId,
  "invest",
  { token: address, amount },
);
```

This means every agent service is accessible both internally (agent-to-agent) and externally (human/AI to agent) at the same price, using the same payment flow.

---

## 7. Deployed Contracts & Addresses

All contracts deployed on **X Layer, Chain ID 196**.

| Contract | Address | Purpose |
|----------|---------|---------|
| **Registry** | `0xDd0FF50142Ab591D2Bc0D0AF5Bf230A9f2B84E86` | Service registration — agents register endpoints + price |
| **Escrow** | `0xa80066f2fd7efdFB944ECcb16f67604D33C34333` | Trustless USDT escrow (2% fee, 1-hour timeout) |
| **Treasury** | `0x69558a9B4BfE9c759797F5F22896ADB9d509Cb44` | Protocol fee collection and yield distribution |
| **SentinelCommerce** | post-deploy | ERC-8183 agent-to-agent job contract |
| **VerdictRegistry** | post-deploy | Immutable on-chain verdict log |
| **ERC-8004 Identity Registry** | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` | Agent identity registration |
| **ERC-8004 Reputation Registry** | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` | Per-job reputation signals |
| **Uniswap v3 Router** | `0x7078c4537C04c2b2E52ddBa06074dBdACF23cA15` | Swap execution and LP management |
| **USDT** | `0x1E4a5963aBFD975d8c9021ce480b42188849D41d` | Payment token (6 decimals) |

Explorer: [okx.com/xlayer/explorer](https://www.okx.com/xlayer/explorer)

### Agent Wallets (X Layer)

| Agent | Address | Role |
|-------|---------|------|
| Scanner (Guardian) | `0x38c7b7651b42cd5d0e9fe1909f52b6fd8e044db2` | Token discovery |
| Analyst (Sentinel) | `0x874370bc9352bfa4b39c22fa82b89f4ca952ce03` | Security analysis + verdict publishing |
| Executor (Operator) | `0x7500350249e155fdacb27dc0a12f5198b158ee00` | LP investment in SAFE tokens |

---

## 8. Working Mechanics

### Autonomous Pipeline (background, every 15 min)

```
1. Scanner runs onchainos memepump tokens --chain 196
   + onchainos tracker activities --tracker-type smart_money --chain 196
   + onchainos signal list --chain 196
   → Produces: list of candidate token addresses

2. Decision Engine receives candidates
   → Creates ERC-8183 job for each token
   → Buys Analyst scan via x402 (0.10 USDT from agent wallet)

3. Analyst runs 5-stage analysis:
   Stage 1: bytecode inspection via viem publicClient.getBytecode()
   Stage 2: onchainos security token-scan + GoPlus API
   Stage 3: Uniswap v3 pool lookup via getPool() + sqrtPriceX96 decode
   Stage 4: onchainos token cluster-overview + cluster-top-holders
   Stage 5: weighted risk score → SAFE (0-30) / CAUTION (31-70) / DANGEROUS (71-100)
   → onchainos wallet contract-call → publishVerdict() on VerdictRegistry
   → onchainos gateway broadcast → tx on X Layer
   → ERC-8004 reputation signal submitted

4. If SAFE:
   Decision Engine creates job for Executor (auto mode)
   Executor: onchainos defi search --chain 196 --product-group DEX_POOL
   → Finds best Uniswap v3 pool
   → onchainos defi prepare + defi calculate-entry
   → onchainos defi deposit → calldata
   → onchainos wallet contract-call → LP position opened on-chain
   → Position tracked via onchainos defi positions
```

### User Chat Interface

```
1. User connects MetaMask wallet
2. Server creates TEE wallet via Onchain OS:
   POST /api/wallet/create { walletAddress: "0xABC..." }
   → Returns: agentWallet address (displayed in header bar)

3. User sends USDT to agentWallet on X Layer

4. User types commands in chat:

   "scan 0x1234...abcd"
   → Security analysis → verdict + risk score displayed

   "swap 10 USDT to ETH"
   → Security scan on ETH (auto)
   → If SAFE: onchainos swap quote + swap execute
   → If DANGEROUS (risk > 70): BLOCKED — user informed

   "portfolio"
   → onchainos defi positions + portfolio total-value

   "deposit 20 USDT to Aave"
   → onchainos defi search --platform "Aave"
   → onchainos defi deposit calldata → tx signed by TEE wallet
```

### Security-Gated Swaps

All swap requests in chat run a security pre-check on the destination token before executing. Risk score > 70 blocks the swap entirely:

```
User: "swap 5 USDT to SCAM"
System: runs onchainos security token-scan on SCAM token
        → riskScore = 89, isHoneypot = true
Response: "BLOCKED: Token is DANGEROUS (risk 89/100). Honeypot detected."
```

---

## 9. Product Completeness

### Smart Contracts — `contracts/`
- 4 Solidity contracts (Solidity 0.8.24, Foundry)
- All UUPS-upgradeable via OpenZeppelin
- **31 tests passing** (`forge test`)
- Deployed on X Layer mainnet

### Server — `server/src/`
- TypeScript, Express
- 3 autonomous agents with dedicated Onchain OS wallets
- Cron scheduler: Scanner (15 min), Analyst (5 min), Executor (4 hours)
- x402 middleware for paywalled endpoints
- ERC-8183 job manager (in-memory + on-chain sync)
- ERC-8004 agent registration + reputation submission
- WebSocket event bus for live UI updates
- Settings panel: auto/manual mode per pipeline stage, configurable at runtime

### Web UI — `web/`
- Next.js 16, React 19, wagmi v3, TailwindCSS 4
- Chat interface with per-user TEE wallet
- Security screener with 5-tab token analysis (Overview, Holders, Traders, Security, Dev Intel)
- Swap panel with on-chain routing via Onchain OS
- DeFi explore & deposit (Uniswap v3 LP)
- Approval manager (revoke ERC-20 approvals)
- Live verdict feed (WebSocket)

### Full Endpoint List

| Endpoint | Auth | Description |
|----------|------|-------------|
| `GET /api/verdicts` | Free | Recent 50 verdicts |
| `GET /api/verdicts/:token` | 0.50 USDT x402 | Full security report |
| `POST /api/scan/:token` | 0.10 USDT x402 | Trigger manual scan |
| `GET /api/portfolio` | Free | Executor LP positions |
| `GET /api/status` | Free | Aggregate stats |
| `GET /api/agents` | Free | Agent wallet balances |
| `POST /api/chat/message` | TEE wallet balance | Natural language commands |
| `POST /api/wallet/create` | None | Provision user TEE wallet |
| `GET /api/wallet/balance` | None | Check TEE wallet balance |
| `GET /api/swap/quote` | Free | Get swap quote |
| `POST /api/swap/calldata` | TEE wallet | Generate swap calldata |
| `GET /api/token/:address` | Free | Token info |
| `GET /api/defi/search` | Free | DeFi pool search |
| `POST /api/defi/deposit` | TEE wallet | Generate LP deposit calldata |

---

## 10. Innovations

| Innovation | Description |
|-----------|-------------|
| **Skin-in-the-game oracle** | Every SAFE verdict is backed by a real Uniswap v3 LP position. Wrong = financial loss. First DeFi security oracle with genuine financial accountability. |
| **x402 at two levels** | Same payment protocol used for external API access AND internal agent-to-agent job purchases. Any AI agent can call Sentinel by paying 0.10 USDT. |
| **ERC-8004 on-chain identity** | All 3 agents registered on Identity Registry with verifiable metadata URIs. On-chain agent track record via reputation signals after each job. |
| **ERC-8183 job commerce** | Agents hire each other via trustless on-chain job contracts. Scanner pays Analyst, Analyst pays Executor. No direct calls, no trust required. |
| **5-stage analysis pipeline** | Bytecode inspection → security APIs → Uniswap v3 pool health → holder cluster analysis → weighted verdict. Runs on 10+ chains. |
| **Per-user TEE wallet** | Each chat user gets a dedicated Onchain OS TEE wallet bound to their MetaMask address. No MetaMask signature per transaction — TEE handles all on-chain ops. |
| **Security-gated swaps** | Every swap request runs a token security scan first. DANGEROUS tokens are blocked before any signing or gas is spent. |
| **Configurable autonomy** | Auto/manual mode for both analysis and investment stages. Switch at runtime without restart. Human-in-the-loop when needed. |
| **Self-sustaining economics** | x402 revenue → gas costs → LP yield → reinvestment. No external subsidy. No token issuance. The system earns what it needs to operate. |
| **Immutable on-chain verdicts** | VerdictRegistry stores all verdicts permanently on X Layer. Can be used by other protocols as a security primitive (e.g., refuse DANGEROUS tokens as collateral). |

---

## 11. Team

| Member | Role |
|--------|------|
| Pavel Mackevich | Solo developer — full-stack (Solidity, TypeScript, Next.js) |
| Claude Code | AI pair programmer |

---

## 12. Project Positioning in X Layer Ecosystem

Sentinel fills a gap that currently doesn't exist on X Layer: **an autonomous, accountable security layer** for the on-chain economy.

**What Sentinel adds to X Layer:**

1. **Trust infrastructure** — The VerdictRegistry is a public good. Any X Layer protocol can query Sentinel verdicts on-chain before accepting a token (lending, AMMs, launchpads).

2. **Active liquidity** — Executor continuously adds Uniswap v3 LP positions to SAFE tokens on X Layer. More liquidity → better prices → more trading activity → more fee revenue for the chain.

3. **Onchain OS showcase** — 11 skill categories used. Sentinel is a reference implementation of what a production-grade Onchain OS integration looks like: wallet management, security scanning, DeFi operations, payment flows, and market data — all in one system.

4. **x402 adoption** — Sentinel is one of the first projects to use x402 for both human-facing and agent-to-agent payments on X Layer. It demonstrates the payment primitive in a real production context.

5. **ERC-8004 adoption** — All three agents are registered on the X Layer ERC-8004 registry, contributing to the emerging agent identity ecosystem on the chain.

---

## 13. How to Run

### Prerequisites
- Node.js 22+
- Foundry
- OKX API keys with Onchain OS access
- `npm install -g onchainos` (Onchain OS CLI)

### Smart Contracts

```bash
cd contracts
cp .env.example .env    # Set XLAYER_RPC_URL, DEPLOYER_PRIVATE_KEY
forge install
forge test              # 31 tests
forge script script/Deploy.s.sol --rpc-url $XLAYER_RPC_URL --broadcast
```

### Server

```bash
cd server
cp .env.example .env
npm install
npm run dev             # http://localhost:3002
```

Required `.env` variables:

```env
XLAYER_RPC_URL=https://rpc.xlayer.tech
CHAIN_ID=196

# Deployed contract addresses
REGISTRY_ADDRESS=0xDd0FF50142Ab591D2Bc0D0AF5Bf230A9f2B84E86
ESCROW_ADDRESS=0xa80066f2fd7efdFB944ECcb16f67604D33C34333
TREASURY_ADDRESS=0x69558a9B4BfE9c759797F5F22896ADB9d509Cb44
USDT_ADDRESS=0x1E4a5963aBFD975d8c9021ce480b42188849D41d

# OKX API
OKX_API_KEY=...
OKX_SECRET_KEY=...
OKX_PASSPHRASE=...

# Agent wallet UUIDs (Onchain OS account IDs)
ANALYST_ACCOUNT_ID=54fd24b8-2ad8-438a-8e56-64100a62a05a
AUDITOR_ACCOUNT_ID=b4473b86-ce53-423b-9744-0d58762e9026
TRADER_ACCOUNT_ID=8ff99bf5-4b4a-48d3-8957-7c6d9fa9debf

# Agent wallet addresses
ANALYST_WALLET_ADDRESS=0x874370bc9352bfa4b39c22fa82b89f4ca952ce03
AUDITOR_WALLET_ADDRESS=0x38c7b7651b42cd5d0e9fe1909f52b6fd8e044db2
TRADER_WALLET_ADDRESS=0x7500350249e155fdacb27dc0a12f5198b158ee00

# Cron schedules
SCANNER_CRON="*/15 * * * *"
ANALYST_CRON="*/5 * * * *"
EXECUTOR_CRON="0 */4 * * *"
```

### Web UI

```bash
cd web
npm install
npm run dev             # http://localhost:3001
```

### Project Structure

```
sentinel/
├── contracts/                    # Solidity (Foundry) — 4 contracts, 31 tests
│   └── src/
│       ├── Registry.sol          # UUPS service registry
│       ├── Escrow.sol            # UUPS payment escrow
│       ├── Treasury.sol          # UUPS fee collection
│       ├── SentinelCommerce.sol  # ERC-8183 agent job contract
│       └── VerdictRegistry.sol   # Immutable verdict log
│
├── server/src/
│   ├── agents/                   # Scanner, Analyst, Executor, Decision Engine
│   ├── erc8004/                  # Agent identity registration + reputation
│   ├── erc8183/                  # Agent-to-agent job manager
│   ├── chat/                     # NLP command parser + chat router
│   ├── payments/                 # x402 client (inter-agent payments)
│   ├── wallet/                   # TEE wallet wrapper (Onchain OS)
│   ├── router/                   # REST API + x402 paywalled endpoints
│   ├── scheduler/                # Cron loops (Scanner, Executor, manage)
│   └── lib/                      # Onchain OS, Uniswap v3, DeFiLlama, DexScreener
│
└── web/src/
    ├── app/                      # Next.js 16 pages
    └── components/               # 40+ components (chat, swap, screener, DeFi)
```

# Sentinel Agent Identities

This document describes the three autonomous AI agents that power the Sentinel security oracle. Each agent has a dedicated OKX Agentic Wallet (TEE-secured) and a specific role in the pipeline: discover, analyze, invest.

## Agent Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        Sentinel Pipeline                                  │
│                                                                          │
│   ┌────────────┐   candidates   ┌────────────┐   SAFE tokens  ┌───────┐ │
│   │  Scanner   │ ─────────────► │  Analyst   │ ─────────────► │Execut.│ │
│   │            │                │            │                │       │ │
│   │  Discover  │                │  Analyze   │                │Invest │ │
│   │  new tokens│                │  & Verdict │                │in LP  │ │
│   │            │                │            │                │       │ │
│   │  0x38c7... │                │  0x8743... │                │0x7500.│ │
│   └────────────┘                └──────┬─────┘                └───┬───┘ │
│                                        │                          │     │
│                                        ▼                          ▼     │
│                                 VerdictRegistry            Uniswap v3   │
│                                  (on-chain)               LP Positions  │
│                                                                          │
│   Revenue: x402 scan/report fees ──► Operations ──► LP yield            │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Scanner Agent

**Role:** Token discovery and monitoring. The Scanner is the eyes of Sentinel -- it watches X Layer for new tokens, trending activity, and smart money movements.

**Wallet:** `0x38c7b7651b42cd5d0e9fe1909f52b6fd8e044db2`

### OnchainOS Skills Used

| Skill | Usage |
|-------|-------|
| `okx-agentic-wallet` | Wallet identity and balance checks |
| `okx-dex-token` | New token detection, metadata, liquidity data |
| `okx-dex-signal` | Smart money activity tracking, on-chain signals |
| `okx-dex-trenches` | Trending tokens and narratives on X Layer |
| `okx-dex-market` | Real-time pricing for candidate filtering |
| `okx-audit-log` | Log discovery events for transparency |

### Autonomous Loop

Runs on a configurable cron schedule (default: every 15 minutes):
1. Queries `okx-dex-trenches` for newly listed tokens on X Layer
2. Fetches smart money signals via `okx-dex-signal`
3. Filters candidates by minimum liquidity threshold and age
4. Passes qualifying tokens to the Analyst for deep analysis

### What It Does NOT Do

- Does not publish verdicts (that's the Analyst)
- Does not invest (that's the Executor)
- Does not accept x402 payments (it's purely internal)

---

## Analyst Agent

**Role:** Deep security analysis and on-chain verdict publishing. The Analyst is the brain of Sentinel -- it performs comprehensive security scans and publishes immutable verdicts to the VerdictRegistry.

**Wallet:** `0x874370bc9352bfa4b39c22fa82b89f4ca952ce03`

### OnchainOS Skills Used

| Skill | Usage |
|-------|-------|
| `okx-agentic-wallet` | Wallet identity, transaction signing for verdict publishing |
| `okx-x402-payment` | Accepting x402 payments for scan (0.10 USDT) and report (0.50 USDT) endpoints |
| `okx-security` | Token security scanning (honeypot, mintable, tax, proxy detection) |
| `okx-onchain-gateway` | Direct RPC calls to probe contract bytecode, read storage, publish verdicts |
| `okx-dex-token` | Token metadata and liquidity for report enrichment |
| `okx-dex-market` | Real-time pricing and market data |
| `okx-wallet-portfolio` | Holder concentration analysis |
| `okx-audit-log` | Log all verdicts and scans |

### Uniswap Integration

- Checks Uniswap v3 pool existence and liquidity for analyzed tokens
- Reads `sqrtPriceX96` and fee tier data to assess liquidity health
- Includes pool data in detailed reports

### Analysis Pipeline

1. **Bytecode check** -- Verifies the address is a contract and measures bytecode size
2. **Interface probing** -- Calls `owner()`, `paused()`, `name()`, `symbol()`, `decimals()`, `totalSupply()`, `proxiableUUID()` to classify contract type
3. **Security scan** -- Queries OnchainOS `security token-scan` for honeypot, mintable, tax, and proxy patterns
4. **Liquidity analysis** -- Checks Uniswap v3 pool TVL, holder concentration, and top wallet percentages
5. **Verdict** -- Computes aggregate risk score (0-100) and publishes verdict: SAFE / CAUTION / DANGEROUS
6. **On-chain publish** -- Writes verdict to VerdictRegistry with report hash

### Verdict Levels

| Level | Risk Score | Meaning | Executor Action |
|-------|-----------|---------|-----------------|
| SAFE | 0-30 | No significant risks detected | Invests via LP |
| CAUTION | 31-70 | Some risks, proceed with care | Does not invest |
| DANGEROUS | 71-100 | Significant risks (honeypot, rugpull indicators) | Does not invest |

### Revenue

- Manual scan requests: 0.10 USDT via x402
- Detailed report requests: 0.50 USDT via x402
- Both endpoints are publicly accessible through the API

---

## Executor Agent

**Role:** LP investment in safe tokens. The Executor is the wallet of Sentinel -- it puts real capital into tokens the Analyst rates SAFE. This is where "skin in the game" becomes literal.

**Wallet:** `0x7500350249e155fdacb27dc0a12f5198b158ee00`

### OnchainOS Skills Used

| Skill | Usage |
|-------|-------|
| `okx-agentic-wallet` | Wallet identity, transaction signing for LP operations |
| `okx-dex-swap` | Token swaps for LP entry/exit positions |
| `okx-dex-token` | Token price and metadata for position sizing |
| `okx-dex-market` | Real-time pricing for PnL calculation |
| `okx-defi-invest` | Search Uniswap v3 pools, add/remove liquidity |
| `okx-defi-portfolio` | Track LP positions, fees earned, and DeFi holdings |
| `okx-wallet-portfolio` | Aggregate wallet balance across all tokens |
| `okx-onchain-gateway` | Direct pool contract reads for position management |
| `okx-audit-log` | Log investment decisions and outcomes |

### Uniswap Integration

- Queries Uniswap v3 Factory for pool existence for SAFE-rated tokens
- Analyzes pool metrics (TVL, volume, fee tier) to select optimal positions
- Adds concentrated liquidity via `liquidity-planner` skill
- Monitors position PnL and collects accumulated fees
- Exits positions if a token's verdict is later downgraded

### Investment Rules

1. Only invests in tokens with verdict = SAFE (risk score 0-30)
2. Maximum position size: configurable per-token cap
3. Diversification: spreads capital across multiple SAFE tokens
4. Auto-exit: closes position if the Analyst downgrades the verdict
5. Fee collection: periodically claims LP fees as additional revenue

### Risk Exposure

The Executor's portfolio is the scoreboard for Sentinel's accuracy:
- **Good verdicts** = profitable LP positions, fee accumulation
- **Bad verdicts** = impermanent loss, potential rug pull losses
- Portfolio PnL is publicly visible via `/sentinel portfolio`

---

## Wallet Architecture

Each agent wraps an `AgenticWallet` instance that interfaces with OKX OnchainOS:

```typescript
AgenticWallet {
  accountId: string      // OnchainOS account index
  address: Address       // X Layer wallet address
  role: string           // "scanner" | "analyst" | "executor"

  getBalance(token?)     // Native or ERC-20 balance
  send(amount, to)       // Transfer tokens
  contractCall(to, data) // Arbitrary contract interaction
  signMessage(msg)       // Message signing
  signX402Payment(...)   // x402 payment authorization
}
```

The `createAgentWallets()` factory reads wallet configuration from environment variables and instantiates all three wallets at server startup.

---

## Pipeline Orchestration

The pipeline runs autonomously:

1. **Scanner discovers tokens** -- Feeds candidates to Analyst every 15 minutes
2. **Analyst runs deep scan** -- Security analysis, liquidity check, holder analysis
3. **Analyst publishes verdict** -- Writes to VerdictRegistry on-chain
4. **Executor checks new verdicts** -- Looks for SAFE-rated tokens with adequate liquidity
5. **Executor invests** -- Opens Uniswap v3 LP positions in SAFE tokens
6. **Executor monitors** -- Tracks PnL, collects fees, exits on downgrades

Manual scan and report requests via x402 bypass step 1 (Scanner) and go directly to the Analyst.

---

## Configuration

Environment variables for agent wallets:

```env
# Scanner
SCANNER_ACCOUNT_ID=0
SCANNER_WALLET_ADDRESS=0x38c7b7651b42cd5d0e9fe1909f52b6fd8e044db2

# Analyst
ANALYST_ACCOUNT_ID=1
ANALYST_WALLET_ADDRESS=0x874370bc9352bfa4b39c22fa82b89f4ca952ce03

# Executor
EXECUTOR_ACCOUNT_ID=2
EXECUTOR_WALLET_ADDRESS=0x7500350249e155fdacb27dc0a12f5198b158ee00
```

Cron schedules:
```env
SCANNER_CRON="*/15 * * * *"       # Scanner discovery loop (default: every 15 min)
ANALYST_CRON="*/5 * * * *"        # Analyst verdict processing (default: every 5 min)
EXECUTOR_CRON="0 */4 * * *"       # Executor investment check (default: every 4 hours)
```

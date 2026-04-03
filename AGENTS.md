# Agentra Agent Identities

This document describes the three autonomous AI agents that power the Agentra economy. Each agent has a dedicated OKX Agentic Wallet (TEE-secured), registers paid services on the on-chain Registry, and participates in the Earn-Pay-Earn cycle via x402 micropayments on X Layer.

## Agent Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                         Agent Economy                                │
│                                                                      │
│   ┌────────────┐       x402        ┌────────────┐                    │
│   │  Analyst   │ ────────────────► │  Auditor   │                    │
│   │  Agent     │  buys quick-scan  │  Agent     │                    │
│   │            │ ◄──────────────── │            │                    │
│   │  Earns:    │   returns scan    │  Earns:    │                    │
│   │  0.50 USDT │                   │  0.20 USDT │                    │
│   └─────┬──────┘                   └────────────┘                    │
│         │                                                            │
│         │ x402 (buys swap quote)                                     │
│         ▼                                                            │
│   ┌────────────┐                                                     │
│   │  Trader    │                                                     │
│   │  Agent     │ ◄── Earns from external clients needing swaps       │
│   │            │                                                     │
│   │  Earns:    │                                                     │
│   │  0.30 USDT │                                                     │
│   └────────────┘                                                     │
│                                                                      │
│   All profits above threshold ──► Uniswap v3 LP (OKB/USDT)          │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Analyst Agent

**Role:** Token discovery, risk analysis, and trending signal aggregation.

**Service:** `token-report` -- produces a comprehensive analysis including price data, security scan, Uniswap v3 liquidity check, and a risk-scored recommendation.

**Price:** 0.50 USDT per report

**Wallet:** Dedicated Agentic Wallet (account index configured via `ANALYST_ACCOUNT_ID`)

### OnchainOS Skills Used

| Skill | Usage |
|-------|-------|
| `okx-agentic-wallet` | Wallet identity, balance checks, transaction signing |
| `okx-x402-payment` | Signing x402 payment proofs when buying Auditor/Trader services |
| `okx-dex-token` | Token price info, advanced metadata, liquidity data, hot token discovery |
| `okx-security` | Token risk scanning (honeypot, mintable, proxy, tax detection) |
| `okx-dex-signal` | Smart money activity tracking for trending token discovery |
| `okx-dex-market` | Real-time pricing and market data |

### Uniswap Integration

- Checks Uniswap v3 pool existence and liquidity for analyzed tokens
- Reads `sqrtPriceX96` and fee tier data from pool contracts

### Autonomous Loop

Runs on a configurable cron schedule (default: every 30 minutes):
1. Fetches hot/trending tokens via `okx-dex-signal` and `okx-dex-token`
2. Generates token reports for the top 3 trending tokens
3. Emits events for the Decision Engine to act on

### Service Buying

- **Buys from Auditor:** Deep security scans when a token's initial risk score warrants further investigation
- **Buys from Trader:** Swap quotes when a token is classified as OPPORTUNITY

---

## Auditor Agent

**Role:** Smart contract and token security analysis.

**Service:** `quick-scan` -- probes on-chain bytecode, detects security patterns, queries OKX security APIs, and returns severity-rated issues.

**Price:** 0.20 USDT per scan

**Wallet:** Dedicated Agentic Wallet (account index configured via `AUDITOR_ACCOUNT_ID`)

### OnchainOS Skills Used

| Skill | Usage |
|-------|-------|
| `okx-agentic-wallet` | Wallet identity and transaction signing |
| `okx-x402-payment` | Accepting x402 payments from Analyst and external clients |
| `okx-security` | Token security scanning (honeypot, mintable, tax, open source checks) |
| `okx-onchain-gateway` | Direct RPC calls to probe contract bytecode, read storage, call view functions |

### Analysis Pipeline

1. **Bytecode check** -- Verifies the address is a contract (not an EOA) and measures bytecode size
2. **Interface probing** -- Calls `owner()`, `paused()`, `name()`, `symbol()`, `decimals()`, `totalSupply()`, `proxiableUUID()` to classify contract type (ERC-20, UUPS Proxy, etc.)
3. **Security scan** -- Queries OnchainOS `security token-scan` with fallback to OKX direct API
4. **Issue compilation** -- Aggregates findings into severity-rated issues (CRITICAL, HIGH, MEDIUM, LOW, INFO)
5. **Verdict** -- Computes aggregate risk score and returns CLEAN / LOW_RISK / CAUTION / DANGEROUS

### Service Buying

- **Does not buy** from other agents -- the Auditor is a pure service provider

### Earnings

- Primary income from Analyst agent buying quick-scans during token analysis
- External clients can also purchase scans directly via the x402-gated API

---

## Trader Agent

**Role:** Optimal swap execution across multiple DEX routes.

**Service:** `swap` -- compares routes across Uniswap v3, OKX DEX aggregator, and OnchainOS swap, picks the best price, and optionally executes the trade.

**Price:** 0.30 USDT per swap quote (execution optional)

**Wallet:** Dedicated Agentic Wallet (account index configured via `TRADER_ACCOUNT_ID`)

### OnchainOS Skills Used

| Skill | Usage |
|-------|-------|
| `okx-agentic-wallet` | Wallet identity, transaction signing, contract calls for swap execution |
| `okx-x402-payment` | Accepting x402 payments from Analyst and external clients |
| `okx-dex-swap` | DEX aggregation quotes and execution on X Layer |
| `okx-dex-token` | Token address resolution and metadata |
| `okx-dex-market` | Price feeds for slippage calculation |

### Uniswap Integration

- Queries Uniswap v3 Factory for direct pool availability
- Reads pool state (`sqrtPriceX96`, liquidity, fee) to estimate output amounts
- Encodes `exactInputSingle` calldata for Uniswap Router execution
- Compares Uniswap v3 output against OKX DEX and OnchainOS quotes

### Route Comparison

The Trader agent evaluates up to 3 routes for every swap:

| Source | Method |
|--------|--------|
| **Uniswap v3** | Direct pool query, price estimation from sqrtPriceX96 |
| **OKX DEX** | Aggregator API quote with gas estimation |
| **OnchainOS** | Built-in swap module quote |

Routes are sorted by output amount (descending). The best route is returned to the client, with alternative routes included for transparency.

### Service Buying

- **Buys from Analyst:** Token intelligence reports before executing large swaps

---

## Wallet Architecture

Each agent wraps an `AgenticWallet` instance that interfaces with OKX OnchainOS:

```typescript
AgenticWallet {
  accountId: string      // OnchainOS account index
  address: Address       // X Layer wallet address
  role: string           // "analyst" | "auditor" | "trader"

  getBalance(token?)     // Native or ERC-20 balance
  send(amount, to)       // Transfer tokens
  contractCall(to, data) // Arbitrary contract interaction
  signMessage(msg)       // Message signing
  signX402Payment(...)   // x402 payment authorization
}
```

The `createAgentWallets()` factory reads wallet configuration from environment variables and instantiates all three wallets at server startup.

---

## Decision Engine

The `DecisionEngine` orchestrates inter-agent service buying:

1. **Analyst discovers a token** -- Decision Engine evaluates whether the risk score warrants buying an Auditor scan
2. **Auditor returns scan** -- If the token passes security checks, Decision Engine considers buying a Trader swap quote
3. **Trader returns quote** -- If the route is favorable, the swap can be executed

All inter-agent purchases flow through the same x402 payment protocol used by external clients -- agents are first-class participants in their own marketplace.

---

## Configuration

Environment variables for agent wallets:

```env
# Analyst
ANALYST_ACCOUNT_ID=0
ANALYST_WALLET_ADDRESS=0x38c7b7651b42cd5d0e9fe1909f52b6fd8e044db2

# Auditor
AUDITOR_ACCOUNT_ID=1
AUDITOR_WALLET_ADDRESS=0x874370bc9352bfa4b39c22fa82b89f4ca952ce03

# Trader
TRADER_ACCOUNT_ID=2
TRADER_WALLET_ADDRESS=0x7500350249e155fdacb27dc0a12f5198b158ee00
```

Cron schedules:
```env
ANALYST_CRON="*/30 * * * *"      # Analyst autonomous loop (default: every 30 min)
REINVEST_CRON="0 */6 * * *"      # Treasury reinvestment check (default: every 6 hours)
```

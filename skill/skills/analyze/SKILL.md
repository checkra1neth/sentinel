---
name: agentra-analyze
description: Run a full token analysis pipeline across multiple Agentra agents -- fundamentals, security audit, and trade signal
model: sonnet
version: 1.0.0
---

# /agentra analyze

Trigger the full Agentra analysis pipeline for any token on X Layer. This chains three specialized agents -- Analyst, Auditor, and Trader -- each paid via x402, to produce a comprehensive report with security scores, on-chain metrics, and a trade recommendation.

## Usage

```
/agentra analyze <token-address> <chain> [--agents <list>] [--budget <max-usdt>]
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `token-address` | Yes | Token contract address (`0x...`) |
| `chain` | Yes | Chain name: `xlayer`, `ethereum`, `bsc`, etc. |
| `--agents` | No | Comma-separated agent types to include (default: `analyst,auditor,trader`) |
| `--budget` | No | Maximum USDT to spend across all agents (default: no limit) |

### Examples

```bash
# Full pipeline: analyst + auditor + trader
/agentra analyze 0xDEF...5678 xlayer

# Only analyst and auditor (skip trade signal)
/agentra analyze 0xDEF...5678 xlayer --agents analyst,auditor

# Limit total spend to 3 USDT
/agentra analyze 0xDEF...5678 xlayer --budget 3.00
```

## Step-by-Step Instructions

### Step 1: Gather On-Chain Token Data

Before calling any agents, collect baseline data using OnchainOS skills:

**OnchainOS commands:**

```
# Token metadata (name, symbol, decimals, supply)
onchainos dex-token info --chain xlayer --token 0xDEF...5678

# Security score and risk flags
onchainos security check --chain xlayer --token 0xDEF...5678

# Market data (price, volume, liquidity)
onchainos dex-market price --chain xlayer --token 0xDEF...5678

# On-chain signals (momentum, whale activity)
onchainos dex-signal scan --chain xlayer --token 0xDEF...5678
```

Aggregate the results into a baseline payload:

```json
{
  "token": "0xDEF...5678",
  "chain": "xlayer",
  "name": "ExampleToken",
  "symbol": "EXT",
  "price": "0.42",
  "volume24h": "125000",
  "liquidity": "2400000",
  "holders": 1247,
  "securityScore": 85,
  "riskFlags": []
}
```

### Step 2: Call Analyst Agent via x402

Send the baseline data to the Analyst agent (service ID 1) for deep fundamental analysis:

**OnchainOS command:**

```
onchainos x402 pay \
  --url "http://localhost:3002/api/services/1/execute" \
  --body '{"input": {"token": "0xDEF...5678", "chain": "xlayer", "baseline": {...}}}' \
  --chain xlayer
```

The Analyst returns:

```json
{
  "fundamentalScore": 78,
  "contractVerified": true,
  "ownerRisk": "medium",
  "liquidityDepth": "adequate",
  "holderConcentration": "healthy",
  "recommendations": ["Monitor governance proposals", "Adequate liquidity for < $50k positions"]
}
```

Cost: 1.00 USDT via x402.

### Step 3: Chain to Auditor Agent via x402

If the Analyst flags any contract risk, automatically forward to the Auditor agent (service ID 2) for a security audit:

**OnchainOS command:**

```
onchainos x402 pay \
  --url "http://localhost:3002/api/services/2/execute" \
  --body '{"input": {"contract": "0xDEF...5678", "chain": "xlayer", "analystReport": {...}}}' \
  --chain xlayer
```

The Auditor returns:

```json
{
  "auditScore": 82,
  "criticalIssues": 0,
  "highIssues": 1,
  "findings": [
    {"severity": "high", "title": "Owner can mint unlimited tokens", "recommendation": "Add cap or timelock"}
  ],
  "overallVerdict": "PASS_WITH_WARNINGS"
}
```

Cost: 2.00 USDT via x402.

### Step 4: Chain to Trader Agent for Signal

Pass combined analyst + auditor reports to the Trader agent (service ID 3) for a trade recommendation:

**OnchainOS command:**

```
onchainos x402 pay \
  --url "http://localhost:3002/api/services/3/execute" \
  --body '{"input": {"token": "0xDEF...5678", "chain": "xlayer", "analysis": {...}, "audit": {...}}}' \
  --chain xlayer
```

The Trader returns:

```json
{
  "signal": "BUY",
  "confidence": 0.72,
  "entryPrice": "0.42",
  "targetPrice": "0.58",
  "stopLoss": "0.35",
  "timeframe": "7d",
  "reasoning": "Strong fundamentals, adequate liquidity, one manageable risk flag"
}
```

Cost: 1.50 USDT via x402.

### Step 5: Compile and Present Final Report

Merge all three agent outputs into a unified report:

```
TOKEN ANALYSIS REPORT
=====================

Token: ExampleToken (EXT) -- 0xDEF...5678
Chain: X Layer (196)

FUNDAMENTALS (Analyst)
  Score: 78/100
  Contract verified, owner can mint (medium risk)
  Liquidity: $2.4M -- adequate
  Holders: 1,247 -- healthy distribution

SECURITY (Auditor)
  Score: 82/100
  Critical: 0 | High: 1 | Medium: 0 | Low: 0
  Finding: Owner mint privilege -- recommend timelock

TRADE SIGNAL (Trader)
  Signal: BUY (72% confidence)
  Entry: $0.42 | Target: $0.58 | Stop: $0.35
  Timeframe: 7 days

TOTAL COST: 4.50 USDT (3 agent calls)
```

## Budget Control

When `--budget` is set, the skill stops chaining to the next agent if the cumulative cost would exceed the budget:

```
Budget: 3.00 USDT
  Analyst: 1.00 USDT (cumulative: 1.00) -- OK
  Auditor: 2.00 USDT (cumulative: 3.00) -- OK
  Trader:  1.50 USDT (cumulative: 4.50) -- SKIP (exceeds budget)

Report generated with 2/3 agents.
```

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| `No analyst service found` | No analyst registered on marketplace | Register one or wait for availability |
| `Insufficient USDT` | Not enough balance for all agents | Use `--budget` to limit or top up wallet |
| `Agent timeout` | An agent did not respond in time | Partial report returned; refund via Escrow |
| `Token not found` | Invalid token address | Verify address and chain |

## OnchainOS Skills Used

- `okx-dex-token` -- Fetch token metadata, supply, and holders
- `okx-security` -- Run security checks and get risk scores
- `okx-dex-signal` -- Get on-chain trade signals and momentum data
- `okx-dex-market` -- Retrieve price, volume, and liquidity data
- `okx-x402-payment` -- Pay each agent in the pipeline via x402
- `okx-agentic-wallet` -- Sign payment proofs and manage USDT approvals

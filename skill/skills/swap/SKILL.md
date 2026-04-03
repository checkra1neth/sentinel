---
name: agentra-swap
description: Execute optimal token swap via Uniswap v3 on X Layer with OKX DEX route comparison
model: sonnet
version: 1.0.0
---

# /agentra swap

Execute an optimal token swap on X Layer by comparing routes across Uniswap v3 and OKX DEX aggregator, then executing the best one through your Agentic Wallet.

## Usage

```
/agentra swap <amount> <from-token> <to-token> [--slippage <percent>] [--dry-run]
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `amount` | Yes | Amount of `from-token` to swap (human-readable, e.g., `10.00`) |
| `from-token` | Yes | Token symbol or address to sell (e.g., `USDT`, `OKB`, `0x...`) |
| `to-token` | Yes | Token symbol or address to buy |
| `--slippage` | No | Maximum slippage tolerance in percent (default: `0.5`) |
| `--dry-run` | No | Show quote without executing |

### Examples

```bash
# Swap 10 USDT to OKB
/agentra swap 10 USDT OKB

# Swap 5 OKB to USDT with 1% slippage
/agentra swap 5 OKB USDT --slippage 1.0

# Preview swap without executing
/agentra swap 100 USDT OKB --dry-run
```

## Step-by-Step Instructions

### Step 1: Resolve Token Addresses

Map token symbols to their contract addresses on X Layer:

**OnchainOS command:**

```
onchainos dex-token info --chain xlayer --token USDT
onchainos dex-token info --chain xlayer --token OKB
```

Known X Layer tokens:
- USDT: `0x1E4a5963aBFD975d8c9021ce480b42188849D41d`
- OKB: Native gas token (wrapped: check via `dex-token`)

### Step 2: Get Quotes from Both Sources

**Uniswap AI quote:**

```
uniswap swap quote \
  --chain xlayer \
  --from USDT \
  --to OKB \
  --amount 10.00 \
  --slippage 0.5
```

**OKX DEX aggregator quote:**

```
onchainos dex-swap quote \
  --chain xlayer \
  --from 0x1E4a5963aBFD975d8c9021ce480b42188849D41d \
  --to OKB \
  --amount 10000000 \
  --slippage 0.5
```

Compare results:

```
Route Comparison
================
  Uniswap v3:  10.00 USDT -> 2.03 OKB  (rate: 4.926 USDT/OKB)
  OKX DEX:     10.00 USDT -> 2.01 OKB  (rate: 4.975 USDT/OKB)

  Best: Uniswap v3 (+0.02 OKB, +0.99%)
```

### Step 3: Approve Token Spend

Before swapping, approve the router to spend your tokens:

**OnchainOS command (for Uniswap Router):**

```
onchainos wallet call \
  --chain xlayer \
  --to 0x1E4a5963aBFD975d8c9021ce480b42188849D41d \
  --function "approve(address,uint256)" \
  --args '["0x7078c4537C04c2b2E52ddBa06074dBdACF23cA15", 10000000]'
```

### Step 4: Execute Swap via Best Route

**If Uniswap is better -- use Uniswap AI skill:**

```
uniswap swap execute \
  --chain xlayer \
  --from USDT \
  --to OKB \
  --amount 10.00 \
  --slippage 0.5 \
  --wallet agentic
```

**If OKX DEX is better -- use OnchainOS skill:**

```
onchainos dex-swap execute \
  --chain xlayer \
  --from 0x1E4a5963aBFD975d8c9021ce480b42188849D41d \
  --to OKB \
  --amount 10000000 \
  --slippage 0.5
```

### Step 5: Confirm Swap

```
Swap Executed!
==============
  Sold: 10.00 USDT
  Received: 2.03 OKB
  Route: Uniswap v3 (USDT -> OKB, 0.3% fee tier)
  Slippage: 0.12% (within 0.5% tolerance)
  Tx: 0xSWAP_TX_HASH
  Gas: 0 OKB (X Layer zero-gas)
```

**Log the action:**

```
onchainos audit-log add \
  --action "swap" \
  --details "10 USDT -> 2.03 OKB via Uniswap v3"
```

## Dry Run Mode

With `--dry-run`, the skill shows the quote and best route without executing:

```
/agentra swap 10 USDT OKB --dry-run

DRY RUN -- No transactions will be executed
=============================================

  Amount: 10.00 USDT
  Uniswap v3:  -> 2.03 OKB (rate: 4.926)
  OKX DEX:     -> 2.01 OKB (rate: 4.975)
  Best route: Uniswap v3

  To execute, run without --dry-run
```

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| `Insufficient balance` | Not enough tokens to swap | Check balance with `/agentra dashboard` |
| `Slippage exceeded` | Price moved beyond tolerance | Increase `--slippage` or reduce amount |
| `No liquidity` | Pool has insufficient depth | Try a smaller amount or different pair |
| `Approval failed` | Token approve transaction failed | Retry; check wallet balance for gas |

## OnchainOS Skills Used

- `okx-dex-swap` -- Get quotes and execute swaps via OKX DEX aggregator
- `okx-dex-token` -- Resolve token addresses and check balances
- `okx-agentic-wallet` -- Sign swap transactions and token approvals
- `okx-audit-log` -- Record swap actions for audit trail

## Uniswap AI Skills Used

- `swap-integration` -- Get Uniswap v3 quotes and execute swaps on X Layer

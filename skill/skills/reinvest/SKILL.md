---
name: agentra-reinvest
description: Auto-reinvest Agentra marketplace profits into Uniswap v3 LP positions via the Treasury
model: sonnet
version: 0.1.0
---

# /agentra reinvest

Reinvest your marketplace profits into Uniswap v3 LP positions on X Layer. This converts a portion of your accumulated USDT earnings into OKB via a DEX swap, then deposits both tokens into a USDT/OKB LP position managed by the Treasury for passive yield.

## Usage

```
/agentra reinvest <percentage> [--min-balance <amount>] [--dry-run]
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `percentage` | Yes | Percentage of available profit to reinvest (e.g., `50%`, `100%`) |
| `--min-balance` | No | Minimum USDT to keep in wallet after reinvest (default: 1.00 USDT) |
| `--dry-run` | No | Simulate the reinvestment without executing transactions |

### Examples

```bash
# Reinvest 50% of profits
/agentra reinvest 50%

# Reinvest everything, keep at least 2 USDT
/agentra reinvest 100% --min-balance 2.00

# Preview what would happen without executing
/agentra reinvest 75% --dry-run
```

## What Happens

### Step 1: Check Available Balance

The skill reads your Agentic Wallet's USDT balance and calculates how much is available for reinvestment:

```
Checking balance...
  Wallet: 0x1234...abcd
  USDT Balance: 25.40 USDT
  Min Balance Reserve: 1.00 USDT
  Available for Reinvest: 24.40 USDT
```

### Step 2: Calculate Reinvestment Amount

Based on the percentage you specify, the skill calculates the exact USDT amount:

```
Calculating reinvestment...
  Available: 24.40 USDT
  Percentage: 50%
  Reinvest Amount: 12.20 USDT
  Remaining After: 13.20 USDT (above 1.00 min)
```

If the reinvest amount would leave your balance below the minimum reserve, the skill adjusts automatically:

```
Adjusting for minimum balance...
  Requested: 100% of 24.40 USDT = 24.40 USDT
  Min Balance Reserve: 2.00 USDT
  Adjusted Amount: 22.40 USDT
```

### Step 3: Swap USDT to OKB via DEX

The skill uses the `okx-dex-swap` Onchain OS skill to swap half the reinvest amount from USDT to OKB on X Layer:

```
Swapping USDT → OKB...
  Swap Amount: 6.10 USDT (half of reinvest)
  Route: USDT → OKB (Uniswap v3 X Layer)
  Slippage: 0.5%
  
  Quote: 6.10 USDT → 1.24 OKB
  Rate: 1 OKB = 4.92 USDT
  
  Executing swap...
  Tx: 0xSWAP_TX_HASH
  Received: 1.24 OKB ✓
```

This step uses the `okx-dex-swap` skill which routes through Uniswap v3 or the best available DEX on X Layer.

### Step 4: Add to Uniswap v3 LP via Treasury

The skill calls `Treasury.reinvest(amount)` to add the swapped tokens into the Treasury-managed Uniswap v3 USDT/OKB LP position:

```
Adding to LP position...
  USDT: 6.10
  OKB: 1.24
  Pool: USDT/OKB 0.3%
  Range: Full range (MVP)
  
  Treasury.reinvest(6100000)
  Tx: 0xREINVEST_TX_HASH
  
  LP Position Updated ✓
```

The Treasury manages a single full-range LP position for the entire platform. Each agent's share of the yield is tracked proportionally based on their earnings contribution.

### Step 5: Confirm Reinvestment

```
Reinvestment Complete!
━━━━━━━━━━━━━━━━━━━━━━━━━━

  Reinvested: 12.20 USDT
    → 6.10 USDT (held)
    → 6.10 USDT → 1.24 OKB (swapped)
  
  LP Position: USDT/OKB full range
  Your LP Share: 4.8% of total pool
  
  Wallet Balance After: 13.20 USDT
  
  Estimated APY: ~8-15% (varies with trading volume)
  
  Check yield with: /agentra dashboard
```

## Yield Distribution

The Treasury distributes LP yield proportionally to agents based on their total earnings contribution to the platform:

```
Your Yield Share = (Your Total Earnings / Platform Total Earnings) * Total LP Yield
```

For example:
- Your total earnings: 130 USDT
- Platform total earnings: 10,000 USDT
- Your share: 1.3%
- If LP generated 50 USDT in fees: your yield = 0.65 USDT

### Claiming Yield

Accumulated yield can be claimed at any time:

```bash
# Check available yield
/agentra dashboard

# Claim yield (via direct contract call)
okx-agentic-wallet call Treasury.claimYield(0x1234...abcd)
```

## Dry Run Mode

Use `--dry-run` to preview the reinvestment without executing any transactions:

```
/agentra reinvest 50% --dry-run

DRY RUN — No transactions will be executed
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Current Balance: 25.40 USDT
  Reinvest Amount: 12.20 USDT (50%)
  
  Step 1: Swap 6.10 USDT → ~1.24 OKB
    Quote from Uniswap v3: 1 OKB = 4.92 USDT
  
  Step 2: Add to LP
    USDT: 6.10
    OKB: ~1.24
    
  Remaining Balance: 13.20 USDT
  
  To execute, run without --dry-run
```

## Automated Reinvestment

The Agentra Service Router includes a scheduler that can auto-reinvest profits every 10 minutes when configured:

| Config Parameter | Default | Description |
|-----------------|---------|-------------|
| `reinvestThreshold` | 1.00 USDT | Minimum profit before auto-reinvest triggers |
| `reinvestPercent` | 50% | Percentage of profit to reinvest automatically |

When the scheduler detects your wallet balance exceeds the threshold, it automatically executes the reinvest flow. This creates the continuous earn-pay-earn cycle.

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| `Insufficient balance` | Not enough USDT after min reserve | Earn more via services or lower percentage |
| `Swap failed` | DEX liquidity issue or slippage | Retry or use a smaller amount |
| `Treasury.reinvest failed` | Treasury contract issue | Check Treasury balance and LP position health |
| `Min balance violation` | Reinvest would leave wallet below minimum | Increase `--min-balance` or lower percentage |

## Data Sources

| Data | Source |
|------|--------|
| USDT balance | `USDT.balanceOf(agentAddress)` via `okx-dex-token` |
| OKB price | `okx-dex-market` or Uniswap v3 pool price |
| LP position | `Treasury.totalReinvested()` |
| Agent yield | `Treasury.getAgentYield(agentAddress)` |
| Agent earnings | `Treasury.totalEarnings()` and agent-specific tracking |

## Dependencies

- `okx/onchainos-skills` — Agentic Wallet for signing transactions, `okx-dex-swap` for USDT/OKB swaps
- `Uniswap/uniswap-ai` — LP position management on Uniswap v3
- Treasury contract on X Layer (see `references/contracts.md`)

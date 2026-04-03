---
name: agentra-autopilot
description: Start or stop an autonomous earn-pay-earn cron loop that scans, executes, and reinvests on X Layer
model: sonnet
version: 1.0.0
---

# /agentra autopilot

Start or stop an autonomous cron loop that continuously scans for opportunities, executes services, earns via x402, reinvests profits into Uniswap v3 LP positions, and compounds yield -- running the full earn-pay-earn cycle without human intervention.

## Usage

```
/agentra autopilot <start|stop|status> [--interval <duration>] [--reinvest-threshold <usdt>] [--reinvest-percent <pct>] [--min-balance <usdt>]
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `start` / `stop` / `status` | Yes | Start the cron loop, stop it, or check current status |
| `--interval` | No | Scan interval: `5m`, `10m`, `30m`, `1h` (default: `10m`) |
| `--reinvest-threshold` | No | Minimum USDT profit before auto-reinvest triggers (default: `5.00`) |
| `--reinvest-percent` | No | Percentage of profit to reinvest (default: `50`) |
| `--min-balance` | No | Minimum USDT to keep in wallet after reinvest (default: `2.00`) |

### Examples

```bash
# Start autopilot with default settings
/agentra autopilot start

# Start with 5-minute scans, reinvest after $10 profit
/agentra autopilot start --interval 5m --reinvest-threshold 10.00

# Check autopilot status
/agentra autopilot status

# Stop the loop
/agentra autopilot stop
```

## What Autopilot Does

Each cycle of the autopilot loop performs these actions:

```
AUTOPILOT CYCLE (every N minutes)
==================================

  1. SCAN      -- Check for pending orders and new opportunities
  2. EXECUTE   -- Process any pending service requests (earn)
  3. ANALYZE   -- Run token analysis on trending tokens
  4. BUY       -- Purchase useful agent services if beneficial
  5. REINVEST  -- Swap profits and add to LP if above threshold
  6. LOG       -- Record all actions to audit log

  Repeat...
```

## Step-by-Step Instructions

### Starting Autopilot

#### Step 1: Validate Configuration

Before starting, verify all prerequisites:

**OnchainOS commands:**

```
# Check wallet exists and has balance
onchainos wallet balance --chain xlayer --token USDT

# Check services are registered
curl http://localhost:3002/api/services?agent=YOUR_WALLET_ADDRESS

# Check server is running
curl http://localhost:3002/api/health
```

#### Step 2: Configure Cron Parameters

The autopilot uses the server's built-in cron scheduler. Configure via API:

**HTTP request:**

```bash
curl -X POST http://localhost:3002/api/agents/YOUR_ADDRESS/autopilot \
  -H "Content-Type: application/json" \
  -d '{
    "interval": "10m",
    "reinvestThreshold": 5000000,
    "reinvestPercent": 50,
    "minBalance": 2000000,
    "enabled": true
  }'
```

Or configure directly in the server's cron loop -- the `scheduler/cron-loop.ts` module manages the autonomous cycles for all agents.

#### Step 3: Start the Loop

The cron loop activates and begins cycling:

```
Autopilot STARTED
=================
  Agent: 0x1234...abcd
  Interval: every 10 minutes
  Reinvest threshold: 5.00 USDT
  Reinvest percent: 50%
  Min balance reserve: 2.00 USDT
  Next scan: in 10 minutes

  Monitor with: /agentra autopilot status
  Stop with: /agentra autopilot stop
```

### Autopilot Cycle Detail

#### Phase 1: Scan

Check for pending work and marketplace state:

```
onchainos gateway call \
  --chain xlayer \
  --contract 0xa80066f2fd7efdFB944ECcb16f67604D33C34333 \
  --function "getOrdersByAgent(address)" \
  --args '["YOUR_WALLET_ADDRESS"]' \
  --read-only
```

Also scan for trending tokens that might warrant analysis:

```
onchainos dex-trenches scan --chain xlayer --limit 10
```

#### Phase 2: Execute Pending Services

If there are pending orders, execute the service logic and release escrow:

```
# For each pending order, the agent processes and the router releases
# This happens automatically via the Service Router event loop
```

#### Phase 3: Analyze Opportunities

If a trending token is found, run the analysis pipeline (if budget allows):

```
# Equivalent to: /agentra analyze <token> xlayer --budget 3.00
onchainos x402 pay \
  --url "http://localhost:3002/api/services/1/execute" \
  --body '{"input": {"token": "0xTRENDING...", "chain": "xlayer"}}' \
  --chain xlayer
```

#### Phase 4: Reinvest Check

Check if profit exceeds the reinvest threshold:

```
onchainos wallet balance --chain xlayer --token USDT
```

If balance - minBalance > reinvestThreshold, execute reinvestment:

```
# Calculate reinvest amount
available = balance - minBalance
reinvestAmount = available * reinvestPercent / 100

# Swap half to OKB
onchainos dex-swap execute \
  --chain xlayer \
  --from USDT --to OKB \
  --amount <halfOfReinvest> \
  --slippage 0.5

# Add to LP via Treasury
onchainos wallet call \
  --chain xlayer \
  --to 0x69558a9B4BfE9c759797F5F22896ADB9d509Cb44 \
  --function "reinvest(uint256)" \
  --args '[<reinvestAmountInUnits>]'
```

#### Phase 5: Audit Log

Record all cycle actions:

```
onchainos audit-log add \
  --action "autopilot-cycle" \
  --details "Processed 2 orders, earned 3.00 USDT, reinvested 5.00 USDT into LP"
```

### Checking Status

```
/agentra autopilot status

Autopilot Status
================
  State: RUNNING
  Agent: 0x1234...abcd
  Interval: 10 minutes
  Running since: 2026-04-03 10:00:00 UTC (4 hours)
  Cycles completed: 24
  
  Last cycle: 2 min ago
    Orders processed: 2
    USDT earned: 3.00
    Reinvested: 5.00 USDT
    LP position value: 53.60 USDT
  
  Totals (this session):
    Orders processed: 48
    USDT earned: 72.00
    USDT reinvested: 30.00
    LP yield accrued: 1.20 USDT
  
  Next scan: in 8 minutes

  Config:
    Reinvest threshold: 5.00 USDT
    Reinvest percent: 50%
    Min balance: 2.00 USDT
```

### Stopping Autopilot

```
/agentra autopilot stop

Autopilot STOPPED
=================
  Agent: 0x1234...abcd
  Session duration: 4 hours 12 minutes
  Cycles completed: 25
  Total earned: 75.00 USDT
  Total reinvested: 32.50 USDT

  Your services remain active and will still receive x402 payments.
  Reinvestment and analysis scanning are paused.

  Restart with: /agentra autopilot start
```

## Configuration Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `interval` | `10m` | Time between scan cycles |
| `reinvestThreshold` | `5.00` USDT | Minimum excess balance to trigger reinvest |
| `reinvestPercent` | `50` | Percentage of available profit to reinvest |
| `minBalance` | `2.00` USDT | Reserve balance (never reinvested) |

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| `Already running` | Autopilot already started | Stop first, then restart |
| `No services registered` | Agent has no services to earn from | Register a service first |
| `Server unreachable` | Cannot connect to localhost:3002 | Start the server |
| `Reinvest failed` | Swap or LP operation failed | Check logs; will retry next cycle |
| `Insufficient balance` | Not enough USDT for operations | Wait for earnings or deposit USDT |

## OnchainOS Skills Used

- `okx-agentic-wallet` -- Sign all transactions in the cron loop
- `okx-x402-payment` -- Pay for agent services during analysis phase
- `okx-dex-swap` -- Swap USDT to OKB for LP reinvestment
- `okx-dex-trenches` -- Discover trending tokens for analysis opportunities
- `okx-defi-invest` -- Add liquidity to Uniswap v3 pools
- `okx-audit-log` -- Record every autopilot action
- `okx-onchain-gateway` -- Read Escrow for pending orders, write to Treasury

## Uniswap AI Skills Used

- `swap-integration` -- Execute Uniswap v3 swaps for reinvestment
- `liquidity-planner` -- Add liquidity positions during reinvest phase

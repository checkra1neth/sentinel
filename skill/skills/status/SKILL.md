---
name: status
description: Aggregate Sentinel statistics -- tokens scanned, threats found, LP invested, verdict accuracy.
---

# /sentinel status

Shows aggregate statistics for the Sentinel oracle: total tokens scanned, threats detected, verdicts published, LP capital deployed, revenue earned, and historical accuracy rate.

## Usage

```
/sentinel status
```

## Parameters

None. This is a free public endpoint.

## OnchainOS Commands Used

```
onchainos audit-log read --action "verdict" --summary
onchainos defi-portfolio positions --address <executor_wallet> --chain xlayer --summary
onchainos wallet-portfolio balances --address <scanner_wallet> --chain xlayer
onchainos wallet-portfolio balances --address <analyst_wallet> --chain xlayer
onchainos wallet-portfolio balances --address <executor_wallet> --chain xlayer
```

## API Endpoint

```
GET /api/stats
```

**Response: 200 OK**

```json
{
  "tokensScanned": 847,
  "verdicts": {
    "safe": 312,
    "caution": 389,
    "dangerous": 146
  },
  "threatsDetected": 535,
  "honeypotsCaught": 89,
  "lpInvested": "4250.00",
  "lpCurrentValue": "4782.50",
  "lpPnl": "+532.50",
  "revenueEarned": "892.30",
  "accuracy": {
    "overall": 94.2,
    "safeCorrect": 96.1,
    "dangerousCorrect": 98.6
  },
  "agents": {
    "scanner": {
      "wallet": "0x38c7b7651b42cd5d0e9fe1909f52b6fd8e044db2",
      "status": "active",
      "lastScan": "2026-04-06T10:30:00Z"
    },
    "analyst": {
      "wallet": "0x874370bc9352bfa4b39c22fa82b89f4ca952ce03",
      "status": "active",
      "lastVerdict": "2026-04-06T10:30:00Z"
    },
    "executor": {
      "wallet": "0x7500350249e155fdacb27dc0a12f5198b158ee00",
      "status": "active",
      "activePositions": 5
    }
  },
  "uptime": "99.7%"
}
```

## Example

```
/sentinel status
```

Output:
```
Sentinel Oracle Status

Tokens Scanned:    847
  SAFE:            312 (36.8%)
  CAUTION:         389 (45.9%)
  DANGEROUS:       146 (17.2%)

Threats Detected:  535
Honeypots Caught:  89

LP Portfolio:
  Invested:        $4,250.00
  Current Value:   $4,782.50
  PnL:             +$532.50 (+12.5%)

Revenue (x402):    $892.30
Accuracy:          94.2% overall

Agents:
  Scanner    0x38c7...db2   Active   Last scan: 10 min ago
  Analyst    0x8743...e03   Active   Last verdict: 10 min ago
  Executor   0x7500...e00   Active   5 positions open

Uptime: 99.7%
```

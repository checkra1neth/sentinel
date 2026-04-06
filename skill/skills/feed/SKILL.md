---
name: feed
description: View the last 20 published verdicts from the Sentinel oracle. Color-coded by verdict level.
---

# /sentinel feed

Shows the most recent 20 verdicts published by the Sentinel oracle. Each verdict includes the token name, risk score, verdict level, and timestamp. Results are color-coded by severity: SAFE (green), CAUTION (yellow), DANGEROUS (red).

## Usage

```
/sentinel feed
```

## Parameters

None. This is a free public endpoint.

## OnchainOS Commands Used

```
onchainos audit-log read --action "verdict" --limit 20
```

## API Endpoint

```
GET /api/verdicts
```

**Response: 200 OK**

```json
{
  "verdicts": [
    {
      "token": "0xABC...123",
      "name": "ExampleToken",
      "symbol": "EXT",
      "riskScore": 72,
      "verdict": "CAUTION",
      "scannedAt": "2026-04-06T10:30:00Z",
      "txHash": "0xVERDICT_TX"
    },
    {
      "token": "0xDEF...456",
      "name": "SafeToken",
      "symbol": "SFT",
      "riskScore": 8,
      "verdict": "SAFE",
      "scannedAt": "2026-04-06T10:15:00Z",
      "txHash": "0xVERDICT_TX_2"
    }
  ],
  "total": 20
}
```

## Example

```
/sentinel feed
```

Output:
```
Sentinel Verdict Feed (last 20)

 #  Token          Score  Verdict     Time
 1  EXT            72     CAUTION     10 min ago
 2  SFT             8     SAFE        25 min ago
 3  RUG            95     DANGEROUS   32 min ago
 4  OKB            15     SAFE        1 hr ago
 5  USDT           12     SAFE        1 hr ago
 ...

Legend: SAFE | CAUTION | DANGEROUS
Total verdicts published: 847
```

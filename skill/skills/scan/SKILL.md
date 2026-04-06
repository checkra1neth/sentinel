---
name: scan
description: Trigger a deep security scan for a token on X Layer. Returns risk score, verdict, honeypot status, and developer info.
---

# /sentinel scan

Triggers a deep security scan for a specific token via the Sentinel Analyst agent. The scan checks contract security, honeypot patterns, developer history, liquidity health, and holder concentration. Results are published as an on-chain verdict.

## Usage

```
/sentinel scan <token_address>
```

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `token_address` | string | Yes | ERC-20 token contract address on X Layer (0x...) |

## x402 Payment

This endpoint requires an x402 payment of **0.10 USDT**.

## OnchainOS Commands Used

```
onchainos x402 sign --amount 0.10 --token USDT --recipient <escrow>
onchainos security token-scan --address <token_address> --chain xlayer
onchainos dex token-info --address <token_address> --chain xlayer
onchainos onchain read --address <token_address> --function "owner()" --chain xlayer
onchainos audit-log write --action "scan" --target <token_address>
```

## API Endpoint

```
POST /api/scan/:token
```

**Headers:**
- `X-Payment`: Base64-encoded x402 payment proof (0.10 USDT)

**Response: 200 OK**

```json
{
  "token": "0xABC...123",
  "name": "ExampleToken",
  "symbol": "EXT",
  "riskScore": 72,
  "verdict": "CAUTION",
  "risks": [
    {"severity": "high", "issue": "Owner can mint unlimited tokens"},
    {"severity": "medium", "issue": "Transfer tax detected (3%)"}
  ],
  "honeypot": false,
  "devInfo": {
    "deployer": "0xDEV...456",
    "deployedAt": "2026-03-15T08:00:00Z",
    "verified": true
  },
  "txHash": "0xVERDICT_TX_HASH"
}
```

## Example

```
/sentinel scan 0x1E4a5963aBFD975d8c9021ce480b42188849D41d
```

Output:
```
Scanning 0x1E4a...D41d on X Layer...

Token: USDT (Tether USD)
Risk Score: 12/100 (LOW)
Verdict: SAFE

Risks: None detected
Honeypot: No
Developer: Verified, deployed 2025-11-20

On-chain verdict published: 0xabc123...
Cost: 0.10 USDT (x402)
```

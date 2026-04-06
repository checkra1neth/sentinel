---
name: report
description: Get a detailed security report for a specific token. Includes full security analysis, liquidity data, and holder concentration.
---

# /sentinel report

Retrieves the full security report for a specific token from the Sentinel oracle. Includes the complete security analysis, Uniswap v3 liquidity data, holder concentration breakdown, developer history, and the on-chain verdict. This is the premium endpoint with more detail than the public feed.

## Usage

```
/sentinel report <token_address>
```

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `token_address` | string | Yes | ERC-20 token contract address on X Layer (0x...) |

## x402 Payment

This endpoint requires an x402 payment of **0.50 USDT**.

## OnchainOS Commands Used

```
onchainos x402 sign --amount 0.50 --token USDT --recipient <escrow>
onchainos security token-scan --address <token_address> --chain xlayer --deep
onchainos dex token-info --address <token_address> --chain xlayer
onchainos dex market-data --address <token_address> --chain xlayer
onchainos wallet-portfolio balances --address <token_address> --chain xlayer
onchainos audit-log write --action "report" --target <token_address>
```

## API Endpoint

```
GET /api/verdicts/:token
```

**Headers:**
- `X-Payment`: Base64-encoded x402 payment proof (0.50 USDT)

**Response: 200 OK**

```json
{
  "token": "0xABC...123",
  "name": "ExampleToken",
  "symbol": "EXT",
  "riskScore": 72,
  "verdict": "CAUTION",
  "security": {
    "honeypot": false,
    "mintable": true,
    "pausable": false,
    "proxy": false,
    "transferTax": 3.0,
    "issues": [
      {"severity": "high", "issue": "Owner can mint unlimited tokens"},
      {"severity": "medium", "issue": "Transfer tax detected (3%)"}
    ]
  },
  "liquidity": {
    "uniswapV3Pool": "0xPOOL...789",
    "tvl": "245000.00",
    "volume24h": "18700.00",
    "feeTier": 3000,
    "priceUsd": "0.0234"
  },
  "holders": {
    "total": 1247,
    "top10Percent": 68.4,
    "top1": {
      "address": "0xTOP...001",
      "percent": 22.1
    }
  },
  "devInfo": {
    "deployer": "0xDEV...456",
    "deployedAt": "2026-03-15T08:00:00Z",
    "verified": true,
    "previousContracts": 3
  },
  "onChainVerdict": {
    "txHash": "0xVERDICT_TX_HASH",
    "blockNumber": 12345678,
    "timestamp": "2026-04-06T10:30:00Z"
  }
}
```

## Example

```
/sentinel report 0xABC...123
```

Output:
```
Sentinel Security Report: ExampleToken (EXT)

Risk Score: 72/100
Verdict: CAUTION

Security Analysis:
  Honeypot: No
  Mintable: Yes (HIGH -- owner can mint unlimited)
  Pausable: No
  Proxy: No
  Transfer Tax: 3.0% (MEDIUM)

Liquidity (Uniswap v3):
  Pool: 0xPOOL...789 (0.3% fee tier)
  TVL: $245,000
  24h Volume: $18,700
  Price: $0.0234

Holder Concentration:
  Total Holders: 1,247
  Top 10 Hold: 68.4%
  Largest: 0xTOP...001 (22.1%)

Developer:
  Deployer: 0xDEV...456
  Deployed: 2026-03-15
  Verified: Yes
  Prior Contracts: 3

On-chain verdict: 0xabc123... (block #12345678)
Cost: 0.50 USDT (x402)
```

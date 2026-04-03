# OnchainOS Skills Reference

Quick reference for all OnchainOS skills used by Agentra Connect. These are invoked via the `onchainos` CLI provided by OKX's OnchainOS runtime.

## Wallet & Identity

### okx-agentic-wallet

Create and manage Agentic Wallets -- the agent's on-chain identity.

```bash
# List wallets
onchainos wallet list --chain xlayer

# Create a new wallet on X Layer
onchainos wallet add --chain xlayer

# Check balance
onchainos wallet balance --chain xlayer --token USDT

# Send a write transaction
onchainos wallet call \
  --chain xlayer \
  --to <CONTRACT_ADDRESS> \
  --function "functionName(type1,type2)" \
  --args '[arg1, arg2]'

# Sign typed data (e.g., x402 proof)
onchainos wallet sign-typed \
  --chain xlayer \
  --domain '{"name":"Agentra","version":"1","chainId":196}' \
  --types '...' \
  --values '...'
```

### okx-x402-payment

Sign and verify x402 payment proofs for machine-to-machine commerce.

```bash
# Execute full x402 payment flow (challenge -> sign -> pay)
onchainos x402 pay \
  --url "http://localhost:3002/api/services/1/execute" \
  --body '{"input": {...}}' \
  --chain xlayer

# Verify a received x402 proof
onchainos x402 verify \
  --proof <BASE64_PROOF> \
  --chain xlayer
```

## DEX & Trading

### okx-dex-swap

Execute token swaps via OKX DEX aggregator.

```bash
# Get swap quote
onchainos dex-swap quote \
  --chain xlayer \
  --from <TOKEN_ADDRESS> \
  --to <TOKEN_ADDRESS> \
  --amount <AMOUNT_IN_WEI> \
  --slippage 0.5

# Execute swap
onchainos dex-swap execute \
  --chain xlayer \
  --from <TOKEN_ADDRESS> \
  --to <TOKEN_ADDRESS> \
  --amount <AMOUNT_IN_WEI> \
  --slippage 0.5
```

### okx-dex-token

Fetch token metadata, balances, and on-chain data.

```bash
# Token info
onchainos dex-token info --chain xlayer --token <ADDRESS_OR_SYMBOL>

# Token balance for current wallet
onchainos dex-token balance --chain xlayer --token USDT

# Token holders and supply
onchainos dex-token holders --chain xlayer --token <ADDRESS>
```

### okx-dex-market

Market prices, liquidity, and volume data.

```bash
# Current price
onchainos dex-market price --chain xlayer --token <ADDRESS>

# 24h volume
onchainos dex-market volume --chain xlayer --token <ADDRESS>

# Liquidity depth
onchainos dex-market liquidity --chain xlayer --pair USDT/OKB
```

### okx-dex-signal

On-chain trade signals, momentum indicators, and whale tracking.

```bash
# Scan for signals on a token
onchainos dex-signal scan --chain xlayer --token <ADDRESS>

# Whale alerts
onchainos dex-signal whales --chain xlayer --min-value 10000
```

### okx-dex-trenches

Discover trending tokens and narratives.

```bash
# Top trending on X Layer
onchainos dex-trenches scan --chain xlayer --limit 10

# Filter by category
onchainos dex-trenches scan --chain xlayer --category defi
```

## Security

### okx-security

Check token and contract security scores, identify risks.

```bash
# Full security check
onchainos security check --chain xlayer --token <ADDRESS>

# Contract audit score
onchainos security audit --chain xlayer --contract <ADDRESS>

# Risk flags
onchainos security risks --chain xlayer --token <ADDRESS>
```

## DeFi & Portfolio

### okx-defi-invest

Search and invest in DeFi pools and yield opportunities.

```bash
# Search pools
onchainos defi-invest search \
  --chain xlayer \
  --protocol uniswap-v3 \
  --pair USDT/OKB

# Add liquidity
onchainos defi-invest add-liquidity \
  --chain xlayer \
  --protocol uniswap-v3 \
  --pair USDT/OKB \
  --amount 50 \
  --range full

# Remove liquidity
onchainos defi-invest remove-liquidity \
  --chain xlayer \
  --position <POSITION_ID>
```

### okx-defi-portfolio

Track DeFi positions, LP holdings, and yield.

```bash
# All DeFi positions
onchainos defi-portfolio positions --chain xlayer

# Filter by protocol
onchainos defi-portfolio positions --chain xlayer --protocol uniswap-v3

# Pending rewards
onchainos defi-portfolio rewards --chain xlayer
```

### okx-wallet-portfolio

Aggregate wallet balances across all tokens and chains.

```bash
# All balances on X Layer
onchainos wallet-portfolio balances --chain xlayer

# Total portfolio value in USD
onchainos wallet-portfolio total --chain xlayer
```

## Infrastructure

### okx-onchain-gateway

Raw contract read/write via RPC. Used for custom contract interactions.

```bash
# Read (view function)
onchainos gateway call \
  --chain xlayer \
  --contract <ADDRESS> \
  --function "functionName(type1)" \
  --args '[arg1]' \
  --read-only

# Write (state-changing function)
onchainos gateway call \
  --chain xlayer \
  --contract <ADDRESS> \
  --function "functionName(type1)" \
  --args '[arg1]'
```

### okx-audit-log

Log and review agent actions for accountability and debugging.

```bash
# Add log entry
onchainos audit-log add \
  --action "swap" \
  --details "10 USDT -> 2.03 OKB via Uniswap v3"

# View recent logs
onchainos audit-log list --limit 20

# Search logs
onchainos audit-log search --query "reinvest"
```

## Uniswap AI Skills

These are from the `Uniswap/uniswap-ai` dependency, not OKX OnchainOS.

### swap-integration

```bash
# Quote
uniswap swap quote --chain xlayer --from USDT --to OKB --amount 10.00

# Execute
uniswap swap execute --chain xlayer --from USDT --to OKB --amount 10.00 --slippage 0.5
```

### liquidity-planner

```bash
# List pools
uniswap liquidity-planner pools --chain xlayer --pair USDT/OKB

# Pool state
uniswap liquidity-planner pool-state --chain xlayer --pair USDT/OKB --fee-tier 3000

# Add liquidity
uniswap liquidity-planner add \
  --chain xlayer --pair USDT/OKB --fee-tier 3000 \
  --amount0 25000000 --amount1 5080000000000000000 \
  --tick-lower -887220 --tick-upper 887220

# Remove liquidity
uniswap liquidity-planner remove --position <NFT_ID>
```

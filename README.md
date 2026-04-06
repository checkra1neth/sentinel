# Sentinel -- Self-Funding Security Oracle on X Layer

Most security tools tell you what's dangerous. Sentinel puts its own money on what's safe.

Sentinel is an autonomous security oracle running on X Layer (chain ID 196). Three AI agents work in sequence: the **Scanner** discovers new tokens, the **Analyst** performs deep security analysis and publishes on-chain verdicts, and the **Executor** invests in tokens rated SAFE via Uniswap v3 LP positions. If the Analyst rates a token SAFE and it turns out to be a rug pull, Sentinel loses real money. Aligned incentives -- skin in the game.

## Architecture

```
                         ┌──────────────────────────────────────────────────┐
                         │                Sentinel Pipeline                  │
                         │                                                  │
  New tokens             │  ┌──────────┐    ┌──────────┐    ┌────────────┐  │
  on X Layer  ─────────► │  │ Scanner  │───►│ Analyst  │───►│  Executor  │  │
                         │  │ discover │    │ verdict  │    │  invest    │  │
                         │  │ tokens   │    │ publish  │    │  in SAFE   │  │
                         │  └──────────┘    └────┬─────┘    └─────┬──────┘  │
  Claude Code Skill      │                       │                │         │
  (sentinel)             │                       ▼                ▼         │
  ┌─────────────────┐    │               VerdictRegistry    Uniswap v3     │
  │ /sentinel scan   │    │                (on-chain)       LP Positions    │
  │ /sentinel feed   │───►│                                                │
  │ /sentinel report │    │  ┌──────┐  ┌──────────┐  ┌──────────┐         │
  │ /sentinel portf. │    │  │Escrow│  │ Registry │  │ Treasury │         │
  │ /sentinel status │    │  └──────┘  └──────────┘  └──────────┘         │
  └─────────────────┘    │              X Layer (chain 196)                │
                         └──────────────────────────────────────────────────┘
                                  │              │              │
                                  ▼              ▼              ▼
                            OnchainOS       Uniswap v3      OKX DEX
                            (14 Skills)     (X Layer)       Aggregator
```

## Deployed Contracts (X Layer Mainnet, Chain 196)

All contracts are **UUPS-upgradeable** (EIP-1822) via OpenZeppelin, deployed behind ERC1967 proxies.

| Contract | Address | Purpose |
|----------|---------|---------|
| **Registry** | `0xDd0FF50142Ab591D2Bc0D0AF5Bf230A9f2B84E86` | Service registration and discovery |
| **Escrow** | `0xa80066f2fd7efdFB944ECcb16f67604D33C34333` | Payment escrow with 2% fee, 1-hour timeout |
| **Treasury** | `0x69558a9B4BfE9c759797F5F22896ADB9d509Cb44` | Fee collection and yield distribution |
| **VerdictRegistry** | `TBD` | On-chain verdict storage (not yet deployed) |
| **Uniswap Router** | `0x7078c4537C04c2b2E52ddBa06074dBdACF23cA15` | Swap execution and LP management |
| **USDT** | `0x1E4a5963aBFD975d8c9021ce480b42188849D41d` | Payment token (6 decimals) |

Explorer: [okx.com/xlayer/explorer](https://www.okx.com/xlayer/explorer)

## Agents

Sentinel runs three autonomous agents, each with a dedicated OKX Agentic Wallet (TEE-secured):

| Agent | Role | Wallet | What It Does |
|-------|------|--------|--------------|
| **Scanner** | Token discovery | `0x38c7b7651b42cd5d0e9fe1909f52b6fd8e044db2` | Monitors X Layer for new tokens, trending activity, and smart money signals. Feeds candidates to the Analyst. |
| **Analyst** | Security analysis | `0x874370bc9352bfa4b39c22fa82b89f4ca952ce03` | Performs deep security scans (honeypot, mintable, tax, proxy, holder concentration). Publishes verdicts on-chain to VerdictRegistry. |
| **Executor** | LP investment | `0x7500350249e155fdacb27dc0a12f5198b158ee00` | Invests in tokens rated SAFE via Uniswap v3 LP positions. If the verdict is wrong, Executor loses money. Skin in the game. |

See [AGENTS.md](AGENTS.md) for full agent identity documentation.

## Earn-Pay-Earn Cycle

The core economic loop that makes Sentinel self-sustaining:

```
Phase 1: EARN (Verdicts)          Phase 2: PAY (Operations)          Phase 3: EARN (LP Yield)
┌──────────────────┐              ┌──────────────────┐              ┌──────────────────┐
│  External client  │              │  Sentinel agents  │              │  Executor agent   │
│  requests token   │──► x402 ──► │  use revenue to   │              │  invests in SAFE  │
│  report (0.50)    │   payment   │  fund on-chain    │              │  tokens via       │
│  or scan (0.10)   │             │  verdict publish   │              │  Uniswap v3 LP    │
│                   │              │  and operations    │              │                   │
│  Revenue: x402    │              │  Cost: gas + ops   │              │  Yield: LP fees   │
└──────────────────┘              └──────────────────┘              └──────────────────┘
```

1. **Earn** -- External clients pay 0.50 USDT for detailed reports or 0.10 USDT for manual scans via x402.
2. **Pay** -- Revenue covers on-chain verdict publishing and operational costs.
3. **Earn** -- Executor invests in SAFE tokens via Uniswap v3, earning LP fees. Good verdicts = profitable positions.

## OnchainOS Integration

Sentinel uses **14 OnchainOS skills** from the `okx/onchainos-skills` pack:

| Skill | What Sentinel Uses It For |
|-------|--------------------------|
| `okx-agentic-wallet` | Agent identity, transaction signing, TEE-secured key management |
| `okx-x402-payment` | Sign and verify x402 payment proofs for scan/report endpoints |
| `okx-dex-swap` | Token swaps on X Layer for Executor LP entry/exit |
| `okx-dex-token` | Token metadata, prices, liquidity data for Scanner discovery |
| `okx-dex-market` | Real-time pricing and market data for Analyst reports |
| `okx-dex-signal` | Smart money activity tracking for Scanner trending detection |
| `okx-security` | Token security scanning (honeypot, mintable, tax, proxy) for Analyst |
| `okx-onchain-gateway` | Raw contract read/write for VerdictRegistry publishing |
| `okx-defi-invest` | DeFi pool search for Executor LP investment |
| `okx-defi-portfolio` | Track Executor LP positions and DeFi holdings |
| `okx-wallet-portfolio` | Aggregate wallet balances across all three agents |
| `okx-dex-trenches` | Trending tokens and narratives for Scanner discovery |
| `okx-audit-log` | Log all agent actions for transparency and audit trail |

The 14th is the core OnchainOS runtime that orchestrates all of the above.

## Uniswap Integration

Sentinel integrates Uniswap v3 on X Layer at three levels, using the `Uniswap/uniswap-ai` skill dependency:

**1. Pool Analytics** -- The Executor discovers Uniswap v3 pools for SAFE-rated tokens, analyzing TVL, volume, fee tiers, and APR estimates to select the best LP positions.

**2. Smart Routing** -- When entering or exiting LP positions, Sentinel compares Uniswap v3 direct routes against OKX DEX aggregator and OnchainOS swap for best execution.

**3. LP Management** -- The Executor adds liquidity to Uniswap v3 pools for tokens rated SAFE, manages position ranges, and collects accumulated fees.

Uniswap AI sub-skills:
- `swap-integration` -- execute swaps through Uniswap v3 on X Layer
- `liquidity-planner` -- plan, add, and remove LP positions

## Claude Code Skill (sentinel)

The `sentinel` skill lets any Claude Code agent query the Sentinel oracle. Install and use 5 sub-skills:

```bash
npx skills add sentinel/sentinel
```

| Command | Description | x402 Cost |
|---------|-------------|-----------|
| `/sentinel scan <token>` | Trigger deep security scan for a token | 0.10 USDT |
| `/sentinel feed` | View last 20 published verdicts | Free |
| `/sentinel report <token>` | Get detailed security report for a token | 0.50 USDT |
| `/sentinel portfolio` | View Executor LP positions and PnL | Free |
| `/sentinel status` | Aggregate stats: scans, threats, accuracy | Free |

**Dependencies:** `okx/onchainos-skills`, `Uniswap/uniswap-ai`

## How to Run

### Prerequisites

- [Node.js 22+](https://nodejs.org/)
- [Foundry](https://book.getfoundry.sh/getting-started/installation) (for smart contracts)
- [OKX API keys](https://web3.okx.com/build/dev-portal) (for OnchainOS)
- OnchainOS CLI: `npx skills add okx/onchainos-skills`
- Uniswap AI: `npx skills add Uniswap/uniswap-ai`

### 1. Smart Contracts

```bash
cd contracts
cp .env.example .env   # Fill in XLAYER_RPC_URL, DEPLOYER_PRIVATE_KEY
forge install
forge build
forge test             # 31 tests
```

### 2. Server

```bash
cd server
cp .env.example .env   # Fill in contract addresses, OKX keys, wallet config
npm install
npm run dev            # Starts on http://localhost:3000
```

Required env vars: `XLAYER_RPC_URL`, `CHAIN_ID`, `REGISTRY_ADDRESS`, `ESCROW_ADDRESS`, `TREASURY_ADDRESS`, `USDT_ADDRESS`, `OKX_API_KEY`, `OKX_SECRET_KEY`, `OKX_PASSPHRASE`, and wallet addresses for each agent.

### 3. Web UI

```bash
cd web
npm install
npm run dev            # Starts on http://localhost:3001
```

### 4. Skill (no build needed)

```bash
cd skill
# Markdown-based skill -- install directly:
npx skills add ./skill
```

## Project Structure

```
sentinel/
├── contracts/           # Solidity 0.8.24 (Foundry) -- Registry, Escrow, Treasury, VerdictRegistry
│   ├── src/             # Contract sources (UUPS upgradeable)
│   ├── test/            # Forge tests (31 tests)
│   └── script/          # Deployment scripts
├── server/              # TypeScript Express -- Scanner, Analyst, Executor agents
│   └── src/
│       ├── agents/      # Scanner, Analyst, Executor + pipeline orchestration
│       ├── wallet/      # Agentic Wallet wrapper (OnchainOS)
│       ├── lib/         # OnchainOS CLI, OKX API, Uniswap v3 integration
│       ├── payments/    # x402 client and server middleware
│       ├── router/      # Express routes with x402 paywall
│       └── scheduler/   # Cron-based autonomous scanning and reinvestment
├── skill/               # Claude Code skill -- sentinel (5 sub-skills)
│   ├── SKILL.md         # Skill manifest and documentation
│   └── skills/          # scan, feed, report, portfolio, status
├── web/                 # Next.js 16 dashboard -- Verdict feed UI
│   └── src/             # React 19, wagmi, viem, TailwindCSS
└── docs/                # Additional documentation
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contracts | Solidity 0.8.24, Foundry, OpenZeppelin UUPS |
| Server | TypeScript, Express, viem, node-cron, WebSocket |
| Web UI | Next.js 16, React 19, wagmi 3, viem, TailwindCSS 4 |
| Skill | Claude Code skill format (markdown-based) |
| Chain | X Layer (Chain ID 196), zero gas fees |
| Payments | x402 protocol over USDT |
| DEX | Uniswap v3 (X Layer), OKX DEX aggregator |
| Wallet | OKX Agentic Wallet (TEE-secured) |

## Hackathon

**OKX Build X Hackathon 2026**
- **X Layer Arena** -- autonomous security oracle with 3 agents, on-chain verdicts, and Uniswap LP investment
- **Skills Arena** -- `sentinel` reusable Claude Code skill with 5 commands for querying the oracle
- Deadline: April 15, 2026, 23:59 UTC

## Team

Solo developer + Claude Code

## License

MIT

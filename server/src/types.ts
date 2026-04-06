import { type Address } from "viem";

export interface ServiceDef {
  id: number;
  serviceType: string;
  endpoint: string;
  priceUsdt: bigint;
  active: boolean;
}

export interface AgentConfig {
  name: string;
  walletAddress: Address;
  services: ServiceDef[];
  buyRules: BuyRule[];
  reinvestThreshold: number;
  reinvestPercent: number;
}

export interface BuyRule {
  triggerCondition: string;
  targetServiceType: string;
  maxPrice: number;
}

export interface OrderInfo {
  id: number;
  client: Address;
  agent: Address;
  amount: bigint;
  serviceId: number;
  deadline: bigint;
  status: number;
}

export interface X402Challenge {
  price: string;
  currency: string;
  escrowAddress: Address;
  serviceId: number;
  chainId: number;
}

export interface TokenReport {
  token: string;
  riskScore: number;
  marketCap: number;
  volume24h: number;
  recommendation: string;
}

export interface ScanResult {
  contract: Address;
  riskScore: number;
  issues: string[];
  verified: boolean;
}

export interface SwapResult {
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  txHash: string;
}

// ---------------------------------------------------------------------------
// OnchainOS CLI wrapper
// ---------------------------------------------------------------------------

export interface OnchainosResult<T> {
  success: boolean;
  data: T;
  error?: string;
}

// ---------------------------------------------------------------------------
// Token security scan (OKX / OnchainOS)
// ---------------------------------------------------------------------------

export interface TokenSecurityScan {
  action: string;
  riskLevel: string;
  isHoneypot: boolean;
  isProxy: boolean;
  isOpenSource: boolean;
  isMintable: boolean;
  canTakeBackOwnership: boolean;
  ownerChangeBalance: boolean;
  hiddenOwner: boolean;
  selfDestruct: boolean;
  externalCall: boolean;
  buyTax: string;
  sellTax: string;
  holderCount: number;
  lpHolderCount: number;
  totalSupply: string;
}

// ---------------------------------------------------------------------------
// Token info
// ---------------------------------------------------------------------------

export interface TokenInfo {
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
  marketCap: number;
  volume24h: number;
  priceUsd: number;
  holders: number;
  liquidityUsd: number;
}

// ---------------------------------------------------------------------------
// Swap quote
// ---------------------------------------------------------------------------

export interface SwapQuote {
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  priceImpact: string;
  route: string[];
  estimatedGas: string;
  routerAddress: string;
  calldata: string;
}

// ---------------------------------------------------------------------------
// Liquidity pool
// ---------------------------------------------------------------------------

export interface LiquidityPool {
  poolAddress: Address;
  tokenA: Address;
  tokenB: Address;
  feeTier: number;
  tvlUsd: number;
  volume24hUsd: number;
  apr: number;
}

// ---------------------------------------------------------------------------
// Uniswap v3 pool info (on-chain)
// ---------------------------------------------------------------------------

export interface PoolInfo {
  address: Address;
  token0: Address;
  token1: Address;
  fee: number;
  sqrtPriceX96: bigint;
  tick: number;
  liquidity: bigint;
}

// ---------------------------------------------------------------------------
// Agent event log
// ---------------------------------------------------------------------------

export interface AgentEvent {
  timestamp: number;
  agent: string;
  type: string;
  message: string;
  txHash?: string;
  details?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// x402 payment proof
// ---------------------------------------------------------------------------

export interface X402Proof {
  signature: string;
  txHash: string;
  payer: Address;
  amount: string;
  serviceId: number;
  nonce: number;
  expiry: number;
}

// ---------------------------------------------------------------------------
// Sentinel verdicts
// ---------------------------------------------------------------------------

export interface Verdict {
  token: string;
  tokenName: string;
  tokenSymbol: string;
  riskScore: number;
  verdict: "SAFE" | "CAUTION" | "DANGEROUS";
  isHoneypot: boolean;
  hasRug: boolean;
  hasMint: boolean;
  isProxy: boolean;
  buyTax: number;
  sellTax: number;
  holderConcentration: number;
  risks: string[];
  priceUsd: number;
  marketCap: number;
  liquidityUsd: number;
  timestamp: number;
  txHash?: string;
  lpInvested?: string;
  defiPool?: {
    name: string;
    platform: string;
    apr: string;
    tvl: string;
    investmentId: number;
    poolAddress: string;
  };
  holders?: number;
  priceChange24H?: number;
  volume24H?: number;
}

export interface VerdictStats {
  totalScanned: number;
  totalSafe: number;
  totalCaution: number;
  totalDangerous: number;
  totalLpInvested: number;
  lpPnl: number;
}

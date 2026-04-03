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

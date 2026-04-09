// ---------------------------------------------------------------------------
// ERC-8183 Job Manager
// Tracks inter-agent jobs in-memory. On-chain integration planned for when
// the SentinelCommerce contract is deployed.
// ---------------------------------------------------------------------------

import { randomUUID } from "crypto";
import type { BaseAgent } from "../agents/base-agent.js";
import type { ScannerAgent } from "../agents/scanner-agent.js";
import { onchainosSwap, onchainosDefi, onchainosPortfolio } from "../lib/onchainos.js";
import { config } from "../config.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentJob {
  id: string;
  type: "security_scan" | "swap" | "deposit" | "withdraw";
  client: string;      // sentinel wallet address
  provider: string;    // guardian or operator wallet address
  params: Record<string, unknown>;
  status: "created" | "processing" | "completed" | "failed";
  result?: Record<string, unknown>;
  createdAt: number;
  completedAt?: number;
}

interface SecurityResult {
  verdict: string;
  riskScore: number;
  warnings: string[];
  tokenSymbol?: string;
  isHoneypot?: boolean;
  buyTax?: number;
  sellTax?: number;
  holderCount?: number;
  cached?: boolean;
}

// ---------------------------------------------------------------------------
// GoPlus security scanner (same logic as service-router /swap/security/:token)
// Extracted here to avoid self-HTTP calls.
// ---------------------------------------------------------------------------

const KNOWN_SAFE: Record<string, string> = {
  "0xdac17f958d2ee523a2206206994597c13d831ec7": "USDT",
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": "USDC",
  "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": "WETH",
  "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599": "WBTC",
  "0x6b175474e89094c44da98b954eedeac495271d0f": "DAI",
  "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": "USDC",
  "0x4200000000000000000000000000000000000006": "WETH",
  "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf": "cbBTC",
  "0x0000000000000000000000000000000000000000": "ETH",
  "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee": "ETH",
};

const goplusCache = new Map<string, { data: SecurityResult; ts: number }>();
const GOPLUS_TTL = 5 * 60_000;

async function runSecurityScan(
  tokenAddress: string,
  chainId: number = 8453,
): Promise<SecurityResult> {
  const token = tokenAddress.toLowerCase();

  // Whitelist -- instant safe
  if (KNOWN_SAFE[token]) {
    return {
      verdict: "SAFE",
      riskScore: 0,
      tokenSymbol: KNOWN_SAFE[token],
      warnings: [],
      cached: true,
    };
  }

  // Cache check
  const cacheKey = `${chainId}:${token}`;
  const cached = goplusCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < GOPLUS_TTL) {
    return cached.data;
  }

  // GoPlus API
  const gpRes = await fetch(
    `https://api.gopluslabs.io/api/v1/token_security/${chainId}?contract_addresses=${token}`,
    { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) },
  );

  if (!gpRes.ok) {
    return { verdict: "UNKNOWN", riskScore: 30, warnings: ["Security API unavailable"], cached: false };
  }

  const gpData = (await gpRes.json()) as Record<string, unknown>;
  const info = ((gpData.result as Record<string, unknown>) ?? {})[token] as
    | Record<string, unknown>
    | undefined;

  if (!info) {
    return { verdict: "UNKNOWN", riskScore: 30, warnings: ["Token not found in GoPlus"], cached: false };
  }

  // Score calculation (mirrors service-router logic)
  let score = 0;
  const warnings: string[] = [];

  const isHoneypot = info.is_honeypot === "1";
  const buyTax = parseFloat(String(info.buy_tax ?? "0")) * 100;
  const sellTax = parseFloat(String(info.sell_tax ?? "0")) * 100;
  const isOpenSource = info.is_open_source === "1";
  const canMint = info.is_mintable === "1";
  const hiddenOwner = info.hidden_owner === "1";
  const canTakeBack = info.can_take_back_ownership === "1";
  const ownerChangeBal = info.owner_change_balance === "1";
  const taxModifiable = info.slippage_modifiable === "1";
  const cannotSellAll = info.cannot_sell_all === "1";
  const isProxy = info.is_proxy === "1";
  const fakeToken = (info.fake_token as Record<string, unknown>)?.value === 1;
  const isAirdropScam = info.is_airdrop_scam === "1";
  const sameCreatorHoneypot = info.honeypot_with_same_creator === "1";
  const trustList = info.trust_list === "1";
  const holderCount = parseInt(String(info.holder_count ?? "0"));
  const ownerAddr = String(info.owner_address ?? "");
  const renounced =
    ownerAddr === "0x0000000000000000000000000000000000000000" ||
    ownerAddr === "0x000000000000000000000000000000000000dEaD";

  if (trustList) {
    score = 0;
  } else {
    if (fakeToken) { score += 60; warnings.push("Fake token"); }
    if (isHoneypot) { score += 50; warnings.push("Honeypot -- cannot sell"); }
    if (cannotSellAll) { score += 40; warnings.push("Cannot sell all tokens"); }
    if (isAirdropScam) { score += 40; warnings.push("Airdrop scam"); }
    if (sameCreatorHoneypot) { score += 35; warnings.push("Creator made honeypots"); }
    if (ownerChangeBal) { score += 30; warnings.push("Owner can change balances"); }
    if (hiddenOwner) { score += 25; warnings.push("Hidden owner"); }
    if (canTakeBack) { score += 20; warnings.push("Can reclaim ownership"); }
    if (sellTax > 15) { score += 20; warnings.push(`High sell tax: ${sellTax.toFixed(1)}%`); }
    if (buyTax > 15) { score += 15; warnings.push(`High buy tax: ${buyTax.toFixed(1)}%`); }
    if (!isOpenSource) { score += 10; warnings.push("Contract not verified"); }
    if (taxModifiable) { score += 10; warnings.push("Tax can be modified"); }
    if (canMint) { score += 10; warnings.push("Can mint new tokens"); }
    if (isProxy) { score += 5; warnings.push("Proxy/upgradeable contract"); }
    if (renounced) { score -= 15; }
    if (isOpenSource) { score -= 5; }
    if (holderCount > 1000) { score -= 10; }
    else if (holderCount > 100) { score -= 5; }
  }
  score = Math.max(0, Math.min(100, score));

  const verdict = score <= 9 ? "SAFE" : score <= 29 ? "LOW" : score <= 49 ? "CAUTION" : "DANGEROUS";
  const result: SecurityResult = {
    verdict,
    riskScore: score,
    warnings,
    cached: false,
    tokenSymbol: String(info.token_symbol ?? ""),
    isHoneypot,
    buyTax,
    sellTax,
    holderCount,
  };

  goplusCache.set(cacheKey, { data: { ...result, cached: true }, ts: Date.now() });
  return result;
}

// ---------------------------------------------------------------------------
// JobManager
// ---------------------------------------------------------------------------

export class JobManager {
  private jobs = new Map<string, AgentJob>();
  private agents: Record<string, BaseAgent>;

  constructor(agents: Record<string, BaseAgent>) {
    this.agents = agents;
  }

  // ---- Security scan (Guardian) ------------------------------------------

  async createSecurityJob(
    tokenAddress: string,
    chainId?: number,
  ): Promise<AgentJob> {
    const guardian = this.agents["2"];
    const job = this.createJob("security_scan", {
      tokenAddress,
      chainId: chainId ?? config.chainId,
    }, guardian?.walletAddress ?? "guardian");

    try {
      job.status = "processing";

      // Try agent-level full scan first; fall back to GoPlus
      let result: Record<string, unknown>;
      if (guardian) {
        try {
          const agentResult = await guardian.execute("scan", {
            token: tokenAddress,
            chainId: chainId ?? config.chainId,
          });
          result = (agentResult ?? {}) as Record<string, unknown>;
        } catch {
          result = (await runSecurityScan(tokenAddress, chainId ?? 8453)) as unknown as Record<string, unknown>;
        }
      } else {
        result = (await runSecurityScan(tokenAddress, chainId ?? 8453)) as unknown as Record<string, unknown>;
      }

      job.result = result;
      job.status = "completed";
      job.completedAt = Date.now();
    } catch (err) {
      job.status = "failed";
      job.result = { error: err instanceof Error ? err.message : "Unknown error" };
      job.completedAt = Date.now();
    }

    return job;
  }

  // ---- Swap (Operator, with Guardian pre-check) --------------------------

  async createSwapJob(params: {
    from: string;
    to: string;
    amount: string;
    walletAddress?: string;
    chainId?: number;
  }): Promise<AgentJob> {
    const operator = this.agents["3"];
    const job = this.createJob("swap", params as Record<string, unknown>, operator?.walletAddress ?? "operator");

    try {
      job.status = "processing";
      const chainId = params.chainId ?? config.chainId;

      // Security gate: check target token before quoting
      const isTargetAddress = params.to.startsWith("0x") && params.to.length === 42;
      if (isTargetAddress) {
        const security = await runSecurityScan(params.to, chainId);
        if (security.verdict === "DANGEROUS") {
          job.status = "failed";
          job.result = {
            blocked: true,
            reason: "Token failed security scan",
            security,
          };
          job.completedAt = Date.now();
          return job;
        }
        // Attach security info to result
        job.result = { security };
      }

      // Get swap quote via OKX (same as quoteOkx in service-router)
      const quoteResult = onchainosSwap.quote(
        params.from,
        params.to,
        params.amount,
        chainId,
      );

      const quoteData = quoteResult.data as Record<string, unknown> | undefined;
      const toAmount = Number(
        quoteData?.toTokenAmount ??
        (quoteData?.data as Record<string, unknown>)?.toTokenAmount ??
        0,
      );

      if (!quoteResult.success || toAmount === 0) {
        job.status = "failed";
        job.result = {
          ...job.result,
          error: "No route found for swap",
          quoteData,
        };
        job.completedAt = Date.now();
        return job;
      }

      job.result = {
        ...job.result,
        quote: quoteData,
        fromToken: params.from,
        toToken: params.to,
        amount: params.amount,
        chainId,
      };
      job.status = "completed";
      job.completedAt = Date.now();
    } catch (err) {
      job.status = "failed";
      job.result = { error: err instanceof Error ? err.message : "Unknown error" };
      job.completedAt = Date.now();
    }

    return job;
  }

  // ---- DeFi deposit (Operator) -------------------------------------------

  async createDepositJob(params: {
    amount: string;
    token: string;
    protocol: string;
  }): Promise<AgentJob> {
    const operator = this.agents["3"];
    const job = this.createJob("deposit", params as Record<string, unknown>, operator?.walletAddress ?? "operator");

    try {
      job.status = "processing";

      // Search for matching DeFi product
      const searchResult = onchainosDefi.search(params.token, config.chainId, "DEX_POOL", params.protocol);
      const searchData = searchResult.data as Record<string, unknown> | undefined;
      const products = (searchData?.list ?? searchData?.products ?? []) as Record<string, unknown>[];

      if (products.length === 0) {
        job.status = "failed";
        job.result = { error: `No DeFi product found for ${params.token} on ${params.protocol}` };
        job.completedAt = Date.now();
        return job;
      }

      const bestProduct = products[0];
      job.result = {
        product: bestProduct,
        token: params.token,
        amount: params.amount,
        protocol: params.protocol,
        message: "DeFi product found. Use deposit calldata endpoint to execute.",
      };
      job.status = "completed";
      job.completedAt = Date.now();
    } catch (err) {
      job.status = "failed";
      job.result = { error: err instanceof Error ? err.message : "Unknown error" };
      job.completedAt = Date.now();
    }

    return job;
  }

  // ---- Portfolio (direct call) -------------------------------------------

  async getPortfolio(walletAddress?: string): Promise<Record<string, unknown>> {
    const executor = this.agents["3"];
    const addr = walletAddress ?? executor?.walletAddress;
    if (!addr) return { error: "No wallet address" };

    const allChains = "ethereum,bsc,polygon,optimism,base,arbitrum,xlayer,avalanche,zksync,fantom";

    let walletBalances: unknown = null;
    try {
      const balResult = onchainosPortfolio.allBalances(addr, allChains);
      if (balResult.success) {
        const raw = balResult.data as Record<string, unknown> | unknown[];
        let assets: Record<string, unknown>[];
        if (raw && !Array.isArray(raw) && Array.isArray((raw as Record<string, unknown>).tokenAssets)) {
          assets = (raw as Record<string, unknown>).tokenAssets as Record<string, unknown>[];
        } else if (Array.isArray(raw)) {
          assets = raw as Record<string, unknown>[];
        } else {
          assets = [];
        }
        walletBalances = assets
          .map((t) => {
            const bal = Number(t.balance ?? 0);
            const price = Number(t.tokenPrice ?? 0);
            return { ...t, tokenAddress: t.tokenContractAddress, balanceUsd: bal * price };
          })
          .filter((t) => t.balanceUsd > 0.01)
          .sort((a, b) => b.balanceUsd - a.balanceUsd);
      }
    } catch { /* silent */ }

    let totalValue: unknown = null;
    try {
      const valResult = onchainosPortfolio.totalValue(addr, allChains);
      if (valResult.success) totalValue = valResult.data;
    } catch { /* silent */ }

    return { walletBalances, totalValue };
  }

  // ---- Discovery (direct call) -------------------------------------------

  async getDiscovery(limit: number = 20): Promise<Record<string, unknown>> {
    const scanner = this.agents["1"] as unknown as ScannerAgent | undefined;
    if (!scanner) return { error: "Scanner agent not available" };

    try {
      const tokens = await scanner.discoverTokens();
      return { tokens: tokens.slice(0, limit) };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Discovery failed" };
    }
  }

  // ---- Job CRUD ----------------------------------------------------------

  getJob(id: string): AgentJob | undefined {
    return this.jobs.get(id);
  }

  getRecentJobs(limit: number = 20): AgentJob[] {
    return [...this.jobs.values()]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  }

  // ---- Private helpers ---------------------------------------------------

  private createJob(
    type: AgentJob["type"],
    params: Record<string, unknown>,
    provider: string,
  ): AgentJob {
    const sentinel = this.agents["1"];
    const job: AgentJob = {
      id: randomUUID(),
      type,
      client: sentinel?.walletAddress ?? "sentinel",
      provider,
      params,
      status: "created",
      createdAt: Date.now(),
    };
    this.jobs.set(job.id, job);
    return job;
  }
}

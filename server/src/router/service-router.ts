import { Router, type Request, type Response } from "express";
import { x402Middleware } from "./x402-middleware.js";
import { type BaseAgent } from "../agents/base-agent.js";
import { type ExecutorAgent } from "../agents/executor-agent.js";
import { verdictStore } from "../verdicts/verdict-store.js";
import { eventBus } from "../events/event-bus.js";
import { settings } from "../settings.js";
import { pendingStore } from "../pending-store.js";
import { type ScannerAgent } from "../agents/scanner-agent.js";
import { onchainosSignal, onchainosSwap, onchainosMarket, onchainosPortfolio, onchainosDefi, onchainosToken, onchainosTrenches, onchainosSecurity, onchainosGateway, onchainosWallet } from "../lib/onchainos.js";
import { config } from "../config.js";
import { getTokenPairs, searchTokens, getTrendingTokens } from "../lib/dexscreener.js";
import { getUniswapPools, getPoolApy } from "../lib/defillama.js";
import { getPool, getPoolInfo, encodeSwapCalldata, factoryAbi } from "../lib/uniswap.js";
import { createPublicClient, http as viemHttp, encodeFunctionData, encodePacked, type Address } from "viem";
import { mainnet, polygon, bsc, arbitrum, optimism, base, xLayer } from "viem/chains";

// ---------------------------------------------------------------------------
// Router factory — accepts agents map from index.ts
// ---------------------------------------------------------------------------

export function createServiceRouter(
  agents: Record<string, BaseAgent>,
): Router {
  const router = Router();

  // -------------------------------------------------------------------------
  // Health
  // -------------------------------------------------------------------------

  router.get("/health", (_req: Request, res: Response): void => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // -------------------------------------------------------------------------
  // Verdicts — free public feed
  // -------------------------------------------------------------------------

  router.get("/verdicts", (req: Request, res: Response): void => {
    const limit = Number(req.query.limit ?? 50);
    const verdicts = verdictStore.getRecent(limit);
    res.json({ verdicts });
  });

  // -------------------------------------------------------------------------
  // Verdict detail — x402 paywall (0.50 USDT)
  // -------------------------------------------------------------------------

  router.get(
    "/verdicts/:token",
    x402Middleware(2, "0.01"),
    async (req: Request, res: Response): Promise<void> => {
      try {
        const { token } = req.params;
        const analyst = agents["2"];
        if (!analyst) {
          res.status(503).json({ error: "Analyst agent not available" });
          return;
        }
        const result = await analyst.execute("report", { token });
        res.json({ verdict: result });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
      }
    },
  );

  // -------------------------------------------------------------------------
  // Manual scan — x402 paywall (0.10 USDT)
  // -------------------------------------------------------------------------

  router.post(
    "/scan/:token",
    x402Middleware(2, "0.01"),
    async (req: Request, res: Response): Promise<void> => {
      try {
        const { token } = req.params;
        const analyst = agents["2"];
        if (!analyst) {
          res.status(503).json({ error: "Analyst agent not available" });
          return;
        }
        const result = await analyst.execute("scan", { token });
        res.json({ verdict: result });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
      }
    },
  );

  // -------------------------------------------------------------------------
  // Agents overview
  // -------------------------------------------------------------------------

  router.get("/agents", async (_req: Request, res: Response): Promise<void> => {
    try {
      const agentList = await Promise.all(
        Object.entries(agents).map(async ([id, agent]) => {
          let usdtBalance = "0";
          try {
            usdtBalance = await agent.wallet.getUsdtBalance();
          } catch {
            // Balance fetch may fail if wallet not configured
          }
          return {
            id,
            name: agent.name,
            walletAddress: agent.walletAddress,
            usdtBalance,
          };
        }),
      );
      res.json({ agents: agentList });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: message });
    }
  });

  // -------------------------------------------------------------------------
  // Portfolio — Executor LP positions
  // -------------------------------------------------------------------------

  router.get("/portfolio", (_req: Request, res: Response): void => {
    const executor = agents["3"] as ExecutorAgent | undefined;
    if (!executor) {
      res.status(503).json({ error: "Executor agent not available" });
      return;
    }

    const positions = executor.lpPositions;
    const totalInvested = positions.reduce(
      (sum, p) => sum + Number(p.amountInvested),
      0,
    );
    const totalApr = positions.length > 0
      ? positions.reduce((sum, p) => sum + Number(p.apr ?? 0), 0) / positions.length
      : 0;

    res.json({
      positions,
      totalInvested,
      totalPositions: positions.length,
      avgApr: totalApr,
      executorAddress: executor.walletAddress,
    });
  });

  // -------------------------------------------------------------------------
  // Stats — verdictStore + eventBus
  // -------------------------------------------------------------------------

  router.get("/stats", (_req: Request, res: Response): void => {
    const verdictStats = verdictStore.getStats();
    const eventStats = eventBus.getStats();
    res.json({ verdicts: verdictStats, events: eventStats });
  });

  // -------------------------------------------------------------------------
  // Event history
  // -------------------------------------------------------------------------

  router.get("/events/history", (req: Request, res: Response): void => {
    const limit = Number(req.query.limit ?? 100);
    res.json({ events: eventBus.getHistory(limit) });
  });

  // -------------------------------------------------------------------------
  // Generic x402 service execution (inter-agent payments)
  // -------------------------------------------------------------------------

  router.post(
    "/services/:serviceId/:action",
    x402Middleware(1, "0.01"),
    async (req: Request, res: Response): Promise<void> => {
      try {
        const { serviceId, action } = req.params;
        const agent = agents[serviceId];

        if (!agent) {
          res.status(404).json({ error: `No agent for service ${serviceId}` });
          return;
        }

        const result = await agent.execute(action, req.body ?? {});

        res.json({
          serviceId: Number(serviceId),
          action,
          paymentVerified: req.paymentVerified ?? false,
          paymentPayer: req.paymentPayer,
          result,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
      }
    },
  );

  // ── DexScreener ──

  router.get("/dex/pairs/:token", async (req: Request, res: Response): Promise<void> => {
    try {
      const pairs = await getTokenPairs("xlayer", req.params.token);
      res.json({ pairs });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  router.get("/dex/search", async (req: Request, res: Response): Promise<void> => {
    try {
      const q = String(req.query.q ?? "");
      if (!q) { res.status(400).json({ error: "q parameter required" }); return; }
      const pairs = await searchTokens(q);
      res.json({ pairs });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  router.get("/dex/trending", async (_req: Request, res: Response): Promise<void> => {
    try {
      const tokens = await getTrendingTokens();
      res.json({ tokens });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  // ── DefiLlama ──

  router.get("/yields", async (req: Request, res: Response): Promise<void> => {
    try {
      const symbol = String(req.query.symbol ?? "");
      const chain = req.query.chain as string | undefined;
      if (symbol) {
        const pool = await getPoolApy(symbol, chain);
        res.json({ pool });
      } else {
        const pools = await getUniswapPools(chain);
        res.json({ pools: pools.slice(0, 50) });
      }
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  // ── Manage ──

  router.get("/manage/portfolio", async (_req: Request, res: Response): Promise<void> => {
    try {
      const executor = agents["3"] as unknown as ExecutorAgent | undefined;
      if (!executor) { res.status(503).json({ error: "Executor not available" }); return; }

      const positions = executor.lpPositions;

      let walletBalances: unknown = null;
      try {
        const balResult = onchainosPortfolio.allBalances(executor.walletAddress);
        if (balResult.success) walletBalances = balResult.data;
      } catch { /* */ }

      let totalValue: unknown = null;
      try {
        const valResult = onchainosPortfolio.totalValue(executor.walletAddress);
        if (valResult.success) totalValue = valResult.data;
      } catch { /* */ }

      let defiPositions: unknown = null;
      try {
        const posResult = onchainosDefi.positions(executor.walletAddress);
        if (posResult.success) defiPositions = posResult.data;
      } catch { /* */ }

      res.json({
        positions,
        totalPositions: positions.length,
        walletBalances,
        totalValue,
        defiPositions,
      });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  router.post("/manage/collect-all", async (_req: Request, res: Response): Promise<void> => {
    try {
      const executor = agents["3"];
      if (!executor) { res.status(503).json({ error: "Executor not available" }); return; }
      const result = await executor.execute("collect", {});
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  router.post("/manage/exit/:investmentId", async (req: Request, res: Response): Promise<void> => {
    try {
      const executor = agents["3"];
      if (!executor) { res.status(503).json({ error: "Executor not available" }); return; }
      const investmentId = Number(req.params.investmentId);
      const ratio = (req.body as Record<string, unknown>)?.ratio as string | undefined;
      const result = await executor.execute("exit", { investmentId, ratio });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  router.get("/manage/balances", async (_req: Request, res: Response): Promise<void> => {
    try {
      const balances: Record<string, unknown> = {};
      for (const [id, agent] of Object.entries(agents)) {
        try {
          const bal = await agent.wallet.getUsdtBalance();
          balances[agent.name] = { id, address: agent.walletAddress, usdtBalance: bal };
        } catch { /* */ }
      }
      res.json({ balances });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  // ── Invest ──

  router.post("/invest/preview", async (req: Request, res: Response): Promise<void> => {
    try {
      const executor = agents["3"];
      if (!executor) { res.status(503).json({ error: "Executor not available" }); return; }
      const { token, amount } = req.body as { token?: string; amount?: string };
      if (!token) { res.status(400).json({ error: "token required" }); return; }
      const result = await executor.execute("preview", { token, amount });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  router.post("/invest/execute", async (req: Request, res: Response): Promise<void> => {
    try {
      const executor = agents["3"];
      if (!executor) { res.status(503).json({ error: "Executor not available" }); return; }
      const { token, amount, tokenSymbol, riskScore } = req.body as {
        token?: string; amount?: string; tokenSymbol?: string; riskScore?: number;
      };
      if (!token) { res.status(400).json({ error: "token required" }); return; }
      const result = await executor.execute("invest", {
        token,
        amount: amount ?? String(settings.get().invest.maxPerPosition),
        tokenSymbol: tokenSymbol ?? token.slice(0, 8),
        riskScore: riskScore ?? 15,
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  // ── Swap helpers ──

  const NATIVE = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
  // WETH/WBNB/WMATIC addresses per chain — Uniswap needs wrapped native
  const WRAPPED_NATIVE: Record<number, string> = {
    1: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",       // WETH Ethereum
    8453: "0x4200000000000000000000000000000000000006",      // WETH Base
    42161: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",    // WETH Arbitrum
    10: "0x4200000000000000000000000000000000000006",        // WETH Optimism
    137: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",     // WMATIC Polygon
    56: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",      // WBNB BSC
    196: "0xe538905cf8410324e03A5A23C1c177a474D59b2b",      // WOKB X Layer
    324: "0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91",     // WETH zkSync
    250: "0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83",     // WFTM Fantom
    43114: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",   // WAVAX Avalanche
  };

  // Convert native address to wrapped for Uniswap, readable amount to wei
  function uniswapToken(addr: string, chainId: number): string {
    return addr.toLowerCase() === NATIVE ? (WRAPPED_NATIVE[chainId] ?? addr) : addr;
  }
  function toWei(readableAmount: string, decimals: number = 18): string {
    const parts = readableAmount.split(".");
    const whole = parts[0] || "0";
    const frac = (parts[1] || "").padEnd(decimals, "0").slice(0, decimals);
    return BigInt(whole + frac).toString();
  }

  async function quoteOkx(from: string, to: string, amount: string, chainId: number): Promise<{ success: boolean; data: unknown }> {
    const result = onchainosSwap.quote(from, to, amount, chainId);
    const d = result.data as Record<string, unknown> | undefined;
    const amt = Number(d?.toTokenAmount ?? (d?.data as Record<string, unknown>)?.toTokenAmount ?? 0);
    return { success: result.success && amt > 0, data: result.data };
  }

  // Uniswap V3 per-chain config
  // SwapRouter02 chains: no `deadline` in exactInputSingle struct, uses multicall(deadline, data[])
  const V2_ROUTER_CHAINS = new Set([8453]);

  const UNI_FACTORY: Record<number, Address> = {
    1: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
    8453: "0x33128a8fC17869897dcE68Ed026d694621f6FDfD",
    42161: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
    10: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
    137: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
    196: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
  };
  const UNI_ROUTER: Record<number, Address> = {
    1: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
    8453: "0x2626664c2603336E57B271c5C0b26F421741e481",
    42161: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
    10: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
    137: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
    196: "0x7078c4537C04c2b2E52ddBa06074dBdACF23cA15",
  };
  const VIEM_CHAINS: Record<number, typeof mainnet> = {
    1: mainnet, 8453: base, 42161: arbitrum, 10: optimism, 137: polygon, 196: xLayer,
  } as unknown as Record<number, typeof mainnet>;
  const FEE_TIERS = [500, 3000, 10000] as const;

  // --- SwapRouter02 ABIs (no deadline in struct) ---
  const routerV2SingleAbi = [{
    name: "exactInputSingle", type: "function", stateMutability: "payable",
    inputs: [{ name: "params", type: "tuple", components: [
      { name: "tokenIn", type: "address" }, { name: "tokenOut", type: "address" },
      { name: "fee", type: "uint24" }, { name: "recipient", type: "address" },
      { name: "amountIn", type: "uint256" }, { name: "amountOutMinimum", type: "uint256" },
      { name: "sqrtPriceLimitX96", type: "uint160" },
    ] }],
    outputs: [{ name: "amountOut", type: "uint256" }],
  }] as const;

  const routerV2ExactInputAbi = [{
    name: "exactInput", type: "function", stateMutability: "payable",
    inputs: [{ name: "params", type: "tuple", components: [
      { name: "path", type: "bytes" }, { name: "recipient", type: "address" },
      { name: "amountIn", type: "uint256" }, { name: "amountOutMinimum", type: "uint256" },
    ] }],
    outputs: [{ name: "amountOut", type: "uint256" }],
  }] as const;

  const multicallAbi = [{
    name: "multicall", type: "function", stateMutability: "payable",
    inputs: [{ name: "deadline", type: "uint256" }, { name: "data", type: "bytes[]" }],
    outputs: [{ name: "results", type: "bytes[]" }],
  }] as const;

  // --- SwapRouter V1 exactInput ABI (with deadline in struct) ---
  const routerV1ExactInputAbi = [{
    name: "exactInput", type: "function", stateMutability: "payable",
    inputs: [{ name: "params", type: "tuple", components: [
      { name: "path", type: "bytes" }, { name: "recipient", type: "address" },
      { name: "deadline", type: "uint256" },
      { name: "amountIn", type: "uint256" }, { name: "amountOutMinimum", type: "uint256" },
    ] }],
    outputs: [{ name: "amountOut", type: "uint256" }],
  }] as const;

  // --- Caches (TTL-based) ---
  const decimalsCache = new Map<string, number>();
  const poolCache = new Map<string, { addr: Address; fee: number; ts: number }>();
  const POOL_CACHE_TTL = 60_000; // 1 min
  const clientCache = new Map<number, ReturnType<typeof createPublicClient>>();

  // Read ERC20 decimals on-chain (cached permanently — decimals never change)
  const erc20DecimalsAbi = [{ name: "decimals", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] }] as const;
  async function getTokenDecimals(client: ReturnType<typeof createPublicClient>, token: Address, originalAddr: string): Promise<number> {
    if (originalAddr.toLowerCase() === NATIVE) return 18;
    const key = token.toLowerCase();
    if (decimalsCache.has(key)) return decimalsCache.get(key)!;
    try {
      const d = await client.readContract({ address: token, abi: erc20DecimalsAbi, functionName: "decimals" });
      const val = Number(d);
      decimalsCache.set(key, val);
      return val;
    } catch { return 18; }
  }

  function getUniPublicClient(chainId: number) {
    const chain = VIEM_CHAINS[chainId];
    if (!chain) return null;
    // Reuse client per chain (avoids re-creating transport)
    if (clientCache.has(chainId)) return clientCache.get(chainId)!;
    const rpcUrl = chainId === 196 ? config.xlayerRpcUrl : undefined;
    const c = createPublicClient({ chain, transport: viemHttp(rpcUrl), batch: { multicall: true } });
    clientCache.set(chainId, c);
    return c;
  }

  // Find best pool — highest estimated output across fee tiers (uses multicall batching)
  async function findBestPool(client: ReturnType<typeof createPublicClient>, factoryAddr: Address, tokenA: Address, tokenB: Address, amountIn?: bigint, chainId?: number) {
    // Check pool address cache first (avoids 3 getPool RPC calls)
    const pairKey = [tokenA, tokenB].map(a => a.toLowerCase()).sort().join("-");
    const cached = poolCache.get(pairKey);
    if (cached && Date.now() - cached.ts < POOL_CACHE_TTL) {
      try {
        const info = await getPoolInfo(client as never, cached.addr);
        if (info.liquidity > 0n) return { pool: cached.addr, fee: cached.fee, info };
      } catch { /* cache miss, re-fetch */ }
    }

    // Step 1: batch getPool calls (multicall batches into single RPC)
    const poolAddrs = await Promise.all(
      FEE_TIERS.map(async (fee) => {
        try {
          const pool = await client.readContract({ address: factoryAddr, abi: factoryAbi, functionName: "getPool", args: [tokenA, tokenB, fee] }) as Address;
          return (!pool || pool === "0x0000000000000000000000000000000000000000") ? null : { pool, fee };
        } catch (e) {
          console.warn(`[uniswap] getPool fee=${fee}:`, e instanceof Error ? e.message : e);
          return null;
        }
      }),
    );
    const found = poolAddrs.filter((r): r is NonNullable<typeof r> => r !== null);
    if (found.length === 0) return null;

    // Step 2: get info for all found pools (multicall batches these too)
    const infos = await Promise.all(
      found.map(async ({ pool, fee }) => {
        try {
          const info = await getPoolInfo(client as never, pool);
          return info.liquidity > 0n ? { pool, fee, info } : null;
        } catch (e) {
          console.warn(`[uniswap] poolInfo ${pool}:`, e instanceof Error ? e.message : e);
          return null;
        }
      }),
    );
    const valid = infos.filter((r): r is NonNullable<typeof r> => r !== null);
    if (valid.length === 0) return null;

    // Pick pool with best REAL output via QuoterV2 (accounts for liquidity depth + price impact)
    let best;
    const quoter = chainId ? UNI_QUOTER[chainId] : undefined;
    if (amountIn && amountIn > 0n && quoter) {
      const withOutput = await Promise.all(valid.map(async (v) => {
        try {
          const { result } = await client.simulateContract({
            address: quoter, abi: quoterSingleAbi, functionName: "quoteExactInputSingle",
            args: [{ tokenIn: tokenA, tokenOut: tokenB, amountIn, fee: v.fee, sqrtPriceLimitX96: 0n }],
          });
          return { ...v, estOut: result[0] };
        } catch {
          // Quoter failed for this pool — use marginal estimate as fallback
          const feeAdj = amountIn * (1000000n - BigInt(v.fee)) / 1000000n;
          return { ...v, estOut: estimateOutput(v.info.sqrtPriceX96, feeAdj, v.info.token0, tokenA) };
        }
      }));
      withOutput.sort((a, b) => (b.estOut > a.estOut ? 1 : -1));
      best = withOutput[0];
    } else if (amountIn && amountIn > 0n) {
      const withOutput = valid.map((v) => {
        const feeAdj = amountIn * (1000000n - BigInt(v.fee)) / 1000000n;
        return { ...v, estOut: estimateOutput(v.info.sqrtPriceX96, feeAdj, v.info.token0, tokenA) };
      });
      withOutput.sort((a, b) => (b.estOut > a.estOut ? 1 : -1));
      best = withOutput[0];
    } else {
      valid.sort((a, b) => (b.info.liquidity > a.info.liquidity ? 1 : -1));
      best = valid[0];
    }
    // Cache the winning pool
    poolCache.set(pairKey, { addr: best.pool, fee: best.fee, ts: Date.now() });
    return best;
  }

  // Multi-hop via WETH: tokenIn → WETH → tokenOut
  async function findMultiHopRoute(client: ReturnType<typeof createPublicClient>, factoryAddr: Address, tokenIn: Address, tokenOut: Address, chainId: number) {
    const weth = WRAPPED_NATIVE[chainId];
    if (!weth) return null;
    const wethAddr = weth as Address;
    if (tokenIn.toLowerCase() === wethAddr.toLowerCase() || tokenOut.toLowerCase() === wethAddr.toLowerCase()) return null;
    const [hop1, hop2] = await Promise.all([
      findBestPool(client, factoryAddr, tokenIn, wethAddr),
      findBestPool(client, factoryAddr, wethAddr, tokenOut),
    ]);
    if (!hop1 || !hop2) return null;
    return { hop1, hop2, weth: wethAddr };
  }

  // Calculate expected output from sqrtPriceX96 (fallback, inaccurate for concentrated liquidity)
  function estimateOutput(sqrtPriceX96: bigint, amountIn: bigint, token0: Address, tokenIn: Address): bigint {
    const Q96 = 2n ** 96n;
    if (tokenIn.toLowerCase() === token0.toLowerCase()) {
      return (amountIn * sqrtPriceX96 * sqrtPriceX96) / (Q96 * Q96);
    } else {
      if (sqrtPriceX96 === 0n) return 0n;
      return (amountIn * Q96 * Q96) / (sqrtPriceX96 * sqrtPriceX96);
    }
  }

  // --- QuoterV2: precise on-chain swap simulation ---
  const UNI_QUOTER: Record<number, Address> = {
    1: "0x61fFE014bA17989E743c5F6cB21bF9697530B21e",
    8453: "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a",
    42161: "0x61fFE014bA17989E743c5F6cB21bF9697530B21e",
    10: "0x61fFE014bA17989E743c5F6cB21bF9697530B21e",
    137: "0x61fFE014bA17989E743c5F6cB21bF9697530B21e",
  };
  const quoterSingleAbi = [{
    name: "quoteExactInputSingle", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "params", type: "tuple", components: [
      { name: "tokenIn", type: "address" }, { name: "tokenOut", type: "address" },
      { name: "amountIn", type: "uint256" }, { name: "fee", type: "uint24" },
      { name: "sqrtPriceLimitX96", type: "uint160" },
    ] }],
    outputs: [
      { name: "amountOut", type: "uint256" }, { name: "sqrtPriceX96After", type: "uint160" },
      { name: "initializedTicksCrossed", type: "uint32" }, { name: "gasEstimate", type: "uint256" },
    ],
  }] as const;
  const quoterMultiAbi = [{
    name: "quoteExactInput", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "path", type: "bytes" }, { name: "amountIn", type: "uint256" }],
    outputs: [
      { name: "amountOut", type: "uint256" }, { name: "sqrtPriceX96AfterList", type: "uint160[]" },
      { name: "initializedTicksCrossedList", type: "uint32[]" }, { name: "gasEstimate", type: "uint256" },
    ],
  }] as const;

  /** Get precise quote via QuoterV2, fallback to sqrtPriceX96 estimate */
  async function getQuote(client: ReturnType<typeof createPublicClient>, chainId: number,
    tokenIn: Address, tokenOut: Address, amountIn: bigint, fee: number, poolInfo: { sqrtPriceX96: bigint; token0: Address }): Promise<bigint> {
    const quoter = UNI_QUOTER[chainId];
    if (quoter) {
      try {
        const { result } = await client.simulateContract({
          address: quoter, abi: quoterSingleAbi, functionName: "quoteExactInputSingle",
          args: [{ tokenIn, tokenOut, amountIn, fee, sqrtPriceLimitX96: 0n }],
        });
        return result[0];
      } catch (e) {
        console.warn(`[uniswap] quoter failed, using estimate:`, e instanceof Error ? e.message.slice(0, 100) : e);
      }
    }
    // Fallback: sqrtPriceX96 estimate with fee deduction
    const feeAdj = amountIn * (1000000n - BigInt(fee)) / 1000000n;
    return estimateOutput(poolInfo.sqrtPriceX96, feeAdj, poolInfo.token0, tokenIn);
  }

  /** Get precise multi-hop quote via QuoterV2 */
  async function getMultiHopQuote(client: ReturnType<typeof createPublicClient>, chainId: number,
    tokenIn: Address, tokenOut: Address, weth: Address, amountIn: bigint,
    fee1: number, fee2: number, hop1Info: { sqrtPriceX96: bigint; token0: Address }, hop2Info: { sqrtPriceX96: bigint; token0: Address }): Promise<bigint> {
    const quoter = UNI_QUOTER[chainId];
    if (quoter) {
      try {
        const path = encodePacked(["address", "uint24", "address", "uint24", "address"], [tokenIn, fee1, weth, fee2, tokenOut]);
        const { result } = await client.simulateContract({
          address: quoter, abi: quoterMultiAbi, functionName: "quoteExactInput",
          args: [path, amountIn],
        });
        return result[0];
      } catch (e) {
        console.warn(`[uniswap] quoter multi-hop failed, using estimate:`, e instanceof Error ? e.message.slice(0, 100) : e);
      }
    }
    // Fallback
    const feeAdj1 = amountIn * (1000000n - BigInt(fee1)) / 1000000n;
    const hop1Out = estimateOutput(hop1Info.sqrtPriceX96, feeAdj1, hop1Info.token0, tokenIn);
    const feeAdj2 = hop1Out * (1000000n - BigInt(fee2)) / 1000000n;
    return estimateOutput(hop2Info.sqrtPriceX96, feeAdj2, hop2Info.token0, weth);
  }

  // Encode single-hop swap calldata (handles V1 vs V2 router)
  function encodeSingleSwap(p: {
    tokenIn: Address; tokenOut: Address; fee: number;
    recipient: Address; deadline: bigint;
    amountIn: bigint; amountOutMinimum: bigint;
  }, chainId: number): `0x${string}` {
    if (V2_ROUTER_CHAINS.has(chainId)) {
      const inner = encodeFunctionData({
        abi: routerV2SingleAbi, functionName: "exactInputSingle",
        args: [{ tokenIn: p.tokenIn, tokenOut: p.tokenOut, fee: p.fee,
          recipient: p.recipient, amountIn: p.amountIn,
          amountOutMinimum: p.amountOutMinimum, sqrtPriceLimitX96: 0n }],
      });
      return encodeFunctionData({ abi: multicallAbi, functionName: "multicall", args: [p.deadline, [inner]] });
    }
    return encodeSwapCalldata(p);
  }

  // Encode multi-hop swap calldata (handles V1 vs V2 router)
  function encodeMultiHopSwap(p: {
    tokenIn: Address; tokenOut: Address; weth: Address;
    fee1: number; fee2: number;
    recipient: Address; deadline: bigint;
    amountIn: bigint; amountOutMinimum: bigint;
  }, chainId: number): `0x${string}` {
    const path = encodePacked(
      ["address", "uint24", "address", "uint24", "address"],
      [p.tokenIn, p.fee1, p.weth, p.fee2, p.tokenOut],
    );
    if (V2_ROUTER_CHAINS.has(chainId)) {
      const inner = encodeFunctionData({
        abi: routerV2ExactInputAbi, functionName: "exactInput",
        args: [{ path, recipient: p.recipient, amountIn: p.amountIn, amountOutMinimum: p.amountOutMinimum }],
      });
      return encodeFunctionData({ abi: multicallAbi, functionName: "multicall", args: [p.deadline, [inner]] });
    }
    return encodeFunctionData({
      abi: routerV1ExactInputAbi, functionName: "exactInput",
      args: [{ path, recipient: p.recipient, deadline: p.deadline, amountIn: p.amountIn, amountOutMinimum: p.amountOutMinimum }],
    });
  }

  async function quoteUniswap(from: string, to: string, amount: string, chainId: number, _wallet: string, fromDecimals: number = 18) {
    const client = getUniPublicClient(chainId);
    const factory = UNI_FACTORY[chainId];
    if (!client || !factory) {
      console.warn(`[uniswap] chain ${chainId} not configured`);
      return null;
    }

    const tokenIn = uniswapToken(from, chainId) as Address;
    const tokenOut = uniswapToken(to, chainId) as Address;
    const amountInWei = BigInt(toWei(amount, fromDecimals));
    const toDecimals = await getTokenDecimals(client, tokenOut, to);

    // Try direct pool (pass amountIn for best output comparison)
    const best = await findBestPool(client, factory, tokenIn, tokenOut, amountInWei, chainId);
    if (best) {
      const estOut = await getQuote(client, chainId, tokenIn, tokenOut, amountInWei, best.fee, best.info);
      return {
        success: true, source: "uniswap" as const,
        data: { fromTokenAmount: amountInWei.toString(), toTokenAmount: estOut.toString(),
          fromToken: { address: from, decimal: fromDecimals }, toToken: { address: to, decimal: toDecimals },
          fee: best.fee, route: "direct" },
      };
    }

    // Fallback: multi-hop via WETH
    const mh = await findMultiHopRoute(client, factory, tokenIn, tokenOut, chainId);
    if (mh) {
      const hop2Out = await getMultiHopQuote(client, chainId, tokenIn, tokenOut, mh.weth, amountInWei,
        mh.hop1.fee, mh.hop2.fee, mh.hop1.info, mh.hop2.info);
      return {
        success: true, source: "uniswap" as const,
        data: { fromTokenAmount: amountInWei.toString(), toTokenAmount: hop2Out.toString(),
          fromToken: { address: from, decimal: fromDecimals }, toToken: { address: to, decimal: toDecimals },
          fee: mh.hop1.fee, route: "multi-hop",
          hops: [{ fee: mh.hop1.fee, via: mh.weth }, { fee: mh.hop2.fee }] },
      };
    }

    console.warn(`[uniswap] no route: ${from} → ${to} on chain ${chainId}`);
    return null;
  }

  async function calldataOkx(from: string, to: string, amount: string, wallet: string, chainId: number, slippage?: string): Promise<{ success: boolean; data: unknown }> {
    const result = onchainosSwap.swap(from, to, amount, wallet, chainId, slippage);
    const d = result.data as Record<string, unknown> | undefined;
    const hasTx = d?.to || d?.data || (d?.tx as Record<string, unknown>)?.to;
    return { success: result.success && !!hasTx, data: result.data };
  }

  async function calldataUniswap(from: string, to: string, amount: string, wallet: string, chainId: number, slippage?: string, fromDecimals: number = 18) {
    const client = getUniPublicClient(chainId);
    const factory = UNI_FACTORY[chainId];
    const routerAddr = UNI_ROUTER[chainId];
    if (!client || !factory || !routerAddr) return null;

    const isNative = from.toLowerCase() === NATIVE;
    const tokenIn = uniswapToken(from, chainId) as Address;
    const tokenOut = uniswapToken(to, chainId) as Address;
    const amountInWei = BigInt(toWei(amount, fromDecimals));
    const slippagePct = slippage ? Number(slippage) : 0.5;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800);

    // Try direct pool — use QuoterV2 for precise output
    const best = await findBestPool(client, factory, tokenIn, tokenOut, amountInWei, chainId);
    if (best) {
      const estOut = await getQuote(client, chainId, tokenIn, tokenOut, amountInWei, best.fee, best.info);
      const minOut = estOut * BigInt(Math.floor((100 - slippagePct) * 100)) / 10000n;
      const calldata = encodeSingleSwap({
        tokenIn, tokenOut, fee: best.fee, recipient: wallet as Address,
        deadline, amountIn: amountInWei, amountOutMinimum: minOut,
      }, chainId);
      return { success: true, data: { tx: { to: routerAddr, data: calldata,
        value: isNative ? amountInWei.toString() : "0", gasLimit: "300000" } } };
    }

    // Fallback: multi-hop via WETH — use QuoterV2
    const mh = await findMultiHopRoute(client, factory, tokenIn, tokenOut, chainId);
    if (mh) {
      const hop2Out = await getMultiHopQuote(client, chainId, tokenIn, tokenOut, mh.weth, amountInWei,
        mh.hop1.fee, mh.hop2.fee, mh.hop1.info, mh.hop2.info);
      const minOut = hop2Out * BigInt(Math.floor((100 - slippagePct) * 100)) / 10000n;
      const calldata = encodeMultiHopSwap({
        tokenIn, tokenOut, weth: mh.weth,
        fee1: mh.hop1.fee, fee2: mh.hop2.fee,
        recipient: wallet as Address, deadline,
        amountIn: amountInWei, amountOutMinimum: minOut,
      }, chainId);
      return { success: true, data: { tx: { to: routerAddr, data: calldata,
        value: isNative ? amountInWei.toString() : "0", gasLimit: "500000" } } };
    }

    console.warn(`[uniswap] no calldata route: ${from} → ${to} on chain ${chainId}`);
    return null;
  }

  // Swap quote — ?router=okx|uniswap|auto (default: auto)
  router.get("/swap/quote", async (_req: Request, res: Response): Promise<void> => {
    try {
      const from = String(_req.query.from ?? "");
      const to = String(_req.query.to ?? "");
      const amount = String(_req.query.amount ?? "");
      const chainId = _req.query.chainId ? Number(_req.query.chainId) : config.chainId;
      const preferredRouter = String(_req.query.router ?? "auto");
      const wallet = String(_req.query.wallet ?? "0x0000000000000000000000000000000000000000");
      const fromDecimals = _req.query.fromDecimals ? Number(_req.query.fromDecimals) : 18;
      if (!from || !to || !amount) { res.status(400).json({ error: "from, to, amount required" }); return; }

      if (preferredRouter === "okx") {
        const r = await quoteOkx(from, to, amount, chainId);
        res.json({ ...r, source: "okx" });
        return;
      }
      if (preferredRouter === "uniswap") {
        const r = await quoteUniswap(from, to, amount, chainId, wallet, fromDecimals);
        res.json(r ?? { success: false, error: "No Uniswap route" });
        return;
      }

      // auto: OKX first, fallback Uniswap
      const okx = await quoteOkx(from, to, amount, chainId);
      if (okx.success) { res.json({ ...okx, source: "okx" }); return; }
      const uni = await quoteUniswap(from, to, amount, chainId, wallet, fromDecimals);
      if (uni) { res.json(uni); return; }
      res.json({ success: false, data: okx.data, error: "No route found" });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  // Swap calldata — ?router=okx|uniswap|auto (default: auto)
  router.get("/swap/calldata", async (_req: Request, res: Response): Promise<void> => {
    try {
      const from = String(_req.query.from ?? "");
      const to = String(_req.query.to ?? "");
      const amount = String(_req.query.amount ?? "");
      const wallet = String(_req.query.wallet ?? "");
      const chainId = _req.query.chainId ? Number(_req.query.chainId) : config.chainId;
      const slippage = _req.query.slippage ? String(_req.query.slippage) : undefined;
      const preferredRouter = String(_req.query.router ?? "auto");
      const fromDecimals = _req.query.fromDecimals ? Number(_req.query.fromDecimals) : 18;
      if (!from || !to || !amount || !wallet) { res.status(400).json({ error: "from, to, amount, wallet required" }); return; }

      if (preferredRouter === "okx") {
        const r = await calldataOkx(from, to, amount, wallet, chainId, slippage);
        res.json({ ...r, source: "okx" });
        return;
      }
      if (preferredRouter === "uniswap") {
        const r = await calldataUniswap(from, to, amount, wallet, chainId, slippage, fromDecimals);
        res.json(r ?? { success: false, error: "No Uniswap route" });
        return;
      }

      // auto: OKX first, fallback Uniswap
      const okx = await calldataOkx(from, to, amount, wallet, chainId, slippage);
      if (okx.success) { res.json({ ...okx, source: "okx" }); return; }
      const uni = await calldataUniswap(from, to, amount, wallet, chainId, slippage, fromDecimals);
      if (uni) { res.json({ ...uni, source: "uniswap" }); return; }
      res.json({ success: false, error: "Calldata generation failed on both routers" });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  // Wallet balance for a specific token (or native) — supports ?chainId=
  router.get("/wallet/balance", (_req: Request, res: Response): void => {
    try {
      const tokenAddress = _req.query.token ? String(_req.query.token) : undefined;
      const chainId = _req.query.chainId ? Number(_req.query.chainId) : config.chainId;
      const result = onchainosWallet.balance(chainId, tokenAddress);
      res.json({ success: result.success, data: result.data });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  // All token balances on a chain (for swap panel token list)
  router.get("/wallet/token-balances", (_req: Request, res: Response): void => {
    try {
      const chainId = _req.query.chainId ? Number(_req.query.chainId) : config.chainId;
      const result = onchainosWallet.balance(chainId);
      res.json({ success: result.success, data: result.data });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  // Popular/hot tokens on a chain
  router.get("/tokens/popular", (_req: Request, res: Response): void => {
    try {
      const chainId = _req.query.chainId ? Number(_req.query.chainId) : config.chainId;
      const result = onchainosToken.hotTokens(chainId);
      res.json({ success: result.success, data: result.data });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  router.post("/invest/swap", async (req: Request, res: Response): Promise<void> => {
    try {
      const { fromToken, toToken, amount } = req.body as {
        fromToken?: string; toToken?: string; amount?: string;
      };
      if (!fromToken || !toToken || !amount) {
        res.status(400).json({ error: "fromToken, toToken, amount required" });
        return;
      }
      const executor = agents["3"] as unknown as { walletAddress: string } | undefined;
      if (!executor) { res.status(503).json({ error: "Executor not available" }); return; }

      const result = onchainosSwap.execute(
        fromToken, toToken, amount, executor.walletAddress, config.chainId,
      );
      res.json({ success: result.success, data: result.data, error: result.success ? undefined : "Swap failed" });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  // ── Swap pre-flight security (GoPlus — fast, lightweight) ──

  const KNOWN_SAFE: Record<string, string> = {
    "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": "USDC",
    "0xfde4c96c8593536e31f229ea8f37b2ada2699bb2": "USDT",
    "0x50c5725949a6f0c72e6c4a641f24049a917db0cb": "DAI",
    "0x4200000000000000000000000000000000000006": "WETH",
    "0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22": "cbETH",
    "0xc1cba3fcea344f92d9239c08c0568f6f2f0ee452": "wstETH",
    "0x940181a94a35a4569e4529a3cdfb74e38fd98631": "AERO",
    "0x532f27101965dd16442e59d40670faf5ebb142e4": "BRETT",
    "0x4ed4e862860bed51a9570b96d89af5e1b0efefed": "DEGEN",
    "0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b": "VIRTUAL",
    "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf": "cbBTC",
    "0x0000000000000000000000000000000000000000": "ETH",
    "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee": "ETH",
  };
  const goplusCache = new Map<string, { data: unknown; ts: number }>();
  const GOPLUS_TTL = 5 * 60_000; // 5 min

  router.get("/swap/security/:token", async (req: Request, res: Response): Promise<void> => {
    try {
      const token = req.params.token.toLowerCase();
      const chainId = Number(req.query.chainId ?? 8453);

      // Whitelist — instant safe
      if (KNOWN_SAFE[token]) {
        res.json({ verdict: "SAFE", riskScore: 0, tokenSymbol: KNOWN_SAFE[token], warnings: [], cached: true });
        return;
      }

      // Cache check
      const cacheKey = `${chainId}:${token}`;
      const cached = goplusCache.get(cacheKey);
      if (cached && Date.now() - cached.ts < GOPLUS_TTL) {
        res.json(cached.data);
        return;
      }

      // GoPlus API
      const gpRes = await fetch(`https://api.gopluslabs.io/api/v1/token_security/${chainId}?contract_addresses=${token}`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      if (!gpRes.ok) {
        res.json({ verdict: "UNKNOWN", riskScore: 30, warnings: ["Security API unavailable"], cached: false });
        return;
      }
      const gpData = await gpRes.json() as Record<string, unknown>;
      const info = ((gpData.result as Record<string, unknown>) ?? {})[token] as Record<string, unknown> | undefined;
      if (!info) {
        res.json({ verdict: "UNKNOWN", riskScore: 30, warnings: ["Token not found in GoPlus"], cached: false });
        return;
      }

      // Score calculation (adapted from Button project)
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
      const renounced = ownerAddr === "0x0000000000000000000000000000000000000000" || ownerAddr === "0x000000000000000000000000000000000000dEaD";

      // Trust list / CEX listed → safe
      if (trustList) { score = 0; }
      else {
        if (fakeToken) { score += 60; warnings.push("Fake token"); }
        if (isHoneypot) { score += 50; warnings.push("Honeypot — cannot sell"); }
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
        // Bonuses
        if (renounced) { score -= 15; }
        if (isOpenSource) { score -= 5; }
        if (holderCount > 1000) { score -= 10; }
        else if (holderCount > 100) { score -= 5; }
      }
      score = Math.max(0, Math.min(100, score));

      const verdict = score <= 9 ? "SAFE" : score <= 29 ? "LOW" : score <= 49 ? "CAUTION" : "DANGEROUS";
      const result = {
        verdict, riskScore: score, warnings, cached: false,
        tokenSymbol: String(info.token_symbol ?? ""),
        isHoneypot, buyTax, sellTax, holderCount,
      };

      goplusCache.set(cacheKey, { data: { ...result, cached: true }, ts: Date.now() });
      res.json(result);
    } catch (error) {
      res.json({ verdict: "UNKNOWN", riskScore: 30, warnings: ["Check failed"], cached: false });
    }
  });

  // ── Analyze (full agent scan) ──

  router.get("/analyze/:token", async (req: Request, res: Response): Promise<void> => {
    try {
      const { token } = req.params;
      const analyst = agents["2"];
      if (!analyst) { res.status(503).json({ error: "Analyst not available" }); return; }

      const cached = verdictStore.getByToken(token);
      if (cached && !req.query.fresh) {
        res.json({ verdict: cached, cached: true });
        return;
      }

      const result = await analyst.execute("scan", { token });
      res.json({ verdict: result, cached: false });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  router.post("/analyze/:token/rescan", async (req: Request, res: Response): Promise<void> => {
    try {
      const { token } = req.params;
      const analyst = agents["2"];
      if (!analyst) { res.status(503).json({ error: "Analyst not available" }); return; }
      const result = await analyst.execute("scan", { token });
      res.json({ verdict: result });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  // ── Settings ──

  router.get("/settings", (_req: Request, res: Response): void => {
    res.json(settings.get());
  });

  router.patch("/settings", (req: Request, res: Response): void => {
    const updated = settings.update(req.body ?? {});
    res.json(updated);
  });

  // ── Discover ──

  router.get("/discover/feed", async (req: Request, res: Response): Promise<void> => {
    try {
      const scanner = agents["1"] as unknown as ScannerAgent | undefined;
      if (!scanner) { res.status(503).json({ error: "Scanner not available" }); return; }
      const tokens = await scanner.discoverTokens();
      const limit = Number(req.query.limit ?? 50);
      res.json({ tokens: tokens.slice(0, limit) });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  router.get("/discover/whales", async (req: Request, res: Response): Promise<void> => {
    try {
      const limit = Number(req.query.limit ?? 20);
      const signals: Array<Record<string, unknown>> = [];

      // Tracker activities: smart_money, kol
      for (const tracker of ["smart_money", "kol"]) {
        try {
          const result = await onchainosSignal.activities(tracker);
          if (result.success && Array.isArray(result.data)) {
            for (const s of result.data as Array<Record<string, unknown>>) {
              signals.push({ ...s, tracker });
            }
          }
        } catch { /* tracker unavailable */ }
      }

      // Signal list: smart_money (1), kol (2), whale (3)
      for (const [wt, label] of [["1", "signal_smart_money"], ["2", "signal_kol"], ["3", "signal_whale"]] as const) {
        try {
          const result = await onchainosSignal.list(196, wt);
          if (result.success && Array.isArray(result.data)) {
            for (const s of result.data as Array<Record<string, unknown>>) {
              signals.push({ ...s, tracker: label });
            }
          }
        } catch { /* */ }
      }

      res.json({ signals: signals.slice(0, limit) });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  router.post("/discover/scan", async (_req: Request, res: Response): Promise<void> => {
    try {
      const scanner = agents["1"] as unknown as ScannerAgent | undefined;
      if (!scanner) { res.status(503).json({ error: "Scanner not available" }); return; }
      const tokens = await scanner.autonomousLoop();
      res.json({ triggered: true, tokensFound: tokens.length, tokens });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  // ── Pending ──

  router.get("/pending/analyze", (_req: Request, res: Response): void => {
    res.json({ tokens: pendingStore.getByStatus("awaiting_analyze") });
  });

  router.get("/pending/invest", (_req: Request, res: Response): void => {
    res.json({ tokens: pendingStore.getByStatus("awaiting_invest") });
  });

  router.post("/pending/analyze/:token/approve", async (req: Request, res: Response): Promise<void> => {
    try {
      const { token } = req.params;
      const analyst = agents["2"];
      if (!analyst) { res.status(503).json({ error: "Analyst not available" }); return; }
      const result = await analyst.execute("scan", { token });
      pendingStore.remove(token);
      res.json({ result });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  router.post("/pending/invest/:token/approve", async (req: Request, res: Response): Promise<void> => {
    try {
      const { token } = req.params;
      const pending = pendingStore.get(token);
      const executor = agents["3"];
      if (!executor) { res.status(503).json({ error: "Executor not available" }); return; }
      const amount = String(settings.get().invest.maxPerPosition);
      const result = await executor.execute("invest", {
        token,
        tokenSymbol: pending?.verdict?.tokenSymbol ?? token.slice(0, 8),
        riskScore: pending?.verdict?.riskScore ?? 0,
        amount,
      });
      pendingStore.remove(token);
      res.json({ result });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  router.delete("/pending/:token", (req: Request, res: Response): void => {
    const removed = pendingStore.remove(req.params.token);
    res.json({ removed });
  });

  // ── Token Intelligence ──

  router.get("/token/holders/:token", (_req: Request, res: Response): void => {
    try {
      const tagFilter = _req.query.tag ? Number(_req.query.tag) : undefined;
      const result = onchainosToken.holders(_req.params.token, config.chainId, tagFilter);
      res.json({ success: result.success, data: result.data });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  router.get("/token/top-traders/:token", (_req: Request, res: Response): void => {
    try {
      const tagFilter = _req.query.tag ? Number(_req.query.tag) : undefined;
      const result = onchainosToken.topTrader(_req.params.token, config.chainId, tagFilter);
      res.json({ success: result.success, data: result.data });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  router.get("/token/trades/:token", (_req: Request, res: Response): void => {
    try {
      const limit = _req.query.limit ? Number(_req.query.limit) : undefined;
      const tagFilter = _req.query.tag ? Number(_req.query.tag) : undefined;
      const result = onchainosToken.trades(_req.params.token, config.chainId, limit, tagFilter);
      res.json({ success: result.success, data: result.data });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  router.get("/token/cluster/:token", (_req: Request, res: Response): void => {
    try {
      const result = onchainosToken.clusterOverview(_req.params.token, config.chainId);
      res.json({ success: result.success, data: result.data });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  router.get("/token/cluster-holders/:token", (req: Request, res: Response): void => {
    try {
      const range = String(req.query.range ?? "3");
      const result = onchainosToken.clusterTopHolders(req.params.token, range, config.chainId);
      res.json({ success: result.success, data: result.data });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  router.get("/token/info/:token", (_req: Request, res: Response): void => {
    try {
      const chainId = _req.query.chainId ? Number(_req.query.chainId) : config.chainId;
      const result = onchainosToken.info(_req.params.token, chainId);
      res.json({ success: result.success, data: result.data });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  router.get("/token/cluster-supported-chains", (_req: Request, res: Response): void => {
    try {
      const result = onchainosToken.clusterSupportedChains();
      res.json({ success: result.success, data: result.data });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  // ── Market ──

  router.get("/market/index/:token", (_req: Request, res: Response): void => {
    try {
      const result = onchainosMarket.index(_req.params.token, config.chainId);
      res.json({ success: result.success, data: result.data });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  // ── Trenches Intelligence ──

  router.get("/trenches/dev-info/:token", (_req: Request, res: Response): void => {
    try {
      const result = onchainosTrenches.tokenDevInfo(_req.params.token, config.chainId);
      res.json({ success: result.success, data: result.data });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  router.get("/trenches/similar/:token", (_req: Request, res: Response): void => {
    try {
      const result = onchainosTrenches.similarTokens(_req.params.token, config.chainId);
      res.json({ success: result.success, data: result.data });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  router.get("/trenches/aped/:token", (_req: Request, res: Response): void => {
    try {
      const result = onchainosTrenches.apedWallet(_req.params.token, config.chainId);
      res.json({ success: result.success, data: result.data });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  router.get("/trenches/bundle/:token", (_req: Request, res: Response): void => {
    try {
      const result = onchainosTrenches.tokenBundleInfo(_req.params.token, config.chainId);
      res.json({ success: result.success, data: result.data });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  // ── Leaderboard ──

  router.get("/leaderboard", (_req: Request, res: Response): void => {
    try {
      const timeFrame = String(_req.query.timeFrame ?? "3");
      const sortBy = String(_req.query.sortBy ?? "1");
      const walletType = _req.query.walletType ? String(_req.query.walletType) : undefined;
      const result = onchainosSignal.leaderboardList(config.chainId, timeFrame, sortBy, walletType);
      res.json({ success: result.success, data: result.data });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  // ── Gateway ──

  router.get("/gateway/gas", (_req: Request, res: Response): void => {
    try {
      const result = onchainosGateway.gas(config.chainId);
      res.json({ success: result.success, data: result.data });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  router.post("/gateway/simulate", (req: Request, res: Response): void => {
    try {
      const { from, to, data } = req.body as { from?: string; to?: string; data?: string };
      if (!from || !to || !data) { res.status(400).json({ error: "from, to, data required" }); return; }
      const result = onchainosGateway.simulate(from, to, data, config.chainId);
      res.json({ success: result.success, data: result.data });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  // ── Security ──

  router.get("/security/dapp-scan", (_req: Request, res: Response): void => {
    try {
      const domain = String(_req.query.domain ?? _req.query.url ?? "");
      if (!domain) { res.status(400).json({ error: "domain required" }); return; }
      const result = onchainosSecurity.dappScan(domain);
      res.json({ success: result.success, data: result.data });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  router.get("/security/approvals/:address", (_req: Request, res: Response): void => {
    try {
      const chainId = _req.query.chain ? Number(_req.query.chain) : undefined;
      const limit = _req.query.limit ? Number(_req.query.limit) : undefined;
      const cursor = _req.query.cursor ? String(_req.query.cursor) : undefined;
      const result = onchainosSecurity.approvals(_req.params.address, chainId, limit, cursor);
      res.json({ success: result.success, data: result.data });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  // ── Portfolio PnL ──

  router.get("/portfolio/overview", (_req: Request, res: Response): void => {
    try {
      const executor = agents["3"] as unknown as { walletAddress: string } | undefined;
      if (!executor) { res.status(503).json({ error: "Executor not available" }); return; }
      const timeFrame = String(_req.query.timeFrame ?? "7d");
      const result = onchainosPortfolio.overview(executor.walletAddress, config.chainId, timeFrame);
      res.json({ success: result.success, data: result.data });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  router.get("/portfolio/pnl", (_req: Request, res: Response): void => {
    try {
      const executor = agents["3"] as unknown as { walletAddress: string } | undefined;
      if (!executor) { res.status(503).json({ error: "Executor not available" }); return; }
      const result = onchainosPortfolio.recentPnl(executor.walletAddress, config.chainId);
      res.json({ success: result.success, data: result.data });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  router.get("/portfolio/token-pnl/:token", (_req: Request, res: Response): void => {
    try {
      const executor = agents["3"] as unknown as { walletAddress: string } | undefined;
      if (!executor) { res.status(503).json({ error: "Executor not available" }); return; }
      const result = onchainosPortfolio.tokenPnl(executor.walletAddress, config.chainId, _req.params.token);
      res.json({ success: result.success, data: result.data });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  router.get("/portfolio/history", (_req: Request, res: Response): void => {
    try {
      const executor = agents["3"] as unknown as { walletAddress: string } | undefined;
      if (!executor) { res.status(503).json({ error: "Executor not available" }); return; }
      const begin = _req.query.begin ? String(_req.query.begin) : undefined;
      const end = _req.query.end ? String(_req.query.end) : undefined;
      const limit = _req.query.limit ? Number(_req.query.limit) : undefined;
      const cursor = _req.query.cursor ? String(_req.query.cursor) : undefined;
      const token = _req.query.token ? String(_req.query.token) : undefined;
      const txType = _req.query.txType ? String(_req.query.txType) : undefined;
      const result = onchainosPortfolio.dexHistory(executor.walletAddress, config.chainId, begin, end, limit, cursor, token, txType);
      res.json({ success: result.success, data: result.data });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  // ── DeFi Products ──

  router.get("/defi/products", (_req: Request, res: Response): void => {
    try {
      const page = _req.query.page ? Number(_req.query.page) : 1;
      const result = onchainosDefi.list(page);
      res.json({ success: result.success, data: result.data });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  router.get("/defi/search-pool", (_req: Request, res: Response): void => {
    try {
      const { token, chainId, productGroup, platform } = _req.query;
      if (!token) { res.status(400).json({ error: "Missing token param" }); return; }
      const result = onchainosDefi.search(
        String(token),
        chainId ? Number(chainId) : 196,
        String(productGroup ?? "DEX_POOL"),
        platform ? String(platform) : undefined,
      );
      res.json({ success: result.success, data: result.data });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  router.get("/defi/detail/:investmentId", (_req: Request, res: Response): void => {
    try {
      const id = _req.params.investmentId;
      const numId = Number(id);

      // If numeric ID — direct detail lookup
      if (!isNaN(numId) && numId > 0) {
        const result = onchainosDefi.detail(numId);
        res.json({ success: result.success, data: result.data });
        return;
      }

      // Non-numeric (DefiLlama UUID) — search by token/chain from query params
      const token = String(_req.query.token ?? "");
      const chainId = Number(_req.query.chainId ?? 1);
      const productGroup = String(_req.query.productGroup ?? "DEX_POOL");

      if (!token) {
        res.status(400).json({ error: "Non-numeric ID requires ?token=SYMBOL&chainId=N" });
        return;
      }

      // Split pair: "WETH-USDC" → ["WETH", "USDC"], normalize WETH→ETH, WBTC→BTC
      const parts = token.split("-");
      const normalize = (t: string): string => t.replace(/^W/, "");
      const searchTerms = [...new Set([
        ...parts,
        ...parts.map(normalize),
      ])].filter(Boolean);

      // Try each token until we find results
      let allResults: Record<string, unknown>[] = [];
      for (const term of searchTerms) {
        const searchResult = onchainosDefi.search(term, chainId, productGroup);
        const searchData = searchResult.data as Record<string, unknown> | undefined;
        const list = (searchData?.list ?? searchData?.products) as Record<string, unknown>[] | undefined;
        if (Array.isArray(list) && list.length > 0) {
          allResults = list;
          break;
        }
      }

      if (allResults.length === 0) {
        res.json({ success: false, error: `No matching product found for ${token} on chain ${chainId}` });
        return;
      }

      // Find best match: normalize both names for comparison (WETH↔ETH)
      const pairNorm = parts.map(normalize).join("-").toLowerCase();
      const pairNormRev = parts.map(normalize).reverse().join("-").toLowerCase();
      const match = allResults.find((p) => {
        const name = String(p.name ?? "").toLowerCase().replace(/\s+/g, "");
        return name === pairNorm || name === pairNormRev
          || name.includes(pairNorm) || name.includes(pairNormRev);
      }) ?? allResults[0];

      const matchedId = Number(match.investmentId ?? match.id);
      if (!matchedId) {
        res.json({ success: false, error: "No investmentId in search result" });
        return;
      }

      const result = onchainosDefi.detail(matchedId);
      const data = result.data as Record<string, unknown> | undefined;
      res.json({ success: result.success, data: { ...data, resolvedInvestmentId: matchedId } });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  router.get("/defi/prepare/:investmentId", (_req: Request, res: Response): void => {
    try {
      const result = onchainosDefi.prepare(Number(_req.params.investmentId));
      res.json({ success: result.success, data: result.data });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  router.get("/defi/calculate-entry", (_req: Request, res: Response): void => {
    try {
      const { investmentId, address, inputToken, amount, decimal, tickLower, tickUpper } = _req.query;
      if (!investmentId || !address || !inputToken || !amount || !decimal) {
        res.status(400).json({ error: "Missing required params: investmentId, address, inputToken, amount, decimal" });
        return;
      }
      const result = onchainosDefi.calculateEntry(
        Number(investmentId),
        String(address),
        String(inputToken),
        String(amount),
        Number(decimal),
        tickLower ? Number(tickLower) : undefined,
        tickUpper ? Number(tickUpper) : undefined,
      );
      res.json({ success: result.success, data: result.data });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  router.post("/defi/deposit", (_req: Request, res: Response): void => {
    try {
      const { investmentId, address, userInput, slippage, tickLower, tickUpper } = _req.body;
      if (!investmentId || !address || !userInput) {
        res.status(400).json({ error: "Missing required: investmentId, address, userInput" });
        return;
      }
      const result = onchainosDefi.deposit(
        Number(investmentId),
        String(address),
        typeof userInput === "string" ? userInput : JSON.stringify(userInput),
        slippage ? String(slippage) : undefined,
        tickLower !== undefined ? Number(tickLower) : undefined,
        tickUpper !== undefined ? Number(tickUpper) : undefined,
      );
      res.json({ success: result.success, data: result.data });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  router.get("/defi/positions/:address", (_req: Request, res: Response): void => {
    try {
      const chains = String(_req.query.chains ?? "ethereum,bsc,polygon,arbitrum,base,xlayer,optimism,avalanche");
      const result = onchainosDefi.positions(_req.params.address, chains);
      const data = result.data as Record<string, unknown> | undefined;

      // positions returns summary with walletIdPlatformList — fetch detail for each platform
      const platformList = data?.walletIdPlatformList as Record<string, unknown>[] | undefined;
      const allPositions: Record<string, unknown>[] = [];

      if (Array.isArray(platformList)) {
        for (const plat of platformList) {
          const totalAssets = Number(plat.totalAssets ?? 0);
          if (totalAssets <= 0) continue;

          // Each platform may list chains with positions
          const chainList = plat.chainList as Record<string, unknown>[] | undefined;
          if (Array.isArray(chainList)) {
            for (const chain of chainList) {
              const platformId = String(chain.analysisPlatformId ?? plat.analysisPlatformId ?? "");
              const chainName = String(chain.chain ?? "");
              if (!platformId || !chainName) continue;

              const detailResult = onchainosDefi.positionDetail(_req.params.address, Number(chain.chainIndex ?? 1), platformId);
              const detailData = detailResult.data as Record<string, unknown> | undefined;
              const investments = detailData?.investments ?? detailData?.tokenList ?? detailData?.list;
              if (Array.isArray(investments)) {
                for (const inv of investments as Record<string, unknown>[]) {
                  allPositions.push({ ...inv, chain: chainName, platformId });
                }
              }
            }
          }
        }
      }

      res.json({
        success: result.success,
        data: {
          ...data,
          positions: allPositions,
        },
      });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  return router;
}

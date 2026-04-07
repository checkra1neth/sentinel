import { config } from "../config.js";

const API_URL = config.uniswap.tradingApiUrl;

function headers(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (config.uniswap.apiKey) h["x-api-key"] = config.uniswap.apiKey;
  return h;
}

export interface UniswapQuote {
  tokenIn: string;
  tokenOut: string;
  amount: string;
  amountDecimals: string;
  quoteGasAdjusted: string;
  gasPriceWei: string;
  route: unknown[];
  routeString: string;
  requestId: string;
  raw: unknown;
}

export interface UniswapSwapCalldata {
  to: string;
  data: string;
  value: string;
  chainId: number;
  gasLimit: string;
}

export async function checkApproval(
  token: string,
  amount: string,
  walletAddress: string,
  chainId: number,
): Promise<unknown> {
  try {
    const res = await fetch(`${API_URL}/check_approval`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ token, amount, walletAddress, chainId }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function getQuote(params: {
  tokenIn: string;
  tokenOut: string;
  tokenInChainId: number;
  tokenOutChainId: number;
  amount: string;
  type: "EXACT_INPUT" | "EXACT_OUTPUT";
  swapper: string;
  slippageTolerance?: number;
}): Promise<UniswapQuote | null> {
  try {
    const body = {
      tokenInChainId: params.tokenInChainId,
      tokenOutChainId: params.tokenOutChainId,
      tokenIn: params.tokenIn,
      tokenOut: params.tokenOut,
      amount: params.amount,
      type: params.type,
      swapper: params.swapper,
      slippageTolerance: params.slippageTolerance,
      configs: [{ routingType: "CLASSIC", protocols: ["V2", "V3"] }],
    };

    const res = await fetch(`${API_URL}/quote`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(body),
    });

    if (!res.ok) return null;
    const data = await res.json() as Record<string, unknown>;
    const quote = (data.quote ?? data) as Record<string, unknown>;

    return {
      tokenIn: params.tokenIn,
      tokenOut: params.tokenOut,
      amount: String(quote.amount ?? params.amount),
      amountDecimals: String(quote.amountDecimals ?? ""),
      quoteGasAdjusted: String(quote.quoteGasAdjusted ?? ""),
      gasPriceWei: String(quote.gasPriceWei ?? ""),
      route: (quote.route ?? []) as unknown[],
      routeString: String(quote.routeString ?? ""),
      requestId: String(data.requestId ?? ""),
      raw: data,
    };
  } catch {
    return null;
  }
}

export async function getSwapCalldata(quote: UniswapQuote): Promise<UniswapSwapCalldata | null> {
  try {
    const res = await fetch(`${API_URL}/swap`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ quote: quote.raw, simulateTransaction: false }),
    });

    if (!res.ok) return null;
    const data = await res.json() as Record<string, unknown>;
    const swap = (data.swap ?? data) as Record<string, unknown>;

    return {
      to: String(swap.to ?? ""),
      data: String(swap.data ?? ""),
      value: String(swap.value ?? "0"),
      chainId: Number(swap.chainId ?? 196),
      gasLimit: String(swap.gasLimit ?? ""),
    };
  } catch {
    return null;
  }
}

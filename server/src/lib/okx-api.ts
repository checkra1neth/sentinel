import crypto from "crypto";
import { config } from "../config.js";
import type { TokenSecurityScan, SwapQuote } from "../types.js";

function sign(timestamp: string, method: string, path: string, body: string): string {
  const prehash = timestamp + method + path + body;
  return crypto.createHmac("sha256", config.okx.secretKey).update(prehash).digest("base64");
}

function headers(timestamp: string, signature: string): Record<string, string> {
  return {
    "OK-ACCESS-KEY": config.okx.apiKey,
    "OK-ACCESS-SIGN": signature,
    "OK-ACCESS-TIMESTAMP": timestamp,
    "OK-ACCESS-PASSPHRASE": config.okx.passphrase,
    "Content-Type": "application/json",
  };
}

export async function okxWeb3Get<T = unknown>(path: string): Promise<T> {
  // Convert v5 paths to v6
  const actualPath = path.replace("/api/v5/", "/api/v6/");
  const timestamp = new Date().toISOString();
  const signature = sign(timestamp, "GET", actualPath, "");

  const res = await fetch(`https://web3.okx.com${actualPath}`, {
    headers: headers(timestamp, signature),
  });

  return res.json() as Promise<T>;
}

export async function okxWeb3Post<T = unknown>(path: string, body: unknown): Promise<T> {
  const actualPath = path.replace("/api/v5/", "/api/v6/");
  const bodyStr = JSON.stringify(body);
  const timestamp = new Date().toISOString();
  const signature = sign(timestamp, "POST", actualPath, bodyStr);

  const res = await fetch(`https://web3.okx.com${actualPath}`, {
    method: "POST",
    headers: headers(timestamp, signature),
    body: bodyStr,
  });

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Convenience helpers
// ---------------------------------------------------------------------------

interface OkxResponse<D> {
  code: string;
  data: D[];
  msg: string;
}

export async function okxTokenSecurity(
  chainId: string,
  tokenAddress: string,
): Promise<TokenSecurityScan | null> {
  const resp = await okxWeb3Get<OkxResponse<TokenSecurityScan>>(
    `/api/v5/dex/security/token?chainId=${chainId}&tokenContractAddress=${tokenAddress}`,
  );
  return resp.data?.[0] ?? null;
}

export async function okxSwapQuote(
  chainId: string,
  fromToken: string,
  toToken: string,
  amount: string,
): Promise<SwapQuote | null> {
  const resp = await okxWeb3Get<OkxResponse<SwapQuote>>(
    `/api/v5/dex/aggregator/quote?chainId=${chainId}&fromTokenAddress=${fromToken}&toTokenAddress=${toToken}&amount=${amount}`,
  );
  return resp.data?.[0] ?? null;
}

export async function okxSwapData(
  chainId: string,
  fromToken: string,
  toToken: string,
  amount: string,
  userWallet: string,
  slippage: string = "0.5",
): Promise<SwapQuote | null> {
  const resp = await okxWeb3Get<OkxResponse<SwapQuote>>(
    `/api/v5/dex/aggregator/swap?chainId=${chainId}&fromTokenAddress=${fromToken}&toTokenAddress=${toToken}&amount=${amount}&userWalletAddress=${userWallet}&slippage=${slippage}`,
  );
  return resp.data?.[0] ?? null;
}

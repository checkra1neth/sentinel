// ---------------------------------------------------------------------------
// Wallet API client — communicates with server wallet endpoints
// ---------------------------------------------------------------------------

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

export interface AgentWalletInfo {
  agentWallet: string;
  depositAddress: string;
  balance: string;
}

export interface AgentBalanceInfo {
  balance: string;
  agentWallet: string;
}

/**
 * Create or retrieve an agent wallet for the connected user.
 */
export async function createAgentWallet(walletAddress: string): Promise<AgentWalletInfo> {
  const res = await fetch(`${API_URL}/api/wallet/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress }),
  });

  if (!res.ok) {
    throw new Error(`Failed to create agent wallet: ${res.status}`);
  }

  return res.json() as Promise<AgentWalletInfo>;
}

/**
 * Get the agent wallet balance for a user.
 */
export async function getAgentBalance(walletAddress: string): Promise<AgentBalanceInfo> {
  const res = await fetch(`${API_URL}/api/wallet/balance?address=${encodeURIComponent(walletAddress)}`);

  if (!res.ok) {
    throw new Error(`Failed to get agent balance: ${res.status}`);
  }

  return res.json() as Promise<AgentBalanceInfo>;
}

/**
 * Record a deposit after sending USDT to the agent wallet.
 */
export async function recordDeposit(
  walletAddress: string,
  txHash: string,
  amount: string,
): Promise<{ success: boolean; newBalance: string }> {
  const res = await fetch(`${API_URL}/api/wallet/deposit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress, txHash, amount }),
  });

  if (!res.ok) {
    throw new Error(`Failed to record deposit: ${res.status}`);
  }

  return res.json() as Promise<{ success: boolean; newBalance: string }>;
}

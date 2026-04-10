// ---------------------------------------------------------------------------
// Wallet Router
// Endpoints for creating a user-dedicated TEE wallet and reading its balance.
// ---------------------------------------------------------------------------

import { Router, type Request, type Response } from "express";
import { isAddress } from "viem";
import { userWalletManager } from "../wallet/user-wallet-manager.js";

function validateWalletAddress(value: unknown): string | null {
  return typeof value === "string" && isAddress(value)
    ? value
    : null;
}

export function createWalletRouter(): Router {
  const router = Router();

  // -------------------------------------------------------------------------
  // POST /api/wallet/create
  // Create or retrieve a dedicated TEE wallet account for a user's EOA.
  // Body: { walletAddress: string }
  // -------------------------------------------------------------------------

  router.post("/wallet/create", async (req: Request, res: Response): Promise<void> => {
    const walletAddress = validateWalletAddress((req.body as { walletAddress?: unknown })?.walletAddress);

    if (!walletAddress) {
      res.status(400).json({ error: "Valid walletAddress is required" });
      return;
    }

    try {
      const account = await userWalletManager.getOrCreateAccount(walletAddress);
      const balance = await userWalletManager.getUsdtBalanceForAccount(account);

      res.json({
        agentWallet: account.agentWalletAddress,
        depositAddress: account.agentWalletAddress,
        balance,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to provision TEE wallet";
      res.status(503).json({ error: message });
    }
  });

  // -------------------------------------------------------------------------
  // GET /api/wallet/balance
  // Query: ?address=0x...
  // -------------------------------------------------------------------------

  router.get("/wallet/balance", async (req: Request, res: Response): Promise<void> => {
    const address = validateWalletAddress(req.query.address);

    if (!address) {
      res.status(400).json({ error: "Valid address query parameter is required" });
      return;
    }

    try {
      const account = await userWalletManager.getOrCreateAccount(address);
      const balance = await userWalletManager.getUsdtBalanceForAccount(account);

      res.json({
        balance,
        agentWallet: account.agentWalletAddress,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load TEE wallet balance";
      res.status(503).json({ error: message });
    }
  });

  // -------------------------------------------------------------------------
  // POST /api/wallet/deposit
  // Legacy compatibility endpoint. The source of truth is the live on-chain
  // USDT balance of the user's TEE wallet.
  // Body: { walletAddress: string, txHash?: string }
  // -------------------------------------------------------------------------

  router.post("/wallet/deposit", async (req: Request, res: Response): Promise<void> => {
    const { txHash } = req.body as { txHash?: string };
    const walletAddress = validateWalletAddress((req.body as { walletAddress?: unknown })?.walletAddress);

    if (!walletAddress) {
      res.status(400).json({ error: "Valid walletAddress is required" });
      return;
    }

    try {
      const account = await userWalletManager.getOrCreateAccount(walletAddress);
      const newBalance = await userWalletManager.getUsdtBalanceForAccount(account);

      if (txHash) {
        console.log(`[wallet-router] Deposit sync requested for ${walletAddress} (tx: ${txHash})`);
      }

      res.json({
        success: true,
        newBalance,
        agentWallet: account.agentWalletAddress,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to sync TEE wallet balance";
      res.status(503).json({ error: message });
    }
  });

  return router;
}

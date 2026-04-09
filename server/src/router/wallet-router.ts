// ---------------------------------------------------------------------------
// Wallet Router
// Endpoints for user agent wallet creation, balance queries, and deposits.
// ---------------------------------------------------------------------------

import { Router, type Request, type Response } from "express";
import { userWalletManager } from "../wallet/user-wallet-manager.js";

export function createWalletRouter(): Router {
  const router = Router();

  // -------------------------------------------------------------------------
  // POST /api/wallet/create
  // Create or retrieve an agent wallet account for a user's MetaMask address.
  // Body: { walletAddress: string }
  // -------------------------------------------------------------------------

  router.post("/wallet/create", (req: Request, res: Response): void => {
    const { walletAddress } = req.body as { walletAddress?: string };

    if (!walletAddress || typeof walletAddress !== "string") {
      res.status(400).json({ error: "walletAddress is required" });
      return;
    }

    const account = userWalletManager.getOrCreateAccount(walletAddress);
    res.json({
      agentWallet: account.agentWalletAddress,
      depositAddress: account.agentWalletAddress,
      balance: account.depositedBalance,
    });
  });

  // -------------------------------------------------------------------------
  // GET /api/wallet/balance
  // Query: ?address=0x...
  // -------------------------------------------------------------------------

  router.get("/wallet/balance", (req: Request, res: Response): void => {
    const address = req.query.address as string | undefined;

    if (!address || typeof address !== "string") {
      res.status(400).json({ error: "address query parameter is required" });
      return;
    }

    const account = userWalletManager.getOrCreateAccount(address);
    res.json({
      balance: account.depositedBalance,
      agentWallet: account.agentWalletAddress,
    });
  });

  // -------------------------------------------------------------------------
  // POST /api/wallet/deposit
  // Record a user deposit after they send USDT to the Sentinel wallet.
  // Body: { walletAddress: string, txHash: string, amount: string }
  // -------------------------------------------------------------------------

  router.post("/wallet/deposit", (req: Request, res: Response): void => {
    const { walletAddress, txHash, amount } = req.body as {
      walletAddress?: string;
      txHash?: string;
      amount?: string;
    };

    if (!walletAddress || !txHash || !amount) {
      res.status(400).json({ error: "walletAddress, txHash, and amount are required" });
      return;
    }

    // TODO: In production, verify the txHash on-chain before crediting
    console.log(`[wallet-router] Deposit recorded: ${walletAddress} sent ${amount} USDT (tx: ${txHash})`);

    userWalletManager.recordDeposit(walletAddress, amount);
    const newBalance = userWalletManager.getBalance(walletAddress);

    res.json({
      success: true,
      newBalance,
    });
  });

  return router;
}

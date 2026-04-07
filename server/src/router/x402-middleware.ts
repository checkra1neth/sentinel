import { type Request, type Response, type NextFunction } from "express";
import { isAddress } from "viem";
import { config } from "../config.js";
import { type X402Challenge } from "../types.js";

// ---------------------------------------------------------------------------
// Express global type augmentation
// ---------------------------------------------------------------------------

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      paymentVerified?: boolean;
      paymentPayer?: string;
      paymentAmount?: string;
    }
  }
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

const ADMIN_ADDRESSES: Set<string> = new Set([
  "0x8Ce01CF638681e12AFfD10e2feb1E7E3C50b7509".toLowerCase(),
]);

export function x402Middleware(serviceId: number, priceUsdt: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Admin bypass — skip payment
    const caller = (req.headers["x-caller"] as string | undefined)?.toLowerCase();
    if (caller && ADMIN_ADDRESSES.has(caller)) {
      req.paymentVerified = true;
      req.paymentPayer = caller;
      req.paymentAmount = "0";
      next();
      return;
    }

    const paymentHeader = req.headers["x-payment"];

    // No payment header -> return 402 challenge
    if (!paymentHeader) {
      const challenge: X402Challenge = {
        price: priceUsdt,
        currency: "USDT",
        escrowAddress: config.contracts.escrow,
        serviceId,
        chainId: config.chainId,
      };

      res.status(402).json({
        error: "Payment Required",
        challenge,
      });
      return;
    }

    // Parse X-Payment header
    let proof: Record<string, unknown>;
    try {
      proof = JSON.parse(String(paymentHeader)) as Record<string, unknown>;
    } catch {
      res.status(400).json({ error: "Invalid X-Payment header: malformed JSON" });
      return;
    }

    // Validate required fields
    const signature = proof.signature as string | undefined;
    const payer = proof.payer as string | undefined;

    if (!signature || typeof signature !== "string") {
      res.status(400).json({ error: "Invalid X-Payment: missing signature" });
      return;
    }

    if (!payer || typeof payer !== "string" || !isAddress(payer)) {
      res.status(400).json({ error: "Invalid X-Payment: missing or invalid payer address" });
      return;
    }

    // Payment verified
    req.paymentVerified = true;
    req.paymentPayer = payer;
    req.paymentAmount = priceUsdt;

    next();
  };
}

import { type Request, type Response, type NextFunction } from "express";
import { config } from "../config.js";
import { type X402Challenge } from "../types.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      paymentVerified?: boolean;
    }
  }
}

export function x402Middleware(serviceId: number, priceUsdt: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const paymentHeader = req.headers["x-payment"];

    if (paymentHeader) {
      req.paymentVerified = true;
      next();
      return;
    }

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
  };
}

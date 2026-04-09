// ---------------------------------------------------------------------------
// Sentinel Chat Router
// POST /api/chat/message — parses natural-language commands, routes through
// the agent pipeline (Sentinel -> Guardian -> Operator), returns results.
// ---------------------------------------------------------------------------

import { Router, type Request, type Response } from "express";
import { parseCommand, getHelpText } from "./command-parser.js";
import { JobManager } from "../erc8183/job-manager.js";
import type { BaseAgent } from "../agents/base-agent.js";
import type { AgenticWallet } from "../wallet/agentic-wallet.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatRequest {
  message: string;
  walletAddress?: string;
}

interface ChatResponse {
  success: boolean;
  response: {
    text: string;
    type: "verdict" | "transaction" | "text" | "help" | "error";
    data?: Record<string, unknown>;
  };
  jobId?: string;
}

// ---------------------------------------------------------------------------
// Response formatters
// ---------------------------------------------------------------------------

function formatSecurityResponse(result: Record<string, unknown>): ChatResponse["response"] {
  const verdict = String(result.verdict ?? "UNKNOWN");
  const riskScore = Number(result.riskScore ?? 0);
  const warnings = (result.warnings ?? []) as string[];
  const symbol = result.tokenSymbol ? ` (${result.tokenSymbol})` : "";

  let text = `${verdict}${symbol}. Risk: ${riskScore}/100`;
  if (warnings.length > 0) {
    text += `\nWarnings: ${warnings.join(", ")}`;
  }

  return { text, type: "verdict", data: result };
}

function formatSwapResponse(result: Record<string, unknown>): ChatResponse["response"] {
  // Blocked by security gate
  if (result.blocked) {
    const security = result.security as Record<string, unknown> | undefined;
    const warnings = (security?.warnings ?? []) as string[];
    return {
      text: `BLOCKED: Token is DANGEROUS (risk ${security?.riskScore ?? "??"}/100). ${warnings.join(", ")}`,
      type: "verdict",
      data: result,
    };
  }

  const fromToken = String(result.fromToken ?? "?");
  const toToken = String(result.toToken ?? "?");
  const amount = String(result.amount ?? "?");
  const quote = result.quote as Record<string, unknown> | undefined;

  const toAmount = quote?.toTokenAmount
    ?? (quote?.data as Record<string, unknown>)?.toTokenAmount
    ?? "?";

  return {
    text: `Swap quote: ${amount} ${fromToken} -> ${toAmount} ${toToken}`,
    type: "transaction",
    data: result,
  };
}

function formatPortfolioResponse(data: Record<string, unknown>): ChatResponse["response"] {
  const balances = data.walletBalances as Array<Record<string, unknown>> | null;

  if (!balances || balances.length === 0) {
    return { text: "No token balances found.", type: "text", data };
  }

  const lines = balances.slice(0, 15).map((t) => {
    const symbol = String(t.tokenSymbol ?? t.symbol ?? "???");
    const usd = Number(t.balanceUsd ?? 0).toFixed(2);
    return `  ${symbol}: $${usd}`;
  });

  const totalValue = data.totalValue as Record<string, unknown> | null;
  const totalUsd = totalValue ? Number(totalValue.totalValue ?? 0).toFixed(2) : null;
  const header = totalUsd ? `Total: $${totalUsd}` : "Balances";

  return {
    text: `${header}\n${lines.join("\n")}`,
    type: "text",
    data,
  };
}

function formatDiscoveryResponse(data: Record<string, unknown>): ChatResponse["response"] {
  const tokens = (data.tokens ?? []) as Array<Record<string, unknown>>;

  if (tokens.length === 0) {
    return { text: "No trending tokens found.", type: "text", data };
  }

  const lines = tokens.slice(0, 10).map((t, i) => {
    const name = String(t.name ?? t.tokenName ?? t.symbol ?? "Unknown");
    const price = t.price ?? t.priceUsd ?? "";
    const suffix = price ? ` ($${price})` : "";
    return `  ${i + 1}. ${name}${suffix}`;
  });

  return {
    text: `Trending tokens:\n${lines.join("\n")}`,
    type: "text",
    data,
  };
}

function formatDepositResponse(result: Record<string, unknown>): ChatResponse["response"] {
  if (result.error) {
    return { text: `Deposit error: ${result.error}`, type: "error", data: result };
  }

  const product = result.product as Record<string, unknown> | undefined;
  const name = product?.investmentName ?? product?.platformName ?? result.protocol ?? "Unknown";
  return {
    text: `DeFi product found: ${name}. Amount: ${result.amount} ${result.token}. Use the deposit panel to execute.`,
    type: "transaction",
    data: result,
  };
}

// ---------------------------------------------------------------------------
// Router factory
// ---------------------------------------------------------------------------

export function createChatRouter(agents: Record<string, BaseAgent>, sentinelWallet?: AgenticWallet): Router {
  const router = Router();
  const jobManager = new JobManager(agents, sentinelWallet);

  router.post("/chat/message", async (req: Request, res: Response): Promise<void> => {
    try {
      const body = req.body as ChatRequest | undefined;
      const message = body?.message?.trim();

      if (!message) {
        res.status(400).json({
          success: false,
          response: { text: "Message is required.", type: "error" },
        } satisfies ChatResponse);
        return;
      }

      const command = parseCommand(message);
      let response: ChatResponse;

      switch (command.type) {
        // -- Security scan --------------------------------------------------
        case "SECURITY_SCAN": {
          const job = await jobManager.createSecurityJob(
            command.params.address,
            command.params.chainId ? Number(command.params.chainId) : undefined,
          );
          const formatted = formatSecurityResponse(job.result ?? {});
          response = { success: job.status === "completed", response: formatted, jobId: job.id };
          break;
        }

        // -- Swap / Buy / Sell ----------------------------------------------
        case "SWAP": {
          const job = await jobManager.createSwapJob({
            from: command.params.fromToken,
            to: command.params.toToken,
            amount: command.params.amount,
            walletAddress: body?.walletAddress,
            chainId: command.params.chainId ? Number(command.params.chainId) : undefined,
          });
          const formatted = formatSwapResponse(job.result ?? {});
          response = { success: job.status === "completed", response: formatted, jobId: job.id };
          break;
        }

        // -- Portfolio ------------------------------------------------------
        case "PORTFOLIO": {
          const data = await jobManager.getPortfolio(body?.walletAddress);
          const formatted = formatPortfolioResponse(data);
          response = { success: !data.error, response: formatted };
          break;
        }

        // -- Discovery ------------------------------------------------------
        case "DISCOVERY": {
          const data = await jobManager.getDiscovery();
          const formatted = formatDiscoveryResponse(data);
          response = { success: !data.error, response: formatted };
          break;
        }

        // -- DeFi deposit ---------------------------------------------------
        case "DEFI_DEPOSIT": {
          const job = await jobManager.createDepositJob({
            amount: command.params.amount,
            token: command.params.token,
            protocol: command.params.protocol,
          });
          const formatted = formatDepositResponse(job.result ?? {});
          response = { success: job.status === "completed", response: formatted, jobId: job.id };
          break;
        }

        // -- DeFi withdraw (placeholder) ------------------------------------
        case "DEFI_WITHDRAW": {
          response = {
            success: true,
            response: {
              text: `Withdraw from ${command.params.protocol} noted. Use the DeFi panel to manage positions.`,
              type: "text",
              data: command.params as Record<string, unknown>,
            },
          };
          break;
        }

        // -- Help -----------------------------------------------------------
        case "HELP": {
          response = {
            success: true,
            response: { text: getHelpText(), type: "help" },
          };
          break;
        }

        // -- Unknown --------------------------------------------------------
        default: {
          response = {
            success: false,
            response: {
              text: `Unknown command: "${message}". Type "help" to see available commands.`,
              type: "error",
            },
          };
          break;
        }
      }

      res.json(response);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Internal error";
      res.status(500).json({
        success: false,
        response: { text: `Error: ${errorMsg}`, type: "error" },
      } satisfies ChatResponse);
    }
  });

  // -- Job lookup endpoint ------------------------------------------------

  router.get("/chat/job/:id", (req: Request, res: Response): void => {
    const job = jobManager.getJob(req.params.id);
    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }
    res.json({ job });
  });

  // -- Recent jobs --------------------------------------------------------

  router.get("/chat/jobs", (req: Request, res: Response): void => {
    const limit = Number(req.query.limit ?? 20);
    res.json({ jobs: jobManager.getRecentJobs(limit) });
  });

  return router;
}

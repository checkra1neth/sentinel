import { Router, type Request, type Response } from "express";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const VALID_AGENTS = ["sentinel", "guardian", "operator"] as const;
type AgentName = (typeof VALID_AGENTS)[number];

function isValidAgent(name: string): name is AgentName {
  return (VALID_AGENTS as readonly string[]).includes(name);
}

/**
 * Creates an Express router that serves ERC-8004 agent metadata JSON files.
 *
 * Routes:
 *   GET /api/agent-metadata/sentinel  -> sentinel.json
 *   GET /api/agent-metadata/guardian   -> guardian.json
 *   GET /api/agent-metadata/operator   -> operator.json
 */
export function createMetadataRouter(): Router {
  const router = Router();

  // Pre-load metadata at startup for fast responses
  const metadataCache = new Map<AgentName, string>();
  for (const name of VALID_AGENTS) {
    const filePath = resolve(__dirname, "agent-metadata", `${name}.json`);
    try {
      const content = readFileSync(filePath, "utf-8");
      // Validate JSON
      JSON.parse(content);
      metadataCache.set(name, content);
    } catch {
      console.warn(`[metadata] Failed to load ${name}.json — endpoint will return 404`);
    }
  }

  router.get("/agent-metadata/:agent", (req: Request, res: Response): void => {
    const agentParam = req.params.agent;

    if (!agentParam || !isValidAgent(agentParam)) {
      res.status(404).json({ error: "Unknown agent. Valid: sentinel, guardian, operator" });
      return;
    }

    const content = metadataCache.get(agentParam);
    if (!content) {
      res.status(404).json({ error: `Metadata for ${agentParam} not found` });
      return;
    }

    res.setHeader("Content-Type", "application/json");
    res.send(content);
  });

  return router;
}

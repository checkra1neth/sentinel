import crypto from "crypto";
import { config } from "../config.js";

function sign(timestamp: string, method: string, path: string, body: string): string {
  const prehash = timestamp + method + path + body;
  return crypto.createHmac("sha256", config.okx.secretKey).update(prehash).digest("base64");
}

export async function okxWeb3Get(path: string): Promise<unknown> {
  // Convert v5 paths to v6
  const actualPath = path.replace("/api/v5/", "/api/v6/");
  const timestamp = new Date().toISOString();
  const signature = sign(timestamp, "GET", actualPath, "");

  const res = await fetch(`https://web3.okx.com${actualPath}`, {
    headers: {
      "OK-ACCESS-KEY": config.okx.apiKey,
      "OK-ACCESS-SIGN": signature,
      "OK-ACCESS-TIMESTAMP": timestamp,
      "OK-ACCESS-PASSPHRASE": config.okx.passphrase,
      "Content-Type": "application/json",
    },
  });

  return res.json();
}

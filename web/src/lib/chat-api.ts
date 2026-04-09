const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

export interface ChatResponse {
  text: string;
  type: "text" | "verdict" | "transaction" | "error" | "help";
  data?: Record<string, unknown>;
}

interface ChatApiResult {
  success: boolean;
  response: ChatResponse;
}

export async function sendChatMessage(
  message: string,
  walletAddress?: string,
): Promise<ChatResponse> {
  const res = await fetch(`${API_URL}/api/chat/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, walletAddress }),
  });

  if (!res.ok) {
    return {
      text: `Request failed (${res.status}). Please try again.`,
      type: "error",
    };
  }

  const json = (await res.json()) as ChatApiResult;

  if (!json.success) {
    return {
      text: json.response?.text ?? "Unknown error from agent.",
      type: "error",
    };
  }

  return json.response;
}

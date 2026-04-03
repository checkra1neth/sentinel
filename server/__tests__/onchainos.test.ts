import { describe, it, expect, vi, beforeEach } from "vitest";
import { execSync } from "child_process";
import { onchainos } from "../src/lib/onchainos.js";

vi.mock("child_process", () => ({
  execSync: vi.fn(),
}));

const mockExecSync = vi.mocked(execSync);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("onchainos", () => {
  it("parses clean JSON output", () => {
    mockExecSync.mockReturnValue(JSON.stringify({ balance: "100.5", token: "USDT" }));

    const result = onchainos<{ balance: string; token: string }>("wallet balance");

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ balance: "100.5", token: "USDT" });
    expect(result.error).toBeUndefined();
  });

  it("parses JSON with non-JSON prefix lines", () => {
    const output = [
      "OnchainOS v1.2.3",
      "Connecting to network...",
      '{"balance":"42","token":"OKB"}',
    ].join("\n");

    mockExecSync.mockReturnValue(output);

    const result = onchainos<{ balance: string; token: string }>("wallet balance");

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ balance: "42", token: "OKB" });
  });

  it("parses JSON array output", () => {
    const output = 'Loading...\n[{"id":1},{"id":2}]';
    mockExecSync.mockReturnValue(output);

    const result = onchainos<Array<{ id: number }>>("token hot-tokens");

    expect(result.success).toBe(true);
    expect(result.data).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it("returns error when no JSON in output", () => {
    mockExecSync.mockReturnValue("Some plain text with no JSON\nAnother line");

    const result = onchainos("wallet balance");

    expect(result.success).toBe(false);
    expect(result.error).toBe("No JSON found in CLI output");
  });

  it("returns error when CLI command fails", () => {
    mockExecSync.mockImplementation(() => {
      throw new Error("Command failed: onchainos bad-command --json 2>/dev/null");
    });

    const result = onchainos("bad-command");

    expect(result.success).toBe(false);
    expect(result.error).toContain("Command failed");
  });

  it("returns error on invalid JSON", () => {
    mockExecSync.mockReturnValue("{invalid json}");

    const result = onchainos("wallet balance");

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("passes correct command to execSync", () => {
    mockExecSync.mockReturnValue('{"ok":true}');

    onchainos("wallet balance --token USDT");

    expect(mockExecSync).toHaveBeenCalledWith(
      "onchainos wallet balance --token USDT --json 2>/dev/null",
      expect.objectContaining({
        timeout: 30_000,
        encoding: "utf-8",
      }),
    );
  });

  it("handles multiline JSON object", () => {
    const output = [
      "info: loading",
      "{",
      '  "name": "TestToken",',
      '  "price": 1.23',
      "}",
    ].join("\n");

    mockExecSync.mockReturnValue(output);

    const result = onchainos<{ name: string; price: number }>("token price-info --token TEST");

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ name: "TestToken", price: 1.23 });
  });

  it("handles non-Error thrown values", () => {
    mockExecSync.mockImplementation(() => {
      throw "string error";
    });

    const result = onchainos("wallet balance");

    expect(result.success).toBe(false);
    expect(result.error).toBe("string error");
  });
});

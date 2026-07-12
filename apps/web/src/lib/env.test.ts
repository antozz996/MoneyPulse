import { describe, expect, it } from "vitest";

import { env } from "./env";

describe("environment safety", () => {
  it("does not require live Copilot or Supabase values by default", () => {
    expect(env.authMode).toBe("app");
    expect(env.copilotProvider).toBe("mock");
    expect(env.copilotLiveEnabled).toBe(false);
  });

  it("does not expose secret-like values through the frontend env helper", () => {
    const envKeys = Object.keys(env);

    expect(envKeys).not.toContain("openAiApiKey");
    expect(envKeys).not.toContain("supabaseServiceRoleKey");
    expect(envKeys).not.toContain("supabaseSecretKey");
  });
});

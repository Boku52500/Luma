import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getEmailConfig } from "./config";

function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
  const previous: Record<string, string | undefined> = {};
  for (const key of Object.keys(vars)) {
    previous[key] = process.env[key];
    const next = vars[key];
    if (next === undefined) delete process.env[key];
    else process.env[key] = next;
  }
  try {
    fn();
  } finally {
    for (const key of Object.keys(vars)) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

describe("getEmailConfig", { concurrency: false }, () => {
  it("returns null when unconfigured and does not fake success", () => {
    withEnv({ RESEND_API_KEY: undefined, EMAIL_FROM: undefined }, () => {
      assert.equal(getEmailConfig(), null);
    });
  });

  it("requires both key and from", () => {
    withEnv({ RESEND_API_KEY: "re_test", EMAIL_FROM: undefined }, () => {
      assert.equal(getEmailConfig(), null);
    });
  });

  it("ignores EMAIL_OVERRIDE_TO in production unless explicitly allowed", () => {
    withEnv(
      {
        RESEND_API_KEY: "re_test",
        EMAIL_FROM: "Luma <noreply@luma.ge>",
        EMAIL_OVERRIDE_TO: "dev@example.com",
        EMAIL_ALLOW_OVERRIDE: undefined,
        NODE_ENV: "production",
      },
      () => {
        const config = getEmailConfig();
        assert.ok(config);
        assert.equal(config.overrideTo, undefined);
      },
    );
  });

  it("applies override in development", () => {
    withEnv(
      {
        RESEND_API_KEY: "re_test",
        EMAIL_FROM: "Luma <noreply@luma.ge>",
        EMAIL_OVERRIDE_TO: "dev@example.com",
        NODE_ENV: "development",
      },
      () => {
        const config = getEmailConfig();
        assert.equal(config?.overrideTo, "dev@example.com");
      },
    );
  });
});

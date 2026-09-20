import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { passwordResetUrl } from "./appUrl";

describe("passwordResetUrl", { concurrency: false }, () => {
  it("builds the reset link from APP_ORIGIN", () => {
    const previous = process.env.APP_ORIGIN;
    process.env.APP_ORIGIN = "https://luma.ge";
    try {
      assert.equal(passwordResetUrl("abc+def"), "https://luma.ge/reset-password?token=abc%2Bdef");
    } finally {
      if (previous === undefined) delete process.env.APP_ORIGIN;
      else process.env.APP_ORIGIN = previous;
    }
  });

  it("falls back to localhost when origin is unset", () => {
    const previousOrigin = process.env.APP_ORIGIN;
    const previousAuth = process.env.AUTH_URL;
    delete process.env.APP_ORIGIN;
    delete process.env.AUTH_URL;
    try {
      assert.equal(passwordResetUrl("tok"), "http://localhost:3000/reset-password?token=tok");
    } finally {
      if (previousOrigin === undefined) delete process.env.APP_ORIGIN;
      else process.env.APP_ORIGIN = previousOrigin;
      if (previousAuth === undefined) delete process.env.AUTH_URL;
      else process.env.AUTH_URL = previousAuth;
    }
  });
});

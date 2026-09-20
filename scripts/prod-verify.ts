/**
 * Deployment/readiness checks. Does not print secret values.
 * Usage: npm run prod:verify
 */
import "dotenv/config";

import { pingDatabase } from "../src/server/prisma";
import { collectEnvIssues, r2Configured, bogCredentialsPresent } from "../src/server/config/validateEnv";
import { emailConfigured } from "../src/server/email/config";
import { getAppOriginString } from "../src/lib/appUrl";
import { prisma } from "../src/server/prisma";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  const mode = process.env.NODE_ENV === "production" ? "production" : "development";
  console.log(`Luma production verify (${mode})`);

  const issues = collectEnvIssues(mode);
  for (const issue of issues) {
    console.log(`  ENV ${issue.key}: ${issue.message}`);
  }
  assert(issues.length === 0, "Required environment variables are missing or invalid");
  console.log("  Environment variables present");
  console.log(`  App origin: ${getAppOriginString()}`);
  console.log(`  R2 configured: ${r2Configured() ? "yes" : "no (admin upload disabled)"}`);
  console.log(`  BOG card payments: ${bogCredentialsPresent() ? "credentials present" : "not configured"}`);
  console.log(`  Resend email: ${emailConfigured() ? "configured" : "not configured"}`);

  await pingDatabase();
  console.log("  PostgreSQL reachable");

  const products = await prisma.product.count();
  assert(products > 0, "Catalogue is empty — run npm run db:seed in development only");
  console.log(`  Catalogue products: ${products}`);

  const admins = await prisma.customer.count({ where: { role: "ADMIN" } });
  console.log(`  ADMIN accounts: ${admins}`);
  if (admins === 0) {
    console.log("  Warning: no ADMIN user. Promote one with npm run admin:promote -- email@example.com");
  }

  console.log("Production verify passed.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

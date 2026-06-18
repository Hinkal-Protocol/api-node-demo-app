import { ALCHEMY_API_KEY } from "../constants/networkRegistry";

/**
 * Throws if any required environment variable is missing, halting before any
 * transaction is attempted.
 */
export const assertMissingEnvVar = (): void => {
  if (!ALCHEMY_API_KEY) {
    throw new Error(
      "ALCHEMY_API_KEY is missing. Set it in your .env file (see .env.example) — RPC URLs cannot be built and no transactions can run without it.",
    );
  }
};

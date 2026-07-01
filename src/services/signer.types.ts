import type { ethers } from "ethers";

/**
 * A signer usable by the batch executor. The code reads `.address` synchronously
 * (logging, ERC20 allowance, session body), so signers must expose it as a field.
 * `ethers.Wallet` and the WDK HD wallet already do; `UtilaSigner` exposes it via
 * a getter over its resolved wallet.
 */
export type HinkalSigner = ethers.Signer & { readonly address: string };

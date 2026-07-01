import type { EnclaveSessionAuthMode } from "../services/enclave-auth";

export type EnclaveTxAuthFields = {
  sessionId: string;
  nonce: string;
  timestamp: number;
  signature?: string;
};

export type EnclaveSession = {
  sessionId: string;
  authMode: EnclaveSessionAuthMode;
  expiresAt: string;
  privateKey: Uint8Array;
};

export type TxSessionAuth = {
  sessionId: string;
  authMode: EnclaveSessionAuthMode;
  privateKey: Uint8Array;
};

export type Auth = {
  sessionId: string;
  privateKey: Uint8Array;
  chainId: number;
};

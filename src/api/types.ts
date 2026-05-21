export type EnclaveAuthFields = {
  signature: string;
  nonce: string;
};

export type TxSessionAuth = EnclaveAuthFields & {
  hasWriteAccess: boolean;
};

export type EnclaveSession = TxSessionAuth & {
  expiresAt: string;
};

export type Auth = EnclaveAuthFields & {
  address: string;
  chainId: number;
};

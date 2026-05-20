export type EnclaveAuthFields = {
  signature: string;
  nonce: string;
};

/** Personal-message auth for getter routes (balance, fees, swap quote). */
export type Auth = EnclaveAuthFields & {
  address: string;
  chainId: number;
};

import { randomUUID } from "crypto";
import { ethers } from "ethers";
import { Auth } from "../api/types";

export const generateNonce = (): string => randomUUID();

export const buildSignMessage = (sessionId: string): string =>
  `Authorize Hinkal session\nSession ID: ${sessionId}`;

/** Personal-message signature for getter routes (balance, fees, swap quote). */
export const buildAuth = async (
  signer: ethers.Wallet,
  chainId: number,
): Promise<Auth> => {
  const nonce = generateNonce();
  const message = buildSignMessage(nonce);
  const signature = await signer.signMessage(message);
  return { signature, nonce, address: signer.address, chainId };
};

export const toAuth = (
  signer: ethers.Wallet,
  chainId: number,
  fields: { signature: string; nonce: string },
): Auth => ({
  ...fields,
  address: signer.address,
  chainId,
});

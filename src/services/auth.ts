import { randomBytes } from "crypto";
import { ethers } from "ethers";
import { Auth } from "../api/types";

export const generateNonce = (): string => randomBytes(16).toString("hex");

export const buildSignMessage = (nonce: string): string => `Hinkal - ${nonce}`;

export const buildAuth = async (
  signer: ethers.Wallet,
  chainId: number,
): Promise<Auth> => {
  const nonce = generateNonce();
  const message = buildSignMessage(nonce);
  const signature = await signer.signMessage(message);
  return { signature, nonce, address: signer.address, chainId };
};

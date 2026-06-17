import { randomUUID } from "crypto";
import { ethers } from "ethers";
import {
  type EnclaveTypedDataPrimaryType,
  getEnclaveTypedDataDomain,
  getTypesForPrimary,
} from "../constants/enclave.constants";
import type { EnclaveAuthFields, TxSessionAuth } from "../api/types";
import type { Recipient } from "../api/privateSend";

export const generateNonce = (): string => randomUUID();

export enum EnclaveSessionAccess {
  Read = "read",
  Write = "write",
}

export const buildEnclaveSignMessage = (
  sessionId: string,
  access: EnclaveSessionAccess = EnclaveSessionAccess.Read,
): string => {
  const lines = ["Authorize Hinkal session", `Session ID: ${sessionId}`];
  if (access === EnclaveSessionAccess.Write) {
    lines.push("This signature can also be used to submit transactions.");
  }
  return lines.join("\n");
};

export const resolveTxAuthFields = async (
  session: TxSessionAuth,
  buildTypedAuth: () => Promise<EnclaveAuthFields>,
): Promise<EnclaveAuthFields> => {
  if (session.hasWriteAccess) {
    return { signature: session.signature, nonce: session.nonce };
  }
  return buildTypedAuth();
};

export const buildEnclaveAuthFields = async (
  signer: ethers.Signer,
): Promise<EnclaveAuthFields> => {
  const nonce = generateNonce();
  const signature = await signer.signMessage(
    buildEnclaveSignMessage(nonce, EnclaveSessionAccess.Read),
  );
  return { signature, nonce };
};

type TokenAmountPair = { token: string; amount: string };

const normalizeTokenAmountPairs = (
  tokenAddresses: string[],
  amounts: string[],
): TokenAmountPair[] => {
  if (tokenAddresses.length !== amounts.length) {
    throw new Error("tokenAddresses and amounts must have the same length");
  }
  return tokenAddresses.map((token, index) => ({
    token,
    amount: amounts[index],
  }));
};

const toTokenAmountValues = (pairs: TokenAmountPair[]) =>
  pairs.map(({ token, amount }) => ({
    token,
    amount: BigInt(amount),
  }));

const signEnclaveTypedData = async (
  signer: ethers.Signer,
  primaryType: EnclaveTypedDataPrimaryType,
  chainId: number,
  buildMessage: (nonce: string) => Record<string, unknown>,
): Promise<EnclaveAuthFields> => {
  const nonce = generateNonce();
  const signature = await signer.signTypedData(
    getEnclaveTypedDataDomain(chainId),
    getTypesForPrimary(primaryType),
    buildMessage(nonce),
  );
  return { signature, nonce };
};

export const buildDepositAuthFields = (
  signer: ethers.Signer,
  primaryType: "Deposit" | "ProoflessDeposit",
  params: { chainId: number; tokenAddresses: string[]; amounts: string[] },
) =>
  signEnclaveTypedData(signer, primaryType, params.chainId, (nonce) => ({
    nonce,
    chainId: BigInt(params.chainId),
    tokenAmounts: toTokenAmountValues(
      normalizeTokenAmountPairs(params.tokenAddresses, params.amounts),
    ),
  }));

export const buildTransferAuthFields = (
  signer: ethers.Signer,
  params: {
    chainId: number;
    tokenAddresses: string[];
    amounts: string[];
    recipient: string;
  },
) =>
  signEnclaveTypedData(signer, "Transfer", params.chainId, (nonce) => ({
    nonce,
    chainId: BigInt(params.chainId),
    tokenAmounts: toTokenAmountValues(
      normalizeTokenAmountPairs(params.tokenAddresses, params.amounts),
    ),
    recipient: params.recipient,
  }));

export const buildWithdrawAuthFields = (
  signer: ethers.Signer,
  params: {
    chainId: number;
    tokenAddresses: string[];
    amounts: string[];
    recipient: string;
  },
) =>
  signEnclaveTypedData(signer, "Withdraw", params.chainId, (nonce) => ({
    nonce,
    chainId: BigInt(params.chainId),
    tokenAmounts: toTokenAmountValues(
      normalizeTokenAmountPairs(params.tokenAddresses, params.amounts),
    ),
    recipient: params.recipient,
  }));

export const buildSwapAuthFields = (
  signer: ethers.Signer,
  params: { chainId: number; tokenAddresses: string[]; amounts: string[] },
) =>
  signEnclaveTypedData(signer, "Swap", params.chainId, (nonce) => ({
    nonce,
    chainId: BigInt(params.chainId),
    tokenAmounts: toTokenAmountValues(
      normalizeTokenAmountPairs(params.tokenAddresses, params.amounts),
    ),
  }));

export const buildPrivateSendAuthFields = (
  signer: ethers.Signer,
  params: {
    chainId: number;
    tokenAddress: string;
    recipients: Recipient[];
  },
) =>
  signEnclaveTypedData(
    signer,
    "PrivateSend",
    params.chainId,
    (nonce) => ({
      nonce,
      chainId: BigInt(params.chainId),
      tokenAddress: params.tokenAddress,
      recipients: params.recipients
        .map(({ address, amount }) => ({
          recipient: ethers.getAddress(address),
          amount: BigInt(amount),
        }))
        .sort((a, b) => a.recipient.localeCompare(b.recipient)),
    }),
  );

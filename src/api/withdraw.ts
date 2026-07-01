import { ethers } from "ethers";
import {
  buildAuthPost,
  buildWithdrawAuthFields,
} from "../services/enclave-auth";
import { enclaveFetch } from "../services/enclaveApi";
import type { TxSessionAuth } from "./types";
import { FeeStructure } from "./fees";

export const withdraw = async (
  signer: ethers.Signer,
  session: TxSessionAuth,
  chainId: number,
  tokenAddresses: string[],
  amounts: string[],
  recipientAddress: string,
  isRelayerOff?: boolean,
  feeToken?: string,
  feeStructure?: FeeStructure,
): Promise<string> => {
  const txData = {
    tokenAddresses,
    amounts,
    recipientAddress,
    isRelayerOff,
    feeToken,
    feeStructure,
  };
  const { bodyJson, headers, requestNonce } = await buildAuthPost(
    session,
    chainId,
    txData,
    () =>
      buildWithdrawAuthFields(session.sessionId, signer, {
        chainId,
        tokenAddresses,
        amounts,
        recipient: recipientAddress,
        feeToken,
        feeStructure,
      }),
  );

  const { res, data } = await enclaveFetch<
    { success: true; txHash: string } | { error?: string }
  >("/withdraw", requestNonce, {
    method: "POST",
    headers,
    body: bodyJson,
  });

  if (!res.ok || !("success" in data && data.success)) {
    throw new Error((data as { error?: string }).error ?? "Withdraw failed");
  }

  return data.txHash;
};

import { ethers } from "ethers";
import {
  buildAuthPost,
  buildTransferAuthFields,
} from "../services/enclave-auth";
import { enclaveFetch } from "../services/enclaveApi";
import type { TxSessionAuth } from "./types";
import { FeeStructure } from "./fees";

export const transfer = async (
  signer: ethers.Signer,
  session: TxSessionAuth,
  chainId: number,
  tokenAddresses: string[],
  amounts: string[],
  recipientAddress: string,
  feeToken?: string,
  feeStructure?: FeeStructure,
): Promise<string> => {
  const txData = {
    tokenAddresses,
    amounts,
    recipientAddress,
    feeToken,
    feeStructure,
  };
  const { bodyJson, headers, requestNonce } = await buildAuthPost(
    session,
    chainId,
    txData,
    () =>
      buildTransferAuthFields(session.sessionId, signer, {
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
  >("/transfer", requestNonce, {
    method: "POST",
    headers,
    body: bodyJson,
  });

  if (!res.ok || !("success" in data && data.success)) {
    throw new Error((data as { error?: string }).error ?? "Transfer failed");
  }

  return data.txHash;
};

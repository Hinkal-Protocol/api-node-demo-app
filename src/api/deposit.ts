import { ethers } from "ethers";
import {
  buildAuthPost,
  buildDepositAuthFields,
} from "../services/enclave-auth";
import { enclaveFetch } from "../services/enclaveApi";
import type { TxSessionAuth } from "./types";

export type TxData = {
  to: string;
  data: string;
  value?: string;
  from?: string;
  gasLimit?: string;
};

export const deposit = async (
  signer: ethers.Signer,
  session: TxSessionAuth,
  chainId: number,
  tokenAddresses: string[],
  amounts: string[],
): Promise<TxData> => {
  const { bodyJson, headers, requestNonce } = await buildAuthPost(
    session,
    chainId,
    { tokenAddresses, amounts },
    () =>
      buildDepositAuthFields(session.sessionId, signer, "Deposit", {
        chainId,
        tokenAddresses,
        amounts,
      }),
  );

  const { res, data } = await enclaveFetch<
    { success: true; txData: TxData } | { error?: string }
  >("/deposit", requestNonce, {
    method: "POST",
    headers,
    body: bodyJson,
  });

  if (!res.ok || !("success" in data && data.success)) {
    throw new Error((data as { error?: string }).error ?? "Deposit failed");
  }

  return data.txData;
};

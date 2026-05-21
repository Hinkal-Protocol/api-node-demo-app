import { ethers } from "ethers";
import { API_BASE_URL } from "../constants/server.constants";
import {
  buildDepositAuthFields,
  resolveTxAuthFields,
} from "../services/enclave-auth";
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
  account: string,
  chainId: number,
  tokenAddresses: string[],
  amounts: string[],
): Promise<TxData> => {
  const authFields = await resolveTxAuthFields(session, () =>
    buildDepositAuthFields(signer, "Deposit", {
      chainId,
      tokenAddresses,
      amounts,
    }),
  );
  const body = {
    ...authFields,
    address: account,
    chainId,
    tokenAddresses,
    amounts,
  };

  const res = await fetch(`${API_BASE_URL}/deposit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as
    | { success: true; txData: TxData }
    | { error?: string };

  if (!res.ok || !("success" in data && data.success)) {
    throw new Error((data as { error?: string }).error ?? "Deposit failed");
  }

  return data.txData;
};

import { buildAuthGet } from "../services/enclave-auth";
import { enclaveFetch } from "../services/enclaveApi";
import { Auth } from "./types";

export enum ExternalActionId {
  Transact = "Transact",
  Uniswap = "Uniswap",
  Odos = "Odos",
  OneInch = "OneInch",
  Lifi = "Lifi",
  Okx = "Okx",
  Emporium = "Emporium",
  Wallet = "Wallet",
}

export type FeeStructure = {
  feeToken: string;
  flatFee: string;
  variableRate: string;
};

export const getFeeStructure = async (
  auth: Auth,
  feeToken: string,
  tokenAddresses: string[],
  externalActionId: ExternalActionId,
  variableRate?: string,
): Promise<FeeStructure> => {
  const params: Record<string, string | string[]> = {
    feeToken,
    externalActionId,
    tokenAddresses,
  };
  if (variableRate !== undefined) {
    params.variableRate = variableRate;
  }

  const { queryString, headers, requestNonce } = buildAuthGet(auth, params);

  const { res, data } = await enclaveFetch<
    { success: true; feeStructure: FeeStructure } | { error?: string }
  >(`/get-fee-structure?${queryString}`, requestNonce, { headers });

  if (!res.ok || !("success" in data && data.success)) {
    throw new Error(
      (data as { error?: string }).error ?? "Fee structure fetch failed",
    );
  }

  return data.feeStructure;
};

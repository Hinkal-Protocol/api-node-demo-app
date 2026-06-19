import { ethers } from "ethers";
import { buildAuthGet, buildAuthPost, buildSwapAuthFields } from "../services/enclave-auth";
import { enclaveFetch } from "../services/enclaveApi";
import { ExternalActionId, FeeStructure } from "./fees";
import type { Auth, TxSessionAuth } from "./types";

export const HINKAL_SWAP_VARIABLE_RATE = 35n;

export type SwapData = {
  swapData: string;
  externalActionId: ExternalActionId;
  outSwapAmount: string;
};

export const getSwapData = async (
  auth: Auth,
  inputTokenAddress: string,
  outputTokenAddress: string,
  amount: string,
  slippagePercentage?: number,
): Promise<SwapData> => {
  const params: Record<string, string> = {
    inputTokenAddress,
    outputTokenAddress,
    amount,
  };
  if (slippagePercentage !== undefined) {
    params.slippagePercentage = String(slippagePercentage);
  }

  const { queryString, headers, requestNonce } = buildAuthGet(auth, params);

  const { res, data } = await enclaveFetch<
    (SwapData & { success: true }) | { error?: string }
  >(`/get-swap-data?${queryString}`, requestNonce, { headers });

  if (!res.ok || !("success" in data && data.success)) {
    throw new Error(
      (data as { error?: string }).error ?? "Swap data fetch failed",
    );
  }

  return {
    swapData: data.swapData,
    externalActionId: data.externalActionId,
    outSwapAmount: data.outSwapAmount,
  };
};

export const executeSwap = async (
  signer: ethers.Signer,
  session: TxSessionAuth,
  chainId: number,
  inputTokenAddress: string,
  outputTokenAddress: string,
  inAmountWei: bigint,
  quotedData: SwapData,
  feeStructure: FeeStructure,
): Promise<string> => {
  const outAmountWei = BigInt(quotedData.outSwapAmount);
  const outAdjusted =
    (outAmountWei * (10000n - HINKAL_SWAP_VARIABLE_RATE)) / 10000n;

  const tokenAddresses = [inputTokenAddress, outputTokenAddress];
  const amounts = [(-inAmountWei).toString(), outAdjusted.toString()];

  const txData = {
    tokenAddresses,
    amounts,
    externalActionId: quotedData.externalActionId,
    swapData: quotedData.swapData,
    feeToken: inputTokenAddress,
    feeStructure,
  };
  const { bodyJson, headers, requestNonce } = await buildAuthPost(
    session,
    chainId,
    txData,
    () =>
      buildSwapAuthFields(session.sessionId, signer, {
        chainId,
        tokenAddresses,
        amounts,
        externalActionId: quotedData.externalActionId,
        swapData: quotedData.swapData,
        feeToken: inputTokenAddress,
        feeStructure,
      }),
  );

  const { res, data } = await enclaveFetch<
    { success: true; txHash: string } | { error?: string }
  >("/swap", requestNonce, {
    method: "POST",
    headers,
    body: bodyJson,
  });

  if (!res.ok || !("success" in data && data.success)) {
    throw new Error((data as { error?: string }).error ?? "Swap failed");
  }

  return data.txHash;
};

import { Auth } from "./types";
import { ExternalActionId, FeeStructure } from "./fees";
import { API_BASE_URL } from "../constants/server.constants";

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
  const { signature, nonce, address, chainId } = auth;
  const body = {
    signature,
    nonce,
    address,
    chainId,
    inputTokenAddress,
    outputTokenAddress,
    amount,
    slippagePercentage,
  };

  const res = await fetch(`${API_BASE_URL}/get-swap-data`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as
    | (SwapData & { success: true })
    | { error?: string };

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
  auth: Auth,
  inputTokenAddress: string,
  outputTokenAddress: string,
  inAmountWei: bigint,
  quotedData: SwapData,
  feeStructure: FeeStructure,
): Promise<string> => {
  const outAmountWei = BigInt(quotedData.outSwapAmount);
  const outAdjusted =
    (outAmountWei * (10000n - HINKAL_SWAP_VARIABLE_RATE)) / 10000n;

  const res = await fetch(`${API_BASE_URL}/swap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...auth,
      tokenAddresses: [inputTokenAddress, outputTokenAddress],
      amounts: [(-inAmountWei).toString(), outAdjusted.toString()],
      externalActionId: quotedData.externalActionId,
      swapData: quotedData.swapData,
      feeToken: inputTokenAddress,
      feeStructure,
    }),
  });

  const data = (await res.json()) as
    | { success: true; txHash: string }
    | { error?: string };

  if (!res.ok || !("success" in data && data.success)) {
    throw new Error((data as { error?: string }).error ?? "Swap failed");
  }

  return data.txHash;
};

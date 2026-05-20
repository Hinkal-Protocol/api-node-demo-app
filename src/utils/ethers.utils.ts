import { ethers } from "ethers";

const GAS_BUMP_NUMERATOR = 120n;
const GAS_BUMP_DENOMINATOR = 100n;

export const getPendingNonce = async (signer: ethers.Signer): Promise<number> => {
  const provider = signer.provider;
  if (!provider) {
    throw new Error("Signer has no provider");
  }
  return provider.getTransactionCount(await signer.getAddress(), "pending");
};

export const buildTxOverrides = async (
  signer: ethers.Signer,
  nonce: number,
): Promise<ethers.TransactionRequest> => {
  const overrides: ethers.TransactionRequest = { nonce };
  const provider = signer.provider;
  if (!provider) return overrides;

  const feeData = await provider.getFeeData();
  if (feeData.maxFeePerGas) {
    overrides.maxFeePerGas =
      (feeData.maxFeePerGas * GAS_BUMP_NUMERATOR) / GAS_BUMP_DENOMINATOR;
  }
  if (feeData.maxPriorityFeePerGas) {
    overrides.maxPriorityFeePerGas =
      (feeData.maxPriorityFeePerGas * GAS_BUMP_NUMERATOR) /
      GAS_BUMP_DENOMINATOR;
  }
  return overrides;
};

export const sendTransactionWithNonce = async (
  signer: ethers.Signer,
  request: ethers.TransactionRequest,
): Promise<ethers.TransactionResponse> => {
  const nonce = await getPendingNonce(signer);
  const overrides = await buildTxOverrides(signer, nonce);
  return signer.sendTransaction({ ...request, ...overrides });
};

import { BatchTransactionInput } from "../types";
import { executeTransaction } from "./executeTransaction";
import { ethers } from "ethers";
import {
  logBatchStart,
  logTransaction,
  logWallet,
  logSuccess,
  logBatchFailure,
  logBatchComplete,
} from "../utils/logger";
import { networkRegistry } from "../constants";
import { EnclaveSession } from "../api/types";
import { createEnclaveSession } from "./session";

export interface BatchProcessResult {
  jobId: string;
  success: boolean;
  totalTransactions: number;
  completedTransactions: number;
  failedTransactionId?: string;
  error?: string;
}

const providerCache = new Map<number, ethers.Provider>();

const getProvider = (chainId: number, rpcUrl: string): ethers.Provider => {
  if (!providerCache.has(chainId)) {
    providerCache.set(chainId, new ethers.JsonRpcProvider(rpcUrl));
  }
  return providerCache.get(chainId)!;
};

const sessionCache = new Map<string, EnclaveSession>();

const getSession = async (
  signer: ethers.Wallet,
  chainId: number,
): Promise<EnclaveSession> => {
  const key = `${signer.address.toLowerCase()}:${chainId}`;
  const cached = sessionCache.get(key);
  if (cached) return cached;

  const session = await createEnclaveSession(signer, chainId, true);
  sessionCache.set(key, session);
  return session;
};

export const processBatch = async (
  input: BatchTransactionInput,
): Promise<BatchProcessResult> => {
  const jobId = `batch-${Date.now()}`;
  const startTime = Date.now();
  let completedCount = 0;

  try {
    if (!input.transactions?.length) {
      throw new Error("No transactions found in batch");
    }

    logBatchStart(jobId, input.transactions.length, input.chainId);

    for (let i = 0; i < input.transactions.length; i++) {
      const tx = input.transactions[i];
      const chainId = tx.chainId || input.chainId;

      if (!chainId)
        throw new Error(
          `Transaction ${tx.id}: missing chainId (not specified in transaction or default)`,
        );

      if (!tx.privateKey)
        throw new Error(`Transaction ${tx.id}: missing privateKey`);

      const rpcUrl = networkRegistry[chainId]?.fetchRpcUrl;
      if (!rpcUrl) throw new Error(`RPC URL not found for chain ${chainId}`);

      const provider = getProvider(chainId, rpcUrl);
      const signer = new ethers.Wallet(tx.privateKey, provider);
      const balance = await provider.getBalance(signer.address);
      const balanceNative = ethers.formatEther(balance);

      logTransaction(i + 1, input.transactions.length, tx.type, tx.id);
      await logWallet(signer.address, balanceNative, chainId);

      const session = await getSession(signer, chainId);
      const result = await executeTransaction(signer, chainId, session, tx);

      if (!result.success) {
        const errorMessage = result.error || "Unknown error";
        logBatchFailure(tx.id, i + 1, input.transactions.length, errorMessage);
        return {
          jobId,
          success: false,
          totalTransactions: input.transactions.length,
          completedTransactions: completedCount,
          failedTransactionId: tx.id,
          error: errorMessage,
        };
      }

      completedCount++;
      if (result.txHash)
        logSuccess(result.txHash, result.blockNumber, result.gasUsed);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logBatchComplete(duration, completedCount, input.transactions.length);

    return {
      jobId,
      success: true,
      totalTransactions: input.transactions.length,
      completedTransactions: completedCount,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Critical batch failure: ${errorMessage}`);

    return {
      jobId,
      success: false,
      totalTransactions: input.transactions?.length || 0,
      completedTransactions: completedCount,
      error: errorMessage,
    };
  }
};

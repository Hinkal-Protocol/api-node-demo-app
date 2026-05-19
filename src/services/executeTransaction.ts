import { ethers } from "ethers";
import {
  BatchTransaction,
  BatchTransactionType,
  DepositTransaction,
  SwapTransaction,
  TransferTransaction,
  WithdrawTransaction,
} from "../types";
import { Auth } from "../api/types";
import { deposit } from "../api/deposit";
import { withdraw } from "../api/withdraw";
import { transfer } from "../api/transfer";
import { executeSwap, getSwapData } from "../api/swap";
import { ExternalActionId, getFeeStructure } from "../api/fees";
import { getERC20Token } from "../constants/token-data";

export interface ExecutionResult {
  success: boolean;
  txHash?: string;
  blockNumber?: number;
  gasUsed?: string;
  error?: string;
}

const ERC20_APPROVE_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
];

const fail = (error: unknown): ExecutionResult => ({
  success: false,
  error:
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : String(error),
});

const executeDeposit = async (
  signer: ethers.Wallet,
  auth: Auth,
  tx: DepositTransaction,
): Promise<ExecutionResult> => {
  try {
    const txData = await deposit(auth, [tx.tokenAddress], [tx.amount]);

    const erc20 = new ethers.Contract(
      tx.tokenAddress,
      ERC20_APPROVE_ABI,
      signer,
    );
    const approveTx = await erc20.approve(txData.to, BigInt(tx.amount));
    await approveTx.wait();

    const depositTx = await signer.sendTransaction({
      to: txData.to,
      data: txData.data,
      value: txData.value ? BigInt(txData.value) : undefined,
    });
    const receipt = await depositTx.wait();

    return {
      success: true,
      txHash: receipt?.hash ?? depositTx.hash,
      blockNumber: receipt?.blockNumber,
      gasUsed: receipt?.gasUsed?.toString(),
    };
  } catch (error) {
    return fail(error);
  }
};

const executeWithdraw = async (
  auth: Auth,
  tx: WithdrawTransaction,
): Promise<ExecutionResult> => {
  try {
    const isRelayerOff = tx.isRelayerOff ?? false;
    const feeStructure = isRelayerOff
      ? undefined
      : await getFeeStructure(
          auth,
          tx.feeToken ?? tx.tokenAddress,
          [tx.tokenAddress],
          ExternalActionId.Transact,
        );

    const txHash = await withdraw(
      auth,
      [tx.tokenAddress],
      [tx.amount],
      tx.recipientAddress,
      isRelayerOff,
      tx.feeToken ?? tx.tokenAddress,
      feeStructure,
    );
    return { success: true, txHash };
  } catch (error) {
    return fail(error);
  }
};

const executeTransfer = async (
  auth: Auth,
  tx: TransferTransaction,
): Promise<ExecutionResult> => {
  try {
    const feeStructure = await getFeeStructure(
      auth,
      tx.feeToken ?? tx.tokenAddress,
      [tx.tokenAddress],
      ExternalActionId.Transact,
    );

    const txHash = await transfer(
      auth,
      [tx.tokenAddress],
      [tx.amount],
      tx.recipientAddress.trim(),
      tx.feeToken ?? tx.tokenAddress,
      feeStructure,
    );
    return { success: true, txHash };
  } catch (error) {
    return fail(error);
  }
};

const executeSwapAction = async (
  auth: Auth,
  tx: SwapTransaction,
): Promise<ExecutionResult> => {
  try {
    const quotedData = await getSwapData(
      auth,
      tx.tokenIn,
      tx.tokenOut,
      tx.amountIn,
      tx.slippagePercentage,
    );

    const inToken = getERC20Token(tx.tokenIn, auth.chainId);
    if (!inToken) throw new Error(`Token not found: ${tx.tokenIn} on chain ${auth.chainId}`);
    const inAmountWei = BigInt(Math.floor(parseFloat(tx.amountIn) * 10 ** inToken.decimals));

    const txHash = await executeSwap(
      auth,
      tx.tokenIn,
      tx.tokenOut,
      inAmountWei,
      quotedData,
    );
    return { success: true, txHash };
  } catch (error) {
    return fail(error);
  }
};

export const executeTransaction = async (
  signer: ethers.Wallet,
  auth: Auth,
  tx: BatchTransaction,
): Promise<ExecutionResult> => {
  try {
    switch (tx.type) {
      case BatchTransactionType.Deposit:
        return await executeDeposit(signer, auth, tx as DepositTransaction);
      case BatchTransactionType.Withdraw:
        return await executeWithdraw(auth, tx as WithdrawTransaction);
      case BatchTransactionType.Transfer:
        return await executeTransfer(auth, tx as TransferTransaction);
      case BatchTransactionType.Swap:
        return await executeSwapAction(auth, tx as SwapTransaction);
      default:
        return {
          success: false,
          error: `Unknown transaction type: ${(tx as any).type}`,
        };
    }
  } catch (error) {
    return fail(error);
  }
};

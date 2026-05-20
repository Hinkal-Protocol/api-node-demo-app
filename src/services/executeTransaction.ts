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
import {
  executeSwap,
  getSwapData,
  HINKAL_SWAP_VARIABLE_RATE,
} from "../api/swap";
import { ExternalActionId, getFeeStructure } from "../api/fees";
import { getERC20Token } from "../constants/token-data";
import { resolveAmountToWeiString } from "../utils/amount.utils";
import { isNativeTokenAddress } from "../utils/tokens.utils";
import { buildAuth, toAuth } from "./auth";
import {
  buildDepositAuthFields,
  buildSwapAuthFields,
  buildTransferAuthFields,
  buildWithdrawAuthFields,
} from "./enclave-auth";
import {
  buildTxOverrides,
  getPendingNonce,
  sendTransactionWithNonce,
} from "../utils/ethers.utils";

export interface ExecutionResult {
  success: boolean;
  txHash?: string;
  blockNumber?: number;
  gasUsed?: string;
  error?: string;
}

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
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
  chainId: number,
  tx: DepositTransaction,
): Promise<ExecutionResult> => {
  try {
    const authFields = await buildDepositAuthFields(signer, "Deposit", {
      chainId,
      tokenAddresses: [tx.tokenAddress],
      amounts: [tx.amount],
    });
    const auth = toAuth(signer, chainId, authFields);
    const txData = await deposit(auth, [tx.tokenAddress], [tx.amount]);

    if (!isNativeTokenAddress(tx.tokenAddress)) {
      const amount = BigInt(tx.amount);
      const erc20 = new ethers.Contract(tx.tokenAddress, ERC20_ABI, signer);
      const allowance = await erc20.allowance(signer.address, txData.to);

      if (allowance < amount) {
        const approveNonce = await getPendingNonce(signer);
        const approveTx = await erc20.approve(
          txData.to,
          amount,
          await buildTxOverrides(signer, approveNonce),
        );
        await approveTx.wait();
      }
    }

    const depositTx = await sendTransactionWithNonce(signer, {
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

const resolveTxAmount = (
  amount: string,
  tokenAddress: string,
  chainId: number,
): string => {
  const token = getERC20Token(tokenAddress, chainId);
  if (!token) {
    throw new Error(`Token not found: ${tokenAddress} on chain ${chainId}`);
  }
  return resolveAmountToWeiString(amount, token);
};

const executeWithdraw = async (
  signer: ethers.Wallet,
  chainId: number,
  tx: WithdrawTransaction,
): Promise<ExecutionResult> => {
  try {
    const amountWei = resolveTxAmount(tx.amount, tx.tokenAddress, chainId);
    const getterAuth = await buildAuth(signer, chainId);
    const isRelayerOff = tx.isRelayerOff ?? false;
    const feeStructure = isRelayerOff
      ? undefined
      : await getFeeStructure(
          getterAuth,
          tx.feeToken ?? tx.tokenAddress,
          [tx.tokenAddress],
          ExternalActionId.Transact,
        );

    const authFields = await buildWithdrawAuthFields(signer, {
      chainId,
      tokenAddresses: [tx.tokenAddress],
      amounts: [amountWei],
      recipient: tx.recipientAddress,
    });
    const auth = toAuth(signer, chainId, authFields);

    const txHash = await withdraw(
      auth,
      [tx.tokenAddress],
      [amountWei],
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
  signer: ethers.Wallet,
  chainId: number,
  tx: TransferTransaction,
): Promise<ExecutionResult> => {
  try {
    const amountWei = resolveTxAmount(tx.amount, tx.tokenAddress, chainId);
    const getterAuth = await buildAuth(signer, chainId);
    const feeStructure = await getFeeStructure(
      getterAuth,
      tx.feeToken ?? tx.tokenAddress,
      [tx.tokenAddress],
      ExternalActionId.Transact,
    );

    const authFields = await buildTransferAuthFields(signer, {
      chainId,
      tokenAddresses: [tx.tokenAddress],
      amounts: [amountWei],
      recipient: tx.recipientAddress.trim(),
    });
    const auth = toAuth(signer, chainId, authFields);

    const txHash = await transfer(
      auth,
      [tx.tokenAddress],
      [amountWei],
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
  signer: ethers.Wallet,
  chainId: number,
  tx: SwapTransaction,
): Promise<ExecutionResult> => {
  try {
    const getterAuth = await buildAuth(signer, chainId);
    const quotedData = await getSwapData(
      getterAuth,
      tx.tokenIn,
      tx.tokenOut,
      tx.amountIn,
      tx.slippagePercentage,
    );

    const inToken = getERC20Token(tx.tokenIn, chainId);
    if (!inToken)
      throw new Error(`Token not found: ${tx.tokenIn} on chain ${chainId}`);
    const inAmountWei = BigInt(
      Math.floor(parseFloat(tx.amountIn) * 10 ** inToken.decimals),
    );

    const outAmountWei = BigInt(quotedData.outSwapAmount);
    const outAdjusted =
      (outAmountWei * (10000n - HINKAL_SWAP_VARIABLE_RATE)) / 10000n;

    const feeStructure = await getFeeStructure(
      getterAuth,
      tx.tokenIn,
      [tx.tokenIn, tx.tokenOut],
      quotedData.externalActionId,
      HINKAL_SWAP_VARIABLE_RATE.toString(),
    );

    const authFields = await buildSwapAuthFields(signer, {
      chainId,
      tokenAddresses: [tx.tokenIn, tx.tokenOut],
      amounts: [(-inAmountWei).toString(), outAdjusted.toString()],
    });
    const auth = toAuth(signer, chainId, authFields);

    const txHash = await executeSwap(
      auth,
      tx.tokenIn,
      tx.tokenOut,
      inAmountWei,
      quotedData,
      feeStructure,
    );
    return { success: true, txHash };
  } catch (error) {
    return fail(error);
  }
};

export const executeTransaction = async (
  signer: ethers.Wallet,
  chainId: number,
  tx: BatchTransaction,
): Promise<ExecutionResult> => {
  try {
    switch (tx.type) {
      case BatchTransactionType.Deposit:
        return await executeDeposit(signer, chainId, tx as DepositTransaction);
      case BatchTransactionType.Withdraw:
        return await executeWithdraw(
          signer,
          chainId,
          tx as WithdrawTransaction,
        );
      case BatchTransactionType.Transfer:
        return await executeTransfer(
          signer,
          chainId,
          tx as TransferTransaction,
        );
      case BatchTransactionType.Swap:
        return await executeSwapAction(signer, chainId, tx as SwapTransaction);
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

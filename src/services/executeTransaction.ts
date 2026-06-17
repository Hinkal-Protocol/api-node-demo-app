import { ethers } from "ethers";
import {
  BatchTransaction,
  BatchTransactionType,
  PrivateSendTransaction,
  DepositTransaction,
  SwapTransaction,
  TransferTransaction,
  WithdrawTransaction,
} from "../types";
import { deposit } from "../api/deposit";
import { withdraw } from "../api/withdraw";
import { transfer } from "../api/transfer";
import {
  executeSwap,
  getSwapData,
  HINKAL_SWAP_VARIABLE_RATE,
} from "../api/swap";
import {
  privateSend,
  PrivateSendPublicStatus,
  waitForOrderTerminal,
} from "../api/privateSend";
import { ExternalActionId, getFeeStructure } from "../api/fees";
import { getERC20Token } from "../constants/token-data";
import { resolveAmountToWeiString } from "../utils/amount.utils";
import { isNativeTokenAddress } from "../utils/tokens.utils";
import type { Auth, TxSessionAuth } from "../api/types";
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

const buildGetterAuth = (
  signer: ethers.BaseWallet,
  session: TxSessionAuth,
  chainId: number,
): Auth => ({
  signature: session.signature,
  nonce: session.nonce,
  address: signer.address,
  chainId,
});

const executeDeposit = async (
  signer: ethers.BaseWallet,
  session: TxSessionAuth,
  chainId: number,
  tx: DepositTransaction,
): Promise<ExecutionResult> => {
  try {
    const txData = await deposit(
      signer,
      session,
      signer.address,
      chainId,
      [tx.tokenAddress],
      [tx.amount],
    );

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

const executeWithdraw = async (
  signer: ethers.BaseWallet,
  session: TxSessionAuth,
  chainId: number,
  tx: WithdrawTransaction,
): Promise<ExecutionResult> => {
  try {
    const amountWei = resolveTxAmount(tx.amount, tx.tokenAddress, chainId);
    const isRelayerOff = tx.isRelayerOff ?? false;
    const feeStructure = isRelayerOff
      ? undefined
      : await getFeeStructure(
        buildGetterAuth(signer, session, chainId),
        tx.feeToken ?? tx.tokenAddress,
        [tx.tokenAddress],
        ExternalActionId.Transact,
      );

    const txHash = await withdraw(
      signer,
      session,
      signer.address,
      chainId,
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
  signer: ethers.BaseWallet,
  session: TxSessionAuth,
  chainId: number,
  tx: TransferTransaction,
): Promise<ExecutionResult> => {
  try {
    const amountWei = resolveTxAmount(tx.amount, tx.tokenAddress, chainId);
    const feeStructure = await getFeeStructure(
      buildGetterAuth(signer, session, chainId),
      tx.feeToken ?? tx.tokenAddress,
      [tx.tokenAddress],
      ExternalActionId.Transact,
    );

    const txHash = await transfer(
      signer,
      session,
      signer.address,
      chainId,
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
  signer: ethers.BaseWallet,
  session: TxSessionAuth,
  chainId: number,
  tx: SwapTransaction,
): Promise<ExecutionResult> => {
  try {
    const getterAuth = buildGetterAuth(signer, session, chainId);
    const inAmountWeiStr = resolveTxAmount(tx.amountIn, tx.tokenIn, chainId);
    const inAmountWei = BigInt(inAmountWeiStr);
    const quotedData = await getSwapData(
      getterAuth,
      tx.tokenIn,
      tx.tokenOut,
      inAmountWeiStr,
      tx.slippagePercentage,
    );

    const feeStructure = await getFeeStructure(
      getterAuth,
      tx.tokenIn,
      [tx.tokenIn, tx.tokenOut],
      quotedData.externalActionId,
      HINKAL_SWAP_VARIABLE_RATE.toString(),
    );

    const txHash = await executeSwap(
      signer,
      session,
      signer.address,
      chainId,
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

const executePrivateSend = async (
  signer: ethers.BaseWallet,
  session: TxSessionAuth,
  chainId: number,
  tx: PrivateSendTransaction,
): Promise<ExecutionResult> => {
  try {
    const recipients = tx.recipients.map((recipient) => ({
      address: recipient.address,
      amount: resolveTxAmount(recipient.amount, tx.tokenAddress, chainId),
    }));

    const order = await privateSend(
      signer,
      session,
      signer.address,
      chainId,
      tx.tokenAddress,
      recipients,
      tx.feeToken,
      tx.txCompletionTime,
    );

    if (order.approvalAddress && !isNativeTokenAddress(tx.tokenAddress)) {
      const amountIn = BigInt(order.amountIn);
      const erc20 = new ethers.Contract(tx.tokenAddress, ERC20_ABI, signer);
      const allowance = await erc20.allowance(
        signer.address,
        order.approvalAddress,
      );
      if (allowance < amountIn) {
        const approveNonce = await getPendingNonce(signer);
        const approveTx = await erc20.approve(
          order.approvalAddress,
          amountIn,
          await buildTxOverrides(signer, approveNonce),
        );
        await approveTx.wait();
      }
    }

    const rlpHex =
      "0x" + Buffer.from(order.serializedTx, "base64").toString("hex");
    const parsedTx = ethers.Transaction.from(rlpHex);
    const depositTx = await sendTransactionWithNonce(signer, {
      to: parsedTx.to ?? undefined,
      data: parsedTx.data,
      value: parsedTx.value,
    });
    const receipt = await depositTx.wait();

    const finalOrder = await waitForOrderTerminal(order.orderId);
    if (finalOrder.status !== PrivateSendPublicStatus.Scheduled) {
      throw new Error(`Order ended as '${finalOrder.status}'`);
    }

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

export const executeTransaction = async (
  signer: ethers.BaseWallet,
  chainId: number,
  session: TxSessionAuth,
  tx: BatchTransaction,
): Promise<ExecutionResult> => {
  try {
    switch (tx.type) {
      case BatchTransactionType.Deposit:
        return await executeDeposit(
          signer,
          session,
          chainId,
          tx as DepositTransaction,
        );
      case BatchTransactionType.Withdraw:
        return await executeWithdraw(
          signer,
          session,
          chainId,
          tx as WithdrawTransaction,
        );
      case BatchTransactionType.Transfer:
        return await executeTransfer(
          signer,
          session,
          chainId,
          tx as TransferTransaction,
        );
      case BatchTransactionType.Swap:
        return await executeSwapAction(
          signer,
          session,
          chainId,
          tx as SwapTransaction,
        );
      case BatchTransactionType.PrivateSend:
        return await executePrivateSend(
          signer,
          session,
          chainId,
          tx as PrivateSendTransaction,
        );
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

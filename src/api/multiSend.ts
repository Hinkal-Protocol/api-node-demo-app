import { ethers } from "ethers";
import { API_BASE_URL } from "../constants/server.constants";
import {
  buildDepositAndWithdrawAuthFields,
  resolveTxAuthFields,
} from "../services/enclave-auth";
import type { TxSessionAuth } from "./types";

// Values must match the server's DepositAndWithdrawOrderStatus enum
// (apps/enclave-api/src/models/DepositAndWithdrawOrderSchema.ts).
export enum OrderStatus {
  AwaitingDeposit = "awaiting-deposit",
  DepositConfirmed = "deposit-confirmed",
  WithdrawScheduled = "withdraw-scheduled",
  Failed = "failed",
  Expired = "expired",
}

export type Recipient = { address: string; amount: string };

export type DepositAndWithdrawOrder = {
  orderId: string;
  approvalAddress: string | null;
  serializedTx: string;
  amountIn: string;
  amountOut: string;
  fee: string;
};

export const depositAndWithdraw = async (
  signer: ethers.Signer,
  session: TxSessionAuth,
  account: string,
  chainId: number,
  tokenAddress: string,
  recipients: Recipient[],
  feeToken?: string,
  txCompletionTime?: number,
): Promise<DepositAndWithdrawOrder> => {
  const authFields = await resolveTxAuthFields(session, () =>
    buildDepositAndWithdrawAuthFields(signer, {
      chainId,
      tokenAddress,
      recipients,
    }),
  );
  const body = {
    ...authFields,
    address: account,
    chainId,
    tokenAddress,
    recipients,
    feeToken,
    ...(txCompletionTime !== undefined && { txCompletionTime }),
  };

  const res = await fetch(`${API_BASE_URL}/deposit-and-withdraw`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as
    | ({ success: true } & DepositAndWithdrawOrder)
    | { error?: string };

  if (!res.ok || !("success" in data && data.success)) {
    throw new Error(
      (data as { error?: string }).error ?? "depositAndWithdraw failed",
    );
  }

  return {
    orderId: data.orderId,
    approvalAddress: data.approvalAddress,
    serializedTx: data.serializedTx,
    amountIn: data.amountIn,
    amountOut: data.amountOut,
    fee: data.fee,
  };
};

export type OrderStatusResponse = {
  success: boolean;
  status: OrderStatus;
  txHash: string | null;
  scheduleId: string | null;
  failureReason: string | null;
};

export const getOrderStatus = async (
  orderId: string,
): Promise<OrderStatusResponse> => {
  const res = await fetch(`${API_BASE_URL}/deposit-and-withdraw/${orderId}`);
  const data = (await res.json()) as OrderStatusResponse & { error?: string };

  if (!res.ok || data.success === false) {
    throw new Error(data.error ?? "Order status fetch failed");
  }

  return data;
};

const POLL_INTERVAL_MS = 5_000;
const POLL_TIMEOUT_MS = 10 * 60_000;

const TERMINAL_STATUSES = new Set<OrderStatus>([
  OrderStatus.WithdrawScheduled,
  OrderStatus.Failed,
  OrderStatus.Expired,
]);

export const waitForOrderTerminal = async (
  orderId: string,
): Promise<OrderStatusResponse> => {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const data = await getOrderStatus(orderId);
    if (TERMINAL_STATUSES.has(data.status)) {
      return data;
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new Error(`Order ${orderId} did not reach a terminal state in time`);
};

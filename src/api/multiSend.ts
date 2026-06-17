import { ethers } from "ethers";
import { API_BASE_URL } from "../constants/server.constants";
import {
  buildPrivateSendAuthFields,
  resolveTxAuthFields,
} from "../services/enclave-auth";
import type { TxSessionAuth } from "./types";

export enum PrivateSendPublicStatus {
  Processing = "processing",
  Failed = "failed",
  Scheduled = "scheduled",
}

export interface ScheduledTransactionItemStatus {
  status: string;
  scheduledTime: string;
  txHash: string | null;
}

export type Recipient = { address: string; amount: string };

export type PrivateSendOrder = {
  orderId: string;
  approvalAddress: string | null;
  serializedTx: string;
  amountIn: string;
  amountOut: string;
  fee: string;
};

export const privateSend = async (
  signer: ethers.Signer,
  session: TxSessionAuth,
  account: string,
  chainId: number,
  tokenAddress: string,
  recipients: Recipient[],
  feeToken?: string,
  txCompletionTime?: number,
): Promise<PrivateSendOrder> => {
  const authFields = await resolveTxAuthFields(session, () =>
    buildPrivateSendAuthFields(signer, {
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

  const res = await fetch(`${API_BASE_URL}/private-send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as
    | ({ success: true } & PrivateSendOrder)
    | { error?: string };

  if (!res.ok || !("success" in data && data.success)) {
    throw new Error(
      (data as { error?: string }).error ?? "privateSend failed",
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
  status: PrivateSendPublicStatus;
  scheduledTransactions?: ScheduledTransactionItemStatus[];
};

export const getOrderStatus = async (
  orderId: string,
): Promise<OrderStatusResponse> => {
  const res = await fetch(`${API_BASE_URL}/private-send/${orderId}`);
  const data = (await res.json()) as OrderStatusResponse & { error?: string };

  if (!res.ok || data.success === false) {
    throw new Error(data.error ?? "Order status fetch failed");
  }

  return data;
};

const POLL_INTERVAL_MS = 5_000;
const POLL_TIMEOUT_MS = 10 * 60_000;

const TERMINAL_STATUSES = new Set<PrivateSendPublicStatus>([
  PrivateSendPublicStatus.Failed,
  PrivateSendPublicStatus.Scheduled,
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

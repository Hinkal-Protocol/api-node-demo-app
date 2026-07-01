import { ethers } from "ethers";
import {
  buildAuthPost,
  buildPrivateSendAuthFields,
} from "../services/enclave-auth";
import { enclaveFetch } from "../services/enclaveApi";
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
  chainId: number,
  tokenAddress: string,
  recipients: Recipient[],
  feeToken?: string,
  txCompletionTime?: number,
): Promise<PrivateSendOrder> => {
  const txData = {
    tokenAddress,
    recipients,
    feeToken,
    ...(txCompletionTime !== undefined && { txCompletionTime }),
  };
  const { bodyJson, headers, requestNonce } = await buildAuthPost(
    session,
    chainId,
    txData,
    () =>
      buildPrivateSendAuthFields(session.sessionId, signer, {
        chainId,
        tokenAddress,
        recipients,
        feeToken,
        txCompletionTime,
      }),
  );

  const { res, data } = await enclaveFetch<
    ({ success: true } & PrivateSendOrder) | { error?: string }
  >("/private-send", requestNonce, {
    method: "POST",
    headers,
    body: bodyJson,
  });

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
  const { res, data } = await enclaveFetch<
    OrderStatusResponse & { error?: string }
  >(`/private-send/${orderId}`);

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

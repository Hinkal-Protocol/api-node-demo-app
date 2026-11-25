import { buildAuthGet, buildAuthPost } from "../services/enclave-auth";
import { enclaveFetch } from "../services/enclaveApi";
import { EnclaveApiRoute } from "../constants/server.constants";
import {
  PrivateSendPublicStatus,
  type OrderStatusResponse,
  type PrivateSendOrder,
  type Recipient,
} from "./privateSend";
import type { Auth, TxSessionAuth } from "./types";

export type PrivateSendBridgeTxData = {
  to: string;
  data: string;
  value: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  gasPrice?: string;
};

export type PrivateSendBridgeOrder = PrivateSendOrder & {
  txData?: PrivateSendBridgeTxData;
};

export type PrivateSendBridgeQuote = {
  quote: string;
  expectedAmounts: string[];
};

export const getPrivateSendBridgeQuote = async (
  auth: Auth,
  tokenAddress: string,
  destinationChainId: number,
  destinationTokenAddress: string,
  recipients: Recipient[],
  slippagePercentage?: number,
  txCompletionTime?: number,
): Promise<PrivateSendBridgeQuote> => {
  const params: Record<string, string | string[]> = {
    destinationChainId: String(destinationChainId),
    inputTokenAddress: tokenAddress,
    outputTokenAddress: destinationTokenAddress,
    recipientAddresses: recipients.map((recipient) => recipient.address),
    amounts: recipients.map((recipient) => recipient.amount),
  };
  if (slippagePercentage !== undefined) {
    params.slippagePercentage = String(slippagePercentage);
  }
  if (txCompletionTime !== undefined) {
    params.txCompletionTime = String(txCompletionTime);
  }

  const { queryString, headers, requestNonce } = buildAuthGet(
    auth,
    EnclaveApiRoute.GetPrivateSendBridgeQuote,
    params,
  );

  const { res, data } = await enclaveFetch<
    ({ success: true } & PrivateSendBridgeQuote) | { error?: string }
  >(`${EnclaveApiRoute.GetPrivateSendBridgeQuote}?${queryString}`, requestNonce, {
    headers,
  });

  if (!res.ok || !("success" in data && data.success)) {
    throw new Error(
      (data as { error?: string }).error ?? "Bridge quote fetch failed",
    );
  }

  return { quote: data.quote, expectedAmounts: data.expectedAmounts };
};

export const privateSendBridge = async (
  session: TxSessionAuth,
  chainId: number,
  tokenAddress: string,
  destinationChainId: number,
  destinationTokenAddress: string,
  recipients: Recipient[],
  quote: string,
): Promise<PrivateSendBridgeOrder> => {
  const txData = {
    tokenAddress,
    destinationChainId,
    destinationTokenAddress,
    recipients,
    quote,
  };
  const { bodyJson, headers, requestNonce } = await buildAuthPost(
    session,
    EnclaveApiRoute.PrivateSendBridge,
    chainId,
    txData,
    () => {
      throw new Error("private-send-bridge needs a normal auth mode session");
    },
  );

  const { res, data } = await enclaveFetch<
    ({ success: true } & PrivateSendBridgeOrder) | { error?: string }
  >(EnclaveApiRoute.PrivateSendBridge, requestNonce, {
    method: "POST",
    headers,
    body: bodyJson,
  });

  if (!res.ok || !("success" in data && data.success)) {
    throw new Error(
      (data as { error?: string }).error ?? "privateSendBridge failed",
    );
  }

  return {
    orderId: data.orderId,
    approvalAddress: data.approvalAddress,
    serializedTx: data.serializedTx,
    amountIn: data.amountIn,
    amountOut: data.amountOut,
    fee: data.fee,
    txData: data.txData,
  };
};

export const getBridgeOrderStatus = async (
  auth: Auth,
  orderId: string,
): Promise<OrderStatusResponse> => {
  const { queryString, headers, requestNonce } = buildAuthGet(
    auth,
    EnclaveApiRoute.PrivateSendBridgeOrder,
  );

  const { res, data } = await enclaveFetch<
    OrderStatusResponse & { error?: string }
  >(`${EnclaveApiRoute.PrivateSendBridge}/${orderId}?${queryString}`, requestNonce, {
    headers,
  });

  if (!res.ok || data.success === false) {
    throw new Error(data.error ?? "Bridge order status fetch failed");
  }

  return data;
};

const POLL_INTERVAL_MS = 5_000;
const POLL_TIMEOUT_MS = 10 * 60_000;

const TERMINAL_STATUSES = new Set<PrivateSendPublicStatus>([
  PrivateSendPublicStatus.Failed,
  PrivateSendPublicStatus.Scheduled,
]);

export const waitForBridgeOrderTerminal = async (
  auth: Auth,
  orderId: string,
): Promise<OrderStatusResponse> => {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const data = await getBridgeOrderStatus(auth, orderId);
    if (TERMINAL_STATUSES.has(data.status)) {
      return data;
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new Error(`Order ${orderId} did not reach a terminal state in time`);
};

export const ENCLAVE_API_URL_LOCAL = "http://localhost:7077";
export const ENCLAVE_API_STAGING_URL = "https://api-staging.hinkal.io";
export const ENCLAVE_API_PRODUCTION_URL = "https://api.hinkal.io";

export const API_BASE_URL: string = ENCLAVE_API_PRODUCTION_URL;

export enum EnclaveApiRoute {
  CreateSession = "/create-session",
  Balance = "/balance",
  GetFeeStructure = "/get-fee-structure",
  GetSwapData = "/get-swap-data",
  Deposit = "/deposit",
  Withdraw = "/withdraw",
  Transfer = "/transfer",
  Swap = "/swap",
  PrivateSend = "/private-send",
  GetPrivateSendBridgeQuote = "/get-private-send-bridge-quote",
  PrivateSendBridge = "/private-send-bridge",
  PrivateSendBridgeOrder = "/private-send-bridge/:orderId",
}

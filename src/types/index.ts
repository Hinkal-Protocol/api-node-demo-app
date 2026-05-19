export enum BatchTransactionType {
  Deposit = "deposit",
  Withdraw = "withdraw",
  Transfer = "transfer",
  Swap = "swap",
}

export interface BatchWalletConfig {
  privateKey: string;
  chainId: number;
}

export interface BaseBatchTransaction {
  id: string;
  type: BatchTransactionType;
  privateKey: string;
  chainId?: number;
}

export interface DepositTransaction extends BaseBatchTransaction {
  type: BatchTransactionType.Deposit;
  tokenAddress: string;
  amount: string;
}

export interface WithdrawTransaction extends BaseBatchTransaction {
  type: BatchTransactionType.Withdraw;
  tokenAddress: string;
  amount: string;
  recipientAddress: string;
  isRelayerOff?: boolean;
  feeToken?: string;
}

export interface TransferTransaction extends BaseBatchTransaction {
  type: BatchTransactionType.Transfer;
  tokenAddress: string;
  amount: string;
  recipientAddress: string;
  feeToken?: string;
}

export interface SwapTransaction extends BaseBatchTransaction {
  type: BatchTransactionType.Swap;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  slippagePercentage?: number;
  externalActionId?: number;
  swapData?: string;
  feeToken?: string;
}

export type BatchTransaction =
  | DepositTransaction
  | WithdrawTransaction
  | TransferTransaction
  | SwapTransaction;

export interface BatchTransactionInput {
  chainId: number;
  transactions: BatchTransaction[];
}

export type Network = {
  chainId: number;
  name: string;
  fetchRpcUrl: string;
};

export interface ERC20Token {
  chainId: number;
  erc20TokenAddress: string;
  wrappedErc20TokenAddress?: string;
  underlyingErc20TokenAddress?: string;
  name: string;
  symbol: string;
  decimals: number;
  nftTokenType?: string;
  logoURI?: string;
  logoURIs?: string[];
  whitelisted?: boolean;
  isCustom?: true;
  tokenIds?: string[];
  approvalType?: ApprovalType;
  isVolatile?: boolean;
  sharedAddress?: string;
  isPendleToken?: boolean;
  isHToken?: boolean;
  hasHToken?: boolean;
  aaveToken?: boolean;
  allowanceStorageOffset?: number;
  balanceStorageOffset?: number;
  isVyper?: boolean;
  isSpam?: boolean;
  is2022Program?: boolean;
}

export enum ApprovalType {
  Classic,
  ERC20Permit,
  DAIPermit,
}

export enum ExternalActionId {
  Transact = "Transact",
  Uniswap = "Uniswap",
  Odos = "Odos",
  OneInch = "OneInch",
  Lifi = "Lifi",
  Okx = "Okx",
  Emporium = "Emporium",
  Wallet = "Wallet",
}

export type FeeStructure = {
  feeToken: string;
  flatFee: string;
  variableRate: string;
};

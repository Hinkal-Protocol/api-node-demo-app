import { buildAuthGet } from "../services/enclave-auth";
import { enclaveFetch } from "../services/enclaveApi";
import { getERC20Token } from "../utils/tokens.utils";
import { Auth } from "./types";
import { ERC20Token } from "../types";

// Enclave returns balances keyed by token address; the token metadata is
// resolved locally from the registry.
type RawTokenBalance = {
  chainId: number;
  tokenAddress: string;
  balance: string;
  timestamp?: string;
};

export type TokenBalance = {
  token: ERC20Token;
  balance: string;
  timestamp?: string;
};

type BalanceResponse =
  | { success: true; balances: RawTokenBalance[] }
  | { error?: string };

export const fetchBalances = async (auth: Auth): Promise<TokenBalance[]> => {
  const { queryString, headers, requestNonce } = buildAuthGet(auth);

  const { res, data } = await enclaveFetch<BalanceResponse>(
    `/balance?${queryString}`,
    requestNonce,
    { headers },
  );

  if (!res.ok || !("success" in data && data.success)) {
    throw new Error(
      (data as { error?: string }).error ?? "Balance fetch failed",
    );
  }

  return data.balances
    .filter((b) => b.balance !== "0")
    .map(
      (b): { token: ERC20Token | undefined; balance: string; timestamp?: string } => ({
        token: getERC20Token(b.tokenAddress, b.chainId),
        balance: b.balance,
        timestamp: b.timestamp,
      }),
    )
    .filter((b): b is TokenBalance => b.token !== undefined);
};

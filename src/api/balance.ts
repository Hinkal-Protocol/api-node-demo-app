import { buildAuthGet } from "../services/enclave-auth";
import { enclaveFetch } from "../services/enclaveApi";
import { Auth } from "./types";
import { ERC20Token } from "../types";

export type TokenBalance = {
  token: ERC20Token;
  balance: string;
  timestamp?: string;
};

type BalanceResponse =
  | { success: true; balances: TokenBalance[] }
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

  return data.balances.filter((b) => b.balance !== "0");
};

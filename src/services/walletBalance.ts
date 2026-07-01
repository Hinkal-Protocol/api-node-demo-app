import { ethers } from "ethers";
import { chainIds } from "../constants";
import { getERC20TokenBySymbol } from "../utils/tokens.utils";

const ERC20_BALANCE_OF_ABI = [
  "function balanceOf(address) view returns (uint256)",
];

const GAS_TOKEN_SYMBOL: Record<number, string> = {
  [chainIds.tempo]: "pathUSD",
};

export interface WalletBalance {
  amount: string;
  symbol?: string;
}

/**
 * Wallet balance for display. On chains that pay gas in an ERC20 the token's
 * balanceOf is read and formatted with its own decimals; all other chains use
 * the native coin.
 */
export const getWalletBalance = async (
  address: string,
  chainId: number,
  provider: ethers.Provider,
): Promise<WalletBalance> => {
  try {
    const gasToken = GAS_TOKEN_SYMBOL[chainId]
      ? getERC20TokenBySymbol(GAS_TOKEN_SYMBOL[chainId], chainId)
      : undefined;

    if (gasToken) {
      const erc20 = new ethers.Contract(
        gasToken.erc20TokenAddress,
        ERC20_BALANCE_OF_ABI,
        provider,
      );
      const raw: bigint = await erc20.balanceOf(address);
      return {
        amount: ethers.formatUnits(raw, gasToken.decimals),
        symbol: gasToken.symbol,
      };
    }

    const raw = await provider.getBalance(address);
    return { amount: ethers.formatEther(raw) };
  } catch {
    return { amount: "unknown" };
  }
};

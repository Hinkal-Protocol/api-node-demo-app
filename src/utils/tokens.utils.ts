import { getERC20Registry } from "../constants/token-data";
import { ERC20Token } from "../types";

export const zeroAddress = `0x${"00".repeat(20)}`;

export const isNativeTokenAddress = (address: string): boolean =>
  address === zeroAddress;

export const getERC20Token = (
  address: string,
  chainId: number,
  fromList?: ERC20Token[],
) => {
  return (fromList ?? getERC20Registry(chainId))?.find((el) => {
    if (address === undefined) {
      return false;
    }
    return el.erc20TokenAddress.toLowerCase() === address.toLowerCase();
  });
};

export const getERC20TokenBySymbol = (symbol: string, chainId: number) => {
  return getERC20Registry(chainId)?.find((el) => {
    if (symbol === undefined) {
      return false;
    }
    return el.symbol.toLowerCase() === symbol.toLowerCase();
  });
};

import arbMainnetRegistry from "./arbMainnetRegistry.json";
import ethMainnetRegistry from "./ethMainnetRegistry.json";
import optimismRegistry from "./optimismRegistry.json";
import baseRegistry from "./baseRegistry.json";
import polygonRegistry from "./polygonRegistry.json";
import arcTestnetRegistry from "./arcTestnetRegistry.json";
import { ERC20Token } from "../../types";
import { chainIds } from "../chains.constants";

export const getERC20Token = (address: string, chainId: number): ERC20Token | undefined =>
  getERC20Registry(chainId).find(
    (t) => t.erc20TokenAddress.toLowerCase() === address.toLowerCase(),
  );

export const getERC20Registry = (chainId: number): ERC20Token[] => {
  switch (chainId) {
    case chainIds.polygon:
      return polygonRegistry.networkRegistry as ERC20Token[];

    case chainIds.arbMainnet:
      return arbMainnetRegistry.networkRegistry as ERC20Token[];

    case chainIds.ethMainnet:
      return ethMainnetRegistry.networkRegistry as ERC20Token[];

    case chainIds.optimism:
      return optimismRegistry.networkRegistry as ERC20Token[];

    case chainIds.base:
      return baseRegistry.networkRegistry as ERC20Token[];

    case chainIds.arcTestnet:
      return arcTestnetRegistry.networkRegistry as ERC20Token[];

    default:
      return [];
  }
};

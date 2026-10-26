import { Network } from "../types";
import { chainIds } from ".";

export const networkRegistry: Record<number, Network> = {
  [chainIds.ethMainnet]: {
    name: "Ethereum",
    chainId: chainIds.ethMainnet,
    fetchRpcUrl: "https://ethereum-rpc.publicnode.com",
  },
  [chainIds.sepolia]: {
    name: "Sepolia",
    chainId: chainIds.sepolia,
    fetchRpcUrl: "https://ethereum-sepolia-rpc.publicnode.com",
  },
  [chainIds.arbMainnet]: {
    name: "Arbitrum",
    chainId: chainIds.arbMainnet,
    fetchRpcUrl: "https://arb1.arbitrum.io/rpc",
  },
  [chainIds.optimism]: {
    name: "Optimism",
    chainId: chainIds.optimism,
    fetchRpcUrl: "https://mainnet.optimism.io",
  },
  [chainIds.polygon]: {
    name: "Polygon",
    chainId: chainIds.polygon,
    fetchRpcUrl: "https://polygon-bor-rpc.publicnode.com",
  },
  [chainIds.base]: {
    name: "Base",
    chainId: chainIds.base,
    fetchRpcUrl: "https://mainnet.base.org",
  },
  [chainIds.tempo]: {
    name: "Tempo",
    chainId: chainIds.tempo,
    fetchRpcUrl: "https://rpc.tempo.xyz",
  },
  [chainIds.arcTestnet]: {
    name: "Arc Testnet",
    chainId: chainIds.arcTestnet,
    fetchRpcUrl: "https://rpc.testnet.arc.io",
  },
  [chainIds.solanaMainnet]: {
    name: "Solana",
    chainId: chainIds.solanaMainnet,
    fetchRpcUrl: "https://api.mainnet-beta.solana.com",
  },
  [chainIds.tronNile]: {
    name: "Tron Nile",
    chainId: chainIds.tronNile,
    fetchRpcUrl: "https://nile.trongrid.io/jsonrpc",
  },
  [chainIds.tronMainnet]: {
    name: "Tron",
    chainId: chainIds.tronMainnet,
    fetchRpcUrl: "https://api.trongrid.io/jsonrpc",
  },
};

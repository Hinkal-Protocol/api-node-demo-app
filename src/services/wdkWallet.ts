import { ethers } from "ethers";

const ACCOUNT_INDEX = 0;

export const buildWdkSigner = async (
  seedPhrase: string,
  provider: ethers.Provider,
): Promise<ethers.HDNodeWallet> => {
  const seed = seedPhrase.trim();
  if (!seed) throw new Error("Seed phrase is required");

  const { default: WalletManagerEvm } = await import("@tetherto/wdk-wallet-evm");

  const wallet = new WalletManagerEvm(seed);
  const account = await wallet.getAccount(ACCOUNT_INDEX);

  return (
    account as unknown as { _account: ethers.HDNodeWallet }
  )._account.connect(provider);
};

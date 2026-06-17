import { ethers } from "ethers";
import WalletManagerEvm from "@tetherto/wdk-wallet-evm";

const ACCOUNT_INDEX = 0;

export const buildWdkSigner = async (
  seedPhrase: string,
  provider: ethers.Provider,
): Promise<ethers.HDNodeWallet> => {
  const seed = seedPhrase.trim();
  if (!seed) throw new Error("Seed phrase is required");


  const wallet = new WalletManagerEvm(seed);
  const account = (await wallet.getAccount(ACCOUNT_INDEX));

  return (
    account as unknown as { _account: ethers.HDNodeWallet }
  )._account.connect(provider);
};

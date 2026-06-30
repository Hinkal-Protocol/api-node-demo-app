import { ethers } from "ethers";
import {
  connectUtila,
  sendUtilaTransaction,
  signUtilaMessage,
  type UtilaCreds,
  type UtilaWallet,
} from "./utilaApi";

export type { UtilaCreds, UtilaWallet };
export { connectUtila };

export class UtilaSigner extends ethers.AbstractSigner {
  private readonly creds: UtilaCreds;
  private readonly wallet: UtilaWallet;

  constructor(
    creds: UtilaCreds,
    wallet: UtilaWallet,
    provider: ethers.Provider | null = null,
  ) {
    super(provider);
    this.creds = creds;
    this.wallet = wallet;
  }

  /** Sync address, matching the React signer's wallet field usage. */
  get address(): string {
    return this.wallet.address;
  }

  getAddress() {
    return Promise.resolve(this.wallet.address);
  }

  connect(provider: ethers.Provider | null) {
    return new UtilaSigner(this.creds, this.wallet, provider);
  }

  async signMessage(message: string | Uint8Array) {
    const msg = typeof message === "string" ? message : ethers.hexlify(message);
    const { signature } = await signUtilaMessage(this.creds, {
      wallet: this.wallet.name,
      message: msg,
    });
    return signature;
  }

  async signTypedData(
    domain: ethers.TypedDataDomain,
    types: Record<string, ethers.TypedDataField[]>,
    value: Record<string, any>,
  ) {
    const typedData = ethers.TypedDataEncoder.getPayload(domain, types, value);
    const { signature } = await signUtilaMessage(this.creds, {
      wallet: this.wallet.name,
      typedData: JSON.stringify(typedData),
    });
    return signature;
  }

  signTransaction(): Promise<string> {
    throw new Error("UtilaSigner signs and broadcasts via sendTransaction");
  }

  async sendTransaction(tx: ethers.TransactionRequest) {
    const provider = this.provider;
    if (!provider) throw new Error("UtilaSigner requires a provider");
    const { chainId } = await provider.getNetwork();
    const to = tx.to ? await ethers.resolveAddress(tx.to, provider) : undefined;
    const { hash } = await sendUtilaTransaction(this.creds, {
      wallet: this.wallet.name,
      to,
      data: (tx.data as string) ?? "0x",
      value: tx.value ? ethers.toBeHex(tx.value) : "0x0",
      chainId: Number(chainId),
    });
    const receipt = await provider.waitForTransaction(hash);
    return provider.getTransaction(
      receipt!.hash,
    ) as Promise<ethers.TransactionResponse>;
  }
}

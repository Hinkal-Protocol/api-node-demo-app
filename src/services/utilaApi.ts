import jwt from "jsonwebtoken";

const BASE = "https://api.utila.io/v2";

export interface UtilaCreds {
  email: string;
  privateKey: string;
}

export interface UtilaWallet {
  name: string;
  displayName: string;
  address: string;
}

const vault = (w: string) => w.split("/").slice(0, 2).join("/");
const toHex = (s: string) => `0x${Buffer.from(s, "utf8").toString("hex")}`;

const api = async (
  creds: UtilaCreds,
  method: string,
  path: string,
  payload?: unknown,
): Promise<any> => {
  const token = jwt.sign(
    {
      sub: creds.email,
      aud: "https://api.utila.io/",
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
    String(creds.privateKey ?? "").replace(/\\n/g, "\n"),
    { algorithm: "RS256" },
  );
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || `Utila ${res.status}`);
  return data;
};

const initiate = (creds: UtilaCreds, wallet: string, details: unknown) =>
  api(creds, "POST", `/${vault(wallet)}/transactions:initiate`, {
    details,
    priority: "NORMAL",
  });

const poll = (
  creds: UtilaCreds,
  name: string,
  states: string[],
): Promise<any> =>
  new Promise((resolve, reject) => {
    const deadline = Date.now() + 180_000;
    const id = setInterval(async () => {
      try {
        const { transaction } = await api(creds, "GET", `/${name}`);
        if (
          /FAILED|DECLINED|CANCELED|DROPPED|EXPIRED/.test(transaction.state)
        ) {
          clearInterval(id);
          reject(new Error(`Utila tx ${transaction.state}`));
        } else if (
          states.includes(transaction.state) ||
          Date.now() >= deadline
        ) {
          clearInterval(id);
          resolve(transaction);
        }
      } catch (e) {
        clearInterval(id);
        reject(e);
      }
    }, 2000);
  });

// list all EVM wallets (with 0x address) across every vault
export const connectUtila = async (
  creds: UtilaCreds,
): Promise<{ vaults: unknown[]; wallets: UtilaWallet[] }> => {
  const { vaults = [] } = await api(creds, "GET", "/vaults?pageSize=100");
  const perVault = await Promise.all(
    vaults.map((v: any) =>
      api(creds, "GET", `/${v.name}/wallets?pageSize=100`),
    ),
  );
  const wallets = await Promise.all(
    perVault
      .flatMap((p: any) => p.wallets ?? [])
      .map(async (w: any) => {
        const { walletAddresses = [] } = await api(
          creds,
          "GET",
          `/${w.name}/addresses?pageSize=1000`,
        );
        const evm = walletAddresses.find((a: any) =>
          a.address?.startsWith("0x"),
        );
        return (
          evm && {
            name: w.name,
            displayName: w.displayName || w.name,
            address: evm.address,
          }
        );
      }),
  );
  return { vaults, wallets: wallets.filter(Boolean) as UtilaWallet[] };
};

// resolve Utila network name from chainId, initiate MPC tx, poll until broadcast, return hash
export const sendUtilaTransaction = async (
  creds: UtilaCreds,
  params: {
    wallet: string;
    to?: string;
    data?: string;
    value?: string;
    chainId: number;
  },
): Promise<{ hash: string }> => {
  const { wallet, to, data = "0x", value = "0x0", chainId } = params;
  const { networks = [] } = await api(creds, "GET", "/networks?pageSize=1000");
  const net = networks.find(
    (n: any) => n.caipDetails?.chainId === `eip155:${chainId}`,
  );
  if (!net) throw new Error(`Unsupported chainId ${chainId}`);
  const { transaction } = await initiate(creds, wallet, {
    evmTransaction: {
      network: net.name,
      fromAddress: wallet,
      toAddress: to,
      value,
      data,
      publish: true,
    },
  });
  const tx = await poll(creds, transaction.name, [
    "PUBLISHED",
    "MINED",
    "CONFIRMED",
  ]);
  if (!tx.hash) throw new Error("Tx not broadcast in time");
  return { hash: tx.hash };
};

// sign a message or EIP-712 typed-data; Utila models signing as a transaction
export const signUtilaMessage = async (
  creds: UtilaCreds,
  params: { wallet: string; message?: string; typedData?: string },
): Promise<{ signature: string }> => {
  const { wallet, message, typedData } = params;
  const details = typedData
    ? { evmSignTypedDataV4: { fromAddress: wallet, message: typedData } }
    : {
        evmPersonalSign: {
          fromAddress: wallet,
          messageHex: message!.startsWith("0x") ? message : toHex(message!),
        },
      };
  const { transaction } = await initiate(creds, wallet, details);
  const tx = await poll(creds, transaction.name, [
    "SIGNED",
    "PUBLISHED",
    "MINED",
    "CONFIRMED",
  ]);
  if (!tx.evmMessage?.signature) throw new Error("Signature not ready in time");
  return {
    signature: `0x${Buffer.from(tx.evmMessage.signature, "base64").toString("hex")}`,
  };
};

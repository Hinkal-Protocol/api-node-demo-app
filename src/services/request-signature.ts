import { createHash, randomBytes, randomUUID } from "crypto";
import { ethers } from "ethers";

export type Session = {
  sessionId: string;
  privateKey: Uint8Array;
};

const sha256 = (payload: string): Uint8Array =>
  new Uint8Array(createHash("sha256").update(payload, "utf8").digest());

const signPayload = (privateKey: Uint8Array, payload: string): string => {
  const hash = sha256(payload);
  const signingKey = new ethers.SigningKey(privateKey);
  const sig = signingKey.sign(hash);
  // compact r||s: strip 0x from each, 64 bytes total
  return sig.r.slice(2) + sig.s.slice(2);
};

export const generateClientKeyPair = (): {
  privateKey: Uint8Array;
  clientPublicKey: string;
} => {
  const privateKey = new Uint8Array(randomBytes(32));
  const signingKey = new ethers.SigningKey(privateKey);
  // compressedPublicKey is "0x02..." or "0x03...", strip 0x
  return { privateKey, clientPublicKey: signingKey.compressedPublicKey.slice(2) };
};

export const sessionQueryParams = (
  session: Session,
  chainId: number,
): Record<string, string> => ({
  sessionId: session.sessionId,
  nonce: randomUUID(),
  chainId: String(chainId),
  timestamp: Date.now().toString(),
});

export const sessionBodyParams = (
  session: Session,
  chainId: number,
): {
  sessionId: string;
  nonce: string;
  chainId: number;
  timestamp: number;
} => ({
  sessionId: session.sessionId,
  nonce: randomUUID(),
  chainId,
  timestamp: Date.now(),
});

export const requestSignatureGetHeader = (
  session: Session,
  queryString: string,
): Record<string, string> => ({
  "x-hinkal-request-signature": signPayload(session.privateKey, queryString),
});

export const requestSignaturePostHeader = (
  session: Session,
  body: Record<string, unknown>,
): Record<string, string> => ({
  "x-hinkal-request-signature": signPayload(
    session.privateKey,
    JSON.stringify(body),
  ),
});

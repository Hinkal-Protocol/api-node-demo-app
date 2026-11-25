import { randomUUID } from "crypto";
import { ethers } from "ethers";
import {
  buildEnclaveSignMessage,
  resolveSessionAuthMode,
} from "./enclave-auth";
import { enclaveFetch } from "./enclaveApi";
import { EnclaveApiRoute } from "../constants/server.constants";
import { generateClientKeyPair, signPayload } from "./request-signature";
import type { EnclaveSession } from "../api/types";
import type { HinkalSigner } from "./signer.types";

type CreateSessionResponse =
  | { success: true; expiresAt: string }
  | { success: false; error?: string };

const postCreateSession = async (
  privateKey: Uint8Array,
  body: Record<string, unknown>,
): Promise<EnclaveSession> => {
  const sigHeader = {
    "x-hinkal-request-signature": signPayload(privateKey, JSON.stringify(body)),
  };
  const requestNonce = body.nonce as string;

  const { res, data } = await enclaveFetch<CreateSessionResponse>(
    EnclaveApiRoute.CreateSession,
    requestNonce,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...sigHeader },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok || !data.success) {
    throw new Error(
      ("error" in data && data.error) || "Session was not created",
    );
  }

  return {
    sessionId: body.sessionId as string,
    authMode: resolveSessionAuthMode(
      (body.useEIP712 as boolean | undefined) ?? false,
    ),
    expiresAt: data.expiresAt,
    privateKey,
  };
};

export const createEnclaveSession = async (
  signer: HinkalSigner,
  useEIP712: boolean,
): Promise<EnclaveSession> => {
  const { privateKey, clientPublicKey } = generateClientKeyPair();
  const sessionId = randomUUID();
  const authMode = resolveSessionAuthMode(useEIP712);
  const signature = await signer.signMessage(
    buildEnclaveSignMessage(sessionId, clientPublicKey, authMode),
  );
  const body = {
    signature,
    address: signer.address,
    sessionId,
    clientPublicKey,
    nonce: randomUUID(),
    useEIP712,
  };
  return postCreateSession(privateKey, body);
};

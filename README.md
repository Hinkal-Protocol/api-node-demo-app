# Hinkal Enclave API Node Demo

Batch-processes Hinkal transactions via the Hinkal Enclave API (HTTP) — not the SDK.

## Setup

Install dependencies:

```
yarn install
```

Create your environment file and add an Alchemy API key (required — RPC URLs are built from it):

```
cp .env.example .env
# then set ALCHEMY_API_KEY in .env
```

Create your transactions file from the template, then fill in the signer, addresses, and amounts:

```
cp transactions.example.json transactions.json
```

## Authentication

Each transaction needs a signer. Provide **one** of:

- `privateKey` — raw EVM private key (e.g. `0xabc...`)
- `seedPhrase` — WDK seed phrase; signer derived via `@tetherto/wdk-wallet-evm` (account index 0)
- `utila` — Utila MPC custodial wallet; signing and broadcasting go through the Utila API (the key never leaves Utila's vault). Object with:
  - `email` — Utila service-account email (RS256 JWT subject)
  - `privateKey` — Utila service-account private key in PEM form (use `\n` for newlines)
  - `wallet` — Utila wallet resource path, e.g. `vaults/<id>/wallets/<id>`

## Run

```
yarn start
```

## Supported transaction types

- `deposit` — approve + deposit a token into the Hinkal shielded balance
- `withdraw` — withdraw from the shielded balance to a public recipient (optional `isRelayerOff`)
- `transfer` — shielded transfer to another Hinkal stealth address
- `swap` — swap tokens within the shielded balance
- `private-send` — multi-recipient send (deposit + withdraw in one order)
- `get-private-balance` — read-only; logs the caller's shielded balances (no on-chain tx)

Use the zero address (`0x0000000000000000000000000000000000000000`) as the token to operate on the chain's native coin (e.g. ETH).

## Environment

| Variable          | Required | Description                                         |
| ----------------- | -------- | --------------------------------------------------- |
| `ALCHEMY_API_KEY` | yes      | Alchemy key used to build RPC URLs for every chain. |

## Config

Configure the enclave API base URL in [src/constants/server.constants.ts](src/constants/server.constants.ts).

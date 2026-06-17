# Hinkal Enclave API Node Demo

Batch-processes Hinkal transactions via the Hinkal Enclave API (HTTP) — not the SDK.

## Setup

```
yarn install
```

Copy `transactions.example.json` to `transactions.json` and fill in `privateKey` or `seedPhrase`, addresses, amounts.

## Run

```
yarn start
```

## Supported transaction types

- `deposit` — approve + deposit ERC20 to Hinkal shielded balance
- `withdraw` — withdraw from shielded balance to public recipient (optional `isRelayerOff`)
- `transfer` — shielded transfer to another Hinkal stealth address
- `swap` — swap tokens within Hinkal shielded balance
- `private-send` — deposit + withdraw in one order

## Config

Configure API base URL in [src/constants/server.constants.ts](src/constants/server.constants.ts).

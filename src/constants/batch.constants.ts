/**
 * If a transaction fails because that balance has not synced yet,
 * the batch waits and retries rather than failing the whole run.
 */
export const BALANCE_SYNC_ERROR = "issue with syncing your balance";
export const MAX_TX_RETRIES = 3;
export const RETRY_DELAY_MS = 5000;

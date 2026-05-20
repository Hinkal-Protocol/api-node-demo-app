import { ethers } from "ethers";
import { ERC20Token } from "../types";

export const getAmountInToken = (token: ERC20Token, amount: bigint): string =>
  ethers.formatUnits(amount, token.decimals);

export const getAmountInWei = (token: ERC20Token, amount: string): bigint => {
  const decimalsToRemove = 10 ** (18 - token.decimals);
  try {
    return ethers.parseUnits(amount) / BigInt(decimalsToRemove);
  } catch (err) {
    throw new Error("Invalid amount");
  }
};

export const isWeiAmountString = (amount: string): boolean => {
  try {
    BigInt(amount);
    return true;
  } catch {
    return false;
  }
};

export const isValidPositiveAmount = (amount: string): boolean => {
  if (isWeiAmountString(amount)) {
    return BigInt(amount) > 0n;
  }
  const parsed = parseFloat(amount);
  return !isNaN(parsed) && parsed > 0;
};

/** Accepts either a wei integer string or a human-readable decimal (like swap amountIn). */
export const resolveAmountToWeiString = (
  amount: string,
  token: ERC20Token,
): string => {
  if (isWeiAmountString(amount)) {
    return amount;
  }
  return getAmountInWei(token, amount).toString();
};

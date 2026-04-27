import { randomInt } from "crypto";

export const MAX_TRADING_GROUP_MEMBERS = 20;

const GROUP_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const GROUP_CODE_LENGTH = 6;

export function generateTradingGroupCode(): string {
  let code = "";

  for (let i = 0; i < GROUP_CODE_LENGTH; i += 1) {
    code += GROUP_CODE_ALPHABET[randomInt(GROUP_CODE_ALPHABET.length)];
  }

  return code;
}

export function normalizeTradingGroupCode(value: string): string {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}

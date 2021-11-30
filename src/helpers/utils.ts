import { BigDecimal, BigInt, ethereum } from "@graphprotocol/graph-ts";

export function isSafeTransferFrom(transaction: ethereum.Transaction): bool {
  return !transaction.input.toHexString().startsWith("0xde250604");
}

export function removeAtIndex<T>(array: T[], index: i32): T[] {
  return array.slice(0, index).concat(array.slice(index + 1));
}

export function toBigDecimal(value: number): BigDecimal {
  return BigDecimal.fromString(value.toString())
}

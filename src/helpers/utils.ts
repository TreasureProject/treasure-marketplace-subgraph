import { Address, BigDecimal, ethereum } from "@graphprotocol/graph-ts";

export function isMint(address: Address): bool {
  return address.equals(Address.zero());
}

export function isSafeTransferFrom(transaction: ethereum.Transaction): bool {
  return !transaction.input.toHexString().startsWith("0xde250604");
}

export function removeAtIndex<T>(array: T[], index: i32): T[] {
  return index == -1
    ? array
    : array.slice(0, index).concat(array.slice(index + 1));
}

export function removeFromArray<T>(array: T[], item: T): T[] {
  return removeAtIndex(array, array.indexOf(item));
}

export function shouldUpdateMetadata(
  incoming: ethereum.CallResult<string>,
  current: string | null
): boolean {
  return !incoming.reverted && current != incoming.value;
}

export function toBigDecimal(value: number): BigDecimal {
  return BigDecimal.fromString(value.toString());
}

import { Address, BigInt } from "@graphprotocol/graph-ts";

export function getAttributeId(
  token: Address,
  name: string,
  value: string
): string {
  return [token.toHexString(), name.toLowerCase(), value.toLowerCase()].join(
    "-"
  );
}

export function getListingId(
  seller: Address,
  tokenAddress: Address,
  tokenId: BigInt
): string {
  return [
    seller.toHexString(),
    tokenAddress.toHexString(),
    tokenId.toHexString(),
  ].join("-");
}

export function getTokenId(tokenAddress: Address, tokenId: BigInt): string {
  return [tokenAddress.toHexString(), tokenId.toHexString()].join("-");
}

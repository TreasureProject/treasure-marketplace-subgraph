import { Address, BigInt, TypedMap, dataSource } from "@graphprotocol/graph-ts";

export const ONE_BI = BigInt.fromI32(1);
export const ZERO_ADDRESS = Address.zero().toHexString();
export const ZERO_BI = BigInt.zero();

export const STAKING_ADDRESS =
  dataSource.network() == "rinkeby"
    ? "0x0be9c4956101a306bac8093329c6c696c047b8f6"
    : "0xd300322832765fee6b910d314f2c2d879427226f";

export const EXPLORER =
  dataSource.network() == "rinkeby" ? "rinkeby.etherscan.io" : "arbiscan.io";

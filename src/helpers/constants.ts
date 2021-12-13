import { Address, BigInt, TypedMap, dataSource } from "@graphprotocol/graph-ts";

export const ONE_BI = BigInt.fromI32(1);
export const ZERO_ADDRESS = Address.zero().toHexString();
export const ZERO_BI = BigInt.zero();

export const EXPLORER =
  dataSource.network() == "rinkeby" ? "rinkeby.etherscan.io" : "arbiscan.io";

export const IPFS_GATEWAY = "https://treasure-marketplace.mypinata.cloud/ipfs/";

export const RARITY_CALCULATION_BLOCK = BigInt.fromI32(
  dataSource.network() == "rinkeby" ? 9712250 : 3688250
);

// Reminder: These need to be lowercase or they don't work!!
export const SMOLBODIES_ADDRESS =
  dataSource.network() == "rinkeby"
    ? "0x9e638bfe78b372b8f5cc63cf6b01b90f568496cb"
    : "0x17dacad7975960833f374622fad08b90ed67d1b5";

export const SMOLBRAIN_ADDRESS =
  dataSource.network() == "rinkeby"
    ? "0x4feea06250d9f315a6a454c9c8a7fcbcf8701210"
    : "0x6325439389e0797ab35752b4f43a14c004f22a9c";

export const STAKING_ADDRESS =
  dataSource.network() == "rinkeby"
    ? "0x0be9c4956101a306bac8093329c6c696c047b8f6"
    : "0xd300322832765fee6b910d314f2c2d879427226f";

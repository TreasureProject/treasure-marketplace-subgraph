import * as ERC721 from "./721";
import { Transfer } from "../../generated/TreasureMarketplace/ERC721";
import {
  getCreator,
  getOrCreateCollection,
  getOrCreateUserToken,
  ONE_BI,
  SMOLBRAIN_ADDRESS,
} from "../helpers";
import {
  DropSchool,
  JoinSchool,
} from "../../generated/Smol Brains School/ERC721";
import { log, store } from "@graphprotocol/graph-ts";

export function handleTransfer(event: Transfer): void {
  let collection = getOrCreateCollection(event.address.toHexString());

  collection.creator = getCreator("SmolBrain").id;
  collection.name = "Smol Brains";
  collection.save();

  ERC721.handleTransfer(event);
}

export function handleDropSchool(event: DropSchool): void {
  let collection = getOrCreateCollection(SMOLBRAIN_ADDRESS);
  let tokenIds = collection.tokenIds;

  for (let index = 0; index < tokenIds.length; index++) {
    const tokenId = tokenIds[index];
    const token = `${SMOLBRAIN_ADDRESS}-${event.params.tokenId.toHexString()}`;

    if (tokenId.endsWith(token)) {
      let userToken = getOrCreateUserToken(tokenId);
      let user = tokenId.split("-")[0];

      userToken.quantity = ONE_BI;
      userToken.token = token;
      userToken.user = user;

      userToken.save();
    }
  }
}

export function handleJoinSchool(event: JoinSchool): void {
  let collection = getOrCreateCollection(SMOLBRAIN_ADDRESS);
  let tokenIds = collection.tokenIds;

  log.info("handleJoinSchool: {}, match: {}", [
    tokenIds.length.toString(),
    `${SMOLBRAIN_ADDRESS}-${event.params.tokenId.toHexString()}`,
  ]);

  for (let index = 0; index < tokenIds.length; index++) {
    const tokenId = tokenIds[index];

    log.info("handleJoinSchool: {}", [tokenId]);

    if (
      tokenId.endsWith(
        `${SMOLBRAIN_ADDRESS}-${event.params.tokenId.toHexString()}`
      )
    ) {
      store.remove("UserToken", tokenId);
    }
  }
}

import * as ERC721 from "./721";
import { Transfer } from "../../generated/TreasureMarketplace/ERC721";
import {
  getCreator,
  getOrCreateCollection,
  getOrCreateUserToken,
  ONE_BI,
  SMOLBRAIN_ADDRESS,
  updateCollectionFloorAndTotal,
  ZERO_BI,
} from "../helpers";
import {
  DropSchool,
  JoinSchool,
} from "../../generated/Smol Brains School/ERC721";
import { Address, log, store } from "@graphprotocol/graph-ts";
import { Listing } from "../../generated/schema";

export function handleTransfer(event: Transfer): void {
  let collection = getOrCreateCollection(event.address.toHexString());

  collection.creator = getCreator("SmolBrain").id;
  collection.name = "Smol Brains";
  collection.save();

  ERC721.handleTransfer(event);
}

export function handleDropSchool(event: DropSchool): void {
  let collection = getOrCreateCollection(SMOLBRAIN_ADDRESS);
  let userTokenIds = collection.tokenIds;
  let listingIds = collection.listingIds;
  let tokenId = event.params.tokenId.toHexString();

  for (let index = 0; index < userTokenIds.length; index++) {
    let userTokenId = userTokenIds[index];
    let token = `${SMOLBRAIN_ADDRESS}-${tokenId}`;

    if (userTokenId.endsWith(token)) {
      let userToken = getOrCreateUserToken(userTokenId);
      let user = userTokenId.split("-")[0];

      userToken.quantity = ONE_BI;
      userToken.token = token;
      userToken.user = user;

      userToken.save();
    }
  }

  for (let index = 0; index < listingIds.length; index++) {
    let listingId = listingIds[index];

    if (listingId.endsWith(`${SMOLBRAIN_ADDRESS}-${tokenId}`)) {
      let listing = Listing.load(listingId);

      if (listing) {
        listing.status = 'Active';
        listing.save();

        updateCollectionFloorAndTotal(Address.fromString(SMOLBRAIN_ADDRESS))
      }
    }
  }
}

export function handleJoinSchool(event: JoinSchool): void {
  let collection = getOrCreateCollection(SMOLBRAIN_ADDRESS);
  let userTokenIds = collection.tokenIds;
  let listingIds = collection.listingIds;
  let tokenId = event.params.tokenId.toHexString();

  for (let index = 0; index < userTokenIds.length; index++) {
    const useTokenId = userTokenIds[index];

    if (tokenId.endsWith(`${SMOLBRAIN_ADDRESS}-${tokenId}`)) {
      store.remove("UserToken", useTokenId);
    }
  }

  for (let index = 0; index < listingIds.length; index++) {
    const listingId = listingIds[index];

    if (listingId.endsWith(`${SMOLBRAIN_ADDRESS}-${tokenId}`)) {
      let listing = Listing.load(listingId);

      if (listing) {
        listing.status = 'Hidden';
        listing.save();

        updateCollectionFloorAndTotal(Address.fromString(SMOLBRAIN_ADDRESS))
      }
    }
  }
}

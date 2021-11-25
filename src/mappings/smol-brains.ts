import * as ERC721 from "./721";
import { Transfer } from "../../generated/TreasureMarketplace/ERC721";
import {
  ONE_BI,
  SMOLBRAIN_ADDRESS,
  getCreator,
  getListingId,
  getOrCreateCollection,
  getOrCreateUser,
  getOrCreateUserToken,
  updateCollectionFloorAndTotal,
} from "../helpers";
import {
  DropSchool,
  JoinSchool,
} from "../../generated/Smol Brains School/ERC721";
import { Address, store } from "@graphprotocol/graph-ts";
import { Listing, Student } from "../../generated/schema";

export function handleTransfer(event: Transfer): void {
  let collection = getOrCreateCollection(event.address.toHexString());

  collection.creator = getCreator("SmolBrain").id;
  collection.name = "Smol Brains";
  collection.save();

  ERC721.handleTransfer(event);
}

export function handleDropSchool(event: DropSchool): void {
  let from = event.transaction.from;
  let user = getOrCreateUser(from.toHexString());
  let smolbrains = Address.fromString(SMOLBRAIN_ADDRESS);
  let tokenId = event.params.tokenId;
  let id = getListingId(from, smolbrains, tokenId);
  let listing = Listing.load(id);

  store.remove("Student", id);

  if (listing) {
    listing.status = "Active";
    listing.save();

    let collection = getOrCreateCollection(SMOLBRAIN_ADDRESS);

    collection.listingIds = collection.listingIds.concat([listing.id]);
    collection.save();

    updateCollectionFloorAndTotal(smolbrains);
  } else {
    let userToken = getOrCreateUserToken(id);

    userToken.quantity = ONE_BI;
    userToken.token = `${SMOLBRAIN_ADDRESS}-${tokenId.toHexString()}`;
    userToken.user = user.id;

    userToken.save();
  }
}

export function handleJoinSchool(event: JoinSchool): void {
  let from = event.transaction.from;
  let smolbrains = Address.fromString(SMOLBRAIN_ADDRESS);
  let tokenId = event.params.tokenId;
  let id = getListingId(from, smolbrains, tokenId);
  let listing = Listing.load(id);

  new Student(id).save();

  if (listing) {
    listing.status = "Hidden";
    listing.save();

    updateCollectionFloorAndTotal(smolbrains);
  } else {
    store.remove("UserToken", id);
  }
}

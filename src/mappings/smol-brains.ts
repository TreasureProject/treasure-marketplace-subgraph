import * as ERC721 from "./721";
import { Transfer } from "../../generated/TreasureMarketplace/ERC721";
import {
  ONE_BI,
  SMOLBRAIN_ADDRESS,
  getCreator,
  getListingId,
  getTokenId,
  getOrCreateCollection,
  getOrCreateToken,
  getOrCreateUser,
  getOrCreateUserToken,
  updateCollectionFloorAndTotal,
  isMint,
  getOrCreateAttribute,
  getAttributeId,
  toBigDecimal,
} from "../helpers";
import {
  DropSchool,
  JoinSchool,
} from "../../generated/Smol Brains School/School";
import { Address, store } from "@graphprotocol/graph-ts";
import {
  Listing,
  MetadataAttribute,
  Student,
} from "../../generated/schema";

export function handleTransfer(event: Transfer): void {
  let collection = getOrCreateCollection(event.address.toHexString());

  collection.creator = getCreator("SmolBrain").id;
  collection.name = "Smol Brains";
  collection.save();

  ERC721.handleTransfer(event);

  // Lets setup our initial IQ
  let params = event.params;
  let tokenId = params.tokenId;
  let address = event.address;

  if (isMint(params.from)) {
    let token = getOrCreateToken(getTokenId(address, tokenId));
    let attribute = getOrCreateAttribute(
      getAttributeId(address, "IQ", tokenId.toHexString())
    );

    attribute.name = "IQ";
    attribute.percentage = toBigDecimal(0);
    attribute.value = "0";

    attribute._tokenIds = [];
    attribute.collection = collection.id;

    let relationshipId = [token.id, attribute.id].join("-");

    if (!MetadataAttribute.load(relationshipId)) {
      let relationship = new MetadataAttribute(relationshipId);

      relationship.attribute = attribute.id;
      relationship.metadata = token.id;
      relationship.save();
    }

    attribute.save();
    token.save();
  }
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

    updateCollectionFloorAndTotal(collection);
  } else {
    let userToken = getOrCreateUserToken(id);

    userToken.quantity = ONE_BI;
    userToken.token = `${SMOLBRAIN_ADDRESS}-${tokenId.toHexString()}`;
    userToken.user = user.id;

    userToken.save();
  }

  ERC721.updateMetadata(smolbrains, tokenId);
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

    updateCollectionFloorAndTotal(getOrCreateCollection(SMOLBRAIN_ADDRESS));
  } else {
    store.remove("UserToken", id);
  }
}

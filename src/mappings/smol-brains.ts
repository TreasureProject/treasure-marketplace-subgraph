import * as ERC721 from "./721";
import { Transfer } from "../../generated/TreasureMarketplace/ERC721";
import {
  ONE_BI,
  SMOLBRAIN_ADDRESS,
  ZERO_BI,
  createMetadataAttribute,
  getAttributeId,
  getCreator,
  getListingId,
  getOrCreateAttribute,
  getOrCreateCollection,
  getOrCreateToken,
  getOrCreateUser,
  getOrCreateUserToken,
  getTokenId,
  isMint,
  updateCollectionFloorAndTotal,
} from "../helpers";
import { Address, BigInt, log, store } from "@graphprotocol/graph-ts";
import {
  DropSchool,
  JoinSchool,
} from "../../generated/Smol Brains School/School";
import { Listing, MetadataAttribute, Student } from "../../generated/schema";
import { SmolBrains } from "../../generated/Smol Brains School/SmolBrains";

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
    attribute.value = ZERO_BI.toString();

    attribute._tokenIds = [];

    createMetadataAttribute(attribute.id, token.id);

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

    collection._listingIds = collection._listingIds.concat([listing.id]);
    collection.save();

    updateCollectionFloorAndTotal(collection);
  } else {
    let userToken = getOrCreateUserToken(id);

    userToken.quantity = ONE_BI;
    userToken.token = `${SMOLBRAIN_ADDRESS}-${tokenId.toHexString()}`;
    userToken.user = user.id;

    userToken.save();
  }

  let contract = SmolBrains.bind(smolbrains);

  // Snapshot IQ
  let iq = contract.try_brainz(tokenId);

  if (iq.reverted) {
    log.info("iqReverted token: {}", [tokenId.toString()]);

    return;
  }

  let iqAttribute = getOrCreateAttribute(
    getAttributeId(smolbrains, "IQ", tokenId.toHexString())
  );

  iqAttribute.value = iq.value.toString();
  iqAttribute.save();

  let calculated = BigInt.fromString(iqAttribute.value)
    .div(BigInt.fromI32(50))
    .toString();

  let level =
    calculated.length <= 18 ? "0" : calculated.slice(0, calculated.length - 18);

  if (BigInt.fromString(level).gt(BigInt.fromI32(5))) {
    level = "5";
  }

  // Did our smol grow?
  let token = getOrCreateToken(getTokenId(smolbrains, tokenId));
  let metadataUri = token.metadataUri;

  log.info("dropSchool metadataUri: {}, level: {}", [
    metadataUri ? metadataUri.toString() : "null",
    level,
  ]);

  if (metadataUri === null) {
    return;
  }

  let current = metadataUri.slice(-1);

  log.info("dropSchool current: {}, level: {}", [current, level]);

  if (current == level) {
    return;
  }

  token.metadataUri = metadataUri.slice(0, -1).concat(level);
  token.save();

  let collection = getOrCreateCollection(smolbrains.toHexString());

  ERC721.updateMetadata(token, collection, listing, "Head Size", level);

  if (
    !MetadataAttribute.load(
      [token.id, getAttributeId(smolbrains, "Head Size", level)].join("-")
    )
  ) {
    log.info("headSizeFailed token: {}", [token.tokenId.toString()]);

    let missingIds = collection._missingMetadataIds;

    if (!missingIds.includes(token.tokenId.toString())) {
      collection._missingMetadataIds = missingIds.concat([
        token.tokenId.toString(),
      ]);
      collection.save();
    }
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

    updateCollectionFloorAndTotal(getOrCreateCollection(SMOLBRAIN_ADDRESS));
  } else {
    store.remove("UserToken", id);
  }
}

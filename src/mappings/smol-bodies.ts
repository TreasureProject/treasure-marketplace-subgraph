import * as ERC721 from "./721";
import { Address, log, store } from "@graphprotocol/graph-ts";
import { Transfer } from "../../generated/TreasureMarketplace/ERC721";
import {
  ONE_BI,
  SMOLBODIES_ADDRESS,
  ZERO_BI,
  addMetadataToToken,
  checkForRarityUpdates,
  checkMissingMetadata,
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
import { DropGym, JoinGym } from "../../generated/Smol Bodies Gym/Gym";
import {
  Exerciser,
  Listing,
  Metadata,
  MetadataAttribute,
} from "../../generated/schema";
import { SmolBodiesMint } from "../../generated/Smol Bodies/SmolBodies";

export function handleMint(event: SmolBodiesMint): void {
  let params = event.params;
  let to = params.to;
  let tokenId = params.tokenId;
  let address = event.address;

  let collection = getOrCreateCollection(address.toHexString());
  let token = getOrCreateToken(getTokenId(address, tokenId));
  let buyer = getOrCreateUser(to.toHexString());
  let userToken = getOrCreateUserToken(getListingId(to, address, tokenId));

  collection._tokenIds = collection._tokenIds.concat([tokenId.toString()]);
  collection.address = address;
  collection.creator = getCreator("SmolBrain").id;
  collection.name = "Smol Bodies";
  collection.standard = "ERC721";
  collection.save();

  token.collection = collection.id;
  token.owner = buyer.id;
  token.tokenId = tokenId;
  token.metadata = token.id;
  token.metadataUri = params.tokenURI.replace(
    "QmSn56t6vRtWxCcc8jqS6YtzdjfR564GFTvehGek6eKLmX",
    "Qmbt6W9QB74VZzJfWbqG7vi2hiE2K4AnoyvWGFDHEjgoqN"
  );

  collection.save();
  token.save();

  let attribute = getOrCreateAttribute(
    getAttributeId(address, "Plates", tokenId.toHexString())
  );

  attribute.name = "Plates";
  attribute.value = ZERO_BI.toString();

  attribute._tokenIds = [];

  createMetadataAttribute(attribute.id, token.id);

  attribute.save();

  addMetadataToToken(token, event.block.number, collection);

  let metadata = Metadata.load(token.id);

  if (metadata) {
    token.name = `${metadata.description} ${metadata.name}`;
  } else {
    token.name = `${collection.name} ${`#${tokenId.toString()}`}`;
  }

  // Add missing metadata id to be tried again
  if (
    !metadata &&
    !collection._missingMetadataIds.includes(tokenId.toString())
  ) {
    collection._missingMetadataIds = collection._missingMetadataIds.concat([
      tokenId.toString(),
    ]);
  }

  userToken.quantity = ONE_BI;
  userToken.token = token.id;
  userToken.user = buyer.id;

  checkMissingMetadata(collection, event.block.number);
  checkForRarityUpdates(collection, token);

  collection.save();
  token.save();
  userToken.save();
  buyer.save();
}

export function handleTransfer(event: Transfer): void {
  // Mint handled by `handleMint`
  if (isMint(event.params.from)) {
    return;
  }

  let collection = getOrCreateCollection(event.address.toHexString());

  collection.creator = getCreator("SmolBrain").id;
  collection.name = "Smol Bodies";
  collection.save();

  ERC721.handleTransfer(event);
}

export function handleDropGym(event: DropGym): void {
  let params = event.params;
  let from = event.transaction.from;
  let user = getOrCreateUser(from.toHexString());
  let smolbodies = Address.fromString(SMOLBODIES_ADDRESS);
  let tokenId = params.tokenId;
  let plates = params.plates;
  let level = params.level.toString();
  let id = getListingId(from, smolbodies, tokenId);
  let listing = Listing.load(id);

  store.remove("Exerciser", id);

  if (listing) {
    listing.status = "Active";
    listing.save();

    let collection = getOrCreateCollection(SMOLBODIES_ADDRESS);

    collection._listingIds = collection._listingIds.concat([listing.id]);
    collection.save();

    updateCollectionFloorAndTotal(collection);
  } else {
    let userToken = getOrCreateUserToken(id);

    userToken.quantity = ONE_BI;
    userToken.token = `${SMOLBODIES_ADDRESS}-${tokenId.toHexString()}`;
    userToken.user = user.id;

    userToken.save();
  }

  let platesAttribute = getOrCreateAttribute(
    getAttributeId(smolbodies, "Plates", tokenId.toHexString())
  );

  log.info("More plates value: {}, id: {}", [
    plates.toString(),
    platesAttribute.id,
  ]);

  platesAttribute.value = plates.toString();
  platesAttribute.save();

  // Did our swol grow?
  let token = getOrCreateToken(getTokenId(smolbodies, tokenId));
  let metadataUri = token.metadataUri;

  log.info("dropGym metadataUri: {}, level: {}", [
    metadataUri ? metadataUri.toString() : "null",
    level,
  ]);

  if (metadataUri === null) {
    return;
  }

  let current = metadataUri.slice(-1);

  log.info("dropGym current: {}, level: {}", [current, level]);

  if (current == level) {
    return;
  }

  token.metadataUri = metadataUri.slice(0, -1).concat(level);
  token.save();

  log.info("dropGym newUri: {}", [metadataUri.slice(0, -1).concat(level)]);

  log.info("updateSwolSize token: {}, from: {}, to: {}", [
    tokenId.toString(),
    current,
    level,
  ]);

  let collection = getOrCreateCollection(smolbodies.toHexString());

  ERC721.updateMetadata(token, collection, listing, "Swol Size", level);

  if (
    !MetadataAttribute.load(
      [token.id, getAttributeId(smolbodies, "Swol Size", level)].join("-")
    )
  ) {
    log.info("swolSizeFailed token: {}", [token.tokenId.toString()]);

    let missingIds = collection._missingMetadataIds;

    if (!missingIds.includes(token.tokenId.toString())) {
      collection._missingMetadataIds = missingIds.concat([
        token.tokenId.toString(),
      ]);
      collection.save();
    }
  }
}

export function handleJoinGym(event: JoinGym): void {
  let from = event.transaction.from;
  let smolbodies = Address.fromString(SMOLBODIES_ADDRESS);
  let tokenId = event.params.tokenId;
  let id = getListingId(from, smolbodies, tokenId);
  let listing = Listing.load(id);

  new Exerciser(id).save();

  if (listing) {
    listing.status = "Hidden";
    listing.save();

    updateCollectionFloorAndTotal(getOrCreateCollection(SMOLBODIES_ADDRESS));
  } else {
    store.remove("UserToken", id);
  }
}

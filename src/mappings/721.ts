import {
  Attribute,
  Collection,
  Listing,
  Metadata,
  Token,
} from "../../generated/schema";
import { ERC721, Transfer } from "../../generated/TreasureMarketplace/ERC721";
import {
  ONE_BI,
  ZERO_BI,
  addMetadataToToken,
  checkForRarityUpdates,
  checkMissingMetadata,
  createMetadataAttribute,
  getAttributeId,
  getOrCreateAttribute,
  getOrCreateCollection,
  getOrCreateToken,
  getOrCreateUser,
  getOrCreateUserToken,
  getListingId,
  getTokenId,
  isMint,
  isSafeTransferFrom,
  removeFromArray,
  toBigDecimal,
  updateCollectionFloorAndTotal,
} from "../helpers";
import { log, store } from "@graphprotocol/graph-ts";

export function handleTransfer(event: Transfer): void {
  let params = event.params;
  let from = params.from;
  let to = params.to;
  let tokenId = params.tokenId;
  let address = event.address;

  let collection = getOrCreateCollection(address.toHexString());
  let token = getOrCreateToken(getTokenId(address, tokenId));
  let buyer = getOrCreateUser(to.toHexString());
  let userToken = getOrCreateUserToken(getListingId(to, address, tokenId));

  collection.address = address;
  collection.standard = "ERC721";

  token.collection = collection.id;
  token.owner = buyer.id;
  token.tokenId = tokenId;

  if (isMint(from)) {
    collection._tokenIds = collection._tokenIds.concat([tokenId.toString()]);

    let contract = ERC721.bind(address);
    let uri = contract.try_tokenURI(tokenId);

    let metadataUri = uri.reverted
      ? collection.name === "Smol Brains" && tokenId.equals(ZERO_BI)
        ? "https://treasure-marketplace.mypinata.cloud/ipfs/QmZg7bqH36fnKUcmKDhqGm65j5hbFeDZcogoxxiFMLeybE/0/0"
        : null
      : uri.value;

    token.metadata = token.id;
    token.metadataUri = metadataUri;

    collection.save();
    token.save();

    addMetadataToToken(token, event.block.number, collection);
  }

  let metadata = Metadata.load(token.id);

  if (collection.name != "Smol Cars") {
    if (metadata && metadata.description != "Smol Brains Land") {
      token.name = `${metadata.description} ${metadata.name}`;
    } else {
      token.name = `${collection.name} ${`#${tokenId.toString()}`}`;
    }
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

  // Not a mint, remove it from the transferrer
  if (!isMint(from)) {
    let seller = getListingId(from, address, tokenId);
    let listing = Listing.load(seller);

    /*
     * For Smolbrains, we cannot transfer while staked, so we can skip handling that case.
     */

    // Was called using `safeTransferFrom` and not a sold listing
    if (listing && isSafeTransferFrom(event.transaction)) {
      store.remove("Listing", listing.id);

      updateCollectionFloorAndTotal(collection);
    }

    store.remove("UserToken", seller);
  }

  userToken.quantity = ONE_BI;
  userToken.token = token.id;
  userToken.user = buyer.id;

  checkMissingMetadata(collection, event.block.number);
  checkForRarityUpdates(collection, isMint(from) ? token : null);

  collection.save();
  token.save();
  userToken.save();
  buyer.save();
}

export function updateMetadata(
  token: Token,
  collection: Collection,
  listing: Listing | null,
  name: string,
  value: string
): void {
  let attribute = getOrCreateAttribute(
    getAttributeId(collection.address, name, value)
  );

  attribute.collection = collection.id;
  attribute.name = name;
  attribute.value = value;

  if (!collection._attributeIds.includes(attribute.id)) {
    collection._attributeIds = collection._attributeIds.concat([attribute.id]);
    collection.save();
  }

  if (!attribute._tokenIds.includes(token.tokenId.toString())) {
    attribute._tokenIds = attribute._tokenIds.concat([
      token.tokenId.toString(),
    ]);
    attribute.percentage = toBigDecimal(attribute._tokenIds.length).div(
      toBigDecimal(collection._tokenIds.length)
    );
  }

  log.info("removeSize token: {}, size: {}", [
    token.tokenId.toString(),
    value.toString(),
  ]);

  let previousValue = "0";
  let filters = token.filters;

  for (let _index = 0; _index < filters.length; _index++) {
    let parts = filters[_index].split(",");

    if (parts[0] != name) {
      continue;
    }

    previousValue = parts[1];

    log.info("foundPreviousSize token: {}, value: {}", [
      token.tokenId.toString(),
      previousValue,
    ]);
  }

  let id = getAttributeId(collection.address, name, previousValue);
  let previousSize = Attribute.load(id);

  if (!previousSize) {
    log.info("notPreviousSize type: {}, previousValue: {}, id: {}", [
      name,
      previousValue,
      id,
    ]);

    return;
  }

  log.info("previousSize id: {}, name: {}, value: {}", [
    previousSize.id,
    previousSize.name,
    previousSize.value,
  ]);

  previousSize._tokenIds = removeFromArray(
    previousSize._tokenIds,
    token.tokenId.toString()
  );

  previousSize.percentage = toBigDecimal(previousSize._tokenIds.length).div(
    toBigDecimal(collection._tokenIds.length)
  );

  previousSize.save();

  token.filters = filters = removeFromArray(
    token.filters,
    `${name},${previousValue}`
  );
  token.save();

  store.remove("MetadataAttribute", [token.id, previousSize.id].join("-"));

  log.info("removedMetadataAttribute id: {}", [
    [token.id, previousSize.id].join("-"),
  ]);

  createMetadataAttribute(attribute.id, token.id);

  attribute.save();

  let lookup = `${name},${value}`;

  if (!filters.includes(lookup)) {
    token.filters = filters.concat([lookup]);
    token.save();
  }

  // Save updated filters to existing listing
  if (listing) {
    listing.filters = token.filters;
    listing.save();
  }
}

import { Address, BigInt, log, store } from "@graphprotocol/graph-ts";
import { Listing, Metadata } from "../../generated/schema";
import { SmolBrains } from "../../generated/Smol Brains School/SmolBrains";
import { ERC721, Transfer } from "../../generated/TreasureMarketplace/ERC721";
import {
  ONE_BI,
  ZERO_BI,
  addMetadataToToken,
  checkMissingMetadata,
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
  removeAtIndex,
  toBigDecimal,
  updateCollectionFloorAndTotal,
} from "../helpers";

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

  // Mint, lets set some things up
  if (isMint(from) && !collection._tokenIds.includes(tokenId)) {
    collection._tokenIds = collection._tokenIds.concat([tokenId]);
    collection.save();
  }

  if (isMint(from)) {
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

    addMetadataToToken(token, event.block.number);
  }

  let metadata = Metadata.load(token.id);

  if (metadata && metadata.description != "Smol Brains Land") {
    token.name = `${metadata.description} ${metadata.name}`;
  } else {
    token.name = `${collection.name} ${`#${tokenId.toString()}`}`;
  }

  // Add missing metadata id to be tried again
  if (!metadata) {
    collection._missingMetadataIds = collection._missingMetadataIds.concat([
      tokenId,
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

  collection.save();
  token.save();
  userToken.save();
  buyer.save();
}

export function updateMetadata(
  address: Address,
  tokenId: BigInt,
  block: BigInt
): void {
  let contract = SmolBrains.bind(address);

  // Snapshot IQ
  let iq = contract.try_brainz(tokenId);

  if (iq.reverted) {
    log.info("iqReverted token: {}", [tokenId.toString()]);

    return;
  }

  let iqAttribute = getOrCreateAttribute(
    getAttributeId(address, "IQ", tokenId.toHexString())
  );

  iqAttribute.value = iq.value.toString();
  iqAttribute.save();

  // Did our brain grow?
  let token = getOrCreateToken(getTokenId(address, tokenId));
  let metadataUri = token.metadataUri;

  if (metadataUri === null) {
    return;
  }

  let head = metadataUri.split("/").reverse()[0];
  let calculated = BigInt.fromString(iqAttribute.value)
    .div(BigInt.fromI32(50))
    .toString();
  let size =
    calculated.length < 18 ? "" : calculated.slice(0, calculated.length - 18);

  if (head == size || !size) {
    return;
  }

  let uri = contract.try_tokenURI(tokenId);

  if (uri.reverted) {
    log.info("uriReverted fetching new head size, token: {}", [
      tokenId.toString(),
    ]);

    return;
  }

  let updated = uri.value.split("/").reverse()[0];

  if (updated != size) {
    log.info("headSizeMismatch token: {}, uri: {}, calculated: {}", [
      tokenId.toString(),
      updated,
      size,
    ]);

    return;
  }

  log.info("updateHeadSize token: {}, from: {}, to: {}", [
    tokenId.toString(),
    head,
    size,
  ]);

  let name = "Head Size";
  let headSizeAttribute = getOrCreateAttribute(
    getAttributeId(address, name, head)
  );
  let lookup = `${name},${head}`;
  let filters = token.filters;
  let tokenIds = headSizeAttribute._tokenIds;

  if (tokenIds.includes(tokenId)) {
    headSizeAttribute._tokenIds = removeAtIndex(
      tokenIds,
      tokenIds.indexOf(tokenId)
    );
    headSizeAttribute.percentage = toBigDecimal(0);
    headSizeAttribute.save();
  }

  if (filters.includes(lookup)) {
    token.filters = removeAtIndex(filters, filters.indexOf(lookup));
    token.save();
  }

  store.remove("MetadataAttribute", `${token.id}-${headSizeAttribute.id}`);

  token.metadataUri = uri.value;
  token.save();

  addMetadataToToken(token, block);
}

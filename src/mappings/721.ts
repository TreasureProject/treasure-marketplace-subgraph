import { Address, BigInt, store } from "@graphprotocol/graph-ts";
import { Listing, Metadata } from "../../generated/schema";
import { SmolBrains } from "../../generated/Smol Brains School/SmolBrains";
import { ERC721, Transfer } from "../../generated/TreasureMarketplace/ERC721";
import {
  ONE_BI,
  ZERO_BI,
  addMetadataToToken,
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
  shouldUpdateMetadata,
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

  let contract = ERC721.bind(address);
  let uri = contract.try_tokenURI(tokenId);

  collection.address = address;
  collection.standard = "ERC721";

  token.collection = collection.id;
  token.metadata = token.id;
  token.owner = buyer.id;
  token.tokenId = tokenId;

  // Mint, lets set some things up
  if (isMint(from) && !collection._tokenIds.includes(tokenId)) {
    collection._tokenIds = collection._tokenIds.concat([tokenId]);
    collection.save();
  }

  let metadataUri = uri.reverted
    ? collection.name === "Smol Brains" && tokenId.equals(ZERO_BI)
      ? "https://treasure-marketplace.mypinata.cloud/ipfs/QmZg7bqH36fnKUcmKDhqGm65j5hbFeDZcogoxxiFMLeybE/0/0"
      : null
    : uri.value;

  if (metadataUri !== token.metadataUri) {
    token.metadataUri = metadataUri;

    addMetadataToToken(token);
  }

  let metadata = Metadata.load(token.id);

  if (metadata && metadata.description != "Smol Brains Land") {
    token.name = `${metadata.description} ${metadata.name}`;
  } else {
    token.name = `${collection.name} ${`#${tokenId.toString()}`}`;
  }

  // Add missing metadata id to be tried again
  if (!metadata) {
    collection.missingMetadataIds = collection.missingMetadataIds.concat([
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

  // Try fetching missing metadata
  let metadataIds = collection.missingMetadataIds;

  for (let index = 0; index < metadataIds.length; index++) {
    let metadataId = metadataIds[index];
    let uri = contract.try_tokenURI(metadataId);

    if (!uri.reverted) {
      let metadataTokenId = getTokenId(address, metadataId);
      let metadataToken = getOrCreateToken(metadataTokenId);

      metadataToken.metadataUri = uri.value;

      addMetadataToToken(metadataToken);

      if (Metadata.load(metadataTokenId)) {
        collection.missingMetadataIds = removeAtIndex(
          collection.missingMetadataIds,
          index
        );
      }

      metadataToken.save();
    }
  }

  collection.save();
  token.save();
  userToken.save();
  buyer.save();
}

export function updateMetadata(address: Address, tokenId: BigInt): void {
  let contract = SmolBrains.bind(address);
  let uri = contract.try_tokenURI(tokenId);
  let token = getOrCreateToken(getTokenId(address, tokenId));

  // Snapshot IQ
  let iq = contract.try_brainz(tokenId);

  if (!iq.reverted) {
    let attribute = getOrCreateAttribute(
      getAttributeId(address, "IQ", tokenId.toHexString())
    );

    attribute.value = iq.value.toString();
    attribute.save();
  }

  // Only way our tokeknURI changes is when our head size increases. So lets remove the old attribute.
  if (shouldUpdateMetadata(uri, token.metadataUri)) {
    let metadataUri = token.metadataUri;

    if (metadataUri === null) {
      return;
    }

    let head = metadataUri.split("/").reverse()[0];
    let name = "Head Size";
    let attribute = getOrCreateAttribute(getAttributeId(address, name, head));
    let lookup = `${name},${head}`;
    let filters = token.filters;

    if (attribute._tokenIds.includes(tokenId)) {
      attribute._tokenIds = removeAtIndex(
        attribute._tokenIds,
        attribute._tokenIds.indexOf(tokenId)
      );
      attribute.percentage = toBigDecimal(0);
      attribute.save();
    }

    if (filters.includes(lookup)) {
      token.filters = removeAtIndex(filters, filters.indexOf(lookup));
      token.save();
    }

    store.remove("MetadataAttribute", `${token.id}-${attribute.id}`);
  }

  token.metadataUri = uri.value;
  token.save();

  addMetadataToToken(token);
}

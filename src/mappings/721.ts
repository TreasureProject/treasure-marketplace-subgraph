import { Address, BigInt, store } from "@graphprotocol/graph-ts";
import { Listing, Metadata } from "../../generated/schema";
import { ERC721, Transfer } from "../../generated/TreasureMarketplace/ERC721";
import {
  ONE_BI,
  ZERO_ADDRESS,
  ZERO_BI,
  addMetadataToToken,
  getOrCreateCollection,
  getOrCreateToken,
  getOrCreateUser,
  getOrCreateUserToken,
  getListingId,
  getTokenId,
  isSafeTransferFrom,
  removeAtIndex,
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

  if (!uri.reverted) {
    token.metadataUri = uri.value;

    addMetadataToToken(uri.value, token.id, tokenId);
  } else if (collection.name == "Smol Brains" && tokenId.equals(ZERO_BI)) {
    // This token was transferred on contract creation so there is no metadataUri yet
    let metadataUri =
      "https://treasure-marketplace.mypinata.cloud/ipfs/QmZg7bqH36fnKUcmKDhqGm65j5hbFeDZcogoxxiFMLeybE/0/0";

    addMetadataToToken(metadataUri, token.id, tokenId);

    token.metadataUri = metadataUri;
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

  token.metadata = token.id;
  token.tokenId = tokenId;

  // Not a mint, remove it from the transferrer
  if (from.toHexString() != ZERO_ADDRESS) {
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

      token.metadataUri = uri.value;

      addMetadataToToken(uri.value, metadataTokenId, metadataId);

      if (Metadata.load(metadataTokenId)) {
        collection.missingMetadataIds = removeAtIndex(
          collection.missingMetadataIds,
          index
        );
      }
    }
  }

  collection.save();
  token.save();
  userToken.save();
  buyer.save();
}

export function updateMetadata(address: Address, tokenId: BigInt): void {
  let contract = ERC721.bind(address);
  let uri = contract.try_tokenURI(tokenId);
  let token = getOrCreateToken(getTokenId(address, tokenId));

  if (!uri.reverted && token.metadataUri != uri.value) {
    token.metadataUri = uri.value;
    token.save();

    addMetadataToToken(uri.value, token.id, tokenId);
  }
}

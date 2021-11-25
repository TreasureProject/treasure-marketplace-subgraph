import { log, store } from "@graphprotocol/graph-ts";
import { Listing } from "../../generated/schema";
import {
  ERC1155,
  TransferBatch,
  TransferSingle,
  URI,
} from "../../generated/TreasureMarketplace/ERC1155";
import {
  STAKING_ADDRESS,
  ZERO_ADDRESS,
  addMetadataToToken,
  getCreator,
  getName,
  getOrCreateCollection,
  getOrCreateToken,
  getOrCreateUser,
  getOrCreateUserToken,
  getListingId,
  getTokenId,
  isSafeTransferFrom,
  updateCollectionFloorAndTotal,
} from "../helpers";

export function handleTransferSingle(event: TransferSingle): void {
  let params = event.params;
  let from = params.from;
  let to = params.to;
  let tokenId = params.id;
  let address = event.address;
  let quantity = params.value;

  let collection = getOrCreateCollection(address.toHexString());
  let token = getOrCreateToken(getTokenId(address, tokenId));

  let contract = ERC1155.bind(address);
  let uri = contract.try_uri(tokenId);

  collection.address = address;
  collection.standard = "ERC1155";

  if (!collection.creator) {
    collection.creator = getCreator("TreasureDAO", 0).id;
  }

  token.collection = collection.id;

  if (!uri.reverted) {
    let metadataUri = uri.value.endsWith(".json")
      ? uri.value
      : `${uri.value}${tokenId}.json`;

    // TODO: This is okay for now until contracts are updated
    metadataUri = metadataUri.replace(
      "gateway.pinata.cloud",
      "treasure-marketplace.mypinata.cloud"
    );

    // Update metadata hash to new one for transfers happening before the update
    metadataUri = metadataUri.replace(
      "QmXqHecFPPFgsZivrREchua466pbUF4WTb7SQcfH2f1GK3",
      "Qmf2a3J62DCA6wWc6pY9xqHWyexqG17srVeAUrXiewSB1Q"
    );

    addMetadataToToken(metadataUri, token.id, tokenId);

    token.metadata = token.id;
    token.metadataUri = metadataUri;
  }

  if (STAKING_ADDRESS == to.toHexString()) {
    let id = getListingId(from, address, tokenId);
    let listing = Listing.load(id);
    let userToken = getOrCreateUserToken(id);

    if (listing) {
      listing.status = "Hidden";
      listing.save();

      updateCollectionFloorAndTotal(address);
    }

    if (userToken.quantity.equals(quantity)) {
      store.remove("UserToken", userToken.id);
    } else {
      userToken.quantity = userToken.quantity.minus(quantity);
      userToken.save();
    }
  } else if (STAKING_ADDRESS == from.toHexString()) {
    let id = getListingId(from, address, tokenId);
    let listing = Listing.load(id);
    let userToken = getOrCreateUserToken(id);

    if (listing) {
      listing.status = "Active";
      listing.save();

      collection.listingIds = collection.listingIds.concat([listing.id]);
      collection.save();

      updateCollectionFloorAndTotal(address);
    } else {
      let toUser = getOrCreateUser(to.toHexString());

      userToken.token = token.id;
      userToken.user = toUser.id;
      userToken.quantity = userToken.quantity.plus(quantity);
      userToken.save();
    }
  } else {
    // Not a mint, remove it from the transferrer
    if (from.toHexString() != ZERO_ADDRESS) {
      let seller = getListingId(from, address, tokenId);
      let listing = Listing.load(seller);
      let userToken = getOrCreateUserToken(seller);

      // Was called using `safeTransferFrom` and not a sold listing
      if (listing && isSafeTransferFrom(event.transaction)) {
        store.remove("Listing", listing.id);

        updateCollectionFloorAndTotal(address);
      }

      if (userToken.quantity.equals(quantity)) {
        store.remove("UserToken", userToken.id);
      } else {
        userToken.quantity = userToken.quantity.minus(quantity);
        userToken.save();
      }
    }

    let toUser = getOrCreateUser(to.toHexString());
    let userToken = getOrCreateUserToken(getListingId(to, address, tokenId));

    userToken.quantity = userToken.quantity.plus(quantity);
    userToken.token = token.id;
    userToken.user = toUser.id;

    toUser.save();
    userToken.save();
  }

  token.name = getName(tokenId);
  token.tokenId = tokenId;

  collection.save();
  token.save();
}

export function handleTransferBatch(event: TransferBatch): void {
  let params = event.params;

  log.info("[TransferBatch (from)]: {}", [params.from.toHexString()]);
  log.info("[TransferBatch (to)]: {}", [params.to.toHexString()]);
  log.info("[TransferBatch (ids)]: {}", [params.ids.join(", ")]);
  log.info("[TransferBatch (values)]: {}", [params.values.join(", ")]);
}

export function handleURI(event: URI): void {
  let params = event.params;

  log.info("[URI (id)]: {}", [params.id.toString()]);
  log.info("[URI (value)]: {}", [params.value]);
}

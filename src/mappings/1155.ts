import { BigInt, log, store } from "@graphprotocol/graph-ts";
import { Listing, Metadata } from "../../generated/schema";
import {
  ERC1155,
  TransferBatch,
  TransferSingle,
  URI,
} from "../../generated/TreasureMarketplace/ERC1155";
import {
  STAKING_ADDRESS,
  ZERO_BI,
  addMetadataToToken,
  checkMissingMetadata,
  getCreator,
  getListingId,
  getName,
  getOrCreateCollection,
  getOrCreateToken,
  getOrCreateUser,
  getOrCreateUserToken,
  getTokenId,
  isMint,
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

  collection.address = address;
  collection.standard = "ERC1155";

  if (!collection.creator) {
    collection.creator = getCreator("TreasureDAO", 0).id;
  }

  token.collection = collection.id;
  token.name = getName(tokenId);
  token.tokenId = tokenId;

  if (isMint(from)) {
    let contract = ERC1155.bind(address);
    let uri = contract.try_uri(tokenId);

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

    token.metadata = token.id;
    token.metadataUri = metadataUri;

    collection.save();
    token.save();

    addMetadataToToken(token, ZERO_BI, collection);
  }

  let metadata = Metadata.load(token.id);

  // Add missing metadata id to be tried again
  if (
    !metadata &&
    !collection._missingMetadataIds.includes(tokenId.toString())
  ) {
    collection._missingMetadataIds = collection._missingMetadataIds.concat([
      tokenId.toString(),
    ]);
  }

  if (STAKING_ADDRESS == to.toHexString()) {
    let id = getListingId(from, address, tokenId);
    let listing = Listing.load(id);
    let userToken = getOrCreateUserToken(id);
    let updated = userToken.quantity.minus(quantity);

    if (userToken.quantity.equals(quantity) || updated.lt(ZERO_BI)) {
      store.remove("UserToken", userToken.id);
    } else {
      userToken.quantity = userToken.quantity.minus(quantity);
      userToken.save();
    }

    if (listing && updated.lt(ZERO_BI)) {
      if (listing.quantity.equals(updated.abs())) {
        listing.status = "Hidden";
      } else {
        listing.quantity = listing.quantity.minus(updated.abs());
      }

      listing.save();

      updateCollectionFloorAndTotal(collection);
    }
  } else if (STAKING_ADDRESS == from.toHexString()) {
    let id = getListingId(to, address, tokenId);
    let listing = Listing.load(id);
    let userToken = getOrCreateUserToken(id);
    let updated = BigInt.fromI32(0); //userToken.quantity.minus(quantity);

    if (listing) {
      if (listing._listedQuantity.notEqual(listing.quantity)) {
        listing.quantity = listing.quantity.plus(quantity);

        if (listing.quantity.gt(listing._listedQuantity)) {
          updated = listing._listedQuantity.minus(listing.quantity);

          listing.quantity = listing._listedQuantity;
        }

        listing.status = "Active";
        listing.save();

        collection._listingIds = collection._listingIds.concat([listing.id]);

        updateCollectionFloorAndTotal(collection);
      } else {
        // Set updated to get our user tokens correct
        updated = quantity.neg();
      }
    }

    if (!listing || updated.lt(ZERO_BI)) {
      let toUser = getOrCreateUser(to.toHexString());

      userToken.token = token.id;
      userToken.user = toUser.id;
      userToken.quantity = userToken.quantity.plus(
        updated.lt(ZERO_BI) ? updated.abs() : quantity
      );
      userToken.save();
    }
  } else {
    // Transfered away, update counts
    if (isSafeTransferFrom(event.transaction)) {
      let seller = getListingId(from, address, tokenId);
      let listing = Listing.load(seller);
      let userToken = getOrCreateUserToken(seller);
      let updated = userToken.quantity.minus(quantity);

      if (userToken.quantity.equals(quantity) || updated.lt(ZERO_BI)) {
        store.remove("UserToken", userToken.id);
      } else {
        userToken.quantity = userToken.quantity.minus(quantity);
        userToken.save();
      }

      if (listing && updated.lt(ZERO_BI)) {
        if (listing.quantity.equals(updated.abs())) {
          store.remove("Listing", listing.id);
        } else {
          listing.quantity = listing.quantity.minus(updated.abs());
          listing.save();
        }

        updateCollectionFloorAndTotal(collection);
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

  checkMissingMetadata(collection, event.block.number);

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

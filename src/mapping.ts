import { BigInt, log, store } from "@graphprotocol/graph-ts";
import {
  ItemCanceled,
  ItemListed,
  ItemSold,
  ItemUpdated,
  OwnershipTransferred,
  UpdateFee,
  UpdateFeeRecipient,
  UpdateOracle,
  UpdatePaymentToken,
} from "../generated/TreasureMarketplace/TreasureMarketplace";
import {
  getOrCreateCollection,
  getOrCreateListing,
  getOrCreateToken,
  getOrCreateUser,
  getOrCreateUserToken,
  getListingId,
  getTokenId,
} from "./helpers";

export function handleItemCanceled(event: ItemCanceled): void {
  let params = event.params;
  let seller = params.seller;

  let listing = getOrCreateListing(
    getListingId(seller, params.nftAddress, params.tokenId)
  );
  let user = getOrCreateUser(seller.toHexString());
  let userToken = getOrCreateUserToken(listing.id);

  if (!listing) {
    log.info("[Listing is null]: {}", [params.seller.toHexString()]);
    return;
  }
  if (!user) {
    log.info("[User is null]: {}", [params.seller.toHexString()]);
    return;
  }
  if (!userToken) {
    log.info("[UserToken is null]: {}", [params.seller.toHexString()]);
    return;
  }

  userToken.quantity = userToken.quantity.plus(listing.quantity);
  userToken.token = listing.token;
  userToken.user = listing.user;

  store.remove("Listing", listing.id);

  userToken.save();
}

export function handleItemListed(event: ItemListed): void {
  let params = event.params;
  let seller = params.seller;
  let tokenAddress = params.nftAddress;
  let tokenId = params.tokenId;
  let quantity = params.quantity;

  let listing = getOrCreateListing(getListingId(seller, tokenAddress, tokenId));
  let token = getOrCreateToken(getTokenId(tokenAddress, tokenId));
  let collection = getOrCreateCollection(token.collection);

  listing.collection = token.collection;
  listing.collectionName = collection.name;
  listing.expires = params.expirationTime;
  listing.pricePerItem = params.pricePerItem;
  listing.quantity = quantity;
  listing.status = "Active";
  listing.token = token.id;
  listing.tokenName = token.name;
  listing.user = seller.toHexString();

  let userToken = getOrCreateUserToken(listing.id);

  if (userToken.quantity.equals(quantity)) {
    store.remove("UserToken", listing.id);
  } else {
    userToken.quantity = userToken.quantity.minus(quantity);
    userToken.save();
  }

  listing.save();
}

export function handleItemSold(event: ItemSold): void {
  let params = event.params;

  let listing = getOrCreateListing(
    getListingId(params.seller, params.nftAddress, params.tokenId)
  );

  if (!listing) {
    return;
  }

  // Remove sold listing.
  store.remove("Listing", listing.id);

  // TODO: Handle partial buys

  // We change the ID to not conflict with future listings of the same seller, contract, and token.
  listing.id += "-sold";
  listing.expires = BigInt.fromI32(0);
  listing.status = "Sold";

  listing.save();
}

export function handleItemUpdated(event: ItemUpdated): void {
  let params = event.params;

  let listing = getOrCreateListing(
    getListingId(params.seller, params.nftAddress, params.tokenId)
  );

  if (!listing) {
    return;
  }

  if (!listing.quantity.equals(params.quantity)) {
    let userToken = getOrCreateUserToken(listing.id);

    userToken.quantity = userToken.quantity.plus(
      listing.quantity.minus(params.quantity)
    );

    if (userToken.quantity.equals(BigInt.fromI32(0))) {
      store.remove("UserToken", userToken.id);
    } else {
      userToken.token = listing.token;
      userToken.user = listing.user;

      userToken.save();
    }
  }

  listing.quantity = params.quantity;
  listing.pricePerItem = params.pricePerItem;
  listing.expires = params.expirationTime;

  listing.save();
}

export function handleOwnershipTransferred(event: OwnershipTransferred): void {}

export function handleUpdateFee(event: UpdateFee): void {}

export function handleUpdateFeeRecipient(event: UpdateFeeRecipient): void {}

export function handleUpdateOracle(event: UpdateOracle): void {}

export function handleUpdatePaymentToken(event: UpdatePaymentToken): void {}

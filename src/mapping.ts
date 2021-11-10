import { Address, log, store } from "@graphprotocol/graph-ts";
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
  ONE_BI,
  ZERO_BI,
  getOrCreateCollection,
  getOrCreateListing,
  getOrCreateToken,
  getOrCreateUser,
  getOrCreateUserToken,
  getListingId,
  getTokenId,
} from "./helpers";

function updateCollectionFloorAndTotal(id: Address): void {
  let collection = getOrCreateCollection(id.toHexString());
  let listings = collection.listings;

  for (let index = 0; index < listings.length; index++) {
    let listing = getOrCreateListing(listings[index]);

    if (collection.floorPrice.gt(listing.pricePerItem)) {
      collection.floorPrice = listing.pricePerItem;
    }
  }

  collection.totalListings = collection.totalListings.minus(ONE_BI);

  collection.save();
}

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

  updateCollectionFloorAndTotal(params.nftAddress);

  userToken.quantity = userToken.quantity.plus(listing.quantity);
  userToken.token = listing.token;
  userToken.user = listing.user;

  store.remove("Listing", listing.id);

  userToken.save();
}

export function handleItemListed(event: ItemListed): void {
  let params = event.params;
  let pricePerItem = params.pricePerItem;
  let quantity = params.quantity;
  let tokenAddress = params.nftAddress;
  let tokenId = params.tokenId;
  let seller = params.seller;

  let listing = getOrCreateListing(getListingId(seller, tokenAddress, tokenId));
  let token = getOrCreateToken(getTokenId(tokenAddress, tokenId));
  let collection = getOrCreateCollection(token.collection);

  let floorPrice = collection.floorPrice;

  if (
    floorPrice.gt(pricePerItem) ||
    (floorPrice.equals(ZERO_BI) && pricePerItem.notEqual(ZERO_BI))
  ) {
    collection.floorPrice = pricePerItem;
  }

  collection.totalListings = collection.totalListings.plus(ONE_BI);

  listing.blockNumber = event.block.number;
  listing.collection = token.collection;
  listing.collectionName = collection.name;
  listing.expires = params.expirationTime;
  listing.pricePerItem = pricePerItem;
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

  collection.save();
  listing.save();
}

export function handleItemSold(event: ItemSold): void {
  let params = event.params;
  let quantity = params.quantity;

  let listing = getOrCreateListing(
    getListingId(params.seller, params.nftAddress, params.tokenId)
  );

  if (!listing) {
    return;
  }

  if (listing.quantity.equals(quantity)) {
    // Remove sold listing.
    store.remove("Listing", listing.id);
  } else {
    listing.quantity = listing.quantity.minus(quantity);
    listing.save();
  }

  updateCollectionFloorAndTotal(params.nftAddress);

  // We change the ID to not conflict with future listings of the same seller, contract, and token.
  listing.id += "-sold";
  listing.quantity = quantity;
  listing.expires = ZERO_BI;
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

    if (userToken.quantity.equals(ZERO_BI)) {
      store.remove("UserToken", userToken.id);
    } else {
      userToken.token = listing.token;
      userToken.user = listing.user;

      userToken.save();
    }
  }

  updateCollectionFloorAndTotal(params.nftAddress);

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

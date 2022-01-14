import { BigInt, log, store } from "@graphprotocol/graph-ts";
import { Exerciser, Listing, Student, UserToken } from "../generated/schema";
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
  EXPLORER,
  ONE_BI,
  ZERO_BI,
  getErc1155Owners,
  getListingId,
  getOrCreateCollection,
  getOrCreateListing,
  getOrCreateToken,
  getOrCreateUser,
  getOrCreateUserToken,
  getTokenId,
  removeFromArray,
  updateCollectionFloorAndTotal,
} from "./helpers";

function formatPrice(number: BigInt): string {
  if (number.isZero()) {
    return "0";
  }

  let input = number.toString();
  let value = input.slice(0, -18);
  let decimals = input
    .slice(-18)
    .split("0")
    .join("");

  return [value, decimals.length > 0 ? "." : "", decimals].join("");
}

export function handleItemCanceled(event: ItemCanceled): void {
  let params = event.params;
  let seller = params.seller;

  let listing = getOrCreateListing(
    getListingId(seller, params.nftAddress, params.tokenId)
  );
  let user = getOrCreateUser(seller.toHexString());

  if (!listing) {
    log.info("[Listing is null]: {}", [params.seller.toHexString()]);
    return;
  }
  if (!user) {
    log.info("[User is null]: {}", [params.seller.toHexString()]);
    return;
  }

  // If not staked, move back into users inventory
  if (!(Student.load(listing.id) || Exerciser.load(listing.id))) {
    let userToken = getOrCreateUserToken(listing.id);

    userToken.quantity = userToken.quantity.plus(listing.quantity);
    userToken.token = listing.token;
    userToken.user = listing.user;

    userToken.save();
  }

  store.remove("Listing", listing.id);

  updateCollectionFloorAndTotal(getOrCreateCollection(listing.collection));
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
  let status =
    Student.load(listing.id) || Exerciser.load(listing.id)
      ? "Hidden"
      : "Active";

  if (
    (floorPrice.isZero() || floorPrice.gt(pricePerItem)) &&
    status == "Active"
  ) {
    collection.floorPrice = pricePerItem;
  }

  if (collection.standard == "ERC1155") {
    let tokenFloorPrice = token.floorPrice;

    if (
      !tokenFloorPrice ||
      (tokenFloorPrice && tokenFloorPrice.gt(pricePerItem))
    ) {
      token.floorPrice = pricePerItem;
      token.save();
    }
  }

  if (status == "Active") {
    collection._listingIds = collection._listingIds.concat([listing.id]);
    collection.totalListings = collection.totalListings.plus(quantity);
  }

  listing._listedQuantity = quantity;
  listing.blockTimestamp = event.block.timestamp;
  listing.collection = token.collection;
  listing.collectionName = collection.name;
  listing.expires = params.expirationTime;
  listing.filters = token.filters;
  listing.pricePerItem = pricePerItem;
  listing.quantity = quantity;
  listing.seller = seller.toHexString();
  listing.status = status;
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
  let seller = params.seller;
  let buyer = params.buyer;
  let address = params.nftAddress;
  let tokenId = params.tokenId;

  let listing = getOrCreateListing(getListingId(seller, address, tokenId));

  if (!listing) {
    return;
  }

  let collection = getOrCreateCollection(listing.collection);

  collection.totalSales = collection.totalSales.plus(ONE_BI);
  collection.totalVolume = collection.totalVolume.plus(
    listing.pricePerItem.times(quantity)
  );

  if (listing.quantity.equals(quantity)) {
    // Remove sold listing.
    store.remove("Listing", listing.id);

    // Remove from owners if ERC1155s
    if (collection.standard == "ERC1155") {
      let token = getOrCreateToken(getTokenId(address, tokenId));

      token._owners = removeFromArray(token._owners, seller.toHexString());
      token.save();

      collection.totalOwners = getErc1155Owners(collection);
    }
  } else {
    listing.quantity = listing.quantity.minus(quantity);
    listing._listedQuantity = listing.quantity;
    listing.save();
  }

  // We change the ID to not conflict with future listings of the same seller, contract, and token.
  let hash = event.transaction.hash.toHexString();
  let sold = getOrCreateListing(`${listing.id}-${hash}`);
  let pricePerItem = listing.pricePerItem;
  let updatedQuantity = sold.quantity ? sold.quantity.plus(quantity) : quantity;

  sold.blockTimestamp = event.block.timestamp;
  sold.buyer = buyer.toHexString();
  sold.collection = listing.collection;
  sold.collectionName = listing.collectionName;
  sold.expires = ZERO_BI;
  sold.filters = null;
  sold.pricePerItem = pricePerItem;
  sold.nicePrice = formatPrice(pricePerItem);
  sold.quantity = updatedQuantity;
  sold.seller = seller.toHexString();
  sold.status = "Sold";
  sold.token = listing.token;
  sold.tokenName = listing.tokenName;
  sold.totalPrice = formatPrice(pricePerItem.times(updatedQuantity));
  sold.transactionLink = `https://${EXPLORER}/tx/${hash}`;
  sold.user = seller.toHexString();

  collection.save();
  sold.save();

  updateCollectionFloorAndTotal(collection);
}

export function handleItemUpdated(event: ItemUpdated): void {
  let params = event.params;
  let listingId = getListingId(
    params.seller,
    params.nftAddress,
    params.tokenId
  );

  let listing = Listing.load(listingId);

  if (!listing) {
    log.info("handleItemUpdated, null listing {}", [listingId]);

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

  if (!listing.pricePerItem.equals(params.pricePerItem)) {
    listing.blockTimestamp = event.block.timestamp;
  }

  listing.quantity = params.quantity;
  listing.pricePerItem = params.pricePerItem;
  listing.expires = params.expirationTime;

  listing.save();

  updateCollectionFloorAndTotal(getOrCreateCollection(listing.collection));
}

export function handleItemSoldStaging(event: ItemSold): void {
  let params = event.params;
  let buyer = params.buyer;

  let userToken = UserToken.load(
    getListingId(buyer, params.nftAddress, params.tokenId)
  );

  if (userToken) {
    if (params.quantity.equals(userToken.quantity)) {
      store.remove("UserToken", userToken.id);
    } else {
      userToken.quantity = userToken.quantity.minus(params.quantity);
      userToken.save();
    }
  }
}

export function handleOwnershipTransferred(event: OwnershipTransferred): void {}

export function handleUpdateFee(event: UpdateFee): void {}

export function handleUpdateFeeRecipient(event: UpdateFeeRecipient): void {}

export function handleUpdateOracle(event: UpdateOracle): void {}

export function handleUpdatePaymentToken(event: UpdatePaymentToken): void {}

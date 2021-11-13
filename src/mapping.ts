import {
  Address,
  BigDecimal,
  BigInt,
  TypedMap,
  log,
  store,
} from "@graphprotocol/graph-ts";
import { Collection, Listing, Token } from "../generated/schema";
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
  getOrCreateCollection,
  getOrCreateListing,
  getOrCreateToken,
  getOrCreateUser,
  getOrCreateUserToken,
  getListingId,
  getTokenId,
} from "./helpers";

function updateCollectionFloorAndTotal(id: Address): void {
  let collection = Collection.load(id.toHexString());

  if (collection == null) {
    log.info("[updateCollectionFloorAndTotal]: Found Null Collection {}", [
      id.toHexString(),
    ]);

    return;
  }

  let floorPrices = new TypedMap<string, BigInt>();
  let listings = collection.listingIds;

  collection.floorPrice = ZERO_BI;

  for (let index = 0; index < listings.length; index++) {
    let listing = Listing.load(listings[index]);

    if (listing !== null && listing.status == "Active") {
      let floorPrice = collection.floorPrice;
      let pricePerItem = listing.pricePerItem;

      if (collection.standard == "ERC1155") {
        let tokenFloorPrice = floorPrices.get(listing.token);

        if (
          !tokenFloorPrice ||
          (tokenFloorPrice && tokenFloorPrice.gt(pricePerItem))
        ) {
          floorPrices.set(listing.token, pricePerItem);
        }
      }

      if (floorPrice.isZero() || floorPrice.gt(pricePerItem)) {
        collection.floorPrice = pricePerItem;
      }
    } else {
      collection.listingIds = collection.listingIds
        .slice(0, index)
        .concat(collection.listingIds.slice(index + 1));
    }
  }

  let entries = floorPrices.entries;

  for (let index = 0; index < entries.length; index++) {
    let entry = entries[index];
    let token = Token.load(entry.key);

    if (token) {
      token.floorPrice = entry.value;
      token.save();
    }
  }

  collection.totalListings = BigInt.fromI32(collection.listingIds.length);

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

  userToken.quantity = userToken.quantity.plus(listing.quantity);
  userToken.token = listing.token;
  userToken.user = listing.user;

  store.remove("Listing", listing.id);

  userToken.save();

  updateCollectionFloorAndTotal(params.nftAddress);
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

  if (floorPrice.isZero() || floorPrice.gt(pricePerItem)) {
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

  collection.listingIds = collection.listingIds.concat([listing.id]);
  collection.totalListings = collection.totalListings.plus(ONE_BI);

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
  let seller = params.seller;
  let buyer = params.buyer;

  let listing = getOrCreateListing(
    getListingId(seller, params.nftAddress, params.tokenId)
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

  if (Listing.load(`${listing.id}-sold`)) {
    store.remove("Listing", `${listing.id}-sold`);
  }

  // We change the ID to not conflict with future listings of the same seller, contract, and token.
  let sold = getOrCreateListing(`${listing.id}-${event.logIndex}`);
  let nicePrice = sold.pricePerItem.div(BigInt.fromI32(10).pow(18));

  sold.blockTimestamp = event.block.timestamp;
  sold.buyer = buyer.toHexString();
  sold.collection = listing.collection;
  sold.collectionName = listing.collectionName;
  sold.expires = ZERO_BI;
  sold.pricePerItem = listing.pricePerItem;
  sold.nicePrice = nicePrice;
  sold.quantity = quantity;
  sold.status = "Sold";
  sold.token = listing.token;
  sold.tokenName = listing.tokenName;
  sold.totalPrice = nicePrice.times(quantity);
  sold.transactionLink = `https://${EXPLORER}/tx/${event.transaction.hash.toHexString()}`;
  sold.user = seller.toHexString();

  sold.save();

  updateCollectionFloorAndTotal(params.nftAddress);
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

  listing.quantity = params.quantity;
  listing.pricePerItem = params.pricePerItem;
  listing.expires = params.expirationTime;

  listing.save();

  updateCollectionFloorAndTotal(params.nftAddress);
}

export function handleOwnershipTransferred(event: OwnershipTransferred): void {}

export function handleUpdateFee(event: UpdateFee): void {}

export function handleUpdateFeeRecipient(event: UpdateFeeRecipient): void {}

export function handleUpdateOracle(event: UpdateOracle): void {}

export function handleUpdatePaymentToken(event: UpdatePaymentToken): void {}

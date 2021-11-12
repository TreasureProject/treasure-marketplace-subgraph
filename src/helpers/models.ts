import { log } from "@graphprotocol/graph-ts";
import {
  Collection,
  Listing,
  Metadata,
  Token,
  User,
  UserToken,
} from "../../generated/schema";
import { ZERO_BI } from ".";

export function getOrCreateCollection(id: string): Collection {
  let collection = Collection.load(id);

  if (!collection) {
    collection = new Collection(id);

    collection.floorPrice = ZERO_BI;
    collection.listingIds = [];
    collection.totalListings = ZERO_BI;
    collection.save();
  }

  return collection;
}

export function getOrCreateListing(id: string): Listing {
  let listing = Listing.load(id);

  if (!listing) {
    listing = new Listing(id);
  }

  return listing;
}

export function getOrCreateMetadata(id: string): Metadata {
  let metadata = Metadata.load(id);

  if (!metadata) {
    metadata = new Metadata(id);
  }

  return metadata;
}

export function getOrCreateToken(id: string): Token {
  let token = Token.load(id);

  if (!token) {
    token = new Token(id);
  }

  return token;
}

export function getOrCreateUser(id: string): User {
  let user = User.load(id);

  if (!user) {
    log.info("[createUser] Create User {}", [id]);

    user = new User(id);
  }

  return user;
}

export function getOrCreateUserToken(id: string): UserToken {
  let userToken = UserToken.load(id);

  if (!userToken) {
    userToken = new UserToken(id);
  }

  return userToken;
}


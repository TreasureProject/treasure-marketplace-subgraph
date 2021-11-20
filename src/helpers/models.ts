import {
  BigDecimal,
  BigInt,
  ipfs,
  json,
  JSONValue,
  JSONValueKind,
  log,
} from "@graphprotocol/graph-ts";
import {
  Collection,
  Creator,
  Listing,
  Metadata,
  Token,
  User,
  UserToken,
} from "../../generated/schema";
import { IPFS_GATEWAY, ZERO_BI } from ".";

export function getOrCreateCollection(id: string): Collection {
  let collection = Collection.load(id);

  if (!collection) {
    collection = new Collection(id);

    collection.floorPrice = ZERO_BI;
    collection.listingIds = [];
    collection.totalListings = ZERO_BI;
    collection.totalSales = ZERO_BI;
    collection.save();
  }

  return collection;
}

export function getCreator(name: string, fee: number = 2.5): Creator {
  let creator = Creator.load(name);

  if (!creator) {
    creator = new Creator(name);

    creator.name = name;
    creator.fee = BigDecimal.fromString(fee.toString());
    creator.save();
  }

  return creator;
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

export function addMetadataToToken(
  metadataUri: string,
  id: string,
  tokenId: BigInt
): void {
  if (metadataUri.startsWith("https://")) {
    let bytes = ipfs.cat(metadataUri.replace(IPFS_GATEWAY, ""));

    if (bytes === null) {
      log.info("[IPFS] Null bytes for token {}", [tokenId.toString()]);
    } else {
      let obj = json.fromBytes(bytes);

      if (obj !== null) {
        function getString(value: JSONValue | null): string {
          return value ? value.toString() : "";
        }

        // This is because the Extra Life metadata is an array of a single object.
        // https://gateway.pinata.cloud/ipfs/QmYX3wDGawC2sBHW9GMuBkiE8UmaEqJu4hDwmFeKwQMZYj/80.json
        if (obj.kind === JSONValueKind.ARRAY) {
          obj = obj.toArray()[0];
        }

        let object = obj.toObject();
        let description = getString(object.get("description"));
        let image = getString(object.get("image"));
        let name = getString(object.get("name"));

        let metadata = getOrCreateMetadata(id);

        metadata.description = description;
        metadata.image = image.replace(IPFS_GATEWAY, "ipfs://");
        metadata.name = name;

        metadata.save();
      }
    }
  }
}

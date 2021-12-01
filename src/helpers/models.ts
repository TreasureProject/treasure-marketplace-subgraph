import {
  Address,
  BigDecimal,
  BigInt,
  ipfs,
  json,
  JSONValue,
  JSONValueKind,
  log,
  TypedMap,
} from "@graphprotocol/graph-ts";
import {
  Attribute,
  Collection,
  Creator,
  Listing,
  Metadata,
  MetadataAttribute,
  Token,
  User,
  UserToken,
} from "../../generated/schema";
import {
  IPFS_GATEWAY,
  ZERO_BI,
  removeAtIndex,
  getAttributeId,
  toBigDecimal,
  getTokenId,
} from ".";

export function createMetadataAttribute(
  attributeId: string,
  metadataId: string
): void {
  let relationshipId = [metadataId, attributeId].join("-");

  if (!MetadataAttribute.load(relationshipId)) {
    let relationship = new MetadataAttribute(relationshipId);

    relationship.attribute = attributeId;
    relationship.metadata = metadataId;
    relationship.save();
  }
}

export function getOrCreateAttribute(id: string): Attribute {
  let attribute = Attribute.load(id);

  if (!attribute) {
    attribute = new Attribute(id);

    attribute._tokenIds = [];
  }

  return attribute;
}

export function getOrCreateCollection(id: string): Collection {
  let collection = Collection.load(id);

  if (!collection) {
    collection = new Collection(id);

    collection._tokenIds = [];
    collection.floorPrice = ZERO_BI;
    collection.listingIds = [];
    collection.missingMetadataIds = [];
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

    token.filters = [];
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

export function addMetadataToToken(metadataUri: string, token: Token): void {
  if (metadataUri.startsWith("https://")) {
    let bytes = ipfs.cat(metadataUri.replace(IPFS_GATEWAY, ""));

    if (bytes === null) {
      log.info("[IPFS] Null bytes for token {}", [token.tokenId.toString()]);
    } else {
      let collection = Collection.load(token.collection);
      let collectionAddress = Address.fromString(token.collection);
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

        let metadata = getOrCreateMetadata(token.id);

        metadata.description = description;
        metadata.image = image.replace(
          "https://gateway.pinata.cloud/ipfs/",
          "ipfs://"
        );
        metadata.name = name;
        metadata.token = token.id;

        // Attributes
        let attributes = object.get("attributes");

        if (attributes && attributes.kind === JSONValueKind.ARRAY) {
          let items = attributes.toArray();

          for (let index = 0; index < items.length; index++) {
            let item = items[index];

            if (item.kind === JSONValueKind.OBJECT) {
              let object = item.toObject();
              let type = getString(object.get("trait_type"));
              let jsonValue = object.get("value");

              let value =
                jsonValue && jsonValue.kind === JSONValueKind.NUMBER
                  ? jsonValue.toI64().toString()
                  : getString(jsonValue);

              let attribute = getOrCreateAttribute(
                getAttributeId(collectionAddress, type, value)
              );

              attribute.name = type;
              attribute.value = value;

              if (!attribute._tokenIds.includes(token.tokenId)) {
                attribute._tokenIds = attribute._tokenIds.concat([
                  token.tokenId,
                ]);
                attribute.percentage = toBigDecimal(0);
              }

              createMetadataAttribute(attribute.id, metadata.id);

              attribute.save();

              let lookup = `${type},${value}`;
              let filters = token.filters;

              if (!filters.includes(lookup)) {
                token.filters = filters.concat([lookup]);
                token.save();
              }
            }
          }
        }

        metadata.save();

        if (collection) {
          let ids = collection._tokenIds;

          for (let index = 0; index < ids.length; index++) {
            let id = ids[index];

            let _token = getOrCreateToken(getTokenId(collectionAddress, id));

            if (_token) {
              let filters = _token.filters;
              let rarity = toBigDecimal(0);

              for (let _index = 0; _index < filters.length; _index++) {
                let filter = filters[_index];
                let split = filter.split(",");
                let name = split[0];
                let value = split[1];
                let attribute = getOrCreateAttribute(
                  getAttributeId(collectionAddress, name, value)
                );

                let count = attribute._tokenIds.length;
                let total = collection._tokenIds.length;

                attribute.percentage = toBigDecimal(count).div(
                  toBigDecimal(total)
                );

                rarity = rarity.plus(toBigDecimal(1).div(attribute.percentage));

                attribute.save();
              }

              _token.rarity = rarity;
              _token.save();
            }
          }
        }
      }
    }
  }
}

export function updateCollectionFloorAndTotal(collection: Collection): void {
  let floorPrices = new TypedMap<string, BigInt>();
  let listings = collection.listingIds;

  collection.floorPrice = ZERO_BI;

  for (let index = 0; index < listings.length; index++) {
    let listing = Listing.load(listings[index]);

    if (listing != null && listing.status == "Active") {
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
      collection.listingIds = removeAtIndex(collection.listingIds, index);
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

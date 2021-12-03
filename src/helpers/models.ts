import {
  Address,
  BigDecimal,
  BigInt,
  JSONValue,
  JSONValueKind,
  TypedMap,
  ipfs,
  json,
  log,
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
  RARITY_CALCULATION_BLOCK,
  ZERO_BI,
  getAttributeId,
  getTokenId,
  removeAtIndex,
  toBigDecimal,
} from ".";
import { ERC1155 } from "../../generated/TreasureMarketplace/ERC1155";
import { ERC721 } from "../../generated/TreasureMarketplace/ERC721";

class TokenRarity {
  token: Token;
  rarity: BigDecimal;
}

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

    attribute.save();
  }

  return attribute;
}

export function getOrCreateCollection(id: string): Collection {
  let collection = Collection.load(id);

  if (!collection) {
    collection = new Collection(id);

    collection._listingIds = [];
    collection._missingMetadataIds = [];
    collection._tokenIds = [];

    collection.floorPrice = ZERO_BI;
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

    token.save();
  }

  return token;
}

export function getOrCreateUser(id: string): User {
  let user = User.load(id);

  if (!user) {
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

function getString(value: JSONValue | null): string {
  return value ? value.toString() : "";
}

export function addMetadataToToken(token: Token, block: BigInt): void {
  let metadataUri = token.metadataUri;

  if (
    metadataUri === null ||
    (metadataUri && !metadataUri.startsWith("https://"))
  ) {
    return;
  }

  let bytes = ipfs.cat(metadataUri.replace(IPFS_GATEWAY, ""));

  if (bytes === null) {
    log.info("addMetadataToToken null bytes for token {}", [
      token.tokenId.toString(),
    ]);

    return;
  }

  let obj = json.fromBytes(bytes);

  if (obj === null) {
    log.info("addMetadataToToken null json fromBytes for token {}", [
      token.tokenId.toString(),
    ]);

    return;
  }

  let collection = Collection.load(token.collection);
  let collectionAddress = Address.fromString(token.collection);

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

  if (!attributes || attributes.kind !== JSONValueKind.ARRAY) {
    metadata.save();

    return;
  }

  // Will never happen, but helps AssemblyScript types
  if (!collection) {
    return;
  }

  let items = attributes.toArray();

  for (let index = 0; index < items.length; index++) {
    let item = items[index];

    if (item.kind !== JSONValueKind.OBJECT) {
      continue;
    }

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

    attribute.collection = collection.id;
    attribute.name = type;
    attribute.value = value;

    if (!attribute._tokenIds.includes(token.tokenId)) {
      attribute._tokenIds = attribute._tokenIds.concat([token.tokenId]);
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

  metadata.save();

  if (block.lt(RARITY_CALCULATION_BLOCK)) {
    return;
  }

  log.info("rarityCalculation block: {}, collection: {}", [
    block.toString(),
    collection.name,
  ]);

  let ids = collection._tokenIds;
  let tokens =  new Array<TokenRarity>(ids.length);

  for (let index = 0; index < ids.length; index++) {
    let id = ids[index];

    tokens[index] = {
      token: getOrCreateToken(getTokenId(collectionAddress, id)),
      rarity: toBigDecimal(0),
    };
  }

  log.info("rarityCalculation rarity set to 0; block: {}, collection: {}", [
    block.toString(),
    collection.name,
  ]);

  for (let index = 0; index < tokens.length; index++) {
    let _token = tokens[index].token;

    let filters = _token.filters;
    let rarity = toBigDecimal(0);

    for (let _index = 0; _index < filters.length; _index++) {
      let filter = filters[_index];
      let split = filter.split(",");
      let trait = split[0];
      let value = split[1];
      let attribute = getOrCreateAttribute(
        getAttributeId(collectionAddress, trait, value)
      );

      let count = attribute._tokenIds.length;
      let total = collection._tokenIds.length;

      log.info(
        "rarityCalculation block: {}, collection: {}, trait: {}, value: {}, count: {}, total: {}",
        [
          block.toString(),
          collection.name,
          trait,
          value,
          count.toString(),
          total.toString(),
        ]
      );

      attribute.percentage = toBigDecimal(count).div(toBigDecimal(total));

      // Don't include IQ or Head Size in rarity calculation
      if (!["IQ", "Head Size"].includes(trait)) {
        rarity = rarity.plus(toBigDecimal(1).div(attribute.percentage));
      }

      attribute.save();
    }

    _token.rarity = tokens[index].rarity = rarity;
  }

  log.info("rarityCalculation block: {}, collection: {}", [
    block.toString(),
    collection.name,
  ]);

  tokens.sort((left, right) => (right.rarity.gt(left.rarity) ? 1 : -1));

  log.info("rarityCalculation tokens sorted block: {}, collection: {}", [
    block.toString(),
    collection.name,
  ]);

  for (let index = 0; index < tokens.length; index++) {
    let _token = tokens[index].token;

    log.info(
      "rarityCalculation set rank block: {}, collection: {}, token: {}",
      [block.toString(), collection.name, _token.tokenId.toString()]
    );

    _token.rank = index + 1;
    _token.save();
  }

  log.info("rarityCalculation ranks complete block: {}, collection: {}", [
    block.toString(),
    collection.name,
  ]);
}

export function checkMissingMetadata(
  collection: Collection,
  block: BigInt
): void {
  // Try fetching missing metadata
  let metadataIds = collection._missingMetadataIds;
  let address = Address.fromString(collection.address.toHexString());

  for (let index = 0; index < metadataIds.length; index++) {
    let metadataId = metadataIds[index];
    let uri =
      collection.standard == "ERC721"
        ? ERC721.bind(address).try_tokenURI(metadataId)
        : ERC1155.bind(address).try_uri(metadataId);

    if (!uri.reverted) {
      let metadataTokenId = getTokenId(address, metadataId);
      let metadataToken = getOrCreateToken(metadataTokenId);

      metadataToken.metadataUri = uri.value;

      addMetadataToToken(metadataToken, block);

      if (Metadata.load(metadataTokenId)) {
        collection._missingMetadataIds = removeAtIndex(
          collection._missingMetadataIds,
          index
        );
      }

      metadataToken.save();
    }
  }
}

export function updateCollectionFloorAndTotal(collection: Collection): void {
  let floorPrices = new TypedMap<string, BigInt>();
  let listings = collection._listingIds;

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
      collection._listingIds = removeAtIndex(collection._listingIds, index);
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

  collection.totalListings = BigInt.fromI32(collection._listingIds.length);

  collection.save();
}

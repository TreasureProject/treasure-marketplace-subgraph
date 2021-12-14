import {
  Address,
  BigDecimal,
  BigInt,
  JSONValue,
  JSONValueKind,
  TypedMap,
  dataSource,
  ipfs,
  json,
  log,
  store,
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
  removeFromArray,
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

    collection._attributeIds = [];
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

export function addMetadataToToken(
  token: Token,
  block: BigInt,
  collection: Collection,
  skip: boolean = false
): void {
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
      getAttributeId(collection.address, type, value)
    );

    attribute.collection = collection.id;
    attribute.name = type;
    attribute.value = value;

    if (!collection._attributeIds.includes(attribute.id)) {
      collection._attributeIds = collection._attributeIds.concat([
        attribute.id,
      ]);
      collection.save();
    }

    if (!attribute._tokenIds.includes(token.tokenId.toString())) {
      attribute._tokenIds = attribute._tokenIds.concat([
        token.tokenId.toString(),
      ]);
      attribute.percentage = toBigDecimal(0);
    }

    // Remove previous head size
    if (type == "Head Size" && value != "0") {
      log.info("removeHeadSize  token: {}, size: {}", [
        token.tokenId.toString(),
        value.toString(),
      ]);

      let previousValue = "0";
      let filters = token.filters;

      for (let _index = 0; _index < filters.length; _index++) {
        let parts = filters[_index].split(",");

        if (parts[0] != "Head Size") {
          continue;
        }

        previousValue = parts[1];

        log.info("foundPreviousHeadSize token: {}, value: {}", [
          token.tokenId.toString(),
          previousValue,
        ]);
      }

      let id = getAttributeId(collection.address, type, previousValue);
      let previousHeadSize = Attribute.load(id);

      if (!previousHeadSize) {
        log.info("notPreviousHeadSize type: {}, previousValue: {}, id: {}", [
          type,
          previousValue,
          id,
        ]);

        return;
      }

      log.info("previousHeadSize id: {}, name: {}, value: {}", [
        previousHeadSize.id,
        previousHeadSize.name,
        previousHeadSize.value,
      ]);

      previousHeadSize._tokenIds = removeFromArray(
        previousHeadSize._tokenIds,
        token.tokenId.toString()
      );

      previousHeadSize.percentage = toBigDecimal(
        previousHeadSize._tokenIds.length
      ).div(toBigDecimal(collection._tokenIds.length));

      previousHeadSize.save();

      token.filters = removeFromArray(
        token.filters,
        `${type},${previousValue}`
      );
      token.save();

      store.remove(
        "MetadataAttribute",
        [metadata.id, previousHeadSize.id].join("-")
      );

      log.info("removedMetadataAttribute id: {}", [
        [metadata.id, previousHeadSize.id].join("-"),
      ]);
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
}

let thresholds = new TypedMap<string, number>();
let isRinkeby = dataSource.network() == "rinkeby";

thresholds.set("Smol Bodies", isRinkeby ? 20 : 4054);
thresholds.set("Smol Brains", isRinkeby ? 241 : 10_665);
thresholds.set("Smol Brains Land", isRinkeby ? 2 : 3_983);
thresholds.set("Smol Cars", isRinkeby ? 120 : 7_872);

function shouldCalculate(collection: Collection): boolean {
  let count = collection._tokenIds.length;
  let threshold = thresholds.getEntry(collection.name);

  return threshold ? count >= threshold.value : false;
}

export function checkForRarityUpdates(
  collection: Collection,
  token: Token | null
): void {
  if (!shouldCalculate(collection)) {
    return;
  }

  let attributeIds = collection._attributeIds;
  let ids = collection._tokenIds;
  let total = ids.length;
  // TODO: Try TypedMap?
  let rarities = new Array<TokenRarity>();
  let modifier = token ? 1 : 0;

  log.info("attributePercentageStart", []);

  // Loop through attributes and calculate percentage
  for (let index = 0; index < attributeIds.length; index++) {
    let id = attributeIds[index];

    if (id.includes("iq")) {
      log.info("skipPercentage id: {}", [id]);

      continue;
    }

    let attribute = Attribute.load(id);

    if (!attribute) {
      log.info("percentageNoAttribute id: {}, index: {}", [
        id,
        index.toString(),
      ]);

      return;
    }

    let count = attribute._tokenIds.length;

    attribute.percentage = toBigDecimal(count).div(toBigDecimal(total));
    attribute.save();
  }

  log.info("attributePercentageComplete", []);

  // TODO: Remove this for rarity calculation
  return;

  log.info("rarityCalculationStart", []);

  // Setup rarity array
  for (let index = 0; index < ids.length - modifier; index++) {
    let id = BigInt.fromString(ids[index]);

    rarities[index] = {
      token: getOrCreateToken(getTokenId(collection.address, id)),
      rarity: toBigDecimal(0),
    };
  }

  log.info("rarityArraySetup items: {}", [rarities.length.toString()]);

  // for (let index = 0; index < 10_000; index++) {
  //   let id = BigInt.fromString(ids[index]);

  //   rarities[index] = {
  //     token: getOrCreateToken(getTokenId(collection.address, id)),
  //     rarity: toBigDecimal(0),
  //   };
  // }

  // Add current token to the end of rarities array, if a mint
  if (token) {
    log.info("pushMintToken {}", [token.tokenId.toString()]);

    rarities.push({
      token,
      rarity: toBigDecimal(0),
    });
  }

  log.info("rarityToolsCalculation items: {}", [rarities.length.toString()]);

  // Loop through tokens and calculate rarity based on attributes
  for (let index = 0; index < rarities.length; index++) {
    log.info("rarityCalulation index: {}, total: {}", [
      index.toString(),
      rarities.length.toString(),
    ]);

    let _token = rarities[index].token;
    let filters = _token.filters;
    let rarity = toBigDecimal(0);
    let _tokenId = _token.tokenId.toString();

    log.info("rarityCalulationFilters index: {}, token: {}, filters: {}", [
      index.toString(),
      _tokenId,
      filters.join(":"),
    ]);

    for (let _index = 0; _index < filters.length; _index++) {
      let filter = filters[_index];
      let split = filter.split(",");
      let trait = split[0];
      let value = split[1];

      // Don't include IQ or Head Size in rarity calculation
      if (["IQ", "Head Size"].includes(trait)) {
        continue;
      }

      let attribute = Attribute.load(
        getAttributeId(collection.address, trait, value)
      );

      // Shouldn't happen, but just in case
      if (!attribute) {
        log.info(
          "attributeFailed index: {}, token: {}, trait: '{}', value: '{}'",
          [index.toString(), _tokenId, trait, value]
        );

        continue;
      }

      let percentage = attribute.percentage;

      // Shouldn't be hit, but makes AS happy
      if (!percentage) {
        log.info(
          "percentageFailed index: {}, token: {}, trait: '{}', value: '{}'",
          [index.toString(), _tokenId, trait, value]
        );

        continue;
      }

      log.info(
        "beforeRarity index: {}, token: {}, trait: '{}', value: '{}', percentage: {}, rarity: {}",
        [
          index.toString(),
          _tokenId,
          trait,
          value,
          percentage.toString(),
          rarity.toString(),
        ]
      );

      rarity = rarity.plus(toBigDecimal(1).div(percentage));

      log.info(
        "afterRarity index: {}, token: {}, trait: '{}', value: '{}', rarity: {}",
        [index.toString(), _tokenId, trait, value, rarity.toString()]
      );
    }

    log.info("rarityCalulated index: {}, token: {}, rarity: {}", [
      index.toString(),
      _tokenId,
      rarity.toString(),
    ]);

    rarities[index].rarity = rarity;

    log.info("raritySetOnIndex index: {}, token: {}", [
      index.toString(),
      _tokenId,
    ]);
  }

  log.info("rarityCalculationComplete", []);

  rarities.sort((left, right) => (right.rarity.gt(left.rarity) ? 1 : -1));

  log.info("rarityCalculationSorted", []);

  // Save 2,000 at a time.
  let chunk = 2000;

  for (let index = 0; index < rarities.length; index++) {
    // Stop once we've completed our chunk size
    if (chunk === 0) {
      break;
    }

    let rank = index + 1;
    let item = rarities[index];
    let _token = item.token;
    let rarity = _token.rarity;

    if (!rarity || rarity.notEqual(item.rarity) || _token.rank !== rank) {
      _token.rarity = item.rarity;
      _token.rank = rank;
      _token.save();

      chunk--;
    }
  }

  log.info("rarityCalculationRanksComplete leftover: {}", [chunk.toString()]);
}

export function checkMissingMetadata(
  collection: Collection,
  block: BigInt
): void {
  // Try fetching missing metadata
  let metadataIds = collection._missingMetadataIds;
  let address = Address.fromString(collection.address.toHexString());

  for (let index = 0; index < metadataIds.length; index++) {
    let metadataId = BigInt.fromString(metadataIds[index]);
    let uri =
      collection.standard == "ERC721"
        ? ERC721.bind(address).try_tokenURI(metadataId)
        : ERC1155.bind(address).try_uri(metadataId);

    log.info("missingMetadataIds collection: {}, ids: {}", [
      collection.name.toString(),
      metadataId.toString(),
    ]);

    if (!uri.reverted) {
      let metadataTokenId = getTokenId(address, metadataId);
      let metadataToken = getOrCreateToken(metadataTokenId);

      metadataToken.metadataUri = uri.value;

      addMetadataToToken(metadataToken, block, collection);

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

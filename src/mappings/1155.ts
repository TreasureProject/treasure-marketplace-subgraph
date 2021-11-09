import {
  Address,
  BigInt,
  ByteArray,
  Bytes,
  JSONValue,
  JSONValueKind,
  crypto,
  dataSource,
  ethereum,
  // i32,
  ipfs,
  json,
  log,
} from "@graphprotocol/graph-ts";
import {
  ERC1155,
  TransferBatch,
  TransferSingle,
  URI,
} from "../../generated/TreasureMarketplace/ERC1155";
import { Collection, Token, User } from "../../generated/schema";
import {
  ZERO_ADDRESS,
  base64Decode,
  getName,
  getOrCreateCollection,
  getOrCreateMetadata,
  getOrCreateToken,
  getOrCreateUser,
  getOrCreateUserToken,
  getListingId,
  getTokenId,
  updateSeller,
} from "../helpers";

export function handleTransferSingle(event: TransferSingle): void {
  let params = event.params;
  let from = params.from;
  let to = params.to;
  let tokenId = params.id;
  let address = event.address;

  let collection = getOrCreateCollection(address.toHexString());
  let token = getOrCreateToken(getTokenId(address, tokenId));
  let buyer = getOrCreateUser(to.toHexString());
  let userToken = getOrCreateUserToken(getListingId(to, address, tokenId));

  // updateSeller(from.toHexString(), token.id);

  let contract = ERC1155.bind(address);
  let uri = contract.try_uri(tokenId);

  collection.address = address;

  // if (collection.tokens.indexOf(token.id) === -1) {
  //   collection.tokens = collection.tokens.concat([token.id]);
  // }

  token.collection = collection.id;

  if (!uri.reverted) {
    token.metadataUri = `${uri.value}${tokenId}.json`;

    // This is Treasure's IPFS URI format
    if (uri.value.startsWith("https://") && uri.value.endsWith("/")) {
      let hash = uri.value.replace("https://gateway.pinata.cloud/ipfs/", "");
      let bytes = ipfs.cat(`${hash}${tokenId}.json`);

      if (bytes === null) {
        log.info("[IPFS] Null bytes for token {}", [tokenId.toString()]);
      } else {
        let obj = json.fromBytes(bytes);

        if (obj !== null) {
          function s(v: JSONValue | null): string {
            return v ? v.toString() : "";
          }

          // This is because the Extra Life metadata is an array of a single object.
          // https://gateway.pinata.cloud/ipfs/QmYX3wDGawC2sBHW9GMuBkiE8UmaEqJu4hDwmFeKwQMZYj/80.json
          if (obj.kind === JSONValueKind.ARRAY) {
            obj = obj.toArray()[0]
          }

          let object = obj.toObject();
          let description = s(object.get("description"));
          let image = s(object.get("image"));
          let name = s(object.get("name"));

          log.info("[Metadata (name)]: {}", [name]);
          log.info("[Metadata (image)]: {}", [image]);
          log.info("[Metadata (description)]: {}", [description]);

          let metadata = getOrCreateMetadata(token.id);

          metadata.description = description;
          metadata.image = image;
          metadata.name = name;

          metadata.save();

          token.metadata = metadata.id;
        }
      }
    }
  }

  token.name = getName(tokenId);
  token.tokenId = tokenId;

  userToken.quantity = userToken.quantity.plus(params.value);
  userToken.token = token.id;
  userToken.user = buyer.id;

  collection.save();
  token.save();
  userToken.save();
  buyer.save();
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

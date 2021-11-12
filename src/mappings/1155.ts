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
  store,
} from "@graphprotocol/graph-ts";
import {
  ERC1155,
  TransferBatch,
  TransferSingle,
  URI,
} from "../../generated/TreasureMarketplace/ERC1155";
import { Collection, Token, User, UserToken } from "../../generated/schema";
import {
  STAKING_ADDRESS,
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
} from "../helpers";

export function handleTransferSingle(event: TransferSingle): void {
  let params = event.params;
  let from = params.from;
  let to = params.to;
  let tokenId = params.id;
  let address = event.address;
  let quantity = params.value;

  let collection = getOrCreateCollection(address.toHexString());
  let token = getOrCreateToken(getTokenId(address, tokenId));

  let contract = ERC1155.bind(address);
  let uri = contract.try_uri(tokenId);

  collection.address = address;
  collection.standard = "ERC1155";

  token.collection = collection.id;

  if (!uri.reverted) {
    let metadataUri = uri.value.endsWith(".json")
      ? uri.value
      : `${uri.value}${tokenId}.json`;

    // TODO: This is okay for now until contracts are updated
    metadataUri = metadataUri.replace(
      "gateway.pinata.cloud",
      "treasure-marketplace.mypinata.cloud"
    );

    token.metadataUri = metadataUri;

    if (metadataUri.startsWith("https://")) {
      let bytes = ipfs.cat(
        metadataUri.replace(
          "https://treasure-marketplace.mypinata.cloud/ipfs/",
          ""
        )
      );

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
            obj = obj.toArray()[0];
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

  if (STAKING_ADDRESS == to.toHexString()) {
    let userToken = getOrCreateUserToken(getListingId(from, address, tokenId));

    if (userToken.quantity.equals(quantity)) {
      store.remove("UserToken", userToken.id);
    } else {
      userToken.quantity = userToken.quantity.minus(quantity);
      userToken.save();
    }
  } else {
    let toUser = getOrCreateUser(to.toHexString());
    let userToken = getOrCreateUserToken(getListingId(to, address, tokenId));

    userToken.blockNumber = event.block.number;
    userToken.quantity = userToken.quantity.plus(quantity);
    userToken.token = token.id;
    userToken.user = toUser.id;

    toUser.save();
    userToken.save();
  }

  token.name = getName(tokenId);
  token.tokenId = tokenId;

  collection.save();
  token.save();
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

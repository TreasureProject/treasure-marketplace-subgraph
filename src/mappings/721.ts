import {
  JSONValue,
  JSONValueKind,
  ipfs,
  json,
  log,
} from "@graphprotocol/graph-ts";
import { ERC721, Transfer } from "../../generated/TreasureMarketplace/ERC721";
import {
  ONE_BI,
  getOrCreateCollection,
  getOrCreateMetadata,
  getOrCreateToken,
  getOrCreateUser,
  getOrCreateUserToken,
  getListingId,
  getTokenId,
} from "../helpers";

export function handleTransfer(event: Transfer): void {
  let params = event.params;
  let from = params.from;
  let to = params.to;
  let tokenId = params.tokenId;
  let address = event.address;

  let collection = getOrCreateCollection(address.toHexString());
  let token = getOrCreateToken(getTokenId(address, tokenId));
  let buyer = getOrCreateUser(to.toHexString());
  let userToken = getOrCreateUserToken(getListingId(to, address, tokenId));

  let contract = ERC721.bind(address);
  let uri = contract.try_tokenURI(tokenId);

  collection.address = address;
  collection.standard = "ERC721";

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

    token.metadataUri = `${uri.value}${tokenId}.json`;

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
    } else if (uri.value.includes("smolbrains")) {
      let metadata = getOrCreateMetadata(token.id);

      metadata.description = "Smol Brains";
      metadata.image = "/img/smolbrains.png";
      metadata.name = `Smol Brains #${tokenId.toString()}`;

      metadata.save();

      token.metadata = metadata.id;
    }
  }

  token.name = `Smol Brains #${tokenId.toString()}`;
  token.tokenId = tokenId;

  userToken.quantity = ONE_BI;
  userToken.token = token.id;
  userToken.user = buyer.id;

  collection.save();
  token.save();
  userToken.save();
  buyer.save();
}

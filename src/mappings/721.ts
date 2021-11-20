import { JSONValue, ipfs, json, log } from "@graphprotocol/graph-ts";
import { ERC721, Transfer } from "../../generated/TreasureMarketplace/ERC721";
import {
  IPFS_GATEWAY,
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
    let metadataUri = uri.value;

    token.metadataUri = metadataUri;

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

          let object = obj.toObject();
          let description = getString(object.get("description"));
          let image = getString(object.get("image"));
          let name = getString(object.get("name"));

          let metadata = getOrCreateMetadata(token.id);

          metadata.description = description;
          metadata.image = image;
          metadata.name = name;

          metadata.save();

          token.metadata = metadata.id;
          token.name = `${description} ${name}`;
        }
      }
    }
  }

  if (!token.name) {
    token.name = `${collection.name} #${tokenId.toString()}`;
  }

  token.tokenId = tokenId;

  userToken.quantity = ONE_BI;
  userToken.token = token.id;
  userToken.user = buyer.id;

  collection.save();
  token.save();
  userToken.save();
}

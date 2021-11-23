import { store } from "@graphprotocol/graph-ts";
import { Metadata } from "../../generated/schema";
import { ERC721, Transfer } from "../../generated/TreasureMarketplace/ERC721";
import {
  ONE_BI,
  ZERO_BI,
  getOrCreateCollection,
  getOrCreateToken,
  getOrCreateUser,
  getOrCreateUserToken,
  getListingId,
  getTokenId,
  addMetadataToToken,
  ZERO_ADDRESS,
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
    token.metadataUri = uri.value;

    addMetadataToToken(uri.value, token.id, tokenId);
  } else if (collection.name == "Smol Brains" && tokenId.equals(ZERO_BI)) {
    // This token was transferred on contract creation so there is no metadataUri yet
    let metadataUri =
      "https://treasure-marketplace.mypinata.cloud/ipfs/QmZg7bqH36fnKUcmKDhqGm65j5hbFeDZcogoxxiFMLeybE/0/0";

    addMetadataToToken(metadataUri, token.id, tokenId);

    token.metadataUri = metadataUri;
  }

  let metadata = Metadata.load(token.id);

  if (metadata) {
    token.name = `${metadata.description} ${metadata.name}`;
  } else {
    token.name = `${collection.name} ${`#${tokenId.toString()}`}`;
  }

  token.metadata = token.id;
  token.tokenId = tokenId;

  // Not a mint, remove it from the transferrer
  if (from.toHexString() != ZERO_ADDRESS) {
    store.remove("UserToken", getListingId(from, address, tokenId));
  }

  userToken.quantity = ONE_BI;
  userToken.token = token.id;
  userToken.user = buyer.id;

  collection.tokenIds = collection.tokenIds.concat([userToken.id]);

  collection.save();
  token.save();
  userToken.save();
  buyer.save();
}

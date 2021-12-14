import * as ERC721 from "./721";
import { Transfer } from "../../generated/TreasureMarketplace/ERC721";
import {
  ONE_BI,
  addMetadataToToken,
  checkForRarityUpdates,
  checkMissingMetadata,
  getCreator,
  getListingId,
  getOrCreateCollection,
  getOrCreateToken,
  getOrCreateUser,
  getOrCreateUserToken,
  getTokenId,
  isMint,
} from "../helpers";
import { Metadata } from "../../generated/schema";
import { SmolCarMint } from "../../generated/Smol Cars/SmolCars";

export function handleMint(event: SmolCarMint): void {
  let params = event.params;
  let to = params.to;
  let tokenId = params.tokenId;
  let address = event.address;

  let collection = getOrCreateCollection(address.toHexString());
  let token = getOrCreateToken(getTokenId(address, tokenId));
  let buyer = getOrCreateUser(to.toHexString());
  let userToken = getOrCreateUserToken(getListingId(to, address, tokenId));

  collection._tokenIds = collection._tokenIds.concat([tokenId.toString()]);
  collection.address = address;
  collection.creator = getCreator("SmolBrain").id;
  collection.name = "Smol Cars";
  collection.standard = "ERC721";
  collection.save();

  token.collection = collection.id;
  token.owner = buyer.id;
  token.tokenId = tokenId;
  token.metadata = token.id;
  token.metadataUri = params.tokenURI;

  collection.save();
  token.save();

  addMetadataToToken(token, event.block.number, collection);

  let metadata = Metadata.load(token.id);

  if (metadata) {
    token.name = metadata.name;
  } else {
    token.name = `${collection.name} ${`#${tokenId.toString()}`}`;
  }

  // Add missing metadata id to be tried again
  if (
    !metadata &&
    !collection._missingMetadataIds.includes(tokenId.toString())
  ) {
    collection._missingMetadataIds = collection._missingMetadataIds.concat([
      tokenId.toString(),
    ]);
  }

  userToken.quantity = ONE_BI;
  userToken.token = token.id;
  userToken.user = buyer.id;

  checkMissingMetadata(collection, event.block.number);
  checkForRarityUpdates(collection, token);

  collection.save();
  token.save();
  userToken.save();
  buyer.save();
}

export function handleTransfer(event: Transfer): void {
  // Mint handled by `handleMint`
  if (isMint(event.params.from)) {
    return;
  }

  let collection = getOrCreateCollection(event.address.toHexString());

  collection.creator = getCreator("SmolBrain").id;
  collection.name = "Smol Cars";
  collection.save();

  ERC721.handleTransfer(event);
}

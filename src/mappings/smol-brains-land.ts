import * as ERC721 from "./721";
import { Transfer } from "../../generated/TreasureMarketplace/ERC721";
import { getCreator, getOrCreateCollection } from "../helpers";

export function handleTransfer(event: Transfer): void {
  let collection = getOrCreateCollection(event.address.toHexString());

  collection.creator = getCreator("SmolBrain").id;
  collection.name = "Smol Brains Land";
  collection.save();

  ERC721.handleTransfer(event);
}

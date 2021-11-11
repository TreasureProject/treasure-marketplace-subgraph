import * as ERC721 from "./721";
import { Transfer } from "../../generated/TreasureMarketplace/ERC721";
import { getOrCreateCollection } from "../helpers";

export function handleTransfer(event: Transfer): void {
  let collection = getOrCreateCollection(event.address.toHexString());

  collection.name = "Smol Brains";

  collection.save();

  ERC721.handleTransfer(event);
}

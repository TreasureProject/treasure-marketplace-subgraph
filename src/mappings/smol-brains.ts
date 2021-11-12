import * as ERC721 from "./721";
import { store } from "@graphprotocol/graph-ts";
import { Transfer } from "../../generated/TreasureMarketplace/ERC721";
import { getOrCreateCollection } from "../helpers";

export function handleTransfer(event: Transfer): void {
  let collection = getOrCreateCollection(event.address.toHexString());

  collection.name = "Smol Brains";

  collection.save();

  store.remove("Collection", "");
  store.remove(
    "Listing",
    "0x362b122b187b54161fe958ba67ec6e2927488a27-0x7dd3703d160b061813ccc8a0780257e6a21065d5-0x0"
  );

  ERC721.handleTransfer(event);
}

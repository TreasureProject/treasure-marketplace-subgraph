import * as ERC721 from "./721";
import { log, store } from "@graphprotocol/graph-ts";
import {
  Transfer,
} from "../../generated/TreasureMarketplace/ERC721";
import { getOrCreateCollection } from "../helpers";

export function handleTransfer(event: Transfer): void {
  let collection = getOrCreateCollection(event.address.toHexString());

  collection.name = "Smol Brains";

  collection.save();

  // Remove old collection
  // store.remove("Collection", "0x8b97448fa2eb8dbe0e70280e3932bc3ac7256d25");

  ERC721.handleTransfer(event);
}


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
  store.remove("Collection", "0xe7ad64be25149d25b3a6ea9556e7d38ec2777b3f");
  store.remove("Collection", "");

  ERC721.handleTransfer(event);
}


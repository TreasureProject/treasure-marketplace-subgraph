import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import {
  ItemCanceled,
  ItemListed,
  ItemSold,
} from "../generated/TreasureMarketplace/TreasureMarketplace";
import {
  STAKING_ADDRESS,
  ZERO_ADDRESS,
  createMetadataAttribute,
  getAttributeId,
  getOrCreateAttribute,
  toBigDecimal,
} from "../src/helpers";
import { Transfer } from "../generated/TreasureMarketplace/ERC721";
import { TransferSingle } from "../generated/TreasureMarketplace/ERC1155";
import {
  assert,
  createMockedFunction,
  newMockEvent,
} from "matchstick-as/assembly";
import {
  handleItemCanceled,
  handleItemListed,
  handleItemSold,
} from "../src/mapping";
import { handleTransfer } from "../src/mappings/smol-brains";
import { handleTransferSingle } from "../src/mappings/treasures";

const SAFE_TRANSFER_FROM = Bytes.fromHexString("0xde250605") as Bytes;
const MARKETPLACE_BUY = Bytes.fromHexString("0xde250604") as Bytes;

let entities = 0;

class Entity {
  id: string;

  constructor(id: string = "") {
    this.id =
      id == "" ? `0x000000000000000000000000000000000000000${++entities}` : id;
  }

  get address(): Address {
    return Address.fromString(this.id);
  }
}

class Collection extends Entity {
  baseUri(tokenId: i32): string {
    return `ipfs://hash/${tokenId}`;
  }

  metadata(id: string, name: string, value: string): void {
    let attribute = getOrCreateAttribute(
      getAttributeId(this.address, name, value)
    );

    attribute.collection = id;
    attribute.name = name;
    attribute.value = value;

    attribute.save();

    createMetadataAttribute(attribute.id, id);
  }

  transfer(
    _tokenId: i32,
    _from: string,
    _to: string,
    _quantity?: i32,
    _method?: Bytes
  ): void {}
}

export class ERC1155 extends Collection {
  mint(tokenId: i32, quantity: i32, user: string): void {
    this.transfer(tokenId, ZERO_ADDRESS, user, quantity);
  }

  stake(tokenId: i32, quantity: i32, user: string): void {
    this.transfer(tokenId, user, STAKING_ADDRESS, quantity);
  }

  transfer(
    tokenId: i32,
    from: string,
    to: string,
    quantity: i32,
    method: Bytes = SAFE_TRANSFER_FROM
  ): void {
    createMockedFunction(this.address, "uri", "uri(uint256):(string)")
      // @ts-expect-error
      .withArgs([ethereum.Value.fromI32(tokenId)])
      // @ts-expect-error
      .returns([ethereum.Value.fromString(this.baseUri(tokenId))]);

    let transferEvent = changetype<TransferSingle>(newMockEvent());

    transferEvent.address = this.address;
    transferEvent.parameters = new Array();
    transferEvent.transaction.from = Address.fromString(from);
    transferEvent.transaction.input = method;

    transferEvent.parameters.push(
      new ethereum.EventParam(
        "operator",
        ethereum.Value.fromAddress(Address.zero())
      )
    );

    transferEvent.parameters.push(
      new ethereum.EventParam(
        "from",
        ethereum.Value.fromAddress(Address.fromString(from))
      )
    );

    transferEvent.parameters.push(
      new ethereum.EventParam(
        "to",
        ethereum.Value.fromAddress(Address.fromString(to))
      )
    );

    transferEvent.parameters.push(
      new ethereum.EventParam("id", ethereum.Value.fromI32(tokenId))
    );

    transferEvent.parameters.push(
      new ethereum.EventParam("value", ethereum.Value.fromI32(quantity))
    );

    handleTransferSingle(transferEvent);
  }

  unstake(tokenId: i32, quantity: i32, user: string): void {
    this.transfer(tokenId, STAKING_ADDRESS, user, quantity);
  }
}

export class ERC721 extends Collection {
  mint(tokenId: i32, user: string): void {
    this.transfer(tokenId, ZERO_ADDRESS, user);
  }

  transfer(
    tokenId: i32,
    from: string,
    to: string,
    _quantity: i32 = 1,
    method: Bytes = SAFE_TRANSFER_FROM
  ): void {
    createMockedFunction(this.address, "tokenURI", "tokenURI(uint256):(string)")
      // @ts-expect-error
      .withArgs([ethereum.Value.fromI32(tokenId)])
      // @ts-expect-error
      .returns([ethereum.Value.fromString(this.baseUri(tokenId))]);

    let transferEvent = changetype<Transfer>(newMockEvent());

    transferEvent.address = this.address;
    transferEvent.parameters = new Array();
    transferEvent.transaction.from = Address.fromString(from);
    transferEvent.transaction.input = method;

    transferEvent.parameters.push(
      new ethereum.EventParam(
        "from",
        ethereum.Value.fromAddress(Address.fromString(from))
      )
    );

    transferEvent.parameters.push(
      new ethereum.EventParam(
        "to",
        ethereum.Value.fromAddress(Address.fromString(to))
      )
    );

    transferEvent.parameters.push(
      new ethereum.EventParam("tokenId", ethereum.Value.fromI32(tokenId))
    );

    handleTransfer(transferEvent);
  }
}

export class Marketplace extends Entity {
  private _from: string;
  private _to: string;
  private _collection: Collection;

  constructor(from: User, to: User, collection: Collection) {
    super(collection.id);

    this._collection = collection;
    this._from = from.id;
    this._to = to.id;
  }

  get from(): Address {
    return Address.fromString(this._from);
  }

  get to(): Address {
    return Address.fromString(this._to);
  }

  buy(tokenId: i32, quantity: i32 = 1): void {
    let soldEvent = changetype<ItemSold>(newMockEvent());

    soldEvent.parameters = new Array();
    soldEvent.transaction.from = this.from;

    soldEvent.parameters.push(
      new ethereum.EventParam("seller", ethereum.Value.fromAddress(this.from))
    );

    soldEvent.parameters.push(
      new ethereum.EventParam("buyer", ethereum.Value.fromAddress(this.to))
    );

    soldEvent.parameters.push(
      new ethereum.EventParam(
        "nftAddress",
        ethereum.Value.fromAddress(this.address)
      )
    );

    soldEvent.parameters.push(
      new ethereum.EventParam("tokenId", ethereum.Value.fromI32(tokenId))
    );

    soldEvent.parameters.push(
      new ethereum.EventParam("quantity", ethereum.Value.fromI32(quantity))
    );

    soldEvent.parameters.push(
      new ethereum.EventParam(
        "pricePerItem",
        ethereum.Value.fromSignedBigInt(
          BigInt.fromI32(1).times(
            BigInt.fromString(toBigDecimal(1e18).toString())
          )
        )
      )
    );

    handleItemSold(soldEvent);

    this._collection.transfer(
      tokenId,
      this._from,
      this._to,
      quantity,
      MARKETPLACE_BUY
    );
  }

  cancel(tokenId: i32): void {
    let cancelEvent = changetype<ItemCanceled>(newMockEvent());

    cancelEvent.parameters = new Array();
    cancelEvent.transaction.from = this.from;

    cancelEvent.parameters.push(
      new ethereum.EventParam("seller", ethereum.Value.fromAddress(this.from))
    );

    cancelEvent.parameters.push(
      new ethereum.EventParam(
        "nftAddress",
        ethereum.Value.fromAddress(this.address)
      )
    );

    cancelEvent.parameters.push(
      new ethereum.EventParam("tokenId", ethereum.Value.fromI32(tokenId))
    );

    handleItemCanceled(cancelEvent);
  }

  list(tokenId: i32, quantity: i32 = 1): void {
    let listEvent = changetype<ItemListed>(newMockEvent());

    listEvent.parameters = new Array();
    listEvent.transaction.from = this.from;

    listEvent.parameters.push(
      new ethereum.EventParam("seller", ethereum.Value.fromAddress(this.from))
    );

    listEvent.parameters.push(
      new ethereum.EventParam(
        "nftAddress",
        ethereum.Value.fromAddress(this.address)
      )
    );

    listEvent.parameters.push(
      new ethereum.EventParam("tokenId", ethereum.Value.fromI32(tokenId))
    );

    listEvent.parameters.push(
      new ethereum.EventParam("quantity", ethereum.Value.fromI32(quantity))
    );

    listEvent.parameters.push(
      new ethereum.EventParam(
        "pricePerItem",
        ethereum.Value.fromSignedBigInt(
          BigInt.fromI32(1).times(
            BigInt.fromString(toBigDecimal(1e18).toString())
          )
        )
      )
    );

    listEvent.parameters.push(
      new ethereum.EventParam("expirationTime", ethereum.Value.fromI32(0))
    );

    handleItemListed(listEvent);
  }
}

export class User extends Entity {}

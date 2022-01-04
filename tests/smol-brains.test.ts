import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { DropSchool, JoinSchool } from "../generated/Smol Brains School/School";
import {
  ItemCanceled,
  ItemListed,
} from "../generated/TreasureMarketplace/TreasureMarketplace";
import {
  SMOLBRAIN_ADDRESS,
  ZERO_ADDRESS,
  createMetadataAttribute,
  getAttributeId,
  getOrCreateAttribute,
  getListingId,
  getTokenId,
  toBigDecimal,
} from "../src/helpers";
import { Transfer } from "../generated/TreasureMarketplace/ERC721";
import {
  assert,
  clearStore,
  createMockedFunction,
  newMockEvent,
  test,
} from "matchstick-as/assembly";
import {
  handleDropSchool,
  handleJoinSchool,
  handleTransfer,
} from "../src/mappings/smol-brains";
import { handleItemCanceled, handleItemListed } from "../src/mapping";

const FROM = "0x0000000000000000000000000000000000000001";

const ADDRESS = Address.fromString(SMOLBRAIN_ADDRESS);

function cancel(tokenId: i32): void {
  let cancelEvent = changetype<ItemCanceled>(newMockEvent());

  cancelEvent.parameters = new Array();
  cancelEvent.transaction.from = Address.fromString(FROM);

  cancelEvent.parameters.push(
    new ethereum.EventParam(
      "seller",
      ethereum.Value.fromAddress(Address.fromString(FROM))
    )
  );

  cancelEvent.parameters.push(
    new ethereum.EventParam("nftAddress", ethereum.Value.fromAddress(ADDRESS))
  );

  cancelEvent.parameters.push(
    new ethereum.EventParam("tokenId", ethereum.Value.fromI32(tokenId))
  );

  handleItemCanceled(cancelEvent);
}

function drop(tokenId: i32, iq: i32 = 0): void {
  let iqBi = BigInt.fromI32(305).times(
    BigInt.fromString(toBigDecimal(1e18).toString())
  );

  createMockedFunction(ADDRESS, "brainz", "brainz(uint256):(uint256)")
    // @ts-expect-error
    .withArgs([ethereum.Value.fromI32(tokenId)])
    // @ts-expect-error
    .returns([ethereum.Value.fromSignedBigInt(iqBi)]);

  let dropEvent = changetype<DropSchool>(newMockEvent());

  dropEvent.parameters = new Array();
  dropEvent.transaction.from = Address.fromString(FROM);

  dropEvent.parameters.push(
    new ethereum.EventParam("tokenId", ethereum.Value.fromI32(tokenId))
  );

  handleDropSchool(dropEvent);
}

function join(tokenId: i32): void {
  let joinEvent = changetype<JoinSchool>(newMockEvent());

  joinEvent.parameters = new Array();
  joinEvent.transaction.from = Address.fromString(FROM);

  joinEvent.parameters.push(
    new ethereum.EventParam("tokenId", ethereum.Value.fromI32(tokenId))
  );

  handleJoinSchool(joinEvent);
}

function list(tokenId: i32): void {
  let listEvent = changetype<ItemListed>(newMockEvent());

  listEvent.parameters = new Array();
  listEvent.transaction.from = Address.fromString(FROM);

  listEvent.parameters.push(
    new ethereum.EventParam(
      "seller",
      ethereum.Value.fromAddress(Address.fromString(FROM))
    )
  );

  listEvent.parameters.push(
    new ethereum.EventParam("nftAddress", ethereum.Value.fromAddress(ADDRESS))
  );

  listEvent.parameters.push(
    new ethereum.EventParam("tokenId", ethereum.Value.fromI32(tokenId))
  );

  listEvent.parameters.push(
    new ethereum.EventParam("quantity", ethereum.Value.fromI32(1))
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

function mint(tokenId: i32): void {
  createMockedFunction(ADDRESS, "tokenURI", "tokenURI(uint256):(string)")
    // @ts-expect-error
    .withArgs([ethereum.Value.fromI32(0)])
    // @ts-expect-error
    .returns([ethereum.Value.fromString("ipfs://smolbrains/0")]);

  let transferEvent = changetype<Transfer>(newMockEvent());

  transferEvent.address = ADDRESS;
  transferEvent.parameters = new Array();
  transferEvent.transaction.from = Address.fromString(ZERO_ADDRESS);

  transferEvent.parameters.push(
    new ethereum.EventParam(
      "from",
      ethereum.Value.fromAddress(Address.fromString(ZERO_ADDRESS))
    )
  );

  transferEvent.parameters.push(
    new ethereum.EventParam(
      "to",
      ethereum.Value.fromAddress(Address.fromString(FROM))
    )
  );

  transferEvent.parameters.push(
    new ethereum.EventParam("tokenId", ethereum.Value.fromI32(tokenId))
  );

  handleTransfer(transferEvent);
}

function metadata(id: string, name: string, value: string): void {
  let attribute = getOrCreateAttribute(getAttributeId(ADDRESS, name, value));

  attribute.collection = SMOLBRAIN_ADDRESS;
  attribute.name = name;
  attribute.value = value;

  attribute.save();

  createMetadataAttribute(attribute.id, id);
}

test("max headsize is 5", () => {
  let id = getTokenId(ADDRESS, BigInt.fromI32(0));

  mint(0);
  metadata(id, "Head Size", "0");
  join(0);
  drop(0, 305);

  // let iq = BigInt.fromI32(305).times(
  //   BigInt.fromString(toBigDecimal(1e18).toString())
  // );

  // createMockedFunction(ADDRESS, "brainz", "brainz(uint256):(uint256)")
  //   // @ts-expect-error
  //   .withArgs([ethereum.Value.fromI32(0)])
  //   // @ts-expect-error
  //   .returns([ethereum.Value.fromSignedBigInt(iq)]);

  // let dropSchoolEvent = changetype<DropSchool>(newMockEvent());

  // dropSchoolEvent.parameters = new Array();
  // dropSchoolEvent.transaction.from = Address.fromString(FROM);

  // dropSchoolEvent.parameters.push(
  //   new ethereum.EventParam("tokenId", ethereum.Value.fromI32(0))
  // );

  // handleDropSchool(dropSchoolEvent);

  assert.fieldEquals(
    "Attribute",
    getAttributeId(ADDRESS, "Head Size", "5"),
    "value",
    "5"
  );
  assert.fieldEquals("Token", id, "metadataUri", "ipfs://smolbrains/5");

  clearStore();
});

test("staked smol is not in inventory after cancelling hidden listing", () => {
  let id = getListingId(Address.fromString(FROM), ADDRESS, BigInt.fromI32(0));

  mint(0);
  list(0);
  join(0);
  cancel(0);

  assert.fieldEquals("Student", id, "id", id);
  assert.notInStore("Listing", id);
  assert.notInStore("UserToken", id);

  drop(0);

  assert.notInStore("Student", id);
  assert.fieldEquals("UserToken", id, "id", id);

  clearStore();
});

test("staked smol listing is active after unstake, hidden while staked", () => {
  let id = getListingId(Address.fromString(FROM), ADDRESS, BigInt.fromI32(0));

  mint(0);
  list(0);

  assert.fieldEquals("Listing", id, "status", "Active");

  join(0);

  assert.fieldEquals("Listing", id, "status", "Hidden");

  drop(0);

  assert.fieldEquals("Listing", id, "status", "Active");

  clearStore();
});

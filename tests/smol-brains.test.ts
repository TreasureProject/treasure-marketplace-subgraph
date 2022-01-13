import { BigInt, ethereum } from "@graphprotocol/graph-ts";
import { ERC721, Marketplace, User } from "./utils";
import { DropSchool, JoinSchool } from "../generated/Smol Brains School/School";
import {
  SMOLBRAIN_ADDRESS,
  getAttributeId,
  getListingId,
  getTokenId,
  toBigDecimal,
} from "../src/helpers";
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
} from "../src/mappings/smol-brains";

class Smolbrain extends ERC721 {
  // Not really the tokenId, but this should work for head size
  baseUri(headSize: i32): string {
    return `ipfs://hash/0/${headSize}`;
  }

  stake(tokenId: i32): void {
    let joinEvent = changetype<JoinSchool>(newMockEvent());

    joinEvent.parameters = new Array();
    joinEvent.transaction.from = me.address;

    joinEvent.parameters.push(
      new ethereum.EventParam("tokenId", ethereum.Value.fromI32(tokenId))
    );

    handleJoinSchool(joinEvent);
  }

  unstake(tokenId: i32, iq: i32 = 0): void {
    let iqBi = BigInt.fromI32(iq).times(
      BigInt.fromString(toBigDecimal(1e18).toString())
    );

    createMockedFunction(
      smolbrain.address,
      "brainz",
      "brainz(uint256):(uint256)"
    )
      // @ts-expect-error
      .withArgs([ethereum.Value.fromI32(tokenId)])
      // @ts-expect-error
      .returns([ethereum.Value.fromSignedBigInt(iqBi)]);

    let dropEvent = changetype<DropSchool>(newMockEvent());

    dropEvent.parameters = new Array();
    dropEvent.transaction.from = me.address;

    dropEvent.parameters.push(
      new ethereum.EventParam("tokenId", ethereum.Value.fromI32(tokenId))
    );

    handleDropSchool(dropEvent);
  }
}

const smolbrain = new Smolbrain(SMOLBRAIN_ADDRESS);

const me = new User();
const you = new User();
const friend = new User();

const mp = new Marketplace(me, you, smolbrain);

test("max headsize is 5", () => {
  clearStore();

  let id = getTokenId(smolbrain.address, BigInt.fromI32(0));

  smolbrain.mint(0, me.id);
  smolbrain.metadata(id, "Head Size", "0");
  smolbrain.stake(0);
  smolbrain.unstake(0, 305);

  assert.fieldEquals(
    "Attribute",
    getAttributeId(smolbrain.address, "Head Size", "5"),
    "value",
    "5"
  );
  assert.fieldEquals("Token", id, "metadataUri", "ipfs://hash/0/5");
});

test("staked smol is not in inventory after cancelling hidden listing", () => {
  clearStore();

  let id = getListingId(me.address, smolbrain.address, BigInt.fromI32(0));

  smolbrain.mint(0, me.id);
  mp.list(0);
  smolbrain.stake(0);
  mp.cancel(0);

  assert.fieldEquals("Student", id, "id", id);
  assert.notInStore("Listing", id);
  assert.notInStore("UserToken", id);

  smolbrain.unstake(0);

  assert.notInStore("Student", id);
  assert.fieldEquals("UserToken", id, "id", id);
});

test("staked smol listing is active after unstake, hidden while staked", () => {
  clearStore();

  let id = getListingId(me.address, smolbrain.address, BigInt.fromI32(0));

  smolbrain.mint(0, me.id);
  mp.list(0);

  assert.fieldEquals("Listing", id, "status", "Active");

  smolbrain.stake(0);

  assert.fieldEquals("Listing", id, "status", "Hidden");

  smolbrain.unstake(0);

  assert.fieldEquals("Listing", id, "status", "Active");
});

test("owners is calculated correctly for transfers", () => {
  clearStore();

  smolbrain.mint(0, me.id);
  smolbrain.mint(1, me.id);

  assert.fieldEquals("Collection", smolbrain.id, "totalOwners", "1");

  smolbrain.mint(2, you.id);

  assert.fieldEquals("Collection", smolbrain.id, "totalOwners", "2");

  smolbrain.transfer(0, me.id, friend.id);

  assert.fieldEquals("Collection", smolbrain.id, "totalOwners", "3");
});

test("owners is calculated correctly for marketplace buy", () => {
  clearStore();

  smolbrain.mint(0, me.id);
  smolbrain.mint(1, me.id);

  assert.fieldEquals("Collection", smolbrain.id, "totalOwners", "1");

  mp.list(0);
  mp.buy(0);

  assert.fieldEquals("Collection", smolbrain.id, "totalOwners", "2");

  mp.list(1);
  mp.buy(1);

  assert.fieldEquals("Collection", smolbrain.id, "totalOwners", "1");

  smolbrain.mint(2, me.id);
  smolbrain.mint(3, friend.id);

  assert.fieldEquals("Collection", smolbrain.id, "totalOwners", "3");
});

test("items are calculated correctly", () => {
  clearStore();

  smolbrain.mint(0, me.id);
  smolbrain.mint(1, me.id);

  assert.fieldEquals("Collection", smolbrain.id, "totalItems", "2");

  smolbrain.mint(2, you.id);

  assert.fieldEquals("Collection", smolbrain.id, "totalItems", "3");

  smolbrain.transfer(0, me.id, friend.id);

  assert.fieldEquals("Collection", smolbrain.id, "totalItems", "3");

  const cars = new ERC721();

  cars.mint(0, me.id);

  assert.fieldEquals("Collection", cars.id, "totalItems", "1");
  assert.fieldEquals("Collection", smolbrain.id, "totalItems", "3");
});

test("listings are calculated correctly", () => {
  clearStore();

  smolbrain.mint(0, me.id);
  smolbrain.mint(1, me.id);

  assert.fieldEquals("Collection", smolbrain.id, "totalListings", "0");

  mp.list(1);

  assert.fieldEquals("Collection", smolbrain.id, "totalListings", "1");
  assert.fieldEquals(
    "Listing",
    `${me.id}-${smolbrain.id}-0x1`,
    "quantity",
    "1"
  );

  mp.list(0);

  assert.fieldEquals("Collection", smolbrain.id, "totalListings", "2");
  assert.fieldEquals(
    "Listing",
    `${me.id}-${smolbrain.id}-0x0`,
    "quantity",
    "1"
  );
  assert.fieldEquals(
    "Listing",
    `${me.id}-${smolbrain.id}-0x1`,
    "quantity",
    "1"
  );

  mp.buy(0);

  assert.fieldEquals("Collection", smolbrain.id, "totalListings", "1");
  assert.fieldEquals(
    "Listing",
    `${me.id}-${smolbrain.id}-0x1`,
    "quantity",
    "1"
  );
  assert.notInStore("Listing", `${me.id}-${smolbrain.id}-0x0`);
});

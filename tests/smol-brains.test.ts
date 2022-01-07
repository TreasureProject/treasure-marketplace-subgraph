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
}

const smolbrain = new Smolbrain(SMOLBRAIN_ADDRESS);

const me = new User();
const you = new User();
const friend = new User();

const mp = new Marketplace(me, you, smolbrain);

function drop(tokenId: i32, iq: i32 = 0): void {
  let iqBi = BigInt.fromI32(iq).times(
    BigInt.fromString(toBigDecimal(1e18).toString())
  );

  createMockedFunction(smolbrain.address, "brainz", "brainz(uint256):(uint256)")
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

function join(tokenId: i32): void {
  let joinEvent = changetype<JoinSchool>(newMockEvent());

  joinEvent.parameters = new Array();
  joinEvent.transaction.from = me.address;

  joinEvent.parameters.push(
    new ethereum.EventParam("tokenId", ethereum.Value.fromI32(tokenId))
  );

  handleJoinSchool(joinEvent);
}

test("max headsize is 5", () => {
  let id = getTokenId(smolbrain.address, BigInt.fromI32(0));

  smolbrain.mint(0, me.id);
  smolbrain.metadata(id, "Head Size", "0");
  join(0);
  drop(0, 305);

  assert.fieldEquals(
    "Attribute",
    getAttributeId(smolbrain.address, "Head Size", "5"),
    "value",
    "5"
  );
  assert.fieldEquals("Token", id, "metadataUri", "ipfs://hash/0/5");

  clearStore();
});

test("staked smol is not in inventory after cancelling hidden listing", () => {
  let id = getListingId(me.address, smolbrain.address, BigInt.fromI32(0));

  smolbrain.mint(0, me.id);
  mp.list(0);
  join(0);
  mp.cancel(0);

  assert.fieldEquals("Student", id, "id", id);
  assert.notInStore("Listing", id);
  assert.notInStore("UserToken", id);

  drop(0);

  assert.notInStore("Student", id);
  assert.fieldEquals("UserToken", id, "id", id);

  clearStore();
});

test("staked smol listing is active after unstake, hidden while staked", () => {
  let id = getListingId(me.address, smolbrain.address, BigInt.fromI32(0));

  smolbrain.mint(0, me.id);
  mp.list(0);

  assert.fieldEquals("Listing", id, "status", "Active");

  join(0);

  assert.fieldEquals("Listing", id, "status", "Hidden");

  drop(0);

  assert.fieldEquals("Listing", id, "status", "Active");

  clearStore();
});

test("owners is calculated correctly for transfers", () => {
  smolbrain.mint(0, me.id);
  smolbrain.mint(1, me.id);

  assert.fieldEquals("Collection", smolbrain.id, "totalOwners", "1");

  smolbrain.mint(2, you.id);

  assert.fieldEquals("Collection", smolbrain.id, "totalOwners", "2");

  smolbrain.transfer(0, me.id, friend.id);

  assert.fieldEquals("Collection", smolbrain.id, "totalOwners", "3");

  clearStore();
});

test("owners is calculated correctly for marketplace buy", () => {
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

  clearStore();
});

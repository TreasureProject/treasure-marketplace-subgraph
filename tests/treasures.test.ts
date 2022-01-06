import { assert, clearStore, test } from "matchstick-as/assembly";
import { ERC1155, Marketplace, User } from "./utils";

const treasure = new ERC1155();

const me = new User();
const you = new User();
const friend = new User();

const mp = new Marketplace(me, you, treasure);

test("owners is calculated correctly with transfers", () => {
  treasure.mint(0, 2, me.id);
  treasure.mint(1, 1, me.id);

  assert.fieldEquals("Collection", treasure.id, "totalOwners", "1");

  treasure.mint(2, 1, you.id);

  assert.fieldEquals("Collection", treasure.id, "totalOwners", "2");

  // Only send 1 of the 2
  treasure.transfer(0, me.id, friend.id, 1);

  assert.fieldEquals("Collection", treasure.id, "totalOwners", "3");

  // Now send the last one from me to you
  treasure.transfer(0, me.id, you.id, 1);

  assert.fieldEquals("Collection", treasure.id, "totalOwners", "3");

  // Now send token 1 away from me to friend.
  treasure.transfer(1, me.id, friend.id, 1);

  assert.fieldEquals("Collection", treasure.id, "totalOwners", "2");

  clearStore();
});

test("owners is calculated correctly with marketplace buy", () => {
  treasure.mint(0, 2, me.id);

  assert.fieldEquals("Collection", treasure.id, "totalOwners", "1");

  mp.list(0, 2);
  mp.buy(0, 1);

  assert.fieldEquals("Collection", treasure.id, "totalOwners", "2");

  mp.buy(0, 1);

  assert.fieldEquals("Collection", treasure.id, "totalOwners", "1");

  clearStore();
});

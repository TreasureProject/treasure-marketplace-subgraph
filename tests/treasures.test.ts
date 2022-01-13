import { assert, clearStore, logStore, test } from "matchstick-as/assembly";
import { ERC1155, Marketplace, User } from "./utils";

const treasure = new ERC1155();

const me = new User("0x0000000000000000000000000000000000000022");
const you = new User("0x0000000000000000000000000000000000000333");
const friend = new User();

const mp = new Marketplace(me, you, treasure);

test("listings are calculated correctly", () => {
  clearStore();

  treasure.mint(0, 3, me.id);
  treasure.mint(1, 1, me.id);

  assert.fieldEquals("Collection", treasure.id, "totalListings", "0");

  mp.list(1);

  assert.fieldEquals("Collection", treasure.id, "totalListings", "1");
  assert.fieldEquals("Listing", `${me.id}-${treasure.id}-0x1`, "quantity", "1");

  mp.list(0, 3);

  assert.fieldEquals("Collection", treasure.id, "totalListings", "4");
  assert.fieldEquals("Listing", `${me.id}-${treasure.id}-0x0`, "quantity", "3");
  assert.fieldEquals("Listing", `${me.id}-${treasure.id}-0x1`, "quantity", "1");

  mp.cancel(1);

  assert.fieldEquals("Collection", treasure.id, "totalListings", "3");
  assert.fieldEquals("Listing", `${me.id}-${treasure.id}-0x0`, "quantity", "3");
  assert.notInStore("Listing", `${me.id}-${treasure.id}-0x1`);

  mp.buy(0);

  assert.fieldEquals("Collection", treasure.id, "totalListings", "2");
  assert.fieldEquals("Listing", `${me.id}-${treasure.id}-0x0`, "quantity", "2");
});

test("items are calculated correctly", () => {
  clearStore();

  treasure.mint(0, 2, me.id);
  treasure.mint(1, 1, me.id);

  assert.fieldEquals("Collection", treasure.id, "totalItems", "3");
  assert.fieldEquals("Token", `${treasure.id}-0x0`, "totalItems", "2");
  assert.fieldEquals("Token", `${treasure.id}-0x1`, "totalItems", "1");

  treasure.mint(2, 1, you.id);

  assert.fieldEquals("Collection", treasure.id, "totalItems", "4");
  assert.fieldEquals("Token", `${treasure.id}-0x0`, "totalItems", "2");
  assert.fieldEquals("Token", `${treasure.id}-0x1`, "totalItems", "1");
  assert.fieldEquals("Token", `${treasure.id}-0x2`, "totalItems", "1");

  // Only send 1 of the 2
  treasure.transfer(0, me.id, friend.id, 1);

  assert.fieldEquals("Collection", treasure.id, "totalItems", "4");
  assert.fieldEquals("Token", `${treasure.id}-0x0`, "totalItems", "2");
  assert.fieldEquals("Token", `${treasure.id}-0x1`, "totalItems", "1");
  assert.fieldEquals("Token", `${treasure.id}-0x2`, "totalItems", "1");
});

test("owners is calculated correctly with transfers", () => {
  clearStore();

  treasure.mint(0, 2, me.id);
  treasure.mint(1, 1, me.id);

  assert.fieldEquals("Collection", treasure.id, "totalOwners", "1");
  assert.fieldEquals("Token", `${treasure.id}-0x0`, "totalOwners", "1");
  assert.fieldEquals("Token", `${treasure.id}-0x1`, "totalOwners", "1");

  treasure.mint(2, 1, you.id);

  assert.fieldEquals("Collection", treasure.id, "totalOwners", "2");
  assert.fieldEquals("Token", `${treasure.id}-0x0`, "totalOwners", "1");
  assert.fieldEquals("Token", `${treasure.id}-0x1`, "totalOwners", "1");
  assert.fieldEquals("Token", `${treasure.id}-0x2`, "totalOwners", "1");

  // Only send 1 of the 2
  treasure.transfer(0, me.id, friend.id, 1);

  assert.fieldEquals("Collection", treasure.id, "totalOwners", "3");
  assert.fieldEquals("Token", `${treasure.id}-0x0`, "totalOwners", "2");
  assert.fieldEquals("Token", `${treasure.id}-0x1`, "totalOwners", "1");
  assert.fieldEquals("Token", `${treasure.id}-0x2`, "totalOwners", "1");

  // Now send the last one from me to you
  treasure.transfer(0, me.id, you.id, 1);

  assert.fieldEquals("Collection", treasure.id, "totalOwners", "3");
  assert.fieldEquals("Token", `${treasure.id}-0x0`, "totalOwners", "2");
  assert.fieldEquals("Token", `${treasure.id}-0x1`, "totalOwners", "1");
  assert.fieldEquals("Token", `${treasure.id}-0x2`, "totalOwners", "1");

  // Now send token 1 away from me to friend.
  treasure.transfer(1, me.id, friend.id, 1);

  assert.fieldEquals("Collection", treasure.id, "totalOwners", "2");
  assert.fieldEquals("Token", `${treasure.id}-0x0`, "totalOwners", "2");
  assert.fieldEquals("Token", `${treasure.id}-0x1`, "totalOwners", "1");
  assert.fieldEquals("Token", `${treasure.id}-0x2`, "totalOwners", "1");

  treasure.transfer(0, you.id, friend.id, 1);

  assert.fieldEquals("Collection", treasure.id, "totalOwners", "2");
  assert.fieldEquals("Token", `${treasure.id}-0x0`, "totalOwners", "1");
  assert.fieldEquals("Token", `${treasure.id}-0x1`, "totalOwners", "1");
  assert.fieldEquals("Token", `${treasure.id}-0x2`, "totalOwners", "1");
});

test("owners is calculated correctly with marketplace buy", () => {
  clearStore();

  treasure.mint(0, 2, me.id);

  assert.fieldEquals("Collection", treasure.id, "totalOwners", "1");
  assert.fieldEquals("Token", `${treasure.id}-0x0`, "totalOwners", "1");

  mp.list(0, 2);
  mp.buy(0, 1);

  assert.fieldEquals("Collection", treasure.id, "totalOwners", "2");
  assert.fieldEquals("Token", `${treasure.id}-0x0`, "totalOwners", "2");

  mp.buy(0, 1);

  assert.fieldEquals("Collection", treasure.id, "totalOwners", "1");
  assert.fieldEquals("Token", `${treasure.id}-0x0`, "totalOwners", "1");
});

test("mint 2 -> stake 1 -> list 1 -> stake 1 -> unstake 2", () => {
  clearStore();

  treasure.mint(0, 2, me.id);
  treasure.stake(0, 1, me.id);
  mp.list(0);

  let id = `${me.id}-${treasure.id}-0x0`;

  assert.fieldEquals("Listing", id, "quantity", "1");
  assert.notInStore("UserToken", id);

  // Now, we will stake our listed quantity
  treasure.stake(0, 1, me.id);

  assert.fieldEquals("Collection", treasure.id, "totalItems", "2");
  assert.fieldEquals("Collection", treasure.id, "totalListings", "0");
  assert.fieldEquals("Collection", treasure.id, "totalOwners", "1");
  assert.fieldEquals("Listing", id, "status", "Hidden");
  assert.fieldEquals("Listing", id, "quantity", "1");
  assert.notInStore("UserToken", id);

  // Unstake both
  treasure.unstake(0, 2, me.id);

  assert.fieldEquals("Collection", treasure.id, "totalItems", "2");
  assert.fieldEquals("Collection", treasure.id, "totalListings", "1");
  assert.fieldEquals("Listing", id, "status", "Active");
  assert.fieldEquals("Listing", id, "quantity", "1");
  assert.fieldEquals("UserToken", id, "quantity", "1");
});

test("mint 3 -> stake 1 -> list 2 -> stake 1 listed -> unstake 1 -> unstake 1", () => {
  clearStore();

  treasure.mint(0, 3, me.id);
  treasure.stake(0, 1, me.id);
  mp.list(0, 2);

  let id = `${me.id}-${treasure.id}-0x0`;

  assert.fieldEquals("Listing", id, "quantity", "2");
  assert.notInStore("UserToken", id);

  // Now, stake one of our listed
  treasure.stake(0, 1, me.id);

  assert.fieldEquals("Collection", treasure.id, "totalItems", "3");
  assert.fieldEquals("Collection", treasure.id, "totalListings", "1");
  assert.fieldEquals("Collection", treasure.id, "totalOwners", "1");
  assert.fieldEquals("Listing", id, "status", "Active");
  assert.fieldEquals("Listing", id, "quantity", "1");
  assert.notInStore("UserToken", id);

  // Unstake one
  treasure.unstake(0, 1, me.id);

  assert.fieldEquals("Collection", treasure.id, "totalListings", "2");
  assert.fieldEquals("Listing", id, "status", "Active");
  assert.fieldEquals("Listing", id, "quantity", "2");
  assert.notInStore("UserToken", id);

  // Unstake last one
  treasure.unstake(0, 1, me.id);

  assert.fieldEquals("Collection", treasure.id, "totalListings", "2");
  assert.fieldEquals("Listing", id, "status", "Active");
  assert.fieldEquals("Listing", id, "quantity", "2");
  assert.fieldEquals("UserToken", id, "quantity", "1");
});

test("mint 1 -> list 1 -> stake 1 -> buy 2 -> unstake 1", () => {
  clearStore();

  treasure.mint(0, 2, me.id);
  treasure.mint(0, 1, you.id);

  // List one as `you`
  const mp2 = new Marketplace(you, me, treasure);

  mp2.list(0);
  treasure.stake(0, 1, you.id);

  let id = `${you.id}-${treasure.id}-0x0`;

  assert.fieldEquals("Collection", treasure.id, "totalOwners", "2");
  assert.fieldEquals("Listing", id, "status", "Hidden");
  assert.fieldEquals("Listing", id, "quantity", "1");
  assert.notInStore("UserToken", id);

  // Now, buy 2 from me
  mp.list(0, 2);
  mp.buy(0, 2);

  assert.fieldEquals("Collection", treasure.id, "totalListings", "0");
  assert.fieldEquals("Collection", treasure.id, "totalOwners", "1");
  assert.fieldEquals("UserToken", id, "quantity", "2");
  assert.fieldEquals("Listing", id, "status", "Hidden");
  assert.fieldEquals("Listing", id, "quantity", "1");
  assert.notInStore("Listing", `${me.id}-${treasure.id}-0x0`);

  // Unstake one
  treasure.unstake(0, 1, you.id);

  assert.fieldEquals("Collection", treasure.id, "totalListings", "1");
  assert.fieldEquals("Collection", treasure.id, "totalOwners", "1");
  assert.fieldEquals("UserToken", id, "quantity", "2");
  assert.fieldEquals("Listing", id, "status", "Active");
  assert.fieldEquals("Listing", id, "quantity", "1");

  mp2.cancel(0);

  assert.fieldEquals("Collection", treasure.id, "totalListings", "0");
  assert.fieldEquals("Collection", treasure.id, "totalOwners", "1");
  assert.fieldEquals("UserToken", id, "quantity", "3");
  assert.notInStore("Listing", id);
});

test("buy 3 -> stake 3 -> buy 1 -> stake 1 -> unstake 2 -> list 2 -> stake 2 -> unstake 2", () => {
  clearStore();

  treasure.mint(0, 5, me.id);

  // Buy 3
  mp.list(0, 3);
  mp.buy(0, 3);

  // Stake 3
  treasure.stake(0, 3, you.id);

  // Buy 1
  mp.list(0);
  mp.buy(0);

  // Stake 1
  treasure.stake(0, 1, you.id);

  // Unstake 2
  treasure.unstake(0, 2, you.id);

  // List 2
  const mp2 = new Marketplace(you, me, treasure);

  mp2.list(0, 2);

  // Stake 2
  treasure.stake(0, 2, you.id);

  // Unstake 2
  treasure.unstake(0, 2, you.id);

  let id = `${you.id}-${treasure.id}-0x0`;

  assert.fieldEquals("Listing", id, "status", "Active");
  assert.fieldEquals("Listing", id, "quantity", "2");
  assert.notInStore("UserToken", id);
});

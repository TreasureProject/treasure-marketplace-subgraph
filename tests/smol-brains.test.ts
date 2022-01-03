import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { DropSchool, JoinSchool } from "../generated/Smol Brains School/School";
import {
  SMOLBRAIN_ADDRESS,
  ZERO_ADDRESS,
  createMetadataAttribute,
  getAttributeId,
  getOrCreateAttribute,
  getTokenId,
  toBigDecimal,
} from "../src/helpers";
import { Transfer } from "../generated/TreasureMarketplace/ERC721";
import {
  assert,
  createMockedFunction,
  newMockEvent,
  test,
} from "matchstick-as/assembly";
import {
  handleDropSchool,
  handleJoinSchool,
  handleTransfer,
} from "../src/mappings/smol-brains";

const FROM = "0x0000000000000000000000000000000000000001";

const ADDRESS = Address.fromString(SMOLBRAIN_ADDRESS);

function join(tokenId: i32): void {
  let joinEvent = changetype<JoinSchool>(newMockEvent());

  joinEvent.parameters = new Array();
  joinEvent.transaction.from = Address.fromString(FROM);

  joinEvent.parameters.push(
    new ethereum.EventParam("tokenId", ethereum.Value.fromI32(tokenId))
  );

  handleJoinSchool(joinEvent);
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

  let iq = BigInt.fromI32(305).times(
    BigInt.fromString(toBigDecimal(1e18).toString())
  );

  createMockedFunction(ADDRESS, "brainz", "brainz(uint256):(uint256)")
    // @ts-expect-error
    .withArgs([ethereum.Value.fromI32(0)])
    // @ts-expect-error
    .returns([ethereum.Value.fromSignedBigInt(iq)]);

  let dropSchoolEvent = changetype<DropSchool>(newMockEvent());

  dropSchoolEvent.parameters = new Array();
  dropSchoolEvent.transaction.from = Address.fromString(FROM);

  dropSchoolEvent.parameters.push(
    new ethereum.EventParam("tokenId", ethereum.Value.fromI32(0))
  );

  handleDropSchool(dropSchoolEvent);

  assert.fieldEquals(
    "Attribute",
    getAttributeId(ADDRESS, "Head Size", "5"),
    "value",
    "5"
  );
  assert.fieldEquals("Token", id, "metadataUri", "ipfs://smolbrains/5");
});

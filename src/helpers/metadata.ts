import { BigInt } from "@graphprotocol/graph-ts";

export function getName(tokenId: BigInt): string | null {
  let token = tokenId.toI32();

  switch (token) {
    case 1:
    case 2:
    case 3:
    case 4:
    case 5:
    case 6:
    case 7:
    case 8:
    case 9:
    case 10:
    case 11:
    case 12:
    case 13:
    case 14:
    case 15:
    case 16:
    case 17:
    case 18:
    case 19:
    case 20:
    case 21:
    case 22:
    case 23:
    case 24:
    case 25:
    case 26:
    case 27:
    case 28:
    case 29:
    case 30:
    case 31:
    case 32:
    case 33:
    case 34:
    case 35:
    case 36:
    case 37:
    case 38:
      return `All-Class ${token}`;
    case 39:
      return "Ancient Relic";
    case 40:
    case 41:
    case 42:
    case 43:
    case 44:
      return `Assassin ${token - 39}`;
    case 45:
      return "Assassin";
    case 46:
      return "Bag of Rare Mushrooms";
    case 47:
      return "Bait for Monsters";
    case 48:
      return "Beetle-wing";
    case 49:
      return "Blue Rupee";
    case 50:
      return "Bombmaker";
    case 51:
      return "Bottomless Elixir";
    case 52:
      return "Cap of Invisibility";
    case 53:
      return "Carriage";
    case 54:
      return "Castle";
    case 55:
      return "Clocksnatcher";
    case 56:
    case 57:
    case 58:
    case 59:
    case 60:
    case 61:
    case 62:
    case 63:
    case 64:
    case 65:
    case 66:
    case 67:
      return `Common ${token - 55}`;
    case 68:
      return "Common Bead";
    case 69:
      return "Common Feather";
    case 70:
      return "Common Legion";
    case 71:
      return "Common Relic";
    case 72:
      return "Cow";
    case 73:
      return "Diamond";
    case 74:
      return "Divine Hourglass";
    case 75:
      return "Divine Mask";
    case 76:
      return "Donkey";
    case 77:
      return "Dragon Tail";
    case 78:
      return "Dreamwinder";
    case 79:
      return "Emerald";
    case 80:
      return "Extra Life";
    case 81:
      return "Fallen";
    case 82:
      return "Favor from the Gods";
    case 83:
    case 84:
    case 85:
    case 86:
    case 87:
    case 88:
    case 89:
      return `Fighter ${token - 82}`;
    case 90:
      return "Fighter";
    case 91:
      return "Framed Butterfly";
    case 92:
      return "Gold Coin";
    case 93:
      return "Grain";
    case 94:
      return "Green Rupee";
    case 95:
      return "Grin";
    case 96:
      return "Half-Penny";
    case 97:
      return "Honeycomb";
    case 98:
      return "Immovable Stone";
    case 99:
      return "Ivory Breastpin";
    case 100:
      return "Jar of Fairies";
    case 102:
      return "Keys";
    case 103:
      return "Lumber";
    case 104:
      return "Military Stipend";
    case 105:
      return "Mollusk Shell";
    case 106:
    case 107:
    case 108:
    case 109:
    case 110:
    case 111:
    case 112:
    case 113:
      return `Numeraire ${token - 105}`;
    case 114:
      return "Ox";
    case 115:
      return "Pearl";
    case 116:
      return "Pot of Gold";
    case 117:
      return "Quarter-Penny";
    case 118:
    case 119:
    case 120:
    case 121:
    case 122:
    case 123:
    case 124:
    case 125:
    case 126:
    case 127:
    case 128:
    case 129:
    case 130:
      return `Range ${token - 117}`;
    case 131:
      return "Range";
    case 132:
      return "Red Feather";
    case 133:
      return "Red Rupee";
    case 134:
    case 135:
    case 136:
    case 137:
    case 138:
    case 139:
    case 140:
      return `Riverman ${token - 133}`;
    case 141:
      return "Score of Ivory";
    case 142:
    case 143:
      return `Seed of Life ${token - 141}`;
    case 144:
    case 145:
    case 146:
    case 147:
    case 148:
    case 149:
      return `Siege ${token - 143}`;
    case 150:
      return "Siege";
    case 151:
      return "Silver Coin";
    case 152:
      return "Small Bird";
    case 153:
      return "Snow White Feather";
    case 154:
    case 155:
    case 156:
    case 157:
    case 158:
    case 159:
      return `Spellcaster ${token - 153}`;
    case 160:
      return "Spellcaster";
    case 161:
      return "Thread of Divine Silk";
    case 162:
      return "Unbreakable Pocketwatch";
    case 163:
      return "Warlock";
    case 164:
      return "Witches Broom";
    default:
      return null;
  }
}

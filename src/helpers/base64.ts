const characters =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";

// Taken from https://github.com/gogogoghost/as-crypto/blob/master/lib/base64.ts
export function base64Decode(input: string): Uint8Array {
  const trimmed = input.replace("data:application/json;base64,", "");

  if (trimmed.length == 0 || trimmed.length % 4 != 0) {
    return new Uint8Array(0);
  }

  let output = new Uint8Array(trimmed.length);
  let index = 0;
  let length = 0;

  while (index < trimmed.length) {
    const encoded = new Uint8Array(4);

    for (let innerIndex = 0; innerIndex < 4; innerIndex++) {
      const character = trimmed.charAt(index++);
      let characterIndex = characters.indexOf(character);

      if (characterIndex < 0) {
        return new Uint8Array(0);
      }

      if (characterIndex == 64) {
        return output.slice(0, length);
      }

      encoded[innerIndex] = characterIndex;

      if (innerIndex == 1) {
        output[length++] = (encoded[0] << 2) | (encoded[1] >> 4);
      } else if (innerIndex == 2) {
        output[length++] = ((encoded[1] & 15) << 4) | (encoded[2] >> 2);
      } else if (innerIndex == 3) {
        output[length++] = ((encoded[2] & 3) << 6) | encoded[3];
      }
    }
  }

  return output.slice(0, length);
}

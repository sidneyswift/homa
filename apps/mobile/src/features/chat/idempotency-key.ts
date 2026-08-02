const UUID_V4_TEMPLATE = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx";

export function createIdempotencyKey(
  random: () => number = Math.random,
): string {
  return UUID_V4_TEMPLATE.replace(/[xy]/g, (placeholder) => {
    const randomNibble = Math.floor(random() * 16);
    const nibble = placeholder === "x"
      ? randomNibble
      : (randomNibble & 0x3) | 0x8;
    return nibble.toString(16);
  });
}

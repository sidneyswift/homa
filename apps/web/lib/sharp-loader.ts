const importSharp = () => import("sharp");

/** Keep native image processing off plain-text agent startup. The literal
 * import lets both Next and Eve include the package for its first use. */
export async function loadSharp() {
  return (await importSharp()).default;
}

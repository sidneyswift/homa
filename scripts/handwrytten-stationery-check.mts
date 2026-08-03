import { loadHandwryttenStationeryInputs, validateHandwryttenStationery } from "./handwrytten-stationery-contract.mts";

const inputs = loadHandwryttenStationeryInputs();
const issues = validateHandwryttenStationery(inputs);
if (issues.length > 0) {
  for (const issue of issues) console.error(`${issue.code}: ${issue.message}`);
  process.exit(1);
}
console.log(`Handwrytten stationery contract current: ${inputs.stationery.status}, ${inputs.stationery.sourcePaths.length} inventoried paths, provider and physical proof remain explicit gates.`);

#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ISSUE_606_RELEASE_SEAL_SIGNER_PRINCIPAL =
  "158200036+sidneyswift@users.noreply.github.com";
export const ISSUE_606_RELEASE_SEAL_SIGNER_PUBLIC_KEY =
  "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQCzF6U/UfsDqJbO9qcKpZ4D5GuBuvBjGF3Mj8/A9IgKGA0b/W5zhUfn9P0pBXr073H8M0J2WeOqlaFCi49g+xpVWiaHfpc/EN/flsheWEspsBOHDvx5dSVx1qMXtrw25Pg66/qxkNDRpsZmxn1P7FEnJ4jfX9loaNuWCBRR9CnTUmJpPcvMw7RELG96qYeIILw/DrOiaFRnWv2WmRnEc9t/DZeoc9qMxsWIf0OWKz+8KL6Ky0Wj1L/+hYQigalbVE7M2KZJFmhXbLXB8K+gqWrx/GaqHyiAau8Jar4p79eNOgv1yOPZt5QmNabVXY3fgXLuDNyummuLstu6/P4E0XTCJLA7/1Nw7rTWPnIbsmWKizeqdhPDUJzUms56kRCHhsNOFKDhyTBmQf8RhtS2uz0gw8cQchu2BIcuOiPtyHvRPUBHJwCXNmA0RwqMuQU6KWu71eKzMS87aQMmkd1aapmqWXeQI5CNyxL74M3bbVg3VLqPa5R9af9fl/FkLasIRlQQkYUaMiP1U2+Lq3ubi0SLfCeQUJyZYvG/IiVd7YouNZSUuzb/bf9uQB+uyNScBlGATrkZfMaV8SWG5X1FE5WYseN7M9Ipw9t5DYPeRO3rC3MZW/rpsfRDhK1DcBeflQALvGgBQQcbtPN8xnoyxv7g7YBddABAbcW5A7r5rRrykw==";
export const ISSUE_606_RELEASE_SEAL_SIGNER_FINGERPRINT =
  "SHA256:OhlRKNYiqh/Yq8CS/mbQJmUnzLKYFyKBh2jznTelsAY";

const REQUIRED_OCCURRENCES = Object.freeze([
  ["reviewed_repair_tag:\n        description: Paste the exact operator release seal tag\n        required: true\n        type: string", 1],
  ["fetch-depth: 2", 1],
  ["fetch-tags: false", 1],
  ["final_parent_line=\"$(git show -s --format='%P' \"$GITHUB_SHA\")\"", 1],
  ["read -r final_first_parent reviewed_repair_sha extra_parent", 1],
  ["REVIEWED_REPAIR_SHA=\"$reviewed_repair_sha\"", 1],
  ["echo \"REVIEWED_REPAIR_SHA=$REVIEWED_REPAIR_SHA\"", 1],
  ["scripts/issue-606-release-seal-workflow-contract.mjs", 2],
  ["ISSUE_606_RELEASE_SEAL_WORKFLOW_CONTRACT_SHA256=", 2],
  ["Verify the exact-head operator release seal", 1],
  ["This SSH signature is the repository owner's deliberate production release seal.", 1],
  ["It binds the exact reviewed head and public council ruling. It does not prove reviewer identity.", 1],
  ["RELEASE_SEAL_TAG: ${{ inputs.reviewed_repair_tag }}", 1],
  ["RELEASE_SEAL_TAGGER_IDENTITY: Sidney Swift <158200036+sidneyswift@users.noreply.github.com>", 1],
  [`RELEASE_SEAL_SIGNER_PRINCIPAL: ${ISSUE_606_RELEASE_SEAL_SIGNER_PRINCIPAL}`, 1],
  [`RELEASE_SEAL_SIGNER_PUBLIC_KEY: ${ISSUE_606_RELEASE_SEAL_SIGNER_PUBLIC_KEY}`, 1],
  [`RELEASE_SEAL_SIGNER_FINGERPRINT: ${ISSUE_606_RELEASE_SEAL_SIGNER_FINGERPRINT}`, 1],
  ["RELEASE_SEAL_TAG\" != \"issue-606-reviewed-$REVIEWED_REPAIR_SHA", 1],
  ["if [ \"${#preexisting_tag_refs[@]}\" -ne 0 ]; then", 1],
  ["if [ \"${#remote_release_seal_refs[@]}\" -ne 1 ]; then", 1],
  ["git fetch --no-tags --force origin \\\n            \"refs/tags/$RELEASE_SEAL_TAG:refs/tags/$RELEASE_SEAL_TAG\"", 1],
  ["git fetch --no-tags --force origin +refs/heads/main:refs/remotes/origin/main", 2],
  ["if [ \"${#local_tag_refs[@]}\" -ne 1 ]", 1],
  ["release_seal_tag_type=\"$(git cat-file -t \"$release_seal_ref\")\"", 1],
  ["if [ \"$release_seal_tag_type\" != \"tag\" ]; then", 1],
  ["git cat-file tag \"$release_seal_ref\" | sed -n 's/^object //p'", 1],
  ["git cat-file tag \"$release_seal_ref\" | sed -n 's/^type //p'", 1],
  ["git cat-file tag \"$release_seal_ref\" | sed -n 's/^tag //p'", 1],
  ["${release_seal_tag_objects[0]}\" != \"$REVIEWED_REPAIR_SHA", 1],
  ["${release_seal_tag_types[0]}\" != \"commit", 1],
  ["${release_seal_tag_names[0]}\" != \"$RELEASE_SEAL_TAG", 1],
  ["sed -n 's/^tagger \\(Sidney Swift <158200036+sidneyswift@users\\.noreply\\.github\\.com>\\) [1-9][0-9]* [+-][0-9]\\{4\\}$/\\1/p'", 1],
  ["${release_seal_tagger_identities[0]}\" != \"$RELEASE_SEAL_TAGGER_IDENTITY", 1],
  ["release_seal_target=\"$(git rev-parse \"$release_seal_ref^{}\")\"", 1],
  ["if [ \"$release_seal_target\" != \"$REVIEWED_REPAIR_SHA\" ]; then", 1],
  ["contract=homa-issue-606-exact-head-review-v1", 1],
  ["issue=https://github.com/sidneyswift/homa/issues/606", 1],
  ["reviewed-sha=$REVIEWED_REPAIR_SHA", 1],
  ["deploy-containment=GO", 1],
  ["close-issue-606=NO-GO", 1],
  ["if [ \"${#release_seal_message_lines[@]}\" -ne 5 ]", 1],
  ["mktemp \"$RUNNER_TEMP/homa-issue-606-allowed-signers.XXXXXX\"", 1],
  ["printf '%s namespaces=\"git\" %s\\n'", 1],
  ["chmod 600 \"$allowed_signers_file\"", 1],
  ["git -c gpg.ssh.allowedSignersFile=\"$allowed_signers_file\" \\\n              verify-tag \"$release_seal_ref\" 2>&1", 1],
  ["Good \\\"git\\\" signature for $RELEASE_SEAL_SIGNER_PRINCIPAL with RSA key $RELEASE_SEAL_SIGNER_FINGERPRINT", 1],
  ["if [ \"${#post_verify_remote_tag_refs[@]}\" -ne 1 ]; then", 1],
  ["if [ \"${#pre_database_remote_tag_refs[@]}\" -ne 1 ]; then", 1],
  ["if [ \"${#final_remote_tag_refs[@]}\" -ne 1 ]; then", 1],
  ["ISSUE_606_RELEASE_SEAL_TAG_OBJECT_SHA", 4],
  ["release_seal_semantics=repository-owner-operator-seal-plus-public-council-record", 1],
  ["release_seal_signer_fingerprint=%s", 1],
  ["release_seal_signer_principal=%s", 1],
  ["release_seal_tag_object_sha=%s", 1],
  ["release_seal_workflow_contract_sha256=%s", 1],
]);

const FORBIDDEN_PATTERNS = Object.freeze([
  ["reviewed repair SHA workflow input", String.raw`(^|\n)\s*reviewed_repair_sha:`],
  ["reviewed repair SHA input reference", String.raw`inputs\.reviewed_repair_sha`],
  ["broad tag fetch", String.raw`git fetch[^\n]*(?:\s--tags(?:\s|$)|\s--all(?:\s|$)|refs/tags/\*)`],
  ["commit signature substitution", String.raw`verify-commit`],
  ["unpinned Ed25519 key", String.raw`ssh-ed25519`],
  ["external reviewer overclaim", String.raw`externally reviewed|independent reviewer`],
]);

function countOccurrences(contents, fragment) {
  let count = 0;
  let offset = 0;
  while (true) {
    const index = contents.indexOf(fragment, offset);
    if (index < 0) return count;
    count += 1;
    offset = index + fragment.length;
  }
}

export function validateIssue606ReleaseSealWorkflow(workflow) {
  if (typeof workflow !== "string" || workflow.length === 0) {
    throw new Error("Pass the issue #606 workflow text.");
  }
  for (const [fragment, expectedCount] of REQUIRED_OCCURRENCES) {
    const actualCount = countOccurrences(workflow, fragment);
    if (actualCount !== expectedCount) {
      throw new Error(
        `Release-seal workflow fragment count is ${actualCount}, expected ${expectedCount}: ${fragment}`
      );
    }
  }
  for (const [label, source] of FORBIDDEN_PATTERNS) {
    if (new RegExp(source, "mu").test(workflow)) {
      throw new Error(`Release-seal workflow contains forbidden ${label}.`);
    }
  }
  return {
    contractSha256: createHash("sha256")
      .update(
        JSON.stringify({
          version: "homa-issue-606-release-seal-workflow-v1",
          signerPrincipal: ISSUE_606_RELEASE_SEAL_SIGNER_PRINCIPAL,
          signerPublicKey: ISSUE_606_RELEASE_SEAL_SIGNER_PUBLIC_KEY,
          signerFingerprint: ISSUE_606_RELEASE_SEAL_SIGNER_FINGERPRINT,
          requiredOccurrences: REQUIRED_OCCURRENCES,
          forbiddenPatterns: FORBIDDEN_PATTERNS,
        })
      )
      .digest("hex"),
  };
}

function main() {
  const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const workflowPath = resolve(
    repositoryRoot,
    ".github/workflows/issue-606-production-repair.yml"
  );
  const result = validateIssue606ReleaseSealWorkflow(
    readFileSync(workflowPath, "utf8")
  );
  console.log(
    `ISSUE_606_RELEASE_SEAL_WORKFLOW_CONTRACT_SHA256=${result.contractSha256}`
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main();
}

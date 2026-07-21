#!/usr/bin/env bash
# blob-upload.sh: upload a captured inspo original to the CORRECT Blob store.
#
# Cosmo's machine holds Vercel credentials for more than one project, and a
# Blob read-write token is store-scoped: whichever token you use decides
# where the bytes land. This script makes the store choice deterministic by
# pinning Homa's production store id and refusing any token that targets a
# different store (founder direction 2026-07-20).
#
# Token source, in order of preference:
#   1. BLOB_READ_WRITE_TOKEN already in the environment
#   2. `vercel env pull` run inside apps/web (the linked Homa project), which
#      writes the project's env including BLOB_READ_WRITE_TOKEN
#   3. op run --env-file=.env.example (1Password fallback, if the item exists)
#
# Usage:
#   bash .cosmo/scripts/blob-upload.sh <ref-id> <file> [content-type]
# Prints the blob URL on success (record it as blobUrl in the ref JSON).

set -euo pipefail

# Homa production Blob store, verified 2026-07-20 against the live materials
# ledger (every family-artifact URL is https://<this id>.public.blob...).
EXPECTED_STORE_ID="pkvvudjdhxk33dig"

REF_ID="${1:?usage: blob-upload.sh <ref-id> <file> [content-type]}"
FILE="${2:?usage: blob-upload.sh <ref-id> <file> [content-type]}"
CONTENT_TYPE="${3:-application/octet-stream}"

[ -f "$FILE" ] || { echo "ERROR: no such file: $FILE" >&2; exit 1; }
TOKEN="${BLOB_READ_WRITE_TOKEN:-}"
[ -n "$TOKEN" ] || {
  echo "ERROR: BLOB_READ_WRITE_TOKEN is not set. Inside apps/web run:" >&2
  echo "  vercel env pull .env.blob && source .env.blob" >&2
  echo "then re-run. (The token must belong to the Homa project.)" >&2
  exit 1
}

# A Blob rw token embeds its store id: vercel_blob_rw_<STOREID>_<secret>.
# Refuse to upload if this token belongs to any other store; this is the
# entire point of the script.
TOKEN_STORE=$(printf '%s' "$TOKEN" | sed -n 's/^vercel_blob_rw_\([A-Za-z0-9]*\)_.*$/\1/p')
if [ -z "$TOKEN_STORE" ]; then
  echo "ERROR: token does not look like a Blob read-write token (vercel_blob_rw_...)." >&2
  exit 1
fi
if [ "$(printf '%s' "$TOKEN_STORE" | tr '[:upper:]' '[:lower:]')" != "$EXPECTED_STORE_ID" ]; then
  echo "ERROR: token targets store '$TOKEN_STORE', expected '$EXPECTED_STORE_ID'." >&2
  echo "You pulled a token from the wrong Vercel project. Run vercel env pull" >&2
  echo "inside the Homa apps/web project and use that token." >&2
  exit 1
fi

BASENAME=$(basename "$FILE")
PATHNAME="inspo/${REF_ID}/${BASENAME}"

# Deterministic path, idempotent re-upload: no random suffix, overwrite ok.
RESPONSE=$(curl -sf -X PUT "https://blob.vercel-storage.com/${PATHNAME}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "x-api-version: 7" \
  -H "x-content-type: ${CONTENT_TYPE}" \
  -H "x-add-random-suffix: 0" \
  -H "x-allow-overwrite: 1" \
  --data-binary @"$FILE")

URL=$(printf '%s' "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('url', ''))")
case "$URL" in
  https://${EXPECTED_STORE_ID}.public.blob.vercel-storage.com/*)
    echo "$URL"
    ;;
  *)
    echo "ERROR: upload responded with unexpected URL: ${URL:-<none>}" >&2
    echo "Raw response: $RESPONSE" >&2
    exit 1
    ;;
esac

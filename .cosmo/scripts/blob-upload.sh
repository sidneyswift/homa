#!/usr/bin/env bash
# blob-upload.sh: upload captured inspo bytes to the CORRECT Blob store.
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
#   bash .cosmo/scripts/blob-upload.sh <record-id> <file> [content-type]
#   bash .cosmo/scripts/blob-upload.sh --text <record-id> <file> [content-type]
#
# The default uploads a Library original under inspo/. The explicit --text
# mode uploads an extracted text sidecar under inspo-text/, which the admin
# Library never lists as an original. Prints the Blob URL on success.

set -euo pipefail

# Homa production Blob store, verified 2026-07-20 against the live materials
# ledger (every family-artifact URL is https://<this id>.public.blob...).
EXPECTED_STORE_ID="pkvvudjdhxk33dig"

NAMESPACE="inspo"
DEFAULT_CONTENT_TYPE="application/octet-stream"
case "${1:-}" in
  --text)
    NAMESPACE="inspo-text"
    DEFAULT_CONTENT_TYPE="text/plain; charset=utf-8"
    shift
    ;;
  --*)
    echo "ERROR: unknown option: $1" >&2
    exit 2
    ;;
esac

RECORD_ID="${1:?usage: blob-upload.sh [--text] <record-id> <file> [content-type]}"
FILE="${2:?usage: blob-upload.sh [--text] <record-id> <file> [content-type]}"
CONTENT_TYPE="${3:-$DEFAULT_CONTENT_TYPE}"

# The record id is one Blob path segment. Refuse separators, whitespace, and
# shell metacharacters rather than allowing a caller to escape the selected
# namespace or create a path the Library cannot join deterministically.
case "$RECORD_ID" in
  ""|"."|".."|*[!A-Za-z0-9._-]*)
    echo "ERROR: record id must contain only letters, numbers, dot, underscore, and hyphen." >&2
    exit 2
    ;;
esac

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
# The basename goes into a URL, so it has to be percent-encoded. Slack
# filenames routinely carry spaces and brackets ("good and the beautiful .pdf",
# "[FREE] Geography - Houses Around the World.pdf"), and an unencoded space
# produces a malformed request that fails with no useful message. This bit
# 23 of 58 uploads in the 2026-07-30 rescue sweep, and every failure was a
# filename with a space in it.
ENCODED=$(printf '%s' "$BASENAME" | python3 -c "import sys, urllib.parse; print(urllib.parse.quote(sys.stdin.read(), safe='.-_~'))")
PATHNAME="${NAMESPACE}/${RECORD_ID}/${ENCODED}"

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

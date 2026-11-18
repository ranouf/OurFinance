#!/usr/bin/env bash
set -euo pipefail

sha="$1"
channel="$2"
reservation_json="$3"
approval_json="$4"

[[ "$sha" =~ ^[0-9a-f]{40}$ ]]
[[ "$channel" == preview || "$channel" == live ]]

# An explicit one-line decision keeps cancellation and refusal unambiguous.
bash scripts/verify-test-reservation.sh "$sha" "$reservation_json"

jq -e --arg sha "$sha" --arg channel "$channel" '
  .user.login == "ranouf" and
  (.issue_url == "https://api.github.com/repos/ranouf/OurFinance/issues/30" or
   .issue_url == "https://api.github.com/repos/ranouf/OurFinance/issues/122") and
  ((.body // "") | sub("[\\r\\n]+$"; "")) ==
    ("Validation visuelle approuvée pour " + $channel + " " + $sha)
' "$approval_json" >/dev/null

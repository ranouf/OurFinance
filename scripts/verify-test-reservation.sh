#!/usr/bin/env bash
set -euo pipefail

sha="$1"
reservation_json="$2"

[[ "$sha" =~ ^[0-9a-f]{40}$ ]]

# Only this explicit, single-line decision authorizes a TEST deployment.
jq -e --arg sha "$sha" '
  now as $checked | (.created_at | fromdateiso8601) as $reserved |
  .user.login == "ranouf" and
  .issue_url == "https://api.github.com/repos/ranouf/OurFinance/issues/30" and
  $reserved <= $checked and ($checked - $reserved) <= 3600 and
  ((.body // "") | sub("[\\r\\n]+$"; "")) == ("Réservation TEST active pour " + $sha)
' "$reservation_json" >/dev/null

#!/usr/bin/env bash
set -euo pipefail

sha="$1"
channel="$2"
reservation_json="$3"

[[ "$channel" == preview || "$channel" == live ]]
bash scripts/verify-test-reservation.sh "$sha" "$reservation_json"

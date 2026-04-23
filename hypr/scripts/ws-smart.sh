#!/usr/bin/env bash

WS="$1"

[ -z "$WS" ] && exit 0

if hyprctl workspaces -j | jq -e --argjson ws "$WS" '.[] | select(.id == $ws and .windows > 0)' >/dev/null; then
    hyprctl dispatch workspace "$WS"
fi

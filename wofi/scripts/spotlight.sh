#!/usr/bin/env bash
set -euo pipefail

query="$(wofi --dmenu --insensitive --prompt "Spotlight")"
[ -z "$query" ] && exit 0

notify() {
  local title="$1"
  local message="$2"

  if command -v notify-send >/dev/null 2>&1; then
    notify-send "$title" "$message" >/dev/null 2>&1 || true
  elif command -v hyprctl >/dev/null 2>&1; then
    hyprctl notify 1 5000 "rgb(8ec07c)" "$message" >/dev/null 2>&1 || true
  fi
}

encode() {
  python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1]))' "$1"
}

open_url() {
  local url="$1"

  if command -v firefox >/dev/null 2>&1; then
    firefox --new-tab "$url" >/dev/null 2>&1 &
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$url" >/dev/null 2>&1 &
  fi
}

calculate() {
  local input="$1"

  python3 - "$input" <<'PY'
import ast
import operator as op
import re
import sys

raw = sys.argv[1].strip()
expr = raw.replace(',', '.')
expr = expr.replace('x', '*').replace('X', '*')
expr = expr.replace(':', '/').replace('÷', '/')
expr = expr.replace('^', '**')
expr = expr.removeprefix('=').strip()
expr = re.sub(r'\s+', '', expr)

if not re.fullmatch(r'[0-9.+\-*/%()]+', expr):
    sys.exit(1)

if not re.search(r'[+\-*/%]', expr):
    sys.exit(1)

allowed = {
    ast.Add: op.add,
    ast.Sub: op.sub,
    ast.Mult: op.mul,
    ast.Div: op.truediv,
    ast.Mod: op.mod,
    ast.Pow: op.pow,
    ast.USub: op.neg,
    ast.UAdd: op.pos,
}

def eval_node(node):
    if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
        return node.value
    if isinstance(node, ast.BinOp) and type(node.op) in allowed:
        return allowed[type(node.op)](eval_node(node.left), eval_node(node.right))
    if isinstance(node, ast.UnaryOp) and type(node.op) in allowed:
        return allowed[type(node.op)](eval_node(node.operand))
    raise ValueError('invalid expression')

try:
    tree = ast.parse(expr, mode='eval')
    value = eval_node(tree.body)
except Exception:
    sys.exit(1)

if isinstance(value, float) and value.is_integer():
    print(int(value))
else:
    print(value)
PY
}

search_url() {
  local input="$1"
  local prefix=""
  local term=""
  local encoded=""

  if [[ "$input" == *" "* ]]; then
    prefix="${input%% *}"
    term="${input#* }"
  fi

  case "$prefix" in
    !yt|!youtube)
      encoded="$(encode "$term")"
      printf 'https://www.youtube.com/results?search_query=%s\n' "$encoded"
      ;;
    !gh|!github)
      encoded="$(encode "$term")"
      printf 'https://github.com/search?q=%s\n' "$encoded"
      ;;
    !g|!google)
      encoded="$(encode "$term")"
      printf 'https://www.google.com/search?q=%s\n' "$encoded"
      ;;
    *)
      encoded="$(encode "$input")"
      printf 'https://www.google.com/search?q=%s\n' "$encoded"
      ;;
  esac
}

if result="$(calculate "$query" 2>/dev/null)"; then
  notify "Calculadora" "$query = $result"

  if command -v wl-copy >/dev/null 2>&1; then
    printf '%s' "$result" | wl-copy
  fi

  exit 0
fi

if [[ "$query" =~ ^https?:// ]]; then
  open_url "$query"
else
  open_url "$(search_url "$query")"
fi

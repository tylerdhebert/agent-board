#!/usr/bin/env bash

set -euo pipefail

usage() {
  echo "Usage: $(basename "$0") <destination-directory>"
}

if [[ $# -ne 1 ]]; then
  usage
  exit 1
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source_dir="$(cd "$script_dir/.." && pwd)"
destination="$1"

mkdir -p "$destination"
destination="$(cd "$destination" && pwd)"

files=(
  "AGENT_MANDATE.md"
  "AGENT_API.md"
  "ORCHESTRATOR.md"
  "BOARD_AGENT.md"
  "CONFLICT_RESOLVER.md"
)

for file in "${files[@]}"; do
  source_path="$source_dir/$file"
  link_path="$destination/$file"

  if [[ -L "$link_path" ]]; then
    rm "$link_path"
  elif [[ -e "$link_path" ]]; then
    echo "Refusing to overwrite existing non-symlink: $link_path" >&2
    exit 1
  fi

  ln -s "$source_path" "$link_path"
  echo "Linked $link_path -> $source_path"
done

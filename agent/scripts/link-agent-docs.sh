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

# Link individual markdown files
files=(
  "AGENT_MANDATE.md"
  "AGENT_API.md"
  "ORCHESTRATOR.md"
  "BOARD_AGENT.md"
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

# Link skills subdirectories into <destination>/skills/
skills_source="$source_dir/skills"
skills_dest="$destination/skills"
mkdir -p "$skills_dest"

for skill_dir in "$skills_source"/*/; do
  skill_name="$(basename "$skill_dir")"
  source_path="$skills_source/$skill_name"
  link_path="$skills_dest/$skill_name"

  if [[ -L "$link_path" ]]; then
    rm "$link_path"
  elif [[ -e "$link_path" ]]; then
    echo "Refusing to overwrite existing non-symlink: $link_path" >&2
    exit 1
  fi

  ln -s "$source_path" "$link_path"
  echo "Linked $link_path -> $source_path"
done

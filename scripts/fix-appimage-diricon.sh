#!/usr/bin/env bash
set -euo pipefail

appimagetool=${1:?Usage: fix-appimage-diricon.sh /path/to/appimagetool}
bundle_dir="src-tauri/target/release/bundle/appimage"
mapfile -t images < <(find "$bundle_dir" -maxdepth 1 -type f -name '*.AppImage' -print)

if [[ ${#images[@]} -ne 1 ]]; then
  printf 'Expected exactly one AppImage in %s, found %s\n' "$bundle_dir" "${#images[@]}" >&2
  exit 1
fi

image="$PWD/${images[0]}"
work_dir=$(mktemp -d)
trap 'rm -rf "$work_dir"' EXIT

(
  cd "$work_dir"
  "$image" --appimage-extract >/dev/null
)

appdir="$work_dir/squashfs-root"
if [[ ! -f "$appdir/AppRun" ]]; then
  printf 'Extracted AppImage is missing AppRun: %s\n' "$appdir" >&2
  exit 1
fi

install -m 0644 src-tauri/icons/256x256.png "$appdir/.DirIcon"
ARCH=x86_64 APPIMAGE_EXTRACT_AND_RUN=1 "$appimagetool" "$appdir" "$work_dir/rebuilt.AppImage"

mkdir "$work_dir/verify"
(
  cd "$work_dir/verify"
  "$work_dir/rebuilt.AppImage" --appimage-extract >/dev/null
)
if [[ ! -s "$work_dir/verify/squashfs-root/.DirIcon" ]]; then
  printf 'Rebuilt AppImage is missing .DirIcon\n' >&2
  exit 1
fi

chmod +x "$work_dir/rebuilt.AppImage"
mv "$work_dir/rebuilt.AppImage" "$image"
printf 'Added and verified .DirIcon in %s\n' "$image"
#!/bin/sh
set -eu

# Publish the same build to nginx and Flask's read-only volume mount. Keep old
# hashed assets so tabs opened before an upgrade can still load lazy chunks.
source_dir=/opt/xingyu-dist
target_dir=/usr/share/nginx/html
mkdir -p "$target_dir"
cp -R "$source_dir/assets" "$target_dir/"
for entry in "$source_dir"/*; do
    case "$(basename "$entry")" in
        assets|metadata.json|index.html) continue ;;
    esac
    cp -R "$entry" "$target_dir/"
done
# The manifest includes its HTML template, so backend readers never combine
# HTML from one build with the metadata catalogue from another.
cp "$source_dir/metadata.json" "$target_dir/.metadata.json.next"
mv -f "$target_dir/.metadata.json.next" "$target_dir/metadata.json"
cp "$source_dir/index.html" "$target_dir/.index.html.next"
mv -f "$target_dir/.index.html.next" "$target_dir/index.html"

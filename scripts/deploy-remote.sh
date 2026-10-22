#!/usr/bin/env bash
set -euo pipefail
umask 077
base=$1
project=$2
revision=$3
domain=$4
mode=$5
exec 9>"$base/.deploy.lock"
flock -n 9 || { echo 'Another deployment is in progress.' >&2; exit 1; }
source_dir=$(cd -- "$(dirname -- "$0")/.." && pwd)
export RELEASE_REVISION="$revision"

cd -- "$source_dir"
python3 scripts/release.py prepare-compose --base "$base" --source "$source_dir" \
    --project "$project" --revision "$revision" --domain "$domain"
compose=(docker compose -p "$project" -f "$source_dir/compose.release.json")
"${compose[@]}" config --quiet
for service in backend frontend; do
    identifier=$("${compose[@]}" ps -a -q "$service")
    if [[ -n "$identifier" ]]; then
        docker inspect --format '{{.Image}}' "$identifier" > "$source_dir/previous-$service-image.txt"
    fi
done
# Build while the existing website still serves traffic. Failed builds do not
# reach the data backup/deployment steps.
"${compose[@]}" build
existing=$("${compose[@]}" ps -a -q backend)
if [[ -n "$existing" ]]; then
    python3 scripts/recovery.py --project "$project" -f "$source_dir/compose.release.json" \
        backup --output "$base/backups"
elif [[ "$mode" != first ]]; then
    echo 'No previous backend. Use FirstDeploy only for a verified empty installation.' >&2
    exit 1
else
    # Do not silently adopt orphaned data volumes without a verified backup.
    for logical in db_data_prod upload_data_prod; do
        volume=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["volumes"][sys.argv[2]]["name"])' "$source_dir/compose.release.json" "$logical")
        if docker volume inspect "$volume" >/dev/null 2>&1; then
            echo 'Existing data volume found; establish a backend and verified backup first.' >&2
            exit 1
        fi
    done
fi

"${compose[@]}" up -d --no-build --wait --wait-timeout 120
python3 scripts/release.py smoke --base-url "$domain" --revision "$revision" --attempts 3
if [[ -f "$base/current-release" ]]; then
    cp "$base/current-release" "$base/previous-release"
fi
printf '%s\n' "$source_dir" > "$base/.current-release.next"
mv -f "$base/.current-release.next" "$base/current-release"
printf 'Release accepted: %s\n' "$revision"

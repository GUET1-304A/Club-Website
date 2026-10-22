#!/usr/bin/env bash
set -euo pipefail
umask 077

# Keep the OS interpreter intact (Alibaba Cloud Linux uses Python 3.6 for
# system tools). Select a compatible, parallel-installed release runtime.
candidates=(python3 python3.11 python3.12 python3.13 python3.14 python3.10 python3.9)
if [[ -n "${RELEASE_PYTHON:-}" ]]; then
    candidates=("$RELEASE_PYTHON")
fi
release_python=''
for candidate in "${candidates[@]}"; do
    if executable=$(command -v -- "$candidate") &&
       probe=$("$executable" -c 'import sys; sys.exit(1) if sys.version_info < (3, 9) else print("release-python-ok")' 2>/dev/null) &&
       [[ "$probe" == release-python-ok ]]; then
        release_python=$executable
        break
    fi
done
if [[ -z "$release_python" ]]; then
    echo 'Python 3.9+ is required. Install a versioned interpreter or set RELEASE_PYTHON; keep the OS Python unchanged.' >&2
    exit 1
fi
printf 'Release interpreter: %s\n' "$release_python"
if [[ "${1:-}" == --check-runtime ]]; then
    "$release_python" --version
    exit 0
fi

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
"$release_python" scripts/release.py prepare-compose --base "$base" --source "$source_dir" \
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
    "$release_python" scripts/recovery.py --project "$project" -f "$source_dir/compose.release.json" \
        backup --output "$base/backups"
elif [[ "$mode" != first ]]; then
    echo 'No previous backend. Use FirstDeploy only for a verified empty installation.' >&2
    exit 1
else
    # Do not silently adopt orphaned data volumes without a verified backup.
    for logical in db_data_prod upload_data_prod; do
        volume=$("$release_python" -c 'import json,sys; print(json.load(open(sys.argv[1]))["volumes"][sys.argv[2]]["name"])' "$source_dir/compose.release.json" "$logical")
        if docker volume inspect "$volume" >/dev/null 2>&1; then
            echo 'Existing data volume found; establish a backend and verified backup first.' >&2
            exit 1
        fi
    done
fi

"${compose[@]}" up -d --no-build --wait --wait-timeout 120
"$release_python" scripts/release.py smoke --base-url "$domain" --revision "$revision" --attempts 3
if [[ -f "$base/current-release" ]]; then
    cp "$base/current-release" "$base/previous-release"
fi
printf '%s\n' "$source_dir" > "$base/.current-release.next"
mv -f "$base/.current-release.next" "$base/current-release"
printf 'Release accepted: %s\n' "$revision"

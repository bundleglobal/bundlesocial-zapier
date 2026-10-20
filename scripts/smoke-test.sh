#!/usr/bin/env bash
# Runs the integration locally against the real API with `zapier-platform invoke`.
# Reads authData_apiKey, SMOKE_TEAM_ID, SMOKE_POST_ID and optional SMOKE_PLATFORM from .env.
# Sections 1-3 only read. Section 4 creates a temporary team (with two uploads) and a DRAFT post,
# then deletes both. Every published action and trigger is called at least once.
#
# Usage: bash scripts/smoke-test.sh [--read-only]
set -uo pipefail

cd "$(dirname "$0")/.."
if [ ! -f .env ]; then
	echo "Missing .env (needs authData_apiKey, SMOKE_TEAM_ID, SMOKE_POST_ID)." >&2
	exit 1
fi
set -a
# shellcheck disable=SC1091
. ./.env
set +a
: "${authData_apiKey:?set authData_apiKey in .env}"
: "${SMOKE_TEAM_ID:?set SMOKE_TEAM_ID in .env}"
: "${SMOKE_POST_ID:?set SMOKE_POST_ID in .env}"
READ_ONLY=false
[ "${1:-}" = "--read-only" ] && READ_ONLY=true

if [ -x node_modules/.bin/zapier-platform ]; then
	ZAPIER=(node_modules/.bin/zapier-platform)
else
	ZAPIER=(zapier-platform)
fi

TEAM="$SMOKE_TEAM_ID"
POST="$SMOKE_POST_ID"
LOG_DIR="smoke-output"
rm -rf "$LOG_DIR" && mkdir -p "$LOG_DIR"
PASSED=0
FAILED=0
FAILURES=()
LAST_OUTPUT=""

# Prints the JSON value at a dotted path of the invoke output (which may start with log lines).
json() {
	node -e '
		const text = require("fs").readFileSync(0, "utf8");
		const start = text.search(/^[\[{]/m);
		if (start < 0) process.exit(1);
		let value = JSON.parse(text.slice(start));
		for (const key of (process.argv[1] || "").split(".").filter(Boolean)) value = value == null ? undefined : value[key];
		if (value === undefined || value === null) process.exit(1);
		console.log(typeof value === "object" ? JSON.stringify(value) : value);
	' "$1" <<<"$LAST_OUTPUT"
}

summary() {
	node -e '
		const describe = (text) => {
			const start = text.search(/^[\[{]/m);
			if (start < 0) return "";
			try {
				const value = JSON.parse(text.slice(start));
				if (Array.isArray(value)) return `${value.length} item(s)` + (value[0] && value[0].id ? `, first id ${value[0].id}` : "");
				if (Array.isArray(value.items)) return `${value.items.length} item(s), total ${value.total ?? "?"}`;
				if (value.id) return `id ${value.id}`;
				return Object.keys(value).slice(0, 5).join(", ");
			} catch {
				return "";
			}
		};
		console.log(describe(require("fs").readFileSync(0, "utf8")));
	' <<<"$LAST_OUTPUT"
}

# run <expect: ok|empty|error> <type> <key> [inputData JSON]
run() {
	local expect="$1" type="$2" key="$3" input="${4:-}"
	[ -n "$input" ] || input='{}'
	local log="$LOG_DIR/$(printf '%03d' $((PASSED + FAILED + 1)))-$type-$key.log"
	LAST_OUTPUT="$("${ZAPIER[@]}" invoke "$type" "$key" -i "$input" --non-interactive 2>&1)"
	local status=$?
	printf '%s\n\n$ invoke %s %s -i %s\n' "$LAST_OUTPUT" "$type" "$key" "$input" >"$log"
	local ok=false
	case "$expect" in
		ok) [ $status -eq 0 ] && ok=true ;;
		empty) [ $status -eq 0 ] && [ "$(json '' 2>/dev/null)" = "[]" ] && ok=true ;;
		error) [ $status -ne 0 ] && ok=true ;;
	esac
	if $ok; then
		PASSED=$((PASSED + 1))
		printf '  \033[32mPASS\033[0m %-8s %-45s %s\n' "$type" "$key" "$(summary)"
	else
		FAILED=$((FAILED + 1))
		FAILURES+=("$type $key (expected $expect, see $log)")
		printf '  \033[31mFAIL\033[0m %-8s %-45s expected %s, see %s\n' "$type" "$key" "$expect" "$log"
		grep -m 3 -iE 'error|message|issues' "$log" | sed 's/^/         /' || true
	fi
}

section() { printf '\n\033[1m== %s\033[0m\n' "$1"; }

section "1. Authentication"
run ok auth test
run ok auth label

# Pick a platform connected in the team, preferring ones that accept text-only drafts.
if [ -z "${SMOKE_PLATFORM:-}" ]; then
	TEAM_JSON="$(curl -fsS -H "x-api-key: $authData_apiKey" "${BUNDLESOCIAL_BASE_URL:-https://api.bundle.social}/api/v1/team/$TEAM" 2>/dev/null)"
	TYPES="$(node -e 'const t = JSON.parse(require("fs").readFileSync(0, "utf8") || "{}"); console.log((t.socialAccounts || []).filter((s) => !s.deletedAt).map((s) => s.type).join(" "))' <<<"$TEAM_JSON" 2>/dev/null)"
	for preferred in LINKEDIN TWITTER FACEBOOK THREADS BLUESKY MASTODON DISCORD SLACK; do
		if [[ " $TYPES " == *" $preferred "* ]]; then SMOKE_PLATFORM="$preferred"; break; fi
	done
	[ -z "${SMOKE_PLATFORM:-}" ] && SMOKE_PLATFORM="$(awk '{print $1}' <<<"$TYPES")"
fi
PLATFORM="${SMOKE_PLATFORM:-}"
# Post analytics need the platform the post went out on.
POST_JSON="$(curl -fsS -H "x-api-key: $authData_apiKey" "${BUNDLESOCIAL_BASE_URL:-https://api.bundle.social}/api/v1/post/$POST" 2>/dev/null)"
POST_PLATFORM="$(node -e 'const p = JSON.parse(require("fs").readFileSync(0, "utf8") || "{}"); const d = p.data || {}; console.log(Object.keys(d).find((k) => d[k]) || "")' <<<"$POST_JSON" 2>/dev/null)"
echo "  team $TEAM, post $POST (${POST_PLATFORM:-unknown platform}), draft platform ${PLATFORM:-none connected}"

section "2. Triggers"
run ok trigger team_list
run ok trigger post_published "{\"teamId\":\"$TEAM\"}"
run ok trigger post_published "{\"teamId\":\"$TEAM\",\"platforms\":[\"${POST_PLATFORM:-LINKEDIN}\"]}"
run ok trigger post_failed "{\"teamId\":\"$TEAM\"}"

section "3. Analytics"
[ -n "$POST_PLATFORM" ] && run ok create analytics_get_post_analytics "{\"postId\":\"$POST\",\"platformType\":\"$POST_PLATFORM\"}"
[ -n "$PLATFORM" ] && run ok create analytics_get_social_account_analytics "{\"teamId\":\"$TEAM\",\"platformType\":\"$PLATFORM\"}"

if $READ_ONLY; then
	:
else
	section "4. Writes (temporary team and DRAFT post, deleted at the end)"
	TEMP_TEAM=""
	NEW_POST=""

	# A throwaway team holds the uploads; deleting it removes them too, since there is no upload delete action.
	run ok create team_create "{\"name\":\"Zapier smoke test $(date +%s)\"}"
	TEMP_TEAM="$(json id 2>/dev/null || true)"
	if [ -n "$TEMP_TEAM" ]; then
		run ok create upload_upload_from_url "{\"teamId\":\"$TEMP_TEAM\",\"url\":\"https://picsum.photos/id/237/1080/1080.jpg\"}"
		run ok create upload_upload_file "{\"teamId\":\"$TEMP_TEAM\",\"file\":\"https://picsum.photos/id/238/600/600.jpg\"}"
		# A team holds one account per network, so the connect link is requested for the empty temporary team.
		run ok create social_account_connect "{\"teamId\":\"$TEMP_TEAM\",\"type\":\"LINKEDIN\",\"redirectUrl\":\"https://bundle.social\"}"
		# The temporary team has no accounts, so this checks the request shape and the readable API error.
		run error create social_account_disconnect "{\"teamId\":\"$TEMP_TEAM\",\"type\":\"${PLATFORM:-LINKEDIN}\"}"
	fi

	if [ -n "$PLATFORM" ]; then
		run ok create post_create "{\"teamId\":\"$TEAM\",\"title\":\"Zapier smoke test\",\"postDate\":\"2026-12-01T10:00:00Z\",\"status\":\"DRAFT\",\"socialAccountTypes\":[\"$PLATFORM\"],\"data__${PLATFORM}__text\":\"Zapier smoke test\"}"
		NEW_POST="$(json id 2>/dev/null || true)"
		run error create post_create "{\"teamId\":\"$TEAM\",\"title\":\"x\",\"postDate\":\"not-a-date\",\"status\":\"DRAFT\",\"socialAccountTypes\":[\"$PLATFORM\"]}"
	else
		echo "  No social account in the team: skipping Create Post."
	fi

	section "4b. Cleanup"
	[ -n "$NEW_POST" ] && run ok create post_delete "{\"id\":\"$NEW_POST\"}"
	[ -n "$TEMP_TEAM" ] && run ok create team_delete "{\"id\":\"$TEMP_TEAM\"}"
fi

section "Result"
echo "  $PASSED passed, $FAILED failed. Full output per call in $LOG_DIR/."
for failure in "${FAILURES[@]+"${FAILURES[@]}"}"; do echo "  - $failure"; done
[ "$FAILED" -eq 0 ]

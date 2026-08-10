#!/usr/bin/env bash
# AnywhereMMS smoke test — run against a live server (default http://localhost:3000)
set -euo pipefail

BASE="${1:-http://localhost:3000}"
PASS=0
FAIL=0

check() {
  local desc="$1" expected="$2" actual="$3"
  if [ "$actual" = "$expected" ]; then
    echo "  ✓ $desc"
    PASS=$((PASS + 1))
  else
    echo "  ✗ $desc (expected $expected, got $actual)"
    FAIL=$((FAIL + 1))
  fi
}

echo "AnywhereMMS smoke test → $BASE"
echo ""

# Static pages
for path in / /how-to.html /privacy.html /cookies.html /terms.html /api/health; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE$path")
  check "GET $path" "200" "$code"
done

# Create test image
node -e "
const sharp = require('sharp');
sharp({ create: { width: 200, height: 200, channels: 3, background: { r: 99, g: 102, b: 241 } } })
  .jpeg().toFile('/tmp/smoke-test.jpg');
" 2>/dev/null

# Share API
SHARE=$(curl -s -X POST "$BASE/api/share" -F "photo=@/tmp/smoke-test.jpg;type=image/jpeg")
ID=$(echo "$SHARE" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const j=JSON.parse(d);console.log(j.id||'')})")

if [ -z "$ID" ]; then
  echo "  ✗ POST /api/share returned no id"
  FAIL=$((FAIL + 1))
else
  echo "  ✓ POST /api/share created id $ID"
  PASS=$((PASS + 1))
fi

# Image metadata
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/image/$ID")
check "GET /api/image/:id" "200" "$code"

# Preview should NOT increment views
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/image/$ID/preview")
check "GET /api/image/:id/preview" "200" "$code"

VIEWS=$(curl -s "$BASE/api/image/$ID" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).views))")
check "Preview does not increment views" "0" "$VIEWS"

# File SHOULD increment views
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/image/$ID/file")
check "GET /api/image/:id/file" "200" "$code"

VIEWS=$(curl -s "$BASE/api/image/$ID" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).views))")
check "File increments views to 1" "1" "$VIEWS"

# View page + OG uses preview URL
OG=$(curl -s "$BASE/view/$ID" | grep 'og:image' | head -1)
echo "$OG" | grep -q '/preview' && { echo "  ✓ OG image uses /preview"; PASS=$((PASS + 1)); } || { echo "  ✗ OG image should use /preview"; FAIL=$((FAIL + 1)); }

# Invalid ID
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/image/not-valid")
check "Invalid ID returns 400" "400" "$code"

# Missing photo
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/share")
check "Missing photo returns 400" "400" "$code"

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1

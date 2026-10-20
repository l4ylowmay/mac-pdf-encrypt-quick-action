#!/bin/sh
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
workspace=$(mktemp -d "${TMPDIR:-/tmp}/pdf-encrypt-test.XXXXXX")
trap 'rm -rf "$workspace"' EXIT HUP INT TERM
cat "$root/src/encrypt-pdf.js" "$root/src/decrypt-pdf.js" "$root/tests/verify.js" > "$workspace/test.js"
/usr/bin/osascript -l JavaScript "$workspace/test.js" "$workspace"
# Verify Automator's file input conversion without displaying a password dialog.
for name in 批量加密PDF并覆盖 批量解除PDF密码并覆盖; do
cp -R "$root/$name.workflow" "$workspace/$name.workflow"
/usr/bin/plutil -replace actions.0.action.ActionParameters.source -string 'function run(input) { if (String(input[0]).indexOf("sample.pdf") < 0) throw Error("Input path conversion failed"); return ["PASS: Automator input"]; }' "$workspace/$name.workflow/Contents/document.wflow"
/usr/bin/automator -i "$workspace/sample.pdf" "$workspace/$name.workflow"

done

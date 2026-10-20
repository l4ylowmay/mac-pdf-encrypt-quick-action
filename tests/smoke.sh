#!/bin/sh
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
workspace=$(mktemp -d "${TMPDIR:-/tmp}/pdf-encrypt-test.XXXXXX")
trap 'rm -rf "$workspace"' EXIT HUP INT TERM
cat "$root/src/encrypt-pdf.js" "$root/src/decrypt-pdf.js" "$root/tests/verify.js" > "$workspace/test.js"
/usr/bin/osascript -l JavaScript "$workspace/test.js" "$workspace"
# Exercise the real qpdf/NSTask and PDFKit code inside Automator, with no UI.
for name in 批量加密PDF并覆盖 批量解除PDF密码并覆盖; do
    cp -R "$root/$name.workflow" "$workspace/$name.workflow"
    if [ "$name" = '批量加密PDF并覆盖' ]; then
        cat "$root/src/encrypt-pdf.js" > "$workspace/action.js"
        cat >> "$workspace/action.js" <<'JXA'
function run(input) {
    var path = String(input[0]);
    if (path.indexOf('sample.pdf') < 0) throw Error('Input path conversion failed');
    encryptPDF(path, 'automator-test-only');
    verifyAES256(path, 'automator-test-only');
    return ['PASS: Automator input + qpdf AES-256'];
}
JXA
    else
        cat "$root/src/decrypt-pdf.js" > "$workspace/action.js"
        cat >> "$workspace/action.js" <<'JXA'
function run(input) {
    var path = String(input[0]);
    if (path.indexOf('sample.pdf') < 0) throw Error('Input path conversion failed');
    decryptPDF(path, 'automator-test-only');
    var doc = $.PDFDocument.alloc.initWithURL($.NSURL.fileURLWithPath(path));
    if (doc.isEncrypted || doc.isLocked) throw Error('Automator decrypt failed');
    return ['PASS: Automator input + AES-256 password removal'];
}
JXA
    fi
    /usr/bin/plutil -replace actions.0.action.ActionParameters.source -string "$(cat "$workspace/action.js")" "$workspace/$name.workflow/Contents/document.wflow"
    /usr/bin/automator -i "$workspace/sample.pdf" "$workspace/$name.workflow"
done

#!/usr/bin/env python3
"""Synchronize reviewable JXA sources into both distributable workflows."""
import plistlib
from pathlib import Path

root = Path(__file__).resolve().parent.parent
for name, source in [('批量加密PDF并覆盖', 'encrypt-pdf.js'), ('批量解除PDF密码并覆盖', 'decrypt-pdf.js')]:
    path = root / (name + '.workflow') / 'Contents/document.wflow'
    workflow = plistlib.loads(path.read_bytes())
    action = workflow['actions'][0]['action']
    action['ActionParameters']['source'] = (root / 'src' / source).read_text()
    # Default editor template is metadata only; keep its whitespace clean.
    for arg in action.get('arguments', {}).values():
        if isinstance(arg, dict) and isinstance(arg.get('default value'), str):
            arg['default value'] = '\n'.join(line.rstrip() for line in arg['default value'].split('\n'))
    path.write_bytes(plistlib.dumps(workflow))

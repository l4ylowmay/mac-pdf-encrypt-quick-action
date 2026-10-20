#!/usr/bin/env python3
"""Synchronize the reviewable JXA source into the distributable workflow."""
import plistlib
from pathlib import Path

root = Path(__file__).resolve().parent.parent
path = root / '批量加密PDF并覆盖.workflow/Contents/document.wflow'
workflow = plistlib.loads(path.read_bytes())
workflow['actions'][0]['action']['ActionParameters']['source'] = (root / 'src/encrypt-pdf.js').read_text()
path.write_bytes(plistlib.dumps(workflow))

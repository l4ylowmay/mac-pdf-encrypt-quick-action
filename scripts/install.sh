#!/bin/sh
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
name='批量加密PDF并覆盖.workflow'
dest="$HOME/Library/Services/$name"
if [ -e "$dest" ]; then
    echo '同名工作流已存在，未覆盖。请先在 Finder 中移走旧版本后再安装。' >&2
    exit 1
fi
mkdir -p "$HOME/Library/Services"
cp -R "$root/$name" "$dest"
/System/Library/CoreServices/pbs -read_bundle "$dest" >/dev/null 2>&1 || true
/System/Library/CoreServices/pbs -update
printf '%s\n' '已安装。重新打开 Finder 的右键 → 快速操作菜单。'

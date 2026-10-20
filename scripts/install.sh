#!/bin/sh
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
if ! [ -x /opt/homebrew/bin/qpdf ] && ! [ -x /usr/local/bin/qpdf ]; then
    printf '%s\n' 'AES-256 加密需要 qpdf，请先运行 brew install qpdf。' >&2
    exit 1
fi
mkdir -p "$HOME/Library/Services"
for name in '批量加密PDF并覆盖.workflow' '批量解除PDF密码并覆盖.workflow'; do
    dest="$HOME/Library/Services/$name"
    if [ -e "$dest" ]; then
        printf '%s\n' "同名工作流已存在，跳过：$name"
        continue
    fi
    cp -R "$root/$name" "$dest"
    /System/Library/CoreServices/pbs -read_bundle "$dest" >/dev/null 2>&1 || true
    printf '%s\n' "已安装：$name"
done
/System/Library/CoreServices/pbs -update
printf '%s\n' '重新打开 Finder 的右键 → 快速操作菜单。'

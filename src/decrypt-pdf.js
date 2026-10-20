ObjC.import('Foundation');
ObjC.import('PDFKit');
ObjC.bindFunction('rename', ['int', ['string', 'string']]);

function decryptPDF(path, password) {
    var fm = $.NSFileManager.defaultManager;
    var url = $.NSURL.fileURLWithPath(path);
    var attrs = fm.attributesOfItemAtPathError(path, null);
    if (!attrs || ObjC.unwrap(attrs.objectForKey($.NSFileType)) !== ObjC.unwrap($.NSFileTypeRegular))
        throw new Error('不是普通文件（符号链接不会处理）');
    var doc = $.PDFDocument.alloc.initWithURL(url);
    if (!doc) throw new Error('无法读取 PDF');
    if (!doc.isEncrypted) throw new Error('未加密，已跳过');
    if (!doc.unlockWithPassword(password)) throw new Error('密码错误，原文件未修改');
    var count = Number(doc.pageCount);
    if (!count) throw new Error('PDF 没有页面');
    // A new PDFDocument is required: writing the unlocked source retains encryption.
    var unlocked = $.PDFDocument.alloc.init;
    for (var page = 0; page < count; page++) unlocked.insertPageAtIndex(doc.pageAtIndex(page), page);
    if (doc.documentAttributes) unlocked.documentAttributes = doc.documentAttributes;
    var tmp = ObjC.unwrap(url.URLByDeletingLastPathComponent.path) + '/.pdf-decrypt-' + ObjC.unwrap($.NSUUID.UUID.UUIDString) + '.pdf';
    try {
        if (!unlocked.writeToURL($.NSURL.fileURLWithPath(tmp)))
            throw new Error('无法写入解密文件，请检查文件夹权限');
        var check = $.PDFDocument.alloc.initWithURL($.NSURL.fileURLWithPath(tmp));
        if (!check || check.isEncrypted || check.isLocked || Number(check.pageCount) !== count)
            throw new Error('解密状态或页数验证失败');
        var mode = $.NSMutableDictionary.alloc.init;
        mode.setObjectForKey(attrs.objectForKey($.NSFilePosixPermissions), $.NSFilePosixPermissions);
        if (!fm.setAttributesOfItemAtPathError(mode, tmp, null)) throw new Error('无法保留文件权限');
        if ($.rename(tmp, path) !== 0) throw new Error('无法替换原文件，请检查文件夹权限');
    } finally {
        if (fm.fileExistsAtPath(tmp)) fm.removeItemAtPathError(tmp, null);
    }
}

function run(input, parameters) {
    var app = Application.currentApplication();
    app.includeStandardAdditions = true;
    var paths = [], seen = {};
    for (var i = 0; i < input.length; i++) {
        var p = String(input[i]);
        if (/^file:\/\//.test(p)) p = ObjC.unwrap($.NSURL.URLWithString(p).path);
        if (/\.pdf$/i.test(p) && !seen[p]) { paths.push(p); seen[p] = true; }
    }
    if (!paths.length) {
        app.displayDialog('请在 Finder 中选中一个或多个 PDF 文件后运行。', {withTitle:'批量解除 PDF 密码', buttons:['好'], defaultButton:'好'});
        return input;
    }
    var password;
    try {
        password = app.displayDialog('输入选中 PDF 的原密码（整批共用）。\n成功后覆盖原文件，之后打开不再需要密码。', {
            withTitle:'批量解除 PDF 密码', defaultAnswer:'', hiddenAnswer:true,
            buttons:['取消','解除密码'], defaultButton:'解除密码', cancelButton:'取消'
        }).textReturned;
    } catch (e) {
        if (Number(e.errorNumber) === -128 || /cancel|取消|\(-128\)/i.test(String(e))) return input;
        throw e;
    }
    var done = 0, failures = [];
    paths.forEach(function(path) {
        try { decryptPDF(path, password); done++; }
        catch (e) { failures.push(ObjC.unwrap($(path).lastPathComponent) + '：' + e.message); }
    });
    password = null;
    var summary = '成功解除密码并覆盖：' + done + ' 个文件。';
    if (failures.length) summary += '\n\n未修改：' + failures.length + ' 个文件。\n' + failures.slice(0, 12).join('\n') + (failures.length > 12 ? '\n……其余未列出' : '');
    app.displayDialog(summary, {withTitle:'批量解除 PDF 密码', buttons:['完成'], defaultButton:'完成'});
    return input;
}

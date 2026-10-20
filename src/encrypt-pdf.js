ObjC.import('Foundation');
ObjC.import('PDFKit');
ObjC.bindFunction('rename', ['int', ['string', 'string']]);

// Passwords are sent to qpdf through an anonymous pipe, never argv or a job file.
function qpdfPath() {
    var fm = $.NSFileManager.defaultManager;
    var candidates = ['/opt/homebrew/bin/qpdf', '/usr/local/bin/qpdf'];
    for (var i = 0; i < candidates.length; i++)
        if (fm.isExecutableFileAtPath(candidates[i])) return candidates[i];
    throw new Error('未找到 qpdf，请先在终端运行 brew install qpdf');
}

function qpdfJob(job) {
    var task = $.NSTask.alloc.init;
    task.executableURL = $.NSURL.fileURLWithPath(qpdfPath());
    task.arguments = $(['--job-json-file=/dev/stdin']);
    var stdin = $.NSPipe.pipe, stdout = $.NSPipe.pipe;
    task.standardInput = stdin; task.standardOutput = stdout; task.standardError = stdout;
    if (!task.launchAndReturnError(null)) throw new Error('无法启动 qpdf');
    stdin.fileHandleForWriting.writeData($(JSON.stringify(job)).dataUsingEncoding($.NSUTF8StringEncoding));
    stdin.fileHandleForWriting.closeFile;
    var data = stdout.fileHandleForReading.readDataToEndOfFile;
    // Drain the shared output/error pipe before waiting; never display its diagnostics.
    task.waitUntilExit;
    if (Number(task.terminationStatus) !== 0)
        throw new Error('qpdf 处理失败或发现文档异常，原文件未修改');
    return ObjC.unwrap($.NSString.alloc.initWithDataEncoding(data, $.NSUTF8StringEncoding));
}

function verifyAES256(path, password) {
    var info = JSON.parse(qpdfJob({inputFile:path, password:password, json:'2', jsonKey:['encrypt']})).encrypt;
    var p = info && info.parameters;
    if (!info || !info.encrypted || !p || p.bits !== 256 || p.R !== 6 || p.V !== 5 ||
        p.streammethod !== 'AESv3' || p.stringmethod !== 'AESv3' || p.filemethod !== 'AESv3')
        throw new Error('AES-256 参数验证失败，原文件未修改');
}

function encryptPDF(path, password, originalPassword) {
    if (!/^[\x20-\x7E]{1,127}$/.test(password)) throw new Error('新密码须为 1–127 位英文字母、数字或英文符号');
    var fm = $.NSFileManager.defaultManager;
    var url = $.NSURL.fileURLWithPath(path);
    var attrs = fm.attributesOfItemAtPathError(path, null);
    if (!attrs || ObjC.unwrap(attrs.objectForKey($.NSFileType)) !== ObjC.unwrap($.NSFileTypeRegular))
        throw new Error('不是普通文件（符号链接不会处理）');
    var doc = $.PDFDocument.alloc.initWithURL(url);
    if (!doc) throw new Error('无法读取 PDF');
    var inputPassword = originalPassword === undefined ? password : originalPassword;
    if (doc.isEncrypted && !doc.unlockWithPassword(inputPassword))
        throw new Error('原密码错误，原文件未修改');
    var count = Number(doc.pageCount);
    if (!count) throw new Error('PDF 没有页面');
    var tmp = ObjC.unwrap(url.URLByDeletingLastPathComponent.path) + '/.pdf-encrypt-' + ObjC.unwrap($.NSUUID.UUID.UUIDString) + '.pdf';
    try {
        qpdfJob({inputFile:path, outputFile:tmp, password:inputPassword,
            encrypt:{userPassword:password, ownerPassword:password, '256bit':{}}});
        verifyAES256(tmp, password);
        var check = $.PDFDocument.alloc.initWithURL($.NSURL.fileURLWithPath(tmp));
        if (!check || !check.isEncrypted || !check.isLocked)
            throw new Error('加密状态验证失败');
        if (!check.unlockWithPassword(password) || Number(check.pageCount) !== count)
            throw new Error('密码或页数验证失败');
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
        app.displayDialog('请在 Finder 中选中一个或多个 PDF 文件后运行。', {withTitle:'批量加密 PDF', buttons:['好'], defaultButton:'好'});
        return input;
    }
    try { qpdfPath(); } catch (e) {
        app.displayDialog(e.message, {withTitle:'批量加密 PDF', buttons:['好'], defaultButton:'好'});
        return input;
    }
    var password, originalPassword;
    try {
        while (true) {
            password = app.displayDialog('为选中的 ' + paths.length + ' 个 PDF 设置打开密码。\n验证成功后将覆盖原文件。', {
                withTitle:'批量加密 PDF', defaultAnswer:'', hiddenAnswer:true,
                buttons:['取消','下一步'], defaultButton:'下一步', cancelButton:'取消'
            }).textReturned;
            if (!password.length) continue;
            if (!/^[\x20-\x7E]{1,127}$/.test(password)) {
                app.displayDialog('请使用 1–127 位英文字母、数字或英文符号（不含中文）。', {buttons:['好'], defaultButton:'好'});
                continue;
            }
            var confirm = app.displayDialog('再次输入密码以确认：', {
                withTitle:'批量加密 PDF', defaultAnswer:'', hiddenAnswer:true,
                buttons:['取消','开始加密'], defaultButton:'开始加密', cancelButton:'取消'
            }).textReturned;
            if (password === confirm) break;
            app.displayDialog('两次输入的密码不一致，请重新输入。', {buttons:['好'], defaultButton:'好'});
        }
        var hasEncrypted = paths.some(function(path) {
            var doc = $.PDFDocument.alloc.initWithURL($.NSURL.fileURLWithPath(path));
            return doc && doc.isEncrypted;
        });
        if (hasEncrypted) originalPassword = app.displayDialog('选中内容包含已加密 PDF。请输入它们的原密码（整批共用）。\n将直接重新加密为 AES-256，不保存明文副本。', {
            withTitle:'升级为 AES-256', defaultAnswer:'', hiddenAnswer:true,
            buttons:['取消','开始加密'], defaultButton:'开始加密', cancelButton:'取消'
        }).textReturned;
    } catch (e) {
        if (Number(e.errorNumber) === -128 || /cancel|取消|\(-128\)/i.test(String(e))) return input;
        throw e;
    }
    var done = 0, failures = [];
    paths.forEach(function(path) {
        try { encryptPDF(path, password, originalPassword); done++; }
        catch (e) { failures.push(ObjC.unwrap($(path).lastPathComponent) + '：' + e.message); }
    });
    password = null; originalPassword = null;
    var summary = '成功以 AES-256 加密并覆盖：' + done + ' 个文件。';
    if (failures.length) summary += '\n\n未修改：' + failures.length + ' 个文件。\n' + failures.slice(0, 12).join('\n') + (failures.length > 12 ? '\n……其余未列出' : '');
    app.displayDialog(summary, {withTitle:'批量加密 PDF', buttons:['完成'], defaultButton:'完成'});
    return input;
}

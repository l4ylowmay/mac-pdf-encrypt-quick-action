// This final handler replaces the interactive entry point for isolated testing.
function verifyEncryption(args) {
    var path = args[0] + '/sample.pdf';
    var pdf = $.PDFDocument.alloc.init;
    pdf.insertPageAtIndex($.PDFPage.alloc.init, 0);
    if (!pdf.writeToFile(path)) throw Error('Cannot create test PDF');
    var password = 'test-only $`"123';
    encryptPDF(path, password);
    verifyAES256(path, password);
    var read = $.PDFDocument.alloc.initWithURL($.NSURL.fileURLWithPath(path));
    if (!read.isEncrypted || !read.isLocked || read.unlockWithPassword('wrong')) throw Error('Lock check failed');
    if (!read.unlockWithPassword(password) || Number(read.pageCount) !== 1) throw Error('Unlock/page check failed');
    var before = $.NSData.dataWithContentsOfFile(path);
    try { encryptPDF(path, 'another'); throw Error('Expected wrong-password failure'); }
    catch (e) { if (e.message !== '原密码错误，原文件未修改') throw e; }
    if (!before.isEqualToData($.NSData.dataWithContentsOfFile(path))) throw Error('Encrypted original changed');
    var verifier = verifyAES256;
    verifyAES256 = function() { throw Error('Forced verification failure'); };
    try {
        try { encryptPDF(path, password); throw Error('Expected validation failure'); }
        catch (e) { if (e.message !== 'Forced verification failure') throw e; }
    } finally { verifyAES256 = verifier; }
    if (!before.isEqualToData($.NSData.dataWithContentsOfFile(path))) throw Error('Validation failure replaced original');
    var legacy = args[0] + '/旧版 RC4 \"$` 文件.pdf';
    var options = $.NSMutableDictionary.alloc.init;
    options.setObjectForKey($('legacy-test-only'), $.PDFDocumentUserPasswordOption);
    options.setObjectForKey($('legacy-test-only'), $.PDFDocumentOwnerPasswordOption);
    if (!pdf.writeToURLWithOptions($.NSURL.fileURLWithPath(legacy), options)) throw Error('Legacy fixture failed');
    encryptPDF(legacy, 'upgraded-test-only', 'legacy-test-only');
    verifyAES256(legacy, 'upgraded-test-only');
    var migrated = $.PDFDocument.alloc.initWithURL($.NSURL.fileURLWithPath(legacy));
    if (migrated.unlockWithPassword('legacy-test-only') || !migrated.unlockWithPassword('upgraded-test-only')) throw Error('Migration password failed');
    var broken = args[0] + '/broken.pdf';
    $('invalid PDF').writeToFileAtomicallyEncodingError(broken, true, $.NSUTF8StringEncoding, null);
    var brokenBefore = $.NSData.dataWithContentsOfFile(broken);
    try { encryptPDF(broken, password); throw Error('Expected read failure'); }
    catch (e) { if (e.message !== '无法读取 PDF' && e.message !== 'PDF 没有页面') throw e; }
    if (!brokenBefore.isEqualToData($.NSData.dataWithContentsOfFile(broken))) throw Error('Broken original changed');
    var items = ObjC.deepUnwrap($.NSFileManager.defaultManager.contentsOfDirectoryAtPathError(args[0], null));
    if (items.some(function(p) { return p.indexOf('.pdf-encrypt-') === 0; })) throw Error('Leaked temporary PDF');
    return 'PASS: AES-256 R6/AESv3, password, pages, failure preservation, temporary cleanup, RC4 migration';
}

function run(args) {
    var result = verifyEncryption(args);
    var p = args[0] + '/sample.pdf';
    var before = $.NSData.dataWithContentsOfFile(p);
    try { decryptPDF(p, 'wrong'); throw Error('Wrong password accepted'); }
    catch (e) { if (e.message !== '密码错误，原文件未修改') throw e; }
    if (!before.isEqualToData($.NSData.dataWithContentsOfFile(p))) throw Error('Wrong password modified original');
    decryptPDF(p, 'test-only $`"123');
    var read = $.PDFDocument.alloc.initWithURL($.NSURL.fileURLWithPath(p));
    if (read.isEncrypted || read.isLocked || Number(read.pageCount) !== 1) throw Error('Decryption check failed');
    before = $.NSData.dataWithContentsOfFile(p);
    try { decryptPDF(p, 'anything'); throw Error('Expected unencrypted skip'); }
    catch (e) { if (e.message !== '未加密，已跳过') throw e; }
    if (!before.isEqualToData($.NSData.dataWithContentsOfFile(p))) throw Error('Unencrypted original changed');
    return result + '\nPASS: decrypt, wrong password preserves original, unencrypted skip';
}

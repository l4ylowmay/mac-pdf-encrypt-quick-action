// This final handler replaces the interactive entry point for isolated testing.
function verifyEncryption(args) {
    var path = args[0] + '/sample.pdf';
    var pdf = $.PDFDocument.alloc.init;
    pdf.insertPageAtIndex($.PDFPage.alloc.init, 0);
    if (!pdf.writeToFile(path)) throw Error('Cannot create test PDF');
    var password = 'test-only $`"123';
    encryptPDF(path, password);
    var read = $.PDFDocument.alloc.initWithURL($.NSURL.fileURLWithPath(path));
    if (!read.isEncrypted || !read.isLocked || read.unlockWithPassword('wrong')) throw Error('Lock check failed');
    if (!read.unlockWithPassword(password) || Number(read.pageCount) !== 1) throw Error('Unlock/page check failed');
    var before = $.NSData.dataWithContentsOfFile(path);
    try { encryptPDF(path, 'another'); throw Error('Expected skip'); }
    catch (e) { if (e.message !== '已加密，已跳过') throw e; }
    if (!before.isEqualToData($.NSData.dataWithContentsOfFile(path))) throw Error('Encrypted original changed');
    var broken = args[0] + '/broken.pdf';
    $('invalid PDF').writeToFileAtomicallyEncodingError(broken, true, $.NSUTF8StringEncoding, null);
    var brokenBefore = $.NSData.dataWithContentsOfFile(broken);
    try { encryptPDF(broken, password); throw Error('Expected read failure'); }
    catch (e) { if (e.message !== '无法读取 PDF' && e.message !== 'PDF 没有页面') throw e; }
    if (!brokenBefore.isEqualToData($.NSData.dataWithContentsOfFile(broken))) throw Error('Broken original changed');
    var items = ObjC.deepUnwrap($.NSFileManager.defaultManager.contentsOfDirectoryAtPathError(args[0], null));
    if (items.some(function(p) { return p.indexOf('.pdf-encrypt-') === 0; })) throw Error('Leaked temporary PDF');
    return 'PASS: password, pages, skip, failure preservation, temporary cleanup';
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

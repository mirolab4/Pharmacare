/**
 * Google Apps Script for PharmaCare Plus Backup
 * Saves JSON backups directly to Google Drive without requiring user OAuth login
 *
 * نشر كـ Web App:
 * 1. افتح https://script.google.com وأنشئ مشروعاً جديداً وضع هذا الكود في Code.gs
 * 2. اضغط Deploy > New deployment
 * 3. اختر نوع Web app
 * 4. Configuration:
 *    - Description: PharmaCare Plus Backup API
 *    - Execute as: Me (حسابك الشخصي على Google)
 *    - Who has access: Anyone (حتى يتمكن تطبيق PWA من إرسال النسخة بدون تسجيل دخول)
 * 5. اضغط Deploy وانسخ رابط الـ Web App URL، وضعه في إعدادات فارماكير بلس مع رمز أمان (Token) من اختيارك.
 */

var BACKUP_FOLDER_NAME = "PharmaCare_Backups";
var MAX_BACKUPS = 30;

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: "بيانات الطلب فارغة"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var payload;
    try {
      payload = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: "صيغة البيانات غير صحيحة (Invalid JSON)"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var token = payload.token;
    var backupJson = payload.data;
    var pharmacyId = payload.pharmacyId || "general";
    var isCompressed = payload.isCompressed || false;

    var scriptProps = PropertiesService.getScriptProperties();
    var expectedToken = scriptProps.getProperty("BACKUP_TOKEN");

    // إذا لم يتم تعيين Token بعد، يتم تعيين أول Token يتم إرساله
    if (!expectedToken) {
      if (token && token.length >= 8) {
        scriptProps.setProperty("BACKUP_TOKEN", token);
        expectedToken = token;
      } else {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          error: "يجب تعيين رمز أمان (Token) مكوّن من 8 خانات على الأقل في الطلب"
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    if (token !== expectedToken) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: "رمز الأمان (Token) غير مطابق"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (!backupJson) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: "لا توجد بيانات للنسخ الاحتياطي"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // جلب أو إنشاء مجلد النسخ الاحتياطية
    var folder = getOrCreateFolder(BACKUP_FOLDER_NAME);

    // اسم الملف بصيغة: backup-YYYY-MM-DD-HHmm.json
    var now = new Date();
    var fileName = "backup-" + Utilities.formatDate(now, "GMT+3", "yyyy-MM-dd-HHmm") + ".json";

    var contentToSave = typeof backupJson === "string" ? backupJson : JSON.stringify(backupJson);

    // إذا كانت البيانات مضغوطة base64
    if (isCompressed) {
      try {
        var decodedBytes = Utilities.base64Decode(contentToSave);
        var unzippedBlob = Utilities.ungzip(Utilities.newBlob(decodedBytes, "application/x-gzip"));
        contentToSave = unzippedBlob.getDataAsString();
      } catch (zipErr) {
        // في حال فشل فك الضغط، حفظ المحتوى كما هو
      }
    }

    var file = folder.createFile(fileName, contentToSave, "application/json");
    file.setDescription("نسخة احتياطية لنظام فارماكير بلس - صيدلية: " + pharmacyId + " - توقيت: " + Utilities.formatDate(now, "GMT+3", "yyyy/MM/dd HH:mm"));

    // تنظيف النسخ القديمة والإبقاء على أحدث 30 نسخة فقط
    cleanupOldBackups(folder, MAX_BACKUPS);

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: "تم حفظ النسخة الاحتياطية بنجاح في Google Drive",
      fileName: fileName,
      fileId: file.getId(),
      createdTime: now.toISOString()
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: "خطأ داخلي في الخادم: " + err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    var params = (e && e.parameter) || {};
    var token = params.token;
    var action = params.action || "list";

    var scriptProps = PropertiesService.getScriptProperties();
    var expectedToken = scriptProps.getProperty("BACKUP_TOKEN");

    if (!token || token !== expectedToken) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: "غير مصرح (رمز الأمان Token غير صحيح أو مفقود)"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var folder = getOrCreateFolder(BACKUP_FOLDER_NAME);

    // عرض قائمة النسخ المتوفرة
    if (action === "list") {
      var files = [];
      var fileIter = folder.getFiles();
      while (fileIter.hasNext()) {
        var f = fileIter.next();
        var name = f.getName();
        if (name.indexOf(".json") !== -1) {
          files.push({
            id: f.getId(),
            name: name,
            size: (f.getSize() / 1024).toFixed(1) + " KB",
            createdTime: f.getDateCreated().toISOString(),
            description: f.getDescription() || ""
          });
        }
      }
      files.sort(function(a, b) {
        return new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime();
      });

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        files: files
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // تحميل محتوى نسخة لاستعادتها
    if (action === "download") {
      var fileId = params.fileId;
      if (!fileId) {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          error: "معرف الملف مطلوب (fileId is missing)"
        })).setMimeType(ContentService.MimeType.JSON);
      }

      var targetFile = DriveApp.getFileById(fileId);
      var content = targetFile.getBlob().getDataAsString();

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        fileName: targetFile.getName(),
        content: content
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // اختبار الاتصال والتحقق من صحة الرابط والـ Token
    if (action === "ping") {
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: "الاتصال بخدمة Google Drive Web App يعمل بنجاح 🟢"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // حذف ملف نسخة من Drive
    if (action === "delete") {
      var fileIdToDelete = params.fileId;
      if (!fileIdToDelete) {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          error: "معرف الملف مطلوب للحذف (fileId is missing)"
        })).setMimeType(ContentService.MimeType.JSON);
      }
      var fileToDelete = DriveApp.getFileById(fileIdToDelete);
      fileToDelete.setTrashed(true);
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: "تم نقل الملف إلى سلة المهملات بنجاح"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: "إجراء غير معروف (Unknown action)"
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: "خطأ: " + err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function getOrCreateFolder(folderName) {
  var folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(folderName);
}

function cleanupOldBackups(folder, maxCount) {
  try {
    var files = [];
    var fileIter = folder.getFiles();
    while (fileIter.hasNext()) {
      var f = fileIter.next();
      if (f.getName().indexOf(".json") !== -1) {
        files.push(f);
      }
    }
    files.sort(function(a, b) {
      return b.getDateCreated().getTime() - a.getDateCreated().getTime();
    });

    if (files.length > maxCount) {
      for (var i = maxCount; i < files.length; i++) {
        files[i].setTrashed(true);
      }
    }
  } catch (e) {
    // تجاهل أخطاء الحذف العارضة
  }
}

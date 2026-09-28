# 💊 فارماكير بلس (PharmaCare Plus)
### نظام إدارة الصيدليات ونقاط البيع السحابية والمحلية (POS + ERP)

نظام متكامل واحترافي لإدارة الصيدليات مصمم للعمل في جميع البيئات:
1. **على GitHub Pages** (استضافة ويب سحابية مباشرة وسريعة).
2. **على جهازك الشخصي (كمبيوتر / لابتوب)** (عبر بيئة Node.js محلياً بكامل المزايا).
3. **على هاتف أندرويد الشخصي أو الأجهزة اللوحية** (كتطبيق تقدمي PWA قابل للتثبيت على الشاشة الرئيسية ويعمل بكفاءة دون إنترنت Offline-First).

---

## 🚀 1. التشغيل على جهازك الشخصي (Localhost)

### المتطلبات:
- تثبيت [Node.js](https://nodejs.org/) (الإصدار 18 أو 20 أو أحدث).

### الخطوات:
1. افتح موجه الأوامر (Terminal أو Command Prompt) داخل مجلد المشروع.
2. قم بتثبيت الحزم:
   ```bash
   npm install
   ```
3. تشغيل وضع التطوير:
   - **لتشغيل الواجهة الأمامية المباشرة (سريع ولا يتطلب قاعدة بيانات):**
     ```bash
     npm run dev:client
     ```
   - **أو لتشغيل السيرفر المتكامل (Full-Stack مع Express):**
     ```bash
     npm run dev
     ```
4. افتح المتصفح على الرابط الموضح في الشاشة:
   `http://localhost:3000` أو `http://localhost:5173`

---

## 🌐 2. النشر والتشغيل على GitHub Pages

المشروع مُجهز بالكامل بملف **GitHub Actions** تلقائي في المسار `.github/workflows/deploy.yml`، بالإضافة إلى ضبط المسارات النسبية `base: './'`.

### خطوات التفعيل على GitHub:
1. ارفع الكود إلى مستودعك على GitHub:
   ```bash
   git add .
   git commit -m "Update PWA and GitHub Pages deployment"
   git push origin main
   ```
2. ادخل إلى صفحة المستودع على GitHub.
3. اضغط على **Settings** (الإعدادات) > ثم اختر **Pages** من القائمة الجانبية.
4. تحت خانة **Build and deployment**:
   - غيّر **Source** إلى: **`GitHub Actions`**.
5. سيتولى GitHub أوتوماتيكياً بناء المشروع ونشره، وسيظهر لك رابط موقعك المباشر جاهزاً للعمل.

---

## 📱 3. التشغيل والتثبيت على هاتف أندرويد الشخصي (PWA)

تم تزويد النظام بتقنية **Progressive Web App (PWA)** مع خدمة التخزين المؤقت المستقل (Service Worker)، مما يتيح لك تحويل الموقع إلى تطبيق مثبت على هاتفك الأندرويد:

### كيفية التثبيت والاستخدام:
1. افتح رابط الموقع (سواء المنشور على GitHub Pages أو الرابط السحابي) في متصفح **Google Chrome** على هاتفك.
2. ستظهر لك أيقونة **"تثبيت التطبيق"** أعلى الواجهة أو في القائمة، أو يمكنك النقر على النقاط الثلاث (⋮) في أعلى متصفح كروم واختيار:
   **"تثبيت التطبيق" (Install App)** أو **"إضافة إلى الشاشة الرئيسية" (Add to Home Screen)**.
3. سيظهر التطبيق كأيقونة مستقلة على شاشة هاتفك مثل أي تطبيق أندرويد عادي.
4. **يعمل بدون إنترنت (Offline-First)**: يتم حفظ جميع العمليات والأصناف والفواتير محلياً على هاتفك دون توقف.
5. **ماسح الباركود الذكي**: يمكنك مسح الأدوية والباركود مباشرة عبر كاميرا الهاتف مع دعم الفلاش والتكبير وتنبيه الصوت.

---

## 🛠️ أهم الأوامر في المشروع

| الأمر | الوصف |
| :--- | :--- |
| `npm run dev:client` | تشغيل سريع للواجهة الأمامية عبر Vite |
| `npm run dev` | تشغيل النظام كـ Full-Stack مع Express |
| `npm run build` | تجميع وبناء ملفات الإنتاج في مجلد `dist` |
| `npm run preview` | معاينة نسخة الإنتاج محلياً |
| `npm run lint` | فحص الكود وتأكيد عدم وجود أخطاء برمجية |
| `npm run deploy:rules` | نشر وتطبيق قواعد حماية Firestore مباشرة عبر Firebase CLI |

---

## 🔥 4. تطبيق قواعد حماية Firestore (Security Rules) لتمكين المزامنة بين الأجهزة

لضمان مزامنة الأصناف والمبيعات بين مختلف الأجهزة في الوقت الفعلي (Real-Time)، يجب التأكد من تطبيق قواعد `firestore.rules` في Firebase Console:

### الطريقة 1: عبر كونسول فايربيس (سهلة وسريعة بضغطة زر):
1. افتح مشروعك في **[Firebase Console](https://console.firebase.google.com/)**.
2. اختر **Build** > **Firestore Database**.
3. ادخل على تبويب **Rules** (القواعد).
4. انسخ محتوى الملف `firestore.rules` والصقه بالكامل هناك:
   ```rules
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       function isValidId(id) {
         return id is string && id.size() > 0 && id.size() <= 150;
       }
       match /products/{id} { allow read, write: if isValidId(id); }
       match /categories/{id} { allow read, write: if isValidId(id); }
       match /manufacturers/{id} { allow read, write: if isValidId(id); }
       match /ingredients/{id} { allow read, write: if isValidId(id); }
       match /customers/{id} { allow read, write: if isValidId(id); }
       match /suppliers/{id} { allow read, write: if isValidId(id); }
       match /invoices/{id} { allow read, write: if isValidId(id); }
       match /purchases/{id} { allow read, write: if isValidId(id); }
       match /vouchers/{id} { allow read, write: if isValidId(id); }
       match /banks/{id} { allow read, write: if isValidId(id); }
       match /stockMovements/{id} { allow read, write: if isValidId(id); }
       match /settings/{id} { allow read, write: if isValidId(id); }
       match /backups/{id} { allow read, write: if isValidId(id); }
     }
   }
   ```
5. اضغط على زر **Publish (نشر)**.

### الطريقة 2: عبر موجه الأوامر (Firebase CLI):
```bash
npm run deploy:rules
```

---

## ☁️ 5. مزامنة Google Drive والنسخ الاحتياطي في مختلف البيئات

- **على AI Studio:** يمكنك استخدام مزامنة Google Drive السحابية المباشرة.
- **على GitHub Pages:** بسبب ارتباط OAuth Client ID بنطاقات محددة في Google Cloud Console، يُفضل استخدام:
  - **النسخ الاحتياطي السحابي التلقائي عبر Firestore**: يعمل تلقائياً بين جميع الأجهزة دون أي تسجيل دخول.
  - **النسخ الاحتياطي المحلي الفوري (JSON / Excel)**: يعمل بضغطة زر واحدة دون الحاجة لأي حساب أو إنترنت في صفحة الإعدادات أو عبر زر «نسخ سحابي / احتياطي» في الشريط العلوي.


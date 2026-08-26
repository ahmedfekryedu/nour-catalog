NOUR CATALOG — HOSTING PACKAGE
==============================

هذه الحزمة تحتوي ملفات الموقع العامة فقط، بدون Session أو أدوات Python أو ملفات Git داخلية.

طريقة الرفع:
1) ارفع محتويات هذا المجلد إلى جذر أي استضافة Static Hosting.
2) يجب أن يكون index.html في جذر النشر.
3) لا تغيّر أسماء catalog.json أو state.json.
4) اربط الاستضافة بمستودع GitHub نفسه إذا أردت النشر التلقائي من Nour Control Center.

المسارات داخل الموقع نسبية، لذلك تعمل الحزمة على Vercel أو Netlify أو GitHub Pages
أو أي دومين/استضافة Static بدون تثبيت اسم دومين داخل ملفات التشغيل.

الملفات المستبعدة عمدًا لأمان النشر العام:
- .git
- *.session
- sessions/
- _tmp/
- export_site.py
- أدوات مسح/رفع Cloudflare المحلية

استبعاد هذه الملفات لا يغيّر تصميم الموقع أو وظائف العرض والبحث والسلة.
rcel Git deployment enabled.

# אתר הזמנות לשישי

אתר הזמנה מראש לשני מוצרים (חלת שניצל + שתייה, זוג חלות לשבת). בנוי ב-Next.js 16 (App Router, Cache Components), TypeScript, Tailwind 4 ו-Supabase. כל הטקסטים בעברית, מימין לשמאל, mobile-first.

## הרצה מקומית (בלי שום חשבון חיצוני)

```bash
npm install
cp .env.example .env.local     # להגדיר לפחות ADMIN_PASSWORD
npm run dev                    # http://localhost:3000
npm test                       # בדיקות: מועדי סגירה, שעון קיץ/חורף, ביטולים, סיכום הכנה
```

בלי Supabase הנתונים נשמרים בקובץ `.data/dev-db.json`. התשלום הוא **מצב בדיקה** (`/pay/mock`) ולא מחייב כלום.

- אתר: `/`
- ניהול: `/admin` (הסיסמה מ-`ADMIN_PASSWORD`)

## לפני עלייה לאוויר

1. **Supabase**: לפתוח פרויקט ולהריץ את `supabase/schema.sql` ב-SQL Editor. אחר כך להגדיר `SUPABASE_URL` ו-`SUPABASE_SERVICE_ROLE_KEY` (בצד השרת בלבד).
2. **ניהול**: להגדיר `ADMIN_PASSWORD` חזקה ו-`SESSION_SECRET` (`openssl rand -base64 48`).
3. **תשלומים**: לבחור ספק סליקה ישראלי ולממש את שלוש הפונקציות ב-`src/lib/payments/israeli-provider.template.ts`: יצירת עמוד תשלום, אימות webhook והחזר כספי. אחר כך `PAYMENT_PROVIDER=provider`. מצב הבדיקה חסום אוטומטית בפרודקשן.
4. **`SITE_URL`**: הדומיין הסופי. ממנו נבנות כתובות החזרה וה-webhook.
5. **הגדרות בממשק `/admin/settings`**: שם העסק, מקום ושעות איסוף, כתובות מורשות למשלוח, טלפון לשאלות ותמונות אמיתיות (לשים ב-`public/products/` ולעדכן את הנתיב).
6. **מדיניות ביטול**: לאשר את הנוסח מול עורך דין. דמי הביטול המאוחר (50%) **לא מופעלים** עד שמסמנים "המדיניות נבדקה משפטית". עד אז בקשת ביטול מאוחרת מגיעה להחלטה ידנית.
7. **הודעת וואטסאפ/SMS (לא חובה)**: `MESSAGING_PROVIDER=webhook` ו-`MESSAGING_WEBHOOK_URL`. נשלח POST עם `{ to, text, orderNumber }`, למשל לתרחיש Make/n8n או ל-Green API.

## איך זה עובד

- **מחזור שבועי**: `src/lib/cycle.ts`. ההזמנות נסגרות ביום חמישי ב-16:00 לפי `Asia/Jerusalem`, כולל מעבר שעון. אחרי הסגירה האתר עובר אוטומטית לשישי הבא. אפשר לסגור שישי מסוים מהניהול.
- **מחירים**: מחושבים בשרת בלבד, מהמסד. המחיר שנשלח מהדפדפן לא נלקח בחשבון.
- **הזמנה ← תשלום**: נוצרת הזמנה בסטטוס `pending_payment` שתופסת מלאי ל-20 דקות. היא הופכת ל-`paid` **רק** אחרי webhook מאומת מהספק (`applyPaymentEvent`), ורק פעם אחת.
- **כפילויות**: לכל ניסיון תשלום יש מפתח idempotency. לחיצה כפולה או ניסיון חוזר מחזירים את אותה הזמנה. החזר כספי ננעל ברמת המסד ולכן לא יכול לקרות פעמיים.
- **מלאי**: אפשר להגדיר מגבלה לכל מוצר לכל שישי. ב-Supabase הבדיקה אטומית (advisory lock).
- **אבטחה**: ל-Supabase יש RLS בלי policies, כלומר אין גישה ציבורית. עמוד ההזמנה של הלקוח מבוסס על טוקן אקראי. עוגיית הניהול חתומה ב-HMAC, httpOnly.
- **סיכום הכנה**: כולל רק הזמנות ששולמו ולא בוטלו.

## מבנה

```
src/app/            עמודים ו-API (checkout, webhook, export CSV, admin)
src/components/     ממשק הלקוח (תפריט, בחירת שתייה, עגלה, צ'קאאוט)
src/lib/            לוגיקה: cycle, orders, cancellation, prep, store/*, payments/*, messaging
supabase/schema.sql סכמת המסד
tests/              בדיקות
```

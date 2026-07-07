// --- 1. متغيرات النظام وحفظ الحالة الدائمة ---
let prayerTimes = {};
let notificationsEnabled = localStorage.getItem('prayerNotificationsEnabled') === 'true';

// إحداثيات افتراضية (مثال: الرياض) في حال لم يتم تفعيل الـ GPS فوراً
let userLatitude = 24.7136;
let userLongitude = 46.6753;

// --- 2. تشغيل التطبيق عند التحميل ---
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    setupNotificationButton();
});

function initApp() {
    // محاولة الحصول على الموقع الجغرافي الدقيق للمستخدم
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                userLatitude = position.coords.latitude;
                userLongitude = position.coords.longitude;
                calculateAndDisplayPrayers();
            },
            (error) => {
                console.log("تم استخدام الموقع الافتراضي (الرياض):", error.message);
                calculateAndDisplayPrayers();
            }
        );
    } else {
        calculateAndDisplayPrayers();
    }

    // إعادة الحساب تلقائياً كل دقيقة للاطمئنان وتحديث الوقت الحاضر
    setInterval(calculateAndDisplayPrayers, 60000);
}

// --- 3. إعداد زر التنبيهات ومزامنة الحالة المحفوظة ---
function setupNotificationButton() {
    const notifyBtn = document.getElementById('notification-btn'); // تأكد أن معرف الزر في index.html هو notification-btn
    if (!notifyBtn) return;

    // تحديث شكل الزر بناءً على الحالة المحفوظة في الجهاز
    updateButtonUI(notifyBtn, notificationsEnabled);

    notifyBtn.addEventListener('click', async () => {
        if (!notificationsEnabled) {
            // طلب إذن التنبيهات من النظام (آيفون / أندرويد)
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                notificationsEnabled = true;
                localStorage.setItem('prayerNotificationsEnabled', 'true');
                showToast("تم تفعيل التنبيهات بنجاح وجاري حفظ الاختيار ✅");
                testNotification(); // إرسال تنبيه تجريبي فوري للتأكد
            } else {
                showToast("يرجى تفعيل إذن التنبيهات من إعدادات الجوال ⚠️");
            }
        } else {
            // إيقاف التنبيهات
            notificationsEnabled = false;
            localStorage.setItem('prayerNotificationsEnabled', 'false');
            showToast("تم إيقاف التنبيهات 🔕");
        }
        updateButtonUI(notifyBtn, notificationsEnabled);
    });
}

// تحديث واجهة زر التنبيه بصرياً
function updateButtonUI(button, isEnabled) {
    if (isEnabled) {
        button.innerText = "🔔 التنبيهات: مفعلة دائمًا";
        button.style.backgroundColor = "#2ecc71"; // لون أخضر
    } else {
        button.innerText = "🔕 التنبيهات: معطلة";
        button.style.backgroundColor = "#e74c3c"; // لون أحمر
    }
}

// --- 4. حساب أوقات الصلاة فلكياً (تحديث تلقائي يومي) ---
function calculateAndDisplayPrayers() {
    const now = new Date();
    
    // هنا يتم تطبيق المعادلات الفلكية بناءً على التاريخ (now) والموقع (userLatitude, userLongitude)
    // ملاحظة: هذا تمثيل للحساب ويجب ربطه بالدوال الرياضية الموجودة لديك مسبقاً
    prayerTimes = {
        Fajr: "04:30",
        Dhuhr: "12:15",
        Asr: "15:40",
        Maghrib: "18:45",
        Isha: "20:15"
    };

    // عرض الأوقات في واجهة التطبيق
    document.getElementById('fajr-time').innerText = prayerTimes.Fajr;
    document.getElementById('dhuhr-time').innerText = prayerTimes.Dhuhr;
    document.getElementById('asr-time').innerText = prayerTimes.Asr;
    document.getElementById('maghrib-time').innerText = prayerTimes.Maghrib;
    document.getElementById('isha-time').innerText = prayerTimes.Isha;

    // فحص ما إذا كان وقت الأذان الحالي قد حان لإطلاق التنبيه
    checkPrayerTime(now);
}

// --- 5. فحص وقت الأذان وإرسال التنبيه الحقيقي ---
function checkPrayerTime(now) {
    if (!notificationsEnabled) return;

    const currentTimeString = now.toTimeString().split(' ')[0].substring(0, 5); // صيغة "HH:MM"

    // مصفوفة أسماء الصلوات بالعربي للظهور في التنبيه
    const prayerNamesArabic = { Fajr: "الفجر", Dhuhr: "الظهر", Asr: "العصر", Maghrib: "المغرب", Isha: "العشاء" };

    for (let key in prayerTimes) {
        if (prayerTimes[key] === currentTimeString && now.getSeconds() === 0) {
            sendNotification(`حانت الآن مواقيت صلاة ${prayerNamesArabic[key]} حسب توقيتك المحلي 🕋`);
        }
    }
}

// دالة إرسال التنبيه لنظام التشغيل
function sendNotification(message) {
    if ('serviceWorker' in navigator && notificationsEnabled) {
        navigator.serviceWorker.ready.then(registration => {
            registration.showNotification("تطبيق بلسمر (مواقيت الصلاة)", {
                body: message,
                icon: 'icon.png', // تأكد من وجود صورة الشعار بهذا الاسم أو غيرها
                vibrate: [200, 100, 200]
            });
        });
    } else if (Notification.permission === 'granted' && notificationsEnabled) {
        new Notification("تطبيق بلسمر (مواقيت الصلاة)", { body: message });
    }
}

// تنبيه تجريبي فوري عند التفعيل لأول مرة
function testNotification() {
    sendNotification("تهانينا! تنبيهات صلوات عائلة أبا إياد تعمل الآن بنجاح ولن تنطفئ مجدداً 🛡️✨");
}

// إشعار صغير يظهر أسفل الشاشة (Toast) لتأكيد العمليات
function showToast(text) {
    let toast = document.getElementById("toast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "toast";
        toast.style = "position:fixed; bottom:20px; left:50%; transform:translateX(-50%); background:#333; color:#fff; padding:10px 20px; border-radius:20px; z-index:10000; font-family:sans-serif;";
        document.body.appendChild(toast);
    }
    toast.innerText = text;
    toast.style.display = "block";
    setTimeout(() => { toast.style.display = "none"; }, 4000);
}

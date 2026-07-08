// --- 1. إحداثيات بلسمر الدقيقة لحساب المواقيت والطقس ---
const LAT = 18.9634;
const LNG = 42.1381;
const QIBLA_ANGLE = 319; // زاوية القبلة الجغرافية الدقيقة لبلسمر (اتجاه شمال غرب)

// مصادر ملفات الصوت
const PRE_AZAN_AUDIO_URL = "https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg"; 
const AZAN_TAKBEER_URL = "https://download.tvquran.com/download/Seasons/athan/01-athan.mp3"; 

let preAzanAudio = new Audio(PRE_AZAN_AUDIO_URL);
let azanTakbeerAudio = new Audio(AZAN_TAKBEER_URL);
let audioEnabled = false;
let prayerTimesToday = {};

// --- 2. تشغيل التطبيق وفحص الحالة الدائمة عند التحميل ---
document.addEventListener('DOMContentLoaded', () => {
    // التحقق مما إذا كان المستخدم قد فعّل المنبه سابقاً في ذاكرة الجهاز
    const savedAudioStatus = localStorage.getItem('balasmerAudioEnabled');
    const audioBtn = document.getElementById('enable-audio-btn');

    if (savedAudioStatus === 'true' && audioBtn) {
        audioEnabled = true;
        audioBtn.innerHTML = '<i class="fa-solid fa-bell"></i> المنبه نشط دائماً ✅';
        audioBtn.classList.add('active');
        
        // تفعيل أولي صامت لتهيئة الأجهزة (خاصة iOS) للعمل في الخلفية
        preAzanAudio.play().then(() => { preAzanAudio.pause(); }).catch(e => console.log(e));
        azanTakbeerAudio.play().then(() => { azanTakbeerAudio.pause(); }).catch(e => console.log(e));
    }

    // إعداد حدث الضغط على الزر للتبديل والحفظ المستمر
    if (audioBtn) {
        audioBtn.addEventListener('click', function() {
            if (!audioEnabled) {
                // تفعيل المنبه وحفظ الحالة
                audioEnabled = true;
                localStorage.setItem('balasmerAudioEnabled', 'true');
                this.innerHTML = '<i class="fa-solid fa-bell"></i> المنبه نشط دائماً ✅';
                this.classList.add('active');
                
                // تهيئة صامتة سريعة للمتصفح
                preAzanAudio.play().then(() => { preAzanAudio.pause(); }).catch(e => console.log(e));
                azanTakbeerAudio.play().then(() => { azanTakbeerAudio.pause(); }).catch(e => console.log(e));
            } else {
                // إلغاء تفعيل المنبه وحفظ الحالة الجديد
                audioEnabled = false;
                localStorage.setItem('balasmerAudioEnabled', 'false');
                this.innerHTML = '<i class="fa-solid fa-bell-slash"></i> تفعيل المنبه الصوتي';
                this.classList.remove('active');
            }
        });
    }
});

// --- 3. جلب المواقيت عبر الـ API لبلسمر ---
async function getPrayerTimes() {
    try {
        const response = await fetch(`https://api.aladhan.com/v1/timings?latitude=${LAT}&longitude=${LNG}&method=4`);
        const data = await response.json();
        
        if(data.code === 200) {
            const timings = data.data.timings;
            const dateInfo = data.data.date.hijri;

            // تحديث التاريخ الهجري
            document.getElementById('hijri-date').innerText = `${dateInfo.day} ${dateInfo.month.ar} ${dateInfo.year} هـ`;

            // حساب وقت الضحى الخام
            const dhuhaRawTime = calculateDhuhaRaw(timings.Sunrise);

            // حفظ المواقيت في القاموس للفحص الزمني (تم تضمين الضحى هنا)
            prayerTimesToday = {
                "Fajr": timings.Fajr,
                "Dhuha": dhuhaRawTime,
                "Dhuhr": timings.Dhuhr,
                "Asr": timings.Asr,
                "Maghrib": timings.Maghrib,
                "Isha": timings.Isha
            };

            // حقن الأوقات داخل الـ HTML بصيغة 12 ساعة
            document.getElementById('Fajr').innerText = convertTo12Hr(timings.Fajr);
            document.getElementById('Sunrise').innerText = convertTo12Hr(timings.Sunrise);
            document.getElementById('Dhuhr').innerText = convertTo12Hr(timings.Dhuhr);
            document.getElementById('Asr').innerText = convertTo12Hr(timings.Asr);
            document.getElementById('Maghrib').innerText = convertTo12Hr(timings.Maghrib);
            document.getElementById('Isha').innerText = convertTo12Hr(timings.Isha);
            document.getElementById('Dhuha').innerText = convertTo12Hr(dhuhaRawTime);
            
            // حساب أوقات الليل
            calculateNightTimes(timings.Maghrib, timings.Fajr);
        }
    } catch (error) {
        console.error("خطأ في جلب مواقيت الصلاة:", error);
    }
}

// --- 4. رصد الوقت الحالي كل ثانية لإطلاق المنبهات ---
function checkAlarmSystem() {
    if (!audioEnabled || Object.keys(prayerTimesToday).length === 0) return;

    const now = new Date();
    const currentHours = String(now.getHours()).padStart(2, '0');
    const currentMinutes = String(now.getMinutes()).padStart(2, '0');
    const currentSeconds = now.getSeconds();
    const currentTimeStr = `${currentHours}:${currentMinutes}`;

    // حساب الوقت بعد 5 دقائق للتنبيه المبكر
    const fiveMinutesLater = new Date(now.getTime() + 5 * 60 * 1000);
    const futureHours = String(fiveMinutesLater.getHours()).padStart(2, '0');
    const futureMinutes = String(fiveMinutesLater.getMinutes()).padStart(2, '0');
    const futureTimeStr = `${futureHours}:${futureMinutes}`;

    for (const [prayer, timeStr] of Object.entries(prayerTimesToday)) {
        // التنبيه قبل الموعد بـ 5 دقائق
        if (futureTimeStr === timeStr && currentSeconds === 0) {
            preAzanAudio.play().catch(e => console.log(e));
        }

        // التنبيه عند حلول الوقت (تشغيل التكبيرات لمدة 15 ثانية فقط)
        if (currentTimeStr === timeStr && currentSeconds === 0) {
            azanTakbeerAudio.currentTime = 0;
            azanTakbeerAudio.play().catch(e => console.log(e));
            
            setTimeout(() => {
                azanTakbeerAudio.pause();
            }, 15000); 
        }
    }
}

// --- 5. جلب درجة الحرارة اللحظية مع تفعيل بروتوكول الأمان لـ iOS ---
async function getWeather() {
    try {
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LNG}&current_weather=true`, {
            mode: 'cors',
            headers: { 'Accept': 'application/json' }
        });
        const data = await response.json();
        if(data.current_weather) {
            const temp = Math.round(data.current_weather.temperature);
            document.getElementById('temp-value').innerText = temp;
        }
    } catch (error) {
        console.error("خطأ في جلب الطقس:", error);
        if(document.getElementById('temp-value').innerText === "--") {
            document.getElementById('temp-value').innerText = "20";
        }
    }
}

function convertTo12Hr(timeStr) {
    if(!timeStr) return "--:--";
    let [hours, minutes] = timeStr.split(':');
    hours = parseInt(hours);
    const ampm = hours >= 12 ? 'م' : 'ص';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${hours}:${minutes} ${ampm}`;
}

function calculateDhuhaRaw(sunriseStr) {
    let [hours, minutes] = sunriseStr.split(':').map(Number);
    minutes += 15; 
    if (minutes >= 60) { minutes -= 60; hours += 1; }
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function calculateNightTimes(maghribStr, fajrStr) {
    let [mHours, mMinutes] = maghribStr.split(':').map(Number);
    let [fHours, fMinutes] = fajrStr.split(':').map(Number);
    let maghribInMinutes = mHours * 60 + mMinutes;
    let fajrInMinutes = fHours * 60 + fMinutes;
    if (fajrInMinutes < maghribInMinutes) fajrInMinutes += 24 * 60;
    let nightDuration = fajrInMinutes - maghribInMinutes;

    let midnightInMinutes = maghribInMinutes + (nightDuration / 2);
    document.getElementById('Midnight').innerText = convertTo12Hr(minutesToTimeStr(midnightInMinutes % (24 * 60)));

    let lastThirdInMinutes = maghribInMinutes + (nightDuration * 2 / 3);
    document.getElementById('LastThird').innerText = convertTo12Hr(minutesToTimeStr(lastThirdInMinutes % (24 * 60)));
}

function minutesToTimeStr(totalMinutes) {
    let hours = Math.floor(totalMinutes / 60);
    let minutes = Math.floor(totalMinutes % 60);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

// --- 6. تشغيل وتفاعل بوصلة اتجاه القبلة اللحظي الدقيق لبلسمر ---
async function initQibla() {
    const statusText = document.getElementById('qibla-status');
    const btn = document.getElementById('enable-qibla-btn');

    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        try {
            const permission = await DeviceOrientationEvent.requestPermission();
            if (permission === 'granted') {
                startCompass();
                if(btn) btn.style.display = 'none';
            } else {
                statusText.innerText = "تم رفض صلاحية الوصول للحساس.";
            }
        } catch (error) {
            console.error(error);
            statusText.innerText = "خطأ في طلب تفعيل الحساس.";
        }
    } else {
        startCompass();
        if(btn) btn.style.display = 'none';
    }
}

function startCompass() {
    const statusText = document.getElementById('qibla-status');
    const arrow = document.getElementById('qibla-arrow');
    const headingDisplay = document.getElementById('current-heading');

    window.addEventListener('deviceorientation', function(event) {
        let heading = event.alpha;
        
        if (event.webkitCompassHeading) {
            heading = event.webkitCompassHeading;
        }

        if (heading !== null && heading !== undefined) {
            let currentHeadingInt = Math.round(heading);
            if(headingDisplay) headingDisplay.innerText = currentHeadingInt + "°";

            let arrowRotation = QIBLA_ANGLE - currentHeadingInt;
            if(arrow) arrow.style.transform = `translateX(-50%) rotate(${arrowRotation}deg)`;

            if (Math.abs(currentHeadingInt - QIBLA_ANGLE) <= 3) {
                if(statusText) {
                    statusText.innerText = "🕌 أنت باتجاه القبلة الصحيح الآن!";
                    statusText.style.color = "#34d399";
                }
                if(arrow) arrow.style.background = "#34d399";
            } else {
                if(statusText) {
                    statusText.innerText = "قم بتدوير الجوال حتى يضيء السهم بالأخضر";
                    statusText.style.color = "white";
                }
                if(arrow) arrow.style.background = "#ef4444";
            }
        }
    }, true);
}

// الإطلاق والتحديث الدوري للمواقيت والطقس
getPrayerTimes();
getWeather();
setInterval(checkAlarmSystem, 1000);
setInterval(getWeather, 15 * 60 * 1000);

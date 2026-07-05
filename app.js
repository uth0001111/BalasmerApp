// إحداثيات بلسمر الدقيقة لحساب المواقيت والطقس
const LAT = 18.9634;
const LNG = 42.1381;

// مصادر ملفات الصوت
const PRE_AZAN_AUDIO_URL = "https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg"; 
const AZAN_TAKBEER_URL = "https://download.tvquran.com/download/Seasons/athan/01-athan.mp3"; 

let preAzanAudio = new Audio(PRE_AZAN_AUDIO_URL);
let azanTakbeerAudio = new Audio(AZAN_TAKBEER_URL);
let audioEnabled = false;
let prayerTimesToday = {};

// تفعيل الصوت بعد ضغطة المستخدم لتجاوز قيود نظام iOS
document.getElementById('enable-audio-btn').addEventListener('click', function() {
    audioEnabled = true;
    this.innerHTML = '<i class="fa-solid fa-bell"></i> المنبه نشط';
    this.classList.add('active');
    
    // تهيئة صامتة سريعة للمتصفح
    preAzanAudio.play().then(() => { preAzanAudio.pause(); }).catch(e => console.log(e));
    azanTakbeerAudio.play().then(() => { azanTakbeerAudio.pause(); }).catch(e => console.log(e));
});

// جلب المواقيت عبر الـ API
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

// رصد الوقت الحالي كل ثانية لإطلاق المنبهات
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

// جلب درجة الحرارة اللحظية
async function getWeather() {
    try {
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LNG}&current_weather=true`);
        const data = await response.json();
        if(data.current_weather) {
            const temp = Math.round(data.current_weather.temperature);
            document.getElementById('temp-value').innerText = temp;
        }
    } catch (error) {
        console.error("خطأ في جلب الطقس:", error);
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

// الإطلاق والتحديث الدوري
getPrayerTimes();
getWeather();
setInterval(checkAlarmSystem, 1000);
setInterval(getWeather, 15 * 60 * 1000);

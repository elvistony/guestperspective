let currentStream, guestName = "", currentLang = 'en', photos = [], tempImage = null;
const GOOGLE_SCRIPT_URL = "YOUR_APPS_SCRIPT_URL";

const i18n = {
    en: { welcome: "Wedding Camera", camera: "Camera", gallery: "Gallery", photo: "PHOTO", roll: "WEDDING ROLL", permT: "Camera Permission", permD: "Access needed for photos.", galT: "Gallery Upload", galD: "Pick up to 25 photos." },
    ml: { welcome: "വെഡ്ഡിംഗ് ക്യാമറ", camera: "ക്യാമറ", gallery: "ഗാലറി", photo: "ഫോട്ടോ", roll: "ഗാലറി", permT: "ക്യാമറ അനുമതി", permD: "ഫോട്ടോ എടുക്കാൻ അനുമതി നൽകുക.", galT: "അപ്‌ലോഡ് ചെയ്യുക", galD: "ഫോട്ടോകൾ തിരഞ്ഞെടുക്കുക." },
    ar: { welcome: "كاميرا الزفاف", camera: "كاميرا", gallery: "المعرض", photo: "صورة", roll: "معرض الصور", permT: "إذن الكاميرا", permD: "نحتاج للوصول إلى الكاميرا.", galT: "رفع من المعرض", galD: "اختر حتى ٢٥ صورة." }
};

function setLanguage(lang) {
    currentLang = lang;
    document.getElementById('txt-welcome').innerText = i18n[lang].welcome;
    document.getElementById('txt-btn-camera').innerText = i18n[lang].camera;
    document.getElementById('txt-btn-gallery').innerText = i18n[lang].gallery;
    document.getElementById('txt-mode-photo').innerText = i18n[lang].photo;
    document.getElementById('txt-gallery-title').innerText = i18n[lang].roll;
    document.getElementById('txt-perm-title').innerText = i18n[lang].permT;
    document.getElementById('txt-perm-desc').innerText = i18n[lang].permD;
    document.getElementById('txt-gal-title').innerText = i18n[lang].galT;
    document.getElementById('txt-gal-desc').innerText = i18n[lang].galD;
    showStep(2);
}

function showStep(s) {
    document.querySelectorAll('.step').forEach((el, i) => el.classList.toggle('d-none', i + 1 !== s));
}

function setSource(src) {
    guestName = document.getElementById('guest-name-input').value;
    if (!guestName) return alert("Enter Name");
    showStep(3);
    if (src === 'camera') document.getElementById('camera-perm-view').classList.remove('d-none');
    else document.getElementById('gallery-upload-view').classList.remove('d-none');
}

async function initCameraMode() {
    document.getElementById('overlay').style.display = 'none';
    document.getElementById('app-content').style.display = 'block';
    document.getElementById('display-guest-name').innerText = `GUEST: ${guestName.toUpperCase()}`;
    startCamera();
}

async function startCamera() {
    if (currentStream) currentStream.getTracks().forEach(t => t.stop());
    const constraints = { video: { facingMode: "environment", width: { ideal: 1920 } } };
    try {
        currentStream = await navigator.mediaDevices.getUserMedia(constraints);
        document.getElementById('video-feed').srcObject = currentStream;
    } catch (e) { alert("Camera access denied."); }
}

// Gallery Upload Logic
function handleFileSelect(e) {
    const files = Array.from(e.target.files).slice(0, 25);
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (ev) => photos.push(ev.target.result);
        reader.readAsDataURL(file);
    });
    document.getElementById('batch-upload-btn').classList.remove('d-none');
    document.getElementById('txt-gal-desc').innerText = `${files.length} Photos Selected`;
}

async function uploadBatch() {
    alert("Uploading roll... please wait.");
    // This would loop and send to Apps Script
    localStorage.setItem('wedding_photos', JSON.stringify(photos));
    document.getElementById('overlay').style.display = 'none';
    document.getElementById('app-content').style.display = 'block';
    updateGalleryThumb();
}

// Shutter & Confirm Logic
document.getElementById('shutter-trigger').addEventListener('click', () => {
    const video = document.getElementById('video-feed');
    const canvas = document.getElementById('capture-canvas');
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    tempImage = canvas.toDataURL('image/jpeg', 0.85);
    video.pause();
    toggleReview(true);
});

document.getElementById('confirm-photo').addEventListener('click', async () => {
    toggleLoading(true);
    // POST to Google Script logic here
    photos.push(tempImage);
    localStorage.setItem('wedding_photos', JSON.stringify(photos));
    updateGalleryThumb();
    resetCam();
    toggleLoading(false);
});

function toggleReview(rev) {
    document.getElementById('shutter-trigger').classList.toggle('d-none', rev);
    document.getElementById('confirm-photo').classList.toggle('d-none', !rev);
    document.getElementById('flip-icon').classList.toggle('d-none', rev);
    document.getElementById('discard-icon').classList.toggle('d-none', !rev);
    document.getElementById('secondary-action').classList.toggle('discard-mode', rev);
}

function resetCam() { tempImage = null; document.getElementById('video-feed').play(); toggleReview(false); }

function updateGalleryThumb() {
    document.getElementById('count').innerText = photos.length;
    if (photos.length) document.getElementById('preview-thumb').style.backgroundImage = `url(${photos[photos.length-1]})`;
}

function toggleLoading(l) {
    document.getElementById('confirm-icon').classList.toggle('d-none', l);
    document.getElementById('upload-spinner').classList.toggle('d-none', !l);
}

// Samsung Gallery
function openGallery() {
    if (!photos.length) return;
    const track = document.getElementById('filmstrip-track');
    track.innerHTML = photos.map((p, i) => `<div class="filmstrip-thumb" id="th-${i}" style="background-image:url(${p})" onclick="selectPhoto(${i})"></div>`).join('');
    document.getElementById('gallery-overlay').classList.remove('gallery-hidden');
    selectPhoto(photos.length - 1);
}

function selectPhoto(i) {
    document.getElementById('main-gallery-img').src = photos[i];
    document.querySelectorAll('.filmstrip-thumb').forEach(t => t.classList.remove('active'));
    document.getElementById(`th-${i}`).classList.add('active');
}

function closeGallery() { document.getElementById('gallery-overlay').classList.add('gallery-hidden'); }

function setZoom(z, b) {
    document.getElementById('video-feed').style.transform = `scale(${z})`;
    document.querySelectorAll('.zoom-pill').forEach(el => el.classList.remove('active'));
    b.classList.add('active');
}
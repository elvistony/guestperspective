let currentStream, tempImage = null, isTorch = false, currentLang = 'en';
const API_URL = "https://script.google.com/macros/s/AKfycbxQP6flSMFtmV_We6UueTA-bDvfdpov1o4ostIaQoPeHgqzpzDzm-iZ556z78U2qjxj/exec";

// 1. Language Data
const i18n = {
    en: { rem: "PHOTOS REMAINING", roll: "WEDDING ROLL", mode: "PHOTO" },
    ml: { rem: "ഫോട്ടോകൾ ബാക്കിയുണ്ട്", roll: "ഗാലറി", mode: "ഫോട്ടോ" },
    ar: { rem: "صور متبقية", roll: "معرض الصور", mode: "صورة" }
};

// 2. PWA Registration
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');

function setLanguage(l) {
    currentLang = l;
    document.getElementById('txt-mode-photo').innerText = i18n[l].mode;
    document.getElementById('txt-gallery-title').innerText = i18n[l].roll;
    updateStatus();
    showStep(2);
}

let photos = JSON.parse(localStorage.getItem('wedding_photos')) || [];
let isDone = localStorage.getItem('wedding_complete') === 'true';

// 1. Initial Page Load Check
window.onload = () => {
    if (isDone) {
        showCelebration();
    } else {
        // Normal onboarding logic
        if (localStorage.getItem('guest_name')) {
            document.getElementById('guest-name-input').value = localStorage.getItem('guest_name');
        }
    }
};

// 2. Modified Upload Batch Logic
async function uploadBatch() {
    const btn = document.getElementById('batch-upload-btn');
    const progressContainer = document.getElementById('upload-progress-container');
    const progressBar = document.getElementById('upload-progress-bar');

    btn.classList.add('d-none');
    progressContainer.classList.remove('d-none');

    const chunks = chunkArray(photos, 5);
    for (let i = 0; i < chunks.length; i++) {
        const payload = {
            name: document.getElementById('guest-name-input').value,
            photos: chunks[i],
            bulk: true,
            chunkIndex: i + 1
        };

        // If this fetch fails, it usually means the Apps Script URL is wrong 
        // or not deployed for "Anyone"
        await uploadToCloud(payload);

        let percent = Math.round(((i + 1) / chunks.length) * 100);
        progressBar.style.width = percent + '%';
    }

    // Set Completion Flags
    localStorage.setItem('wedding_complete', 'true');
    localStorage.setItem('wedding_photos', JSON.stringify(photos));
    
    showCelebration();
}

// 3. Modified Single Confirm Logic
document.getElementById('confirm-trigger').onclick = async () => {
    toggleLoading(true);
    
    const singleData = {
        name: document.getElementById('guest-name-input').value,
        image: tempImage
    };

    await uploadToCloud(singleData);
    photos.push(tempImage);
    localStorage.setItem('wedding_photos', JSON.stringify(photos));
    
    // If they hit 25, lock the app
    if (photos.length >= 25) {
        localStorage.setItem('wedding_complete', 'true');
        showCelebration();
    } else {
        updateStatus();
        toggleLoading(false);
        resetCamera();
    }
};

// 4. Celebration & History Renderer
function showCelebration() {
    document.getElementById('overlay').style.display = 'none';
    document.getElementById('app-content').style.display = 'none';
    document.getElementById('success-overlay').classList.remove('d-none');
    
    // Render the grid of uploaded photos
    const historyGrid = document.getElementById('upload-history-grid');
    historyGrid.innerHTML = photos.map(p => `
        <div class="history-item" style="background-image: url(${p})"></div>
    `).join('');
}

// Remove the closeSuccess function or modify it so they can't leave
function closeSuccess() {
    // If you want them to be able to go back to see the gallery but not take photos:
    // For now, let's keep them on this page as requested.
    alert("You've finished your roll! Thank you!");
}

// 3. Camera Controls
async function startCamera() {
    if (currentStream) currentStream.getTracks().forEach(t => t.stop());
    const c = { video: { facingMode: "environment", width: { ideal: 1920 } } };
    currentStream = await navigator.mediaDevices.getUserMedia(c);
    document.getElementById('video-feed').srcObject = currentStream;
}

function triggerFocus(e) {
    const viewport = document.getElementById('camera-viewport');
    const sq = document.getElementById('focus-square');
    
    // Get the bounding box of the camera area
    const rect = viewport.getBoundingClientRect();
    
    // Calculate position relative to the viewport top-left
    // clientX/Y is the tap position on the whole screen
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Center the 60px box on the tap (subtract 30px)
    sq.style.display = 'block';
    sq.style.left = `${x - 30}px`; 
    sq.style.top = `${y - 30}px`;

    // Reset the square after 800ms
    setTimeout(() => {
        sq.style.display = 'none';
    }, 800);

    // Optional: Re-trigger hardware focus if supported
    if (currentStream) {
        const track = currentStream.getVideoTracks()[0];
        if (track.getCapabilities().focusMode) {
            track.applyConstraints({
                advanced: [{ focusMode: "manual", pointsOfInterest: [{x: x/rect.width, y: y/rect.height}] }]
            }).catch(() => {
                // Fallback to continuous if manual fails
                track.applyConstraints({ advanced: [{ focusMode: "continuous" }] });
            });
        }
    }
}
async function toggleTorch() {
    const track = currentStream.getVideoTracks()[0];
    isTorch = !isTorch;
    await track.applyConstraints({ advanced: [{ torch: isTorch }] });
    document.getElementById('torch-icon').style.color = isTorch ? "var(--ios-yellow)" : "white";
}

// 4. Upload Core
async function uploadToCloud(img) {
    try {
        await fetch(API_URL, {
            method: "POST", mode: "no-cors",
            body: JSON.stringify({ name: document.getElementById('guest-name-input').value, image: img })
        });
    } catch(e) {}
}

// 5. Batch Gallery Upload
function handleFileSelect(e) {
    const files = Array.from(e.target.files).slice(0, 25);
    document.getElementById('gal-status').innerText = `${files.length} selected`;
    document.getElementById('batch-upload-btn').classList.remove('d-none');
    
    files.forEach(f => {
        let r = new FileReader();
        r.onload = (ev) => photos.push(ev.target.result);
        r.readAsDataURL(f);
    });
}

// Helper function to split array into chunks
function chunkArray(array, size) {
    const result = [];
    for (let i = 0; i < array.length; i += size) {
        result.push(array.slice(i, i + size));
    }
    return result;
}

// --- Updated Upload Batch Logic with Success Effect ---
async function uploadBatch() {
    const btn = document.getElementById('batch-upload-btn');
    const progressContainer = document.getElementById('upload-progress-container');
    const progressBar = document.getElementById('upload-progress-bar');
    const statusText = document.getElementById('upload-status-text');

    btn.classList.add('d-none');
    progressContainer.classList.remove('d-none');

    const chunks = chunkArray(photos, 5);
    const totalChunks = chunks.length;

    for (let i = 0; i < totalChunks; i++) {
        const payload = {
            name: document.getElementById('guest-name-input').value,
            photos: chunks[i],
            bulk: true,
            chunkIndex: i + 1,
            totalChunks: totalChunks
        };

        await uploadToCloud(payload);

        // Update UI
        const percentComplete = Math.round(((i + 1) / totalChunks) * 100);
        progressBar.style.width = percentComplete + '%';
        statusText.innerText = `Uploading: ${percentComplete}%`;
    }

    // Trigger Success Overlay
    showCelebration();
}

// --- Trigger for Single Camera Photos ---
document.getElementById('confirm-trigger').onclick = async () => {
    toggleLoading(true);
    
    const singleData = {
        name: document.getElementById('guest-name-input').value,
        image: tempImage
    };

    await uploadToCloud(singleData);
    photos.push(tempImage);
    localStorage.setItem('wedding_photos', JSON.stringify(photos));
    
    updateStatus();
    toggleLoading(false);
    resetCamera();
    
    // Optional: Only show for single photos if you want
    showCelebration();
};

function showCelebration() {
    document.getElementById('success-overlay').classList.remove('d-none');
    // Save to gallery state
    localStorage.setItem('wedding_photos', JSON.stringify(photos));
}

function closeSuccess() {
    document.getElementById('success-overlay').classList.add('d-none');
    // Hide progress bar for next time
    document.getElementById('upload-progress-container').classList.add('d-none');
    document.getElementById('upload-progress-bar').style.width = '0%';
    
    // If it was a batch upload, go to camera mode
    if (document.getElementById('overlay').style.display !== 'none') {
        initCameraMode();
    }
}

// 6. UI Logic
document.getElementById('shutter-trigger').onclick = () => {
    if (photos.length >= 25) return;
    const v = document.getElementById('video-feed');
    const c = document.getElementById('capture-canvas');
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0);
    tempImage = c.toDataURL('image/jpeg', 0.8);
    v.pause();
    toggleReview(true);
};

document.getElementById('confirm-trigger').onclick = async () => {
    document.getElementById('check-icon').classList.add('d-none');
    document.getElementById('loader').classList.remove('d-none');
    
    await uploadToCloud(tempImage);
    photos.push(tempImage);
    localStorage.setItem('wedding_photos', JSON.stringify(photos));
    
    updateStatus();
    document.getElementById('check-icon').classList.remove('d-none');
    document.getElementById('loader').classList.add('d-none');
    resetCamera();
};

function resetCamera() { 
    tempImage = null; document.getElementById('video-feed').play(); toggleReview(false); 
}

function updateStatus() {
    document.getElementById('count-num').innerText = photos.length;
    document.getElementById('txt-remaining').innerText = `${25 - photos.length} ${i18n[currentLang].rem}`;
    if(photos.length) document.getElementById('preview-thumb').style.backgroundImage = `url(${photos[photos.length-1]})`;
}

// Navigation helpers
function toggleReview(r) {
    document.getElementById('shutter-trigger').classList.toggle('d-none', r);
    document.getElementById('confirm-trigger').classList.toggle('d-none', !r);
    document.getElementById('sec-btn').classList.toggle('bg-danger', r);
    document.getElementById('flip-icon').classList.toggle('d-none', r);
    document.getElementById('discard-icon').classList.toggle('d-none', !r);
}

function showStep(s) { document.querySelectorAll('.step').forEach((el, i) => el.classList.toggle('d-none', i+1 !== s)); }
function setSource(src) { showStep(3); document.getElementById(src === 'camera' ? 'camera-perm-view' : 'gallery-upload-view').classList.remove('d-none'); }
function initCameraMode() { document.getElementById('overlay').style.display='none'; document.getElementById('app-content').style.display='flex'; startCamera(); updateStatus(); }
function openGallery() {
    const track = document.getElementById('strip-track');
    track.innerHTML = photos.map((p, i) => `<div class="filmstrip-thumb" id="th-${i}" style="background-image:url(${p})" onclick="selectPhoto(${i})"></div>`).join('');
    document.getElementById('gallery-overlay').classList.remove('gal-hide');
    selectPhoto(photos.length - 1);
}
function selectPhoto(i) {
    document.getElementById('main-view').src = photos[i];
    document.querySelectorAll('.filmstrip-thumb').forEach(t => t.classList.remove('active'));
    document.getElementById(`th-${i}`).classList.add('active');
}
function closeGallery() { document.getElementById('gallery-overlay').classList.add('gal-hide'); }
function setZoom(z, b) { document.getElementById('video-feed').style.transform = `scale(${z})`; document.querySelectorAll('.z-btn').forEach(el => el.classList.remove('active')); b.classList.add('active'); }
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import exifr from 'https://cdn.jsdelivr.net/npm/exifr/dist/mini.esm.mjs';

// ── Init Supabase ──────────────────────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Init Map ───────────────────────────────────────────────────────────────────
const map = L.map('map', { zoomControl: true }).setView([45.5, 12.5], 6);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors',
  maxZoom: 19,
}).addTo(map);

const pinIcon = L.divIcon({
  className: '',
  html: `<div style="
    width:32px;height:32px;
    background:var(--accent,#e63946);
    border:3px solid #fff;
    border-radius:50% 50% 50% 0;
    transform:rotate(-45deg);
    box-shadow:0 2px 8px rgba(0,0,0,0.4);
  "></div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -34],
});

// ── Load approved pins ─────────────────────────────────────────────────────────
async function loadPins() {
  const { data, error } = await supabase
    .from('pins')
    .select('*')
    .eq('approved', true)
    .order('created_at', { ascending: false });

  if (error) { console.error('Failed to load pins', error); return; }

  data.forEach(addPinToMap);
}

function addPinToMap(pin) {
  const marker = L.marker([pin.lat, pin.lng], { icon: pinIcon }).addTo(map);
  const photoHtml = pin.photo_url
    ? `<img class="popup-img" src="${pin.photo_url}" alt="Sticker photo" loading="lazy">`
    : '';
  const date = pin.taken_at
    ? new Date(pin.taken_at).toLocaleDateString('it-IT', { day:'2-digit', month:'short', year:'numeric' })
    : '—';

  marker.bindPopup(`
    ${photoHtml}
    <div class="popup-meta">
      <strong>${escHtml(pin.username || 'Anonimo')}</strong><br>
      ${escHtml(pin.location_name || '')}<br>
      ${date}
      ${pin.note ? `<br><em>${escHtml(pin.note)}</em>` : ''}
    </div>
  `);
}

// ── Modal ──────────────────────────────────────────────────────────────────────
const overlay  = document.getElementById('modal-overlay');
const btnAdd   = document.getElementById('btn-add-pin');
const btnClose = document.getElementById('modal-close');
const btnSub   = document.getElementById('btn-submit');

btnAdd.addEventListener('click', () => overlay.classList.add('open'));
btnClose.addEventListener('click', closeModal);
overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

function closeModal() {
  overlay.classList.remove('open');
  resetForm();
}

// ── Photo drop ─────────────────────────────────────────────────────────────────
const photoDrop    = document.getElementById('photo-drop');
const photoInput   = document.getElementById('photo-input');
const photoPreview = document.getElementById('photo-preview');
const exifBadge    = document.getElementById('exif-badge');

let selectedFile = null;

photoDrop.addEventListener('click', () => photoInput.click());
photoDrop.addEventListener('dragover', e => { e.preventDefault(); photoDrop.classList.add('dragover'); });
photoDrop.addEventListener('dragleave', () => photoDrop.classList.remove('dragover'));
photoDrop.addEventListener('drop', e => {
  e.preventDefault();
  photoDrop.classList.remove('dragover');
  handleFile(e.dataTransfer.files[0]);
});
photoInput.addEventListener('change', () => handleFile(photoInput.files[0]));

async function handleFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  selectedFile = file;

  // Preview
  photoPreview.src = URL.createObjectURL(file);
  photoPreview.style.display = 'block';
  photoDrop.style.display = 'none';

  // Extract EXIF
  try {
    const exif = await exifr.parse(file, { gps: true, tiff: true });
    if (exif?.latitude && exif?.longitude) {
      setCoords(exif.latitude, exif.longitude, true);
    }
    if (exif?.DateTimeOriginal) {
      const d = exif.DateTimeOriginal;
      // Format to datetime-local: YYYY-MM-DDTHH:mm
      document.getElementById('taken-at').value = toDatetimeLocal(d);
    }
  } catch (_) { /* no EXIF — user fills manually */ }
}

function setCoords(lat, lng, fromExif) {
  document.getElementById('lat').value = lat.toFixed(6);
  document.getElementById('lng').value = lng.toFixed(6);
  if (fromExif) {
    exifBadge.textContent = '✓ Posizione estratta dalla foto';
    exifBadge.className = 'exif-badge';
  } else {
    exifBadge.textContent = 'Posizione inserita manualmente';
    exifBadge.className = 'exif-badge manual';
  }
  exifBadge.style.display = 'inline-flex';
}

function toDatetimeLocal(d) {
  if (typeof d === 'string') d = new Date(d);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── Get location from browser ──────────────────────────────────────────────────
document.getElementById('btn-geolocate').addEventListener('click', () => {
  if (!navigator.geolocation) return showToast('Geolocalizzazione non supportata', 'error');
  navigator.geolocation.getCurrentPosition(
    pos => setCoords(pos.coords.latitude, pos.coords.longitude, false),
    ()  => showToast('Impossibile ottenere la posizione', 'error')
  );
});

// ── Submit ─────────────────────────────────────────────────────────────────────
document.getElementById('pin-form').addEventListener('submit', async e => {
  e.preventDefault();
  btnSub.disabled = true;
  btnSub.textContent = 'Invio in corso…';

  const lat = parseFloat(document.getElementById('lat').value);
  const lng = parseFloat(document.getElementById('lng').value);
  const username = document.getElementById('username').value.trim();
  const takenAt  = document.getElementById('taken-at').value;
  const locationName = document.getElementById('location-name').value.trim();
  const note     = document.getElementById('note').value.trim();

  if (!username) { showToast('Inserisci un nome utente', 'error'); resetBtn(); return; }
  if (isNaN(lat) || isNaN(lng)) { showToast('Imposta la posizione geografica', 'error'); resetBtn(); return; }

  let photo_url = null;

  // Upload photo if present
  if (selectedFile) {
    const ext  = selectedFile.name.split('.').pop();
    const path = `pins/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: upErr } = await supabase.storage.from('photos').upload(path, selectedFile, {
      contentType: selectedFile.type,
      upsert: false,
    });
    if (upErr) { showToast('Errore upload foto: ' + upErr.message, 'error'); resetBtn(); return; }
    const { data: urlData } = supabase.storage.from('photos').getPublicUrl(path);
    photo_url = urlData.publicUrl;
  }

  const { error } = await supabase.from('pins').insert({
    lat, lng, username, photo_url,
    location_name: locationName || null,
    note: note || null,
    taken_at: takenAt ? new Date(takenAt).toISOString() : null,
    approved: false,
  });

  if (error) {
    showToast('Errore: ' + error.message, 'error');
  } else {
    showToast('Pin inviato! Sarà visibile dopo approvazione.', 'success');
    closeModal();
  }
  resetBtn();
});

function resetBtn() {
  btnSub.disabled = false;
  btnSub.textContent = 'Invia segnalazione';
}

function resetForm() {
  document.getElementById('pin-form').reset();
  selectedFile = null;
  photoPreview.style.display = 'none';
  photoDrop.style.display = '';
  exifBadge.style.display = 'none';
  resetBtn();
}

// ── Toast ──────────────────────────────────────────────────────────────────────
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'show ' + type;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.className = '', 3500);
}

// ── Utils ──────────────────────────────────────────────────────────────────────
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Start ──────────────────────────────────────────────────────────────────────
loadPins();

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import exifr from 'https://cdn.jsdelivr.net/npm/exifr/dist/full.esm.mjs';

// ── Init Supabase ──────────────────────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Init Map ───────────────────────────────────────────────────────────────────
const map = L.map('map', { zoomControl: true }).setView([45.5, 12.5], 6);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors',
  maxZoom: 19,
}).addTo(map);

function makePinIcon(color) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:32px;height:32px;
      background:${color};
      border:3px solid #fff;
      border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      box-shadow:0 2px 8px rgba(0,0,0,0.4);
    "></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -34],
  });
}

const pinIconFixed  = makePinIcon('#e63946');
const pinIconMobile = makePinIcon('#f4a261');

const MOBILE_LABELS = {
  auto:   '🚗 Auto / Moto / Furgone',
  bici:   '🚲 Bicicletta / Monopattino',
  camion: '🚛 Camion / TIR',
  bus:    '🚌 Bus / Pullman',
  treno:  '🚆 Treno / Metro',
  nave:   '⛵ Nave / Barca',
  aereo:  '✈️ Aereo',
  altro:  '📦 Altro',
};

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
  const icon = pin.is_mobile ? pinIconMobile : pinIconFixed;
  const marker = L.marker([pin.lat, pin.lng], { icon }).addTo(map);

  const photoHtml = pin.photo_url
    ? `<img class="popup-img" src="${pin.photo_url}" alt="Sticker photo" loading="lazy">`
    : '';
  const date = pin.taken_at
    ? new Date(pin.taken_at).toLocaleDateString('it-IT', { day:'2-digit', month:'short', year:'numeric' })
    : '—';
  const mobileBadge = pin.is_mobile
    ? `<div class="popup-mobile-badge">In movimento · ${escHtml(MOBILE_LABELS[pin.mobile_type] ?? pin.mobile_type ?? 'Veicolo')}</div>`
    : '';

  marker.bindPopup(`
    ${photoHtml}
    <div class="popup-meta">
      ${mobileBadge}
      <strong>${escHtml(pin.username || 'Anonimo')}</strong><br>
      ${pin.location_name ? escHtml(pin.location_name) + '<br>' : ''}
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
    const exif = await exifr.parse(file, { gps: true, tiff: true, exif: true });

    let hasGps = false;
    if (exif?.latitude != null && exif?.longitude != null) {
      setCoords(exif.latitude, exif.longitude, true);
      hasGps = true;
    }

    if (exif?.DateTimeOriginal) {
      document.getElementById('taken-at').value = toDatetimeLocal(exif.DateTimeOriginal);
    }

    if (!exif || (!hasGps && !exif.DateTimeOriginal)) {
      showToast('Nessun dato EXIF — imposta posizione e data manualmente', 'warning');
    } else if (!hasGps) {
      showToast('Data estratta, ma nessun GPS — scegli il punto sulla mappa', 'warning');
    }
  } catch (_) {
    showToast('Impossibile leggere i metadati della foto', 'warning');
  }
}

let selectedCoords = null;
let pickMarker = null;

function setCoords(lat, lng, fromExif) {
  selectedCoords = { lat, lng };

  document.getElementById('coords-selected').style.display = 'flex';
  document.getElementById('pos-buttons').style.display = 'none';
  document.getElementById('coords-text').textContent =
    `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

  if (fromExif) {
    exifBadge.textContent = '✓ Posizione estratta dalla foto';
    exifBadge.className = 'exif-badge';
    exifBadge.style.display = 'inline-flex';
  }

  // Place/move temp marker on the map
  if (pickMarker) pickMarker.remove();
  pickMarker = L.marker([lat, lng], { icon: pinIconFixed, opacity: 0.6 }).addTo(map);
}

function clearCoords() {
  selectedCoords = null;
  document.getElementById('coords-selected').style.display = 'none';
  document.getElementById('pos-buttons').style.display = 'flex';
  if (pickMarker) { pickMarker.remove(); pickMarker = null; }
}

function toDatetimeLocal(d) {
  if (typeof d === 'string') d = new Date(d);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── Mobile toggle ─────────────────────────────────────────────────────────────
document.getElementById('is-mobile').addEventListener('change', e => {
  document.getElementById('mobile-fields').style.display = e.target.checked ? 'block' : 'none';
});

// ── Map pick mode ──────────────────────────────────────────────────────────────
const pickBanner = document.getElementById('pick-banner');

function activatePickMode() {
  overlay.classList.add('pick-mode');
  pickBanner.classList.add('visible');
}

function deactivatePickMode() {
  overlay.classList.remove('pick-mode');
  pickBanner.classList.remove('visible');
}

document.getElementById('btn-pick-map').addEventListener('click', activatePickMode);
document.getElementById('btn-reposition').addEventListener('click', () => {
  clearCoords();
  activatePickMode();
});
document.getElementById('btn-cancel-pick').addEventListener('click', deactivatePickMode);

// Click on the semi-transparent overlay → pick coords from map
overlay.addEventListener('click', e => {
  if (overlay.classList.contains('pick-mode')) {
    const rect = map.getContainer().getBoundingClientRect();
    const point = L.point(e.clientX - rect.left, e.clientY - rect.top);
    const latlng = map.containerPointToLatLng(point);
    setCoords(latlng.lat, latlng.lng, false);
    deactivatePickMode();
    return;
  }
  if (e.target === overlay) closeModal();
});

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

  const username = document.getElementById('username').value.trim();
  const takenAt  = document.getElementById('taken-at').value;
  const locationName = document.getElementById('location-name').value.trim();
  const note       = document.getElementById('note').value.trim();
  const is_mobile  = document.getElementById('is-mobile').checked;
  const mobile_type = is_mobile ? document.getElementById('mobile-type').value : null;

  if (!username) { showToast('Inserisci un nome utente', 'error'); resetBtn(); return; }
  if (!selectedCoords) { showToast('Imposta la posizione geografica', 'error'); resetBtn(); return; }

  const { lat, lng } = selectedCoords;

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
    is_mobile, mobile_type,
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
  document.getElementById('mobile-fields').style.display = 'none';
  clearCoords();
  deactivatePickMode();
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

if (new URLSearchParams(location.search).get('add') === '1') {
  overlay.classList.add('open');
}

import { api } from './api.js';
import { enqueue } from './db.js';
import { compressImageToBase64 } from './image-utils.js';

function showToast(msg, type) {
  window.dispatchEvent(new CustomEvent('app:toast', { detail: { msg, type } }));
}

function getSessionProjectId() {
  let id = sessionStorage.getItem('censo_proyecto');
  if (!id) {
    id = 'CENSO_' + Date.now().toString(36).toUpperCase();
    sessionStorage.setItem('censo_proyecto', id);
  }
  return id;
}

export function renderCensoView() {
  return `
    <div class="view-header">
      <h2><i class="fa-solid fa-clipboard-list"></i> Nuevo Censo</h2>
    </div>
    <div class="card">
      <form id="form-censo" novalidate>

        <div class="field-group">
          <label><i class="fa-solid fa-camera"></i> Fotografía de la mascota</label>
          <div class="foto-btns-row">
            <button type="button" class="btn btn-outline foto-btn-camara" id="btn-censo-abrir-camara">
              <i class="fa-solid fa-camera"></i> Abrir cámara
            </button>
            <button type="button" class="btn btn-outline foto-btn-archivo" id="btn-censo-subir-archivo">
              <i class="fa-solid fa-folder-open"></i> Subir archivo
            </button>
          </div>
          <input type="file" id="censo-foto-archivo" accept="image/*" style="display:none" />
          <div id="foto-preview-wrap" class="hidden" style="margin-top:.5rem;position:relative">
            <img id="foto-preview" alt="Vista previa"
              style="width:100%;max-height:220px;object-fit:cover;border-radius:var(--radius-md);" />
            <button type="button" id="btn-remove-foto"
              style="position:absolute;top:.4rem;right:.4rem;background:rgba(0,0,0,.55);color:#fff;border-radius:50%;width:28px;height:28px;font-size:.8rem;display:flex;align-items:center;justify-content:center">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
          <p id="foto-size-info" class="text-muted" style="font-size:.78rem;margin-top:.3rem"></p>
          <p id="foto-error" class="alert alert-error hidden"></p>
        </div>

        <div class="form-grid-2">
          <div class="field-group">
            <label for="censo-mascota"><i class="fa-solid fa-paw"></i> Mascota</label>
            <select id="censo-mascota" required>
              <option value="">Cargando…</option>
            </select>
          </div>
          <div class="field-group">
            <label for="censo-dueno"><i class="fa-solid fa-user"></i> Dueño</label>
            <select id="censo-dueno" required>
              <option value="">Cargando…</option>
            </select>
          </div>
        </div>

        <div class="field-group">
          <label><i class="fa-solid fa-location-dot"></i> Geolocalización</label>
          <div class="geo-status" id="geo-status">
            <i class="fa-solid fa-location-crosshairs"></i>
            <span>Se capturará al enviar el formulario</span>
          </div>
          <div id="censo-map-preview" class="hidden" style="margin-top:.6rem;border-radius:var(--radius-md);overflow:hidden;height:200px;border:1px solid var(--border-color)">
            <div id="censo-leaflet-mini" style="height:100%;width:100%;"></div>
          </div>
        </div>

        <div id="censo-error" class="alert alert-error hidden"></div>
        <div id="censo-success" class="alert alert-success hidden"></div>

        <button type="submit" class="btn btn-primary btn-full" id="btn-submit-censo">
          <i class="fa-solid fa-paper-plane"></i> Registrar censo
        </button>
      </form>
    </div>`;
}

export async function initCensoView() {
  setupPhotoInput();
  await loadSelects();
  setupForm();
  previewGeolocation();
}

// ── Foto ──────────────────────────────────────────────────────────────────────

let _fotoBase64 = null;

function setupPhotoInput() {
  const inputArchivo = document.getElementById('censo-foto-archivo');
  const rmBtn        = document.getElementById('btn-remove-foto');
  const btnCamara    = document.getElementById('btn-censo-abrir-camara');
  const btnArchivo   = document.getElementById('btn-censo-subir-archivo');

  btnCamara?.addEventListener('click', () => {
    openCameraChoiceModal((file) => compressAndPreview(file));
  });

  btnArchivo?.addEventListener('click', () => {
    inputArchivo.value = '';   // forzar re-trigger aunque sea el mismo archivo
    inputArchivo?.click();
  });

  inputArchivo?.addEventListener('change', () => {
    if (inputArchivo.files[0]) compressAndPreview(inputArchivo.files[0]);
  });

  rmBtn?.addEventListener('click', clearPhoto);
}

function compressAndPreview(file) {
  const errEl    = document.getElementById('foto-error');
  const sizeInfo = document.getElementById('foto-size-info');
  errEl.classList.add('hidden');
  sizeInfo.textContent = 'Comprimiendo imagen…';

  compressImageToBase64(file)
    .then(({ base64, kb, width, height, quality }) => {
      sizeInfo.textContent = `Tamaño: ${kb.toFixed(1)} KB (${width}×${height}px, calidad ${Math.round(quality * 100)}%)`;
      _fotoBase64 = base64;
      document.getElementById('foto-preview').src = base64;
      document.getElementById('foto-preview-wrap').classList.remove('hidden');
    })
    .catch((msg) => {
      errEl.textContent = msg;
      errEl.classList.remove('hidden');
      sizeInfo.textContent = '';
    });
}

function clearPhoto() {
  _fotoBase64 = null;
  document.getElementById('foto-preview').src = '';
  document.getElementById('foto-preview-wrap').classList.add('hidden');
  document.getElementById('foto-size-info').textContent = '';
  document.getElementById('censo-foto-archivo').value = '';
  document.getElementById('foto-error').classList.add('hidden');
}

// ── Mini-mapa de preview ───────────────────────────────────────────────────

let _miniMap = null;
let _miniMarker = null;

function previewGeolocation() {
  const geoStatus = document.getElementById('geo-status');
  const mapWrap = document.getElementById('censo-map-preview');
  if (!navigator.geolocation) return;

  geoStatus.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Obteniendo ubicación…';

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      geoStatus.innerHTML = `<i class="fa-solid fa-location-dot" style="color:var(--primary)"></i> <strong>${lat.toFixed(5)}, ${lon.toFixed(5)}</strong>`;

      mapWrap.classList.remove('hidden');
      setTimeout(() => {
        if (_miniMap) { _miniMap.remove(); _miniMap = null; _miniMarker = null; }
        _miniMap = L.map('censo-leaflet-mini', { zoomControl: true, scrollWheelZoom: false }).setView([lat, lon], 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(_miniMap);
        const icon = L.divIcon({
          className: '',
          html: '<div style="width:18px;height:18px;background:var(--primary,#A80081);border:3px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,.4)"></div>',
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });
        _miniMarker = L.marker([lat, lon], { icon }).addTo(_miniMap);
        _miniMarker.bindPopup('Tu ubicación actual').openPopup();
      }, 100);
    },
    () => {
      geoStatus.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Activa el GPS para ver tu ubicación';
    },
    { timeout: 12000, maximumAge: 30000 }
  );
}

// ── Selects ───────────────────────────────────────────────────────────────────

async function loadSelects() {
  try {
    const [mascotas, personas] = await Promise.all([
      api.get('/mascotas'),
      api.get('/personas'),
    ]);
    fillSelect('censo-mascota', mascotas, m => ({ value: m.id, label: `${m.nombre} (${m.tipo})` }));
    fillSelect('censo-dueno', personas, p => ({ value: p.id, label: `${p.nombres} ${p.apellidos}` }));
  } catch (err) {
    showToast('No se pudo cargar mascotas o personas: ' + err.message, 'error');
  }
}

function fillSelect(id, items, mapper) {
  const sel = document.getElementById(id);
  if (!sel) return;
  sel.innerHTML = '<option value="">Seleccionar…</option>' +
    items.map(i => {
      const { value, label } = mapper(i);
      return `<option value="${esc(value)}">${esc(label)}</option>`;
    }).join('');
}

// ── Form submit ───────────────────────────────────────────────────────────────

function setupForm() {
  const form = document.getElementById('form-censo');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errDiv = document.getElementById('censo-error');
    const sucDiv = document.getElementById('censo-success');
    errDiv.classList.add('hidden');
    sucDiv.classList.add('hidden');

    if (!_fotoBase64) {
      errDiv.textContent = 'Debes tomar o seleccionar una fotografía.';
      errDiv.classList.remove('hidden');
      return;
    }

    const idMascota = document.getElementById('censo-mascota').value;
    const idDueno = document.getElementById('censo-dueno').value;
    if (!idMascota || !idDueno) {
      errDiv.textContent = 'Debes seleccionar la mascota y el dueño.';
      errDiv.classList.remove('hidden');
      return;
    }

    const btn = document.getElementById('btn-submit-censo');
    btn.disabled = true;

    const geoStatus = document.getElementById('geo-status');
    geoStatus.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Obteniendo ubicación…';
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Obteniendo ubicación…';

    let lat, lon;
    try {
      ({ lat, lon } = await getGeolocation());
      geoStatus.innerHTML = `<i class="fa-solid fa-location-dot" style="color:var(--primary)"></i> <strong>${lat.toFixed(5)}, ${lon.toFixed(5)}</strong>`;
      if (_miniMap && _miniMarker) {
        _miniMarker.setLatLng([lat, lon]);
        _miniMap.setView([lat, lon], 15);
      }
    } catch {
      geoStatus.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Ubicación no disponible';
      errDiv.textContent = 'No se pudo obtener la ubicación GPS. Activa los permisos de localización e inténtalo de nuevo.';
      errDiv.classList.remove('hidden');
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Registrar censo';
      return;
    }

    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando…';

    const dto = {
      fotografia: _fotoBase64,
      idMascota,
      idDueno,
      idProyecto: getSessionProjectId(),
      color: '#A80081',
      lat,
      lon,
    };

    try {
      if (navigator.onLine) {
        const bodySize = (JSON.stringify(dto).length / 1024).toFixed(1);
        console.log('Body size KB:', bodySize);
        await api.post('/censos', dto);
        sucDiv.textContent = 'Censo registrado correctamente.';
        sucDiv.classList.remove('hidden');
        showToast('Censo registrado', 'success');
        form.reset();
        clearPhoto();
        _fotoBase64 = null;
        geoStatus.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i> Se capturará al enviar el formulario';
        document.getElementById('censo-map-preview').classList.add('hidden');
        if (_miniMap) { _miniMap.remove(); _miniMap = null; _miniMarker = null; }
        setTimeout(previewGeolocation, 500);
      } else {
        await enqueue('censos_queue', dto);
        sucDiv.textContent = 'Sin conexión — censo guardado localmente.';
        sucDiv.classList.remove('hidden');
        showToast('Guardado sin conexión', 'warning');
      }
    } catch (err) {
      errDiv.textContent = err.message;
      errDiv.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Registrar censo';
    }
  });
}

function getGeolocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('No disponible')); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => reject(err),
      { timeout: 10000, maximumAge: 0 }
    );
  });
}

// ── Popup de elección de cámara (frontal / trasera) ────────────────────────

function openCameraChoiceModal(onCapture) {
  const overlay = document.createElement('div');
  overlay.className = 'camera-choice-overlay';
  overlay.innerHTML = `
    <div class="camera-choice-box">
      <div class="camera-choice-header">
        <i class="fa-solid fa-camera"></i>
        <span>Seleccionar cámara</span>
        <button class="camera-choice-close"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div class="camera-choice-btns">
        <button class="btn btn-outline camera-choice-btn" data-facing="environment">
          <i class="fa-solid fa-camera"></i>
          <span>Cámara trasera</span>
        </button>
        <button class="btn btn-outline camera-choice-btn" data-facing="user">
          <i class="fa-solid fa-camera-rotate"></i>
          <span>Cámara frontal</span>
        </button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector('.camera-choice-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  overlay.querySelectorAll('.camera-choice-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      close();
      openCameraModal(onCapture, btn.dataset.facing);
    });
  });
}

// ── Cámara getUserMedia ────────────────────────────────────────────────────

function openCameraModal(onCapture, facingMode = 'environment') {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.82);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1rem;padding:1rem';

  const video = document.createElement('video');
  video.autoplay = true;
  video.playsInline = true;
  video.style.cssText = 'max-width:100%;max-height:60vh;border-radius:8px;background:#000';

  const btnCapture = document.createElement('button');
  btnCapture.innerHTML = '<i class="fa-solid fa-camera"></i> Capturar foto';
  btnCapture.className = 'btn btn-primary';

  const btnCancel = document.createElement('button');
  btnCancel.innerHTML = '<i class="fa-solid fa-xmark"></i> Cancelar';
  btnCancel.className = 'btn btn-outline';
  btnCancel.style.color = '#fff';

  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:.75rem';
  row.append(btnCapture, btnCancel);
  overlay.append(video, row);
  document.body.appendChild(overlay);

  let stream = null;

  navigator.mediaDevices.getUserMedia({ video: { facingMode }, audio: false })
    .then((s) => { stream = s; video.srcObject = stream; })
    .catch((err) => {
      overlay.remove();
      showToast('No se pudo acceder a la cámara: ' + err.message, 'error');
    });

  function close() {
    stream?.getTracks().forEach(t => t.stop());
    overlay.remove();
  }

  btnCancel.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  btnCapture.addEventListener('click', () => {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      const file = new File([blob], `foto_${Date.now()}.jpg`, { type: 'image/jpeg' });
      onCapture(file);
      close();
    }, 'image/jpeg', 0.88);
  });
}

function esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

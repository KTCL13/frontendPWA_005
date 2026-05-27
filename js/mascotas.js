import { api } from './api.js';
import { enqueue } from './db.js';
import { uploadToCloudinary } from './cloudinary.js';

function showToast(msg, type) {
  window.dispatchEvent(new CustomEvent('app:toast', { detail: { msg, type } }));
}

export function renderMascotasView() {
  return `
    <div class="view-header">
      <h2><i class="fa-solid fa-paw"></i> Mascotas</h2>
      <button class="btn btn-primary" id="btn-nueva-mascota">
        <i class="fa-solid fa-plus"></i> Nueva
      </button>
    </div>

    <!-- Modal registro -->
    <div id="modal-mascota" class="modal hidden">
      <div class="modal-backdrop"></div>
      <div class="modal-box">
        <div class="modal-header">
          <h3 id="modal-mascota-title"><i class="fa-solid fa-paw"></i> Registrar mascota</h3>
          <button class="modal-close" id="btn-close-modal"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <form id="form-mascota" novalidate>

          <!-- Foto -->
          <div class="field-group">
            <label><i class="fa-solid fa-image"></i> Foto de la mascota</label>
            <div class="foto-btns-row">
              <button type="button" class="btn btn-outline foto-btn-camara" id="btn-m-abrir-camara">
                <i class="fa-solid fa-camera"></i> Abrir cámara
              </button>
              <button type="button" class="btn btn-outline foto-btn-archivo" id="btn-m-subir-archivo">
                <i class="fa-solid fa-folder-open"></i> Subir archivo
              </button>
            </div>
            <input type="file" id="m-foto-archivo" accept="image/*" style="display:none" />
            <div id="m-foto-preview-wrap" class="hidden" style="margin-top:.5rem;position:relative">
              <img id="m-foto-preview" alt="Vista previa"
                style="width:100%;max-height:180px;object-fit:cover;border-radius:var(--radius-md);" />
              <button type="button" id="btn-m-remove-foto"
                style="position:absolute;top:.4rem;right:.4rem;background:rgba(0,0,0,.55);color:#fff;border-radius:50%;width:28px;height:28px;font-size:.8rem;display:flex;align-items:center;justify-content:center">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </div>
            <p id="m-foto-status" class="text-muted" style="font-size:.8rem;margin-top:.3rem"></p>
          </div>

          <div class="form-grid-2">
            <div class="field-group">
              <label for="m-nombre"><i class="fa-solid fa-tag"></i> Nombre</label>
              <input type="text" id="m-nombre" placeholder="Firulais" required />
            </div>
            <div class="field-group">
              <label for="m-tipo"><i class="fa-solid fa-paw"></i> Tipo</label>
              <select id="m-tipo" required>
                <option value="">Seleccionar</option>
                <option value="PERRO">Perro</option>
                <option value="GATO">Gato</option>
                <option value="PAJARO">Pájaro</option>
                <option value="OTRO">Otro</option>
              </select>
            </div>
            <div class="field-group">
              <label for="m-edad"><i class="fa-solid fa-calendar-days"></i> Edad (años)</label>
              <input type="number" id="m-edad" min="0" max="30" placeholder="3" required />
            </div>
            <div class="field-group">
              <label for="m-genero"><i class="fa-solid fa-venus-mars"></i> Género</label>
              <select id="m-genero" required>
                <option value="">Seleccionar</option>
                <option value="MACHO">Macho</option>
                <option value="HEMBRA">Hembra</option>
              </select>
            </div>
          </div>

          <div id="mascota-error" class="alert alert-error hidden"></div>
          <button type="submit" class="btn btn-primary btn-full" id="btn-submit-mascota">
            <i class="fa-solid fa-floppy-disk"></i> Guardar mascota
          </button>
        </form>
      </div>
    </div>

    <div id="mascotas-grid" class="mascotas-grid">
      <div class="loading-inline"><i class="fa-solid fa-spinner fa-spin"></i> Cargando...</div>
    </div>`;
}

export async function initMascotasView() {
  await loadMascotas();
  setupModal();
}

async function loadMascotas() {
  const grid = document.getElementById('mascotas-grid');
  if (!grid) return;
  try {
    const mascotas = await api.get('/mascotas');
    if (!mascotas.length) {
      grid.innerHTML = '<p class="empty-state"><i class="fa-solid fa-paw"></i> No hay mascotas registradas aún.</p>';
      return;
    }
    grid.innerHTML = mascotas.map(m => `
      <div class="mascota-card">
        ${m.fotografia
          ? `<img src="${esc(m.fotografia)}" alt="${esc(m.nombre)}" class="mascota-card-img" onerror="this.style.display='none'" />`
          : `<div class="mascota-card-img" style="display:flex;align-items:center;justify-content:center">${tipoIcon(m.tipo, '3rem')}</div>`
        }
        <div class="mascota-card-body">
          <p class="mascota-card-name">${esc(m.nombre)}</p>
          <p class="mascota-card-meta">
            <span class="badge badge-primary">${esc(m.tipo)}</span>
          </p>
          <p class="mascota-card-meta" style="margin-top:.35rem">
            <i class="fa-solid fa-calendar-days"></i> ${esc(m.edad)} año${m.edad !== 1 ? 's' : ''}
            &nbsp;·&nbsp;
            <i class="fa-solid fa-venus-mars"></i> ${esc(m.genero)}
          </p>
        </div>
      </div>`).join('');
  } catch (err) {
    grid.innerHTML = `<p class="alert alert-error">${esc(err.message)}</p>`;
  }
}

// ── Modal registro ─────────────────────────────────────────────────────────

let _currentFotoFile = null;

function setupModal() {
  const modal        = document.getElementById('modal-mascota');
  const btnOpen      = document.getElementById('btn-nueva-mascota');
  const btnClose     = document.getElementById('btn-close-modal');
  const backdrop     = modal?.querySelector('.modal-backdrop');
  const form         = document.getElementById('form-mascota');
  const fotoArchivo  = document.getElementById('m-foto-archivo');
  const btnCamara    = document.getElementById('btn-m-abrir-camara');
  const btnArchivo   = document.getElementById('btn-m-subir-archivo');
  const rmFoto       = document.getElementById('btn-m-remove-foto');

  function onCapture(file) {
    _currentFotoFile = file;
    const url = URL.createObjectURL(file);
    document.getElementById('m-foto-preview').src = url;
    document.getElementById('m-foto-preview-wrap').classList.remove('hidden');
  }

  btnOpen?.addEventListener('click', () => {
    _currentFotoFile = null;
    form?.reset();
    clearMFoto();
    document.getElementById('modal-mascota-title').innerHTML = '<i class="fa-solid fa-paw"></i> Registrar mascota';
    modal.classList.remove('hidden');
  });
  btnClose?.addEventListener('click', closeModal);
  backdrop?.addEventListener('click', closeModal);

  // Botón "Abrir cámara" → muestra popup de elección frontal/trasera
  btnCamara?.addEventListener('click', () => {
    openCameraChoiceModal(onCapture);
  });

  // Botón "Subir archivo" → selector de archivo
  btnArchivo?.addEventListener('click', () => {
    fotoArchivo?.click();
  });

  fotoArchivo?.addEventListener('change', () => {
    if (fotoArchivo.files[0]) {
      _currentFotoFile = fotoArchivo.files[0];
      const url = URL.createObjectURL(_currentFotoFile);
      document.getElementById('m-foto-preview').src = url;
      document.getElementById('m-foto-preview-wrap').classList.remove('hidden');
    }
  });

  rmFoto?.addEventListener('click', () => { _currentFotoFile = null; clearMFoto(); });

  form?.addEventListener('submit', handleSubmit);
}

function clearMFoto() {
  document.getElementById('m-foto-preview-wrap')?.classList.add('hidden');
  document.getElementById('m-foto-status').textContent = '';
  const a = document.getElementById('m-foto-archivo');
  if (a) a.value = '';
}

async function handleSubmit(e) {
  e.preventDefault();
  const errDiv   = document.getElementById('mascota-error');
  const statusEl = document.getElementById('m-foto-status');
  errDiv.classList.add('hidden');
  const btn = document.getElementById('btn-submit-mascota');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando…';

  try {
    let fotografia;
    if (_currentFotoFile) {
      statusEl.textContent = 'Subiendo foto a Cloudinary…';
      try {
        fotografia = await uploadToCloudinary(_currentFotoFile);
        statusEl.textContent = '';
      } catch (uploadErr) {
        statusEl.textContent = '';
        errDiv.textContent = uploadErr.message;
        errDiv.classList.remove('hidden');
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar mascota';
        return;
      }
    }

    const dto = {
      nombre: document.getElementById('m-nombre').value.trim(),
      tipo:   document.getElementById('m-tipo').value,
      genero: document.getElementById('m-genero').value,
      edad:   Number(document.getElementById('m-edad').value),
      ...(fotografia && { fotografia }),
    };

    if (navigator.onLine) {
      await api.post('/mascotas', dto);
      showToast('Mascota registrada', 'success');
    } else {
      await enqueue('mascotas_queue', dto);
      showToast('Sin conexión — guardado localmente', 'warning');
    }

    closeModal();
    document.getElementById('form-mascota').reset();
    clearMFoto();
    _currentFotoFile = null;
    await loadMascotas();
  } catch (err) {
    errDiv.textContent = err.message;
    errDiv.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar mascota';
  }
}

function closeModal() {
  document.getElementById('modal-mascota')?.classList.add('hidden');
  document.getElementById('mascota-error')?.classList.add('hidden');
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
    .then((s) => {
      stream = s;
      video.srcObject = stream;
    })
    .catch((err) => {
      overlay.remove();
      window.dispatchEvent(new CustomEvent('app:toast', {
        detail: { msg: 'No se pudo acceder a la cámara: ' + err.message, type: 'error' }
      }));
    });

  function close() {
    stream?.getTracks().forEach(t => t.stop());
    overlay.remove();
  }

  btnCancel.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  btnCapture.addEventListener('click', () => {
    const canvas = document.createElement('canvas');
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      const file = new File([blob], `foto_${Date.now()}.jpg`, { type: 'image/jpeg' });
      onCapture(file);
      close();
    }, 'image/jpeg', 0.88);
  });
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function tipoIcon(tipo, size = '1.4rem') {
  const icons = {
    PERRO:  'fa-dog',
    GATO:   'fa-cat',
    PAJARO: 'fa-feather',
  };
  const cls = icons[tipo] || 'fa-paw';
  return `<i class="fa-solid ${cls}" style="font-size:${size};color:var(--primary-border)"></i>`;
}

function esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

import { api } from "./api.js";

function showToast(msg, type) {
  window.dispatchEvent(new CustomEvent("app:toast", { detail: { msg, type } }));
}

let mapInstance = null;

export function renderMapaView() {
  return `
    <div class="view-header" style="position:relative;z-index:2;">
      <h2><i class="fa-solid fa-map-location-dot"></i> Mapa de censos</h2>
      <button class="btn btn-primary" id="btn-reload-map">
        <i class="fa-solid fa-rotate"></i> Actualizar
      </button>
    </div>
    <div id="map-wrapper" class="map-wrapper" style="isolation:isolate;">
      <div id="leaflet-map" style="height:100%;width:100%;"></div>
    </div>`;
}

export async function initMapaView() {
  // Verificar si Leaflet está disponible
  if (typeof L === "undefined") {
    const mapWrapper = document.getElementById("map-wrapper");
    if (mapWrapper) {
      mapWrapper.innerHTML = `
        <div class="empty-state" style="padding:3rem 1rem;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;">
          <i class="fa-solid fa-wifi-slash"></i>
          <p style="margin-top:1rem;color:var(--text-muted);">
            No se pudo cargar el mapa (Leaflet no disponible)
          </p>
          <p style="font-size:.85rem;color:var(--text-muted);margin-top:.5rem;">
            Intenta nuevamente cuando tengas conexión a internet
          </p>
        </div>`;
    }
    return;
  }

  if (mapInstance) {
    mapInstance.remove();
    mapInstance = null;
  }

  mapInstance = L.map("leaflet-map").setView([4.5, -74.0], 6);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(mapInstance);

  document
    .getElementById("btn-reload-map")
    ?.addEventListener("click", loadCensos);
  await loadCensos();
}

async function loadCensos() {
  if (!mapInstance) return;

  // remove existing markers
  mapInstance.eachLayer((layer) => {
    if (layer instanceof L.CircleMarker) mapInstance.removeLayer(layer);
  });

  try {
    const censos = (await api.get("/censos")).slice().reverse();
    let valid = 0;

    for (const c of censos) {
      const lat = c.latitud ?? c.lat;
      const lon = c.longitud ?? c.lon ?? c.lng;
      if (lat == null || lon == null) continue;

      const color = c.color || "#A80081";
      const marker = L.circleMarker([lat, lon], {
        color,
        fillColor: color,
        fillOpacity: 0.85,
        radius: 10,
        weight: 2,
      });

      marker.bindPopup(buildPopup(c), { maxWidth: 260 });
      marker.addTo(mapInstance);
      valid++;
    }

    if (!valid && censos.length) {
      showToast("Los censos no tienen coordenadas GPS aún", "info");
    }
  } catch (err) {
    showToast("Error cargando censos: " + err.message, "error");
  }
}

function buildPopup(c) {
  const m = c.mascota || {};
  const d = c.dueno || {};
  const fotoUrl = c.fotografia || c.fotografiaCenso || "";
  const foto = fotoUrl
    ? `<img src="${fotoUrl}" alt="Foto" class="popup-foto" onerror="this.replaceWith(document.createElement('div'))" />`
    : `<div class="popup-no-foto"><i class="fa-solid fa-image-slash"></i></div>`;

  return `
    <div class="popup-card">
      ${foto}
      <div class="popup-body">
        <h4 class="popup-nombre">${esc(m.nombre || "—")}</h4>
        <p class="popup-meta">
          <span class="badge">${esc(m.tipo || "—")}</span>
          ${m.edad != null ? `· ${esc(m.edad)} año${m.edad !== 1 ? "s" : ""}` : ""}
        </p>
        <hr />
        <p class="popup-dueno">
          <i class="fa-solid fa-user"></i>
          ${esc(d.nombres || "")} ${esc(d.apellidos || "")}
        </p>
        ${d.telefono ? `<p class="popup-dueno"><i class="fa-solid fa-phone"></i> ${esc(d.telefono)}</p>` : ""}
      </div>
    </div>`;
}

function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

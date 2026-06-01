import {
  login,
  logout,
  isLoggedIn,
  getCurrentUser,
  requireAuth,
  isOfflineButAuthenticated,
} from "./auth.js";
import { api } from "./api.js";
import { initSync } from "./sync.js";
import {
  initNotifications,
  subscribeToNotifications,
  unsubscribeFromNotifications,
  getNotificationStatus,
} from "./notifications.js";
import { renderPersonasView, initPersonasView } from "./personas.js";
import { renderMascotasView, initMascotasView } from "./mascotas.js";
import { renderCensoView, initCensoView } from "./censo.js";
import { renderMapaView, initMapaView } from "./mapa.js";
import { initDB } from "./cache-manager.js";
import "./connection-manager.js";

// ── Toast ──────────────────────────────────────────────────────────────────
export function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  const icons = {
    success: "circle-check",
    error: "circle-exclamation",
    warning: "triangle-exclamation",
    info: "circle-info",
  };
  toast.innerHTML = `<i class="fa-solid fa-${icons[type] || "circle-info"}"></i> ${message}`;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add("toast--visible"), 10);
  setTimeout(() => {
    toast.classList.remove("toast--visible");
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

// ── Router ──────────────────────────────────────────────────────────────────
const routes = {
  "/login": { public: true, render: renderLogin, init: initLogin },
  "/registro": { public: true, render: renderRegistro, init: initRegistro },
  "/inicio": { public: false, render: renderInicio, init: initInicio },
  "/mascotas": {
    public: false,
    render: renderMascotasView,
    init: initMascotasView,
  },
  "/censo": { public: false, render: renderCensoView, init: initCensoView },
  "/mapa": { public: false, render: renderMapaView, init: initMapaView },
  "/personas": {
    public: false,
    render: renderPersonasView,
    init: initPersonasView,
  },
};

async function navigate(hash) {
  const path = hash.replace("#", "") || "/login";
  const route = routes[path];

  if (!route) {
    window.location.hash = isLoggedIn() ? "#/inicio" : "#/login";
    return;
  }

  if (!route.public && !requireAuth()) return;
  if (
    route.public &&
    isLoggedIn() &&
    (path === "/login" || path === "/registro")
  ) {
    window.location.hash = "#/inicio";
    return;
  }

  const loggedIn = isLoggedIn();
  toggleShell(loggedIn && !route.public);
  setActiveNav(path);

  if (loggedIn && !route.public) {
    const main = document.getElementById("main-content");
    main.innerHTML = route.render();
    if (route.init) await route.init();
  } else {
    showAuthScreen(path);
    if (route.init) await route.init();
  }
}

function toggleShell(showApp) {
  document.getElementById("auth-container").classList.toggle("hidden", showApp);
  document.getElementById("app-container").classList.toggle("hidden", !showApp);
  const user = getCurrentUser();
  document.getElementById("header-usuario").textContent = user;
}

function showAuthScreen(path) {
  document
    .querySelectorAll(".auth-screen")
    .forEach((s) => s.classList.remove("active"));
  const id = path === "/registro" ? "view-registro" : "view-login";
  document.getElementById(id)?.classList.add("active");
}

function setActiveNav(path) {
  document.querySelectorAll("[data-route]").forEach((el) => {
    el.classList.toggle("active", el.dataset.route === path);
  });
}

// ── Login view ──────────────────────────────────────────────────────────────
function renderLogin() {
  return "";
}

function initLogin() {
  const form = document.getElementById("form-login");
  if (!form || form._bound) return;
  form._bound = true;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errDiv = document.getElementById("login-error");
    errDiv.classList.add("hidden");
    const btn = document.getElementById("btn-login");
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Ingresando…';
    try {
      await login(
        document.getElementById("login-usuario").value.trim(),
        document.getElementById("login-contrasena").value,
      );
      window.location.hash = "#/inicio";
      initNotifications();
    } catch (err) {
      errDiv.textContent = err.message;
      errDiv.classList.remove("hidden");
    } finally {
      btn.disabled = false;
      btn.innerHTML =
        '<i class="fa-solid fa-right-to-bracket"></i> Iniciar sesión';
    }
  });
  setupTogglePassword();
}

// ── Registro view ───────────────────────────────────────────────────────────
function renderRegistro() {
  return "";
}

function initRegistro() {
  const form = document.getElementById("form-registro");
  if (!form || form._bound) return;
  form._bound = true;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errDiv = document.getElementById("registro-error");
    const sucDiv = document.getElementById("registro-success");
    errDiv.classList.add("hidden");
    sucDiv.classList.add("hidden");
    const btn = document.getElementById("btn-registro");
    btn.disabled = true;
    btn.innerHTML =
      '<i class="fa-solid fa-spinner fa-spin"></i> Creando cuenta…';
    const dto = {
      nombres: document.getElementById("reg-nombres").value.trim(),
      apellidos: document.getElementById("reg-apellidos").value.trim(),
      tipoDocumento: document.getElementById("reg-tipo-doc").value,
      documento: document.getElementById("reg-documento").value.trim(),
      telefono: document.getElementById("reg-telefono").value.trim(),
      ciudad: document.getElementById("reg-ciudad").value.trim(),
      direccion: document.getElementById("reg-direccion").value.trim(),
      usuario: document.getElementById("reg-usuario").value.trim(),
      contrasena: document.getElementById("reg-contrasena").value,
    };
    try {
      await api.post("/personas/registro", dto);
      sucDiv.textContent = "¡Cuenta creada! Ya puedes iniciar sesión.";
      sucDiv.classList.remove("hidden");
      form.reset();
      setTimeout(() => {
        window.location.hash = "#/login";
      }, 1800);
    } catch (err) {
      errDiv.textContent = err.message;
      errDiv.classList.remove("hidden");
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Crear cuenta';
    }
  });
  setupTogglePassword();
}

// ── Inicio (dashboard) ──────────────────────────────────────────────────────
function renderInicio() {
  const user = getCurrentUser();
  return `
    <div class="view-header">
      <h2><i class="fa-solid fa-house"></i> Inicio</h2>
    </div>

    <div class="dashboard-welcome card">
      <div class="dashboard-welcome__avatar"><i class="fa-solid fa-user-circle"></i></div>
      <div>
        <p class="dashboard-welcome__greeting">Bienvenido,</p>
        <h3 class="dashboard-welcome__name">${esc(user)}</h3>
      </div>
    </div>

    <div class="stats-grid" id="stats-grid">
      <div class="stat-card stat-card--loading"><i class="fa-solid fa-spinner fa-spin"></i><span class="stat-number">—</span><span class="stat-label">Mascotas</span></div>
      <div class="stat-card stat-card--loading"><i class="fa-solid fa-spinner fa-spin"></i><span class="stat-number">—</span><span class="stat-label">Censos</span></div>
      <div class="stat-card stat-card--loading"><i class="fa-solid fa-spinner fa-spin"></i><span class="stat-number">—</span><span class="stat-label">Personas</span></div>
    </div>

    <div class="dashboard-actions">
      <a href="#/censo" class="dashboard-action-btn">
        <i class="fa-solid fa-plus"></i>
        <span>Nuevo Censo</span>
      </a>
      <a href="#/mascotas" class="dashboard-action-btn">
        <i class="fa-solid fa-paw"></i>
        <span>Mascotas</span>
      </a>
      <a href="#/mapa" class="dashboard-action-btn">
        <i class="fa-solid fa-map-location-dot"></i>
        <span>Ver Mapa</span>
      </a>
      <a href="#/personas" class="dashboard-action-btn">
        <i class="fa-solid fa-users"></i>
        <span>Personas</span>
      </a>
    </div>

    <div class="card" style="margin-top:1.25rem">
      <div class="card-header">
        <span class="card-title"><i class="fa-solid fa-bell"></i> Notificaciones push</span>
      </div>
      <p style="font-size:.88rem;color:var(--text-muted);margin-bottom:.75rem">
        Recibe alertas cuando se registre un nuevo censo.
      </p>
      <div style="display:flex;gap:.6rem;flex-wrap:wrap">
        <button class="btn btn-outline btn-sm" id="btn-subscribe-notif" style="flex:1;min-width:140px">
          <i class="fa-solid fa-bell"></i> Activar notificaciones
        </button>
        <button class="btn btn-outline btn-sm hidden" id="btn-unsubscribe-notif" style="flex:1;min-width:140px;color:var(--danger,#d32f2f);border-color:var(--danger,#d32f2f)">
          <i class="fa-solid fa-bell-slash"></i> Desactivar notificaciones
        </button>
      </div>
      <p id="notif-status" class="text-muted" style="margin-top:.5rem;font-size:.82rem"></p>
    </div>`;
}

async function initInicio() {
  try {
    const [mascotas, censos, personas] = await Promise.all([
      api.get("/mascotas"),
      api.get("/censos"),
      api.get("/personas"),
    ]);
    const data = [
      {
        n: mascotas.length,
        icon: "paw",
        label: "Mascotas",
        href: "#/mascotas",
        color: "#A80081",
      },
      {
        n: censos.length,
        icon: "clipboard-list",
        label: "Censos",
        href: "#/mapa",
        color: "#0077CC",
      },
      {
        n: personas.length,
        icon: "users",
        label: "Personas",
        href: "#/personas",
        color: "#2E7D32",
      },
    ];
    document.querySelectorAll(".stat-card").forEach((card, i) => {
      const d = data[i];
      card.classList.remove("stat-card--loading");
      card.style.setProperty("--stat-color", d.color);
      card.innerHTML = `
        <a href="${d.href}" style="text-decoration:none;color:inherit;display:contents">
          <i class="fa-solid fa-${d.icon}"></i>
          <span class="stat-number">${d.n}</span>
          <span class="stat-label">${d.label}</span>
        </a>`;
    });
  } catch (err) {
    // Si estamos offline pero autenticados
    if (isOfflineButAuthenticated()) {
      showToast(
        "Modo offline - algunos datos pueden no estar disponibles",
        "warning",
      );
      document.querySelectorAll(".stat-card").forEach((card) => {
        card.classList.remove("stat-card--loading");
        card.innerHTML = `
          <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:0.5rem;color:var(--text-muted);">
            <i class="fa-solid fa-wifi-slash"></i>
            <span style="font-size:0.85rem;">Offline</span>
          </div>`;
      });
    } else {
      console.error("Error cargando estadísticas:", err);
    }
  }

  // notifications toggle buttons
  const btnSub = document.getElementById("btn-subscribe-notif");
  const btnUnsub = document.getElementById("btn-unsubscribe-notif");
  const status = document.getElementById("notif-status");
  if (!btnSub) return;

  if (!("PushManager" in window)) {
    btnSub.disabled = true;
    status.textContent = "Este navegador no soporta notificaciones push.";
    return;
  }

  async function refreshNotifUI() {
    const st = await getNotificationStatus();
    if (st === "subscribed") {
      btnSub.classList.add("hidden");
      btnUnsub.classList.remove("hidden");
      status.textContent =
        "Notificaciones activas. Recibirás alertas de nuevos censos.";
    } else {
      btnSub.classList.remove("hidden");
      btnUnsub.classList.add("hidden");
      status.textContent = "Notificaciones desactivadas.";
    }
  }

  await refreshNotifUI();

  btnSub.addEventListener("click", async () => {
    btnSub.disabled = true;
    btnSub.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Activando…';
    try {
      await subscribeToNotifications();
      showToast("Notificaciones activadas", "success");
    } catch (err) {
      status.textContent = "Error: " + err.message;
    } finally {
      btnSub.disabled = false;
      btnSub.innerHTML =
        '<i class="fa-solid fa-bell"></i> Activar notificaciones';
      await refreshNotifUI();
    }
  });

  btnUnsub.addEventListener("click", async () => {
    btnUnsub.disabled = true;
    btnUnsub.innerHTML =
      '<i class="fa-solid fa-spinner fa-spin"></i> Desactivando…';
    try {
      await unsubscribeFromNotifications();
      showToast("Notificaciones desactivadas", "info");
    } catch (err) {
      status.textContent = "Error: " + err.message;
    } finally {
      btnUnsub.disabled = false;
      btnUnsub.innerHTML =
        '<i class="fa-solid fa-bell-slash"></i> Desactivar notificaciones';
      await refreshNotifUI();
    }
  });
}

// ── Password toggle ──────────────────────────────────────────────────────────
function setupTogglePassword() {
  document.querySelectorAll(".toggle-password").forEach((btn) => {
    if (btn._bound) return;
    btn._bound = true;
    btn.addEventListener("click", () => {
      const input = btn.previousElementSibling;
      if (!input) return;
      const isPass = input.type === "password";
      input.type = isPass ? "text" : "password";
      btn.querySelector("i").className =
        `fa-solid fa-eye${isPass ? "-slash" : ""}`;
    });
  });
}

// ── Offline banner ───────────────────────────────────────────────────────────
function initOfflineBanner() {
  const banner = document.getElementById("offline-banner");
  const update = () => banner.classList.toggle("hidden", navigator.onLine);
  window.addEventListener("online", update);
  window.addEventListener("offline", update);
  update();
}

// ── Logout buttons ───────────────────────────────────────────────────────────
function initLogoutButtons() {
  // Usar event delegation para que funcione aunque el botón se agregue después
  document.addEventListener("click", (e) => {
    if (
      e.target.id === "btn-logout" ||
      e.target.id === "btn-logout-sidebar" ||
      e.target.closest("#btn-logout") ||
      e.target.closest("#btn-logout-sidebar")
    ) {
      logout();
    }
  });
}

// ── Sidebar toggle (desktop only — mobile uses bottom nav) ───────────────────
function initSidebarToggle() {
  // On mobile the sidebar is hidden via CSS (display:none).
  // The hamburger button is also hidden, so this handler is a no-op on mobile.
  const btn = document.getElementById("btn-menu-toggle");
  const sidebar = document.getElementById("sidebar");
  btn?.addEventListener("click", () => {
    if (window.innerWidth >= 768) {
      sidebar?.classList.toggle("sidebar--open");
    }
  });
}

// ── Service Worker ───────────────────────────────────────────────────────────
async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register("/sw.js");
  } catch (err) {
    console.warn("SW registration failed:", err);
  }
}

// ── Font Awesome & Leaflet Fallback ────────────────────────────────────────
function checkFontAwesomeLoaded() {
  // Verificar si Font Awesome CSS cargó intentando acceder a una clase
  const testEl = document.createElement("div");
  testEl.className = "fa-solid fa-check";
  testEl.style.display = "none";
  document.body.appendChild(testEl);

  const computed = window.getComputedStyle(testEl, ":before");
  const content = computed.content;
  document.body.removeChild(testEl);

  // Si content es "none" o vacío, Font Awesome no cargó
  if (!content || content === "none" || content === '""') {
    console.warn("Font Awesome no cargó - usando fallback");
    document.documentElement.setAttribute("data-no-fontawesome", "true");
    // Mostrar notificación
    showToast(
      "Algunos íconos pueden no verse correctamente (sin conexión)",
      "warning",
    );
  }
}

// ── Bootstrap ────────────────────────────────────────────────────────────────
async function bootstrap() {
  checkFontAwesomeLoaded();
  await initDB();
  initOfflineBanner();
  initLogoutButtons();
  initSidebarToggle();
  window.addEventListener("app:toast", (e) =>
    showToast(e.detail.msg, e.detail.type),
  );
  initSync();
  await registerServiceWorker();

  window.addEventListener("hashchange", () => navigate(window.location.hash));
  const initial =
    window.location.hash || (isLoggedIn() ? "#/inicio" : "#/login");
  await navigate(initial);

  if (isLoggedIn()) initNotifications();
}

bootstrap();

function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

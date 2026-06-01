/**
 * Connection Manager - Detecta cambios de conexión y maneja auto-actualización
 */

import { saveTimestamp } from "./cache-manager.js";

let isOnline = navigator.onLine;
const UPDATE_EVENT = "data-needs-refresh";

/**
 * Escuchar cambios de conexión
 */
export function initConnectionListener() {
  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);
}

/**
 * Handler cuando se restablece conexión
 */
function handleOnline() {
  console.log("✓ Conexión restablecida");
  isOnline = true;

  // Disparar evento para que los componentes se actualicen
  window.dispatchEvent(
    new CustomEvent(UPDATE_EVENT, { detail: { online: true } }),
  );

  // Notificar al usuario
  showConnectionNotification(
    "Conexión restablecida. Actualizando datos...",
    "success",
  );

  // Forzar refresh de datos después de un segundo
  setTimeout(() => {
    refreshAllData();
  }, 1000);
}

/**
 * Handler cuando se pierde conexión
 */
function handleOffline() {
  console.log("✗ Sin conexión");
  isOnline = false;
  showConnectionNotification(
    "Sin conexión. Mostrando datos en caché.",
    "warning",
  );
}

/**
 * Verificar estado actual de conexión
 */
export function isConnected() {
  return isOnline;
}

/**
 * Refrescar todos los datos
 */
export async function refreshAllData() {
  // Disparar evento personalizado que cada panel puede escuchar
  window.dispatchEvent(new CustomEvent("refresh-data"));
}

/**
 * Mostrar notificación de conexión
 */
function showConnectionNotification(message, type = "info") {
  // Crear elemento de notificación
  const notification = document.createElement("div");
  notification.className = `connection-notification connection-notification-${type}`;
  notification.innerHTML = `
    <div class="notification-content">
      <span class="notification-icon">${type === "success" ? "✓" : "⚠"}</span>
      <span class="notification-message">${message}</span>
    </div>
  `;

  document.body.appendChild(notification);

  // Auto-remover después de 4 segundos
  setTimeout(() => {
    notification.classList.add("notification-hide");
    setTimeout(() => notification.remove(), 300);
  }, 4000);
}

/**
 * Escuchar mensajes del Service Worker
 */
export function initServiceWorkerMessageListener() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", (event) => {
      const { type, url, timestamp } = event.data;

      if (type === "data-updated") {
        console.log("Datos actualizados desde SW:", url);
        // Guardar timestamp
        saveTimestamp(url, new Date(timestamp));
        // Disparar evento para que los componentes se enteren
        window.dispatchEvent(
          new CustomEvent("cache-updated", { detail: { url, timestamp } }),
        );
      } else if (type === "sync") {
        console.log("Background sync triggered");
        refreshAllData();
      }
    });
  }
}

/**
 * Detectar cambios de conexión periódicamente (fallback)
 */
export function initPeriodicConnectionCheck() {
  setInterval(() => {
    const wasOnline = isOnline;
    isOnline = navigator.onLine;

    if (wasOnline && !isOnline) {
      handleOffline();
    } else if (!wasOnline && isOnline) {
      handleOnline();
    }
  }, 2000);
}

// Inicializar todo al cargar el módulo
initConnectionListener();
initServiceWorkerMessageListener();
initPeriodicConnectionCheck();

console.log("Connection Manager initialized");

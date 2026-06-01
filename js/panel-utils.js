/**
 * Panel Utils - Utilidades para mostrar timestamps en paneles
 */

import { getFormattedTimestamp, saveTimestamp } from "./cache-manager.js";

/**
 * Crear un elemento de timestamp para mostrar debajo del título
 * @param {string} cacheKey - Identificador del cache
 * @returns {Promise<HTMLElement>}
 */
export async function createTimestampElement(cacheKey) {
  const container = document.createElement("div");
  container.className = "panel-timestamp-container";

  const timestamp = await getFormattedTimestamp(cacheKey);

  container.innerHTML = `
    <small class="panel-timestamp">
      <span class="timestamp-label">Última actualización:</span>
      <span class="timestamp-value">${timestamp}</span>
    </small>
  `;

  return container;
}

/**
 * Insertar timestamp debajo del título de un panel
 * @param {HTMLElement} titleElement - Elemento del título
 * @param {string} cacheKey - Identificador del cache
 */
export async function insertTimestampAfterTitle(titleElement, cacheKey) {
  const timestamp = await createTimestampElement(cacheKey);
  titleElement.insertAdjacentElement("afterend", timestamp);

  // Actualizar timestamp cuando se dispare el evento
  window.addEventListener("cache-updated", async (e) => {
    if (e.detail.url.includes(cacheKey)) {
      const newTimestamp = await getFormattedTimestamp(cacheKey);
      const timestampValue = timestamp.querySelector(".timestamp-value");
      if (timestampValue) {
        timestampValue.textContent = newTimestamp;
        timestampValue.classList.add("timestamp-updated");
        setTimeout(
          () => timestampValue.classList.remove("timestamp-updated"),
          1000,
        );
      }
    }
  });
}

/**
 * Actualizar timestamp en un elemento existente
 * @param {HTMLElement} containerElement - Elemento contenedor del timestamp
 * @param {string} cacheKey - Identificador del cache
 */
export async function updateTimestampDisplay(containerElement, cacheKey) {
  const timestamp = await getFormattedTimestamp(cacheKey);
  const timestampValue = containerElement.querySelector(".timestamp-value");

  if (timestampValue) {
    timestampValue.textContent = timestamp;
    timestampValue.classList.add("timestamp-updated");
    setTimeout(
      () => timestampValue.classList.remove("timestamp-updated"),
      1000,
    );
  }
}

/**
 * Helper para registrar un listener de actualización de datos
 * @param {string} cacheKey - Identificador del cache
 * @param {Function} callback - Función a ejecutar cuando se actualicen los datos
 */
export function onDataUpdate(cacheKey, callback) {
  window.addEventListener("cache-updated", (e) => {
    if (e.detail.url.includes(cacheKey)) {
      callback(e.detail);
    }
  });

  window.addEventListener("refresh-data", callback);
}

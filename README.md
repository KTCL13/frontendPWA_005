# Frontend — Censo de Mascotas

PWA construida en HTML + CSS + JS vanilla. Sin frameworks, sin bundler.

## Requisitos previos

- El backend debe estar corriendo en `http://localhost:3000`  
  (ver instrucciones en `../backend/README.md`)
- Node.js o Python instalado (para el servidor estático)

## Correr el frontend

Desde la carpeta `frontend/`, elige una opción:

### Opción A — Python (sin instalar nada)
```bash
python3 -m http.server 8080
```

### Opción B — Node.js (sin instalar nada)
```bash
npx serve . -p 8080
```

### Opción C — Live Server (VS Code)
1. Instala la extensión **Live Server** en VS Code
2. Clic derecho sobre `index.html` → **Open with Live Server**

Luego abre en el navegador: **http://localhost:8080**

---

## Primer uso

1. Ve a **Regístrate aquí** y crea tu cuenta de encuestador
2. Inicia sesión con el usuario que acabas de crear
3. Registra una mascota en la sección **Mascotas**
4. Crea un censo en **Nuevo Censo** (requiere cámara y GPS)
5. Visualiza los censos en el **Mapa**

---

## Funciones offline

La app funciona sin conexión:

- Los censos, mascotas y personas creados sin red se guardan en **IndexedDB**
- Al recuperar la conexión se sincronizan automáticamente al backend
- Un banner en la parte superior indica cuando no hay red

---

## Estructura de archivos

```
frontend/
├── index.html          # SPA única (todas las vistas)
├── manifest.json       # Configuración PWA
├── sw.js               # Service Worker (caché, push, sync)
├── css/
│   └── styles.css      # Estilos globales
├── js/
│   ├── app.js          # Router y bootstrap
│   ├── api.js          # Comunicación con el backend
│   ├── auth.js         # Login / logout / sesión
│   ├── db.js           # IndexedDB (cola offline)
│   ├── sync.js         # Sincronización al volver online
│   ├── censo.js        # Formulario de censo
│   ├── mascotas.js     # Listado y registro de mascotas
│   ├── personas.js     # Listado de personas
│   ├── mapa.js         # Mapa Leaflet con marcadores
│   └── notifications.js# Suscripción a notificaciones push
└── assets/
    └── icons/          # Íconos PWA (SVG + PNG)
```

---

## Notas

- El Service Worker solo funciona en `localhost` o HTTPS.
- Para instalar la app como PWA, abre el sitio en Chrome y busca el ícono de instalación en la barra de direcciones.
- Los íconos PNG en `assets/icons/` son placeholders; reemplázalos con íconos reales antes de producción ejecutando `node generate-icons.js` o usando tus propias imágenes.

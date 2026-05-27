// Cloud name correcto según el endpoint indicado
const CLOUD_NAME = 'dltdoqcwz';
const UPLOAD_PRESET = 'pwa_005_uploads';

/**
 * Sube un File/Blob a Cloudinary y devuelve la URL segura.
 * @param {File|Blob} file
 * @returns {Promise<string>} secure_url
 */
export async function uploadToCloudinary(file) {
  const form = new FormData();
  form.append('file', file);
  form.append('upload_preset', UPLOAD_PRESET);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body: form,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = data?.error?.message || `Error ${res.status}`;
    if (msg.toLowerCase().includes('upload preset')) {
      throw new Error(
        `Cloudinary: el preset "${UPLOAD_PRESET}" debe estar configurado como Unsigned. ` +
        `Ve a Cloudinary → Settings → Upload → Upload presets → edita "${UPLOAD_PRESET}" → cambia a Unsigned.`
      );
    }
    throw new Error(`Cloudinary: ${msg}`);
  }

  return data.secure_url;
}

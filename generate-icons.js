/**
 * Generates placeholder PWA icons as solid-color PNGs.
 * Run once: node generate-icons.js
 * Requires no external dependencies (uses zlib built-in).
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT_DIR = path.join(__dirname, 'assets/icons');
const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const BG_COLOR = { r: 0xa8, g: 0x00, b: 0x81, a: 0xff }; // #A80081

function createPNG(size) {
  const width = size, height = size;

  // Raw image data: RGBA rows, each prefixed with filter byte 0x00
  const rowSize = width * 4;
  const raw = Buffer.alloc((rowSize + 1) * height);
  for (let y = 0; y < height; y++) {
    const offset = y * (rowSize + 1);
    raw[offset] = 0x00; // filter type: None
    for (let x = 0; x < width; x++) {
      // Draw a simple rounded square background + white paw silhouette
      const px = offset + 1 + x * 4;
      const cx = width / 2, cy = height / 2;
      const r = Math.min(width, height) * 0.42;
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (dist < r) {
        // inside circle — white
        raw[px]     = 0xff;
        raw[px + 1] = 0xff;
        raw[px + 2] = 0xff;
        raw[px + 3] = 0xff;
      } else {
        raw[px]     = BG_COLOR.r;
        raw[px + 1] = BG_COLOR.g;
        raw[px + 2] = BG_COLOR.b;
        raw[px + 3] = BG_COLOR.a;
      }
    }
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });

  function crc32(buf) {
    const table = (() => {
      const t = new Uint32Array(256);
      for (let i = 0; i < 256; i++) {
        let c = i;
        for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : (c >>> 1);
        t[i] = c;
      }
      return t;
    })();
    let crc = 0xffffffff;
    for (const byte of buf) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function chunk(type, data) {
    const typeBytes = Buffer.from(type, 'ascii');
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(data.length);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])));
    return Buffer.concat([lenBuf, typeBytes, data, crcBuf]);
  }

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 2;   // color type: RGB — wait we have RGBA, use 6
  ihdr[9] = 6;   // RGBA
  ihdr[10] = 0;  // compression
  ihdr[11] = 0;  // filter
  ihdr[12] = 0;  // interlace

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

for (const size of SIZES) {
  const png = createPNG(size);
  const filename = path.join(OUT_DIR, `icon-${size}.png`);
  fs.writeFileSync(filename, png);
  console.log(`✓ icon-${size}.png (${png.length} bytes)`);
}

console.log('\nDone! Replace with real icons for production.');

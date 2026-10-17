// Gera os ícones PNG do app (halter branco sobre o azul do app), sem dependências.
const fs = require("fs"), path = require("path"), zlib = require("zlib");
const AZUL = [31, 79, 208], BRANCO = [255, 255, 255];

function crcTable() { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; }
const T = crcTable();
function crc(buf) { let c = 0xffffffff; for (const b of buf) c = T[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(tipo, dados) {
  const len = Buffer.alloc(4); len.writeUInt32BE(dados.length);
  const td = Buffer.concat([Buffer.from(tipo), dados]), c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
}
function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) { const p = pixel(x / size, y / size), o = y * (size * 4 + 1) + 1 + x * 4; raw[o] = p[0]; raw[o + 1] = p[1]; raw[o + 2] = p[2]; raw[o + 3] = p[3]; }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}
// halter: barra central + duas anilhas de cada lado, dentro da área segura (escala s em torno do centro)
function halter(u, v, s) {
  const x = (u - 0.5) / s + 0.5, y = (v - 0.5) / s + 0.5;
  const r = (x0, x1, y0, y1, rad) => {
    if (x < x0 || x > x1 || y < y0 || y > y1) return false;
    const cx = Math.min(Math.max(x, x0 + rad), x1 - rad), cy = Math.min(Math.max(y, y0 + rad), y1 - rad);
    return (x - cx) ** 2 + (y - cy) ** 2 <= rad * rad;
  };
  return r(0.30, 0.70, 0.465, 0.535, 0.01) || r(0.20, 0.29, 0.30, 0.70, 0.025) || r(0.71, 0.80, 0.30, 0.70, 0.025) ||
    r(0.12, 0.19, 0.36, 0.64, 0.02) || r(0.81, 0.88, 0.36, 0.64, 0.02);
}
function icone(size, maskable) {
  const s = maskable ? 0.78 : 1;
  return png(size, (u, v) => {
    if (!maskable) {
      const rad = 0.22, cx = Math.min(Math.max(u, rad), 1 - rad), cy = Math.min(Math.max(v, rad), 1 - rad);
      if ((u - cx) ** 2 + (v - cy) ** 2 > rad * rad) return [0, 0, 0, 0];
    }
    return halter(u, v, s) ? [...BRANCO, 255] : [...AZUL, 255];
  });
}
const dir = path.join(__dirname, "..", "icons");
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, "icon-192.png"), icone(192, false));
fs.writeFileSync(path.join(dir, "icon-512.png"), icone(512, false));
fs.writeFileSync(path.join(dir, "maskable-512.png"), icone(512, true));
fs.writeFileSync(path.join(dir, "apple-touch-icon.png"), icone(180, true));
console.log("ícones gerados em", dir);

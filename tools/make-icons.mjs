// Zero-dep PNG icon generator: green felt, one white card, brass diamond pip.
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

function png(size, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const FELT = hex("#0c2318");
const FELT2 = hex("#1d4a32");
const CARD = hex("#fbf9f4");
const BRASS = hex("#e5b04a");

// signed distance to a rounded rectangle centered at (cx,cy)
const sdRoundRect = (px, py, cx, cy, hw, hh, r) => {
  const qx = Math.abs(px - cx) - (hw - r), qy = Math.abs(py - cy) - (hh - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
};
// diamond (rotated square) via L1 norm
const sdDiamond = (px, py, cx, cy, r) => Math.abs(px - cx) + Math.abs(py - cy) - r;

function draw(size) {
  const px = Buffer.alloc(size * size * 4);
  const u = size / 512;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const d = Math.hypot(x - size / 2, y - size / 2) / (size / 2);
      const mix = Math.max(0, 1 - d * d);
      let [r, g, b] = [0, 1, 2].map((k) => Math.round(FELT[k] + (FELT2[k] - FELT[k]) * mix * 0.9));
      const card = sdRoundRect(x, y, size / 2, size / 2, 128 * u, 176 * u, 22 * u);
      if (card < 0) {
        const edge = Math.min(1, -card / (3 * u));
        [r, g, b] = [0, 1, 2].map((k) => Math.round(r + (CARD[k] - r) * edge));
        const pip = sdDiamond(x, y, size / 2, size / 2, 74 * u);
        if (pip < 0) {
          const pedge = Math.min(1, -pip / (3 * u));
          [r, g, b] = [0, 1, 2].map((k) => Math.round(r + (BRASS[k] - r) * pedge));
        }
      }
      px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255;
    }
  }
  return px;
}

mkdirSync(new URL("../icons/", import.meta.url), { recursive: true });
for (const size of [192, 512]) {
  writeFileSync(new URL(`../icons/icon-${size}.png`, import.meta.url), png(size, draw(size)));
}
writeFileSync(new URL("../icons/apple-touch-icon.png", import.meta.url), png(180, draw(180)));
console.log("icons written");

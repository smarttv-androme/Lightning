// Generates the PNG posters used by lightning-rtt.html (no dependencies). Usage: node device-tests/rtt-check/make-images.mjs
// 480x270 RGBA (drawn at 240x135, like 2x artwork): stripes + a soft circle + a solid block at the top right whose color
// (blockColor in lightning-rtt.html) is verified on screen.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'img');
const W = 480, H = 270, COUNT = 8;
export const blockColor = (n) => [255 - n * 25, 60 + n * 22, 90 + (n * 53) % 160];

const crcTable = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = (buf) => { let c = -1; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function chunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
}

fs.mkdirSync(dir, { recursive: true });
for (let n = 0; n < COUNT; n++) {
    const raw = Buffer.alloc((W * 4 + 1) * H);
    const a = [30 + n * 20, 50 + (n * 37) % 120, 110], b = [10, 20 + n * 8, 40 + (n * 29) % 100], blk = blockColor(n);
    for (let y = 0; y < H; y++) {
        raw[y * (W * 4 + 1)] = 0; // filter: none
        for (let x = 0; x < W; x++) {
            let c = Math.floor((x + y) / 24) % 2 ? a : b;
            const dx = x - 120, dy = y - 150, d = Math.sqrt(dx * dx + dy * dy);
            if (d < 90) { const t = 1 - d / 90; c = c.map((v) => Math.round(v + (255 - v) * t * 0.6)); }
            if (x >= 330 && x < 470 && y >= 36 && y < 88) c = blk;
            raw.set([c[0], c[1], c[2], 255], y * (W * 4 + 1) + 1 + x * 4);
        }
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
    const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
    fs.writeFileSync(path.join(dir, `poster-${n}.png`), png);
}
console.log(`wrote ${COUNT} posters to ${dir}`);

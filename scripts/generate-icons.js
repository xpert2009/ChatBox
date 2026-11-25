import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const outputDirectory = fileURLToPath(new URL('../client/public/', import.meta.url));
const glyph = [
  '01110',
  '10001',
  '10001',
  '10001',
  '10001',
  '10001',
  '01110',
];

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}

function createIcon(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const center = (size - 1) / 2;
  const radius = size * 0.4;
  const pixelScale = Math.max(1, Math.round(size / 18));
  const glyphWidth = 5 * pixelScale;
  const glyphHeight = 7 * pixelScale;
  const glyphLeft = Math.floor((size - glyphWidth) / 2);
  const glyphTop = Math.floor((size - glyphHeight) / 2);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4;
      const dx = x - center;
      const dy = y - center;
      const inCircle = dx * dx + dy * dy <= radius * radius;
      let isLetter = false;

      if (inCircle) {
        const column = Math.floor((x - glyphLeft) / pixelScale);
        const row = Math.floor((y - glyphTop) / pixelScale);
        isLetter = column >= 0 && column < 5 && row >= 0 && row < 7 && glyph[row][column] === '1';
      }

      pixels[offset] = isLetter ? 10 : inCircle ? 37 : 10;
      pixels[offset + 1] = isLetter ? 10 : inCircle ? 211 : 10;
      pixels[offset + 2] = isLetter ? 10 : inCircle ? 102 : 10;
      pixels[offset + 3] = 255;
    }
  }

  const scanlines = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y += 1) {
    pixels.copy(scanlines, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(scanlines)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const size of [192, 512]) {
  const outputPath = path.join(outputDirectory, `icon-${size}.png`);
  fs.writeFileSync(outputPath, createIcon(size));
  console.log(`Created: ${outputPath}`);
}

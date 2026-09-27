import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicDir = path.resolve(__dirname, '../public');
const iconSvgPath = path.join(publicDir, 'icon.svg');
const iconMaskableSvgPath = path.join(publicDir, 'icon-maskable.svg');

async function generate() {
  const iconSvg = fs.readFileSync(iconSvgPath);
  const iconMaskableSvg = fs.readFileSync(iconMaskableSvgPath);

  // 192x192
  await sharp(iconSvg)
    .resize(192, 192)
    .png()
    .toFile(path.join(publicDir, 'pwa-192x192.png'));
  console.log('pwa-192x192.png generated');

  // 512x512
  await sharp(iconSvg)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'pwa-512x512.png'));
  console.log('pwa-512x512.png generated');

  // 512x512 maskable
  await sharp(iconMaskableSvg)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'pwa-maskable-512x512.png'));
  console.log('pwa-maskable-512x512.png generated');

  // 180x180 apple-touch-icon
  await sharp(iconSvg)
    .resize(180, 180)
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('apple-touch-icon.png generated');

  // favicon.ico (64x64 png format)
  await sharp(iconSvg)
    .resize(64, 64)
    .png()
    .toFile(path.join(publicDir, 'favicon.ico'));
  console.log('favicon.ico generated');
}

generate().catch(err => {
  console.error(err);
  process.exit(1);
});

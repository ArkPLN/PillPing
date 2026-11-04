import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();

const jobs = [
  ['assets/icon/app-icon.svg', 'assets/images/icon.png', 1024],
  ['assets/icon/app-icon-foreground.svg', 'assets/images/android-icon-foreground.png', 1024],
  ['assets/icon/app-icon-background.svg', 'assets/images/android-icon-background.png', 1024],
  ['assets/icon/app-icon-monochrome.svg', 'assets/images/android-icon-monochrome.png', 1024],
  ['assets/icon/app-icon.svg', 'assets/images/splash-icon.png', 1024],
  ['assets/icon/app-icon.svg', 'assets/images/favicon.png', 48],
  ['assets/icon/notification-icon.svg', 'assets/images/notification-icon.png', 96],
];

for (const [src, out, size] of jobs) {
  const svg = await readFile(join(root, src));
  await sharp(svg).resize(size, size, { fit: 'fill' }).png().toFile(join(root, out));
  console.log(`${out}  ${size}x${size}`);
}

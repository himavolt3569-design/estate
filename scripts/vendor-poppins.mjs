// Fetch the existing project typeface from its official Google Fonts sources.
import { mkdir, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
const destination = new URL('../public/fonts/', import.meta.url);
await mkdir(destination, { recursive: true });
const source = 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap';
const response = await fetch(source, { headers: { 'User-Agent': 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36' } });
if (!response.ok) throw new Error(`Font stylesheet returned ${response.status}`);
let css = await response.text();
const urls = [...new Set([...css.matchAll(/url\((https:\/\/fonts[.]gstatic[.]com\/[^)]+)\)/g)].map(match => match[1]))];
if (!urls.length) throw new Error('No official font URLs returned.');
for (const url of urls) {
  const font = await fetch(url);
  if (!font.ok) throw new Error(`Font download returned ${font.status}`);
  const filename = basename(new URL(url).pathname);
  await writeFile(new URL(filename, destination), Buffer.from(await font.arrayBuffer()));
  css = css.split(url).join(`/fonts/${filename}`);
}
const license = await fetch('https://raw.githubusercontent.com/google/fonts/main/ofl/poppins/OFL.txt');
if (!license.ok) throw new Error(`Font license returned ${license.status}`);
await writeFile(new URL('OFL-Poppins.txt', destination), await license.text());
await writeFile(new URL('poppins.css', destination), `/* Poppins by Indian Type Foundry. Source: ${source}. License: OFL-Poppins.txt. */\n${css}`);
console.log(`Vendored ${urls.length} official Poppins font files and their license.`);

// Downloads the latin variable woff2 files and OFL licenses for
// Google Sans Flex and Google Sans Code into app/fonts/. Run: node scripts/fetch-fonts.mjs
// Only the latin subset is shipped (covers Latin-1 such as é ñ à ç).
import { writeFile, mkdir } from 'node:fs/promises';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const FAMILIES = [
  { name: 'GoogleSansFlex', css: 'Google+Sans+Flex:wght@100..1000', ofl: 'ofl/googlesansflex/OFL.txt' },
  { name: 'GoogleSansCode', css: 'Google+Sans+Code:wght@300..800', ofl: 'ofl/googlesanscode/OFL.txt' },
];

await mkdir('app/fonts', { recursive: true });
for (const f of FAMILIES) {
  const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${f.css}&display=swap`, { headers: { 'User-Agent': UA } })).text();
  for (const subset of ['latin']) {
    const block = css.split('/* ').find((b) => b.startsWith(`${subset} */`));
    const url = block?.match(/url\((https:[^)]+\.woff2)\)/)?.[1];
    if (!url) throw new Error(`${f.name}: subset ${subset} not found`);
    const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
    await writeFile(`app/fonts/${f.name}-${subset}.woff2`, buf);
    console.log(`${f.name}-${subset}.woff2 ${buf.length} bytes`);
  }
  const lic = await (await fetch(`https://raw.githubusercontent.com/google/fonts/main/${f.ofl}`)).text();
  if (!lic.includes('SIL Open Font License')) throw new Error(`${f.name}: unexpected license text`);
  await writeFile(`app/fonts/OFL-${f.name}.txt`, lic);
}

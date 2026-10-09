#!/usr/bin/env node
// Uso:
//   node scripts/extraer.mjs probar <url>
//   node scripts/extraer.mjs descubrir --evento X --semilla <url> [--semilla <url>] [--desde 2026-10-06 --hasta 2026-10-08] [--filtro palabra]
//   node scripts/extraer.mjs extraer --evento X [--max 60] [--pausa 4000]
// Requiere Node 18+. Opcional: JINA_API_KEY (sube el límite de peticiones de jina).
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const L = createRequire(import.meta.url)('../lib/limpieza.js');

const args = process.argv.slice(2), cmd = args[0];
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const multi = n => args.flatMap((a, i) => a === '--' + n ? [args[i + 1]] : []);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const KEY = process.env.JINA_API_KEY;
const slug = u => new URL(u).pathname.split('/').pop().replace(/\.html$/, '').slice(0, 120);
const leerUrls = f => fs.readFileSync(f, 'utf8').split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('#'));

async function jina(url) {
  const r = await fetch('https://r.jina.ai/' + url, { headers: KEY ? { Authorization: 'Bearer ' + KEY } : {}, signal: AbortSignal.timeout(45000) });
  if (!r.ok) throw new Error('jina HTTP ' + r.status);
  const t = await r.text();
  if (t.length < 300) throw new Error('jina respuesta vacía');
  return { ...L.parsearJina(t), raw: t };
}
async function allorigins(url) {
  const r = await fetch('https://api.allorigins.win/get?url=' + encodeURIComponent(url), { signal: AbortSignal.timeout(45000) });
  if (!r.ok) throw new Error('allorigins HTTP ' + r.status);
  const html = (await r.json()).contents || '';
  const contenido = L.htmlAParrafos(html);
  if (!contenido) throw new Error('allorigins sin párrafos');
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return { titulo: h1 ? h1[1].replace(/<[^>]+>/g, '').trim() : 'Nota', fechaPublicacion: (html.match(/article:published_time"\s+content="([^"]+)/i) || [])[1] || '', contenido };
}
async function obtener(url) {
  const errores = [];
  for (const [nombre, fn] of [['jina', jina], ['allorigins', allorigins]]) {
    for (let i = 0; i < 2; i++) {
      try { return { metodo: nombre, ...(await fn(url)) }; }
      catch (e) { errores.push(nombre + ': ' + e.message); await sleep(3000 * (i + 1)); }
    }
  }
  throw new Error(errores.join(' | '));
}
function aMd(url, r) {
  const l = L.limpiarNota(r.contenido, url, r.titulo);
  const meta = [`**Fuente:** ${url}`, `**Método:** ${r.metodo}`, `**Extraído:** ${new Date().toISOString()}`];
  const pub = r.fechaPublicacion || L.fechaDeUrl(url);
  if (pub) meta.push(`**Fecha de publicación:** ${pub}`);
  if (l.autor) meta.push(`**Autor:** ${l.autor}`);
  if (!l.aplicada) meta.push('**Aviso:** no se pudo limpiar; puede incluir menús y titulares ajenos');
  return `# ${r.titulo}\n\n${meta.join('\n')}\n\n---\n\n${l.contenido}\n`;
}

if (cmd === 'probar') {
  const url = L.limpiarUrl(args[1] || '');
  const r = await obtener(url);
  console.log('Método que funcionó:', r.metodo);
  console.log(aMd(url, r).split('\n').slice(0, 40).join('\n'));
} else if (cmd === 'descubrir') {
  const evento = opt('evento'), desde = opt('desde', '0000-00-00'), hasta = opt('hasta', '9999-99-99'), filtro = opt('filtro', '').toLowerCase();
  if (!evento || !multi('semilla').length) { console.log('Falta --evento o --semilla'); process.exit(1); }
  const file = `urls/${evento}.txt`;
  const todas = new Set(fs.existsSync(file) ? leerUrls(file) : []);
  let nuevas = 0;
  for (const s of multi('semilla')) {
    try {
      const enlaces = L.extraerEnlaces((await jina(L.limpiarUrl(s))).raw, 'debate.com.mx');
      const enRango = enlaces.filter(u => { const f = L.fechaDeUrl(u); return f >= desde && f <= hasta && u.toLowerCase().includes(filtro); });
      const nuevasS = enRango.filter(u => !todas.has(u));
      nuevasS.forEach(u => todas.add(u)); nuevas += nuevasS.length;
      console.log(`${s}\n  notas enlazadas: ${enlaces.length} | en rango: ${enRango.length} | nuevas: ${nuevasS.length}`);
    } catch (e) { console.log(`${s}\n  ERROR: ${e.message}`); }
    await sleep(3000);
  }
  fs.mkdirSync('urls', { recursive: true });
  fs.writeFileSync(file, [...todas].join('\n') + '\n');
  console.log(`Total en ${file}: ${todas.size} (nuevas: ${nuevas}). Esto NO garantiza cobertura completa: complementa con búsqueda web.`);
} else if (cmd === 'extraer') {
  const evento = opt('evento'), max = +opt('max', 60), pausa = +opt('pausa', 4000);
  const urls = leerUrls(`urls/${evento}.txt`).map(L.limpiarUrl);
  const dir = `notas/${evento}`;
  fs.mkdirSync(dir, { recursive: true });
  const fallidas = []; let ok = 0, hechas = 0;
  for (const u of urls) {
    const f = path.join(dir, slug(u) + '.md');
    if (fs.existsSync(f)) { ok++; continue; }
    if (hechas >= max) { console.log(`Límite de ${max} por corrida; vuelve a correr para continuar.`); break; }
    hechas++;
    try { const r = await obtener(u); fs.writeFileSync(f, aMd(u, r)); ok++; console.log('OK    ', r.metodo, u); }
    catch (e) { fallidas.push({ url: u, motivo: e.message }); console.log('FALLÓ ', u, '-', e.message); }
    await sleep(pausa + Math.random() * 2000);
  }
  fs.writeFileSync(path.join(dir, '_resumen.json'), JSON.stringify({ evento, total: urls.length, ok, fallidas, fecha: new Date().toISOString() }, null, 2));
  console.log(`Listo: ${ok}/${urls.length} notas. Fallidas: ${fallidas.length}. Detalle en ${dir}/_resumen.json`);
} else {
  console.log('Comandos: probar <url> | descubrir --evento X --semilla <url> | extraer --evento X');
}

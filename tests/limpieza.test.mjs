import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const L = createRequire(import.meta.url)('../lib/limpieza.js');

const url = 'https://www.debate.com.mx/sinaloa/culiacan/nota-de-prueba-20261008-0078.html?fbclid=ABC';
assert.equal(L.limpiarUrl(url), 'https://www.debate.com.mx/sinaloa/culiacan/nota-de-prueba-20261008-0078.html');
assert.equal(L.fechaDeUrl(url), '2026-10-08');

// Fixture sintético con la estructura de una nota de Debate (no es texto real de ninguna nota)
const md = ['**Ediciones:**', '## Lugares', '* Culiacán', '© El Debate Sinaloa, 2026.', 'Etiqueta del evento',
  '# Título de prueba del evento', 'Bajada de prueba.', 'Debate', 'Bajada de prueba.', 'Súmate al debateAñadir como fuente',
  'Por Persona Prueba', '08 de octubre 2026 • hace 7 horas', 'Primer párrafo de prueba de la nota.',
  'Segundo párrafo con **negritas****pegadas** aquí.', 'Añádenos como fuente preferidaSíguenos',
  'Los editores recomiendan', '## Titular ajeno de otra nota', 'TEMAS', 'Nosotros'].join('\n\n');
const r = L.limpiarNota(md, url, 'Título de prueba del evento');
assert.ok(r.aplicada);
assert.ok(r.contenido.includes('Primer párrafo') && r.contenido.includes('Segundo párrafo'));
for (const x of ['Titular ajeno', 'Culiacán', 'Súmate', '****', 'Persona Prueba']) assert.ok(!r.contenido.includes(x), 'no debería incluir: ' + x);
assert.equal(r.contenido.split('Bajada de prueba.').length, 2);
assert.equal(r.autor, 'Persona Prueba');
assert.equal(r.fechaTexto, '08 de octubre 2026');

const enl = L.extraerEnlaces('[a](https://www.debate.com.mx/sinaloa/x-20261007-0001.html?fbclid=1) [b](https://www.debate.com.mx/politica) [c](https://otro.com/y-20261007-0002.html)', 'debate.com.mx');
assert.deepEqual(enl, ['https://www.debate.com.mx/sinaloa/x-20261007-0001.html']);
assert.equal(L.htmlAParrafos('<p>corto</p><p>Un párrafo suficientemente largo para pasar el filtro de cincuenta caracteres &amp; más.</p>'), 'Un párrafo suficientemente largo para pasar el filtro de cincuenta caracteres & más.');
assert.equal(L.parsearJina('Title: Hola\nPublished Time: 2026-10-08\nMarkdown Content:\nTexto').contenido, 'Texto');
console.log('Todas las pruebas pasaron');

// Lógica compartida: la usa la página (index.html) y el CLI (scripts/extraer.mjs).
(function (root) {
  const TRACKING = /^(fbclid|gclid|igshid|mc_cid|mc_eid|utm_.+)$/i;
  function limpiarUrl(u) {
    try {
      const x = new URL(u);
      [...x.searchParams.keys()].forEach(k => { if (TRACKING.test(k)) x.searchParams.delete(k); });
      x.hash = '';
      return x.toString();
    } catch (e) { return u; }
  }

  // Perfiles por sitio: dónde termina el artículo y qué líneas son basura.
  const PERFILES = {
    'debate.com.mx': {
      fin: [/^Añádenos como fuente preferida/i, /^Los editores recomiendan/i, /^TEMAS$/i, /^ÚLTIMAS NOTICIAS/i],
      basura: [/^Súmate al debate/i, /^Añadir como fuente/i, /^Debate$/i, /^Ver más( Ver menos)?$/i, /^-\s*\[x\]$/i],
      fecha: /^\d{1,2} de [a-záéíóú]+ (de )?\d{4}\s*•/i
    }
  };
  const GENERICO = { fin: [], basura: [], fecha: null };
  const norm = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

  function limpiarNota(md, url, titulo) {
    let host = '';
    try { host = new URL(url).hostname.replace(/^www\./, ''); } catch (e) {}
    const p = PERFILES[host] || GENERICO;
    let lines = md.split('\n').map(l => l.trim());
    const h1s = lines.map((l, i) => /^#\s+\S/.test(l) ? i : -1).filter(i => i >= 0);
    if (h1s.length) {
      const t = norm(titulo || '').slice(0, 25);
      const ini = h1s.find(i => t && norm(lines[i]).includes(t)) ?? h1s[0];
      lines = lines.slice(ini + 1);
    }
    const fin = lines.findIndex(l => p.fin.some(r => r.test(l)));
    if (fin >= 0) lines = lines.slice(0, fin);
    let autor = '', fechaTexto = '';
    const out = [];
    for (const l of lines) {
      if (!l || p.basura.some(r => r.test(l))) continue;
      if (p.fecha && p.fecha.test(l)) { fechaTexto = l.split('•')[0].trim(); continue; }
      const m = l.match(/^Por\s+([^.,:]{3,60})$/);
      if (!autor && m && out.length < 6) { autor = m[1].trim(); continue; }
      if (out.length && out[out.length - 1] === l) continue; // bajada repetida
      out.push(l);
    }
    const contenido = out.join('\n\n').replace(/\*\*\*\*/g, ' ').replace(/\n{3,}/g, '\n\n');
    if (contenido.length < 200 && md.length > 1500) return { contenido: md, autor: '', fechaTexto: '', aplicada: false };
    return { contenido, autor, fechaTexto, aplicada: true };
  }

  function fechaDeUrl(u) {
    const m = u.match(/-(\d{4})(\d{2})(\d{2})-\d{3,5}\.html/);
    return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
  }
  function extraerEnlaces(texto, host, patron) {
    const pat = patron || /-\d{8}-\d{3,5}\.html$/;
    const set = new Set();
    (texto.match(/https?:\/\/[^\s)\]>"']+/g) || []).forEach(u => {
      const c = limpiarUrl(u.replace(/[.,;]+$/, ''));
      if (pat.test(c.split('?')[0]) && (!host || c.includes(host))) set.add(c);
    });
    return [...set];
  }
  function htmlAParrafos(html) {
    const dec = s => s.replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    const ps = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map(m => dec(m[1].replace(/<[^>]+>/g, '')).trim()).filter(t => t.length > 50);
    return [...new Set(ps)].join('\n\n');
  }
  function parsearJina(t) {
    const ti = t.match(/^Title:\s*(.+)$/im), pu = t.match(/^Published Time:\s*(.+)$/im);
    const i = t.indexOf('Markdown Content:');
    return { titulo: ti ? ti[1].trim() : 'Nota', fechaPublicacion: pu ? pu[1].trim() : '', contenido: (i >= 0 ? t.slice(i + 17) : t).trim() };
  }

  const api = { limpiarUrl, limpiarNota, fechaDeUrl, extraerEnlaces, htmlAParrafos, parsearJina };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Limpieza = api;
})(typeof self !== 'undefined' ? self : this);

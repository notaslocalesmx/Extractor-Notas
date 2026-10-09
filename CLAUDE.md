# Instrucciones para Claude Code — Extractor-Notas

Recopilar la cobertura de un evento (p. ej. Encuentros Debate 2026) y entregar un informe. Node 18+, sin dependencias.

## Flujo
1. **Probar red**: `node scripts/extraer.mjs probar <url-de-una-nota>`. Si falla, avisa y detente; no improvises otras vías.
2. **Descubrir URLs**: `node scripts/extraer.mjs descubrir --evento <slug> --semilla <página del tema o sección> [--semilla ...] --desde AAAA-MM-DD --hasta AAAA-MM-DD`. Complementa con búsqueda web las notas que falten y agrégalas a `urls/<slug>.txt`. Las fechas del evento las da Carlos; si no las tienes, pregúntalas.
3. **Extraer**: `node scripts/extraer.mjs extraer --evento <slug>` (guarda en `notas/<slug>/`, con pausa entre notas; si llega al límite, vuelve a correrlo).
4. **Informe**: lee `notas/<slug>/*.md` y escribe `informes/<slug>.md`.

## Reglas del informe
- Con tus propias palabras. Citas textuales de máximo 15 palabras y solo si el matiz importa. Nunca pegues párrafos completos de Debate.
- Estructura: resumen ejecutivo, cronología por día (usa la fecha de publicación), ponentes/temas, empresas y personas mencionadas, cifras, y qué conviene verificar.
- Cada afirmación remite al archivo de nota de donde sale.
- Di siempre cuántas notas se encontraron, cuántas se extrajeron y cuáles fallaron (`_resumen.json`). **No presentes la cobertura como completa**: el descubrimiento puede perder notas (listas con "Ver más" cargadas por JavaScript).
- Si dos notas se contradicen, señálalo en vez de elegir una.

## Reglas del repo
- `notas/` e `informes/` están en `.gitignore` y **no se suben**: el repo es público y contienen texto de Debate. No cambies eso.
- Ritmo: secuencial, con pausa. No bajes la pausa de 4 s ni paralelices.
- Nunca guardes tokens ni contraseñas en archivos. Si cambias `lib/limpieza.js`, corre `node tests/limpieza.test.mjs`.
- La limpieza de cada sitio vive en `PERFILES` de `lib/limpieza.js`; para otro medio, agrega su perfil allí.

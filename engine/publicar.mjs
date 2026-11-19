/* ══════════════════════════════════════════════════════════════════
   GENERA LA CARPETA `publicar/` DESDE CERO

   Lo que se sube a GitHub (circlenline/DUELIST_KINGDOM_ROGUELIKE). Antes
   se copiaba a mano y la carpeta se quedó un mes atrás sin que nada lo
   dijera; ahora se rehace entera cada vez:

     1. La `publicar/` anterior se aparta a `_to_delete/` (no se borra).
     2. Los textos del repo salen de `engine/publicacion/` (README,
        portada, licencia, plantillas de issues, imágenes).
     3. El juego es `out/goat-publico.html` (GOAT_PUBLICO=1): SIN los
        mazos propios de E, que se quedan solo en su ordenador. Si en el
        HTML aparece el nombre de uno de ellos, se para.
     4. Las fuentes del motor van filtradas: ni replays, ni logs, ni
        mazos propios, ni las bases completas, ni borradores `_*.mjs`.
     5. Los 20 mazos en `.ydk` y el zip para jugar sin conexión.

   Uso (desde engine/):  node publicar.mjs
   Antes hay que construir: `GOAT_PUBLICO=1 node build-html.mjs` en
   browser/ y `node build.mjs` en deckbuilder/.
   ══════════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const ENGINE = path.dirname(fileURLToPath(import.meta.url));
const RAIZ   = path.resolve(ENGINE, "..");
const FUENTE = path.join(ENGINE, "publicacion");
const SALIDA = path.join(RAIZ, "publicar");
const VISUAL = path.join(RAIZ, "MATERIAL VISUAL");
const MB = n => (n / 1048576).toFixed(2) + " MB";
const para = m => { console.error("✗ " + m); process.exit(1); };

/* ── 0 · lo construido existe y es el público ── */
const juego = path.join(ENGINE, "browser/out/goat-publico.html");
const builder = path.join(ENGINE, "deckbuilder/deckbuilder.html");
for(const f of [juego, builder]) if(!fs.existsSync(f)) para("falta " + path.relative(RAIZ, f) + ": constrúyelo antes");
const html = fs.readFileSync(juego, "utf-8");
const propios = (() => { try{ return JSON.parse(fs.readFileSync(path.join(ENGINE, "data/mazos-propios.json"), "utf-8")); }catch(e){ return []; } })();
for(const m of propios) if(m?.nombre && html.includes(JSON.stringify(m.nombre)))
  para(`el HTML público lleva el mazo propio «${m.nombre}»`);
if(!/MAZOS_PROPIOS = \[\]/.test(html)) para("el HTML público no es el de GOAT_PUBLICO=1");

/* ── 1 · la carpeta anterior, a un lado ── */
if(fs.existsSync(SALIDA)){
  const papelera = path.join(RAIZ, "_to_delete");
  fs.mkdirSync(papelera, { recursive:true });
  const destino = path.join(papelera, "publicar-" + new Date().toISOString().replace(/[:.]/g, "-"));
  fs.renameSync(SALIDA, destino);
  console.log("· la publicar/ anterior está en " + path.relative(RAIZ, destino));
}
fs.mkdirSync(SALIDA, { recursive:true });

let archivos = 0, bytes = 0;
const copiar = (de, a) => {
  fs.mkdirSync(path.dirname(a), { recursive:true });
  fs.copyFileSync(de, a); archivos++; bytes += fs.statSync(a).size;
};
const copiarArbol = (de, a, filtro = () => true) => {
  for(const e of fs.readdirSync(de, { withFileTypes:true })){
    const p = path.join(de, e.name), q = path.join(a, e.name);
    if(!filtro(p, e)) continue;
    if(e.isDirectory()) copiarArbol(p, q, filtro);
    else if(e.isFile()) copiar(p, q);
  }
};

/* ── 2 · textos, portada, licencia, plantillas e imágenes ── */
copiarArbol(FUENTE, SALIDA);

/* El trailer, en versión web (< 10 MB) con su póster. */
const trailer = path.join(VISUAL, "trailer-web.mp4");
if(fs.existsSync(trailer)) copiar(trailer, path.join(SALIDA, "docs/trailer.mp4"));
else console.log("· sin trailer-web.mp4 en MATERIAL VISUAL: la portada lo enlazará roto");
const poster = path.join(VISUAL, "trailer-poster.jpg");
if(fs.existsSync(poster)) copiar(poster, path.join(SALIDA, "docs/img/trailer.jpg"));

/* ── 3 · el juego y el deck builder ── */
copiar(juego, path.join(SALIDA, "goat-simulador.html"));
copiar(builder, path.join(SALIDA, "deckbuilder.html"));

/* ── 4 · las fuentes, filtradas ── */
const BASE_OUT = new Set(["ocgcore.bundle.js", "scripts.bundle.js", "cards.subset.json",
                          "names.subset.json", "cardback.js", "deck.json"]);
const FUERA_RAIZ = new Set(["replays", "publicacion", "node_modules", ".git"]);
const FUERA_DATOS = /^(full_.*\.json|cards\.json|names\.json|mazos-propios\.json)$/;
const filtroMotor = (p, e) => {
  const rel = path.relative(ENGINE, p).split(path.sep).join("/");
  const partes = rel.split("/");
  if(FUERA_RAIZ.has(partes[0])) return false;
  if(e.name === "node_modules" || e.name === ".git") return false;
  if(rel.startsWith("browser/out/")) return e.isFile() && partes.length === 3 && BASE_OUT.has(e.name);
  if(rel === "deckbuilder/deckbuilder.html") return false;
  if(partes[0] === "data" && partes.length === 2 && FUERA_DATOS.test(e.name)) return false;
  if(/^_/.test(e.name)) return false;                                     // borradores (archivos y carpetas: _navegador/)
  /* .jsonl: datos crudos de medir (calibracion.jsonl del draft son 8 MB);
     lo que usa el juego ya está resumido en data/. */
  if(e.isFile() && /\.(log|zip|tgz|jsonl)$|^goat-log-|^goat-copia-/.test(e.name)) return false;
  if(e.isFile() && fs.statSync(p).size > 12 * 1048576) { console.log("· fuera por tamaño: " + rel); return false; }
  return true;
};
copiarArbol(ENGINE, path.join(SALIDA, "engine"), filtroMotor);

/* ── 5 · los mazos en .ydk ── */
const mazos = JSON.parse(fs.readFileSync(path.join(ENGINE, "data/mazos.json"), "utf-8"));
fs.mkdirSync(path.join(SALIDA, "mazos"), { recursive:true });
mazos.forEach((m, i) => {
  const nombre = String(i + 1).padStart(2, "0") + "_" + m.nombre.normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[·]/g, " ").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "") + ".ydk";
  const ydk = ["#created by Duelist Kingdom · GOAT Format Simulator", "#main", ...m.main,
               "#extra", ...(m.extra ?? []), "!side", ...(m.side ?? []), ""].join("\n");
  fs.writeFileSync(path.join(SALIDA, "mazos", nombre), ydk); archivos++; bytes += ydk.length;
});

/* ── 6 · el zip para jugar sin conexión ──
   Un zip a mano (deflate de zlib + cabeceras), para no depender de nada
   instalado en el equipo. */
const crc32 = zlib.crc32 ?? (() => {
  const T = new Uint32Array(256);
  for(let n = 0; n < 256; n++){ let c = n; for(let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; T[n] = c >>> 0; }
  return b => { let c = 0xFFFFFFFF; for(const x of b) c = T[(c ^ x) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
})();
function zip(entradas){
  const partes = [], central = []; let offset = 0;
  const fecha = new Date(), dosT = (fecha.getHours() << 11) | (fecha.getMinutes() << 5) | (fecha.getSeconds() >> 1);
  const dosD = ((fecha.getFullYear() - 1980) << 9) | ((fecha.getMonth() + 1) << 5) | fecha.getDate();
  for(const { nombre, datos } of entradas){
    const n = Buffer.from(nombre, "utf-8"), comp = zlib.deflateRawSync(datos, { level:9 }), crc = crc32(datos);
    const loc = Buffer.alloc(30);
    loc.writeUInt32LE(0x04034b50, 0); loc.writeUInt16LE(20, 4); loc.writeUInt16LE(0x0800, 6); loc.writeUInt16LE(8, 8);
    loc.writeUInt16LE(dosT, 10); loc.writeUInt16LE(dosD, 12); loc.writeUInt32LE(crc, 14);
    loc.writeUInt32LE(comp.length, 18); loc.writeUInt32LE(datos.length, 22); loc.writeUInt16LE(n.length, 26);
    partes.push(loc, n, comp);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(0x0800, 8);
    cen.writeUInt16LE(8, 10); cen.writeUInt16LE(dosT, 12); cen.writeUInt16LE(dosD, 14); cen.writeUInt32LE(crc, 16);
    cen.writeUInt32LE(comp.length, 20); cen.writeUInt32LE(datos.length, 24); cen.writeUInt16LE(n.length, 28);
    cen.writeUInt32LE(offset, 42);
    central.push(cen, n);
    offset += 30 + n.length + comp.length;
  }
  const tam = central.reduce((s, b) => s + b.length, 0), fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0); fin.writeUInt16LE(entradas.length, 8); fin.writeUInt16LE(entradas.length, 10);
  fin.writeUInt32LE(tam, 12); fin.writeUInt32LE(offset, 16);
  return Buffer.concat([...partes, ...central, fin]);
}
const VERSION = (fs.readFileSync(path.join(ENGINE, "browser/build-html.mjs"), "utf-8").match(/const VERSION = "([^"]+)"/) ?? [])[1] ?? "?";
const leeme = `DUELIST KINGDOM · GOAT FORMAT SIMULATOR · Build ${VERSION}
=====================================================

Open goat-simulador.html by double-clicking it. That's the whole
installation. Keep deckbuilder.html in the same folder: the game's
Deck Builder button opens it.

- Card artwork is loaded from the internet; offline you still play.
- Play with a friend needs an internet connection on both sides.
- Your decks and progress are saved in this browser, on this device.
  Options > Your data > Save backup keeps a copy.

Bugs and AI misplays: the Report button in the game, or
https://github.com/circlenline/DUELIST_KINGDOM_ROGUELIKE/issues

---

Abre goat-simulador.html con doble clic. Deja deckbuilder.html en la
misma carpeta. Para jugar con un amigo hace falta internet. Tus mazos se
guardan en este navegador: Opciones > Tus datos > Guardar copia.
`;
const z = zip([
  { nombre:"DUELIST_KINGDOM_ROGUELIKE/goat-simulador.html", datos:fs.readFileSync(juego) },
  { nombre:"DUELIST_KINGDOM_ROGUELIKE/deckbuilder.html",    datos:fs.readFileSync(builder) },
  { nombre:"DUELIST_KINGDOM_ROGUELIKE/README.txt",          datos:Buffer.from(leeme.replace(/\n/g, "\r\n"), "utf-8") },
]);
fs.writeFileSync(path.join(SALIDA, "DUELIST_KINGDOM_ROGUELIKE.zip"), z); archivos++; bytes += z.length;

console.log(`publicar/: ${archivos} archivos · ${MB(bytes)} · zip ${MB(z.length)}`);

import { createRequire } from "node:module"; const require = createRequire(import.meta.url);
/* Se comprueba el archivo que se SUBE, no el de trabajo: copiar a mano
   ya ha dejado una versión vieja en la carpeta de publicación una vez. */
import { readFileSync, existsSync, statSync } from "node:fs";
const R = "../../publicar/";
let fallos = 0;
const ok=t=>console.log("  ✓ "+t), mal=(t,d="")=>{fallos++;console.log("  ✗ "+t+(d?"   "+d:""));};
console.log("\n═══ LA CARPETA DE PUBLICACIÓN ═══\n");

/* 1 · está todo lo que hace falta */
for(const f of ["goat-simulador.html","deckbuilder.html","README.md","LICENSE","NOTICE",
                "CONTRIBUTING.md","index.html","DUELIST_KINGDOM_ROGUELIKE.zip","docs/img/duelo.jpg",
                "docs/img/duelo-pegasus.jpg","docs/img/torre.jpg","docs/img/menu.jpg",
                "docs/img/torneo.jpg","docs/img/sala.jpg","docs/trailer.mp4","docs/img/trailer.jpg",
                ".github/ISSUE_TEMPLATE/fallo.yml",".github/ISSUE_TEMPLATE/jugada-ia.yml",
                ".github/ISSUE_TEMPLATE/config.yml","mazos","engine/browser/build-html.mjs"])
  existsSync(R+f) ? ok(f) : mal("falta "+f);

/* 2 · el juego publicado es el recién construido */
const a = readFileSync("./out/goat-publico.html"), b = readFileSync(R+"goat-simulador.html");
if(!a.equals(b)) mal("el HTML publicado es la versión pública recién construida (GOAT_PUBLICO=1)");
else ok(`el HTML publicado es la versión pública recién construida (${(b.length/1048576).toFixed(2)} MB)`);

/* 3 · y arranca en INGLÉS, que es el idioma principal */
const html = b.toString("utf-8");
if(!/idioma\s*:\s*"en"/.test(html) && !/idioma\)\s*\?\?\s*"en"/.test(html))
  mal("el juego arranca en inglés por defecto");
else ok("el juego arranca en inglés por defecto");

/* 3b · LA 1.0 PÚBLICA: sin lo privado de E
   Sus mazos propios (data/mazos-propios.json) se quedan en su PC; el modo
   depuración arranca apagado y su contraseña no viaja en claro. */
{
  const propios = (() => { try{ return JSON.parse(readFileSync("../data/mazos-propios.json","utf-8")); }catch(e){ return []; } })();
  const colados = propios.filter(m => m?.nombre && html.includes(JSON.stringify(m.nombre))).map(m => m.nombre);
  colados.length ? mal("el juego publicado no lleva los mazos propios", colados.join(" · "))
                 : ok(`el juego publicado no lleva ninguno de los ${propios.length} mazos propios`);
  /MAZOS_PROPIOS = \[\]/.test(html) ? ok("y su lista de mazos propios va vacía")
                                    : mal("la lista de mazos propios del juego publicado va vacía");
  !existsSync(R+"engine/data/mazos-propios.json") ? ok("las fuentes no llevan mazos-propios.json")
                                                  : mal("las fuentes no llevan mazos-propios.json");
  /HUELLA_DEPURACION = "[0-9a-f]{64}"/.test(html) && !/CLAVE_DEPURACION/.test(html)
    ? ok("la contraseña de depuración solo va como huella SHA-256")
    : mal("la contraseña de depuración solo va como huella");
  /goatDebug"\) === "1"|getItem\("goatDebug"\)/.test(html) ? ok("la depuración depende de goatDebug (apagada por defecto)")
                                                          : mal("la depuración depende de goatDebug");
  /Build 1\.2/.test(html) ? ok("el menú dice Build 1.2") : mal("el menú dice Build 1.2");
  /mesa.real|SpeechRecognition/i.test(html) ? mal("la mesa real no va en la versión pública") : ok("la mesa real no va en la versión pública");
  const borr = []; (function anda(d){ for(const e of require("node:fs").readdirSync(d,{withFileTypes:true})){
    if(e.name === ".git") continue; const p = d+"/"+e.name;
    if(e.isDirectory()) anda(p); else if(/^_.*\.mjs$|^goat-log-|^goat-copia-|\.log$/.test(e.name) || /\/replays\//.test(p)) borr.push(p); } })(R+"engine");
  borr.length ? mal("sin borradores, logs ni replays en las fuentes", borr.slice(0,5).join(" · ")) : ok("sin borradores, logs ni replays en las fuentes");
}

/* 4 · nada pesado se ha colado */
const pesados = [];
(function anda(d){
  for(const e of require("node:fs").readdirSync(d,{withFileTypes:true})){
    if(e.name === ".git" || e.name === "node_modules" || e.name === "out") continue;
    const p = d+"/"+e.name;
    if(e.isDirectory()) anda(p);
    else if(statSync(p).size > 12*1024*1024) pesados.push(`${p} (${(statSync(p).size/1048576).toFixed(0)} MB)`);
  }
})(R.slice(0,-1));
if(pesados.length) mal("ningún archivo pasa de 12 MB", pesados.join(" · "));
else ok("ningún archivo pasa de 12 MB: GitHub no se queja");

/* 5 · el README enlaza capturas que existen */
const rd = readFileSync(R+"README.md","utf-8");
const imgs = [...rd.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map(m=>m[1]);
const rotas = imgs.filter(i => !/^https?:/.test(i) && !existsSync(R+i));
if(!imgs.length) mal("el README lleva capturas");
else if(rotas.length) mal("las capturas del README existen", rotas.join(" · "));
else ok(`las ${imgs.length} capturas del README existen`);

/* 6 · y habla del modo historia, que es la mitad del juego */
for(const t of ["Duelist Kingdom","Star Chip","Mastery","pack","Swiss","side deck","Play with a friend",
                 "Disclaimer","Save backup","Build 1.2","Report"])
  rd.includes(t) ? ok(`el README explica «${t}»`) : mal(`el README no menciona «${t}»`);

/* ══════════════════════════════════════════════════════════════════
   CONFIGURADA PARA UN SOLO SITIO, Y QUE SE NOTE

   Se publica SOLO en GitHub Pages. Media configuración de dominio
   propio es peor que ninguna: un `CNAME` sin DNS deja el sitio caído, y
   una URL canónica apuntando a un dominio que no sirve el juego manda a
   Google al sitio equivocado. Las tres piezas —canonical, sitemap y
   Open Graph— tienen que decir lo MISMO.
   ══════════════════════════════════════════════════════════════════ */
{
  const CASA = "circlenline.github.io";
  if(existsSync(R+"CNAME"))
    mal("no hay CNAME: la publicación es solo de GitHub Pages",
        "un CNAME sin DNS configurado deja el sitio caído");
  else ok("no hay CNAME: se publica solo en GitHub Pages");

  const index = readFileSync(R+"index.html","utf-8");
  /* Sin los comentarios: el fragmento del contador va comentado con un
     `TUCODIGO` de ejemplo dentro, y contarlo era acusar a una plantilla
     que no se sirve. Lo que hay que cazar es una URL VIVA hacia otro
     sitio. */
  const vivo = index.replace(/<!--[\s\S]*?-->/g, "");
  const urls = [...vivo.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)].map(m=>m[1]);
  const ajenas = [...new Set(urls)].filter(h =>
    h !== CASA && !/^(schema\.org|www\.gnu\.org|github\.com|www\.goatcounter\.com|gc\.zgo\.at)$/.test(h));
  if(ajenas.length)
    mal("todas las URL propias apuntan al sitio publicado", ajenas.join(" · "));
  else ok(`todas las URL propias apuntan a ${CASA}`);

  /* Y las tres señales de SEO, de acuerdo entre ellas. */
  const canonical = (vivo.match(/rel="canonical" href="([^"]+)"/) ?? [])[1] ?? "";
  const og        = (vivo.match(/property="og:url" content="([^"]+)"/) ?? [])[1] ?? "";
  const mapa      = (readFileSync(R+"sitemap.xml","utf-8").match(/<loc>([^<]+)<\/loc>/) ?? [])[1] ?? "";
  if(!(canonical && canonical === og && canonical === mapa))
    mal("canonical, og:url y sitemap dicen lo mismo",
        `canonical «${canonical}» · og «${og}» · sitemap «${mapa}»`);
  else ok(`canonical, og:url y sitemap coinciden (${canonical})`);

  /* GitHub Pages sirve con Jekyll salvo que se le diga que no, y Jekyll
     se come cualquier carpeta o archivo que empiece por guion bajo. */
  if(!existsSync(R+".nojekyll"))
    mal("está el .nojekyll", "sin él, Jekyll ignora lo que empiece por _");
  else ok("está el .nojekyll");

  /* ══ Y LO QUE ENLAZA EL README TIENE QUE SUBIRSE ══
     El `.gitignore` traía `*.zip` a secas y el README enlaza
     `goat-format-simulator.zip` con ruta relativa: el enlace habría dado
     404 nada más publicar, sin que nada avisara. Se comprueba que cada
     archivo que enlaza el README esté Y no esté ignorado. */
  const gi = existsSync(R+".gitignore") ? readFileSync(R+".gitignore","utf-8") : "";
  const enlaces = [...rd.matchAll(/\]\(([^)#:]+\.(?:zip|html|md))\)/g)].map(m=>m[1]);
  const perdidos = enlaces.filter(f => !existsSync(R+f));
  const zipIgnorado = /^\*\.zip\s*$/m.test(gi) && !/^!DUELIST_KINGDOM_ROGUELIKE\.zip\s*$/m.test(gi);
  if(perdidos.length) mal("los archivos que enlaza el README existen", perdidos.join(" · "));
  else if(zipIgnorado) mal("y el zip que enlaza el README no está ignorado",
                           "`*.zip` en .gitignore lo dejaría fuera del repo");
  else ok(`los ${enlaces.length} archivos que enlaza el README se suben de verdad`);
}

/* ══ LOS REPORTES DE FALLOS Y DE JUGADAS DE LA IA ══
   El botón «Reportar» del juego abre el formulario de issues del repo con
   campos rellenados por nombre (`CAMPOS_REPORTE` en main.js). Si una
   plantilla no está o le falta un campo, GitHub abre el formulario vacío
   sin avisar: se comprueba aquí. */
{
  const T = R + ".github/ISSUE_TEMPLATE/";
  const juego = readFileSync("./out/goat-publico.html", "utf-8");
  const campos = (juego.match(/CAMPOS_REPORTE\s*=\s*\[([^\]]*)\]/)?.[1] ?? "").match(/"([^"]+)"/g)?.map(x => x.slice(1, -1)) ?? [];
  const plantillas = [...(juego.match(/PLANTILLAS_REPORTE\s*=\s*\{([^}]*)\}/)?.[1] ?? "").matchAll(/"([^"]+\.yml)"/g)].map(m => m[1]);
  if(!campos.length || !plantillas.length) mal("el juego dice qué plantillas y campos usa para reportar");
  for(const pl of plantillas){
    if(!existsSync(T + pl)){ mal(`está la plantilla de issues ${pl}`); continue; }
    const y = readFileSync(T + pl, "utf-8");
    const ids = [...y.matchAll(/^\s*id:\s*(\S+)/gm)].map(m => m[1]);
    const faltan = [...campos, "que_paso", "log"].filter(c => !ids.includes(c));
    faltan.length ? mal(`la plantilla ${pl} tiene todos los campos que rellena el juego`, faltan.join(", "))
                  : ok(`la plantilla ${pl} tiene los ${ids.length} campos (los que rellena el juego y el del log)`);
  }
}

console.log(`\n${fallos ? "FALLA: "+fallos : "Todo correcto"}`);
process.exit(fallos?1:0);

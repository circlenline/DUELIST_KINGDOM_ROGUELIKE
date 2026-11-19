/* Ensambla UN solo .html autocontenido (sin servidor, sin imports externos).
   Cada módulo va en su propio ámbito: el core está minificado y sus
   identificadores de una letra chocan con los nuestros si se mezclan. */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
/* ══ LA VERSIÓN, Y LA VERSIÓN PÚBLICA ══
   `VERSION` es lo que sale en el menú («Build 1.0 · fecha») y en los reportes.
   Con `GOAT_PUBLICO=1` se construye la que se sube a GitHub
   (`out/goat-publico.html`): sin los mazos propios de E sembrados
   (`mazos-propios.json`), que se quedan solo en su ordenador. La de
   trabajo (`out/goat.html`) sigue llevándolos. */
const VERSION = "1.3";
const PUBLICO = process.env.GOAT_PUBLICO === "1";
/* El modo draft (Retro Pack 2) es solo de E (19-11: «quita el modo draft»
   de la versión pública). En la pública no va ni la pantalla, ni el botón,
   ni las 101 cartas; y quien construya desde el repo, que no trae
   src/draft/, sale igual. */
const SIN_DRAFT = PUBLICO || !existsSync("./src/draft/draft.js");
/* Las traducciones del draft van en un bloque propio al final de la tabla:
   desde su comentario hasta el cierre `};`. */
const sinBloqueDraft = txt => txt.replace(/\n  \/\* ── modo draft[\s\S]*?(?=\n};)/, "");
const R = f => readFileSync(f,"utf-8");
const stripExports = s => s.replace(/^export\s+(const|function|class|async function|let)/gm,"$1")
                           .replace(/^export\s*\{[^}]*\}\s*;?\s*$/gm,"");
// los módulos de IA se importan entre sí: al concatenarlos hay que quitar
// los import, porque dentro de un ámbito no se puede importar
/* ══════════════════════════════════════════════════════════════════
   LOS IMPORTS SE BORRAN — Y ESO TIENE DOS TRAMPAS

   Aquí no se empaqueta: se CONCATENA todo dentro de un mismo ámbito y se
   quitan los imports. Funciona porque cada nombre exportado es único en
   ese ámbito. Pero hay dos formas de escribir un import que no
   sobreviven, y ninguna de las dos da error al construir:

     import * as m from "./x.js"     → `m` no existe: "m is not defined"
     import { a as b } from "./x.js" → `b` no existe: "b is not defined"

   Las dos han costado un bug en el navegador con los tests en VERDE,
   porque en node sí son módulos de verdad: `recompensasMod` al resolver
   un encuentro y `importarEstado` al pulsar Importar progreso.
   Así que aquí se para la construcción. */
/* ══════════════════════════════════════════════════════════════════
   LA LISTA DE EXPORTS TIENE QUE ESTAR COMPLETA

   `view.js` se mete dentro de una función anónima y lo que sale es un
   objeto con los nombres de una LISTA ESCRITA A MANO. Si añades una
   función exportada y se te olvida ponerla ahí, el bundle se construye
   sin una queja y en el navegador sale "V.loQueSea is not a function"
   al pulsar algo. Pasó con `atajos`: E se quedó con un tablero muerto y
   el cartel de "SOMETHING BROKE" en mitad de un duelo.

   Es exactamente la misma familia que `import * as` y los alias de
   import: el empaquetado pierde algo sin decirlo. Así que aquí se para
   la construcción, con el nombre de lo que falta. */
function comprobarExports(fuente, lista, quien){
  const exportadas = [...fuente.matchAll(/^export (?:async )?function (\w+)/gm)]
    .map(m => m[1]);
  const enLista = lista.split(",").map(x => x.trim()).filter(Boolean);
  const faltan = exportadas.filter(n => !enLista.includes(n));
  if(faltan.length)
    throw new Error(
      `\n\n  ${quien}: estas funciones se exportan pero NO están en la lista\n` +
      `  del bundle, así que en el navegador serían \`undefined\`:\n` +
      faltan.map(x => "    · " + x).join("\n") +
      `\n\n  Añádelas a la lista de \`build-html.mjs\`.\n`);
}

function stripImports(s, quien = "un módulo"){
  const malos = [];
  for(const m of s.matchAll(/^import\s+([\s\S]*?)from\s*"([^"]*)";?\s*$/gm)){
    const cabeza = m[1];
    if(/^\s*\*\s*as\s/.test(cabeza)) malos.push(`import * as … from "${m[2]}"`);
    else if(/\bas\b/.test(cabeza))     malos.push(`import { … as … } from "${m[2]}"`);
  }
  if(malos.length)
    throw new Error(
      `\n\n  ${quien}: estos imports NO sobreviven al empaquetado.\n` +
      malos.map(x => "    · " + x).join("\n") +
      `\n\n  Los módulos se concatenan en un mismo ámbito y los imports se\n` +
      `  borran, así que el nombre local desaparece y en el navegador sale\n` +
      `  "… is not defined" — sin que ningún test en node se entere.\n` +
      `  Usa el nombre exportado tal cual, o renómbralo en su módulo.\n`);
  return s.replace(/^import[\s\S]*?from\s*"[^"]*";?\s*$/gm,"");
}
const juntarIA = () => ["knowledge.js","view.js","evaluar.js","plan.js","lectura.js","valorar.js","posicion.js","contexto.js","side.js","brain.js","pensar.js"]
  .map(f => stripImports(stripExports(R("./src/ai/"+f)), "ai/"+f)).join("\n");
/* El modo historia. El orden importa: los módulos se importan entre sí y al
   concatenarlos hay que respetar las dependencias (balance antes que mapa,
   catálogo antes que recompensas…). Ninguno lee archivos: los datos entran
   por parámetro, así que aquí solo va el código. */
const vistaFuente = R("./src/view.js");
const LISTA_VIEW = "initView, sorteo, setControles, markAtacadas, setImages, announcePhase, markUsable, moverEnMano, previaSuelta, quitarPrevia, confirmar, elegir, revelar, ocultarReveladas, setMomento, momento, momentoTexto, pensando, contador, limpiarCuentas, tirarMoneda, pantallaFinal, alHistorial, verCarta, verUltimaCarta, abrirMano, esTactil, manoEstaAbierta, fitBoard, openZoneView, closeZoneView, setZoneViewClose, setZoneViewHandler, layoutAll, setHandlers, markTargets, marcarObjetivos, markDraggable, showDetail, choiceMenu, closeChoice, toast, banner, setLP, setPhase, flash, popDamage, telegraphAttack, animateBattle, glow, sleep, medirTablero, fijarCarta, soltarCarta, hayCartaFijada, proponerDetalle, atajos, apartarPanel, cerrarFinal";

const juntarStory = () => ["rng.js","balance.js","mapa.js","estado.js","record.js","catalogo.js",
                           "coleccion.js","recompensas.js","utilidad.js","personajes.js","historia.js","ui.js"]
  .map(f => stripImports(stripExports(R("./src/story/"+f)), "story/"+f)).join("\n");

/* El modo draft (Retro Pack 2). Mismo truco que el modo historia: los
   módulos se concatenan en un ámbito, en orden de dependencias. Las reglas
   y la IA se prueban en node (check-draft.mjs); la pantalla va aparte,
   dentro del script del menú (src/draft/pantalla.txt), porque usa sus
   globales (boot, CARDS, cfg…). */
const juntarDraft = () => ["azar.js","cartas.js","rutas.js","sobres.js","mazo.js","picks.js","mesa.js","evento.js","duelos.js","draft.js"]
  .map(f => stripImports(stripExports(R("./src/draft/"+f)), "draft/"+f)).join("\n");
const LISTA_DRAFT = "prepararDraft, picksDeBots, sugerirPick, avanzar, construirMazo, construirAsiento, evaluarMain, categoriaDe, " +
  "nuevaMesa, vistaDe, aplicarPaso, poolDe, integridad, sanearMesa, direccion, CONFIG_DRAFT, nuevoEvento, emparejar, apuntar, " +
  "rondaCompleta, cerrarRonda, clasificacion, retirar, mesaDe, registro, matchDeBots, dueloDeBots, MODELO_SOBRE, PLANES, CATEGORIA, hashTexto";

// núcleo: su "export{a as B,...}" pasa a ser el objeto que devuelve el ámbito
let core = R("./out/ocgcore.bundle.js");
const em = core.match(/export\{([^}]*)\}\s*;?\s*$/m);
const pairs = em[1].split(",").map(p=>{const t=p.trim().split(/\s+/);return {local:t[0], ext:t[2]??t[0]};});
core = core.replace(/export\{[^}]*\}\s*;?\s*$/m,
  `return {${pairs.map(p=>`${p.ext==="default"?"createCore":p.ext}:${p.local}`).join(",")}};`);

const iife = (body, returns) => `(()=>{\n${body}\nreturn {${returns}};\n})()`;

const parts = [
`${stripExports(R("./out/cardback.js"))}`,
// el módulo de idiomas va PRIMERO: deja __T en globalThis y el resto lo usa
`const I18N = ${iife(stripExports(SIN_DRAFT ? sinBloqueDraft(R("./src/i18n.js")) : R("./src/i18n.js")), "T, setIdioma, idioma, traducirDOM")};`,
`const {T:__T_, setIdioma:__setIdioma, traducirDOM:__traducirDOM} = I18N;`,
`const __OCG__ = (()=>{\n${core}\n})();`,
`const {SCRIPTS, scriptReader} = ${iife(stripExports(R("./out/scripts.bundle.js")), "SCRIPTS, scriptReader")};`,
`const {GoatDuel} = ${iife(stripExports(R("./src/duel.mjs")), "GoatDuel")};`,
`const {makeAutoPlayer} = ${iife(stripExports(R("./src/autopilot.mjs")), "makeAutoPlayer")};`,
`const {makeTrivialResolver} = ${iife(stripExports(R("./src/trivial.js")), "makeTrivialResolver")};`,
`const {esVentanaDePrioridad, hayDisparadoresPendientes} = ${iife(stripExports(R("./src/prioridad.js")), "esVentanaDePrioridad, hayDisparadoresPendientes")};`,
`const {valePreguntar, clasificarCarta} = ${iife(stripExports(R("./src/ventanas.js")), "valePreguntar, clasificarCarta")};`,
// Contador de uso. Sin código de sitio configurado no manda un solo byte,
// y desde `file://` tampoco: ver la cabecera de src/telemetria.js.
`const {Tele} = ${iife(stripExports(R("./src/telemetria.js")), "Tele")};`,
`globalThis.__TELE__ = Tele;`,
// Torneo suizo con top 16: emparejamientos, clasificación, corte y cuadro.
`const Suizo = ${iife(stripExports(R("./src/suizo.js")), "SUIZO_VERSION, JUGADORES, RONDAS_SUIZAS, CORTE, NOMBRES_CORTE, PESOS, pesoDe, nuevoSuizo, registro, clasificacion, emparejar, rondaActual, miMesa, jugador, rivalEn, apuntarMiMatch, bo3, resolverResto, rondaCompleta, siguienteRonda, sigoDentro, simularHastaElFinal, retirarme, resultado, probDesdeCruces, sanearSuizo, avatarDe")};`,
// Torneo meta al mejor de tres: solo lógica, la pantalla está en template.html.
`const Torneo = ${iife(stripExports(R("./src/torneo.js")), "nuevoTorneo, sanearTorneo, marcador, rondaDecidida, empezarRonda, empiezoYo, apuntarPartida, abandonarRonda, estadisticas, resumenTexto, GANA_MATCH, sideValido, aplicarSide, multiset, MAIN_MIN, SIDE_MAX, nuevaTanda, tandaDe, claveRonda, cerrarRonda")};`,
`const {crearCerebro, NIVELES, combinacionesSuma:__combIA, crearPensador, planDeSide, diagnosticar, valorCarta:__valorCarta, planDe:__planDe, canon:__canon} = ${iife(juntarIA(), "crearCerebro, NIVELES, combinacionesSuma, crearPensador, planDeSide, diagnosticar, valorCarta, planDe, canon")};`,
`${(comprobarExports(vistaFuente, LISTA_VIEW, "src/view.js"), "")}` +
  `const View = ${iife(stripExports(vistaFuente), LISTA_VIEW)};`,
SIN_DRAFT ? `const Draft = null;` : `const Draft = ${iife(juntarDraft(), LISTA_DRAFT)};`,
`const Story = ${iife(juntarStory(),
   "crearHistoria, crearAlmacen, nuevaRun, sembrarManoDeJefe, crearCatalogo, FAMILIAS, generarMapa, semillaTexto, rngDeSemilla, exportarProgreso, importarProgreso, cargarMeta, CHIPS, ACTOS, montarReino")};`,
// Salas para jugar con un amigo: qué viaja y cómo se filtra (sala.js) y
// la conexión entre navegadores (red.js, que usa PeerJS de vendor/).
`const Red = ${iife(stripImports(stripExports(R("./src/sala.js")), "sala.js") + "\n" + stripImports(stripExports(R("./src/red.js")), "red.js"),
   "SALA_VERSION, codificar, decodificar, visiblePara, estadoPara, eventosPara, preguntaPara, seguirReveladas, DueloEspejo, validarMazo, nuevoCodigo, limpiarCodigo, PREFIJO_SALA, MOTIVOS_RED, transportePeer, transporteLocal, transportePorDefecto, crearSala, unirseSala")};`,
`const {estadoPara, eventosPara, preguntaPara, seguirReveladas, DueloEspejo} = Red;`,
`const {boot, AVISO_SPOILER, respuestaSala, reenviarSala, terminarPorSala, enSala} = ${iife(stripExports(R("./src/main.js")), "boot, AVISO_SPOILER, respuestaSala, reenviarSala, terminarPorSala, enSala")};`,
].join("\n");

const html = R("./src/template.html")
  .replace("/*__MODULES__*/", () => parts)
  .replace("/*__CARDS__*/",   () => R("./out/cards.subset.json"))
  .replace("/*__NAMES__*/",   () => R("./out/names.subset.json"))
  .replace("/*__CADENAS__*/", () => existsSync("../data/pool_strings.json") ? R("../data/pool_strings.json") : "{}")
  .replace("/*__DECK__*/",    () => R("./out/deck.json"))
  // TRAMPA: esto leía ./out/mazos.json, que era una copia a mano y nadie
  // regeneraba. Arreglar un mazo en data/mazos.json no llegaba al HTML y
  // parecía que el arreglo no funcionaba. Se lee la fuente canónica.
  .replace("/*__MAZOS__*/",   () => R("../data/mazos.json"))
  /* Mazos que E quiere tener como SUYOS desde el primer arranque (se
     copian una vez a los del deck builder, ver `sembrarMazosPropios`). */
  .replace("/*__MAZOS_PROPIOS__*/", () => PUBLICO || !existsSync("../data/mazos-propios.json") ? "[]" : R("../data/mazos-propios.json"))
  .replace("/*__VERSION__*/", () => VERSION)
  /* El pool legal va dentro (1.685 números, unos 12 KB). Hace falta EN
     TIEMPO DE EJECUCIÓN, no solo al construir: un mazo importado de una
     lista de internet trae los passcodes normales, y en esta base muchas
     cartas existen dos veces —el código normal y el "(GOAT)"— con el
     script Lua SOLO en el del pool. Sin esta lista no hay forma de
     traducir uno al otro y la carta entra muda. */
  .replace("/*__POOL__*/",    () => R("../data/goat-pool.json"))
  /* Los avatares van dentro como WebP de 88px en base64: 28 caras ocupan
     86 KB, menos que una sola imagen de carta, y el HTML sigue siendo un
     archivo suelto que funciona sin internet. */
  .replace("/*__AVATARES__*/",() => R("../data/avatares.json"))
  /* El logo y las dos caras de la moneda, en WebP dentro del HTML: son
     130 KB en total y el archivo sigue abriéndose sin internet. */
  /* Sello del build: si el navegador enseña uno viejo, es la caché. */
  .replace("/*__BUILD__*/",   () => new Date().toISOString().slice(0,16).replace("T"," "))
  .replace("/*__ARTE__*/",    () => R("../data/arte.json"))
  /* El material visual del Reino que hizo E: banner, hoguera, sobre,
     mercader y Pegasus. 284 KB en WebP dentro del HTML — el archivo
     sigue abriéndose con doble clic y sin internet, que es la regla que
     no se toca. Se genera con story-tools/arte-reino.mjs. */
  .replace("/*__ARTE_REINO__*/", () => R("../data/arte-reino.json"))
  /* 212 de los 1.685 passcodes del pool son variantes "(GOAT)" o
     "(Pre-Errata)" que NO existen en el servidor de imágenes: la carta
     salía en blanco. Esta tabla dice con qué passcode pedir la imagen. */
  .replace("/*__IMGALIAS__*/",() => R("../data/img-alias.json"))
  /* Los datos del Reino de los Duelistas. Los mazos y los pools son
     GENERADOS por engine/story-tools/importar-diseno.mjs desde el brief:
     no se editan a mano. */
  .replace("/*__LIMITES__*/",         () => R("../data/goat-limites.json"))
  .replace("/*__STORY_DECKS__*/",     () => R("../data/story/decks.json"))
  .replace("/*__STORY_CARDS__*/",     () => R("../data/story/cards.json"))
  .replace("/*__STORY_PERSONAJES__*/",() => R("../data/story/personajes.json"))
  .replace("/*__PEERJS__*/",          () => R("../vendor/peerjs.min.js").replace(/\/\/# sourceMappingURL=.*$/m, ""))
  .replace("/*__CRUCES__*/",          () => existsSync("../data/cruces.json") ? R("../data/cruces.json") : "null")
  .replace("/*__STORY_EVENTOS__*/",   () => R("../data/story/eventos.json"))
  /* Las 101 cartas de RP02 (engine/draft/importar-rp02.mjs), la pantalla
     del draft y su estilo. */
  .replace(/\/\* Retro Pack 2: las 101 cartas[^\n]*\n/, m => SIN_DRAFT ? "" : m)
  .replace("/*__RP02__*/",            () => SIN_DRAFT ? "null" : R("../data/draft/rp02.json"))
  .replace("/*__DRAFT_UI__*/",        () => SIN_DRAFT ? "" : R("./src/draft/pantalla.txt"))
  .replace("/*__DRAFT_CSS__*/",       () => SIN_DRAFT ? "" : R("./src/draft/draft.css"))
  .replace(/\s*<button class="mbig sec" id="irDraft">[^<]*<\/button>/, m => SIN_DRAFT ? "" : m)
  .replace(/<!-- ══ MODO DRAFT[^\n]*\n<div id="draft" hidden><div id="dCaja"><\/div><\/div>\n/, m => SIN_DRAFT ? "" : m);

const SALIDA = PUBLICO ? "./out/goat-publico.html" : "./out/goat.html";
writeFileSync(SALIDA, html);
console.log(SALIDA.replace("./out/", "") + ":", (html.length/1024/1024).toFixed(2), "MB", PUBLICO ? "· versión pública" : "");

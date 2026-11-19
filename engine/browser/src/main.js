/* ════════════════════════════════════════════════════════════
   ORQUESTADOR: motor + adaptador + vista + IA.
   El control principal es arrastrar cartas; los botones quedan
   para lo que no tiene representación física (pasar de fase).
   ════════════════════════════════════════════════════════════ */
let ME = 0;   // lado que te toca; lo decide el sorteo
let duel, decideAI, trivial, OCG, V, NAMES, DB;
let chainMode = "auto", chainActive = false;
/* Modo «cuando tiene sentido» (src/ventanas.js): ¿la ventana que viene es
   la de justo después de que el rival invoque? Se enciende con su
   invocación y se apaga cuando él vuelve a su Main Phase o cambia de fase. */
let invocacionRival = false;
/* ══ LA PRIORIDAD (reglas de 2005) ══
   Tras invocar, el motor te ofrece antes que al rival el efecto de
   ignición del monstruo (BLS, Chaos Sorcerer, Tribe-Infecting Virus,
   Breaker…): es la prioridad del jugador del turno. El modo de cadenas
   «auto» se saltaba toda ventana propia sin cadena, y con ella esta: no
   podías usar la prioridad nunca, y la IA te tumbaba el BLS antes de que
   desterrara. Ahora esa ventana se pregunta UNA vez por invocación. */
let prioridadPreguntada = null, ventanaPrioridad = false;
const ventanaDePrioridad = q => esVentanaDePrioridad(q, {
  tipoCadena: OCG.OcgMessageType.SELECT_CHAIN, yo: ME, turnPlayer: duel?.turnPlayer, turnCount: duel?.turnCount,
  ultimaInvocada: duel?.ultimaInvocada, cadenaActiva: chainActive,
  uidEn: s => duel.at(s.controller, s.location, s.sequence)?.uid });
let nivelBot = "duro", cerebro = null;
/* ══ JUGAR CON UN AMIGO (salas) ══
   `REMOTO` existe solo en un duelo de sala. El ANFITRIÓN tiene el motor:
   cada paso lo manda filtrado al invitado (`lote`) y, cuando el motor le
   pregunta algo al invitado, se lo pregunta por la red y espera. El
   INVITADO no tiene motor: su `duel` es un `DueloEspejo` (src/sala.js)
   que se llena con lo que llega. El resto —vista, paneles, arrastrar—
   es exactamente lo de siempre. Ver src/sala.js y src/red.js. */
let REMOTO = null;
/* ══ EL RELOJ DE LA SALA ══
   Con un amigo no hay bot que conteste al instante: sin límite, uno que
   se va a por un café deja al otro esperando para siempre. Cada decisión
   tiene `TIEMPO_SALA` segundos (lo elige el anfitrión; 0 = sin límite).
   Si se agota, el juego contesta lo más prudente (`respuestaPorTiempo`:
   pasar, no activar, terminar la fase) y lo apunta; TRES seguidas del
   mismo jugador pierden el duelo. Quien manda es el anfitrión: él cuenta
   las de los dos, y si el invitado no contesta ni siquiera con su reloj
   (navegador colgado, consola), contesta él por el invitado pasado un
   margen (`margenReloj`, 30 s, que cubre las animaciones y la red). */
let TIEMPO_SALA = 0, RELOJ = null, POR_TIEMPO = false;
/* ══ EL RELOJ DE LA RONDA (modo draft) ══
   E: «45 min por ronda máx y luego turnos». `config.relojRonda` = { fin
   (hora a la que se acaba la ronda, en ms), turnosExtra }. Cuando se
   cumple, el turno en curso es el turno 0 y se juegan `turnosExtra` más;
   al acabar, gana la partida quien tenga más LP (igual = empate). Ojo:
   la Tournament Policy 2.5 de Konami ya no da turnos extra; esto es la
   regla de la tienda de E, editable en el modo. */
let RELOJ_RONDA = null, RELOJ_RONDA_TIC = null;
let AGOTADOS = { 0:0, 1:0 };
const MAX_AGOTADOS = 3;
/* Solo pruebas: `GOAT_MARGEN_RELOJ_MS` acorta el margen y `GOAT_SIN_RELOJ`
   apaga el reloj propio (para ver contestar al anfitrión por el otro). */
const margenReloj = () => typeof globalThis.GOAT_MARGEN_RELOJ_MS === "number" ? globalThis.GOAT_MARGEN_RELOJ_MS : 30000;
/* Solo pruebas (`GOAT_AUTOJUGAR`): el bot contesta por el jugador, para
   jugar un duelo de sala entero entre dos pestañas sin manos. */
let AUTO_YO = null;
/* Decisiones que se resuelven solas y nunca se te muestran: colocar en
   qué zona, ordenar cartas, declarar tipo/atributo. */
let AUTO_KINDS = new Set();
let DB_RAW = {};
/* Ventana de respuesta a cadenas: si no contestas, se pasa sola.
   Solo se aplica aquí. En los "¿quieres activar el efecto?" no hay
   temporizador a propósito: dejar que caiga tiraría valor a la basura
   (por ejemplo el retorno de Sinister Serpent). */
let CHAIN_TIMEOUT = (typeof globalThis.GOAT_CHAIN_TIMEOUT === "number")
  ? globalThis.GOAT_CHAIN_TIMEOUT : 15;
let promptTimer = null;
/* Lo que se para el bot antes de su primera decisión de cada fase. En las
   pruebas se pone a 0 con GOAT_PENSAR para que 300 partidas no tarden una
   hora; en el navegador vale medio segundo. */
const PENSAR = (()=>{
  if(typeof globalThis.GOAT_PENSAR === "number") return globalThis.GOAT_PENSAR;
  /* También por variable de entorno: las comprobaciones corren en node y
     con medio segundo por decisión una partida de prueba no termina nunca
     —la primera versión dejó a `jugar.mjs` en cero acciones—. */
  const env = typeof process!=="undefined" && process.env && process.env.GOAT_PENSAR;
  if(env !== undefined && env !== "") return Number(env) || 0;
  return 520;
})();
let idle = null;            // SELECT_IDLECMD vigente
let battle = null;          // SELECT_BATTLECMD vigente
let preferredPlace = null;  // zona donde soltó el jugador

const PHNAME={1:"Draw Phase",2:"Standby Phase",4:"Main Phase 1",8:"Battle Phase",
  16:"Battle Step",32:"Damage Step",64:"Damage Step",128:"Battle Phase",
  256:"Main Phase 2",512:"End Phase"};
const LOCNAME={1:"Mazo",2:"mano",4:"campo",8:"M/T",16:"Cementerio",32:"desterradas",64:"Extra"};
const ETIQUETA_NIVEL={novato:"Novato",normal:"Normal",duro:"Duro",experto:"Experto"};
/* Por qué terminó el duelo. Los códigos son los del motor. */
/* MEDIDO, no supuesto (18-09): se jugaron partidas enteras mirando el
   `reason` del mensaje WIN junto a los LP y el tamaño de los mazos. Sale
   1 = puntos de vida a cero (el perdedor a 0 con mazo de sobra) y 2 =
   deckout (los dos mazos a 0). Estaban corridos un puesto, así que TODAS
   las partidas de E decían «se quedó sin cartas en el Deck» cuando en
   realidad habían acabado por daño. Lo comprueba `check-final.mjs`. */
const MOTIVOS={1:"Puntos de vida a cero",2:"Se quedó sin cartas en el Deck",
  0:"Efecto de una carta",3:"Rendición",4:"Se acabó el tiempo"};
const T = s => (globalThis.__T ? globalThis.__T(s) : s);
let CONFIG=null;   // lo que eligió el jugador en el menú (avatares, mazos…)
/* Progreso del modo bots: qué mazo has ganado y en qué dificultad. Se
   guarda con la misma forma que lo lee el menú. */
function apuntarVictoria(){
  const reto = CONFIG?.reto;
  if(!reto?.mazoRival || !reto?.nivel) return;
  try{
    const p = JSON.parse(localStorage.getItem("goatProgreso")||"{}");
    p[reto.mazoRival] = p[reto.mazoRival] || {};
    p[reto.mazoRival][reto.nivel] = true;
    localStorage.setItem("goatProgreso", JSON.stringify(p));
  }catch(err){}
}

/* ── registro de partida ──────────────────────────────────────
   Guarda todo lo que pasa: mensajes del motor, lo que se te
   preguntó y lo que respondiste. Con el botón "Descargar log"
   sale un fichero que permite reproducir el fallo. */
const LOG=[]; let SEED=null, DECKLOG=null;
const t0=Date.now();
function snap(v, prof=0){
  if(v===null||typeof v!=="object") return typeof v==="bigint" ? v.toString()+"n" : v;
  if(prof>4) return "…";
  if(Array.isArray(v)) return v.map(x=>snap(x,prof+1));
  const o={};
  for(const k in v){ if(k==="el"||k==="_el") continue; o[k]=snap(v[k],prof+1); }
  return o;
}
/* ══════════════════════════════════════════════════════════════════
   EL REGISTRO TIENE DOS MITADES, Y UNA ES SPOILER

   E, 18-09: «puedo ver en los comentarios de arriba las cartas que pone
   boca abajo la IA». Y es verdad: el registro crudo lleva los dos mazos
   barajados en la cabecera y el código real de cada carta en cada
   mensaje del motor, colocadas incluidas. Para depurar hace falta tal
   cual —sin los códigos no se puede reconstruir una jugada— pero quien
   lo abre para escribir sus notas no tiene por qué comerse eso.

   Así que el archivo empieza por un RESUMEN PÚBLICO: lo que se vio en la
   mesa y nada más, con las tapadas del rival sin nombre. El crudo va
   detrás, con su aviso.
   ══════════════════════════════════════════════════════════════════ */
const nombreLog = c => NAMES?.[c]?.name ?? ("#"+c);
function resumenPublicoDelLog(){
  const l = [];
  const quien = p => p === ME ? "tú" : "IA";
  /* Una carta solo se nombra si estuvo a la vista: invocada, activada,
     en el cementerio o desterrada. Lo que el rival COLOCA no se nombra
     nunca, que es justo lo que no se puede saber jugando. */
  const publica = (code, controller, loc) =>
    controller === ME || loc === 16 || loc === 32 ? nombreLog(code) : "una carta";
  let turno = null;
  for(const e of LOG){
    const d = e.data ?? {};
    if(e.kind !== "evento") continue;
    switch(d.t){
      case "turn":
        turno = d.turn ?? d.turno ?? turno;
        l.push(``, `── turno ${turno ?? "?"} · ${quien(d.player)} ──`);
        break;
      case "summon":
      case "summoned": {
        if(d.t === "summoned") break;        // el par del mismo suceso
        const c = duel?.cards?.get?.(d.uid);
        const como = d.kind === "special" ? "invocación especial"
                   : d.kind === "flip" ? "voltea" : "invoca";
        l.push(`  ${quien(c?.controller ?? d.controller)} · ${como} ${nombreLog(d.code)}`);
        break;
      }
      case "set":
        l.push(`  ${quien(d.controller)} · coloca ${publica(d.code, d.controller, 4)}`);
        break;
      case "chain":
        l.push(`  ${quien(d.controller)} · activa ${nombreLog(d.code)}`);
        break;
      case "revelarMazo":
        l.push(`  se revelan del mazo de ${quien(d.player)}: ${(d.codes ?? []).map(nombreLog).join(", ")}`);
        break;
      case "attack":
        l.push(`  ataque${d.targetUid ? "" : " directo"}`);
        break;
      case "damage":
        l.push(`  daño a ${quien(d.player)}: ${d.amount} (le quedan ${d.lp})`);
        break;
      case "move":
        if(d.to?.location === 16 && d.from?.location !== 16)
          l.push(`  al cementerio: ${nombreLog(d.code)}`);
        else if(d.to?.location === 32 && d.from?.location !== 32)
          l.push(`  desterrada: ${nombreLog(d.code)}`);
        break;
      case "win":
        l.push(``, `── gana ${quien(d.player)} ──`);
        break;
    }
  }
  return l.join("\n");
}

/* ══════════════════════════════════════════════════════════════════
   REPORTAR UN FALLO O UNA JUGADA RARA (GitHub Issues)

   E, 03-10: «que los usuarios que lo usen a través de GitHub puedan
   mandarme bug reports o misplay reports, sin gastar nada». Va por los
   issues del repo: gratis, sin correo nuevo (los avisos llegan al de la
   cuenta de GitHub) y públicos, así se ven los repetidos.

   El botón descarga el log del duelo y abre el formulario del repo
   (`.github/ISSUE_TEMPLATE/<plantilla>.yml` en publicar/) con lo que ya
   sabe el juego rellenado: versión, modo, mazos, turno, las últimas
   jugadas que se vieron en la mesa y el navegador. El log no cabe en un
   enlace: el jugador lo arrastra al recuadro «Log». Los nombres de los
   campos (`CAMPOS_REPORTE`) son los `id` de las plantillas; si se cambia
   uno, hay que cambiar el otro (lo vigila check-publicar).
   ══════════════════════════════════════════════════════════════════ */
const REPO_ISSUES = "https://github.com/circlenline/DUELIST_KINGDOM_ROGUELIKE/issues/new";
export const PLANTILLAS_REPORTE = { fallo:"fallo.yml", ia:"jugada-ia.yml" };
export const CAMPOS_REPORTE = ["version", "modo", "mazos", "turno", "navegador", "ultimas"];
function modoDeJuego(){
  if(REMOTO) return "sala (" + (REMOTO.rol === "anfitrion" ? "anfitrión" : "invitado") + ")";
  if(CONFIG?.modo) return CONFIG.modo;
  if(CONFIG?.nombreMazo === "Reino") return "Reino de los Duelistas";
  return "duelo libre";
}
export function urlDeReporte(tipo = "fallo"){
  const turno = duel?.turnCount ?? null;
  const rival = CONFIG?.mazoRival ?? CONFIG?.nombreRival ?? "?";
  /* Las últimas jugadas, de lo PÚBLICO (nada de lo que estaba oculto) y
     recortadas: el enlace entero tiene que quedarse en unos pocos KB. */
  let ultimas = "";
  try{ ultimas = resumenPublicoDelLog().trim(); }catch(e){}
  if(ultimas.length > 1500) ultimas = "…\n" + ultimas.slice(-1500).replace(/^[^\n]*\n/, "");
  const ua = String(globalThis.navigator?.userAgent ?? "").slice(0, 180);
  const campos = {
    version: String(globalThis.GOAT_BUILD ?? "?"),
    modo: modoDeJuego(),
    mazos: `${CONFIG?.nombreMazo ?? "?"} vs ${rival}`,
    turno: turno != null ? String(turno) : "",
    navegador: ua + (V?.esTactil?.() ? " · táctil" : ""),
    ultimas,
  };
  const q = new URLSearchParams();
  q.set("template", PLANTILLAS_REPORTE[tipo] ?? PLANTILLAS_REPORTE.fallo);
  q.set("title", `${tipo === "ia" ? "[IA]" : "[Bug]"} ${campos.modo}${turno != null ? ` · turno ${turno}` : ""} · `);
  for(const k of CAMPOS_REPORTE) if(campos[k]) q.set(k, campos[k]);
  return REPO_ISSUES + "?" + q.toString();
}
function abrirReporte(tipo){
  /* Primero el log (el jugador lo va a necesitar en la página que se
     abre) y después GitHub, en otra pestaña: el duelo sigue aquí. */
  try{ document.getElementById("btnLog")?.onclick?.(); }catch(e){}
  const url = urlDeReporte(tipo);
  logIt("reporte", { tipo });
  try{ globalThis.open?.(url, "_blank", "noopener"); }catch(e){}
  V?.toast?.(T("Arrastra el log descargado al recuadro «Log» del formulario"));
}
export function reportarFallo(){
  const opciones = [{ label:"Fallo del juego", id:"repFallo", run:() => abrirReporte("fallo") }];
  /* Con un amigo no hay IA que reportar. */
  if(!REMOTO) opciones.push({ label:"Jugada rara de la IA", id:"repIA", run:() => abrirReporte("ia") });
  V.elegir("Reportar",
    "Se descarga el log de este duelo y se abre GitHub con el reporte casi relleno. Arrastra el log al recuadro «Log» y envíalo. Hace falta una cuenta de GitHub (gratis).",
    opciones);
}

/* El log, en texto. Lo usa el botón «Descargar log» del duelo y también
   el torneo, que se queda con el de cada partida para poder mandarlo todo
   junto al final del match. */
export const AVISO_SPOILER =
  "AVISO · DE AQUÍ ABAJO HAY INFORMACIÓN OCULTA: los dos mazos barajados, " +
  "las manos y lo que la IA pensó, con el código real de cada carta colocada. " +
  "Es lo que hace falta para reconstruir una jugada. No lo leas si vas a " +
  "seguir jugando contra este mazo.";
function textoDelLog({ crudo = true, publico = true } = {}){
  const cab=[
    "GOAT FORMAT — registro de partida",
    "fecha: "+new Date().toISOString(),
    "semilla: "+SEED,
    "rng: v2",
    "modo cadenas: "+chainMode,
    "nivel del rival: "+nivelBot,
    "tu mazo: "+(CONFIG?.nombreMazo??"?")+" · mazo rival: "+(CONFIG?.nombreRival??"?"),
    "desincronizaciones detectadas y corregidas: "+(duel?.desyncs??0),
    "turnos: "+(duel?.turnCount??0),
    "LP  tú: "+(duel?.lp?.[ME]??"?")+"   rival: "+(duel?.lp?.[1-ME]??"?"),
    "".padEnd(70,"─")].join("\n");
  const partes = [cab];
  if(publico) partes.push("", "LO QUE SE VIO EN LA MESA", "".padEnd(70,"─"), resumenPublicoDelLog());
  if(crudo){
    partes.push("", "".padEnd(70,"═"), AVISO_SPOILER, "".padEnd(70,"═"), "",
                "mazos barajados: "+safeJSON(DECKLOG), "");
    partes.push(LOG.map(e=>{
      const c=`[${String(e.ms).padStart(6)}ms] T${e.turno} ${e.deQuien.padEnd(5)} ${String(e.fase).padEnd(14)} ${e.kind}`;
      return c+" · "+safeJSON(e.data);
    }).join("\n"));
  }
  return partes.join("\n");
}
function logIt(kind, data){
  // copia inmediata: si guardásemos referencias, el fichero mostraría el
  // estado final de cada carta y no el del momento del suceso
  data = snap(data);
  LOG.push({ ms:Date.now()-t0, turno:duel?.turnCount??0,
             deQuien:duel?.turnPlayer===ME?"tú":"rival",
             fase:PHNAME[duel?.phase]??"", kind, data });
  if(LOG.length>6000) LOG.splice(0,2000);
}
/* Los errores sueltos de la página (ver el oyente de errores del
   arranque): al log, para que lleguen con el Reportar, y a la telemetría. */
globalThis.__errorTardio__ = (msg, err) => {
  try{ logIt("ERROR suelto", { msg:String(msg).slice(0,200), pila:String(err?.stack ?? "").slice(0,400) }); }catch(_){}
  try{ globalThis.__TELE__?.error?.("suelto: " + String(msg).slice(0,120)); }catch(_){}
};
const queue=[]; const onEvent = e => { logIt("evento", e); queue.push(e);
  if(REMOTO?.rol === "anfitrion") REMOTO.eventos.push(e); };
const nm = c => (NAMES[c]?.name ?? "#"+c);

/* ══════════════════════════════════════════════════════════════════
   LOS "PARONES DE 5 A 10 SEGUNDOS" ERAN LA COLA DE ANIMACIONES

   Un usuario los reportó y la primera reacción fue buscar un bucle
   lento. No lo hay: medido, una decisión de la IA tarda 0,01 ms y nada
   del Reino pasa de 16 ms. Lo que pasa es más simple y peor de
   encontrar con un perfilador, porque el hilo NO está bloqueado: está
   esperando a propósito.

   Cada evento del motor lleva su espera —240 ms al robar, 290 al mover,
   500 por eslabón de cadena, 400 al invocar— y un turno del rival puede
   traer treinta eventos. Scapegoat (4 fichas = 4 `move`) + Metamorphosis
   + una cadena de tres + los movimientos al cementerio se van a más de
   ocho segundos en los que no puedes hacer nada. Desde fuera eso es
   indistinguible de un cuelgue.

   La solución no es quitar las animaciones —una jugada suelta tiene que
   verse— sino que la espera dependa de CUÁNTAS quedan por delante. Con
   la cola vacía, todo igual que antes. Con veinte eventos encolados, las
   esperas se comprimen hasta un quinto y el turno entero pasa en un par
   de segundos. Es lo mismo que hacen los juegos de cartas cuando
   aceleras una cadena larga.
   ══════════════════════════════════════════════════════════════════ */
const RITMO = { normal:1, apurado:0.45, corriendo:0.2 };
let decisionesSeguidas = 0;
function factorDeRitmo(){
  const n = queue.length;
  if(n >= 14) return RITMO.corriendo;
  if(n >= 6)  return RITMO.apurado;
  return RITMO.normal;
}
/* Todas las esperas de la cola pasan por aquí. `V.sleep` sigue existiendo
   para lo que NO es cola (la moneda, el banner final), que se ve una vez
   y no se acumula. */
const pausa = ms => V.sleep(Math.round(ms * factorDeRitmo()));

async function drain(){
  /* Si la cola viene larga, se avisa una vez: así el jugador sabe que el
     juego no se ha colgado, que era la mitad del problema. */
  if(queue.length >= 14) V.toast?.("Resolviendo la jugada…");
  decisionesSeguidas = 0;
  while(queue.length){
    if(rendido) return true;
    const e=queue.shift();
    switch(e.t){
      /* ══ LOS LP DE SALIDA (GitHub #11 y #26) ══
         La vista se monta ANTES de crear el duelo y pintaba 8000 a los dos.
         Pegasus empieza con 10000: al pagar Toon World pasaba de «8000» a
         9000 y parecía que ganaba vida. El motor lo hacía bien; la
         pantalla no. Ahora el marcador se pone con los LP de verdad. */
      case "ready":
        V.setLP(0, e.lp0 ?? duel.lp[0], true); V.setLP(1, e.lp1 ?? duel.lp[1], true);
        break;
      case "turn":
        V.banner(`Turno ${e.turn} — ${e.player===ME?"Tú":"Oponente"}`,
                 e.player===ME?"var(--gold)":"#ff8f7a");
        setHUD(e.player, duel.phase); await pausa(600);
        if(turnoConReloj()) return true;
        break;
      case "phase":
        invocacionRival = false;
        chainActive=false; V.ocultarReveladas(); V.setMomento(null);
        V.setPhase(e.phase); setHUD(duel.turnPlayer,e.phase);
        await V.announcePhase(e.phase, duel.turnPlayer===ME);
        await pausa(90); break;
      case "draw": case "pos": V.layoutAll(); await pausa(e.t==="draw"?240:290); break;
      case "move":
        if(e.to?.location===32 && e.from?.location!==32)
          V.toast(`Desterrada: ${nm(e.code)}`);
        V.layoutAll(); await pausa(290); break;
      case "summon":
        invocacionRival = duel.cards.get(e.uid)?.controller !== ME;
        V.alHistorial(e.code, duel.cards.get(e.uid)?.controller===ME,
                      e.kind==="flip" ? "volteo" : "invoca");
        if(e.uid){ V.glow(e.uid,true); V.layoutAll(); await pausa(400); V.glow(e.uid,false); }
        V.toast(`${e.kind==="special"?"Invocación especial":e.kind==="flip"?"Invocación por volteo":"Invoca"}: ${nm(e.code)}`);
        await pausa(180); break;
      case "chain":
        chainActive=true;
        V.alHistorial(e.code, e.controller===ME, "cadena");
        if(e.uid) V.glow(e.uid,true);
        V.toast(`Cadena ${e.link}: ${nm(e.code)}`); await pausa(500);
        if(e.uid) V.glow(e.uid,false); break;
      /* Creature Swap: los dos monstruos cambian de sitio de verdad. */
      case "swap":
        V.layoutAll(); V.toast("Intercambio de monstruos"); await pausa(420); break;
      /* Contadores (Wave-Motion Cannon, Breaker…): el número es lo que la
         carta va a hacer, así que tiene que verse. */
      /* La moneda se ve SIEMPRE, sea de quien sea: es información que
         cambia el resultado del combate. */
      case "moneda": await V.tirarMoneda(e.resultados, e.player===ME); break;
      case "dado":
        V.toast(`${T("Dado")}: ${e.resultados.join(" · ")}`); await pausa(700); break;
      case "contador":
        V.contador(e.uid, e.cuantos, e.clase ?? "contador",
                   e.code ? nm(e.code) : null, e.jugador===ME);
        break;
      case "equip": V.layoutAll(); await pausa(200); break;
      case "chainEnd": chainActive=false; V.ocultarReveladas();
                       V.marcarObjetivos(new Set()); OBJETIVOS_VISTOS.clear(); break;
      /* Cartas que un efecto pone boca arriba (Trap Dustshoot, Confiscation…):
         salen al centro del tablero hasta que la cadena termina. */
      case "revelar":
        if(e.uids?.length){
          V.revelar(e.uids);
          V.toast(e.location===2 ? "Se revela la mano del rival"
                                 : `Se revelan ${e.uids.length} carta(s)`);
          await pausa(750);
        }
        break;
      /* Cyber Jar y compañía: las de arriba del mazo se enseñan a los dos.
         Se abre el visor y el duelo espera a que lo cierres (en las
         pruebas que juegan solas, un aviso y seguir). */
      case "revelarMazo": {
        const cartas = (e.codes ?? []).filter(Boolean)
          .map((code, i) => ({ code, location:1, controller:e.player, position:1, _i:"rv"+i }));
        if(!cartas.length) break;
        const titulo = `Cartas reveladas · ${e.player === ME ? "tu mazo" : "mazo del rival"}`;
        if(AUTO_YO || globalThis.GOAT_AUTOJUGAR){ V.toast(titulo); await pausa(500); break; }
        /* En una sala no se para: el reloj del otro corre. Se enseña y ya. */
        if(REMOTO){ V.openZoneView(titulo, cartas); await pausa(900); break; }
        await new Promise(res => { V.setZoneViewClose(res); V.openZoneView(titulo, cartas); });
        V.setZoneViewClose(null);
        break;
      }
      /* Nada de cartel a pantalla completa: pasa en cada ataque. Basta con
         la etiqueta sobre Battle, el HUD y el título del panel de cadena. */
      case "damageStep":
        V.setMomento(e.on ? "damage" : null);
        setHUD(duel.turnPlayer, duel.phase);
        break;
      /* ══ QUÉ CARTA ESTÁ SEÑALANDO ESE EFECTO ══
         E: «cuando se hace algo como Mystical Space Typhoon, tiene que
         marcar de alguna manera qué carta está seleccionando, para saber
         si merece la pena responder». El motor lo dice con BECOME_TARGET
         y el adaptador ya lo reenviaba, pero aquí nadie lo escuchaba: se
         te preguntaba «¿quieres responder?» sin decirte a qué.
         Se marca la carta y se dice su nombre si es pública (una tapada
         TUYA sí la conoces; una suya no se nombra). */
      case "target": {
        const uids = new Set(e.uids ?? []);
        V.marcarObjetivos(uids);
        const nuevos = [...uids].filter(u => !OBJETIVOS_VISTOS.has(u));
        for(const u of nuevos) OBJETIVOS_VISTOS.add(u);
        const nombres = nuevos.map(u => duel.cards.get(u)).filter(Boolean)
          .map(c => (c.controller === ME || !(c.position & 0x0a)) ? nm(c.code) : T("una carta tuya tapada"));
        if(nombres.length) V.toast(T("Señala") + ": " + nombres.join(", "));
        await pausa(260);
        break;
      }
      case "attack":
        chainActive=true; V.setMomento("ataque"); setHUD(duel.turnPlayer, duel.phase);
        await V.telegraphAttack(e.uid, e.targetUid); break;
      case "battle":  await V.animateBattle(e.uid, e.targetUid); break;
      case "attackCancelled": V.toast("Ataque anulado"); await pausa(220); break;
      case "damage": V.popDamage(e.amount,e.player); V.setLP(e.player,e.lp); await pausa(320); break;
      case "recover": case "lp": V.setLP(e.player, e.lp ?? e.value); await pausa(200); break;
      case "win":
        if(e.player===ME) apuntarVictoria();
        /* Cuántos duelos se terminan y en cuántos turnos. Sin esto, la
           única forma de saber si un nivel de IA es injugable es que
           alguien se moleste en contarlo. */
        globalThis.__TELE__?.dueloTermina(e.player===ME, duel.turnCount);
        V.banner(e.player===ME?"¡HAS GANADO!":"HAS PERDIDO", e.player===ME?"var(--gold)":"#ff6a55");
        pararReloj();
        hidePanel(); V.setControles(null); V.ocultarReveladas();
        await pausa(1500);
        /* En el Reino de los Duelistas el duelo no acaba en la pantalla
           de "nuevo duelo": vuelve al mapa con el resultado, que es quien
           decide si ganas una ficha o la pierdes. */
        /* EN EL REINO NO SE SALTA SOLO. E se quedó sin poder descargar el
           log justo cuando lo necesitaba: el duelo acababa y la pantalla
           cambiaba sola. Ahora sale la pantalla final de siempre —con sus
           puntos de vida, sus turnos y el botón de descargar log— y solo
           al pulsar "Continuar" se vuelve al mapa. */
        if(typeof CONFIG?.alTerminar === "function"){
          await V.pantallaFinal({
            ganaste: e.player===ME, motivo: MOTIVOS[e.reason] ?? "",
            lpMio: duel.lp[ME], lpRival: duel.lp[1-ME], turnos: duel.turnCount,
            avatarMio: CONFIG?.avatarMio, avatarRival: CONFIG?.avatarRival,
            nombreRival: CONFIG?.nombreRival,
            textoNuevo: "Continuar",
            onNuevo: () => CONFIG.alTerminar(e.player===ME, datosDelFinal(MOTIVOS[e.reason] ?? "")) });
          return true;
        }
        await V.pantallaFinal({
          ganaste: e.player===ME, motivo: MOTIVOS[e.reason] ?? "",
          lpMio: duel.lp[ME], lpRival: duel.lp[1-ME], turnos: duel.turnCount,
          avatarMio: CONFIG?.avatarMio, avatarRival: CONFIG?.avatarRival,
          nombreRival: CONFIG?.nombreRival });
        return true;
      case "coreError": console.warn("[core]", e.text); break;
    }
  }
  V.layoutAll(); V.fitBoard();
  return duel.finished;
}
function setHUD(player, phase){
  // el Damage Step no es una fase de la tira: se añade aparte si estamos en él
  const extra = V?.momentoTexto?.() ? ` · <b style="color:#ffb257">${V.momentoTexto()}</b>` : "";
  document.getElementById("turnInfo").innerHTML =
    `<b style="color:${player===ME?"var(--gold)":"#ff8f7a"}">${T(player===ME?"TU TURNO":"TURNO RIVAL")}</b>`+
    `<span style="opacity:.6"> · ${T(PHNAME[phase]??"")} · ${T("Turno "+duel.turnCount)}</span>${extra}${textoRelojRonda()}`;
}
function textoRelojRonda(){
  if(!RELOJ_RONDA) return "";
  if(RELOJ_RONDA.contados !== null)
    return ` · <b style="color:#ff8f7a">${T("Tiempo")}: ${T("turno extra")} ${Math.max(0, RELOJ_RONDA.contados)}/${RELOJ_RONDA.extra}</b>`;
  const ms = RELOJ_RONDA.fin - Date.now();
  if(ms <= 0) return ` · <b style="color:#ff8f7a">${T("Tiempo")}: ${T("turno 0")}</b>`;
  const sg = Math.ceil(ms / 1000);
  return ` · <span style="opacity:.75">⏱ ${Math.floor(sg / 60)}:${String(sg % 60).padStart(2, "0")}</span>`;
}
/* Nuevo turno con la ronda cumplida: cuenta los turnos extra y, al pasar
   el último, se acaba la partida por LP. Devuelve true si la ha acabado. */
function turnoConReloj(){
  if(!RELOJ_RONDA || Date.now() < RELOJ_RONDA.fin) return false;
  if(RELOJ_RONDA.contados === null){
    RELOJ_RONDA.contados = 0;
    V.toast(T("Se acabó el tiempo de la ronda: se juegan") + ` ${RELOJ_RONDA.extra} ` + T("turnos más"));
  }
  RELOJ_RONDA.contados++;
  logIt("reloj_ronda", { turnoExtra: RELOJ_RONDA.contados, lpTuyos: duel.lp[ME], lpRival: duel.lp[1-ME] });
  if(RELOJ_RONDA.contados <= RELOJ_RONDA.extra) return false;
  terminarPorTiempo();
  return true;
}
function terminarPorTiempo(){
  if(rendido) return;
  rendido = true;
  pararReloj();
  const mio = duel?.lp?.[ME] ?? 0, suyo = duel?.lp?.[1-ME] ?? 0;
  const empate = mio === suyo, ganaste = mio > suyo;
  const motivo = empate ? "Tiempo: empate a puntos de vida" : "Tiempo: gana quien tiene más puntos de vida";
  logIt("fin_por_tiempo", { lpTuyos: mio, lpRival: suyo, empate });
  V.setHandlers({}); V.markTargets(new Set()); V.markDraggable(new Set());
  V.markUsable(new Set()); V.markAtacadas?.(new Set()); V.quitarPrevia(false);
  V.closeChoice(); V.closeZoneView(); hidePanel();
  V.banner(empate ? "EMPATE" : ganaste ? "¡HAS GANADO!" : "HAS PERDIDO", empate ? "#cfd6e4" : ganaste ? "var(--gold)" : "#ff6a55");
  const alTerminar = typeof CONFIG?.alTerminar === "function" ? CONFIG.alTerminar : null;
  setTimeout(()=>V.pantallaFinal({
    ganaste, motivo, lpMio:mio, lpRival:suyo, turnos:duel?.turnCount,
    avatarMio:CONFIG?.avatarMio, avatarRival:CONFIG?.avatarRival, nombreRival:CONFIG?.nombreRival,
    ...(alTerminar ? { textoNuevo:"Continuar",
                       onNuevo: () => alTerminar(ganaste, { ...datosDelFinal(motivo), porTiempo:true, empate }) } : {}) }), 900);
}

/* ── panel inferior (solo para lo que no se puede arrastrar) ── */
function panel(title, options, note){
  if(!options.length && !note) { hidePanel(); return; }
  const p=document.getElementById("prompt");
  const fase = T(PHNAME[duel?.phase] ?? "");
  const cuando = momentoPanel && momentoPanel!==fase ? ` · ${T(momentoPanel)}` : "";
  p.innerHTML=`<div class="pfase">${fase}${cuando}</div>`+
    `<div class="ptitle">${T(title)}</div>${note?`<div class="pnote">${T(note)}</div>`:""}`;
  const box=document.createElement("div"); box.className="popts";
  for(const o of options){
    const b=document.createElement("button");
    b.className="btn "+(o.primary?"gold":""); b.textContent=T(o.label);
    b.onclick=()=>{ hidePanel(); o.run(); };
    box.appendChild(b);
  }
  /* OJO AL ORDEN: el botón de plegar va ANTES de la caja de opciones.
     Todo lo que lee este panel —las comprobaciones y el propio juego—
     coge el ÚLTIMO hijo como la lista de botones; al añadirlo después, el
     último hijo pasaba a ser el botón de plegar y `jugar.mjs` se quedaba
     en cero acciones sin decir por qué. */
  ponerPlegado(p);
  p.appendChild(box); p.style.display="block";
  /* ══ UNA PREGUNTA DE VERDAD NO SE QUEDA PLEGADA (GitHub #12) ══
     Con el panel plegado, «¿quieres responder?» y «¿activar el efecto?»
     tampoco se veían: el duelo esperaba los 15 s de cada ventana sin que
     el jugador supiera que le preguntaban algo («se queda atascado en el
     Battle Step», «los turnos tardan muchísimo»). El log lo enseñaba:
     doce ventanas seguidas agotadas en un solo turno del rival. Plegado
     sigue valiendo para la Main Phase y la Battle Phase; lo demás sale. */
  if(plegado() && !preguntaUrgente) p.style.display="none";
  /* Y que no se coma el marcador del rival: se mide, no se adivina. */
  else V.apartarPanel?.();
}

/* ── PLEGAR EL PANEL ──
   El panel vive encima del tablero y, con el carril reservado, ya no tapa
   nada. Aun así se puede plegar a una pestaña: en pantallas justas el
   tablero se agradece entero, y el reporte era exactamente ese ("having a
   pop up always there blocks the graveyard"). La preferencia se recuerda. */
function plegado(){ try{ return localStorage.getItem("goatPanelPlegado")==="1"; }catch(e){ return false; } }
function setPlegado(v){
  try{ localStorage.setItem("goatPanelPlegado", v?"1":"0"); }catch(e){}
  document.body.classList.toggle("sinCarril", !!v);
  const p=document.getElementById("prompt");
  if(p && p.dataset.visible==="1") p.style.display = v ? "none" : "block";
  V?.fitBoard?.();
}
/* ══ PLEGAR NO EXISTE CON EL DEDO, Y ES A PROPÓSITO ══
   La pestaña para volver a abrirlo (`#pestana`) vive en `right:0;
   top:50%` con z-index 151. En un móvil, ahí mismo está la tira de
   fases —`#phases`, `right:3px; top:50%`— y va a z-index 300, o sea
   ENCIMA. Resultado: plegabas el panel y la pestaña quedaba debajo de
   DRAW/STANDBY/MAIN, sin forma de recuperarlo. Eso no es un panel
   plegado, es un panel perdido. E lo reportó tal cual.

   Se podría mover la pestaña, pero el rincón de la derecha ya está
   reservado para lo único que no puede taparse nunca (fase y fin de
   turno). Así que con el dedo no hay flecha: el panel se queda. En
   escritorio sigue plegándose, que ahí la pestaña tiene su sitio. */
function ponerPlegado(p){
  p.dataset.visible="1";
  if(V?.esTactil?.()) return;
  const b=document.createElement("button");
  b.className="ppleg"; b.textContent="›"; b.title=T("Plegar el panel");
  b.onclick=e=>{ e.stopPropagation?.(); setPlegado(true); };
  p.appendChild(b);
}
const RAZAS={"1":"Guerrero","2":"Mago","4":"Hada","8":"Demonio","16":"Zombi","32":"Máquina",
  "64":"Aqua","128":"Piro","256":"Roca","512":"Bestia Alada","1024":"Planta","2048":"Insecto",
  "4096":"Trueno","8192":"Dragón","16384":"Bestia","32768":"Bestia Guerrero",
  "65536":"Dinosaurio","131072":"Pez","262144":"Serpiente Marina","524288":"Reptil"};
const ATRIBUTOS={"1":"FUEGO","2":"AGUA","4":"TIERRA","8":"VIENTO","16":"LUZ",
  "32":"OSCURIDAD","64":"DIVINO"};
/* Buscador para declarar el nombre de una carta. */
function declararCarta(codigos, alElegir){
  const p=document.getElementById("prompt");
  p.innerHTML=`<div class="ptitle">${T("Declara una carta")}</div>
    <input id="buscaCarta" placeholder="${T("Escribe un nombre…")}" autocomplete="off">
    <div class="pnote" id="buscaAyuda">${codigos.length} cartas posibles</div>
    <div class="popts" id="buscaRes"></div>`;
  p.style.display="block";
  V.apartarPanel?.();
  const inp=p.querySelector("#buscaCarta"), res=p.querySelector("#buscaRes");
  const pintar=()=>{
    const q=(inp.value||"").trim().toLowerCase();
    const hits=[];
    for(const c of codigos){
      const n=nm(c);
      if(!q || n.toLowerCase().includes(q)){ hits.push([c,n]); if(hits.length>=40) break; }
    }
    hits.sort((a,b)=>a[1].localeCompare(b[1]));
    res.innerHTML="";
    for(const [c,n] of hits){
      const b=document.createElement("button");
      b.className="btn"; b.textContent=n;
      b.onclick=()=>{ hidePanel(); alElegir(c); };
      res.appendChild(b);
    }
    p.querySelector("#buscaAyuda").textContent =
      q ? `${hits.length}${hits.length>=40?"+":""} coincidencias` : `${codigos.length} cartas posibles · escribe para filtrar`;
  };
  inp.oninput=pintar; pintar();
  setTimeout(()=>inp.focus?.(),30);
}
function hidePanel(){
  /* Con una carta fijada, ESC la suelta antes que ninguna otra cosa: es
     lo que espera cualquiera de un panel "pineado". */
  V?.atajos?.({ espacio:null,
                escape: V?.hayCartaFijada?.() ? () => V.soltarCarta() : null });
  cancelPromptTimer();
  V?.setControles?.(null);
  const p=document.getElementById("prompt");
  p.style.display="none"; p.dataset.visible="0";
}
function cancelPromptTimer(){
  if(promptTimer){ clearInterval(promptTimer); promptTimer=null; }
  document.getElementById("ptimer")?.remove();
}
function startPromptTimer(segundos, alAgotarse){
  cancelPromptTimer();
  const p=document.getElementById("prompt");
  const barra=document.createElement("div");
  barra.id="ptimer";
  barra.innerHTML=`<div class="ptnum"></div><div class="ptbar"><i></i></div>`;
  p.insertBefore(barra, p.firstChild);
  const relleno=barra.querySelector("i"), num=barra.querySelector(".ptnum");
  const t0=Date.now(), total=segundos*1000;
  promptTimer=setInterval(()=>{
    const queda=Math.max(0, total-(Date.now()-t0));
    relleno.style.width=(queda/total*100)+"%";
    num.textContent=Math.ceil(queda/1000)+"s";
    barra.classList.toggle("urgente", queda<5000);
    if(queda<=0){ cancelPromptTimer(); alAgotarse(); }
  },100);
}
let MSGNAME={};
function msgName(m){ return MSGNAME[m.type] ?? ("tipo "+m.type); }
/* En qué momento exacto se te está preguntando. No hace falta adivinarlo:
   el propio mensaje del motor trae el "timing". Importa sobre todo en
   batalla, donde responder en la declaración de ataque o ya dentro del
   Damage Step son dos jugadas distintas con Book of Moon en la mano. */
const TIMINGS = [
  [4096,"Declaración de ataque"], [134217728,"Tras el combate"],
  [67108864,"Fin del Battle Step"], [16777216,"Battle Phase"],
  [64,"Invocación normal"], [128,"Invocación especial"], [256,"Invocación por volteo"],
  [512,"Al colocar monstruo"], [1024,"Al colocar M/T"], [2048,"Cambio de posición"],
  [524288,"Al destruirse"], [8388608,"Al ir al cementerio"], [2097152,"Al ir a la mano"],
  [32768,"Final de la cadena"], [8,"Inicio de la Battle Phase"], [16,"Fin de la Battle Phase"],
  [4,"Final de la Main Phase"], [32,"End Phase"], [2,"Standby Phase"], [1,"Draw Phase"],
];
/* Antes esto pegaba el momento al título de cada panel y quedaba un
   "¿Confirmas? · Damage Step" que parecía que te pedían aceptar el Damage
   Step. Ahora el momento va en su propia línea, arriba del panel, junto a
   la fase: es una referencia, no una pregunta. */
let momentoPanel = "";
const conMomento = (titulo, m) => { momentoPanel = momentoPregunta(m) || ""; return titulo; };
/* Las "descripciones" del motor llevan el código de la carta en los bits
   altos cuando el aviso es de una carta concreta. */
function cartaDeDescripcion(d){
  try{
    const b = BigInt(d ?? 0);
    if(b > 1048575n){ const c = Number(b >> 20n); if(NAMES[c]) return c; }
  }catch(e){}
  return null;
}
/* ══ LO QUE DICE CADA OPCIÓN ══
   Reddit, 05-10: «Vampire Lord's options… only say Option 1-3 rather than
   Monster, Spell, or Trap». La descripción de una opción es o un texto de
   la carta —(código << 20) | índice, que remite a str1…str16 de la base,
   ahora dentro del juego en `CADENAS_CARTA`— o un texto del sistema de
   EDOPro (números pequeños). Lo que no se sepa leer sigue saliendo como
   «Opción N». */
/* 1: el motor lo manda al elegir CÓMO invocar o colocar un monstruo que
   tiene otra forma (Fusilier Dragon, GitHub #3: salía «Opción 1»). */
const SISTEMA = { 1:"Con sacrificios (la forma normal)", 60:"Cara", 61:"Cruz", 70:"Monstruo", 71:"Mágica", 72:"Trampa",
                  573:"Añadir a la mano", 574:"Mandar al Cementerio",
                  1213:"Descartar 1 Mágica", 1214:"No descartar" };
function textoDeDescripcion(d){
  try{
    const b = BigInt(d ?? 0);
    if(b > 1048575n){
      const c = Number(b >> 20n), i = Number(b & 0xFFFFFn);
      const C = globalThis.CADENAS_CARTA ?? {};
      const alias = DB?.get?.(c)?.alias;
      return C[c]?.[i] ?? (alias ? C[alias]?.[i] : null) ?? null;
    }
    const t = SISTEMA[Number(b)];
    return t ? T(t) : null;
  }catch(e){ return null; }
}
function momentoPregunta(m){
  const t = ((m?.hint_timing>>>0) || (m?.hint_timing_other>>>0)) >>> 0;
  /* Dentro del Damage Step manda el estado que lleva el adaptador: el
     mensaje trae varios bits a la vez y el que importa es ese. */
  if(V?.momento?.() === "damage")
    return (t & 16384) ? "Damage Step · cálculo de daño" : "Damage Step";
  for(const [bit,txt] of TIMINGS) if(t & bit) return txt;
  return V?.momentoTexto?.() ?? "";
}
function resumen(m){
  const p=o=>(o||[]).map(c=>nm(c.code));
  const r={};
  for(const k of ["summons","special_summons","monster_sets","spell_sets","activates",
                  "pos_changes","attacks","chains","selects","select_cards"])
    if(m[k]?.length) r[k]=p(m[k]);
  for(const k of ["forced","min","max","can_cancel","can_finish","to_bp","to_ep","to_m2","positions"])
    if(m[k]!==undefined) r[k]=m[k];
  return r;
}
// los mensajes del core llevan BigInt, que JSON.stringify no sabe serializar
function safeJSON(o){
  try { return JSON.stringify(o, (k,v)=> typeof v==="bigint" ? v.toString()+"n"
        : (v instanceof Map ? "[Map]" : v)); }
  catch(e){ return "(no serializable: "+e.message+")"; }
}
/* ══ LA DEPURACIÓN TAMPOCO CANTA LO QUE ESTÁ TAPADO ══
   E, 19-09: con la depuración encendida salía «IA simula → monster_sets
   Kuriboh» justo antes de que la IA colocara la carta. El aviso nombraba
   lo que iba a entrar boca abajo. Todo texto de la IA que llega a la
   pantalla pasa por aquí: una colocación se dice sin nombre, y cualquier
   nombre de una carta suya que tú no puedes ver (mano, mazo, Extra,
   boca abajo) se cambia por «una carta». */
function sinSecretos(texto){
  let t = String(texto ?? "")
    .replace(/monster_sets\s+[^\d-][^·→]*?(?=\s-?\d|$)/g, "coloca un monstruo")
    .replace(/spell_sets\s+[^\d-][^·→]*?(?=\s-?\d|$)/g, "coloca una mágica/trampa");
  const ia = 1 - ME, z = duel?.zones?.[ia];
  if(!z) return t;
  const ocultos = new Set();
  for(const loc of [1, 2, 64]) for(const c of (z[loc] ?? [])) if(c) ocultos.add(c.code);
  for(const loc of [4, 8]) for(const c of (z[loc] ?? [])) if(c && (c.position & 0x0a)) ocultos.add(c.code);
  /* Lo que sí está a la vista (boca arriba, cementerio, desterrado) se
     puede nombrar aunque haya otra copia escondida. */
  const vistos = new Set();
  for(const p of [0,1]) for(const loc of [4, 8, 16, 32]) for(const c of (duel.zones[p]?.[loc] ?? []))
    if(c && !((loc===4 || loc===8) && (c.position & 0x0a))) vistos.add(c.code);
  const nombres = [...ocultos].filter(c => !vistos.has(c)).map(c => NAMES?.[c]?.name).filter(Boolean)
    .flatMap(n => [n, n.replace(/\s*\(GOAT\)$/, "")]).sort((a,b)=>b.length-a.length);
  for(const n of nombres) t = t.split(n).join("una carta");
  return t;
}

/* ══ UNA PREGUNTA, UNA RESPUESTA ══
   Un clic que llega tarde —un botón que se quedó con el `onclick` de la
   pregunta anterior, un doble clic— contestaba a lo que el motor
   estuviera preguntando EN ESE MOMENTO, que ya era otra cosa. El motor
   decía «retry» y, peor, cada `send` arrancaba otro `loop()`: dos bucles
   contestando a la vez y la partida atascada para siempre. Visto con un
   jugador automático que pulsaba «Terminar turno» durante la ventana de
   cadena que sigue a una invocación. Ahora cada respuesta dice a qué
   pregunta contesta, y si no es la vigente se ignora. */
let enPantalla = null;
function respondLogged(r, etiqueta, pregunta){
  if(pregunta !== undefined && pregunta !== enPantalla){
    logIt("clic_tardio", { accion:etiqueta }); return false;
  }
  enPantalla = null;
  pararReloj();
  const porTiempo = POR_TIEMPO; POR_TIEMPO = false;
  logIt("tú_eliges", { accion:etiqueta, respuesta:r, ...(porTiempo ? { porTiempo:true } : {}) });
  if(duel?.esEspejo){ duel.porTiempo = porTiempo; duel.deJugador = true; }
  /* El anfitrión lleva la cuenta de los dos; la suya, aquí. */
  if(REMOTO?.rol === "anfitrion" && apuntarTiempo(ME, porTiempo)) return false;
  duel.respond(r);
  return true;
}

/* ── EL RELOJ ── */
function pararReloj(){
  if(RELOJ){ clearInterval(RELOJ.int); clearTimeout(RELOJ.fin); RELOJ.el?.remove?.(); RELOJ = null; }
}
/* `alAgotarse` null = solo se enseña (el del amigo, en la pantalla del
   anfitrión: quien le contesta es el margen de `esperarAlInvitado`). */
function relojSala(segundos, alAgotarse, { suyo = false } = {}){
  pararReloj();
  if(!(segundos > 0)) return;
  let el = null;
  try{
    el = document.createElement("div");
    el.id = "relojSala";
    if(suyo) el.className = "suyo";
    /* En la barra de arriba, junto a «Tu turno · Main Phase 1»: ahí no
       tapa ni el tablero ni la mano del rival. */
    const barra = document.getElementById("topbar"), antes = document.getElementById("btnChain");
    if(barra && antes && antes.parentNode === barra) barra.insertBefore(el, antes);
    else document.body.appendChild(el);
  }catch(e){ el = null; }
  const t0 = Date.now(), total = segundos * 1000;
  const pinta = () => {
    const queda = Math.max(0, total - (Date.now() - t0)), sg = Math.ceil(queda / 1000);
    if(el){
      el.textContent = `${suyo ? T("Tu amigo") + " · " : ""}${Math.floor(sg / 60)}:${String(sg % 60).padStart(2, "0")}`;
      el.classList.toggle("urgente", queda < 15000);
    }
    return queda;
  };
  pinta();
  RELOJ = { el, int: setInterval(pinta, 250),
            fin: alAgotarse ? setTimeout(() => { pararReloj(); alAgotarse(); }, total) : null };
}
/* Lo que contesta el reloj: lo más prudente, nunca algo que gaste cartas. */
function respuestaPorTiempo(m){
  const MT = OCG.OcgMessageType, R = OCG.OcgResponseType, IA = OCG.SelectIdleCMDAction, BA = OCG.SelectBattleCMDAction;
  switch(m.type){
    case MT.SELECT_IDLECMD:
      return { type:R.SELECT_IDLECMD, action: m.to_ep ? IA.TO_EP : m.to_bp ? IA.TO_BP : IA.TO_EP, index:null };
    case MT.SELECT_BATTLECMD:
      /* Con un monstruo obligado a atacar (Berserk Gorilla) no hay salida:
         el único gesto legal es atacar. */
      if(!m.to_ep && !m.to_m2 && m.attacks?.length)
        return { type:R.SELECT_BATTLECMD, action:BA.SELECT_BATTLE, index:0 };
      return { type:R.SELECT_BATTLECMD, action: m.to_ep ? BA.TO_EP : m.to_m2 ? BA.TO_M2 : BA.TO_EP, index:null };
    case MT.SELECT_CHAIN:
      return { type:R.SELECT_CHAIN, index: m.forced && m.selects?.length ? 0 : null };
    case MT.SELECT_EFFECTYN: return { type:R.SELECT_EFFECTYN, yes:false };
    case MT.SELECT_YESNO:    return { type:R.SELECT_YESNO, yes:false };
    default: return trivial(m) ?? decideAI(m, 0);
  }
}
/* Contestar por el jugador la pregunta que tiene en pantalla (la quita
   igual que si la hubiera contestado él). */
function contestarPorMi(m, r, etiqueta){
  if(enPantalla !== m || rendido || duel?.finished || !r) return false;
  idle = null; battle = null;
  V.setHandlers({}); V.markDraggable(new Set()); V.markUsable(new Set()); V.markTargets(new Set());
  hidePanel(); V.setZoneViewClose(null); V.closeZoneView(); V.closeChoice?.(); V.quitarPrevia(false);
  if(respondLogged(r, etiqueta, m)) loop();
  return true;
}
/* Se acabó el tiempo de la pregunta que tengo en pantalla. */
function agotarTiempo(m){
  if(enPantalla !== m || rendido || duel?.finished) return;
  const r = respuestaPorTiempo(m);
  if(!r) return;
  V.toast(T("Tiempo agotado: contesta el juego por ti"));
  logIt("tiempo_agotado", { pregunta:msgName(m) });
  POR_TIEMPO = true;
  contestarPorMi(m, r, "sin respuesta (tiempo)");
}
/* Anfitrión: apunta una decisión de `p` (agotada o no). Devuelve true si
   con esa ha perdido el duelo por tiempo. */
function apuntarTiempo(p, agotado, deJugador = true){
  if(!REMOTO || REMOTO.rol !== "anfitrion") return false;
  /* Las respuestas automáticas (sin elección real) ni suman ni reinician:
     no son una decisión del jugador. */
  if(agotado) AGOTADOS[p]++; else if(deJugador) AGOTADOS[p] = 0;
  if(AGOTADOS[p] < MAX_AGOTADOS) return false;
  const pierdoYo = p === ME;
  try{ REMOTO.sala.enviar({ t:"sin_tiempo", pierde: pierdoYo ? "anfitrion" : "invitado" }); }catch(e){}
  terminarPorSala({ ganaste: !pierdoYo, cuenta:true,
    motivo: T(pierdoYo ? "Se te ha acabado el tiempo tres veces seguidas" : "A tu amigo se le ha acabado el tiempo tres veces seguidas") });
  return true;
}
const cardAt = l => duel.at(l.controller, l.location, l.sequence);
const sameCard = (loc, card) => loc.controller===card.controller
  && loc.location===card.location && loc.sequence===card.sequence;

/* ── control por arrastre en Main Phase ── */
function armIdle(m){
  idle=m; battle=null;
  const send=(r,et)=>{ if(enPantalla!==m) return void logIt("clic_tardio", { accion:et ?? "?" }); idle=null; V.setHandlers({}); V.markDraggable(new Set());
                       V.markUsable(new Set()); hidePanel();
                       // la colocación provisional deja de mandar: ahora manda el motor
                       V.quitarPrevia(false);
                       if(respondLogged(r,et??"main",m)) loop(); };
  const cancelarSuelta=(aviso)=>{ preferredPlace=null; if(aviso) V.toast(aviso); V.quitarPrevia(); };
  const R=OCG.OcgResponseType, IA=OCG.SelectIdleCMDAction;
  /* Antes se emparejaba la carta arrastrada con las listas del core por
     (controlador, zona, índice). Si el espejo se desincronizaba un puesto,
     jugabas OTRA carta: es lo que pasó con Chaos Sorcerer, que se "colocó"
     y en realidad colocó el Nobleman of Crossout. Ahora se resuelve cada
     entrada a un uid concreto y la interfaz solo trabaja con uids. */
  const acciones=new Map();   // uid -> {summon,specialSummon,monsterSet,activate,spellSet,posChange}
  const mapear=(list,clave)=>(list||[]).forEach((l,i)=>{
    const c=duel.resolve(l, l.code);
    if(!c) return;
    const e=acciones.get(c.uid) ?? {}; e[clave]=i; acciones.set(c.uid,e);
  });
  mapear(m.summons,"summon"); mapear(m.special_summons,"specialSummon");
  mapear(m.monster_sets,"monsterSet"); mapear(m.activates,"activate");
  mapear(m.spell_sets,"spellSet"); mapear(m.pos_changes,"posChange");
  const playable=new Set(acciones.keys());
  // separar: lo que se juega desde la mano vs. lo que ya está en el
  // campo y tiene efecto disponible (lo que más se pasa por alto)
  const enMano=new Set(), enCampo=new Set();
  for(const uid of playable){
    const c=duel.cards.get(uid);
    (c && c.location===2 ? enMano : enCampo).add(uid);
  }
  V.markDraggable(enMano);
  V.markUsable(enCampo);
  V.setHandlers({
    arrastre: true,
    canDrag: card => playable.has(card.uid),
    onDrop: (card, zone, slotIdx, x, y) => {
      const d=DB.get(card.code), mon=!!(d.type & 0x1), trap=!!(d.type & 0x4),
            campo=!!(d.type & 0x80000);
      const zonaOk = mon ? zone==="m"
                   : campo ? (zone==="st" || zone==="field")
                   : zone==="st";
      if(!zonaOk){
        cancelarSuelta(mon?"Los monstruos van en la zona de monstruos":"Las Mágicas y Trampas van en la zona de M/T");
        return;
      }
      /* Con reglas de 2005 el Field Spell ocupa el puesto 5 de la zona de
         M/T, no una zona aparte: sueltes donde sueltes, va ahí. */
      preferredPlace = campo ? { zone:"st", slot:5 } : { zone, slot:slotIdx };
      const a=acciones.get(card.uid);
      if(!a){ cancelarSuelta("Esa carta no se puede jugar ahora"); return; }
      const opts=[];
      const iS=a.summon??-1, iSS=a.specialSummon??-1, iMS=a.monsterSet??-1,
            iA=a.activate??-1, iSp=a.spellSet??-1;
      if(iS>=0)  opts.push({icon:"⚔", label:"Invocación normal",primary:true,
        run:()=>send({type:R.SELECT_IDLECMD,action:IA.SELECT_SUMMON,index:iS}, "Invocar "+nm(card.code))});
      if(iSS>=0) opts.push({icon:"✧", label:"Invocación especial",primary:true,
        run:()=>send({type:R.SELECT_IDLECMD,action:IA.SELECT_SPECIAL_SUMMON,index:iSS}, "Inv. especial "+nm(card.code))});
      if(iMS>=0) opts.push({icon:"⛨", label:"Colocar boca abajo",
        run:()=>send({type:R.SELECT_IDLECMD,action:IA.SELECT_MONSTER_SET,index:iMS}, "Colocar "+nm(card.code))});
      if(iA>=0)  opts.push({icon:"✦", label:"Activar",primary:true,
        run:()=>send({type:R.SELECT_IDLECMD,action:IA.SELECT_ACTIVATE,index:iA}, "Activar "+nm(card.code))});
      if(iSp>=0) opts.push({icon:"▤", label:"Colocar tapada",
        run:()=>send({type:R.SELECT_IDLECMD,action:IA.SELECT_SPELL_SET,index:iSp}, "Colocar tapada "+nm(card.code))});
      if(!opts.length){ cancelarSuelta("Esa carta no se puede jugar ahora"); return; }
      // las trampas solo se pueden colocar: sin menú
      if(trap && opts.length===1) return opts[0].run();
      if(opts.length===1) return opts[0].run();
      V.choiceMenu(x, y, nm(card.code), [...opts,
        {icon:"✕", label:"Cancelar",run:()=>cancelarSuelta()}]);
    },
    onClick: card => {
      // clic en carta propia ya en el campo: activar o cambiar posición
      const a=acciones.get(card.uid); if(!a) return;
      const iA=a.activate??-1, iP=a.posChange??-1;
      const opts=[];
      if(iA>=0) opts.push({icon:"✦", label:"Activar",primary:true,
        // sin el índice, el motor activaba la primera carta de la lista
        run:()=>send({type:R.SELECT_IDLECMD,action:IA.SELECT_ACTIVATE,index:iA},
                     "Activar "+nm(card.code))});
      if(iP>=0) opts.push({icon:"↻", label:"Cambiar posición",
        run:()=>send({type:R.SELECT_IDLECMD,action:IA.SELECT_POS_CHANGE,index:iP})});
      if(!opts.length) return;
      const r=document.querySelector(`.card[data-uid="${card.uid}"]`)?.getBoundingClientRect();
      V.choiceMenu((r?.left??300)+40,(r?.top??300),nm(card.code),
        [...opts,{icon:"✕", label:"Cancelar",run:()=>{}}]);
    },
  });
  V.setControles({
    fase: m.to_bp ? ()=>send({type:R.SELECT_IDLECMD,action:IA.TO_BP,index:null}) : null,
    faseTxt: "Battle Phase",
    fin: m.to_ep ? ()=>send({type:R.SELECT_IDLECMD,action:IA.TO_EP,index:null}) : null,
  });
  const btns=[{label:"Ver todas las acciones",run:()=>{ fullIdlePanel(m,send); }}];
  panel(PHNAME[duel.phase]??"Main Phase", btns,
        playable.size ? "Arrastra para jugar · mantén pulsada una carta para verla · ✦ = efecto disponible"
                      : "No tienes jugadas disponibles");
}

function fullIdlePanel(m, send){
  const R=OCG.OcgResponseType, IA=OCG.SelectIdleCMDAction, opts=[];
  const push=(list,action,pref)=>(list||[]).forEach((c,i)=>
    opts.push({label:`${pref} ${nm(c.code)}`,run:()=>send({type:R.SELECT_IDLECMD,action,index:i})}));
  push(m.summons,IA.SELECT_SUMMON,"Invocar");
  push(m.special_summons,IA.SELECT_SPECIAL_SUMMON,"Inv. especial");
  push(m.activates,IA.SELECT_ACTIVATE,"Activar");
  push(m.monster_sets,IA.SELECT_MONSTER_SET,"Colocar");
  push(m.spell_sets,IA.SELECT_SPELL_SET,"Colocar tapada");
  push(m.pos_changes,IA.SELECT_POS_CHANGE,"Cambiar posición");
  if(m.to_bp) opts.push({label:"→ Battle Phase",primary:true,run:()=>send({type:R.SELECT_IDLECMD,action:IA.TO_BP,index:null})});
  if(m.to_ep) opts.push({label:"→ Terminar turno",run:()=>send({type:R.SELECT_IDLECMD,action:IA.TO_EP,index:null})});
  opts.push({label:"Volver",run:()=>armIdle(m)});
  panel("Todas las acciones", opts);
}

/* ── Battle Phase: clic en tu monstruo → elegir objetivo ── */
function armBattle(m){
  battle=m; idle=null;
  const R=OCG.OcgResponseType, BA=OCG.SelectBattleCMDAction;
  const send=(r,et)=>{ if(enPantalla!==m) return void logIt("clic_tardio", { accion:et ?? "?" }); battle=null; V.setHandlers({}); V.markTargets(new Set());
                  V.markDraggable(new Set()); V.markUsable(new Set());
                  V.markAtacadas(new Set()); hidePanel(); V.quitarPrevia(false);
                  if(respondLogged(r,et??"battle",m)) loop(); };
  const attackers=new Map();
  (m.attacks||[]).forEach((l,i)=>{ const c=duel.resolve(l, l.code); if(c) attackers.set(c.uid,i); });
  V.markDraggable(new Set(attackers.keys()));
  // los que ya atacaron quedan apagados, para verlo de un vistazo
  const mios=(duel.zones[ME]?.[4]??[]).filter(Boolean).map(c=>c.uid);
  V.markAtacadas(new Set(mios.filter(u=>!attackers.has(u))));
  V.setHandlers({
    canDrag: ()=>false,
    onClick: card => {
      const i=attackers.get(card.uid);
      if(i===undefined) return;
      send({type:R.SELECT_BATTLECMD,action:BA.SELECT_BATTLE,index:i}, "Atacar con "+nm(card.code));
    },
  });
  V.setControles({
    fase: m.to_m2 ? ()=>send({type:R.SELECT_BATTLECMD,action:BA.TO_M2,index:null}) : null,
    faseTxt: "Main Phase 2",
    fin: m.to_ep ? ()=>send({type:R.SELECT_BATTLECMD,action:BA.TO_EP,index:null}) : null,
  });
  const btns=[];
  (m.chains||[]).forEach((c,i)=>btns.push({label:`Activar ${nm(c.code)}`,
    run:()=>send({type:R.SELECT_BATTLECMD,action:BA.SELECT_CHAIN,index:i})}));
  panel("Battle Phase", btns,
    attackers.size ? "Haz clic en un monstruo tuyo para declarar ataque" : "No puedes atacar");
}

/* Gancho de pruebas: deja pintar un panel de decisión concreto sin tener que
   provocar la situación en una partida real. Existe porque el fallo de "T is
   not a function" solo salía con una carta TAPADA del rival en la lista de
   objetivos —una entre mil— y sin poder montar ese panel a mano no había
   forma honesta de escribir la comprobación que lo impide. Ver
   `check-tapadas.mjs`. No hace nada por sí solo: hay que llamarlo. */
globalThis.__PREGUNTA_DE_PRUEBA__ = m => ask(m);

/* ══════════════════════════════════════════════════════════════════
   COMBINACIONES QUE SUMAN (SELECT_SUM)

   Cada carta ofrecida trae su valor en `amount`. Los 16 bits bajos son su
   valor normal y los altos un SEGUNDO valor para las cartas que pueden
   contar como dos niveles distintos; si el alto es 0, solo vale el bajo.
   Las de `selects_must` entran obligatoriamente y ya descuentan.

   `select_max` es el modo: 0 = la suma tiene que dar EXACTAMENTE `amount`;
   1 = tiene que llegar o pasarse, pero sin que sobre ninguna carta (si al
   quitar cualquiera sigue llegando, esa combinación no vale).

   Las listas son de 2 a 6 cartas, así que se prueban todos los subconjuntos
   sin más: 64 combinaciones en el peor caso.
   ══════════════════════════════════════════════════════════════════ */
function combinacionesSuma(m){
  const lista = m.selects ?? [];
  const n = lista.length;
  if(!n || n > 16) return [];
  const valores = lista.map(e=>{
    const bajo = e.amount & 0xffff, alto = (e.amount >>> 16) & 0xffff;
    return alto ? [bajo, alto] : [bajo];
  });
  const fijo = (m.selects_must ?? []).reduce((s,e)=>s + (e.amount & 0xffff), 0);
  const objetivo = (m.amount ?? 0) - fijo;
  const exacto = !m.select_max;
  /* OJO: el motor manda min y max en 0 cuando no hay límite de cuántas
     cartas puedes coger; tomarlos al pie de la letra dejaba fuera todas
     las combinaciones y los rituales seguían sin poder pagarse. */
  const min = Math.max(1, m.min || 1), max = (m.max > 0 ? m.max : n);
  const out = [];
  for(let mask=1; mask < (1<<n); mask++){
    const idx=[]; for(let i=0;i<n;i++) if(mask & (1<<i)) idx.push(i);
    if(idx.length < min || idx.length > max) continue;
    /* Cada carta puede aportar uno de sus dos valores: se prueban todas las
       repartos posibles, que con estas listas son cuatro o cinco. */
    const sumas = idx.reduce((acc,i)=>{
      const nuevo=[];
      for(const s of acc) for(const v of valores[i]) nuevo.push(s+v);
      return [...new Set(nuevo)];
    }, [0]);
    const vale = exacto
      ? sumas.includes(objetivo)
      : sumas.some(s => s >= objetivo) &&
        // sin sobrar: quitando cualquiera ya no llega
        idx.every(i => {
          const resto = idx.filter(j=>j!==i);
          const s2 = resto.reduce((acc,j)=>{
            const nuevo=[]; for(const s of acc) for(const v of valores[j]) nuevo.push(s+v);
            return [...new Set(nuevo)];
          }, [0]);
          return !s2.some(s=>s >= objetivo);
        });
    if(vale) out.push(idx);
  }
  // primero las que gastan menos cartas
  return out.sort((a,b)=>a.length-b.length);
}

/* ── el resto de decisiones, en panel ── */
let preguntaUrgente = false;
function ask(m){
  enPantalla = m;
  preguntaUrgente = m.type !== OCG.OcgMessageType.SELECT_IDLECMD && m.type !== OCG.OcgMessageType.SELECT_BATTLECMD;
  /* OJO CON EL NOMBRE. Esto se llamaba `T`, igual que la funcion de
     traduccion del modulo, y la tapaba dentro de toda esta funcion. El
     dia que alguien escribio T("Carta boca abajo") aqui dentro, el juego
     reventaba con "T is not a function" —pero solo al seleccionar una
     carta tapada del rival, o sea casi nunca hasta que a alguien le toco
     un Thousand-Eyes Restrict. Se llama MT y ya no puede volver a pasar. */
  const MT=OCG.OcgMessageType, R=OCG.OcgResponseType;
  const send=(r,et)=>{ if(enPantalla!==m) return void logIt("clic_tardio", { accion:et ?? "?" });
                       hidePanel(); V.markTargets(new Set()); V.setHandlers({});
                       V.setZoneViewClose(null); V.closeZoneView(); V.quitarPrevia(false);
                       if(respondLogged(r,et??msgName(m),m)) loop(); };
  /* En una sala, cada decisión tiene su tiempo (ver `TIEMPO_SALA`). */
  if(REMOTO && TIEMPO_SALA > 0 && !globalThis.GOAT_SIN_RELOJ) relojSala(TIEMPO_SALA, () => agotarTiempo(m));
  switch(m.type){
    case MT.SELECT_IDLECMD:   return armIdle(m);
    case MT.SELECT_BATTLECMD: return armBattle(m);
    /* ── TRIBUTOS QUE TIENEN QUE SUMAR ──
       Así se pagan las invocaciones de ritual: "sacrifica monstruos cuyos
       niveles sumen 8". El motor lo manda como SELECT_SUM y esto no estaba
       implementado: caía en el "Decisión no soportada" del final y por eso
       un jugador reportó que su mazo de ritual no podía invocar nada.
       En vez de una lista donde el jugador tiene que hacer la cuenta a
       mano, se calculan las combinaciones que valen y se ofrecen hechas. */
    case MT.SELECT_SUM: {
      const combis = combinacionesSuma(m);
      if(!combis.length)
        return panel(T("No hay combinación posible"),
                     [{label:T("Continuar"),run:()=>send({type:R.SELECT_SUM,indicies:null})}]);
      const etiqueta = idx => idx.map(i=>nm(m.selects[i].code)).join(" + ");
      const opts = combis.slice(0,8).map((idx,k)=>({
        label:`${etiqueta(idx)}`, primary:k===0,
        run:()=>send({type:R.SELECT_SUM, indicies:idx}, "Tributos: "+etiqueta(idx))}));
      panel(conMomento(`${T("Sacrifica para sumar")} ${m.amount}`, m), opts,
            T("Las combinaciones que suman justo salen ya hechas"));
      return;
    }
    case MT.SELECT_CHAIN: {
      if(ventanaPrioridad){
        /* La prioridad: el efecto de lo que acabas de invocar, antes de
           que el rival pueda responder a la invocación. */
        const opts=(m.selects||[]).map((c,i)=>({label:`${T("Usar ya el efecto de")} ${nm(c.code)}`,primary:true,
          run:()=>send({type:R.SELECT_CHAIN,index:i})}));
        opts.push({label:T("Pasar la prioridad"),run:()=>send({type:R.SELECT_CHAIN,index:null})});
        V.atajos({ escape: () => send({type:R.SELECT_CHAIN,index:null},"ESC"), espacio: null });
        momentoPanel = "";
        panel(T("Prioridad"), opts,
              T("Puedes usar el efecto antes de que el rival responda a la invocación. Si pasas, el rival responde primero y después ya no hay otra ventana."));
        return;
      }
      const opts=(m.selects||[]).map((c,i)=>({label:`Encadenar ${nm(c.code)}`,primary:true,
        run:()=>send({type:R.SELECT_CHAIN,index:i})}));
      if(!m.forced) opts.push({label:"No responder",run:()=>send({type:R.SELECT_CHAIN,index:null})});
      /* ESC = "no respondo". Es la tecla que más se usa en un duelo, y
         solo se activa cuando pasar es LEGAL: con una cadena obligatoria
         no hay nada que pasar y la tecla no hace nada. */
      V.atajos({ escape: m.forced ? null
                                  : () => send({type:R.SELECT_CHAIN,index:null},"ESC"),
                 espacio: null });
      /* En batalla importa MUCHO en qué momento se responde: no es lo mismo
         encadenar en la declaración de ataque que dentro del Damage Step.
         El momento no se adivina, viene en el propio mensaje del motor. */
      momentoPanel = momentoPregunta(m) || "";
      panel(m.forced?"Efecto obligatorio — elige":"¿Quieres responder?", opts,
            m.forced ? null : "Si no contestas, se pasa sola");
      if(!m.forced && CHAIN_TIMEOUT>0)
        startPromptTimer(CHAIN_TIMEOUT, ()=>{
          logIt("tiempo_agotado",{pregunta:"SELECT_CHAIN"});
          V.toast("Tiempo agotado: no se responde");
          send({type:R.SELECT_CHAIN,index:null},"sin respuesta (tiempo)");
        });
      return;
    }
    case MT.SELECT_EFFECTYN:
      return panel(conMomento(`¿Activar el efecto de ${nm(m.code)}?`, m),[
        {label:"Sí",primary:true,run:()=>send({type:R.SELECT_EFFECTYN,yes:true})},
        {label:"No",run:()=>send({type:R.SELECT_EFFECTYN,yes:false})}]);
    case MT.SELECT_YESNO: {
      /* El motor mete el código de la carta dentro de la descripción:
         así el panel dice de qué efecto habla en vez de "¿Confirmas?". */
      const cod = cartaDeDescripcion(m.description);
      const que = textoDeDescripcion(m.description);
      return panel(conMomento(cod ? `¿Activar el efecto de ${nm(cod)}?` : "¿Confirmas?", m),[
        {label:"Sí",primary:true,run:()=>send({type:R.SELECT_YESNO,yes:true})},
        {label:"No",run:()=>send({type:R.SELECT_YESNO,yes:false})}], que ? `«${que}»` : undefined);
    }
    case MT.SELECT_OPTION:
      return panel("Elige una opción",(m.options||[]).map((o,i)=>
        ({label:textoDeDescripcion(o) ?? `Opción ${i+1}`,run:()=>send({type:R.SELECT_OPTION,index:i})})));
    case MT.SELECT_POSITION: {
      const P=OCG.OcgPosition,o=[];
      if(m.positions&P.FACEUP_ATTACK)   o.push({label:"Ataque",primary:true,run:()=>send({type:R.SELECT_POSITION,position:P.FACEUP_ATTACK})});
      if(m.positions&P.FACEUP_DEFENSE)  o.push({label:"Defensa",run:()=>send({type:R.SELECT_POSITION,position:P.FACEUP_DEFENSE})});
      if(m.positions&P.FACEDOWN_DEFENSE)o.push({label:"Defensa boca abajo",run:()=>send({type:R.SELECT_POSITION,position:P.FACEDOWN_DEFENSE})});
      /* GitHub #1 y Reddit: con Reasoning, Monster Gate, Dimension Fusion
         o Cyber Jar se preguntaba la posición sin decir de QUÉ monstruo.
         El mensaje trae el código: se nombra y se enseña en el panel. */
      if(m.code){ V.showDetail?.(m.code); return panel(`¿En qué posición pones ${nm(m.code)}?`, o); }
      return panel("¿En qué posición?",o);
    }
    case MT.SELECT_CARD: case MT.SELECT_TRIBUTE: case MT.SELECT_UNSELECT_CARD: {
      const list=m.type===MT.SELECT_UNSELECT_CARD?(m.select_cards||[]):(m.selects||[]);
      const min=m.type===MT.SELECT_UNSELECT_CARD?1:Math.max(1,m.min??1);
      const rt=m.type===MT.SELECT_TRIBUTE?R.SELECT_TRIBUTE
             :m.type===MT.SELECT_UNSELECT_CARD?R.SELECT_UNSELECT_CARD:R.SELECT_CARD;
      const chosen=[], uidOf=i=>duel.resolve(list[i], list[i].code)?.uid;
      /* ══ UN TRIBUTO PUEDE VALER POR DOS ══
         Reddit, 05-10: «Double Coston doesn't work with the double
         tribute». En un tributo, `min` y `max` son TRIBUTOS, no cartas, y
         cada carta dice cuántos vale (`release_param`: Double Coston, 2
         para un monstruo OSCURO). Se contaban cartas, así que con Coston
         sola el panel seguía pidiendo otra. */
      const peso = i => m.type===MT.SELECT_TRIBUTE ? Math.max(1, Number(list[i]?.release_param) || 1) : 1;
      const cuenta = () => chosen.reduce((s,i)=>s+peso(i), 0);
      const choose=i=>{
        if(enPantalla!==m) return;          // esa pregunta ya se contestó
        if(m.type===MT.SELECT_UNSELECT_CARD) return send({type:rt,index:i});
        const k=chosen.indexOf(i); k>=0?chosen.splice(k,1):chosen.push(i);
        if(cuenta()>=(m.max??min) && cuenta()>=min) return send({type:rt,indicies:[...chosen]});
        render();
      };
      // Si alguna carta elegible NO está a la vista en el tablero (cementerio,
      // deck, desterradas), abrimos un visor con las cartas para poder verlas.
      const OCULTAS=[1,16,32,64];
      const necesitaVisor = list.some(c=>OCULTAS.includes(c.location));
      const abrirVisor=()=>{
        /* ══ LO QUE SE LE PASA AL VISOR IMPORTA ══
           Antes iba solo `{code, _i}`, y eso rompía dos cosas de golpe:

           · sin `position` ni `controller`, una carta boca abajo del
             rival se pintaba de cara. El panel de texto sí la tapaba
             («Carta boca abajo») pero el visor la enseñaba entera: con
             Nobleman of Crossout se leía el monstruo colocado;
           · y sin `uid` no había forma de distinguir una carta de otra,
             que es lo que necesita el visor para saber si el clic es
             sobre la que ya estás leyendo.

           Se pasa la carta con sus datos y una identidad estable. */
        V.openZoneView(`${T("Elige")} ${min===(m.max??min)?min:`${min}-${m.max}`} ${T("carta(s)")}`
                       + (chosen.length ? ` · ${chosen.length} ${T("elegida(s)")}` : ""),
          list.map((c,i)=>({ code:c.code, _i:i, elegida: chosen.includes(i),
                             position:c.position, controller:c.controller,
                             location:c.location, uid:uidOf(i) ?? `sel${i}` })),
          picked=>{ V.closeZoneView(); choose(picked._i);
                    /* Solo si la MISMA pregunta sigue abierta (falta elegir
                       más). Si ya se completó, el motor está preguntando
                       otra cosa y reabrir este visor la tapaba. */
                    if(enPantalla===m && document.getElementById("prompt").style.display==="block" && necesitaVisor)
                      setTimeout(()=>{ if(enPantalla===m) abrirVisor(); },60); });
      };
      const render=()=>{
        /* Una carta boca abajo del rival NO puede enseñar su nombre. El motor
           manda el código igual —lo necesita para resolver— pero enseñarlo es
           hacer trampa: con Nobleman of Crossout se leía el monstruo tapado. */
        const etiqueta = c => (c.position & 0x0a) && c.controller !== ME
          ? T("Carta boca abajo") : nm(c.code);
        const opts=list.map((c,i)=>({label:`${chosen.includes(i)?"✓ ":""}${etiqueta(c)} (${T(LOCNAME[c.location]??"?")})`,
          primary:chosen.includes(i),run:()=>choose(i)}));
        if(m.type!==MT.SELECT_UNSELECT_CARD && cuenta()>=min)
          opts.unshift({label:`Confirmar (${chosen.length})`,primary:true,run:()=>send({type:rt,indicies:[...chosen]})});
        if(m.can_cancel) opts.push({label:"Cancelar",run:()=>send({type:rt,
          ...(m.type===MT.SELECT_UNSELECT_CARD?{index:null}:{indicies:null})})});
        if(m.type===MT.SELECT_UNSELECT_CARD && m.can_finish) opts.push({label:"Terminar",run:()=>send({type:rt,index:null})});
        if(necesitaVisor) opts.unshift({label:"👁 Ver las cartas",primary:true,run:abrirVisor});
        panel(conMomento(`Selecciona ${min===(m.max??min)?min:`${min}-${m.max}`} carta(s)`, m),opts,
              necesitaVisor ? "Hay cartas fuera del tablero: ábrelas para verlas"
                            : "Haz clic en las cartas marcadas, en el campo o en tu mano"
                              + (chosen.length?` · elegidas: ${chosen.length}`:""));
        V.setHandlers({ onClick: card=>{ const i=list.findIndex((_,k)=>uidOf(k)===card.uid); if(i>=0) choose(i); } });
        V.markTargets(new Set(list.map((_,i)=>uidOf(i)).filter(Boolean)));
      };
      /* Si cerrabas el visor, el panel de selección se quedaba detrás sin
         volver a pintarse y parecía que el juego se colgaba (el caso de
         Black Luster Soldier). Ahora cerrar el visor repinta el panel. */
      V.setZoneViewClose(()=>{ if(document.getElementById("prompt").style.display!=="block") render(); });
      render();
      if(necesitaVisor) abrirVisor();
      return;
    }
    case MT.ANNOUNCE_CARD: {
      /* Archfiend's Oath y compañía piden declarar el nombre de una carta.
         Los "opcodes" del mensaje limitan qué vale (solo monstruos, etc.),
         y el propio motor trae la función para comprobarlo. */
      const candidatos=[];
      for(const k in DB_RAW){
        const code=+k, d=DB.get(code);
        if(!d) continue;
        let vale=true;
        try{ vale = OCG.cardMatchesOpcode(d, m.opcodes); }catch(e){ vale=true; }
        if(vale) candidatos.push(code);
      }
      const lista = candidatos.length ? candidatos : [...DB.keys()];
      declararCarta(lista, code=>send({type:R.ANNOUNCE_CARD, card:code},
                                      "declara "+nm(code)));
      return;
    }
    case MT.ANNOUNCE_RACE: case MT.ANNOUNCE_ATTRIB: {
      const esRaza = m.type===MT.ANNOUNCE_RACE;
      const N = esRaza ? RAZAS : ATRIBUTOS;
      const bits=[]; const disp = esRaza ? BigInt(m.available) : m.available;
      for(let i=0;i<(esRaza?64:32);i++){
        const bit = esRaza ? (1n<<BigInt(i)) : (1<<i);
        const hay = esRaza ? ((disp>>BigInt(i))&1n)===1n : ((disp>>i)&1);
        if(hay) bits.push([bit, N[String(bit)] ?? ("#"+bit)]);
      }
      const cuantas=m.count??1, elegidas=[];
      const pinta=()=>panel(esRaza?"Declara un Tipo":"Declara un Atributo",
        bits.map(([b,n])=>({label:(elegidas.includes(b)?"✓ ":"")+n, primary:elegidas.includes(b),
          run:()=>{ elegidas.push(b);
            if(elegidas.length>=cuantas)
              send(esRaza?{type:R.ANNOUNCE_RACE,races:elegidas}
                         :{type:R.ANNOUNCE_ATTRIB,attributes:elegidas},"declara "+n);
            else pinta(); }})),
        cuantas>1?`Elige ${cuantas}`:null);
      pinta(); return;
    }
    case MT.ANNOUNCE_NUMBER:
      return panel("Declara un número",(m.options||[]).map((o,i)=>
        ({label:String(o), run:()=>send({type:R.ANNOUNCE_NUMBER,value:i},"declara "+o)})));
    case MT.SELECT_PLACE: case MT.SELECT_DISFIELD: {
      // si el jugador acaba de soltar en una zona concreta, respetarla
      const r=placeFromDrop(m) ?? decideAI(m,0);
      return send(r);
    }
    default: {
      const r=decideAI(m,0);
      if(r) return send(r);
      return panel("Decisión no soportada ("+m.type+")",[{label:"Continuar",run:()=>loop()}]);
    }
  }
}
function placeFromDrop(m){
  if(!preferredPlace) return null;
  const want=preferredPlace; preferredPlace=null;
  const loc = want.zone==="m" ? OCG.OcgLocation.MZONE
            : want.zone==="st" ? OCG.OcgLocation.SZONE : null;
  if(!loc) return null;
  const mask=m.field_mask>>>0;
  const byteIdx = loc===OCG.OcgLocation.MZONE ? 0 : 1;   // bytes 0-1 = jugador preguntado
  const b=(mask>>>(byteIdx*8))&0xff;
  if((b>>>want.slot)&1) return null;                      // esa zona no está disponible
  return { type:OCG.OcgResponseType.SELECT_PLACE,
           places:[{player:m.player, location:loc, sequence:want.slot}] };
}

/* ── rendirse ──
   No se le pide nada al motor: el duelo simplemente se detiene aquí y
   cuenta como derrota. Responder por ti para perder sería peor: habría
   que inventarse una jugada suicida y el log quedaría mintiendo. */
/* Lo que se sabe del duelo al acabar. El torneo meta lo apunta por
   partida; el Reino lo ignora. */
function datosDelFinal(motivo){
  return { turnos: duel?.turnCount ?? null, lpMio: duel?.lp?.[ME] ?? null,
           lpRival: duel?.lp?.[1-ME] ?? null, empece: EMPECE, motivo,
           /* Lo que el BOT te ha visto jugar: lo que estuvo boca arriba,
              lo que hay en tu cementerio o desterrado, y lo que recuerda
              de tus tapadas. Con eso sidea entre partidas, como harías tú.
              Nada de tu mano ni de tu mazo. */
           vistasPorLaIA: cartasQueVioLaIA(),
           /* El registro entero de la partida, en texto. El torneo se lo
              queda para que E pueda mandar el match completo, no solo sus
              notas. Quien no lo quiera, que no lo lea. */
           log: textoDelLog({ publico:false }),
           resumen: textoDelLog({ crudo:false }) };
}
function cartasQueVioLaIA(){
  const out = new Set();
  try{
    const bot = 1 - ME;
    for(const c of (duel?.cards?.values?.() ?? [])){
      if(c.controller !== ME && c.owner !== ME) continue;
      const publica = c.location === 16 || c.location === 32;         // cementerio, desterradas
      const enMesa  = (c.location === 4 || c.location === 8) && !(c.position & 0x0a);
      if(publica || enMesa) out.add(c.code);
    }
    for(const v of (duel?.__memoriaIA?.[bot]?.values?.() ?? [])) if(v?.code) out.add(v.code);
  }catch(e){}
  return [...out];
}
let EMPECE = null;
/* Para no repetir el aviso en cada eslabón de la misma cadena. */
const OBJETIVOS_VISTOS = new Set();
let PENSADOR = null, LIB_PENSAR = null, TURNO_ATAQUE = -1;
let rendido=false;
function rendirse(){
  if(rendido) return;
  rendido=true;
  pararReloj();
  logIt("rendicion", { turno:duel?.turnCount, lpTuyos:duel?.lp?.[ME], lpRival:duel?.lp?.[1-ME] });
  /* En una sala, el rival tiene que enterarse: para él es una victoria. */
  if(REMOTO){ try{ REMOTO.sala.enviar({ t:"rendicion" }); }catch(e){}
              REMOTO.resolver?.(null); if(duel?.esEspejo) duel.cerrar(); }
  V.setHandlers({}); V.markTargets(new Set()); V.markDraggable(new Set());
  V.markUsable(new Set()); V.markAtacadas(new Set()); V.quitarPrevia(false);
  V.closeChoice(); V.closeZoneView(); hidePanel();
  V.banner("TE RINDES", "#ff6a55");
  /* Rendirse es perder. Donde hay algo que apuntar al terminar —el Reino,
     el torneo meta— tiene que llegar ahí como derrota; antes el botón
     principal recargaba la página y la partida no contaba. */
  const alTerminar = typeof CONFIG?.alTerminar === "function" ? CONFIG.alTerminar : null;
  setTimeout(()=>V.pantallaFinal({
    ganaste:false, motivo:"Te has rendido",
    lpMio:duel?.lp?.[ME], lpRival:duel?.lp?.[1-ME], turnos:duel?.turnCount,
    avatarMio:CONFIG?.avatarMio, avatarRival:CONFIG?.avatarRival,
    nombreRival:CONFIG?.nombreRival,
    ...(alTerminar ? { textoNuevo:"Continuar",
                       onNuevo: () => alTerminar(false, datosDelFinal("Te has rendido")) } : {}) }), 900);
}

/* ── bucle ── */
let aiAttempt=0, aiLast=null;
async function loop(){
  try { await loopInterno(); }
  catch(e){
    console.error(e);
    logIt("ERROR", { msg:String(e && e.message || e), pila:String(e && e.stack||"").slice(0,400) });
    /* Un error que nadie reporta no existe. Viaja el TIPO de fallo —el
       mensaje recortado y limpiado—, nunca el estado de la partida. */
    globalThis.__TELE__?.error(String(e && e.message || e));
    /* Visible SIEMPRE: antes acababa escrito en la pantalla de carga oculta.
       Y además RECUPERABLE. Si lo que revienta es el dibujado del panel, la
       pregunta del motor sigue ahí sin contestar y el duelo se quedaba
       muerto: partida perdida por un fallo de la interfaz. Ahora se ofrece
       dejar que el juego conteste esa pregunta por ti y seguir jugando —el
       mismo resolutor que usan los bots— en vez de tener que empezar de
       cero. El log sigue saliendo igual, que es lo que hace falta para
       arreglarlo de verdad. */
    const q = duel?.pending ?? null;
    const botones = [];
    if(q) botones.push({ label:"Continuar (responde el juego por mí)", primary:true,
      run:async()=>{
        try{
          const r = trivial(q) ?? decideAI(q,0);
          if(r){ hidePanel(); logIt("recuperado", { pregunta:msgName(q), respuesta:r });
                 duel.respond(r); return loop(); }
        }catch(e2){ /* si ni así, se queda el botón del log */ }
        panel("Se ha roto algo", [{label:"Descargar log y avisar",primary:true,
          run:()=>abrirReporte("fallo")}],
          "No se ha podido continuar: manda el log, por favor");
      }});
    botones.push({ label:"Descargar log y avisar",
      run:()=>abrirReporte("fallo") });
    panel("Se ha roto algo", botones, String(e && e.message || e));
  }
}
async function loopInterno(){
  while(true){
    if(rendido) return;
    /* El invitado espera al anfitrión: si tarda, que se vea que el rival
       está jugando, como cuando piensa el bot. */
    const aviso = duel.esEspejo ? setTimeout(() => V.pensando?.(true), 400) : null;
    let q=await duel.run();
    if(aviso){ clearTimeout(aviso); V.pensando?.(false); }
    if(rendido) return;
    if(REMOTO?.rol === "anfitrion") q = mandarLoteSala(q);
    const ended=await drain();
    if(ended||duel.finished) return;
    if(!q){ if(duel.esEspejo) continue; return; }
    if(q.player===ME){
      /* Excepción a "sin elección real, resuelve solo": si lo que se elige
         está en la mano del rival, la gracia es VERLA. Aunque solo haya un
         objetivo legal hay que enseñar la mano y esperar a que pulses, o
         Trap Dustshoot pasa en un parpadeo y parece que elige por ti. */
      const miraLaManoRival = q.type===OCG.OcgMessageType.SELECT_CARD
        && (q.selects||[]).some(s => s.location===2 && s.controller!==ME);
      const auto = miraLaManoRival ? null : trivial(q);   // sin elección real → resolver solo
      if(auto){ logIt("auto", {pregunta:msgName(q), respuesta:auto}); duel.respond(auto); continue; }
      // Solo se salta la ventana de respuesta en TU turno y sin cadena en curso.
      // Durante el turno rival hay que preguntar siempre: es cuando activas
      // Call of the Haunted en su End Phase, Book of Moon en su ataque, etc.
      /* Modo "sin cadenas": no te pregunta nada... salvo lo que sale de TU
         cementerio. Si no, el retorno de Sinister Serpent se descartaba solo
         cada turno y perdías la carta sin enterarte, que era la duda que
         quedaba abierta con este modo. */
      const disparadorDesdeGY = (q.selects||[]).some(sel => sel.location === 16)
                                || hayDisparadoresPendientes(q);
      if(q.type===OCG.OcgMessageType.SELECT_CHAIN && !q.forced
         && chainMode==="nunca" && !disparadorDesdeGY){
        duel.respond({type:OCG.OcgResponseType.SELECT_CHAIN,index:null}); continue;
      }
      // TRAMPA: saltarse la ventana entera se comía los disparadores propios.
      // Sinister Serpent se ofrece a volver del cementerio en TU Standby Phase,
      // y esto lo descartaba sin preguntar: la carta volvía un turno tarde,
      // en la siguiente ventana que sí se preguntase. Lo delató el log del
      // 2026-08-09 (T4 Standby ofrecía 511000818 y la respuesta era "no responder").
      // En las tres partidas revisadas, lo ÚNICO que se ofrece desde el
      // cementerio es Sinister Serpent; lo demás sale de la mano, de la zona
      // de magias/trampas o del campo, y eso sí se puede saltar sin perder nada.
      const disparadorPropio = q.type===OCG.OcgMessageType.SELECT_CHAIN
        && ((q.selects||[]).some(s => s.location === 16)   // 16 = cementerio
            || hayDisparadoresPendientes(q));               // dos disparadores a la vez
      ventanaPrioridad = chainMode!=="nunca" && ventanaDePrioridad(q) && prioridadPreguntada !== duel.ultimaInvocada;
      if(ventanaPrioridad) prioridadPreguntada = duel.ultimaInvocada;
      /* ══ EN TU BATALLA NO SE SALTA NADA (GitHub #18) ══
         «No puedo activar Limiter Removal en el Damage Step». La cadena de
         la declaración de ataque terminaba (chainEnd → chainActive=false)
         y desde ahí el modo «auto» tomaba las ventanas del Damage Step por
         «tu turno, sin cadena» y las pasaba solas. Mientras hay un ataque
         en curso, cada ventana se pregunta. */
      const enBatalla = duel.atacante != null || V.momento?.() === "damage";
      if(q.type===OCG.OcgMessageType.SELECT_CHAIN && !q.forced && !disparadorPropio && !ventanaPrioridad
         && chainMode==="auto" && !chainActive && !enBatalla && duel.turnPlayer===ME){
        logIt("auto",{pregunta:"SELECT_CHAIN (ventana propia sin cadena)",respuesta:"no responder"});
        duel.respond({type:OCG.OcgResponseType.SELECT_CHAIN,index:null}); continue;
      }
      /* ══ «CUANDO TIENE SENTIDO» (19-11) ══ Ver src/ventanas.js. */
      if(q.type===OCG.OcgMessageType.SELECT_CHAIN && !q.forced && !disparadorPropio && !ventanaPrioridad
         && chainMode==="sentido"){
        const at = duel.atacante ? duel.cards?.get?.(duel.atacante.uid) ?? duel.atacante : null;
        const v = valePreguntar(q, {
          yo: ME, turnPlayer: duel.turnPlayer, fase: duel.phase,
          atacante: at ? { controller: at.controller ?? duel.atacante.controller } : null,
          cadena: (duel.cadena ?? []).map(x => ({ controller: x.controller, code: x.code })),
          objetivos: duel.objetivosCadena ?? new Set(),
          uidEn: s2 => duel.at(s2.controller, s2.location, s2.sequence)?.uid,
          info: code => ({ nombre: NAMES[code]?.name, texto: NAMES[code]?.desc ?? "", tipo: Number(DB?.get?.(code)?.type ?? 0) }),
          recienInvocadaRival: invocacionRival });
        if(!v.preguntar){
          logIt("auto",{pregunta:"SELECT_CHAIN (cuando tiene sentido)", respuesta:"no responder", motivo:v.motivo});
          duel.respond({type:OCG.OcgResponseType.SELECT_CHAIN,index:null}); continue;
        }
      }
      // las que se resuelven solas (colocar zona, ordenar…) no son
      // preguntas de verdad: ensuciaban el log
      if(!AUTO_KINDS.has(q.type)) logIt("te_pregunta", { pregunta:msgName(q), datos:resumen(q) });
      if(AUTO_YO){
        let r = null;
        for(let i = 0; i < 8 && !r; i++) r = trivial(q) ?? AUTO_YO(q, i) ?? decideAI(q, i);
        /* `GOAT_AUTOJUGAR = "ver"` (solo pruebas): la pregunta se PINTA
           como si la contestara una persona y el bot contesta un momento
           después. Es lo que usa el barrido de textos para ver los paneles. */
        if(r && globalThis.GOAT_AUTOJUGAR === "ver"){
          ask(q);
          setTimeout(() => contestarPorMi(q, r, "autojuego"), Number(globalThis.GOAT_VER_MS) || 120);
          return;
        }
        if(r){ logIt("autojuego", { respuesta:r }); await V.sleep(20); duel.respond(r); continue; }
      }
      return ask(q);
    }
    /* ══ LA PREGUNTA ES DEL AMIGO ══
       Ya se le ha mandado (`mandarLoteSala`), en paralelo a las
       animaciones; aquí se espera su respuesta. */
    if(REMOTO?.rol === "anfitrion"){
      V.pensando?.(true);
      const r = await esperarAlInvitado(q);
      V.pensando?.(false);
      pararReloj();
      if(rendido || duel.finished || r == null) return;
      /* Su reloj: tres agotadas seguidas pierden el duelo. */
      if(apuntarTiempo(1 - ME, !!REMOTO.porTiempo, !!REMOTO.jugador)) return;
      if(typeof r !== "object" || typeof r.type !== "number"){ preguntarOtraVezSala(q); continue; }
      logIt("rival_elige", { pregunta:msgName(q), respuesta:r });
      try{ duel.respond(r); }
      catch(e){ logIt("rival_respuesta_rota", { msg:String(e?.message ?? e) }); duel.pending = q; preguntarOtraVezSala(q); }
      continue;
    }
    if(q.type === OCG.OcgMessageType.SELECT_IDLECMD) invocacionRival = false;
    if(q!==aiLast){ aiLast=q; aiAttempt=0; }
    /* ── QUE SE LE VEA PENSAR ──
       El bot contestaba al instante y eso, además de no dar tiempo a leer
       el tablero, hacía que sus jugadas parecieran reflejos en vez de
       decisiones. Antes de la PRIMERA decisión de cada fase suya se para
       un momento y se enciende un aviso junto a su avatar. No es
       decoración pura: es el rato que tú necesitas para ver qué acaba de
       pasar antes de que pase lo siguiente. */
    /* Cuántas decisiones lleva la IA seguidas sin devolverte el turno.
       Se reinicia en `drain`, que es lo que corre entre turno y turno. */
    const decisionDeVerdad = q.type===OCG.OcgMessageType.SELECT_IDLECMD
                          || q.type===OCG.OcgMessageType.SELECT_BATTLECMD;
    if(decisionDeVerdad && aiAttempt===0 && PENSAR>0){
      V.pensando?.(true);
      await V.sleep(PENSAR);
      V.pensando?.(false);
    }
    // el cerebro decide; el piloto genérico cubre lo que no le interesa
    // (colocación de zona, ordenar cartas, declarar tipos…)
    let r=trivial(q) ?? cerebro?.(q,aiAttempt);
    /* ══ PENSAR ANTES DE JUGAR ══
       En su Main Phase 1, antes de cada jugada, el bot simula en el motor
       sus mejores opciones contra manos plausibles del rival (sin mirar
       las tuyas) y se queda con la que mejor deja la partida tras TU
       turno siguiente. Ver `ai/pensar.js`. Si falla o no hay tiempo,
       juega la heurística de siempre. */
    if(PENSADOR && !trivial(q) && q.type===OCG.OcgMessageType.SELECT_IDLECMD
       && duel.phase===4 && aiAttempt===0){
      V.pensando?.(true);
      try{
        const d0 = duel;
        const p = await PENSADOR.pensarIdle(duel, 1-ME, q, cerebro, { semilla:(SEED*131 + duel.turnCount*17 + LOG.length) >>> 0 });
        /* Mientras pensaba, el jugador puede haber salido o empezado otro
           duelo: esa respuesta ya no es de nadie. */
        if(duel !== d0 || d0.finished){ V.pensando?.(false); return; }
        if(p) r = p;
      }catch(e){ logIt("ia_simula_error", { msg:String(e?.message ?? e) }); }
      V.pensando?.(false);
    }
    /* ══ Y EN TU TURNO: LA VENTANA DE CADENA ══
       Donde se malgastan las trampas. El bot compara «responder con esto»
       contra «aguantar el golpe»: resuelve a mano lo que queda de batalla
       —con las reglas de 2005— y deja que el motor juegue su turno
       siguiente con y sin la carta. Ver `ai/pensar.js`. */
    if(PENSADOR && q.type===OCG.OcgMessageType.SELECT_CHAIN && !q.forced
       && aiAttempt===0 && duel.atacante && duel.turnPlayer===ME){
      V.pensando?.(true);
      try{
        const d0 = duel;
        const p = await PENSADOR.pensarCadena(duel, 1-ME, q, cerebro, { semilla:(SEED*211 + duel.turnCount*29 + LOG.length) >>> 0 });
        if(duel !== d0 || d0.finished){ V.pensando?.(false); return; }
        if(p) r = p;
      }catch(e){ logIt("ia_simula_error", { msg:String(e?.message ?? e) }); }
      V.pensando?.(false);
    }
    /* Y la batalla: la primera pregunta de batalla del turno (luego el
       mundo imaginado ya no sabría quién ha atacado). APAGADA: medido en
       100 partidas con las mismas semillas, pensar solo la Main Phase dio
       67-21 y pensar también la batalla 65-25 — no suma y alarga el turno.
       Se enciende con `globalThis.GOAT_PENSAR_BATALLA = true`. */
    if(PENSADOR && globalThis.GOAT_PENSAR_BATALLA === true && q.type===OCG.OcgMessageType.SELECT_BATTLECMD && aiAttempt===0 && (q.attacks?.length ?? 0) > 0){
      const primera = TURNO_ATAQUE !== duel.turnCount;
      if(primera){
        V.pensando?.(true);
        try{
          const d0 = duel;
          const p = await PENSADOR.pensarBatalla(duel, 1-ME, q, cerebro, { semilla:(SEED*197 + duel.turnCount*23) >>> 0, primeraDelTurno:true });
          if(duel !== d0 || d0.finished){ V.pensando?.(false); return; }
          if(p){ r = p; if(p.action === OCG.SelectBattleCMDAction.SELECT_BATTLE) cerebro?.fijarAtaque?.(q, p.index); }
        }catch(e){ logIt("ia_simula_error", { msg:String(e?.message ?? e) }); }
        V.pensando?.(false);
      }
    }
    if(r?.type === OCG.OcgResponseType.SELECT_BATTLECMD && r.action === OCG.SelectBattleCMDAction.SELECT_BATTLE)
      TURNO_ATAQUE = duel.turnCount;
    r ??= decideAI(q,aiAttempt);
    aiAttempt++;
    if(!r){ logIt("ERROR",{msg:"la IA no supo responder a "+msgName(q)}); console.warn("IA sin respuesta",q); return; }
    logIt("ia", { pregunta:msgName(q), respuesta:r });
    cerebro?.anotar?.(q, r);      // si decidió la simulación, el cerebro también tiene que saberlo
    duel.respond(r);
    /* ══ Y LA OTRA MITAD DEL "FREEZE" ══
       Este respiro de 160 ms va DESPUÉS DE CADA respuesta de la IA, y un
       turno suyo puede llevar quince: dos segundos y medio más encima de
       las animaciones. Sirve para que se vea que ha pensado, así que se
       mantiene en las primeras decisiones y se acorta cuando la ráfaga
       se alarga — que es justo cuando ya no aporta nada y solo espera. */
    decisionesSeguidas++;
    await V.sleep(decisionesSeguidas > 6 ? 40 : 160);
  }
}

/* ══ SALA: LO QUE HACE EL ANFITRIÓN DESPUÉS DE CADA PASO DEL MOTOR ══
   Manda el lote (eventos + foto, filtrados para el invitado) y, si el
   motor le pregunta algo al invitado, también la pregunta. Una respuesta
   que el motor no acepta (RETRY) deja el motor esperando la MISMA
   pregunta sin repetirla: se le vuelve a hacer. */
function mandarLoteSala(q){
  const R_ = REMOTO, otro = 1 - ME;
  const evs = R_.eventos.splice(0);
  seguirReveladas(R_.reveladas, evs);
  if(!q && !duel.finished && R_.ultimaQ){ q = R_.ultimaQ; duel.pending = q; logIt("rival_reintenta", {}); }
  R_.sala.enviar({ t:"lote", eventos: eventosPara(evs, duel, otro, R_.reveladas),
                   estado: estadoPara(duel, otro, R_.reveladas) });
  if(q && q.player !== ME && !duel.finished) preguntarSala(q);
  else R_.ultimaQ = null;
  return q;
}
function preguntarSala(q){
  const R_ = REMOTO, otro = 1 - ME;
  R_.ultimaQ = q;
  R_.pregunta = { t:"pregunta", id: ++R_.idPregunta, q: preguntaPara(q, duel, otro, R_.reveladas) };
  R_.respuesta = new Promise(res => { R_.resolver = r => { R_.resolver = null; R_.pregunta = null; res(r); }; });
  R_.sala.enviar(R_.pregunta);
}
function preguntarOtraVezSala(q){
  logIt("rival_respuesta_no_valida", { pregunta:msgName(q) });
  preguntarSala(q);
}
/* La respuesta del invitado, con el reloj. Su navegador contesta solo al
   agotarse su tiempo; si ni así llega nada (colgado, o alguien tocando la
   consola), pasado el margen contesta el anfitrión por él y le avisa
   (`caducada`) para que cierre la pregunta. Un corte de conexión NO corre
   aquí: de eso se encarga la pantalla de la sala (90 s para volver). */
function esperarAlInvitado(q){
  if(!(TIEMPO_SALA > 0)) return REMOTO.respuesta;
  relojSala(TIEMPO_SALA, null, { suyo:true });
  const id = REMOTO.pregunta?.id;
  let t = null;
  const tope = new Promise(res => {
    const armar = () => { t = setTimeout(() => {
      /* Cortado: el reloj se para hasta que vuelva o se dé por perdido. */
      if(REMOTO?.sala?.estado && REMOTO.sala.estado !== "conectado") return armar();
      if(!REMOTO?.pregunta || REMOTO.pregunta.id !== id) return;
      const r = respuestaPorTiempo(q);
      logIt("rival_sin_tiempo", { pregunta:msgName(q) });
      try{ REMOTO.sala.enviar({ t:"caducada", id }); }catch(e){}
      REMOTO.porTiempo = true; REMOTO.jugador = false;
      REMOTO.resolver?.(r);
    }, TIEMPO_SALA * 1000 + margenReloj()); };
    armar();
  });
  return Promise.race([REMOTO.respuesta, tope]).finally(() => clearTimeout(t));
}
/* La respuesta del invitado (la enruta la pantalla de la sala). Solo vale
   la de la pregunta abierta: una que llega tarde o repetida se ignora. */
export function respuestaSala(m){
  if(REMOTO?.rol !== "anfitrion" || !REMOTO.pregunta || m?.id !== REMOTO.pregunta.id) return false;
  REMOTO.porTiempo = !!m.porTiempo; REMOTO.jugador = !!m.jugador;
  REMOTO.resolver?.(m.r);
  return true;
}
/* El invitado ha vuelto tras un corte: la foto entera y la pregunta que
   tuviera abierta. */
export function reenviarSala(){
  if(REMOTO?.rol !== "anfitrion" || !duel || duel.finished) return;
  REMOTO.sala.enviar({ t:"estado", eventos:[], estado: estadoPara(duel, 1 - ME, REMOTO.reveladas) });
  if(REMOTO.pregunta) REMOTO.sala.enviar(REMOTO.pregunta);
}
/* El duelo de sala se acaba sin `win` del motor: el rival se rinde, se
   desconecta del todo o se pierde la conexión con el anfitrión. */
export function terminarPorSala({ ganaste, motivo, cuenta = false }){
  if(!REMOTO || rendido || (duel?.finished && !duel?.esEspejo)) return false;
  if(duel?.esEspejo && (duel.__fin || duel.ganador != null)) return false;
  rendido = true;
  pararReloj();
  logIt("sala_termina", { ganaste, motivo });
  REMOTO.resolver?.(null);
  if(duel?.esEspejo){ duel.__fin = true; duel.cerrar(); }
  V.setHandlers({}); V.markTargets(new Set()); V.markDraggable(new Set());
  V.markUsable(new Set()); V.markAtacadas(new Set()); V.quitarPrevia(false);
  V.closeChoice(); V.closeZoneView(); hidePanel(); V.setControles(null); V.pensando?.(false);
  V.banner(ganaste ? "¡HAS GANADO!" : cuenta ? "HAS PERDIDO" : "DUELO INTERRUMPIDO", ganaste ? "var(--gold)" : "#ff8f7a");
  if(ganaste) globalThis.__TELE__?.dueloTermina(true, duel?.turnCount ?? 0);
  const alTerminar = typeof CONFIG?.alTerminar === "function" ? CONFIG.alTerminar : null;
  setTimeout(() => V.pantallaFinal({
    ganaste, motivo, lpMio:duel?.lp?.[ME], lpRival:duel?.lp?.[1-ME], turnos:duel?.turnCount,
    avatarMio:CONFIG?.avatarMio, avatarRival:CONFIG?.avatarRival, nombreRival:CONFIG?.nombreRival,
    ...(alTerminar ? { textoNuevo:"Continuar", onNuevo: () => alTerminar(ganaste, { ...datosDelFinal(motivo), interrumpido: !ganaste && !cuenta }) } : {}) }), 900);
  return true;
}
export function enSala(){ return !!REMOTO; }

export async function boot({ createCore, Xns, GoatDuel, makeAutoPlayer, makeTrivialResolver,
                             scriptReader, cardsRaw, names, deck, extra, deckRival, extraRival, View, config }){
  V=View; NAMES=names; OCG=Xns; CONFIG=config??null;
  REMOTO = config?.remoto ? { rol: config.remoto.rol, sala: config.remoto.sala, eventos: [],
                              reveladas: new Set(), idPregunta: 0, pregunta: null, resolver: null,
                              respuesta: null, ultimaQ: null } : null;
  const esInvitado = REMOTO?.rol === "invitado";
  TIEMPO_SALA = REMOTO ? Math.max(0, Number(config.remoto.tiempo) || 0) : 0;
  AGOTADOS = { 0:0, 1:0 }; POR_TIEMPO = false; pararReloj();
  if(RELOJ_RONDA_TIC){ clearInterval(RELOJ_RONDA_TIC); RELOJ_RONDA_TIC = null; }
  RELOJ_RONDA = config?.relojRonda?.fin ? { fin: Number(config.relojRonda.fin),
    extra: Math.max(0, Number(config.relojRonda.turnosExtra ?? 3)), contados: null } : null;
  if(RELOJ_RONDA && typeof setInterval === "function")
    RELOJ_RONDA_TIC = setInterval(() => { if(duel && !duel.finished && !rendido) try{ setHUD(duel.turnPlayer, duel.phase); }catch(e){} }, 1000);
  /* Estado del duelo ANTERIOR fuera. En el Reino se juegan varios duelos
     seguidos sin recargar la página y esto se quedaba puesto: la cadena
     "activa", el temporizador de respuesta corriendo y el atacante del
     duelo pasado. */
  chainActive = false;
  if(promptTimer){ clearInterval(promptTimer); promptTimer = null; }
  DECKLOG = null; LOG.length = 0;
  /* ══ Y LA PANTALLA FINAL DEL DUELO ANTERIOR, LA PRIMERA ══
     Se quedaba viva durante la carga del duelo nuevo, con sus botones
     pulsables. «Continuar» resuelve el nodo y cobra la recompensa, así
     que pulsarlo en esa franja daba por ganado el duelo que acababa de
     empezar. Va antes que nada: mientras carga no puede haber un botón
     que decida el resultado de una partida que aún no se ha jugado. */
  V.cerrarFinal?.();
  /* En su sitio, la pantalla de carga de siempre: logo y barra, nada
     que se pueda pulsar. E: «si necesitas tiempo para cargar, pon un
     icono o un logo, pero no los botones». */
  { const b = document.getElementById("boot"); if(b) b.style.display = ""; }
  /* Estado del panel plegado, y la pestaña para volver a abrirlo.
     Con el dedo se DESPLIEGA siempre: quien plegó el panel en una
     versión anterior se quedó con la pestaña debajo de la tira de
     fases y sin forma de recuperarlo. La preferencia guardada no puede
     dejar a nadie encerrado. */
  if(V?.esTactil?.() && plegado()) setPlegado(false);
  document.body.classList.toggle("sinCarril", plegado());
  const pest = document.getElementById("pestana");
  if(pest) pest.onclick = ()=>setPlegado(false);
  // Declarar carta, tipo, atributo o número SÍ es una decisión tuya.
  // Antes se resolvían solas y siempre salía "Pot of Greed".
  AUTO_KINDS = new Set([OCG.OcgMessageType.SELECT_PLACE,
    OCG.OcgMessageType.SELECT_DISFIELD, OCG.OcgMessageType.SORT_CARD]);
  DB_RAW = cardsRaw;
  const cardDb=new Map();
  for(const k in cardsRaw){ const c=cardsRaw[k]; cardDb.set(c.code,{...c,race:BigInt(c.race)}); }
  DB=cardDb;
  /* ══ EL MOTOR TARDA, PERO NO INFINITO ══
     Cargar el wasm es lo único lento del arranque de un duelo. Si por lo
     que sea no resuelve —y ha pasado— la pantalla de carga se queda con
     "Cargando el núcleo de reglas…" para siempre y sin ningún error,
     porque un `await` colgado no lanza nada. Ahora se cuenta el tiempo en
     pantalla y a los 25 segundos se dice que no ha arrancado. */
  const pantallaCarga = document.getElementById("boot");
  const textoCarga = pantallaCarga?.querySelector?.("p");
  const t0 = Date.now();
  /* El invitado no carga motor: su duelo es el espejo de lo que manda el
     anfitrión. Se crea más abajo, cuando ya se sabe de qué lado juega. */
  if(!esInvitado){
  const tic = setInterval(() => {
    if(textoCarga) textoCarga.textContent =
      `${T("Cargando el núcleo de reglas")}… ${Math.round((Date.now()-t0)/1000)}s`;
  }, 1000);
  const limite = setTimeout(() => {
    if(pantallaCarga) pantallaCarga.innerHTML =
      `<div style="color:#ff6a55;max-width:70ch;text-align:center;font:14px/1.6 system-ui">
         <b style="font-size:18px">${T("El motor no ha arrancado")}</b><br><br>
         ${T("El núcleo de reglas no ha terminado de cargar. Recarga la página; si vuelve a pasar, mándale una captura de la consola (F12) a Claude.")}
       </div>`;
  }, 25000);
  let lib;
  try{ lib = await createCore({sync:true}); }
  finally{ clearInterval(tic); clearTimeout(limite); }
  duel=new GoatDuel({ lib, X:OCG, cardDb, scriptReader, onEvent });
  }
  decideAI=makeAutoPlayer(OCG); trivial=makeTrivialResolver(OCG);
  /* ══ UN SOLO NIVEL: EXPERTO ══
     E, 17-09: «no tiene sentido tener varias dificultades; la IA siempre
     en experto». Los niveles bajos no eran "juega un poco peor": eran
     lastres a propósito —gastar todo en cuanto puede, objetivos al azar—
     y el Duelo libre arrancaba en Duro. Medido en 100 partidas: en Duro,
     Book of Moon caía en un monstruo PROPIO 77 veces por 88 en uno del
     rival; en experto, 15. Eso es lo que E vio como «un mono con una
     escopeta». El código de los lastres se queda para las herramientas de
     medida (torneo.mjs, medir-lastres.mjs); el juego ya no lo usa. */
  nivelBot = "experto";
  if(config?.cadenas) chainMode = config.cadenas;
  if(typeof config?.tiempo === "number" && typeof globalThis.GOAT_CHAIN_TIMEOUT !== "number")
    CHAIN_TIMEOUT = config.tiempo;
  /* El sorteo va ANTES de nada: decide de qué lado juegas, y tanto el
     tablero como el cerebro de la IA dependen de eso. Hacerlo después
     dejaba el tablero espejado y a la IA jugando en TU sitio. */
  /* El torneo meta decide quién empieza las partidas 2 y 3 (el que
     perdió la anterior); sin eso, moneda. */
  const empiezasTu = typeof config?.empiezasTu === "boolean" ? config.empiezasTu : Math.random() < 0.5;
  EMPECE = empiezasTu; rendido = false;
  ME = empiezasTu ? 0 : 1;
  logIt("sorteo", { empiezasTu });
  if(esInvitado){
    duel = new DueloEspejo({ yo: ME, onEvent, enviar: m => REMOTO.sala.enviar(m), decklist: deck });
    /* El anfitrión ha contestado por mí (se acabó mi tiempo y mi reloj no
       llegó a tiempo): fuera la pregunta de la pantalla y a seguir. */
    duel.alCaducar = () => {
      if(!enPantalla) return;
      enPantalla = null; idle = null; battle = null; pararReloj();
      V.setHandlers({}); V.markDraggable(new Set()); V.markUsable(new Set()); V.markTargets(new Set());
      hidePanel(); V.setZoneViewClose(null); V.closeZoneView(); V.closeChoice?.(); V.quitarPrevia(false);
      V.toast(T("Tiempo agotado: contesta el juego por ti"));
      loop();
    };
    /* Lo que llegó del anfitrión mientras esto cargaba estaba esperando
       en el buzón de la pantalla de sala; desde ahora va directo. */
    config.remoto.conectarReceptor?.(m => duel.recibir(m));
  }
  // la pantalla de carga tapaba la moneda: hay que quitarla antes
  document.getElementById("boot").style.display="none";
  await View.sorteo(empiezasTu);

  cerebro = REMOTO ? null : crearCerebro({ X:OCG, duel, db:cardDb, names, nivel:nivelBot, yo:1-ME,
    /* El modo draft le pasa el plan con el que se construyó su mazo: draft,
       construcción y partida comparten el modelo (ver src/draft/mazo.js). */
    planFijo: config?.planRival ?? null,
    /* Con el modo depuración encendido, la LECTURA del tablero sale en
       pantalla: es lo que E necesita para saber por qué el bot hace lo
       que hace mientras prueba. Sin depuración no se enseña —sería
       cantarle sus intenciones al rival— pero sigue yendo al log. */
    log: d => { logIt("ia_piensa", d);
                /* E, 19-09: los avisos de lo que la IA piensa («IA simula →
                   heurística: a batalla 1.65») spoilean la partida y no
                   hacen falta para jugar. Solo van al log, detrás del aviso
                   de spoiler del archivo descargado. */ } });
  /* El que simula. Un motor wasm aparte, para no tocar el del duelo. Se
     crea una vez por página: cargarlo cuesta más que usarlo. */
  try{
    PENSADOR = null;
    if(!REMOTO && typeof crearPensador === "function" && globalThis.GOAT_PENSAR !== false){
      PENSADOR = crearPensador({ X:OCG, crearLib: () => (LIB_PENSAR ??= createCore({ sync:true })),
        GoatDuel, crearCerebro, db:cardDb, names, scriptReader,
        /* E, 19-09: «dale 5 o 6 segundos como máximo; el objetivo es que
           juegue lo mejor posible». Con 4 mundos pensaba 0,2 s de media
           (medido en su log): sobraba casi todo el tiempo. Más mundos es
           menos ruido al comparar jugadas; el presupuesto es el techo.
           Los candidatos NO se suben: con 8 midió 33 de 51 contra 37 de 51
           con 6 (mismas semillas). Más opciones ruidosas = más fácil que
           una gane por suerte a la jugada buena. */
        mazosMeta: globalThis.__MAZOS_META__ ?? [], mundos: 12, maxCandidatos: 6,
        presupuestoMs: 5000, ceder: () => new Promise(res => setTimeout(res, 0)),
        traza: t => { logIt("ia_simula", t); } })
        .conPilotos(makeTrivialResolver(OCG), makeAutoPlayer(OCG));
    }
  }catch(e){ PENSADOR = null; logIt("ia_simula_error", { msg:String(e?.message ?? e) }); }
  AUTO_YO = globalThis.GOAT_AUTOJUGAR
    ? crearCerebro({ X:OCG, duel, db:cardDb, names, nivel:"experto", yo:ME }) : null;
  View.initView({ duel, db:cardDb, names, me:ME, images:true });
  /* Las chapas de cuenta (Final Countdown y compañía) viven fuera del
     tablero, así que un duelo nuevo no se las lleva por delante solo. */
  View.limpiarCuentas?.();
  const ZL={gy:16, extra:64, banish:32};
  View.setZoneViewHandler((owner, zone)=>{
    // cementerio y desterradas son información pública; el Extra Deck del
    // rival no: solo puedes mirar el tuyo
    if(zone==="extra" && Number(owner)!==ME){
      V.toast("No puedes ver el Extra Deck del rival"); return;
    }
    const arr=duel.zones[owner][ZL[zone]] ?? [];
    const quien = T(Number(owner)===ME ? "tu" : "del rival");
    const titulo = T(zone==="gy"?"Cementerio" : zone==="extra"?"Extra Deck" : "Cartas desterradas");
    View.openZoneView(`${titulo} ${quien} — ${arr.length} carta(s)`,
      [...arr].reverse());
  });

  const bc=document.getElementById("btnChain");
  const CICLO={auto:"sentido", sentido:"always", always:"nunca", nunca:"auto"};
  const ETIQ_CAD={auto:"Cadenas: automáticas", sentido:"Cadenas: cuando tiene sentido",
                  always:"Cadenas: preguntar siempre", nunca:"Cadenas: no activar nada"};
  const paintChain=()=>{ bc.textContent = T(ETIQ_CAD[chainMode] ?? ETIQ_CAD.auto);
                         bc.classList.toggle("peligro", chainMode==="nunca"); };
  bc.onclick=()=>{ chainMode = CICLO[chainMode] ?? "auto"; paintChain();
                   V.toast(T(ETIQ_CAD[chainMode])); }; paintChain();


  /* Avatares: el tuyo lo eliges en el menú, el rival siempre es Roland. */
  const ponAvatar=(idImg, idNom, a, quien)=>{
    const img=document.getElementById(idImg), nom=document.getElementById(idNom);
    if(img && a?.src){ img.src=a.src; img.alt=a.nombre??""; img.style.display="block"; }
    else if(img) img.style.display="none";
    if(nom && a?.nombre) nom.textContent = quien==="mio" ? a.nombre
      : a.nombre;
  };
  ponAvatar("avMe","nomMe", config?.avatarMio, "mio");
  ponAvatar("avOpp","nomOpp", config?.avatarRival, "rival");

  /* Tocar el panel de detalle abre la carta grande: en el móvil ese panel
     es diminuto y no se puede leer un efecto ahí. */
  const lateral=document.getElementById("side");
  if(lateral) lateral.onclick=()=>V.verUltimaCarta?.();

  const btnR=document.getElementById("btnRendirse");
  if(btnR) btnR.onclick=()=>{
    if(rendido || duel.finished) return;
    V.confirmar("¿Seguro que quieres rendirte?",
      "El duelo termina ahora mismo y cuenta como derrota.", rendirse);
  };

  // botón de emergencia para depurar: fuerza a la IA a pasar
  document.getElementById("btnUnstick").onclick=()=>{
    /* En una sala no hay bot que forzar, y un segundo bucle contestaría
       dos veces a la misma pregunta. */
    if(REMOTO) return;
    V.toast("Forzando avance…"); aiAttempt++; loop();
  };

  MSGNAME=Object.fromEntries(Object.entries(OCG.OcgMessageType).map(([k,v])=>[v,k]));
  /* El log también se puede pedir desde fuera (el Reino lo ofrece en la
     pantalla de resultado, que es cuando de verdad hace falta). */
  globalThis.descargarLog = () => document.getElementById("btnLog")?.onclick?.();
  /* El log, para las comprobaciones: el botón escribe un archivo y en el
     DOM simulado no hay descargas. */
  globalThis.__REGISTRO_DE_PRUEBA__ = () => LOG;
  /* El log YA EN TEXTO: es lo que se lleva el torneo al acabar cada
     partida (`datosDelFinal`), así que hay que poder mirarlo. */
  globalThis.__LOG_TEXTO_DE_PRUEBA__ = () => textoDelLog();
  /* El resumen público: lo que E ve al abrir el archivo del match.
     Ahí no puede aparecer NADA que no se viera en la mesa. */
  globalThis.__RESUMEN_DE_PRUEBA__ = () => textoDelLog({ crudo:false });
  globalThis.__NOMBRES_DE_PRUEBA__ = () => NAMES;
  /* El duelo y de qué lado juegas, para las comprobaciones que necesitan
     declarar un ataque (ver `check-pensar-juego`). */
  globalThis.__DUELO_DE_PRUEBA__ = () => ({ duel, me: ME });
  /* Y el filtro de los avisos de depuración (ver `check-secretos`). */
  globalThis.__SIN_SECRETOS__ = t => sinSecretos(t);
  const btnRep = document.getElementById("btnReportar");
  if(btnRep) btnRep.onclick = () => reportarFallo();
  globalThis.reportarFallo = reportarFallo;
  globalThis.__URL_REPORTE__ = urlDeReporte;
  document.getElementById("btnLog").onclick=()=>{
    const blob=new Blob([textoDelLog()],{type:"text/plain;charset=utf-8"});
    const a=document.createElement("a");
    a.href=URL.createObjectURL(blob);
    a.download=`goat-log-${new Date().toISOString().slice(0,19).replace(/[:T]/g,"-")}.txt`;
    document.body.appendChild(a); a.click(); a.remove();
    V.toast("Log descargado ("+LOG.length+" entradas)");
  };
  /* Barajado. Con `globalThis.GOAT_SEED` puesto, el sorteo y la semilla del
     motor son fijos y el duelo entero es reproducible: hacía falta porque
     las comprobaciones que juegan una partida de verdad sobre el DOM
     simulado dependían del azar y fallaban una de cada cinco veces sin que
     hubiera nada roto. Un test que parpadea deja de mirarse.
     En el navegador la variable no existe y todo sigue siendo aleatorio. */
  const fija = Number(globalThis.GOAT_SEED) || 0;
  let _x = (fija || 1) >>> 0;
  const azar = fija ? ()=>{ _x^=_x<<13; _x^=_x>>>17; _x^=_x<<5;
                            return ((_x>>>0)%100000)/100000; } : Math.random;
  const shuffle=a=>{const b=[...a];for(let i=b.length-1;i>0;i--){const j=azar()*(i+1)|0;[b[i],b[j]]=[b[j],b[i]];}return b;};
  // cada jugador con su propio mazo
  const mioBaraja = shuffle(deck);
  let rivalBaraja = shuffle(deckRival ?? deck);
  /* MANO DE SALIDA DE UN JEFE (modo historia). El orden del array ES el
     orden de robo, así que colocarle su motor arriba le garantiza abrir
     con él. Va DESPUÉS de barajar, evidentemente. No ve tu mano ni roba
     de más: solo se evita que el jefe final abra sin su carta clave y
     juegue con media baraja muerta. */
  if(config?.manoRival && globalThis.Story?.sembrarManoDeJefe)
    rivalBaraja = globalThis.Story.sembrarManoDeJefe(
      rivalBaraja, config.manoRival, { barajar:shuffle }, c => names[c]?.name ?? "");
  const s0 = ME===0 ? mioBaraja : rivalBaraja;
  const s1 = ME===0 ? rivalBaraja : mioBaraja;
  const e0 = ME===0 ? extra : (extraRival ?? extra);
  const e1 = ME===0 ? (extraRival ?? extra) : extra;
  logIt("mazos", { tuyo:config?.nombreMazo, rival:config?.nombreRival });
  /* Qué se juega y a qué nivel. `nombreMazo` es "Reino" en el modo
     historia y el nombre del mazo en el duelo libre, así que las dos
     cosas se separan solas. */
  globalThis.__TELE__?.dueloEmpieza(
    REMOTO ? "room" : config?.nombreMazo === "Reino" ? "kingdom" : "free",
    config?.nivel ?? "?", config?.nombreMazo);
  SEED = fija || ((Date.now()&0xffff)+1);
  DECKLOG={ tu:mioBaraja, rival:rivalBaraja };
  if(esInvitado){
    /* El invitado no baraja ni crea nada: el anfitrión lo hace todo. Su
       semilla y sus mazos barajados no los conoce (ni debe). */
    SEED = null; DECKLOG = null;
    View.layoutAll(true);
    document.getElementById("boot").style.display="none";
    await loop();
    return;
  }
  await duel.create({ deck0:s0, deck1:s1, extra0:e0, extra1:e1,
    seed:GoatDuel.semillaMotor(SEED),
    /* ══ LOS PUNTOS DE VIDA VAN POR LADO ══
       El campamento del Reino da vida extra AL JUGADOR, pero esto ponía
       un solo `lp` para los dos: el buff se lo llevaba también el rival
       y por tanto no servía absolutamente de nada. Y por el otro lado,
       `lpRival` es el mando de dificultad del jefe final: no puede ser
       "que juegue mejor" —ya juega en experto— ni hacer trampa.
       ME dice de qué lado juegas tú tras el sorteo. */
    lp0: ME===0 ? (config?.lpIniciales ?? 8000) : (config?.lpRival ?? 8000),
    lp1: ME===0 ? (config?.lpRival ?? 8000) : (config?.lpIniciales ?? 8000),
    /* Y la mano de salida, también por lado: Pegasus abre con siete. */
    mano0: ME===0 ? 5 : (config?.manoRivalCuantas ?? 5),
    mano1: ME===0 ? (config?.manoRivalCuantas ?? 5) : 5 });
  View.layoutAll(true);
  document.getElementById("boot").style.display="none";
  await loop();
}

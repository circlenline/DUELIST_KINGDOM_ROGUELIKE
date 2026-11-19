/* ══════════════════════════════════════════════════════════════════
   TORNEO (el Bo3 de tu mesa y el suizo alrededor)

   1. La LÓGICA del Bo3 (src/torneo.js), en node tal cual: quién empieza
      cada partida, cuándo se decide un match, abandonar, side deck,
      estadísticas y un estado guardado roto. Las reglas del suizo
      (emparejar, desempates, corte) las prueba `check-suizo.mjs`.
   2. La PANTALLA del torneo suizo en el HTML construido, pulsando:
      inscripción, tu mesa en EXPERTO con quien empieza bien puesto,
      side deck, abandonar, las cinco rondas, el corte, el cuadro, la
      final, retirarse y volver otro día con el torneo a medias.
   3. Que rendirse cuente como derrota donde hay algo que apuntar.

   Uso: node check-torneo.mjs
   ══════════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync } from "node:fs";
import * as TL from "./src/torneo.js";

let fallos = 0;
const ok  = t => console.log("  ✓ " + t);
const mal = (t,d="") => { fallos++; console.log("  ✗ " + t + (d ? "   " + d : "")); };
const es = (cond, t, d) => cond ? ok(t) : mal(t, d);
console.log("\n═══ TORNEO · Bo3 y suizo ═══\n");

/* ── 1 · lógica ── */
{
  const t = TL.nuevoTorneo(1);
  TL.empezarRonda(t, { miMazo:"i0", mazoIA:"i3", nombreMio:"Goat Control", nombreIA:"Chaos Turbo" });
  es(TL.empiezoYo(t) === null, "partida 1: moneda");
  TL.apuntarPartida(t, { gane:false, empece:true });
  es(TL.empiezoYo(t) === true, "pierdo la 1 → empiezo la 2");
  TL.apuntarPartida(t, { gane:true, empece:true });
  es(TL.empiezoYo(t) === false, "gano la 2 → empieza la IA la 3");
  es(!!t.actual && !TL.rondaDecidida(t.actual), "a 1-1 la ronda sigue abierta");
  TL.apuntarPartida(t, { gane:true, empece:false });
  es(t.actual === null && t.rondas.length === 1 && t.rondas[0].resultado === "victoria",
     "a 2-1 la ronda se cierra como victoria");
  let lanzo = false; try{ TL.apuntarPartida(t, { gane:true }); }catch(e){ lanzo = true; }
  es(lanzo, "no se apunta una partida sin ronda en juego");

  TL.empezarRonda(t, { miMazo:"i0", mazoIA:"i3" });
  TL.apuntarPartida(t, { gane:false, empece:false });
  TL.apuntarPartida(t, { gane:false, empece:true });
  es(t.rondas[1]?.resultado === "derrota", "0-2 es derrota y no hay partida 3");
  TL.empezarRonda(t, { miMazo:"i1", mazoIA:"i2" });
  TL.apuntarPartida(t, { gane:true, empece:true });
  TL.abandonarRonda(t);
  es(t.rondas[2]?.resultado === "abandonada", "abandonar deja la ronda apuntada");
  const s = TL.estadisticas(t);
  es(s.matches.ganados===1 && s.matches.perdidos===1 && s.matches.abandonados===1,
     "estadísticas de matches", JSON.stringify(s.matches));
  es(s.partidas.ganadas===3 && s.partidas.perdidas===3, "estadísticas de partidas", JSON.stringify(s.partidas));
  es(s.empezando.jugadas===4 && s.robando.jugadas===2, "empezando / robando se cuentan aparte",
     JSON.stringify([s.empezando, s.robando]));
  const txt = TL.resumenTexto(t);
  es(/Ronda 1 .*2-1/.test(txt) && /Ronda 2 .*0-2/.test(txt), "el resumen de texto lleva cada ronda");

  es(TL.sanearTorneo("basura").rondas.length === 0, "un estado guardado roto no rompe nada");
  const raro = TL.sanearTorneo({ rondas:[{ miMazo:"i0", mazoIA:"i1", partidas:[{gane:"sí"}] }], actual:{} });
  es(raro.rondas.length === 0 && raro.actual === null, "y lo que no se entiende se descarta");
}

/* ── 1b · side deck: las reglas de un torneo ── */
{
  const reg = { main:Array.from({length:40}, (_,i) => 100 + (i % 20)), extra:[], side:[900,900,901,902,903] };
  const t = TL.nuevoTorneo(1);
  TL.empezarRonda(t, { miMazo:"u0", mazoIA:"i3", mazos:{ mio:reg, ia:{ main:reg.main, extra:[], side:[] } } });
  es(t.actual.registro.mio.side.length === 5 && t.actual.mio.main.length === 40,
     "la ronda guarda el mazo registrado y con el que se juega");

  const cambio = { main:[...reg.main.slice(0, 38), 900, 901], side:[reg.main[38], reg.main[39], 900, 902, 903] };
  es(TL.sideValido(reg, cambio).ok, "mover cartas entre main y side vale", JSON.stringify(TL.sideValido(reg, cambio)));
  TL.aplicarSide(t, "mio", cambio);
  es(t.actual.mio.main.includes(900) && t.actual.mio.main.length === 40, "y se aplica al mazo de la ronda");
  es(t.actual.registro.mio.main.includes(900) === false, "sin tocar el registrado");

  es(!TL.sideValido(reg, { main:reg.main.slice(0, 39), side:[...reg.side, reg.main[39]] }).ok,
     "un Main de 39 no vale");
  es(!TL.sideValido(reg, { main:[...reg.main], side:[...reg.side, 999] }).ok,
     "meter una carta que no registraste no vale");
  es(!TL.sideValido(reg, { main:[...reg.main, ...reg.side], side:[] }).ok === false,
     "pero subirlo todo al Main sí, mientras sean las mismas cartas");
  let reventó = false;
  try{ TL.aplicarSide(t, "mio", { main:reg.main.slice(0, 30), side:reg.side }); }catch(e){ reventó = true; }
  es(reventó, "aplicar un reparto ilegal lanza error y no cambia nada");
}

/* ── 1c · el side deck de la IA ── */
{
  const { planDeSide, diagnosticar, INTOCABLES } = await import("./src/ai/side.js");
  const { readFileSync } = await import("node:fs");
  const NAMES = JSON.parse(readFileSync("./out/names.subset.json","utf-8"));
  const CARDS = JSON.parse(readFileSync("./out/cards.subset.json","utf-8"));
  const MAZOS = JSON.parse(readFileSync("../data/mazos.json","utf-8"));
  const { valorCarta } = await import("./src/ai/evaluar.js");
  const { planDe } = await import("./src/ai/plan.js");
  const base = n => String(n||"").replace(/\s*\((GOAT|Pre-Errata|Anime)\)\s*$/i,"").trim();
  const info = code => { const d = CARDS[code]; if(!d) return null;
    return { nombre:base(NAMES[code]?.name ?? ""), atk:d.attack ?? 0,
             monstruo:!!(d.type&1), magia:!!(d.type&2), trampa:!!(d.type&4) }; };
  const codigoDe = nombre => Object.keys(NAMES).map(Number).find(c => base(NAMES[c].name) === nombre);
  es(MAZOS.every(m => (m.side ?? []).length === 15), "los 20 mazos meta tienen side deck de 15");

  const mz = MAZOS[0];
  const plan = planDe(mz.main, NAMES);
  const valor = code => valorCarta({ nombre:NAMES[code]?.name ?? "", datos:CARDS[code] })
                      + plan.peso(NAMES[code]?.name ?? "") * 1.5;
  const registro = { main:mz.main, extra:mz.extra, side:mz.side };
  const vistas = n => n.map(codigoDe).filter(Boolean);

  const contraQuema = planDeSide({ registro, actual:null, info, valor,
    vistas: vistas(["Just Desserts","Wave-Motion Cannon","Secret Barrel","Stealth Bird"]) });
  const nombres = c => c.map(x => base(NAMES[x.entra]?.name ?? ""));
  es(nombres(contraQuema.cambios).includes("Des Wombat"), "contra quema mete Des Wombat",
     JSON.stringify(nombres(contraQuema.cambios)));

  const contraChaos = planDeSide({ registro, actual:null, info, valor,
    vistas: vistas(["Black Luster Soldier - Envoy of the Beginning","Chaos Sorcerer","Sinister Serpent"]) });
  es(nombres(contraChaos.cambios).some(n => n === "Soul Release" || n === "Kycoo the Ghost Destroyer"),
     "contra Chaos mete odio al cementerio", JSON.stringify(nombres(contraChaos.cambios)));

  for(const p2 of [contraQuema, contraChaos]){
    es(TL.sideValido(registro, { main:p2.main, side:p2.side, extra:mz.extra }).ok,
       "el reparto que propone la IA es legal", JSON.stringify(TL.sideValido(registro, { main:p2.main, side:p2.side, extra:mz.extra })));
    /* Excepción (Science of Sideboarding Pt.2): Nobleman sale contra un
       mazo de quema, que no coloca monstruos. */
    const saleBien = n => !INTOCABLES.has(n) || (p2 === contraQuema && n === "Nobleman of Crossout");
    es(p2.cambios.every(c => saleBien(base(NAMES[c.sale]?.name ?? ""))),
       "y no se quita las cartas que sostienen el mazo",
       JSON.stringify(p2.cambios.map(c => base(NAMES[c.sale]?.name ?? ""))));
  }
  es(contraChaos.cambios.length <= 2, "contra Chaos Turbo cambia lo mínimo (Sideboarding Pt.1)", String(contraChaos.cambios.length));
  const contraGoat = planDeSide({ registro, actual:null, info, valor,
    vistas: vistas(["Scapegoat","Metamorphosis","Thousand-Eyes Restrict","Airknight Parshath"]) });
  es(contraGoat.arquetipo === "goat", "reconoce Goat Control", String(contraGoat.arquetipo));
  const sinNada = planDeSide({ registro, actual:null, info, valor, vistas:[] });
  es(sinNada.cambios.length === 0, "sin haber visto nada, no cambia nada");
}

/* ── 1d · empezar un torneo de cero ──
   Lo pidió E: al perder un match, el marcador vuelve a cero. Pero sin
   tirar nada: las notas y los mazos registrados de lo jugado se quedan. */
{
  const t = TL.nuevoTorneo(1000);
  const jugar = (mio, ia, res) => {
    TL.empezarRonda(t, { miMazo:mio, mazoIA:ia, mazos:{ mio:{main:[],extra:[],side:[]},
                                                        ia:{main:[],extra:[],side:[]} } });
    t.actual.notas = `notas de ${mio}`;
    for(const g of res) TL.apuntarPartida(t, { gane:g });
  };
  jugar("a","b",[false,false]);
  es(TL.estadisticas(t).matches.perdidos === 1, "el match perdido cuenta");
  es(t.rondas[0].numero === 1 && TL.tandaDe(t.rondas[0]) === 1, "la ronda es la 1 del torneo 1");

  TL.nuevaTanda(t);
  const s2 = TL.estadisticas(t);
  es(s2.matches.perdidos === 0 && s2.partidas.perdidas === 0, "torneo nuevo: el marcador a cero",
     JSON.stringify(s2.matches));
  es(t.rondas.length === 1 && t.rondas[0].notas === "notas de a",
     "pero lo jugado sigue ahí, con sus notas");

  jugar("c","d",[true,true]);
  es(t.rondas[1].numero === 1 && TL.tandaDe(t.rondas[1]) === 2,
     "las rondas se numeran otra vez desde 1", `${t.rondas[1].numero}/${TL.tandaDe(t.rondas[1])}`);
  es(TL.claveRonda(t.rondas[0]) !== TL.claveRonda(t.rondas[1]),
     "y aun así cada ronda tiene su clave (el log de una no pisa el de la otra)");
  es(TL.estadisticas(t).matches.ganados === 1 && TL.estadisticas(t).matches.perdidos === 0,
     "el marcador es el del torneo en juego");
  const txt = TL.resumenTexto(t);
  es(/notas de a/.test(txt) && /notas de c/.test(txt), "el resumen descargado los lleva los dos");

  /* Con una ronda a medias: se da por abandonada, no se queda colgada. */
  TL.empezarRonda(t, { miMazo:"e", mazoIA:"f" });
  TL.nuevaTanda(t);
  es(t.actual === null && t.rondas.at(-1).resultado === "abandonada",
     "una ronda a medias queda abandonada, no colgada");

  /* Un torneo guardado antes de que existieran las tandas es la 1. */
  const viejo = TL.sanearTorneo({ rondas:[{ miMazo:"a", mazoIA:"b", partidas:[] }], actual:null });
  es((viejo.tanda ?? 0) === 1 && TL.tandaDe(viejo.rondas[0]) === 1,
     "un torneo guardado sin tandas es el torneo 1");
}

/* Un IndexedDB mínimo en memoria, COMPARTIDO por los dos arranques del
   bundle de abajo: el segundo arranque es «volver otro día». Solo lo que
   usa el juego (open, get, put, getAll, getAllKeys, delete, clear), con
   las respuestas asíncronas y en orden, como el de verdad. */
function idbFalso(){
  const bases = new Map();
  const pedir = fn => { const r = { result:undefined };
    setTimeout(() => { try{ r.result = fn(); r.onsuccess?.({ target:r }); }catch(e){ r.error = e; r.onerror?.(e); } }, 0);
    return r; };
  return { _bases:bases, open(nombre){
    const r = { result:null };
    setTimeout(() => {
      const nueva = !bases.has(nombre);
      if(nueva) bases.set(nombre, new Map());
      const almacenes = bases.get(nombre);
      r.result = {
        createObjectStore(n){ almacenes.set(n, new Map()); },
        transaction(n){ return { objectStore(){ const m = almacenes.get(n); return {
          get: k => pedir(() => structuredClone(m.get(k))),
          put: (v, k) => pedir(() => { m.set(k, structuredClone(v)); }),
          getAll: () => pedir(() => [...m.values()].map(x => structuredClone(x))),
          getAllKeys: () => pedir(() => [...m.keys()]),
          delete: k => pedir(() => m.delete(k)),
          clear: () => pedir(() => m.clear()) }; } }; } };
      if(nueva) r.onupgradeneeded?.();
      r.onsuccess?.();
    }, 0);
    return r; } };
}
globalThis.indexedDB = idbFalso();

/* ── 2 · la pantalla: el torneo suizo, pulsando ──
   Inscripción → tu mesa al mejor de tres (moneda, empieza quien pierde,
   side deck) → resultados de la ronda → siguiente ronda → corte → cuadro
   → final. Sin cuadro de notas: solo un «Descargar log» discreto. */
let GUARDADO_A_MEDIAS = null, CLAVE_R1 = null;
{
  const { installDOM } = await import("./domstub.mjs");
  globalThis.GOAT_SEED = 20050401; installDOM();
  globalThis.GOAT_SEMILLA_SUIZO = "PRUEBA-SUIZO";
  globalThis.matchMedia = q => ({ matches:false, media:q, addListener(){}, removeListener(){} });
  globalThis.innerWidth = 1280;
  globalThis.confirm = () => true;
  const mem = new Map();
  global.localStorage = {
    getItem: k => k === "goatConfig" ? '{"idioma":"es"}' : (mem.get(k) ?? null),
    setItem: (k,v) => mem.set(k,v), removeItem: k => mem.delete(k),
  };
  const html = readFileSync("./out/goat.html","utf-8");
  writeFileSync("./out/_torneo.mjs", html.match(/<script type="module">([\s\S]*?)<\/script>/)[1]);
  console.warn = () => {};
  await import("./out/_torneo.mjs");
  await new Promise(r => setTimeout(r, 300));

  /* Los nodos se buscan RECORRIENDO la caja: `getElementById` del DOM
     simulado crea un fantasma si no lo encuentra (ver CLAUDE.md). */
  const todosN = (n, o=[]) => { if(!n) return o; o.push(n); for(const h of (n.children ?? [])) todosN(h, o); return o; };
  /* La raíz es `tSuizo`: el DOM simulado no cuelga del HTML los nodos
     del template, solo los creados con createElement. */
  const caja = () => document.getElementById("tSuizo");
  const nodo = id => todosN(caja()).find(x => x.id === id);
  const texto = () => todosN(caja()).map(x => String(x.textContent ?? "") + " " + String(x.innerHTML ?? "")).join(" ");
  es(/id="irTorneo"/.test(html) && /id="pTorneo"/.test(html), "el menú tiene la entrada y la pantalla del torneo");
  es(/Torneo suizo/.test(html), "y se llama «Torneo suizo»");
  es(/"[0-9]+-[0-9]+":\{"gana"/.test(html), "la tabla de cruces va dentro del HTML");
  const P = globalThis.__PRUEBA_TORNEO__;
  if(!P){ mal("hay gancho de prueba del torneo"); }
  else {
    document.getElementById("irTorneo").onclick?.();
    es(document.getElementById("pTorneo").hidden === false, "«Torneo suizo» abre su pantalla");
    es(!!nodo("tInscribir") && !!nodo("tMiMazo"), "sin torneo, sale la inscripción: mazo y botón");
    es(!!nodo("tAvatares"), "y deja elegir tu avatar (19-11)");
    const pedidos = [];
    globalThis.__LANZAR_TORNEO__ = p => pedidos.push(p);
    const tandaAntes = P.estado.tanda ?? 1;

    P.inscribir("i0", "Probador");
    const S = P.suizo;
    es(S?.jugadores?.length === 32 && S.jugadores.filter(j => j.yo).length === 1, "inscribirse crea un torneo de 32 contigo dentro");
    es(S?.jugadores[0].nombre === "Probador" && S.registro?.main?.length >= 40 && S.registro?.side?.length === 15,
       "con tu nombre y el mazo registrado (main y side)");
    es((P.estado.tanda ?? 1) === tandaAntes + 1, "y tus matches van en una tanda nueva");
    es(S?.rondas?.length === 1 && S.rondas[0].length === 16, "ronda 1: 16 mesas");
    es(!!JSON.parse(mem.get("goat.suizo.v1") ?? "null")?.jugadores, "el torneo queda guardado");
    es(/Mesa/.test(texto()) && !!nodo("tJugar"), "la pantalla enseña tu mesa con el botón de jugar");
    es(!todosN(caja()).some(x => x.tagName === "textarea"), "y no hay cuadro de notas");

    const rival1 = texto();
    const jugar = () => { const b = nodo("tJugar"); if(!b) mal("hay botón de jugar la partida siguiente"); b?.onclick?.(); };
    jugar();
    const c1 = pedidos.at(-1)?.config;
    es(c1?.nivel === "experto", "la IA juega en experto", `nivel ${c1?.nivel}`);
    es(c1 && !("empiezasTu" in c1), "partida 1 con moneda");
    es(pedidos.at(-1)?.deckRival?.length >= 40, "con el mazo del rival de tu mesa");
    const yo = S.jugadores.find(j => j.yo), m1 = S.rondas[0].find(m => m.a === yo.id || m.b === yo.id);
    const riv1 = S.jugadores.find(j => j.id === (m1.a === yo.id ? m1.b : m1.a));
    es(c1?.nombreRival === riv1.nombre && rival1.includes(riv1.nombre), "contra el bot que te ha tocado, por su nombre");
    /* 19-11, la comunidad: «siempre eres Yugi y el rival siempre Fake Kaiba
       o Roland». Cada bot lleva su cara, y no es ni la tuya ni la de Roland. */
    const caras = new Set(S.jugadores.filter(j => !j.yo).map(j => j.avatar));
    es(S.jugadores.filter(j => !j.yo).every(j => j.avatar && j.avatar !== "roland" && j.avatar !== yo.avatar) && caras.size >= 20,
       "cada bot lleva su cara (ni la tuya ni la de Roland)", `${caras.size} caras distintas`);
    es(!!riv1.avatar && c1?.avatarRival?.src === P.avatarSrc(riv1.avatar) && c1.avatarRival.src !== P.avatarSrc("roland"),
       "y el duelo lleva la cara de ese bot");
    es(P.estado.actual?.suizo && P.estado.actual?.registro?.mio?.side?.length === 15, "el match lleva su mesa y tu mazo registrado");

    c1.alTerminar(false, { empece:true, turnos:9, lpMio:0, lpRival:5200, log:"REGISTRO PARTIDA 1" });
    es(P.estado.actual?.partidas.length === 1, "al terminar se apunta la partida");
    es(document.getElementById("pTorneo").hidden === false && document.getElementById("menu").style.display === "", "y se vuelve a la pantalla del torneo");
    es(!!todosN(caja()).find(x => x.className === "tLogLink"), "con un «Descargar log» discreto");
    jugar();
    es(pedidos.at(-1)?.config?.empiezasTu === true, "perdí la 1: empiezo la 2");
    pedidos.at(-1).config.alTerminar(true, { empece:true, turnos:14, log:"REGISTRO PARTIDA 2" });
    jugar();
    es(pedidos.at(-1)?.config?.empiezasTu === false, "gané la 2: empieza el rival la 3");
    pedidos.at(-1).config.alTerminar(true, { empece:false, turnos:20, log:"REGISTRO PARTIDA 3" });
    es(P.estado.actual === null && P.estado.rondas.at(-1)?.resultado === "victoria", "2-1: match ganado y cerrado");
    const r1 = P.estado.rondas.at(-1); CLAVE_R1 = r1.suizo;
    const S1 = P.suizo, m1b = S1.rondas[0].find(m => m.a === yo.id || m.b === yo.id);
    es(m1b.res && (m1b.a === yo.id ? m1b.res.ga === 2 && m1b.res.gb === 1 : m1b.res.gb === 2 && m1b.res.ga === 1),
       "el 2-1 pasa al torneo con sus partidas", JSON.stringify(m1b.res));
    es(S1.rondas[0].every(m => m.res), "y las otras quince mesas se juegan solas");
    es(/Has ganado/.test(texto()) && /2-1/.test(texto()), "la pantalla dice cómo quedó tu match");
    es(!!nodo("tSiguiente") && !!nodo("tClasif"), "con la clasificación y el botón de la ronda siguiente");
    es(P.logs(r1).length === 3, "el torneo se queda con el registro de las tres partidas", `guardados ${P.logs(r1).length}`);
    const txt = P.textoMatch(r1);
    es(/REGISTRO PARTIDA 1/.test(txt) && /REGISTRO PARTIDA 3/.test(txt) && /Torneo suizo/.test(txt) && /2-1/.test(txt),
       "el log del match lleva el marcador y el registro de las tres");
    es(!/Notas:/.test(txt), "sin apartado de notas");

    nodo("tSiguiente").onclick();
    const S2 = P.suizo, m2 = S2.rondas[1]?.find(m => m.a === yo.id || m.b === yo.id);
    es(S2.ronda === 2 && !!m2 && !m2.res, "siguiente ronda: la 2, con mesa nueva");
    const riv2 = m2 && (m2.a === yo.id ? m2.b : m2.a);
    es(riv2 !== riv1.id, "contra otro rival");

    /* ── el side deck, pulsando ── */
    jugar(); pedidos.at(-1).config.alTerminar(false, { empece:true, turnos:8, log:"R2 P1" });
    GUARDADO_A_MEDIAS = new Map(mem);
    const botones = () => todosN(document.getElementById("tRonda")).filter(x => x.tagName === "button");
    const bSide = todosN(caja()).filter(x => x.tagName === "button").find(b => /side/i.test(b.textContent ?? ""));
    if(!bSide) mal("entre partidas hay botón de side deck");
    else {
      ok("entre partidas hay botón de side deck");
      bSide.onclick?.();
      const rejillas = todosN(document.getElementById("tSide")).filter(x => x.className === "sdRej");
      es(rejillas.length === 2, "el side deck enseña Main y Side", `rejillas ${rejillas.length}`);
      const antesMain = P.estado.actual.mio.main.length;
      todosN(rejillas[0]).find(x => x.className === "sdC")?.onclick?.();
      const rej2 = todosN(document.getElementById("tSide")).filter(x => x.className === "sdRej");
      todosN(rej2[1]).find(x => x.className === "sdC")?.onclick?.();
      todosN(document.getElementById("tSide")).filter(x => x.tagName === "button")
        .find(b => /listo|done/i.test(b.textContent ?? ""))?.onclick?.();
      const r = P.estado.actual;
      es(r.mio.main.length === antesMain && r.mio.side.length === 15, "se aplica el cambio y el mazo sigue siendo legal",
         `main ${r.mio.main.length} side ${r.mio.side.length}`);
      es(JSON.parse(mem.get("goat.torneo.v1") ?? "{}").actual?.mio?.main?.length === antesMain, "y queda guardado");
    }

    /* ── abandonar el match cuenta como derrota ── */
    const bAb = todosN(caja()).filter(x => x.tagName === "button").find(b => /Abandonar el match/.test(b.textContent ?? ""));
    bAb?.onclick?.();
    const reg2 = P.suizo.rondas[1].find(m => m.a === yo.id || m.b === yo.id).res;
    es(!!bAb && reg2 && (m2.a === yo.id ? reg2.ga < reg2.gb : reg2.gb < reg2.ga), "abandonar el match lo pierde", JSON.stringify(reg2));

    /* ── ganar las tres rondas que quedan y llegar al corte ── */
    const ganarMatch = () => { jugar(); pedidos.at(-1).config.alTerminar(true, {}); jugar(); pedidos.at(-1).config.alTerminar(true, {}); };
    for(let k = 3; k <= 5; k++){ nodo("tSiguiente")?.onclick(); ganarMatch(); }
    const S5 = P.suizo;
    es(S5.ronda === 5 && S5.rondas.length === 5 && S5.rondas.every(r => r.every(m => m.res)), "cinco rondas suizas jugadas");
    es(/Ver el corte/.test(texto()), "tras la quinta, el botón lleva al corte");
    nodo("tSiguiente").onclick();
    es(P.suizo.fase === "corte" && P.suizo.top?.includes(yo.id), "con 4-1 entras en el top 16");
    es(!!nodo("tCuadroCaja") && /Octavos/.test(texto()), "y sale el cuadro, en octavos");
    jugar(); pedidos.at(-1).config.alTerminar(false, {}); jugar(); pedidos.at(-1).config.alTerminar(false, {});
    es(!!nodo("tHastaFinal") && /Has perdido/.test(texto()), "perder en octavos te saca, y puedes simular hasta el final");
    nodo("tHastaFinal").onclick();
    const Sf = P.suizo;
    es(Sf.fase === "fin" && Sf.campeon != null && Sf.cuadro.map(r => r.length).join() === "8,4,2,1", "el torneo acaba con campeón");
    es(!!nodo("tFinal") && /Campeón/.test(texto()) && /9-16/.test(texto()), "la pantalla final: campeón y tu puesto (9-16)");
    es(/Mazos del top 16/.test(texto()), "y el desglose de mazos del top 16");
    nodo("tNuevoTorneo").onclick();
    es(P.suizo === null && !!nodo("tInscribir"), "«Nuevo torneo» vuelve a la inscripción");

    /* ── con el modo depuración: ganar o perder sin jugar ── */
    es(!nodo("tGanarPrueba"), "sin depuración no hay botones de ganar o perder sin jugar");
    globalThis.__DEPURACION__ = true;
    P.inscribir("i0", "Probador");
    es(!!nodo("tGanarPrueba") && !!nodo("tPerderPrueba"), "con depuración, la mesa tiene «Ganar / Perder sin jugar»");
    const nPed = pedidos.length;
    nodo("tGanarPrueba").onclick(); nodo("tGanarPrueba").onclick();
    const Sd = P.suizo, md = Sd.rondas[0].find(m => m.a === 0 || m.b === 0);
    es(pedidos.length === nPed && md.res && (md.a === 0 ? md.res.ga === 2 : md.res.gb === 2), "dos clics ganan el match 2-0 sin arrancar ningún duelo");
    nodo("tSiguiente").onclick(); nodo("tPerderPrueba").onclick();
    es(P.estado.actual?.partidas?.length === 1 && P.estado.actual.partidas[0].gane === false, "y «Perder» apunta una partida perdida");
    globalThis.__DEPURACION__ = false;
    nodo("tNuevoTorneo").onclick();

    /* ── retirarse ── */
    P.inscribir("i3", "Probador");
    P.retirarme();
    es(P.suizo.abandono && !!nodo("tHastaFinal"), "retirarte deja el torneo jugándose sin ti");
    nodo("tHastaFinal").onclick();
    const rr = P.suizo;
    const reg = (() => { let g=0,p=0; for(const m of rr.rondas.flat()){ if(m.a!==0&&m.b!==0) continue; const mio = m.a===0?m.res.ga:m.res.gb, suyo = m.a===0?m.res.gb:m.res.ga; mio>suyo?g++:p++; } return [g,p]; })();
    es(rr.fase === "fin" && reg.join("-") === "0-5", "y acaba con tus cinco rondas perdidas", reg.join("-"));
  }
}

/* Antes de «volver otro día», que lo del primer día haya llegado a
   IndexedDB: las escrituras son asíncronas. */
for(let n = 0; n < 60; n++){
  const filas = [...(globalThis.indexedDB._bases?.get("goat-torneo-logs")?.get("rondas")?.values() ?? [])];
  if(filas.some(f => (f?.logs ?? []).filter(Boolean).length >= 3)) break;
  await new Promise(r => setTimeout(r, 50));
}

/* ── 2d · ARRANCAR CON UN TORNEO A MEDIAS ──
   El fallo que reportó E con el modo anterior: «los botones no hacen
   nada». `pintarMenu()` corre al evaluar el script y pinta ya la pantalla
   del torneo, así que todo lo que use esa pintada tiene que existir en
   ese momento. Aquí se arranca el bundle OTRA VEZ con el torneo guardado
   en la ronda 2, a mitad del match, y se mira que todo siga vivo. */
{
  const { installDOM } = await import("./domstub.mjs");
  globalThis.GOAT_SEED = 20050401; installDOM();
  globalThis.matchMedia = q => ({ matches:false, media:q, addListener(){}, removeListener(){} });
  globalThis.innerWidth = 1280;
  const mem = new Map(GUARDADO_A_MEDIAS ?? []);
  global.localStorage = {
    getItem: k => k === "goatConfig" ? '{"idioma":"es"}' : (mem.get(k) ?? null),
    setItem: (k,v) => mem.set(k,v), removeItem: k => mem.delete(k),
  };
  const html = readFileSync("./out/goat.html","utf-8");
  /* Otro nombre de archivo para que node lo EVALÚE de nuevo. */
  writeFileSync("./out/_torneo2.mjs", html.match(/<script type="module">([\s\S]*?)<\/script>/)[1]);
  let arrancó = true, error = "";
  try{ await import("./out/_torneo2.mjs"); await new Promise(r => setTimeout(r, 300)); }
  catch(e){ arrancó = false; error = String(e?.message ?? e); }
  es(arrancó, "arranca con un torneo a medias sin reventar", error);
  const todos2 = (n, o=[]) => { if(!n) return o; o.push(n); for(const h of (n.children ?? [])) todos2(h, o); return o; };
  es(typeof document.getElementById("mJugar")?.onclick === "function", "…y el menú se queda cableado (Duelo libre responde)");
  es(typeof document.getElementById("irTorneo")?.onclick === "function", "…y la entrada del torneo también");
  const P2 = globalThis.__PRUEBA_TORNEO__;
  es(P2?.suizo?.ronda === 2 && P2?.estado?.actual?.partidas?.length === 1, "…con el torneo en la ronda 2 y el match a 0-1");
  const bJ = todos2(document.getElementById("tSuizo")).find(x => x.id === "tJugar");
  es(!!bJ && /2/.test(bJ.textContent ?? ""), "…y la mesa se pinta con «Jugar partida 2»");
  /* ── 2e · VOLVER OTRO DÍA: los logs del match de la ronda 1 siguen ahí ── */
  const r1 = P2?.estado?.rondas?.find(r => r.suizo === CLAVE_R1);
  for(let n = 0; n < 60 && !(P2?.logs(r1) ?? []).some(Boolean); n++) await new Promise(r => setTimeout(r, 50));
  const logs = (r1 && P2.logs(r1)) ?? [];
  es(logs.filter(Boolean).length === 3 && /REGISTRO PARTIDA 2/.test(logs[1] ?? ""),
     "al volver otro día, los tres registros del match de la ronda 1 siguen ahí y en su orden",
     `recuperados ${logs.filter(Boolean).length}`);
  es(/REGISTRO PARTIDA 2/.test(P2?.textoMatch(r1) ?? ""), "…y entran en el log descargado");
}

/* ── 3a · AL EMPEZAR UN DUELO, LA PANTALLA COMPLETA NO SE QUITA ──
   E, 03-10: en el móvil, cada duelo nuevo le sacaba de pantalla completa
   (se llamaba al botón ⛶, que conmuta) y el teléfono giraba. */
{
  const t = readFileSync("./src/template.html", "utf-8");
  const llamadas = [...t.matchAll(/<900\)\s*\n\s*(\w+)\(\);/g)].map(m => m[1]);
  es(llamadas.length >= 3 && llamadas.every(f => f === "asegurarPantallaCompleta"),
     "los duelos entran en pantalla completa sin conmutarla", llamadas.join(","));
}

/* ── 3 · rendirse cuenta ── */
{
  const main = readFileSync("./src/main.js","utf-8");
  const cuerpo = main.slice(main.indexOf("function rendirse"), main.indexOf("/* ── bucle ── */"));
  es(/alTerminar\(false/.test(cuerpo), "rendirse llega a `alTerminar` como derrota");
}

console.log(`\n${fallos ? "FALLA: " + fallos : "Todo correcto"}`);
process.exit(fallos ? 1 : 0);

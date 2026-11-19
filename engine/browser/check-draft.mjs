/* ══════════════════════════════════════════════════════════════════
   EL MODO DRAFT — comprobaciones deterministas (sin motor de reglas)

   Lo que pide el brief de E (§12), caso por caso. No se exige UN pick
   concreto cuando hay varias opciones razonables: se exige que lo
   imposible no gane a lo jugable, que las dependencias cambien el valor
   cuando cambian las piezas, y que la IA no vea lo que no debe.

   Uso: node check-draft.mjs            (desde engine/browser/)
   Los rulings que necesitan el motor (Sphinx) están en check-draft-cartas.mjs.
   ══════════════════════════════════════════════════════════════════ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RUTA_RP02 = process.env.GOAT_RP02 ?? path.join(AQUI, "..", "data", "draft", "rp02.json");
const { prepararDraft, avanzar, construirMazo, construirAsiento, categoriaDe } = await import("./src/draft/draft.js");
const { nuevaMesa, integridad, vistaDe, aplicarPaso } = await import("./src/draft/mesa.js");
const { decidirPick, personalidad } = await import("./src/draft/picks.js");
const { evaluarMazo, mejorMazo } = await import("./src/draft/mazo.js");
const { abrirSobre, porRareza, MODELO_SOBRE } = await import("./src/draft/sobres.js");
const { crearAzar } = await import("./src/draft/azar.js");
const { analizarFormato } = await import("./src/draft/rutas.js");

const rp02 = JSON.parse(readFileSync(RUTA_RP02, "utf-8"));
const D = prepararDraft(rp02);
const C = n => { const c = D.porNombre.get(n); if(!c) throw new Error("no existe " + n); return c; };
const ids = ns => ns.map(n => C(n).id);
const pruebas = [];
const ok = (t, v, d = "") => { pruebas.push([t, !!v]); console.log(v ? "  ✓" : "  ✗", t, d ? `— ${d}` : ""); };
const fin = { tam:20, relleno:0, futuro:() => 0, formato:D.formato, sesgo:{} };
const neutra = { sesgo:{ beatdown:0, control:0, burn:0, bind:0 }, riesgo:1, gustos:{}, ruido:0, rareDraft:false };
const vista = ({ sobre, pool = [], ronda = 2, paso = 2, vistos = [] }) => ({
  asiento:0, nAsientos:18, ronda, paso, dir: ronda % 2 ? "derecha" : "izquierda",
  sobre: ids(sobre), misPicks: ids(pool), vistos,
  cfg:{ sobres:6, cartasPorSobre:9, mainMin:20, modelo:MODELO_SOBRE, asientos:18 } });
const elige = (v, perso = neutra, semilla = "t") => {
  const r = decidirPick(v, { cat:D.cat, formato:D.formato, perso, semillaDecision:semilla });
  return { ...r, nombre: D.cat.get(r.id).nombre };
};
const valorEn = (mazo, nombre, plan = "beatdown", ctx = fin) => {
  const e = evaluarMazo(mazo.map(C), plan, ctx);
  return e.valores.filter(x => x.c.nombre === nombre).reduce((s, x) => s + x.v, 0);
};
/* Un pool de beatdown corriente, para dar contexto */
const BEAT = ["Gemini Elf","Gemini Elf","Kycoo the Ghost Destroyer","Spear Dragon","Opticlops","Dark Jeroid",
  "Book of Moon","Dust Tornado","Torrential Tribute","Newdoria","Obnoxious Celtic Guard","Goblin Attack Force"];
const RELLENO = ["Gemini Elf","Spear Dragon","Kycoo the Ghost Destroyer","Opticlops","Obnoxious Celtic Guard",
  "Beta The Magnet Warrior","Don Zaloog","Mad Sword Beast","Book of Moon","Dust Tornado","Dark Jeroid","Newdoria",
  "Torrential Tribute","Bottomless Trap Hole","Kaiser Sea Horse","Gravekeeper's Assailant","Revival Jam","Gamma The Magnet Warrior"];

console.log("═══ 0 · EL POOL ═══");
ok("101 cartas, 48 C · 24 R · 10 SR · 8 UR · 11 SE", rp02.cartas.length === 101 &&
   JSON.stringify(rp02.rarezas) === JSON.stringify({ SE:11, UR:8, C:48, R:24, SR:10 }), JSON.stringify(rp02.rarezas));
ok("cada carta con passcode único y su nombre oficial", new Set(rp02.cartas.map(c => c.id)).size === 101);
const imposibles = [...D.formato].filter(([, f]) => !f.ok).map(([n]) => n).sort();
ok("no habilitables en el pool cerrado: solo TER, Dragon Master Knight y Blue-Eyes Shining Dragon",
   JSON.stringify(imposibles) === JSON.stringify(["Blue-Eyes Shining Dragon","Dragon Master Knight","Thousand-Eyes Restrict"]),
   imposibles.join(", "));
ok("TER: tener Thousand-Eyes Idol no lo habilita (falta Relinquished; no se inventa Polymerization)",
   /Relinquished/.test(D.formato.get("Thousand-Eyes Restrict").motivo));
ok("Masked Beast, Valkyrion, Destiny Board, Necrofear y Victory Dragon SON posibles en el formato",
   ["The Masked Beast","Valkyrion the Magna Warrior","Destiny Board","Dark Necrofear","Victory Dragon","Curse of the Masked Beast"]
     .every(n => D.formato.get(n).ok));
{ /* un ciclo sin inicio legal no es una ruta */
  const A = { nombre:"A", esMonstruo:true, tributos:null, rutas:[{ piezas:["B"], enCampo:true }] };
  const B = { nombre:"B", esMonstruo:true, tributos:null, rutas:[{ piezas:["A"], enCampo:true }] };
  const f = analizarFormato(new Map([["A", A], ["B", B]]));
  ok("dos cartas que necesitan a la otra en el campo, sin inicio legal: ninguna es habilitable", !f.get("A").ok && !f.get("B").ok, f.get("A").motivo);
}

console.log("\n═══ 1 · LO IMPOSIBLE NO SE ELIGE, PERO SIGUE EN LOS SOBRES ═══");
{
  let malos = 0;
  for(let s = 0; s < 24; s++){
    const perso = personalidad("t1", s);
    for(const [ronda, paso] of [[0,0],[2,4],[5,1]]){
      const r = elige(vista({ sobre:["Thousand-Eyes Restrict","Dragon Master Knight","Blue-Eyes Shining Dragon","Gemini Elf","Spear Dragon","Mad Sword Beast"],
                              pool: BEAT.slice(0, 4 + ronda * 2), ronda, paso }), perso, "t1|" + s + ronda);
      if(["Thousand-Eyes Restrict","Dragon Master Knight","Blue-Eyes Shining Dragon"].includes(r.nombre)) malos++;
    }
  }
  ok("TER, DMK y Shining Dragon pierden frente a opciones jugables (24 personalidades × 3 momentos)", malos === 0, `${malos} picks imposibles`);
  const ultima = elige(vista({ sobre:["Thousand-Eyes Restrict"], pool: BEAT, ronda:1, paso:8 }));
  ok("pueden llegar como última carta (y entonces se cogen)", ultima.nombre === "Thousand-Eyes Restrict");
  const azar = crearAzar(7), porR = porRareza(rp02.cartas);
  let ter = 0, dmk = 0, dup = 0;
  for(let i = 0; i < 3000; i++){
    const s = abrirSobre(porR, azar);
    if(s.length !== 9 || new Set(s).size !== 9) dup++;
    if(s.includes(C("Thousand-Eyes Restrict").id)) ter++;
    if(s.includes(C("Dragon Master Knight").id)) dmk++;
  }
  ok("los sobres tienen 9 cartas sin repetir y TER/DMK siguen saliendo", dup === 0 && ter > 0 && dmk > 0, `TER ${ter}, DMK ${dmk} en 3000 sobres`);
  const m = construirMazo(ids([...RELLENO, "Gemini Elf","Opticlops","Book of Moon","Thousand-Eyes Restrict","Dragon Master Knight","Blue-Eyes Shining Dragon","Thousand-Eyes Idol"]), D);
  const nombres = m.main.map(id => D.cat.get(id).nombre);
  ok("ninguna entra en el Main, ni su Extra; el constructor no mete relleno para una ruta inexistente",
     !nombres.some(n => ["Thousand-Eyes Restrict","Dragon Master Knight","Blue-Eyes Shining Dragon","Thousand-Eyes Idol"].includes(n)) && m.extra.length === 0,
     nombres.length + " en el main");
}

console.log("\n═══ 2 · THE MASKED BEAST: APUESTA CONDICIONADA, NO IMPOSIBLE ═══");
{
  const sin = categoriaDe(C("The Masked Beast"), BEAT.map(C), { formato:D.formato });
  const con = categoriaDe(C("The Masked Beast"), [...BEAT, "Curse of the Masked Beast"].map(C), { formato:D.formato });
  ok("sin Curse: «habilitable, pero no en mi pool» (2), no «imposible» (1)", sin.k === 2, sin.texto);
  ok("con Curse: pasa a habilitada (3 o 4) y su acceso es bajo (las dos piezas + tributos)", con.k >= 3 && con.acceso < 0.6, `${con.texto}, acceso ${con.acceso.toFixed(2)}`);
  const vSin = elige(vista({ sobre:["The Masked Beast","Mad Sword Beast"], pool: BEAT, ronda:1, paso:1 }));
  const vCon = elige(vista({ sobre:["The Masked Beast","Mad Sword Beast"], pool: [...BEAT, "Curse of the Masked Beast"], ronda:1, paso:1 }));
  const val = (r, n) => r.candidatos.find(c => c.nombre === n).valor;
  ok("tener Curse sube el valor del pick de The Masked Beast", val(vCon, "The Masked Beast") > val(vSin, "The Masked Beast"),
     `${val(vSin,"The Masked Beast").toFixed(2)} → ${val(vCon,"The Masked Beast").toFixed(2)}`);
  ok("al final del draft, sin Curse, The Masked Beast vale 0 en el mazo", valorEn([...RELLENO.slice(0, 19), "The Masked Beast"], "The Masked Beast") === 0);
  const media = valorEn([...RELLENO.slice(0, 18), "The Masked Beast", "Curse of the Masked Beast"], "The Masked Beast");
  ok("con las dos mitades no se valora como un motor consistente (por debajo de su nota)", media > 0 && media < C("The Masked Beast").base * 0.75, media.toFixed(2));
}

console.log("\n═══ 3 · HA DES: AMENAZA AUTÓNOMA, NO OBJETIVO DE RESURRECCIÓN ═══");
{
  const pool = BEAT.filter(n => !D.porNombre.get(n).demonio);
  const r = elige(vista({ sobre:["Dark Ruler Ha Des","Melchid the Four-Face Beast","Mad Sword Beast","Gamma The Magnet Warrior"], pool, ronda:1, paso:2 }));
  ok("se elige sin paquete de Demonios", r.nombre === "Dark Ruler Ha Des", r.explicacion);
  ok("no es objetivo de Premature Burial / Call of the Haunted", C("Dark Ruler Ha Des").revivible === false);
  const conHaDes = valorEn([...RELLENO.slice(0, 17).filter(n => !["Goblin Attack Force"].includes(n)), "Dark Ruler Ha Des", "Premature Burial", "Melchid the Four-Face Beast"], "Premature Burial");
  const conFreed = valorEn([...RELLENO.slice(0, 17).filter(n => !["Goblin Attack Force"].includes(n)), "Freed the Matchless General", "Premature Burial", "Melchid the Four-Face Beast"], "Premature Burial");
  ok("Premature vale menos si el monstruo grande es Ha Des que si es Freed", conHaDes < conFreed, `${conHaDes.toFixed(2)} < ${conFreed.toFixed(2)}`);
}

console.log("\n═══ 4 · EL SEGUNDO SPY HABILITA EL PRIMERO ═══");
{
  const base = RELLENO.filter(n => !/Gravekeeper/.test(n)).slice(0, 18);
  const uno = valorEn([...base, "Gravekeeper's Spy"], "Gravekeeper's Spy");
  const dos = valorEn([...base.slice(0, 17), "Gravekeeper's Spy", "Gravekeeper's Spy"], "Gravekeeper's Spy") / 2;
  ok("cada Spy vale más con un segundo objetivo en el mazo", dos > uno, `${uno.toFixed(2)} → ${dos.toFixed(2)} por copia`);
  const conAsal = valorEn([...base.slice(0, 17), "Gravekeeper's Spy", "Gravekeeper's Assailant"], "Gravekeeper's Spy");
  ok("Assailant también es objetivo (1500 de ATK)", conAsal > uno);
  const conChief = valorEn([...base.slice(0, 17), "Gravekeeper's Spy", "Gravekeeper's Chief"], "Gravekeeper's Spy");
  ok("Chief NO es objetivo (1900): no sube a Spy", Math.abs(conChief - uno) < 0.01, `${uno.toFixed(2)} / ${conChief.toFixed(2)}`);
  const r = elige(vista({ sobre:["Gravekeeper's Spy","Mad Sword Beast","Melchid the Four-Face Beast"], pool:[...BEAT, "Gravekeeper's Spy"], ronda:2, paso:3 }));
  ok("el pick lo explica", /Segundo Spy|Spy/.test(r.explicacion), r.explicacion);
}

console.log("\n═══ 5 · DOS GRAVITY BIND NO SON UN MAZO BURN ═══");
{
  const pobre = [...RELLENO.slice(0, 16), "Gravity Bind", "Gravity Bind", "Skull Invitation", "Dark Room of Nightmare"];
  const m1 = mejorMazo(pobre.map(C), fin);
  ok("con dos Bind y ninguna fuente de daño el mejor plan no es burn", m1.mejor.plan !== "burn", `${m1.mejor.plan} · ` + m1.todos.map(t => t.plan + " " + t.total.toFixed(0)).join(" / "));
  const burn = ["Gravity Bind","Gravity Bind","Nightmare Wheel","Nightmare Wheel","Ceasefire","Magic Cylinder","Magic Cylinder","Lava Golem",
    "Dark Room of Nightmare","Ring of Destruction","Swords of Revealing Light","Gravekeeper's Spy","Gravekeeper's Spy","Guardian Sphinx",
    "Revival Jam","Obnoxious Celtic Guard","Mirror Wall","Gamma The Magnet Warrior","Alpha The Magnet Warrior","Morphing Jar",
    "Gemini Elf","Spear Dragon","Kycoo the Ghost Destroyer","Dark Jeroid"];
  const m2 = mejorMazo(burn.map(C), fin);
  ok("con fuentes de daño reales, bloqueos y muros, burn pasa a ser el plan", m2.mejor.plan === "burn", `${m2.mejor.plan} · daño ≈ ${Math.round(m2.todos.find(t => t.plan === "burn").T.dano)}`);
  ok("y el burn se alarga por encima de 20 si compensa (deck-out del rival)", m2.mejor.plan !== "burn" || m2.mejor.main.length >= 20, `${m2.mejor.main.length} cartas`);
}

console.log("\n═══ 6 · LILY BAJO BIND; LIGHT AND DARKNESS DRAGON NO QUITA UNA BIND ═══");
{
  ok("Lily se reconoce como amenaza bajo Gravity Bind", C("Injection Fairy Lily").roles.includes("bajoBind"));
  ok("LaDD no cuenta como respuesta a una Bind ya resuelta", !C("Light and Darkness Dragon").roles.includes("antiBind"));
  ok("Dust Tornado y Jinzo sí", C("Dust Tornado").roles.includes("antiBind") && C("Jinzo").roles.includes("antiBind"));
  const mazo = [...RELLENO.slice(0, 15), "Gravity Bind", "Gravity Bind", "Injection Fairy Lily", "Gilasaurus", "Yata-Garasu"];
  const enBind = valorEn(mazo, "Injection Fairy Lily", "bind"), enBeat = valorEn(mazo, "Injection Fairy Lily", "beatdown");
  ok("en el plan Bind, Lily vale más que en beatdown", enBind > enBeat, `${enBeat.toFixed(2)} → ${enBind.toFixed(2)}`);
}

console.log("\n═══ 7 · NECROVALLEY, BAZOO Y RESURRECCIÓN: CONFLICTO, NO BONUS DOBLE ═══");
{
  const base = RELLENO.filter(n => !/Gravekeeper/.test(n)).slice(0, 14);
  const gk = ["Gravekeeper's Spy","Gravekeeper's Spy","Gravekeeper's Assailant"];
  const sinNV = [...base, ...gk, "Premature Burial", "Bazoo the Soul-Eater", "Call of the Haunted"];
  const conNV = [...base.slice(0, 13), ...gk, "Premature Burial", "Bazoo the Soul-Eater", "Call of the Haunted", "Necrovalley"];
  ok("con Necrovalley, Premature vale menos", valorEn(conNV, "Premature Burial") < valorEn(sinNV, "Premature Burial"));
  ok("con Necrovalley, Bazoo vale menos", valorEn(conNV, "Bazoo the Soul-Eater") < valorEn(sinNV, "Bazoo the Soul-Eater"));
  const nvSolo = valorEn([...base.slice(0, 16), ...gk, "Necrovalley"], "Necrovalley");
  const nvConf = valorEn(conNV, "Necrovalley");
  ok("y Necrovalley vale menos en un mazo que vive del cementerio", nvConf < nvSolo, `${nvSolo.toFixed(2)} → ${nvConf.toFixed(2)}`);
  const conChief = [...base.slice(0, 12), ...gk, "Premature Burial", "Bazoo the Soul-Eater", "Call of the Haunted", "Necrovalley", "Gravekeeper's Chief"];
  ok("Gravekeeper's Chief (tu cementerio ignora Necrovalley) suaviza el conflicto", valorEn(conChief, "Premature Burial") > valorEn(conNV, "Premature Burial"));
}

console.log("\n═══ 9 · DESTINY BOARD ═══");
{
  const MSG = ['Spirit Message "I"','Spirit Message "N"','Spirit Message "A"','Spirit Message "L"'];
  const tres = [...RELLENO.slice(0, 16), "Destiny Board", MSG[0], MSG[1], MSG[2]];
  ok("incompleto (sin «L») no vale nada como condición de victoria", valorEn(tres, "Destiny Board", "burn") === 0);
  const dupl = [...RELLENO.slice(0, 15), "Destiny Board", MSG[0], MSG[1], MSG[2], MSG[2]];
  ok("una letra repetida no sustituye a la que falta", valorEn(dupl, "Destiny Board", "burn") === 0);
  const muros = ["Gravekeeper's Spy","Guardian Sphinx","Gravity Bind","Swords of Revealing Light","Revival Jam","Obnoxious Celtic Guard","Gamma The Magnet Warrior"];
  const completo = [...RELLENO.slice(0, 8), ...muros, "Destiny Board", ...MSG];
  const vC = valorEn(completo, "Destiny Board", "burn");
  ok("completo y con defensa, sí vale", vC > 2, vC.toFixed(2));
  const sinDef = [...RELLENO.slice(0, 15), "Destiny Board", ...MSG];
  ok("completo pero sin defensa vale bastante menos", valorEn(sinDef, "Destiny Board", "burn") < vC);
  const llenas = [...RELLENO.slice(0, 8), ...muros.slice(0, 3), "Nightmare Wheel","Skull Invitation","Mirror Wall","Dark Room of Nightmare", "Destiny Board", ...MSG];
  ok("con las zonas de magia/trampa ocupadas por permanentes, baja", valorEn(llenas, "Destiny Board", "burn") < vC);
}

console.log("\n═══ 10 · NADA DE FUERA, NI 40 CARTAS, NI TRES COPIAS ═══");
{
  const pool = [...RELLENO, "Nobleman of Crossout","Nobleman of Crossout","Nobleman of Crossout","Nobleman of Crossout","Nobleman of Crossout",
                "Thousand-Eyes Restrict","Spirit Message \"I\"","Curse of the Masked Beast"];
  const m = construirMazo(ids(pool), D);
  const cuenta = a => a.reduce((mp, x) => mp.set(x, (mp.get(x) ?? 0) + 1), new Map());
  const cp = cuenta(ids(pool)), cm = cuenta([...m.main, ...m.side]);
  ok("main + side = exactamente el pool (cada instancia, ni una más)", [...cp].every(([k, v]) => cm.get(k) === v) && [...cm].every(([k, v]) => cp.get(k) === v));
  ok("el main empieza en 20, no en 40", m.main.length >= 20 && m.main.length < 40, `${m.main.length}`);
  ok("sin límite de tres copias: 4+ Nobleman si las tiene", m.main.filter(id => id === C("Nobleman of Crossout").id).length >= 4,
     `${m.main.filter(id => id === C("Nobleman of Crossout").id).length} copias`);
}

console.log("\n═══ 11 · LA MESA: 54 PICKS, CADA CARTA UNA VEZ, PASES ALTERNOS Y SIMULTÁNEOS ═══");
const st = nuevaMesa(rp02, { semilla:"check-draft", humano:null });
{
  /* seguir una carta del primer sobre del asiento 0 y otra del segundo */
  const sigue0 = st.sobres[0].at(-1);
  const t0 = Date.now();
  let dondeR0 = [], estadosPrevios = null, simultaneo = true;
  while(!st.terminado){
    if(st.ronda === 0) dondeR0.push(st.sobres.findIndex(s => s.includes(sigue0)));
    if(st.ronda === 1 && st.paso === 0) var sigue1 = st.sobres[0].at(-1), dondeR1 = [];
    if(st.ronda === 1 && sigue1) dondeR1.push(st.sobres.findIndex(s => s.includes(sigue1)));
    /* simultáneo: lo que ve cada asiento en este paso es su sobre de ANTES del pase */
    const antes = st.sobres.map(s => [...s]);
    const r = st.ronda, p = st.paso;
    avanzar(st, D, null);
    for(let a = 0; a < 18; a++){ const v = st.vistos[a].at(-1); if(v.ronda !== r || v.paso !== p || v.ids.length !== antes[a].length) simultaneo = false; }
  }
  const t = (Date.now() - t0) / 1000;
  const integ = integridad(st);
  ok("integridad: cada carta elegida una sola vez y todas elegidas", integ.ok, integ.motivo ?? "");
  ok("cada jugador termina con 54 picks", st.picks.every(p => p.length === 54));
  const izq = dondeR0.filter(x => x >= 0).every((x, i, a) => i === 0 || x === (a[i - 1] + 1) % 18);
  const der = dondeR1.filter(x => x >= 0).every((x, i, a) => i === 0 || x === (a[i - 1] + 17) % 18);
  ok("sobre 1 a la izquierda, sobre 2 a la derecha", izq && der, `${dondeR0.filter(x=>x>=0).join(",")} | ${dondeR1.filter(x=>x>=0).join(",")}`);
  ok("todos los picks de un paso salen del estado anterior al pase", simultaneo);
  console.log(`     (draft de 18 asientos en ${t.toFixed(1)} s)`);
}

console.log("\n═══ 12 · EL BOT NO VE LO QUE NO DEBE ═══");
{
  const m = nuevaMesa(rp02, { semilla:"oculto", humano:null });
  for(let i = 0; i < 13; i++) avanzar(m, D, null);     // a mitad del sobre 2
  const decide = st2 => decidirPick(vistaDe(st2, 4), { cat:D.cat, formato:D.formato, perso:personalidad("oculto", 4),
                                                      semillaDecision:"oculto|decision|4" });
  const a = decide(m);
  const otra = JSON.parse(JSON.stringify(m));
  for(let s = 0; s < 18; s++) if(s !== 4){ otra.sobres[s] = otra.sobres[s].map((uid, k) => { const nu = `falso${s}_${k}`; otra.instancias[nu] = C("Ring of Destruction").id; return nu; });
    otra.picks[s] = otra.picks[s].slice(0, 2); otra.vistos[s] = []; }
  otra.azarProducto = 12345;
  const b = decide(otra);
  ok("cambiar sobres y pools rivales y el generador no cambia su pick", a.id === b.id && JSON.stringify(a.candidatos) === JSON.stringify(b.candidatos),
     D.cat.get(a.id).nombre);
  const v = vistaDe(m, 4);
  ok("la vista no lleva pools rivales, sobres ajenos ni estado del generador",
     !("picks" in v) && !("sobres" in v) && !("azarProducto" in v) && !("instancias" in v));
}

console.log("\n═══ 13 · REPRODUCIBLE, Y SIN COLAPSAR EN UN ARQUETIPO ═══");
{
  const m1 = nuevaMesa(rp02, { semilla:"repro", humano:null }), m2 = nuevaMesa(rp02, { semilla:"repro", humano:null });
  for(let i = 0; i < 12; i++){ avanzar(m1, D, null); avanzar(m2, D, null); }
  ok("misma semilla, mismas decisiones", JSON.stringify(m1.log.map(l => l.id)) === JSON.stringify(m2.log.map(l => l.id)));
  const planes = {}, primeras = new Set();
  let imposiblesEnMain = 0, maines = 0, gk = 0, fiend = 0;
  for(let a = 0; a < 18; a++){
    const mz = construirAsiento(st, D, a);
    planes[mz.plan] = (planes[mz.plan] ?? 0) + 1;
    primeras.add(st.log.find(l => l.asiento === a).id);
    const nm = mz.main.map(id => D.cat.get(id));
    imposiblesEnMain += nm.filter(c => !D.formato.get(c.nombre).ok).length;
    if(nm.filter(c => c.gravekeeper).length >= 3) gk++;
    if(nm.filter(c => c.demonio).length >= 4) fiend++;
    maines++;
  }
  ok("ninguna carta sin ruta en los 18 mains", imposiblesEnMain === 0);
  ok("las primeras elecciones no son todas la misma", primeras.size >= 6, `${primeras.size} distintas de 18`);
  console.log(`     planes: ${JSON.stringify(planes)} · mazos con 3+ Gravekeeper's: ${gk} · con 4+ Demonios: ${fiend}`);
}

console.log("\n═══ 14 · EL SUIZO: SIN REPETIR, BYES, EMPATES Y DESEMPATES ═══");
{
  const E = await import("./src/draft/evento.js");
  for(const n of [18, 17]){
    const ev = E.nuevoEvento({ jugadores: [...Array(n).keys()].map(i => ({ id:i, nombre:"J" + i })), rondas:5, semilla:"suizo" + n });
    const az = crearAzar(n);
    let repetidos = 0, byes = new Map();
    const vistos = new Set();
    for(let r = 0; r < 5; r++){
      E.emparejar(ev);
      for(const m of ev.mesas){
        if(m.bye !== undefined){ byes.set(m.bye, (byes.get(m.bye) ?? 0) + 1); continue; }
        const k = [m.a, m.b].sort((x, y) => x - y).join("|");
        if(vistos.has(k)) repetidos++; vistos.add(k);
        const x = az();
        E.apuntar(ev, m.mesa, x < 0.45 ? { ga:2, gb:x < 0.2 ? 0 : 1 } : x < 0.9 ? { ga:x < 0.7 ? 1 : 0, gb:2 } : { ga:1, gb:1 });
      }
      E.cerrarRonda(ev);
    }
    const cl = E.clasificacion(ev);
    const ordenado = cl.every((f, i) => i === 0 || cl[i-1].puntos > f.puntos || (cl[i-1].puntos === f.puntos &&
      (cl[i-1].omw > f.omw || (cl[i-1].omw === f.omw && (cl[i-1].oomw > f.oomw || (cl[i-1].oomw === f.oomw && cl[i-1].gw >= f.gw))))));
    ok(`${n} jugadores: 5 rondas sin repetir rival`, repetidos === 0, `${repetidos} repetidos`);
    ok(`${n} jugadores: ${n % 2 ? "un bye por ronda y nadie repite bye" : "sin byes"}`,
       n % 2 ? [...byes.values()].every(v => v === 1) && [...byes.values()].length === 5 : byes.size === 0);
    ok(`${n} jugadores: clasificación ordenada por puntos → OMW → OOMW → GW, con suelo de 33 %`, ordenado && cl.every(f => f.omw >= 1/3 - 1e-9));
    ok(`${n} jugadores: los empates cuentan 1 punto`, cl.some(f => f.empatados > 0) && cl.every(f => f.puntos === 3 * f.ganados + f.empatados));
  }
}

const fallos = pruebas.filter(p => !p[1]);
console.log(`\n${fallos.length ? "✗" : "✓"} check-draft: ${pruebas.length - fallos.length}/${pruebas.length}`);
process.exit(fallos.length ? 1 : 0);

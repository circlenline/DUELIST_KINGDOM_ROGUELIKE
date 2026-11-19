/* ══════════════════════════════════════════════════════════════════
   EL MAZO QUE SE PUEDE CONSTRUIR — evaluación y constructor

   Construir es optimizar un SUBCONJUNTO, no ordenar por nota y coger las
   20 primeras. Cada carta vale en el mazo lo que vale ALLÍ:

     v = base × plan × acceso × (piezas que aún faltan × prob. de conseguirlas)
         × copias × conflictos + soporte

   y el mazo entero se mide con su calidad media (la carta que robas es
   una al azar), lo que cubre (respuestas a monstruos, a magias/trampas,
   a un Gravity Bind ya puesto, a muros de 2000), lo que no puede hacer
   (manos sin jugada, demasiados tributos para tan pocos cuerpos) y si su
   plan de victoria existe de verdad (el burn necesita daño que llegue a
   8000, no dos Gravity Bind).

   Cuatro planes, evaluados siempre a la vez. Ninguno se elige por una
   regla fija: gana el que mejor mazo da con estas cartas.
   ══════════════════════════════════════════════════════════════════ */
import { accesoEnMazo, pAlMenos, VENTANA } from "./rutas.js";

export const PLANES = {
  /* Beatdown y control son el grueso del formato y se parecen: los
     multiplicadores son suaves. Medido con partidas reales (medir-
     constructor.mjs): castigar Swords o Magic Cylinder en un beatdown por
     ser «bloqueo» hacía mazos PEORES que coger las 20 de más nota. */
  beatdown: { nombre:"Beatdown / control flexible", corto:"beatdown", oferta:0,
              mult:{ atacante:1.05, grande:1.05, remocion:1.05, bloqueo:0.95, dano:0.95, amplif:0.3,
                     simetrica:0.85, side:0.6 } },
  control:  { nombre:"Control con tributos de calidad", corto:"control", oferta:-1,
              mult:{ atacante:0.98, muro:1.06, remocion:1.08, remSet:1.04, ventaja:1.05, bloqueo:1.0,
                     dano:0.95, amplif:0.35, simetrica:0.85, side:0.6 } },
  burn:     { nombre:"Burn / stall", corto:"burn", oferta:-5,
              mult:{ dano:1.75, amplif:1.6, bloqueo:1.55, muro:1.3, atacante:0.55, grande:0.8,
                     bajoBind:0.8, simetrica:1.0, side:0.6 } },
  bind:     { nombre:"Ataque bajo Gravity Bind", corto:"bind", oferta:-5,
              mult:{ bajoBind:1.8, bloqueo:1.1, atacante:0.62, grande:0.85, muro:1.05, dano:0.9, side:0.6 } },
};
export const NOMBRES_PLAN = (() => { try{ const v = globalThis.process?.env?.GOAT_DRAFT_PLANES;
  return v ? v.split(",") : Object.keys(PLANES); }catch(e){ return Object.keys(PLANES); } })();
const SIN = (() => { try{ const v = globalThis.process?.env?.GOAT_DRAFT_SIN ?? globalThis.GOAT_DRAFT_SIN;
  return v ? String(v).split(",") : null; }catch(e){ return null; } })();

const COPIAS = {          // la k-ésima copia de la misma carta: redundancia útil o no
  "Gravity Bind":[1,0.55,0.3], "Necrovalley":[1,0.3,0.1], "Destiny Board":[1,0.35,0.1],
  "Swords of Revealing Light":[1,0.85,0.7], "Dark Room of Nightmare":[1,0.4,0.2],
  "A Legendary Ocean":[1,0.3,0.1], "Mirror Wall":[1,0.5,0.3], "Royal Decree":[1,0.2,0.1],
  "Mask of Restrict":[1,0.2,0.1], "Skull Invitation":[1,0.4,0.2], "Card of Safe Return":[1,0.3,0.1],
  "Infinite Cards":[1,0,0], "Appropriate":[1,0.3,0.1], "Limiter Removal":[1,0.5,0.2],
  "Injection Fairy Lily":[1,0.9,0.75], "Morphing Jar":[1,0.6,0.4], "Reckless Greed":[1,0.7,0.5],
  "Gravekeeper's Spy":[1,1,0.8,0.6,0.45,0.35], "Book of Moon":[1,0.9,0.75,0.6], "4-Starred Ladybug of Doom":[1,0.85,0.7,0.55],
};
function factorCopia(nombre, k, c){
  if(c.mensaje) return k === 1 ? 1 : 0;              // dos «I» no sustituyen a una «N»
  const t = COPIAS[nombre];
  if(t) return t[Math.min(k - 1, t.length - 1)];
  if(c.tributos === 2) return [1, 0.85, 0.7, 0.6][Math.min(k - 1, 3)];
  return Math.max(0.6, 1 - 0.05 * (k - 1));
}

/* El multiplicador de un plan para una carta: media geométrica de los
   roles que ese plan pondera (una carta con dos papeles —Magic Cylinder
   frena un ataque Y quema— no se hunde por multiplicar dos descuentos).
   Se guarda en la carta: las cartas del catálogo son las mismas siempre. */
function multPlan(c, planId){
  const cache = c._mult ??= {};
  if(cache[planId] !== undefined) return cache[planId];
  const P = PLANES[planId];
  let m = 1, nr = 0;
  /* bajo un Gravity Bind lo que cuenta de Lily o Gilasaurus es que pasan
     por debajo, no que sean «atacantes» genéricos (que la Bind frena) */
  if(planId === "bind" && c.bind) return cache[planId] = 1.9;      // la Bind ES el plan
  const roles = planId === "bind" && c.roles.includes("bajoBind") ? ["bajoBind"] : c.roles;
  for(const r of roles) if(P.mult[r] !== undefined){ m *= P.mult[r]; nr++; }
  if(nr > 1) m = Math.pow(m, 1 / nr);
  return cache[planId] = m;
}

/* ¿Qué ATK tiene de verdad para pasar muros? */
const rompeMuros = c => c.esMonstruo && c.tributos !== null && (c.atk >= 2100 || c.nombre === "Injection Fairy Lily")
                     || ["Nobleman of Crossout","Book of Moon","Creature Swap","Dark Jeroid","Swords of Revealing Light",
                         "4-Starred Ladybug of Doom","Torrential Tribute","Newdoria","United We Stand","Mage Power",
                         "Lava Golem","Guardian Sphinx"].includes(c.nombre);

/* Lo que se puede hacer en los dos primeros turnos sin depender de nada. */
const jugable = (c, v) => v >= 1.5 && !c.mensaje &&
  (c.esMonstruo ? c.tributos === 0 : true);

/* ── EVALUAR UN MAZO ──
   mazo: array de cartas (con copias repetidas).
   ctx:  { tam, relleno, futuro(nombre) → prob. de conseguir esa pieza, sesgo{plan} } */
export function evaluarMazo(mazo, planId, ctx){
  const P = PLANES[planId];
  const tam = ctx.tam ?? 20;
  const nReal = mazo.length;
  const nRell = Math.max(0, tam - nReal);
  const n = nReal + nRell;
  const relleno = ctx.relleno ?? 2.5;

  /* Una sola pasada para todo lo que se cuenta (esto se evalúa miles de
     veces por pick: tiene que ser barato). */
  const cuenta = new Map();
  let L0 = nRell * 0.5, T1 = 0, T2 = 0, trampas = 0, permanentes = 0, gk = 0, demonios = 0,
      guerreros4 = 0, spirits = 0, muros = 0, bloqueoTotal = 0, Mreal = 0, grandes = 0, luzTrib = 0, revs = 0;
  const revivibles = [];
  for(const c of mazo){
    cuenta.set(c.nombre, (cuenta.get(c.nombre) ?? 0) + 1);
    if(c.esMonstruo){
      if(c.tributos === 0) L0++;
      else if(c.tributos === 1) T1++;
      else if(c.tributos >= 2) T2 += c.gaia ? 0.6 : 1;
      if(c.tributos !== null) Mreal++;
      if(c.demonio) demonios++;
      if(c.raza === 1 && c.tributos === 0) guerreros4++;
      if(c.revivible) revivibles.push(c.atk);
      if(c.luz && (c.tributos ?? 0) >= 1) luzTrib++;
    }
    if(c.esTrampa) trampas++;
    if(c.esPermanente) permanentes++;
    if(c.gravekeeper) gk++;
    if(c.spirit) spirits++;
    if(c.esMuro) muros++;
    if(c.esGrande) grandes++;
    if(c.revive) revs++;
    bloqueoTotal += c.bloqueo ?? 0;
  }
  const hay = nom => cuenta.get(nom) ?? 0;
  const kaiser = hay("Kaiser Sea Horse");
  const carga = T1 + 2 * T2;
  const capacidad = L0 * 0.62 + 1 + kaiser * 0.5;
  const fTrib = carga > capacidad ? capacidad / carga : 1;
  const conNV = hay("Necrovalley") > 0, conChief = hay("Gravekeeper's Chief") > 0;
  const gearfried = hay("Gearfried the Iron Knight");
  const contar = f => mazo.reduce((s, c) => s + (f(c) ? 1 : 0), 0);
  revivibles.sort((a, b) => b - a);
  let ordenRev = 0;

  const valores = [];
  const visto = new Map();
  let suma = 0;
  for(const c of mazo){
    const k = (visto.get(c.nombre) ?? 0) + 1; visto.set(c.nombre, k);
    let por = [];
    if(!ctx.formato.get(c.nombre)?.ok){ valores.push({ c, v:0, por:["sin ruta en el formato"] }); continue; }
    let v = c.base;
    /* plan */
    let m = multPlan(c, planId);
    if(planId === "bind" && c.esMonstruo && c.nivel >= 4 && c.roles.includes("atacante") && hay("Gravity Bind"))
      m *= 0.8;                                    // atacante que su propia Bind deja quieto
    v *= Math.max(0.25, Math.min(1.9, m));
    /* acceso: rutas y piezas */
    if(c.rutas.length){
      const a = accesoEnMazo(c, cuenta, n, mazo);
      let acc = a.acceso;
      if(a.faltan.length){
        /* faltan piezas: lo que valga depende de conseguirlas */
        const pf = a.faltan.reduce((p, pieza) => p * (ctx.futuro?.(pieza) ?? 0), 1);
        const accSi = accesoSiTuviera(c, cuenta, n, mazo, a.faltan);
        acc = pf * accSi;
        if(pf < 1) por.push(`faltan ${a.faltan.join(", ")} (p≈${pf.toFixed(2)})`);
      }
      v *= acc;
      if(acc < 0.4 && !a.faltan.length) por.push(`acceso ${Math.round(acc * 100)} %`);
    }
    /* tributos */
    if(c.esMonstruo && (c.tributos ?? 0) > 0) v *= fTrib;
    /* soporte y conflictos, leídos de la anotación */
    if(c.nombre === "Gravekeeper's Spy"){
      const objetivos = (hay("Gravekeeper's Spy") - 1) + hay("Gravekeeper's Assailant");
      if(objetivos > 0){ v += 1.25 * (1 - Math.pow(0.45, objetivos)); por.push(`${objetivos} objetivo(s) para buscar`); }
    }
    if(c.nombre === "Gravekeeper's Assailant" && conNV) v += 1.1;
    if(c.nombre === "Gravekeeper's Chief") v += 0.6 * Math.min(1, (gk - 1) / 2);
    if(c.gravekeeper && conNV) v += 0.6;
    if(c.nombre === "Necrovalley"){
      v *= Math.min(1.2, gk / 3);
      const sufre = mazo.reduce((s, x) => s + (x.usaCementerio || x.revive ? 1 : 0), 0);
      v -= 0.45 * sufre * (conChief ? 0.5 : 1);
      if(sufre) por.push(`cierra ${sufre} carta(s) propias de cementerio`);
    }
    if(conNV && (c.usaCementerio || c.revive)){ v *= conChief ? 0.85 : 0.65; por.push("Necrovalley la apaga"); }
    if(c.nombre === "Dark Ruler Ha Des") v += Math.min(0.6, 0.06 * (demonios - 1));
    if(c.buscaGuerrero) v += Math.min(1.2, 0.3 * guerreros4);
    if(c.revive){
      /* objetivos legales: ni Ha Des, ni Spirits, ni lo que no puede salir
         del cementerio; Gearfried rompe el Premature que lo equipa. Los
         huecos que aún no tengo cuentan como un monstruo normal. */
      const objetivos = (c.revive === "premature"
        ? mazo.filter(x => x.revivible && x.nombre !== "Gearfried the Iron Knight").map(x => x.atk)
        : [...revivibles]).concat(Array(Math.min(3, Math.round(nRell * 0.5))).fill(1900)).sort((a,b) => b - a);
      const media = objetivos.length ? (objetivos[0] + (objetivos[1] ?? objetivos[0] * 0.8)) / 2 : 0;
      /* mientras el draft sigue, los huecos traerán objetivos: no se castiga
         a Premature/Call por no tenerlos aún */
      const q = objetivos.length ? Math.max(nRell > 0 ? 0.75 : 0.3, Math.min(1.1, (media - 900) / 1100)) : 0.1;
      v *= q;
      const orden = ordenRev++;
      if(orden >= 1) v *= orden === 1 ? 0.9 : 0.75;
    }
    if(c.swap) v += 0.4 * Math.min(2, spirits);
    if(c.anulaTrampas){ v *= Math.max(0.35, 1 - 0.05 * (trampas - (c.esTrampa ? 1 : 0))); }
    if(c.gorz) v *= Math.max(0.4, 1 - 0.08 * permanentes);
    if(c.equipo && gearfried) v *= Math.max(0.5, 1 - 0.12 * gearfried);
    if(c.dobleTributoLuz) v += Math.min(1, 0.5 * luzTrib);
    if(c.tablero){
      const defensa = Math.max(0.2, Math.min(1, (bloqueoTotal + 0.5 * muros) / 4));
      const zonas = permanentes <= 2 ? 1 : Math.max(0.35, 1 - 0.15 * (permanentes - 2));
      v *= defensa * zonas;
      if(defensa < 0.6) por.push("poca defensa para aguantar cuatro turnos");
      if(zonas < 1) por.push(`${permanentes} permanentes ocupan las zonas`);
    }
    if(c.regalo && planId !== "burn") v *= 0.85;
    v *= factorCopia(c.nombre, k, c);
    v = Math.max(0, v);
    valores.push({ c, v, por });
    suma += v;
  }
  suma += nRell * relleno;
  const calidad = 20 * suma / n;

  /* ── lo que cubre ── */
  const funciona = ({ c, v }) => c.base > 0 ? Math.min(1, v / c.base) : 0;
  const cuantos = rol => valores.reduce((s, x) => s + (x.c.roles.includes(rol) ? funciona(x) : 0), 0);
  const rem = cuantos("remocion"), remSet = cuantos("remSet"), antiBind = cuantos("antiBind") + cuantos("remMT") * 0.5;
  const muro = valores.reduce((s, x) => s + (rompeMuros(x.c) ? funciona(x) : 0), 0);
  const T = {};
  T.calidad = calidad;
  T.remocion = 3 * (1 - Math.exp(-rem / 1.6));
  T.sets = 1.5 * (1 - Math.exp(-remSet / 1.2));
  T.antiBind = 2 * (1 - Math.exp(-antiBind / 1.0));
  T.muros = (planId === "burn" ? 0.6 : 2) * (1 - Math.exp(-muro / 3));

  /* ── los umbrales de combate ──
     (Peso pequeño a propósito: medido con medir-constructor.mjs, empujar
     el ATK medio metía tributos de 1900-2600 por encima de cartas mejores
     y los mazos ganaban MENOS. Las coberturas de arriba, igual: son un
     desempate entre cartas parecidas, no un motivo para coger peores.)
     Lo que de verdad gana partidas de limitado entre bots y entre
     personas: con qué ATK pelean tus monstruos jugables. Muchos 1800 no
     pasan un muro de 2000; un mazo de 1400 pierde cada intercambio. Se
     miran los 10 mejores cuerpos que pueden salir (los huecos, 1600). */
  const cuerpos = valores.filter(x => x.c.esMonstruo && x.c.tributos !== null && x.v > 0)
    .map(x => x.c.nombre === "Injection Fairy Lily" ? 2600 : x.c.atk).sort((a, b) => b - a).slice(0, 10);
  while(cuerpos.length < 10 && cuerpos.length < Mreal + nRell) cuerpos.push(1600);
  const atkMedio = cuerpos.length ? cuerpos.reduce((s, x) => s + x, 0) / cuerpos.length : 0;
  T.combate = 1.5 * Math.max(-1.5, Math.min(1.2, (atkMedio - 1600) / 600)) * (planId === "burn" ? 0.2 : planId === "bind" ? 0.4 : 1);

  /* ── lo que no puede hacer ── */
  const M = Mreal + nRell * 0.6;
  const minCuerpos = planId === "burn" ? 6 : planId === "bind" ? 7 : 8;
  T.cuerpos = -2.2 * Math.max(0, minCuerpos - M);
  T.tributos = -6 * (1 - fTrib);
  const J = valores.reduce((s, x) => s + (jugable(x.c, x.v) ? 1 : 0), 0) + nRell * 0.7;
  const sinJugada = ratioSin(n, Math.round(J), 5);
  T.manos = -25 * sinJugada;
  if(planId !== "burn") T.manos -= 10 * ratioSin(n, Math.round(L0), 6);

  /* ── el plan de victoria ── */
  if(planId === "burn"){
    const fuentes = valores.filter(x => (x.c.quema ?? 0) > 0);
    let dano = fuentes.reduce((s, x) => s + x.c.quema * funciona(x), 0);
    const amp = valores.filter(x => x.c.amplif).reduce((s, x) => s + funciona(x), 0);
    dano += Math.min(amp, 1) * 300 * Math.min(6, fuentes.length * 1.5);
    const viab = Math.min(1, dano / 6500);
    const def = bloqueoTotal + 0.5 * muros;
    T.plan = -45 * (1 - viab) - 6 * Math.max(0, 3 - def);
    T.plan += Math.min(4, Math.max(0, nReal - tam)) * 0.9;        // alargar: el rival se queda sin mazo antes
    T.dano = dano;
  } else if(planId === "bind"){
    const binds = hay("Gravity Bind");
    const bajo = valores.reduce((s, x) => s + (x.c.roles.includes("bajoBind") ? funciona(x) * (x.c.nombre === "Injection Fairy Lily" ? 1.5 : 1) : 0), 0);
    /* el plan existe si la Bind llega a tiempo (una sola copia es una
       moneda al aire) y si hay con qué atacar por debajo */
    const pBind = pAlMenos(n, VENTANA, binds, 1);
    T.plan = binds ? -32 * (1 - Math.min(1, bajo / 3.5)) - 28 * (1 - pBind) : -50;
  } else if(planId === "control"){
    T.plan = -1.6 * Math.max(0, 3 - muros) - 1.2 * Math.max(0, 2 - T1);
  } else {
    T.plan = -1.4 * Math.max(0, 3 - grandes);
  }
  /* Durante el draft la estructura (cuerpos, curva, coberturas) pesa
     poco al principio y del todo al final: con 54 picks para 20 huecos
     sobra tiempo para arreglar la curva, y medido con partidas, perseguirla
     pronto hacía coger peores cartas (medir-draft.mjs). */
  const pe = ctx.pesoEstructura ?? 1;
  if(pe !== 1) for(const k of ["remocion","sets","antiBind","muros","combate","cuerpos","tributos","manos"]) T[k] *= pe;
  T.oferta = P.oferta + (ctx.sesgo?.[planId] ?? 0);
  /* Para medir cuánto aporta cada término (medir-draft.mjs), igual que
     GOAT_AI_OFF en el cerebro: GOAT_DRAFT_SIN=remocion,combate… */
  if(SIN) for(const k of SIN) if(k in T) T[k] = 0;
  const total = Object.entries(T).filter(([k]) => k !== "dano").reduce((s, [, x]) => s + x, 0);
  return { total, T, valores, n: nReal };
}

/* P(ninguna de las K buenas en k robos de n) */
const CACHE_SIN = new Map();
function ratioSin(n, K, k){
  const clave = n * 10000 + Math.max(0, K) * 10 + k;
  let r = CACHE_SIN.get(clave);
  if(r === undefined){ r = 1 - pAlMenos(n, k, Math.max(0, K), 1); CACHE_SIN.set(clave, r); }
  return r;
}

/* El acceso que tendría la carta si tuviera las piezas que le faltan (una copia de cada). */
function accesoSiTuviera(c, cuenta, n, mazo, faltan){
  const otra = new Map(cuenta);
  for(const p of faltan) if(!p.startsWith("(")) otra.set(p, Math.max(1, otra.get(p) ?? 0));
  const extra = faltan.some(p => p.startsWith("(")) ? [] : [];
  return accesoEnMazo(c, otra, n, [...mazo, ...extra]).acceso || (faltan.some(p => p.startsWith("(")) ? 0.3 : 0);
}

/* ── CONSTRUIR ──
   Greedy con paquetes (una carta + las piezas que la habilitan entran
   juntas) y después cambios uno por uno mientras mejore. `pool` es un
   array de cartas (instancias). Devuelve el mejor mazo para ESE plan. */
export function construir(pool, planId, ctx, { cambios = 2, maxExtra = 4, opcionesCambio = null } = {}){
  const tam = ctx.tam ?? 20;
  const fuera = [...pool];
  const dentro = [];
  const ev = m => evaluarMazo(m, planId, ctx).total;
  let actual = ev(dentro);
  const sacar = (arr, nombre) => { const i = arr.findIndex(x => x.nombre === nombre); return i >= 0 ? arr.splice(i, 1)[0] : null; };
  for(let paso = 0; paso < tam + maxExtra; paso++){
    let mejor = null;
    const probados = new Set();
    /* Solo se prueban las más prometedoras (cota barata: base × plan) y las
       que tienen rutas (pueden entrar en paquete). Probarlas todas en cada
       paso era el 80 % del tiempo de un pick. */
    const distintas = [];
    for(const c of fuera){ if(probados.has(c.nombre)) continue; probados.add(c.nombre);
      if(ctx.formato.get(c.nombre)?.ok) distintas.push(c); }
    const cota = c => c.base * multPlan(c, planId);
    distintas.sort((a, b) => cota(b) - cota(a));
    const aProbar = distintas.filter((c, i) => i < 16 || c.rutas.length || c.gravekeeper);
    for(const c of aProbar){
      /* la carta sola */
      let cand = [c];
      let t = ev([...dentro, c]);
      /* y con las piezas que le faltan, si están en el pool */
      for(const r of c.rutas){
        const piezas = (r.piezas ?? []).filter(p => !dentro.some(x => x.nombre === p) && p !== c.nombre);
        if(!piezas.length) continue;
        const resto = fuera.filter(x => x !== c);
        const paquete = [c];
        for(const p of piezas){ const x = resto.find(y => y.nombre === p && !paquete.includes(y)); if(x) paquete.push(x); }
        if(paquete.length === piezas.length + 1){
          const tp = ev([...dentro, ...paquete]);
          if((tp - actual) / paquete.length > t - actual){ t = actual + (tp - actual) / paquete.length; cand = paquete; }
        }
      }
      if(!mejor || t > mejor.t) mejor = { t, cand };
    }
    if(!mejor) break;
    const nuevo = ev([...dentro, ...mejor.cand]);
    if(dentro.length >= tam && nuevo <= actual + 0.05) break;
    for(const c of mejor.cand){ dentro.push(c); fuera.splice(fuera.indexOf(c), 1); }
    actual = nuevo;
    if(dentro.length >= tam + maxExtra) break;
  }
  /* Si el pool no da para el mínimo con cartas jugables (no pasa con 54
     picks, pero el humano puede quitar), se completa con lo mejor que
     quede para que el mazo sea legal. */
  while(dentro.length < tam && fuera.length){
    fuera.sort((a, b) => (ctx.formato.get(b.nombre)?.ok ? b.base : -1) - (ctx.formato.get(a.nombre)?.ok ? a.base : -1));
    dentro.push(fuera.shift());
  }
  actual = ev(dentro);
  /* cambios 1×1 */
  for(let pasada = 0; pasada < cambios; pasada++){
    let mejoro = false;
    const cotaC = c => c.base * multPlan(c, planId);
    const nombres = [...new Set([...fuera].sort((a, b) => cotaC(b) - cotaC(a)).map(x => x.nombre))]
      .filter((n, i) => i < (opcionesCambio ?? 99));
    for(let i = 0; i < dentro.length; i++){
      let mejor = null;
      for(const nom of nombres){
        const c = fuera.find(x => x.nombre === nom);
        if(!c || !ctx.formato.get(nom)?.ok || nom === dentro[i].nombre) continue;
        const prueba = [...dentro]; prueba[i] = c;
        const t = ev(prueba);
        if(t > actual + 0.05 && (!mejor || t > mejor.t)) mejor = { t, c };
      }
      if(mejor){
        fuera.push(dentro[i]); dentro[i] = mejor.c; fuera.splice(fuera.indexOf(mejor.c), 1);
        actual = mejor.t; mejoro = true;
      }
    }
    /* y quitar lo que sobra por encima del mínimo */
    for(let i = dentro.length - 1; i >= 0 && dentro.length > tam; i--){
      const prueba = dentro.filter((_, j) => j !== i);
      const t = ev(prueba);
      if(t > actual + 0.05){ fuera.push(dentro[i]); dentro.splice(i, 1); actual = t; mejoro = true; }
    }
    if(!mejoro) break;
  }
  const e = evaluarMazo(dentro, planId, ctx);
  return { plan: planId, main: dentro, resto: fuera, total: e.total, T: e.T, valores: e.valores };
}

/* El mejor mazo de los cuatro planes. */
export function mejorMazo(pool, ctx, opciones){
  const todos = NOMBRES_PLAN.map(p => construir(pool, p, ctx, opciones));
  todos.sort((a, b) => b.total - a.total);
  return { mejor: todos[0], todos };
}

/* ── EL SIDE ──
   Todo lo que no va al main queda en el side (en limitado el pool entero
   es tuyo). Se ordena por lo que puede aportar entre partidas. */
export function ordenarSide(resto){
  const peso = c => (c.roles.includes("side") ? 3 : 0) + (c.roles.includes("antiBind") ? 2 : 0)
                  + (c.roles.includes("remocion") ? 1.5 : 0) + c.base / 4;
  return [...resto].sort((a, b) => peso(b) - peso(a));
}

/* ── EL PLAN QUE SE LLEVA EL DUELO ──
   Lo mismo que `ai/plan.js` escribe a mano para los 20 mazos de Goat,
   sacado del mazo construido. Así draft, construcción y partida comparten
   el modelo: un burn construido juega a quemar y un control no se niega
   a atacar esperando el valor máximo. */
export function planParaDuelo(construido){
  const nombres = construido.main.map(c => c.nombre);
  const hay = n => nombres.includes(n);
  const top = (f, k) => [...new Set(construido.valores.filter(x => f(x.c)).sort((a,b) => b.v - a.v).map(x => x.c.nombre))].slice(0, k);
  const claves = {};
  const sostener = [];
  const motor = [];
  let base;
  if(construido.plan === "burn"){
    base = { nombre:"Draft · Burn", objetivo:"quema", agresivo:0.2, aguanta:true,
             condicion:"quemar desde detrás de los bloqueos: sus LP son el reloj",
             pasos:["poner bloqueos (Gravity Bind, Swords, muros) antes que nada",
                    "proteger las fuentes de daño que se quedan en el campo",
                    "no regalar un Lava Golem si su ataque te gana a ti"] };
    for(const n of top(c => (c.quema ?? 0) > 0, 4)) claves[n] = 2;
    for(const n of ["Gravity Bind","Nightmare Wheel","Dark Room of Nightmare","Mirror Wall","Skull Invitation"]) if(hay(n)) sostener.push(n);
  } else if(construido.plan === "bind"){
    base = { nombre:"Draft · Bind", objetivo:"beatdown", agresivo:0.6, aguanta:false,
             condicion:"Gravity Bind puesto y atacar con lo que pasa por debajo",
             pasos:["Gravity Bind cuanto antes","atacar con Lily y los de nivel ≤3","guardar la remoción para lo que pase la Bind"] };
    if(hay("Gravity Bind")) { claves["Gravity Bind"] = 3; sostener.push("Gravity Bind"); }
    for(const n of top(c => c.roles.includes("bajoBind"), 3)) claves[n] = 2;
  } else if(construido.plan === "control"){
    base = { nombre:"Draft · Control", objetivo:"control", agresivo:0.5, aguanta:false,
             condicion:"ventaja con monstruos de tributo de calidad y remoción guardada para lo que importa",
             pasos:["aguantar con muros mientras salen los tributos","atacar cuando el intercambio favorece","no gastar la remoción en lo que no amenaza"] };
    for(const n of top(c => c.tributos === 1 || c.roles.includes("remocion"), 4)) claves[n] = 2;
  } else {
    base = { nombre:"Draft · Beatdown", objetivo:"beatdown", agresivo:0.8, aguanta:false,
             condicion:"presión constante con monstruos que pasen sus muros y remoción para lo que estorbe",
             pasos:["invocar el monstruo que gane más combates","quitar lo que frene el ataque","guardar las trampas para su jugada fuerte"] };
    for(const n of top(c => c.roles.includes("grande"), 3)) claves[n] = 2;
  }
  if(hay("Destiny Board")){ claves["Destiny Board"] = 3; sostener.push("Destiny Board"); }
  if(hay("Necrovalley")) sostener.push("Necrovalley");
  for(const n of ["Gravekeeper's Spy","Guardian Sphinx","4-Starred Ladybug of Doom"]) if(hay(n)) motor.push(n);
  const volteos = hay("Guardian Sphinx") || nombres.filter(n => n === "Gravekeeper's Spy").length >= 2;
  return { ...base, claves, motor, sostener, volteos, senal: [], minimo: 0 };
}

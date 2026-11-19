/* ══════════════════════════════════════════════════════════════════
   LA MESA DEL DRAFT

   N asientos (por defecto 18: tú y 17 bots), 6 sobres de 9 cartas.
   Se abre un sobre por asiento a la vez; cada uno coge una carta y pasa
   el resto. Todos los picks de un paso se deciden con el estado de ANTES
   del pase (simultáneos de verdad) y después se pasa: a la izquierda en
   los sobres 1, 3 y 5 y a la derecha en el 2, 4 y 6. No se abre el
   siguiente hasta agotar el actual. 6 × 9 = 54 picks por jugador.

   Con 18 asientos y 9 cartas un sobre recorre la mitad de la mesa y no
   vuelve: no hay «wheel». Las señales salen de lo que llega tarde.

   Cada carta de cada sobre es una INSTANCIA con su propio uid: así se
   comprueba que se elige una sola vez y que el mazo final conserva
   exactamente lo que se drafteó.

   El estado es JSON plano: se guarda en localStorage y se reanuda donde
   se quedó.
   ══════════════════════════════════════════════════════════════════ */
import { crearAzar, hashTexto } from "./azar.js";
import { abrirSobre, porRareza, MODELO_SOBRE } from "./sobres.js";

export const MESA_VERSION = 1;
export const CONFIG_DRAFT = {
  asientos: 18, humano: 0, sobres: 6, cartasPorSobre: 9,
  mainMin: 20,          // limitado: mínimo de 20, editable
  limiteCopias: null,   // sin límite de copias ni banlist en el draft
  lp: 8000, bo: 3,
  rondasEvento: 5,
  minutosRonda: 45, turnosExtra: 3,
  modelo: MODELO_SOBRE,
  entrenamiento: false, // explicar mis picks durante el draft
};

export function nuevaMesa(rp02, opciones = {}){
  const cfg = { ...CONFIG_DRAFT, ...opciones };
  const semilla = String(opciones.semilla ?? Date.now());
  const st = {
    v: MESA_VERSION, semilla, cfg,
    ronda: 0, paso: 0, terminado: false,
    azarProducto: hashTexto(`${semilla}|producto`),
    instancias: {},            // uid → id de carta
    sobres: [],                // por asiento: uids del sobre que tiene ahora
    origen: [],                // por asiento: qué asiento abrió el sobre que tiene
    picks: Array.from({ length: cfg.asientos }, () => []),
    vistos: Array.from({ length: cfg.asientos }, () => []),
    log: [],
  };
  abrirRonda(st, rp02);
  return st;
}

function abrirRonda(st, rp02){
  const azar = crearAzar(st.azarProducto);
  const porR = porRareza(rp02.cartas);
  st.sobres = []; st.origen = [];
  for(let a = 0; a < st.cfg.asientos; a++){
    const ids = abrirSobre(porR, azar, st.cfg.modelo);
    st.sobres.push(ids.map((id, k) => { const uid = `r${st.ronda}a${a}c${k}`; st.instancias[uid] = id; return uid; }));
    st.origen.push(a);
  }
  st.azarProducto = azar.estado();
  st.paso = 0;
}

export const direccion = ronda => ronda % 2 === 0 ? "izquierda" : "derecha";

/* ── LA VISTA DE UN ASIENTO ──
   Lo único que la IA recibe. Sin pools rivales, sin sobres de otros, sin
   el estado del generador. Copias, nunca referencias al estado. */
export function vistaDe(st, asiento){
  const cfg = st.cfg;
  return {
    asiento, nAsientos: cfg.asientos, ronda: st.ronda, paso: st.paso, dir: direccion(st.ronda),
    sobre: st.sobres[asiento].map(uid => st.instancias[uid]),
    misPicks: st.picks[asiento].map(uid => st.instancias[uid]),
    vistos: st.vistos[asiento].map(v => ({ ...v, ids: [...v.ids] })),
    cfg: { sobres: cfg.sobres, cartasPorSobre: cfg.cartasPorSobre, mainMin: cfg.mainMin, modelo: cfg.modelo,
           asientos: cfg.asientos },
  };
}

/* ── UN PASO ──
   `elecciones[asiento]` = índice dentro de su sobre. Todos se aplican a la
   vez y luego se pasa. `registros[asiento]` (opcional) va al log. */
export function aplicarPaso(st, rp02, elecciones, registros = {}){
  if(st.terminado) throw new Error("el draft ya ha terminado");
  const N = st.cfg.asientos;
  for(let a = 0; a < N; a++){
    const i = elecciones[a];
    if(!(i >= 0 && i < st.sobres[a].length)) throw new Error(`asiento ${a}: elección ${i} fuera del sobre`);
  }
  /* lo que cada uno ve ANTES de elegir */
  for(let a = 0; a < N; a++){
    st.vistos[a].push({ ronda: st.ronda, paso: st.paso, dir: direccion(st.ronda), sobre: st.origen[a],
                        ids: st.sobres[a].map(uid => st.instancias[uid]),
                        mio: st.instancias[st.sobres[a][elecciones[a]]] });
  }
  for(let a = 0; a < N; a++){
    const uid = st.sobres[a].splice(elecciones[a], 1)[0];
    st.picks[a].push(uid);
    st.log.push({ asiento: a, ronda: st.ronda, paso: st.paso, uid, id: st.instancias[uid], ...(registros[a] ?? {}) });
  }
  /* el pase */
  const sentido = st.ronda % 2 === 0 ? 1 : -1;
  const nuevos = new Array(N), nuevoOrigen = new Array(N);
  for(let a = 0; a < N; a++){
    const destino = ((a + sentido) % N + N) % N;
    nuevos[destino] = st.sobres[a];
    nuevoOrigen[destino] = st.origen[a];
  }
  st.sobres = nuevos; st.origen = nuevoOrigen;
  st.paso++;
  if(st.sobres.every(s => s.length === 0)){
    st.ronda++;
    if(st.ronda >= st.cfg.sobres){ st.terminado = true; st.sobres = Array.from({ length: N }, () => []); }
    else abrirRonda(st, rp02);
  }
  return st;
}

/* El pool de un asiento, como ids (con repeticiones). */
export const poolDe = (st, asiento) => st.picks[asiento].map(uid => st.instancias[uid]);

/* Comprobación de integridad: cada instancia elegida una sola vez y todas
   elegidas al terminar. */
export function integridad(st){
  const vistos = new Set();
  for(const p of st.picks) for(const uid of p){ if(vistos.has(uid)) return { ok:false, motivo:`${uid} elegida dos veces` }; vistos.add(uid); }
  if(st.terminado){
    const todas = Object.keys(st.instancias);
    if(todas.length !== vistos.size) return { ok:false, motivo:`${todas.length - vistos.size} cartas sin elegir` };
    const n = st.cfg.sobres * st.cfg.cartasPorSobre;
    if(st.picks.some(p => p.length !== n)) return { ok:false, motivo:"algún jugador no tiene todos sus picks" };
  }
  return { ok:true };
}

export function sanearMesa(st){
  if(!st || st.v !== MESA_VERSION || !Array.isArray(st.picks)) return null;
  return st;
}

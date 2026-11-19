/* ══════════════════════════════════════════════════════════════════
   EL EVENTO DEL DRAFT — suizo con byes, empates y desempates

   · Emparejamiento por puntos sin repetir rival (con vuelta atrás); la
     primera ronda, al azar con la semilla del evento.
   · Número impar de jugadores (o alguien que se retira): bye al de menos
     puntos que aún no lo haya tenido. Un bye cuenta como victoria 2-0 y
     NO entra en los porcentajes de rivales.
   · Match: victoria 3, empate 1, derrota 0. Un match puede acabar en
     empate (1-1 con el tiempo cumplido, o una partida empatada).
   · Desempates (los de los torneos de Konami): puntos → OMW% (media del
     % de victorias en matches de tus rivales, con suelo de 33 %) →
     OOMW% (lo mismo con los rivales de tus rivales) → GW% (tus partidas).
     Se enseñan en la clasificación.

   Ojo con el reloj: la Tournament Policy 2.5 (sept. 2025) de Konami ya no
   da turnos extra (un match sin decidir es doble derrota). E dice que su
   tienda juega 45 min y luego turnos: eso es lo que se usa, editable.
   ══════════════════════════════════════════════════════════════════ */
import { azarDe } from "./azar.js";

export const PUNTOS = { victoria:3, empate:1, derrota:0 };

export function nuevoEvento({ jugadores, rondas = 5, semilla = "evento" }){
  return { v:1, semilla, rondas, ronda:0, fase:"rondas",
           jugadores: jugadores.map(j => ({ ...j, retirado:false })),
           mesas: [], historial: [] };
}

/* registro de un jugador: puntos, matches, partidas */
export function registro(ev, id){
  let puntos = 0, mg = 0, mp = 0, me = 0, pg = 0, pp = 0, pe = 0, rivales = [], byes = 0;
  /* las rondas cerradas y lo ya apuntado de la ronda en juego */
  for(const r of [...ev.historial, ev.mesas]) for(const m of r){
    if(m.bye === id){ if(!m.resultado) continue; puntos += 3; mg++; pg += 2; byes++; continue; }
    if(m.a !== id && m.b !== id) continue;
    if(!m.resultado) continue;
    const yoA = m.a === id;
    const g = yoA ? m.resultado.ga : m.resultado.gb, p = yoA ? m.resultado.gb : m.resultado.ga;
    pg += g; pp += p; pe += m.resultado.empates ?? 0;
    rivales.push(yoA ? m.b : m.a);
    if(g > p){ puntos += 3; mg++; } else if(g < p){ mp++; } else { puntos += 1; me++; }
  }
  return { puntos, ganados:mg, perdidos:mp, empatados:me, pg, pp, pe, rivales, byes };
}
const pctMatch = r => { const n = r.ganados + r.perdidos + r.empatados - r.byes; if(n <= 0) return 1/3;
  return Math.max(1/3, (3 * (r.ganados - r.byes) + r.empatados) / (3 * n)); };

export function clasificacion(ev){
  const reg = new Map(ev.jugadores.map(j => [j.id, registro(ev, j.id)]));
  const omw = id => { const r = reg.get(id); if(!r.rivales.length) return 1/3;
    return r.rivales.reduce((s, x) => s + pctMatch(reg.get(x)), 0) / r.rivales.length; };
  const oomw = id => { const r = reg.get(id); if(!r.rivales.length) return 1/3;
    return r.rivales.reduce((s, x) => s + omw(x), 0) / r.rivales.length; };
  const filas = ev.jugadores.map(j => {
    const r = reg.get(j.id);
    const partidas = r.pg + r.pp + r.pe;
    return { id:j.id, nombre:j.nombre, yo:!!j.yo, retirado:j.retirado, ...r,
             omw: omw(j.id), oomw: oomw(j.id), gw: partidas ? Math.max(1/3, r.pg / partidas) : 1/3 };
  });
  filas.sort((a, b) => b.puntos - a.puntos || b.omw - a.omw || b.oomw - a.oomw || b.gw - a.gw || a.id - b.id);
  return filas;
}

/* ── EMPAREJAR LA RONDA SIGUIENTE ── */
export function emparejar(ev){
  const activos = ev.jugadores.filter(j => !j.retirado).map(j => j.id);
  const azar = azarDe(`${ev.semilla}|ronda|${ev.ronda}`);
  let orden;
  if(ev.ronda === 0){
    orden = [...activos];
    for(let i = orden.length - 1; i > 0; i--){ const k = Math.floor(azar() * (i + 1)); [orden[i], orden[k]] = [orden[k], orden[i]]; }
  } else {
    const cl = clasificacion(ev).filter(f => activos.includes(f.id));
    /* mismo número de puntos: orden al azar dentro del grupo */
    const ruido = new Map(cl.map(f => [f.id, azar()]));
    orden = cl.sort((a, b) => b.puntos - a.puntos || ruido.get(a.id) - ruido.get(b.id)).map(f => f.id);
  }
  const yaJugaron = new Set();
  for(const r of ev.historial) for(const m of r) if(m.a !== undefined && m.b !== undefined){ yaJugaron.add(`${m.a}|${m.b}`); yaJugaron.add(`${m.b}|${m.a}`); }
  const mesas = [];
  let bye = null;
  if(orden.length % 2 === 1){
    const tuvo = new Set(ev.historial.flat().filter(m => m.bye !== undefined).map(m => m.bye));
    for(let i = orden.length - 1; i >= 0; i--) if(!tuvo.has(orden[i])){ bye = orden[i]; break; }
    bye ??= orden.at(-1);
    orden = orden.filter(x => x !== bye);
  }
  const pares = [];
  const usado = new Set();
  function bt(i){
    while(i < orden.length && usado.has(orden[i])) i++;
    if(i >= orden.length) return true;
    const a = orden[i]; usado.add(a);
    for(let j = i + 1; j < orden.length; j++){
      const b = orden[j];
      if(usado.has(b) || yaJugaron.has(`${a}|${b}`)) continue;
      usado.add(b); pares.push([a, b]);
      if(bt(i + 1)) return true;
      pares.pop(); usado.delete(b);
    }
    usado.delete(a);
    return false;
  }
  if(!bt(0)){                       // sin solución sin repetir: se permite repetir
    pares.length = 0; for(let i = 0; i < orden.length; i += 2) pares.push([orden[i], orden[i + 1]]);
  }
  pares.forEach(([a, b], k) => mesas.push({ mesa: k + 1, a, b, resultado: null }));
  if(bye !== null) mesas.push({ mesa: mesas.length + 1, bye, resultado: { bye:true } });
  ev.mesas = mesas;
  return mesas;
}

/* Resultado de una mesa: partidas ganadas por cada uno (+ empatadas). */
export function apuntar(ev, mesa, { ga, gb, empates = 0, motivo = "" }){
  const m = ev.mesas.find(x => x.mesa === mesa);
  if(!m || m.bye !== undefined) throw new Error("mesa sin rival");
  m.resultado = { ga, gb, empates, motivo };
}
export const rondaCompleta = ev => ev.mesas.length > 0 && ev.mesas.every(m => m.resultado);
export function cerrarRonda(ev){
  if(!rondaCompleta(ev)) throw new Error("quedan mesas por jugar");
  ev.historial.push(ev.mesas.map(m => ({ ...m })));
  ev.mesas = [];
  ev.ronda++;
  if(ev.ronda >= ev.rondas) ev.fase = "fin";
}
export function retirar(ev, id){
  const j = ev.jugadores.find(x => x.id === id); if(j) j.retirado = true;
}
export const mesaDe = (ev, id) => ev.mesas.find(m => m.a === id || m.b === id || m.bye === id) ?? null;

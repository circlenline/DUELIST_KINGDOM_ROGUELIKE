/* ══════════════════════════════════════════════════════════════════
   ¿SE PUEDE JUGAR? — tres preguntas distintas

     1. legalidad en el formato: ¿existe alguna ruta de invocación o de
        activación con las cartas del pool AUTORIZADO? (aquí, las 101 de
        RP02 y nada más: ni Polymerization, ni Relinquished, ni Blue-Eyes
        Ultimate Dragon).
     2. viabilidad en mi pool: ¿tengo las piezas? Si no, ¿qué
        probabilidad hay de conseguirlas en lo que queda de draft?
     3. conveniencia en mi mazo: con las piezas dentro, ¿con qué
        frecuencia llegan juntas a tiempo?

   Las rutas son AND (piezas), OR (alguna) y cuentas (n monstruos de una
   raza). Un ciclo de cartas que se necesitan entre sí solo es una ruta si
   alguna de ellas se puede jugar POR SÍ MISMA (una magia que se activa
   desde la mano, un monstruo que se invoca normal): si no, ninguna
   arranca y el ciclo no vale.
   ══════════════════════════════════════════════════════════════════ */
import { RAZA } from "./cartas.js";

export const CATEGORIA = {
  1: "no habilitable en el formato",
  2: "habilitable, pero no en mi pool",
  3: "habilitada, pero poco consistente",
  4: "operativa",
};


/* Análisis del FORMATO: qué cartas tienen al menos una ruta válida con el
   pool autorizado. `porNombre` es Map nombre → carta (solo las del pool). */
export function analizarFormato(porNombre){
  const memo = new Map();
  function habilitable(nombre, pila){
    const c = porNombre.get(nombre);
    if(!c) return { ok:false, motivo:`«${nombre}» no está en el pool` };
    if(memo.has(nombre)) return memo.get(nombre);
    if(pila.has(nombre)) return { ok:false, motivo:"ciclo sin inicio legal" };
    if(!c.rutas.length){
      const r = c.esMonstruo && c.tributos === null
        ? { ok:false, motivo:"no se puede invocar sin una ruta" } : { ok:true, motivo:"" };
      memo.set(nombre, r); return r;
    }
    pila.add(nombre);
    let mejor = null;
    for(const ruta of c.rutas){
      const falla = falloDeRuta(ruta, pila);
      if(!falla){ mejor = { ok:true, motivo:"" }; break; }
      mejor ??= { ok:false, motivo: `${ruta.nota ?? "ruta"}: ${falla}` };
    }
    pila.delete(nombre);
    memo.set(nombre, mejor);
    return mejor;
  }
  function falloDeRuta(ruta, pila){
    /* Una pieza que solo tiene que ESTAR (en la mano, en el mazo, como
       material desde la mano) basta con que exista en el pool. Una que
       tiene que estar EN EL CAMPO (`enCampo`) tiene que poder salir:
       ahí es donde un ciclo sin inicio legal no vale. */
    for(const p of ruta.piezas ?? []){
      if(!porNombre.has(p)) return `${p} no está en el pool`;
      if(ruta.enCampo){
        const h = habilitable(p, pila);
        if(!h.ok) return `${p} (${h.motivo})`;
      }
    }
    if(ruta.alguna && !ruta.alguna.some(p => porNombre.has(p) && (!ruta.enCampo || habilitable(p, pila).ok)))
      return `ninguna de ${ruta.alguna.join(" / ")} está en el pool`;
    if(ruta.cuenta){
      const raza = RAZA[ruta.cuenta.raza];
      const hay = [...porNombre.values()].some(x => x.esMonstruo && x.raza === raza &&
                    x.nombre !== [...pila].at(-1) && habilitable(x.nombre, pila).ok);
      if(!hay) return `no hay monstruos de esa raza`;
    }
    return null;
  }
  const out = new Map();
  for(const n of porNombre.keys()) out.set(n, habilitable(n, new Set()));
  return out;
}

/* ── probabilidades de robo (hipergeométrica exacta) ── */
function ratio(n, s, k){            // C(n−s, k) / C(n, k)
  if(s <= 0) return 1;
  if(k > n - s) return 0;
  let r = 1;
  for(let i = 0; i < k; i++) r *= (n - s - i) / (n - i);
  return r;
}
/* P(al menos una copia de CADA grupo en k robos de n). copias = [c1, c2…] */
export function pTodas(n, k, copias){
  k = Math.min(k, n);
  if(copias.some(c => c <= 0)) return 0;
  const m = copias.length;
  let p = 0;
  for(let mask = 0; mask < (1 << m); mask++){
    let s = 0, bits = 0;
    for(let i = 0; i < m; i++) if(mask & (1 << i)){ s += copias[i]; bits++; }
    p += (bits % 2 ? -1 : 1) * ratio(n, s, k);
  }
  return Math.max(0, Math.min(1, p));
}
/* P(X ≥ m) con X hipergeométrica: K buenas en n, k robos. */
export function pAlMenos(n, k, K, m){
  k = Math.min(k, n);
  if(m <= 0) return 1;
  if(K < m) return 0;
  const lc = (a, b) => { if(b < 0 || b > a) return -Infinity; let s = 0; for(let i = 0; i < b; i++) s += Math.log((a - i) / (i + 1)); return s; };
  const total = lc(n, k);
  let p = 0;
  for(let x = m; x <= Math.min(K, k); x++){
    const l = lc(K, x) + lc(n - K, k - x) - total;
    if(l > -Infinity) p += Math.exp(l);
  }
  return Math.max(0, Math.min(1, p));
}

/* Ventana de juego: lo que llega a la mano en una partida normal de
   limitado (5 de salida + ~6 robos). Las piezas que tienen que juntarse
   en la mano se miden aquí. */
export const VENTANA = 11;

/* ¿Con qué frecuencia funciona esta carta en ESTE mazo cuando la robas?
   Devuelve { acceso 0..1, faltan: [piezas que no están en el mazo] }.
   `cuenta` = Map nombre → copias en el mazo; `n` = tamaño del mazo;
   `mazo` = las cartas (para contar razas). */
export function accesoEnMazo(c, cuenta, n, mazo){
  if(!c.rutas.length) return { acceso:1, faltan:[] };
  let mejor = { acceso:0, faltan:null };
  for(const ruta of c.rutas){
    const faltan = (ruta.piezas ?? []).filter(p => !(cuenta.get(p) > 0));
    let acc;
    if(ruta.enMazo){
      acc = faltan.length ? 0 : 1;               // Destiny Board coge las letras del mazo
    } else if(ruta.piezas){
      const presentes = ruta.piezas.filter(p => cuenta.get(p) > 0).map(p => cuenta.get(p));
      acc = faltan.length ? 0 : pTodas(n - 1, VENTANA - 1, presentes);
      if(ruta.tributosNivel) acc *= 0.65;        // además hay que juntar 8 niveles de tributo
    } else if(ruta.alguna){
      const K = ruta.alguna.reduce((s, p) => s + (cuenta.get(p) ?? 0), 0);
      acc = K ? pAlMenos(n - 1, VENTANA - 1, K, 1) : 0;
      if(!K) faltan.push(ruta.alguna[0]);
    } else if(ruta.condicion){
      acc = ruta.acceso ?? 0.6;                    // depende de la mesa, no de mis cartas
    } else if(ruta.cuenta){
      const raza = RAZA[ruta.cuenta.raza];
      const K = mazo.filter(x => x.esMonstruo && x.raza === raza && x.nombre !== c.nombre).length;
      if(ruta.cuenta.enCementerio){
        /* Que caigan 3 al cementerio: hace falta haberlos robado y que
           mueran. Aproximación: robar n+1 en 13 cartas, 75 % de que caigan. */
        acc = pAlMenos(n - 1, 13, K, ruta.cuenta.n + 1) * 0.75 + pAlMenos(n - 1, 13, K, ruta.cuenta.n) * 0.15;
      } else {
        /* A la vez en el campo: robarlos y mantenerlos vivos. */
        acc = pAlMenos(n - 1, VENTANA - 1, K, ruta.cuenta.n) * 0.4;
      }
      if(!K) faltan.push(`(${ruta.cuenta.n} ${ruta.cuenta.raza})`);
    } else acc = 1;
    if(acc > mejor.acceso || mejor.faltan === null) mejor = { acceso:acc, faltan };
  }
  return { acceso: mejor.acceso, faltan: mejor.faltan ?? [] };
}

/* La categoría de una carta para mí, ahora. */
export function categoria(c, { formato, cuentaPool, acceso }){
  if(!formato.get(c.nombre)?.ok) return 1;
  const piezas = c.rutas.flatMap(r => r.piezas ?? []);
  const algunas = c.rutas.filter(r => r.alguna);
  const tengo = c.rutas.length === 0 || c.rutas.some(r =>
    (r.piezas ?? []).every(p => cuentaPool.get(p) > 0) &&
    (!r.alguna || r.alguna.some(p => cuentaPool.get(p) > 0)) &&
    (!r.cuenta || true));
  if(!tengo && (piezas.length || algunas.length)) return 2;
  if(acceso < 0.4) return 3;
  return 4;
}

/* ══════════════════════════════════════════════════════════════════
   EL MODO DRAFT, JUNTO — lo que usan la pantalla y las pruebas
   ══════════════════════════════════════════════════════════════════ */
import { catalogo } from "./cartas.js";
import { analizarFormato } from "./rutas.js";
import { mejorMazo, ordenarSide, planParaDuelo, evaluarMazo, PLANES } from "./mazo.js";
import { decidirPick, personalidad, categoriaDe } from "./picks.js";
import { vistaDe, aplicarPaso, poolDe } from "./mesa.js";

/* Catálogo + análisis del formato. El pool autorizado es el de rp02.json
   y nada más: si un modo futuro cambia el pool, se recalcula aquí. */
export function prepararDraft(rp02){
  const cat = catalogo(rp02);
  const porNombre = new Map(); for(const c of cat.values()) porNombre.set(c.nombre, c);
  const formato = analizarFormato(porNombre);
  return { rp02, cat, porNombre, formato };
}

/* Los picks de todos los bots en este paso, con su registro. El humano no
   se toca: su índice lo pone la pantalla. */
export function picksDeBots(st, D, { saltar = new Set() } = {}){
  const elecciones = {}, registros = {};
  for(let a = 0; a < st.cfg.asientos; a++){
    if(saltar.has(a)) continue;
    const vista = vistaDe(st, a);
    const perso = personalidad(st.semilla, a);
    const r = decidirPick(vista, { cat:D.cat, formato:D.formato, perso,
      semillaDecision: `${st.semilla}|decision|${a}|${st.ronda}|${st.paso}` });
    elecciones[a] = r.indice;
    /* para el log (se enseña al acabar el draft): lo justo para depurar sin
       llenar el guardado — las 5 mejores candidatas y el peso de cada plan */
    registros[a] = { motivo: r.explicacion,
      planes: r.planes.map(p => `${p.plan} ${p.total} (${Math.round(p.peso * 100)} %)`).join(" · "),
      candidatos: [...r.candidatos].sort((x, y) => y.valor - x.valor).slice(0, 5).map(c => `${c.nombre} ${c.valor}`) };
  }
  return { elecciones, registros };
}

/* La sugerencia para tu asiento (modo entrenamiento): la misma IA, con tu
   vista y sin personalidad. */
export function sugerirPick(st, D, asiento){
  const vista = vistaDe(st, asiento);
  const neutra = { sesgo:{ beatdown:0, control:0, burn:0, bind:0 }, riesgo:1, gustos:{}, ruido:0, rareDraft:false };
  return decidirPick(vista, { cat:D.cat, formato:D.formato, perso:neutra, semillaDecision:`sugerencia|${st.ronda}|${st.paso}` });
}

/* Un paso entero: bots + la elección del humano (índice o null si no hay humano). */
export function avanzar(st, D, eleccionHumano){
  const humano = st.cfg.humano;
  const saltar = humano !== null && humano !== undefined ? new Set([humano]) : new Set();
  const { elecciones, registros } = picksDeBots(st, D, { saltar });
  if(saltar.size){
    elecciones[humano] = eleccionHumano;
    registros[humano] = { motivo: "(tu pick)" };
  }
  aplicarPaso(st, D.rp02, elecciones, registros);
  return st;
}

/* ── CONSTRUIR TRAS EL DRAFT ──
   El mazo de un asiento: el mejor de los cuatro planes, con el side
   ordenado y el plan que se lleva el duelo. `ids` son las 54 cartas. */
export function construirMazo(ids, D, { mainMin = 20, perso = null } = {}){
  const pool = ids.map(id => D.cat.get(id));
  const ctx = { tam: mainMin, relleno: 0, futuro: () => 0, formato: D.formato,
                sesgo: perso ? perso.sesgo : {} };
  const { mejor, todos } = mejorMazo(pool, ctx, { cambios: 3 });
  const side = ordenarSide(mejor.resto);
  return {
    plan: mejor.plan, nombrePlan: PLANES[mejor.plan].nombre, total: mejor.total, T: mejor.T,
    main: mejor.main.map(c => c.id), extra: [], side: side.map(c => c.id),
    valores: mejor.valores.map(x => ({ id:x.c.id, nombre:x.c.nombre, v:+x.v.toFixed(2), por:x.por })),
    planes: todos.map(t => ({ plan:t.plan, total:+t.total.toFixed(1) })),
    planDuelo: planParaDuelo(mejor),
    sinRuta: pool.filter(c => !D.formato.get(c.nombre)?.ok).map(c => c.nombre),
  };
}
export function construirAsiento(st, D, asiento){
  return construirMazo(poolDe(st, asiento), D, { mainMin: st.cfg.mainMin, perso: personalidad(st.semilla, asiento) });
}

/* Evaluar un mazo que ha hecho el humano a mano (para la pantalla de
   construcción: «tu mazo vale X; el sugerido, Y»). */
export function evaluarMain(mainIds, D, { mainMin = 20 } = {}){
  const main = mainIds.map(id => D.cat.get(id));
  const ctx = { tam: mainMin, relleno: 0, futuro: () => 0, formato: D.formato, sesgo:{} };
  const planes = Object.keys(PLANES).map(p => ({ plan:p, ...evaluarMazo(main, p, ctx) }))
    .sort((a, b) => b.total - a.total);
  return { plan: planes[0].plan, total: planes[0].total, T: planes[0].T,
           valores: planes[0].valores.map(x => ({ id:x.c.id, nombre:x.c.nombre, v:+x.v.toFixed(2), por:x.por })),
           planDuelo: planParaDuelo({ plan: planes[0].plan, main, valores: planes[0].valores }) };
}

export { categoriaDe };
/* (En el HTML todos los módulos del draft van en un mismo ámbito, así que
   la pantalla los ve sin reexportar nada: ver build-html.mjs · juntarDraft.) */

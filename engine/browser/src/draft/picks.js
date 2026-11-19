/* ══════════════════════════════════════════════════════════════════
   ELEGIR UNA CARTA DEL SOBRE — como un jugador competente de limitado

   El valor de un pick es lo que MEJORA EL MEJOR MAZO que puedo construir,
   no la nota de la carta:

     valor(c) = Σ_plan peso(plan) · [ mazo(pool + c) − mazo(pool) ]  + side

   · «mazo» es `evaluarMazo` (mazo.js): la carta vale allí según su plan,
     su acceso, sus conflictos y las piezas que le faltan. Una carta que
     depende de otra que no tengo vale su valor × la probabilidad de
     conseguir esa pieza en lo que queda (`futuro`), descontada por la
     competencia y por lo que dicen las señales. Al final del draft esa
     probabilidad es 0: lo que no se puede habilitar no vale nada.
   · Los cuatro planes viven a la vez con pesos suaves (softmax): al
     principio se reparten, al final manda el mejor. Nadie decide «en el
     sobre 3 elijo arquetipo».
   · El bot SOLO ve su vista: su pool, los sobres que han pasado por sus
     manos, el tamaño de la mesa y el paso. Ni pools rivales, ni sobres
     futuros, ni el generador. `vistaDe` (mesa.js) es lo único que recibe.
   ══════════════════════════════════════════════════════════════════ */
import { mejorMazo, construir, evaluarMazo, PLANES, NOMBRES_PLAN } from "./mazo.js";
import { probPorSobre } from "./sobres.js";
import { categoria, accesoEnMazo, CATEGORIA } from "./rutas.js";
import { azarDe } from "./azar.js";

/* Personalidad de un bot: preferencias SUAVES, nunca una etiqueta que le
   obligue a coger cartas malas. Sale de la semilla del asiento. */
export function personalidad(semilla, asiento){
  const r = azarDe(`${semilla}|personalidad|${asiento}`);
  const u = (a, b) => a + (b - a) * r();
  return {
    sesgo: { beatdown: u(-1.5, 1.5), control: u(-1.5, 1.5), burn: u(-2.5, 1.5), bind: u(-2.5, 1.5) },
    riesgo: u(0.8, 1.25),          // >1: especula más con piezas que aún no tiene
    gustos: { gravekeeper: u(0, 0.35), demonio: u(0, 0.35), iman: u(0, 0.25), ritual: u(0, 0.2) },
    ruido: u(0.02, 0.06),
    rareDraft: false,              // personalidad casual: desactivada por defecto
  };
}

/* Valor «público» de una carta: lo que cualquiera le da sin conocer tu
   pool. Solo sirve para estimar la competencia y leer señales. */
const valorPublico = (c, formato) => formato.get(c.nombre)?.ok ? c.base * (c.rutas.length ? 0.5 : 1) : 0;

/* ── SEÑALES ──
   De los sobres que he visto: cartas buenas de una familia que llegan
   tarde = esa familia está libre aguas arriba (en esa dirección). Si un
   sobre vuelve a mí (mesas pequeñas), lo que falta lo cogió alguien. */
const FAMILIAS = {
  gravekeeper: c => c.gravekeeper,
  demonio: c => c.demonio,
  burn: c => (c.quema ?? 0) > 0 || c.amplif,
  bloqueo: c => (c.bloqueo ?? 0) >= 1,
  bajoBind: c => c.roles.includes("bajoBind"),
  iman: c => c.paquete === "iman",
  remocion: c => c.roles.includes("remocion"),
};
export function leerSenales(vista, cat, formato){
  const s = { izquierda:{}, derecha:{} };
  for(const d of ["izquierda","derecha"]) for(const f in FAMILIAS) s[d][f] = 0;
  const vistosPorSobre = new Map();
  for(const v of vista.vistos){
    const clave = `${v.ronda}`;
    const tarde = Math.max(0, v.paso - 1) / 8;             // 0 en el primer pick, 1 en el último
    for(const id of v.ids){
      const c = cat.get(id); if(!c) continue;
      const vp = valorPublico(c, formato);
      if(vp < 3.5) continue;
      for(const f in FAMILIAS) if(FAMILIAS[f](c)) s[v.dir][f] += tarde * (vp / 10);
    }
    /* el mismo sobre que vuelve: lo que falta se lo llevaron */
    const prev = vistosPorSobre.get(`${clave}|${v.sobre}`);
    if(prev){
      const ahora = new Map(); for(const id of v.ids) ahora.set(id, (ahora.get(id) ?? 0) + 1);
      for(const id of prev.ids){
        if((ahora.get(id) ?? 0) > 0){ ahora.set(id, ahora.get(id) - 1); continue; }
        const c = cat.get(id); if(!c || prev.mio === id) continue;
        for(const f in FAMILIAS) if(FAMILIAS[f](c)) s[v.dir][f] -= 0.25;
      }
    }
    vistosPorSobre.set(`${clave}|${v.sobre}`, v);
  }
  /* normalizar por cuántos sobres he visto en cada dirección */
  for(const d of ["izquierda","derecha"]){
    const n = Math.max(1, vista.vistos.filter(v => v.dir === d).length);
    for(const f in FAMILIAS) s[d][f] /= Math.sqrt(n);
  }
  return s;
}

/* ── LO QUE PUEDE LLEGAR ──
   Probabilidad de conseguir una carta concreta en lo que me queda de
   draft, con la tasa de aparición del modelo de sobres (pública), la
   posición en cada sobre y la competencia de la mesa. Nunca mira el
   contenido real de un sobre aún cerrado. */
export function crearFuturo(vista, cat, formato, senales, riesgo = 1){
  const { ronda, paso, cfg } = vista;
  const porSobre = probPorSobre(cfg.modelo);
  const porNombre = new Map(); for(const c of cat.values()) porNombre.set(c.nombre, c);
  const quedan = [];
  /* picks que me quedan después de este: (paso, ronda) */
  for(let r = ronda; r < cfg.sobres; r++)
    for(let p = (r === ronda ? paso + 1 : 0); p < cfg.cartasPorSobre; p++) quedan.push({ r, p });
  const dirDe = r => r % 2 === 0 ? "izquierda" : "derecha";
  const cache = new Map();
  return nombre => {
    if(cache.has(nombre)) return cache.get(nombre);
    let res;
    if(nombre.startsWith("(")){
      /* una cuenta (3 Demonios…): crece con los picks que quedan */
      res = Math.min(0.9, quedan.length / 30);
    } else {
      const c = porNombre.get(nombre);
      if(!c || !formato.get(nombre)?.ok){ res = 0; }
      else {
        const q = porSobre[c.rareza] ?? 0;
        const vp = valorPublico(c, formato);
        let E = 0;
        for(const { r, p } of quedan){
          let toma = Math.min(0.55, 0.03 + 0.065 * Math.max(0, vp - 1.5));
          const sen = Object.keys(FAMILIAS).filter(f => FAMILIAS[f](c)).reduce((s, f) => s + (senales[dirDe(r)][f] ?? 0), 0);
          toma *= Math.exp(-0.8 * Math.max(-1, Math.min(2, sen)));
          E += q * Math.pow(1 - toma, p);
        }
        res = Math.min(0.95, (1 - Math.exp(-E)) * 0.85);
      }
    }
    res = Math.pow(res, 1 / riesgo);
    cache.set(nombre, res);
    return res;
  };
}

/* ── DECIDIR ──
   vista: lo que ve el asiento (mesa.js · vistaDe). Devuelve el índice
   elegido del sobre, los candidatos con su desglose y la explicación. */
export function decidirPick(vista, { cat, formato, perso, semillaDecision }){
  const pool = vista.misPicks.map(id => cat.get(id));
  const senales = leerSenales(vista, cat, formato);
  const futuro = crearFuturo(vista, cat, formato, senales, perso.riesgo);
  const hechos = vista.misPicks.length;
  const total = vista.cfg.sobres * vista.cfg.cartasPorSobre;
  const avance = hechos / total;
  /* relleno: lo que espero sacar en los huecos que aún no tengo. Baja
     con el draft: al final ya no hay huecos que rellenar con futuro. */
  const relleno = 2.6 * (1 - avance * 0.5);
  /* las señales empujan el plan, poco */
  const dirFutura = vista.ronda % 2 === 0 ? "derecha" : "izquierda";
  const sesgoSen = {
    burn: 0.8 * (senales[dirFutura].burn + senales[vista.dir].burn) / 2,
    bind: 0.8 * (senales[dirFutura].bajoBind + senales[vista.dir].bajoBind) / 2,
    control: 0, beatdown: 0,
  };
  const sesgo = {}; for(const p of NOMBRES_PLAN) sesgo[p] = (perso.sesgo[p] ?? 0) + (sesgoSen[p] ?? 0);
  const ctx = { tam: vista.cfg.mainMin, relleno, futuro, sesgo, formato, pesoEstructura: Math.min(1, 0.15 + avance) };

  const bases = {};
  for(const p of NOMBRES_PLAN){
    bases[p] = construir(pool, p, ctx, { cambios: pool.length >= 18 ? 1 : 0, opcionesCambio: 10 });
    const vs = bases[p].valores.map((x, j) => [x.v, j]).sort((a, b) => a[0] - b[0]);
    bases[p].flojas = vs.slice(0, 8).map(x => x[1]);
  }
  const tau = 7 - 5 * avance;
  const maxT = Math.max(...NOMBRES_PLAN.map(p => bases[p].total));
  const pesos = {}; let zs = 0;
  for(const p of NOMBRES_PLAN){ pesos[p] = Math.exp((bases[p].total - maxT) / tau); zs += pesos[p]; }
  for(const p of NOMBRES_PLAN) pesos[p] /= zs;

  const ev = (m, p) => evaluarMazo(m, p, ctx);
  const candidatos = [];
  const sobre = vista.sobre;
  const yaVisto = new Map();
  for(let i = 0; i < sobre.length; i++){
    const c = cat.get(sobre[i]);
    if(yaVisto.has(c.nombre)){ candidatos.push({ ...yaVisto.get(c.nombre), indice:i }); continue; }
    let valor = 0; const porPlan = {};
    for(const p of NOMBRES_PLAN){
      const b = bases[p];
      const main = b.main;
      /* un plan que casi no pesa no cambia la decisión: no se mide */
      if(pesos[p] < 0.02){ porPlan[p] = { delta: 0, mazo: main }; continue; }
      let mejorT = -Infinity, mejorM = null;
      /* añadirla (si aún cabe o si vale como carta 21+) */
      { const m = [...main, c]; const t = ev(m, p).total; if(t > mejorT){ mejorT = t; mejorM = m; } }
      /* o cambiarla por la peor del mazo */
      if(main.length >= ctx.tam){
        /* solo contra las más flojas del mazo: cambiarla por una buena nunca es la mejor opción */
        for(const j of b.flojas){
          const m = [...main]; m[j] = c;
          const t = ev(m, p).total;
          if(t > mejorT){ mejorT = t; mejorM = m; }
        }
      }
      /* o con una carta del pool que ella habilita (Curse ↔ Masked Beast, Spy ↔ Spy) */
      for(const x of b.resto){
        if(!x.rutas.some(r => (r.piezas ?? []).includes(c.nombre) || (r.alguna ?? []).includes(c.nombre))
           && !(c.rutas.some(r => (r.piezas ?? []).includes(x.nombre)))) continue;
        const m = [...main, c, x];
        const t = ev(m, p).total;
        if(t > mejorT){ mejorT = t; mejorM = m; }
      }
      const d = mejorT - b.total;
      porPlan[p] = { delta: d, mazo: mejorM };
      valor += pesos[p] * Math.max(d, -0.5);
    }
    /* side: lo que no entra en el main aún puede servir entre partidas */
    const side = (c.roles.includes("side") || c.roles.includes("antiBind")) && formato.get(c.nombre)?.ok ? 0.25 : 0;
    valor += side;
    /* desempate mínimo por calidad intrínseca jugable (nunca rescata lo imposible) */
    if(formato.get(c.nombre)?.ok) valor += 0.01 * c.base;
    /* preferencias suaves: solo entre cartas que mejoran algo */
    const fam = c.paquete && perso.gustos[c.paquete];
    if(fam && valor > 0) valor *= 1 + fam * 0.3;
    if(perso.rareDraft) valor += { SE:3, UR:2, SR:1, R:0.3, C:0 }[c.rareza] ?? 0;
    const cand = { indice:i, id:c.id, nombre:c.nombre, valor, porPlan, side };
    yaVisto.set(c.nombre, cand);
    candidatos.push(cand);
  }
  /* ruido pequeño y reproducible: Gumbel escalado al rango de valores.
     Una carta imposible (valor 0) no puede ganar a una buena por ruido. */
  const r = azarDe(semillaDecision);
  const maxV = Math.max(...candidatos.map(c => c.valor), 0.1);
  for(const c of candidatos){
    const g = -Math.log(-Math.log(Math.max(1e-9, r())));
    c.final = c.valor + perso.ruido * maxV * g * (c.valor > 0 ? 1 : 0);
  }
  const elegido = candidatos.reduce((a, b) => b.final > a.final ? b : a);
  const explicacion = explicar(elegido, candidatos, { bases, pesos, cat, formato, ctx, pool });
  return {
    indice: elegido.indice, id: elegido.id, explicacion,
    planes: NOMBRES_PLAN.map(p => ({ plan:p, total: +bases[p].total.toFixed(2), peso: +pesos[p].toFixed(3) })),
    candidatos: candidatos.map(c => ({ indice:c.indice, nombre:c.nombre, valor:+c.valor.toFixed(3),
      porPlan: Object.fromEntries(Object.entries(c.porPlan).map(([p, x]) => [p, +x.delta.toFixed(2)])) })),
  };
}

/* ── POR QUÉ ──
   La explicación sale de los términos que de verdad han cambiado en el
   mazo del plan que más pesa, no de una frase hecha. */
const ETIQUETA = { calidad:"calidad media", remocion:"respuestas a monstruos", sets:"respuestas a cartas tapadas",
  antiBind:"respuestas a un Gravity Bind", muros:"formas de pasar muros", cuerpos:"cuerpos", tributos:"tributos para tantos cuerpos",
  manos:"manos sin jugada", plan:"el plan de victoria", oferta:"" };
function explicar(el, candidatos, { bases, pesos, cat, formato, ctx, pool }){
  const c = cat.get(el.id);
  const p = NOMBRES_PLAN.reduce((a, b) => (pesos[b] * Math.max(0, el.porPlan[b].delta) > pesos[a] * Math.max(0, el.porPlan[a].delta)) ? b : a);
  const antes = bases[p];
  const despues = evaluarMazo(el.porPlan[p].mazo ?? antes.main, p, ctx);
  const dif = Object.keys(antes.T).filter(k => k !== "dano" && k !== "oferta")
    .map(k => ({ k, d: (despues.T[k] ?? 0) - (antes.T[k] ?? 0) })).sort((a, b) => b.d - a.d);
  const partes = [];
  const nom = c.es ?? c.nombre;
  if(!formato.get(c.nombre)?.ok) partes.push(`${nom}: la única que quedaba; ${formato.get(c.nombre)?.motivo ?? "no hay ruta"}`);
  else {
    const t = dif[0];
    if(c.nombre === "Gravekeeper's Spy" && pool.some(x => x.nombre === "Gravekeeper's Spy"))
      partes.push(`Segundo Spy: habilita la búsqueda de la primera copia`);
    else if(t && t.d > 0.4 && t.k !== "calidad") partes.push(`${nom}: mejora ${ETIQUETA[t.k]} del mazo (${PLANES[p].corto})`);
    else if(el.porPlan[p].delta > 0.05) partes.push(`${nom}: es la que más sube el mazo ${PLANES[p].corto} (+${el.porPlan[p].delta.toFixed(1)})`);
    else partes.push(`${nom}: ninguna de las que quedan mejora el mazo; es la que menos lo empeora`);
    const v = despues.valores.find(x => x.c === c || x.c.nombre === c.nombre);
    if(v?.por?.length) partes.push(v.por[0]);
    else if(c.nota) partes.push(c.nota);
  }
  /* y la que se pasa con más nota «de papel» que valor real */
  const papel = candidatos.filter(x => x.indice !== el.indice)
    .map(x => ({ x, c: cat.get(x.id) })).sort((a, b) => b.c.base - a.c.base)[0];
  if(papel && papel.c.base >= c.base + 1 && papel.x.valor < el.valor){
    const f = formato.get(papel.c.nombre);
    partes.push(`paso ${papel.c.es ?? papel.c.nombre}: ${!f?.ok ? "no hay una ruta de invocación en este pool"
      : papel.c.rutas.length ? "le faltan piezas que no tengo" : "aporta menos a este mazo"}`);
  }
  return partes.join(" · ");
}

/* Categoría de dependencia de una carta para un pool dado (para la
   interfaz y las pruebas). */
export function categoriaDe(c, pool, { formato, tam = 20 }){
  const cuenta = new Map(); for(const x of pool) cuenta.set(x.nombre, (cuenta.get(x.nombre) ?? 0) + 1);
  const conElla = pool.includes(c) ? pool : [...pool, c];
  const n = Math.max(tam, conElla.length);
  const cuentaM = new Map(cuenta); cuentaM.set(c.nombre, Math.max(1, cuentaM.get(c.nombre) ?? 0));
  const { acceso } = accesoEnMazo(c, cuentaM, n, conElla);
  const k = categoria(c, { formato, cuentaPool: cuentaM, acceso });
  return { k, texto: CATEGORIA[k], acceso };
}

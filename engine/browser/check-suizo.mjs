/* ════════════════════════════════════════════════════════════════
   EL TORNEO SUIZO, SIN PANTALLA: miles de torneos en node

   Que nadie repita rival en el suizo, que cada ronda tenga las 16 mesas
   con los 32, que el corte saque 16 y con el cuadro sembrado, que haya
   un campeón, que la misma semilla dé el mismo torneo, y que los mazos
   salgan con la frecuencia que dicen los pesos (y que en el top 16 se
   concentren los que ganan más).

   Uso:  node check-suizo.mjs [torneos=1000]
   ════════════════════════════════════════════════════════════════ */
import { readFileSync, existsSync } from "node:fs";
import * as S from "./src/suizo.js";

const N = Number(process.argv[2] ?? 1000);
let fallos = 0;
const ok  = t => console.log("  ✓ " + t);
const mal = (t, d = "") => { fallos++; console.log("  ✗ " + t + (d ? "   " + d : "")); };
console.log(`\n═══ TORNEO SUIZO · ${N} torneos ═══\n`);

const MAZOS = JSON.parse(readFileSync("../data/mazos.json", "utf-8")).filter(m => !m.aviso && m.main.length >= 40).map(m => m.nombre);
const CRUCES = existsSync("../data/cruces.json") ? JSON.parse(readFileSync("../data/cruces.json", "utf-8")) : null;
const prob = S.probDesdeCruces(CRUCES);

/* Mi match: una moneda con el sesgo que se pida. */
function jugarTorneo(semilla, pMia = 0.5){
  const s = S.nuevoSuizo({ semilla, miMazo: "Goat Control · Worlds 2020", mazos: MAZOS });
  let r = 1;
  const moneda = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
  for(let vuelta = 0; vuelta < 20 && s.fase !== "fin"; vuelta++){
    const m = S.miMesa(s);
    if(m){ const g = moneda() < pMia; S.apuntarMiMatch(s, { gane: g, juegosMios: g ? 2 : (moneda() < .5 ? 1 : 0), juegosSuyos: g ? (moneda() < .5 ? 1 : 0) : 2 }); }
    S.resolverResto(s, prob);
    S.siguienteRonda(s);
  }
  return s;
}

let repetidos = 0, mesasMal = 0, corteMal = 0, sinCampeon = 0, cuadroMal = 0, lineaCorte = new Map();
const cuenta = new Map(), cuentaTop = new Map();
for(let i = 0; i < N; i++){
  const s = jugarTorneo("T" + i, 0.5);
  /* rondas suizas */
  const vistos = new Set();
  for(const ronda of s.rondas){
    const ids = ronda.flatMap(m => [m.a, m.b]);
    if(ronda.length !== 16 || new Set(ids).size !== 32) mesasMal++;
    for(const m of ronda){ const k = [m.a, m.b].sort((x,y)=>x-y).join("-"); if(vistos.has(k)) repetidos++; vistos.add(k); }
  }
  if(s.rondas.length !== 5) mesasMal++;
  /* corte */
  const tabla = S.clasificacion(s);
  if(s.top?.length !== 16 || new Set(s.top).size !== 16) corteMal++;
  else {
    const corte = tabla[15].puntos;
    lineaCorte.set(corte, (lineaCorte.get(corte) ?? 0) + 1);
    if(tabla.slice(16).some(f => f.puntos > corte)) corteMal++;
    const p1 = s.cuadro[0][0], p2 = s.cuadro[0][7];
    if(p1.a !== tabla[0].id || p1.b !== tabla[15].id || p2.a !== tabla[1].id || p2.b !== tabla[14].id) cuadroMal++;
    if(s.cuadro.map(r => r.length).join() !== "8,4,2,1") cuadroMal++;
  }
  if(s.fase !== "fin" || s.campeon == null) sinCampeon++;
  for(const j of s.jugadores) if(!j.yo) cuenta.set(j.mazo, (cuenta.get(j.mazo) ?? 0) + 1);
  for(const id of (s.top ?? [])){ const j = S.jugador(s, id); if(!j.yo) cuentaTop.set(j.mazo, (cuentaTop.get(j.mazo) ?? 0) + 1); }
}
repetidos ? mal("nadie repite rival en el suizo", `${repetidos} repeticiones`) : ok("nadie repite rival en las 5 rondas suizas");
mesasMal ? mal("cada ronda son 16 mesas con los 32", `${mesasMal} rondas mal`) : ok("cada ronda son 16 mesas con los 32 jugadores, y son 5");
corteMal ? mal("el corte saca 16 y no deja fuera a nadie con más puntos", `${corteMal}`) : ok("el corte saca 16 y nadie con más puntos se queda fuera");
cuadroMal ? mal("cuadro sembrado (1-16 … 2-15) y 8-4-2-1", `${cuadroMal}`) : ok("el cuadro va sembrado (1 contra 16, 2 contra 15) y es 8-4-2-1");
sinCampeon ? mal("todos los torneos acaban con campeón", `${sinCampeon} sin campeón`) : ok("todos los torneos acaban con campeón");
ok(`línea de corte: ${[...lineaCorte].sort((a,b)=>b[0]-a[0]).map(([p, n]) => `${p} pts ${Math.round(n*100/N)}%`).join(" · ")}`);

/* misma semilla, mismo torneo (y guardar/cargar no cambia nada) */
{
  const a = jugarTorneo("IGUAL"), b = jugarTorneo("IGUAL");
  JSON.stringify(a) === JSON.stringify(b) ? ok("la misma semilla da el mismo torneo") : mal("la misma semilla da el mismo torneo");
  const s = S.nuevoSuizo({ semilla: "GUARDA", miMazo: "Chaos Control", mazos: MAZOS });
  S.apuntarMiMatch(s, { gane: true }); S.resolverResto(s, prob); S.siguienteRonda(s);
  const copia = S.sanearSuizo(JSON.parse(JSON.stringify(s)));
  S.apuntarMiMatch(s, { gane: true }); S.resolverResto(s, prob); S.siguienteRonda(s);
  S.apuntarMiMatch(copia, { gane: true }); S.resolverResto(copia, prob); S.siguienteRonda(copia);
  JSON.stringify(s) === JSON.stringify(copia) ? ok("guardar y cargar a mitad no cambia el torneo")
                                              : mal("guardar y cargar a mitad no cambia el torneo");
}

/* los pesos */
{
  const total = [...cuenta.values()].reduce((t, x) => t + x, 0);
  const pesoTotal = MAZOS.reduce((t, m) => t + S.pesoDe(m), 0);
  let peor = 0, quien = "";
  for(const m of MAZOS){
    const esperado = S.pesoDe(m) / pesoTotal, visto = (cuenta.get(m) ?? 0) / total;
    if(Math.abs(visto - esperado) > peor){ peor = Math.abs(visto - esperado); quien = m; }
  }
  peor < 0.01 ? ok(`los mazos salen con su peso (desviación máxima ${(peor*100).toFixed(1)} puntos)`)
              : mal("los mazos salen con su peso", `${quien}: ${(peor*100).toFixed(1)} puntos`);
  const porBot = m => (cuenta.get(m) ?? 0) / N;
  /* 19-11, la comunidad: «demasiadas variaciones de Chaos Control». La
     variedad se mide por familias: el armazón de Goat Control / Chaos no
     puede llevarse más de la mitad de los bots y el aggro, al menos uno
     de cada cinco. */
  const CONTROL = ["Goat Control · Worlds 2020","Chaos Turbo · Worlds 2020","Chaos Control","Warrior Goat Control",
    "Emissary Goat Control","Horus Goat Control","Phoenix Goat Control","Zombie Goat Control","Burn Goat Control","Cat Control"];
  const AGGRO = ["Beastdown","Earth Aggro","Warrior Aggro","Umi · Water Aggro","Bazoo Return · Worlds","Monarch"];
  const parte = lista => lista.reduce((t, m) => t + porBot(m), 0) / 31;
  const pc = parte(CONTROL), pa = parte(AGGRO);
  (pc <= 0.55 && pa >= 0.2) ? ok(`variedad: Goat Control/Chaos ${(pc*100).toFixed(0)} % de los bots · aggro ${(pa*100).toFixed(0)} %`)
                            : mal("variedad de mazos", `Goat Control/Chaos ${(pc*100).toFixed(0)} % · aggro ${(pa*100).toFixed(0)} %`);
  if(CRUCES){
    const enTop = m => (cuentaTop.get(m) ?? 0) / Math.max(1, cuenta.get(m) ?? 0);
    const orden = MAZOS.map(m => [m, enTop(m)]).sort((a, b) => b[1] - a[1]);
    ok("los que más entran en el top 16 (de los que juegan): " + orden.slice(0, 4).map(([m, p]) => `${m} ${Math.round(p*100)}%`).join(" · "));
    const enCorte = MAZOS.map(m => [m, (cuentaTop.get(m) ?? 0) / N]).sort((a, b) => b[1] - a[1]);
    ok("un top 16 medio: " + enCorte.filter(([, x]) => x >= 0.05).map(([m, x]) => `${m} ${x.toFixed(1)}`).join(" · "));
    ok("los que menos: " + orden.slice(-3).map(([m, p]) => `${m} ${Math.round(p*100)}%`).join(" · "));
  } else console.log("  · sin data/cruces.json: los bots se tiran al 50 %");
}

/* un jugador que gana siempre llega a la final y es campeón; uno que pierde siempre no entra */
{
  const fuerte = jugarTorneo("CAMPEON", 1.0), flojo = jugarTorneo("FLOJO", 0.0);
  const rf = S.resultado(fuerte), rd = S.resultado(flojo);
  rf.rango === "1" && rf.miRegistro.ganados === 5 ? ok("quien gana todo es 5-0 y campeón") : mal("quien gana todo es campeón", JSON.stringify(rf));
  !rd.enCorte && rd.miRegistro.perdidos === 5 ? ok("quien pierde todo es 0-5 y no entra en el corte") : mal("quien pierde todo no entra", JSON.stringify(rd));
}

/* retirarse: mi mesa se pierde 0-2, el rival suma y el torneo acaba solo */
{
  const s = S.nuevoSuizo({ semilla: "ME_RETIRO", miMazo: "Chaos Control", mazos: MAZOS });
  S.apuntarMiMatch(s, { gane: true, juegosMios: 2, juegosSuyos: 1 }); S.resolverResto(s, prob); S.siguienteRonda(s);
  const mesa = S.miMesa(s), rival = S.rivalEn(s, mesa).id;
  S.retirarme(s);
  const fin = S.simularHastaElFinal(s, prob);
  const r = S.resultado(s);
  fin && s.fase === "fin" && r.miRegistro.ganados === 1 && r.miRegistro.perdidos === 4 && !r.enCorte
    ? ok("retirarse en la ronda 2: 1-4, fuera del corte y el torneo acaba solo")
    : mal("retirarse", JSON.stringify({ fin, fase: s.fase, reg: r.miRegistro }));
  S.registro(s, rival).ganados >= 1 ? ok("y el rival de esa ronda se lleva la victoria") : mal("el rival suma la victoria");
}

console.log(fallos ? `\nFALLA: ${fallos}\n` : "\nTodo correcto\n");
process.exit(fallos ? 1 : 0);

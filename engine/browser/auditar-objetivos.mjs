/* Herramienta de medida (17-09): juega N partidas bot contra bot y cuenta
   cartas dañinas que acaban sobre objetivos PROPIOS, mano al acabar el turno
   y acciones por turno. Uso: node auditar-objetivos.mjs 200 experto [carpeta-cerebro]
   DET2=1 imprime cada selección sospechosa con la cadena y la lista. */
const dir = process.argv[4] ?? process.cwd();
const R = await import(process.cwd()+"/registro.mjs");
const { crearCerebro } = await import(dir+"/src/ai/brain.js");
const X = await import(process.cwd()+"/out/ocgcore.bundle.js");
const { makeAutoPlayer } = await import(process.cwd()+"/src/autopilot.mjs");
const { makeTrivialResolver } = await import(process.cwd()+"/src/trivial.js");
const N = Number(process.argv[2] ?? 60), nivel = process.argv[3] ?? "experto";
const trivial = makeTrivialResolver(X), gen = makeAutoPlayer(X);
const nom = c => (R.names[c]?.name ?? "").replace(/ \((GOAT|Pre-Errata)\)/,"");
const DAÑINAS = new Set([...(process.env.AUDITAR_EXTRA ?? "").split(",").filter(Boolean), "Book of Moon","Nobleman of Crossout","Smashing Ground","Mystical Space Typhoon","Dust Tornado","Sakuretsu Armor","Ring of Destruction","Snatch Steal","Breaker the Magical Warrior","Exiled Force","Tribe-Infecting Virus","Night Assailant","Magic Cylinder","Enemy Controller"]);
const st = { turnos:0, manoFin:0, manoVacia:0, jugadasTurno:0, propias:{}, ajenas:{}, ganador:[0,0] };
for(let i=0;i<N;i++){
  const s=9000+i*7919, r=R.xorshift(s);
  const a=R.MAZOS[i%R.MAZOS.length], b=R.MAZOS[(i*7+3)%R.MAZOS.length];
  const cab={semilla_motor:[String(s),"7","13","29"],mazos:[{main:R.barajar(a.main,r),extra:a.extra},{main:R.barajar(b.main,r),extra:b.extra}]};
  let ultimaCadena=null, jug=0;
  const BATALLA = new Set(Object.entries(R.names).filter(([c,n])=>/^(Sakuretsu Armor|Mirror Force|Ring of Destruction|Waboku|Book of Moon|Magic Cylinder|Threatening Roar)/.test(n.name)).map(([c])=>+c));
  const duel = await R.duelDesde(cab, e=>{
    /* Trampas de batalla: contra qué atacante se gastan. Un pro las guarda
       para el que duele. */
    if(e.t==="chain" && BATALLA.has(e.code) && duel.atacante){
      const at = duel.cards.get(duel.atacante.uid);
      const fuerza = at?.atkReal ?? R.db.get(duel.atacante.code)?.attack ?? 0;
      st.trampas ??= { flojo:0, gordo:0 };
      if(fuerza >= 1700) st.trampas.gordo++; else st.trampas.flojo++;
    }
    /* OJO (18-09): `ultimaCadena` se quedaba con el ÚLTIMO eslabón, así que
       en una cadena de dos el objetivo del primero en resolverse se le
       apuntaba al otro. Salían «Book of Moon sobre objetivo propio» que en
       realidad eran el descarte de un Graceful Charity o la fusión de un
       Metamorphosis. Solo se cuenta lo que se activa SIN cadena, que es
       inequívoco; lo demás no se mide en vez de medirse mal. */
    if(e.t==="chain"){ ultimaCadena = { code:e.code, quien: duel.cadena?.at(-1)?.controller,
                                        eslabones: duel.cadena?.length ?? 1 }; if(duel.cadena?.at(-1)?.controller===duel.turnPlayer) jug++; }
    if(e.t==="summon" || e.t==="set"){ jug++; }
    if(e.t==="target" && ultimaCadena && ultimaCadena.eslabones === 1 && DAÑINAS.has(nom(ultimaCadena.code))){
      for(const u of e.uids){ const c=duel.cards.get(u); if(!c) continue;
        const k=nom(ultimaCadena.code); const t = c.controller===ultimaCadena.quien ? st.propias : st.ajenas;
        if(process.env.DET && c.controller===ultimaCadena.quien) console.log(`   ${k} → propio ${nom(c.code)} · T${duel.turnCount} fase ${duel.phase.toString(16)} · turno de ${duel.turnPlayer===c.controller?"él":"rival"} · eslabones ${duel.cadena.length} · rival cara arriba: ${(duel.zones[1-c.controller][4]??[]).filter(x=>x&&!(x.position&10)).map(x=>nom(x.code)).join(",")||"-"} · atacante ${duel.atacante?nom(duel.atacante.code):"-"}`);
        t[k]=(t[k]??0)+1; }
      ultimaCadena=null;
    }
    if(e.t==="phase" && e.phase===0x200){ st.turnos++; const n=(duel.zones[duel.turnPlayer][2]??[]).length; st.manoFin+=n; if(n===0) st.manoVacia++; st.jugadasTurno+=jug; jug=0; }
    if(e.t==="turn") jug=0;
  });
  const cer=[0,1].map(yo=>crearCerebro({X,duel,db:R.db,names:R.names,nivel,yo}));
  for(let p=0;p<7000&&!duel.finished;p++){ const q=await duel.run(); if(!q||duel.finished)break; let resp=null,k=0,fuente=""; while(k<8&&!resp){resp=trivial(q); fuente="triv"; if(!resp){resp=cer[q.player](q,k); fuente="cer";} if(!resp){resp=gen(q,k); fuente="gen";} k++;}
    if(process.env.DET2 && q.type===X.OcgMessageType.SELECT_CARD && (resp?.indicies??[]).some(i=>q.selects[i]?.controller===q.player) && /Book of Moon|Ring of|Night Ass|Nobleman|Mystical Space|Dust Tor/.test(nom(duel.cadena?.at(-1)?.code))){
      const top = duel.cadena?.at(-1);
      console.log(`SELECT_CARD p${q.player} T${duel.turnCount} f${duel.phase.toString(16)} cadena:${(duel.cadena??[]).map(c=>nom(c.code)+"(p"+c.controller+")").join(">")||"-"} rivalCaraArriba:${(duel.zones[1-q.player][4]??[]).filter(x=>x&&!(x.position&10)).map(x=>nom(x.code)).join(",")||"-"} lista:${q.selects.map(l=>(l.controller===q.player?"M:":"R:")+nom(l.code)+"@"+l.location+"/"+l.position).join(", ")} → ${JSON.stringify(resp.indicies)} (${fuente}, min ${q.min} max ${q.max})`);
    } if(!resp)break; duel.respond(resp); if(duel.turnCount>60)break; }
}
console.log(`${nivel} · ${N} partidas · mano al acabar el turno ${(st.manoFin/st.turnos).toFixed(2)} · turnos con la mano vacía ${Math.round(st.manoVacia/st.turnos*100)}% · acciones por turno ${(st.jugadasTurno/st.turnos).toFixed(2)}`);
console.log("  objetivos PROPIOS de cartas dañinas:", JSON.stringify(st.propias));
console.log("  objetivos del rival:", JSON.stringify(st.ajenas));
if(st.trampas) console.log(`  trampas de batalla: contra un atacante de 1700+ ${st.trampas.gordo}, contra uno más flojo ${st.trampas.flojo}`);

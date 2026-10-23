/* ════════════════════════════════════════════════════════════════
   Decisiones sin elección real → se resuelven solas.

   El core abre ventana de respuesta en cada timing, y avisa de cada
   efecto obligatorio, aunque el jugador no tenga NADA que decidir.
   Preguntar en esos casos es lo que hacía que el duelo pareciera
   colgado. Master Duel, Duel Links y EDOPro hacen justo esto:
   si solo hay un camino legal, lo toman sin preguntar.
   ════════════════════════════════════════════════════════════════ */
export function makeTrivialResolver(X){
  const T=X.OcgMessageType, R=X.OcgResponseType;
  return function trivial(m){
    switch(m.type){
      case T.SELECT_CHAIN: {
        const n = m.selects?.length ?? 0;
        // nada que encadenar: la cadena se resuelve sola
        if(n === 0) return { type:R.SELECT_CHAIN, index:null };
        // obligatorio y con un solo efecto posible: no hay decisión
        if(m.forced && n === 1) return { type:R.SELECT_CHAIN, index:0 };
        return null;
      }
      case T.SELECT_OPTION:
        return (m.options?.length ?? 0) <= 1 ? { type:R.SELECT_OPTION, index:0 } : null;
      case T.SELECT_POSITION: {
        const bits=[1,2,4,8].filter(b=>m.positions & b);
        return bits.length<=1 ? { type:R.SELECT_POSITION, position:bits[0] ?? 1 } : null;
      }
      case T.SELECT_CARD: case T.SELECT_TRIBUTE: {
        const n=m.selects?.length ?? 0, min=m.min??1, max=m.max??min;
        // hay que coger exactamente todas las que hay: no hay elección
        /* Ojo con los tributos que valen por dos (Double Coston): ahí
           «todas» puede ser pasarse. Eso lo decide quien sepa contar. */
        const dobles = m.type===T.SELECT_TRIBUTE && (m.selects ?? []).some(s => (s.release_param ?? 1) > 1);
        if(n>0 && min===max && min===n && !dobles)
          return { type: m.type===T.SELECT_TRIBUTE?R.SELECT_TRIBUTE:R.SELECT_CARD,
                   indicies: Array.from({length:n},(_,i)=>i) };
        return null;
      }
      case T.SELECT_UNSELECT_CARD: {
        const n=m.select_cards?.length ?? 0;
        if(n===1 && !m.can_finish) return { type:R.SELECT_UNSELECT_CARD, index:0 };
        if(n===0 && m.can_finish)  return { type:R.SELECT_UNSELECT_CARD, index:null };
        return null;
      }
      default: return null;
    }
  };
}

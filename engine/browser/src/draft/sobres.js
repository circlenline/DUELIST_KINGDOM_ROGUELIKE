/* ══════════════════════════════════════════════════════════════════
   LOS SOBRES DE RETRO PACK 2

   Konami confirma 9 cartas por sobre y 101 cartas en el set (48 C, 24 R,
   10 SR, 8 UR, 11 SE). NO publica la colación ni las tasas exactas: del
   relanzamiento de 2025 solo dice que lleva «el doble de foils» que el
   de 2009, y eso no basta para reconstruirla. Así que esto es un
   MODELO DE SLOTS, rotulado como aproximación y editable:

     7 comunes distintas · 1 rara · 1 hueco «rara o foil»
     (rara 50 % · súper 28 % · ultra 14 % · secreta 8 %)

   Dentro de un sobre no se repite ninguna carta; entre sobres, sí. La
   rareza decide la frecuencia, NUNCA la fuerza: el bot no la mira.
   Las cartas malas e injugables se quedan en los sobres: quitarlas
   falsearía el draft.
   ══════════════════════════════════════════════════════════════════ */
export const MODELO_SOBRE = {
  nombre: "Aproximación RP02 (editable)",
  aproximacion: true,
  slots: [
    { rareza: "C", n: 7 },
    { rareza: "R", n: 1 },
    { pesos: { R: 0.50, SR: 0.28, UR: 0.14, SE: 0.08 }, n: 1 },
  ],
};

export function porRareza(lista){
  const m = {};
  for(const c of lista) (m[c.rareza] ??= []).push(c.id);
  return m;
}

/* Un sobre. `azar` es el generador de PRODUCTO. Devuelve ids. */
export function abrirSobre(porR, azar, modelo = MODELO_SOBRE){
  const sobre = [];
  const usado = new Set();
  const coge = rareza => {
    const lista = (porR[rareza] ?? []).filter(id => !usado.has(id));
    if(!lista.length) return null;
    const id = lista[Math.floor(azar() * lista.length)];
    usado.add(id); return id;
  };
  for(const slot of modelo.slots){
    for(let i = 0; i < slot.n; i++){
      let rareza = slot.rareza;
      if(!rareza){
        let x = azar(), acc = 0;
        for(const [r, p] of Object.entries(slot.pesos)){ acc += p; if(x < acc){ rareza = r; break; } }
        rareza ??= Object.keys(slot.pesos).at(-1);
      }
      const id = coge(rareza);
      if(id !== null) sobre.push(id);
    }
  }
  return sobre;
}

/* Probabilidad de que UNA carta concreta de cada rareza esté en un sobre
   (pública: sale del modelo, no del generador). La usa la IA para
   estimar qué puede llegar. */
export function probPorSobre(modelo = MODELO_SOBRE, tamanos = { C:48, R:24, SR:10, UR:8, SE:11 }){
  const esperado = {};
  for(const slot of modelo.slots){
    if(slot.rareza) esperado[slot.rareza] = (esperado[slot.rareza] ?? 0) + slot.n;
    else for(const [r, p] of Object.entries(slot.pesos)) esperado[r] = (esperado[r] ?? 0) + p * slot.n;
  }
  const out = {};
  for(const r in tamanos) out[r] = Math.min(1, (esperado[r] ?? 0) / tamanos[r]);
  return out;
}

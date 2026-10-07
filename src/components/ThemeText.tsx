import { Fragment, type ReactNode } from 'react';

// Shared symbols resolve to existing artwork wherever text labels use them.
export const SYMBOL_ART: Record<string, string> = {
  '🪺': '/icons/tabs/cuib.png',
  '🦖': '/icons/tabs/haita.png',
  '🐉': '/icons/tabs/dragoni.png',
  '💞': '/icons/tabs/barlog.png',
  '⛏': '/icons/tabs/activitati.png',
  '📖': '/icons/tabs/atlas.png',
  '🏕': '/icons/tabs/tabara.png',
  '🗺': '/icons/tabs/expeditii.png',
  '📜': '/icons/ui/misiune.png',
  '✨': '/icons/ui/scanteie.png',
  '💎': '/icons/ui/diamant.png',
  '🥚': '/art/eggs/jungla.png',
  '🌿': '/art/items/ferigi.png',
  '🪨': '/art/items/bazalt.png',
  '🍒': '/art/items/fructe.png',
  '🐞': '/art/items/insecte.png',
  '🍖': '/art/items/carne.png',
  '🥗': '/art/items/salata.png',
  '🍗': '/art/items/friptura.png',
  '🍡': '/art/items/mix_insecte.png',
  '🟫': '/art/items/lut.png',
  '🦴': '/art/items/os.png',
  '🐚': '/art/items/fosila.png',
  '🟠': '/art/items/chihlimbar.png',
  '🗝': '/art/items/os_alfa.png',
  '🎁': '/icons/ui/zilnica.png',
  '🌟': '/icons/ui/scanteie.png',
  '💠': '/art/relics/coroana_vulcanului.png',
  '🐣': '/art/eggs/jungla.png',
  '🌲': '/art/items/ferigi.png',
  '🥣': '/art/items/salata.png',
  '🛖': '/icons/tabs/tabara.png',
  '🏯': '/icons/tabs/barlog.png',
  '🔥': '/icons/actions/foc.png',
  '💧': '/icons/actions/apa.png',
  '🌪': '/icons/actions/aer.png',
  '🍳': '/icons/actions/bucatarie.png',
  '⚔': '/icons/actions/lupta.png',
  '⏳': '/icons/actions/cronometru.png',
  '⏱': '/icons/actions/cronometru.png',
  '🕒': '/icons/actions/cronometru.png',
};
Object.assign(SYMBOL_ART, {
  '🍲': '/art/items/salata.png',
  '🎒': '/icons/common/rucsac.png',
  '🧺': '/icons/common/rucsac.png',
  '🔄': '/icons/common/rotire.png',
  '🌀': '/icons/common/rotire.png',
  '🕯': '/icons/common/lumanare.png',
  '❄': '/icons/common/rece.png',
  '🛡': '/icons/common/aparare.png',
  '🏹': '/icons/common/distanta.png',
  '💀': '/icons/common/umbra.png',
  '🔒': '/icons/common/incuiat.png',
  '🏆': '/icons/common/trofeu.png',
  '❤': '/icons/common/inima.png',
  '♥': '/icons/common/inima.png',
  '💗': '/icons/common/inima.png',
  '🤍': '/icons/common/inima.png',
  '💔': '/icons/common/inima.png',
  '😌': '/icons/common/inima.png',
  '⭐': '/icons/common/stea.png',
  '★': '/icons/common/stea.png',
  '☆': '/icons/common/stea.png',
  '🧬': '/icons/common/gene.png',
  '🧠': '/icons/common/gene.png',
  '👪': '/icons/common/gene.png',
  '📊': '/icons/common/statistici.png',
  '📈': '/icons/common/statistici.png',
  '📷': '/icons/common/captura.png',
  '🎬': '/icons/common/captura.png',
  '💾': '/icons/common/salvare.png',
  '🪽': '/art/relics/pana_furtunii.png',
  '🪶': '/art/relics/pana_furtunii.png',
  '👑': '/art/relics/coroana_vulcanului.png',
  '🗡': '/art/relics/lama_junglei.png',
  '🌋': '/icons/actions/foc.png',
  '⛈': '/icons/actions/aer.png',
  '🏜': '/art/items/lut.png',
  '🧱': '/art/items/lut.png',
  '💤': '/icons/actions/cronometru.png',
  '🌙': '/icons/actions/cronometru.png',
  '😟': '/art/items/carne.png',
  '🍽': '/art/items/carne.png',
  '🍼': '/art/items/carne.png',
  '🔨': '/icons/tabs/activitati.png',
  '🏠': '/icons/tabs/tabara.png',
  '🐾': '/icons/tabs/haita.png',
  '👁': '/icons/ui/misiune.png',
  '❔': '/icons/ui/misiune.png',
  '▶': '/icons/common/control.png',
  '◀': '/icons/common/control.png',
  '⏸': '/icons/common/control.png',
  '⏹': '/icons/common/control.png',
  '⏩': '/icons/common/control.png',
  '⏭': '/icons/common/control.png',
  '🔇': '/icons/common/control.png',
  '🔊': '/icons/common/control.png',
  '⛶': '/icons/common/control.png',
  '✏': '/icons/common/control.png',
  '⬆': '/icons/common/control.png',
  '⬇': '/icons/common/control.png',
  '✕': '/icons/common/control.png',
  '🗑': '/icons/common/control.png',
  '＋': '/icons/common/control.png',
  '→': '/icons/common/control.png',
  '←': '/icons/common/control.png',
  '›': '/icons/common/control.png',
  '✓': '/icons/common/control.png',
});
const CONTROL_GLYPHS: Record<string, string> = {
  '▶': '▶',
  '◀': '◀',
  '⏸': 'Ⅱ',
  '⏹': '■',
  '⏩': '≫',
  '⏭': '≫│',
  '🔇': '♪×',
  '🔊': '♪',
  '⛶': '⛶',
  '✏': '✎',
  '⬆': '↑',
  '⬇': '↓',
  '✕': '×',
  '🗑': '×',
  '＋': '+',
  '→': '→',
  '←': '←',
  '›': '›',
  '✓': '✓',
};
const SYMBOLS = new RegExp(`(${Object.keys(SYMBOL_ART).join('|')})(?:\uFE0F)?`, 'gu');

/** One generated medallion keeps functional controls consistent and readable. */
export function ControlIcon({ glyph }: { glyph: string }) {
  return <span className="theme-control theme-symbol" aria-hidden="true"><img src="/icons/common/control.png" alt="" /><span>{glyph}</span></span>;
}

export function ThemeText({ children, size }: { children: ReactNode; size?: number }) {
  if (Array.isArray(children))
    return (
      <>
        {children.map((child, i) => (
          <ThemeText key={i} size={size}>
            {child}
          </ThemeText>
        ))}
      </>
    );
  if (typeof children !== 'string') return <>{children}</>;
  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const match of children.matchAll(SYMBOLS)) {
    parts.push(children.slice(cursor, match.index));
    const dimensions = size ? { width: size, height: size } : undefined;
    const stateClass = match[1] === '🤍' ? ' theme-albino' : match[1] === '☆' || match[1] === '💔' ? ' theme-dim' : '';
    parts.push(
      CONTROL_GLYPHS[match[1]] ? (
        <span
          key={match.index}
          className="theme-control theme-symbol"
          aria-hidden="true"
          style={size ? { width: size, height: size } : undefined}
        >
          <img src={SYMBOL_ART[match[1]]} alt="" />
          <span>{CONTROL_GLYPHS[match[1]]}</span>
        </span>
      ) : (
        <img
          key={match.index}
          className={`game-icon theme-symbol${stateClass}`}
          src={SYMBOL_ART[match[1]]}
          alt=""
          aria-hidden="true"
          {...dimensions}
          style={size ? { width: size, height: size } : undefined}
        />
      ),
    );
    cursor = match.index! + match[0].length;
  }
  parts.push(children.slice(cursor));
  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={index}>{part}</Fragment>
      ))}
    </>
  );
}

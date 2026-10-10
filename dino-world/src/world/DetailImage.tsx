// Imagini SVG în trepte: opțional o variantă mică de pornire (`lite`), apoi cea obișnuită; cea mare (4K / HD) se
// descarcă doar când camera e destul de aproape (`detail`). Fiecare o înlocuiește pe cea de dinainte după ce e
// decodată, fără să clipească. Odată încărcată, rămâne.

import { createContext, memo, useContext, useEffect, useState, type SVGProps } from 'react';

/** Pentru clădirile unei insule: true când camera e destul de aproape de ea încât varianta mare să conteze. */
export const DetailContext = createContext(false);

const decoded = new Set<string>();
const loading = new Map<string, Promise<void>>();
function preload(src: string): Promise<void> {
  let p = loading.get(src);
  if (!p) {
    const img = new Image();
    img.src = src;
    p = img.decode().then(
      () => void decoded.add(src),
      () => void loading.delete(src),
    );
    loading.set(src, p);
  }
  return p;
}

type Props = Omit<SVGProps<SVGImageElement>, 'href'> & {
  href: string;
  /** Varianta mare; lipsă = doar cea ușoară. */
  hd?: string;
  /** Încarcă varianta mare; implicit, din DetailContext. */
  detail?: boolean;
  /** Varianta mică de pornire: se vede până se decodează `href`. */
  lite?: string;
};

export const DetailImage = memo(function DetailImage({ href, hd, detail, lite, ...rest }: Props) {
  const near = useContext(DetailContext);
  const want = !!hd && (detail ?? near);
  const [ready, setReady] = useState(() => !!hd && decoded.has(hd));
  useEffect(() => {
    if (!want || ready || !hd) return;
    let live = true;
    preload(hd).then(() => live && decoded.has(hd) && setReady(true));
    return () => {
      live = false;
    };
  }, [want, ready, hd]);
  const [base, setBase] = useState(() => !lite || decoded.has(href));
  useEffect(() => {
    if (base) return;
    let live = true;
    preload(href).then(() => live && decoded.has(href) && setBase(true));
    return () => {
      live = false;
    };
  }, [base, href]);
  const src = ready && hd ? hd : base ? href : lite;
  // o imagine care nu se încarcă (rețea, fișier rescris chiar atunci): încă două încercări, apoi nimic, nu iconița
  // „imagine stricată” a browserului peste hartă
  const [fails, setFails] = useState(0);
  useEffect(() => setFails(0), [src]);
  if (!src || fails > 2) return null;
  return (
    <image
      key={fails}
      href={fails && !src.startsWith('blob:') ? `${src}${src.includes('?') ? '&' : '?'}retry=${fails}` : src}
      onError={() => setTimeout(() => setFails((n) => n + 1), 800 * (fails + 1))}
      {...rest}
    />
  );
});

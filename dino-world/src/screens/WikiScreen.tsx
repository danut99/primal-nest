// Wikipedia: ghidul jocului. Aceeași fereastră întunecată ca Extinde și Atlasul (bp-modal + bara de sus), cu
// categoriile în stânga și conținutul în dreapta: prima pagină, o categorie sau rezultatele unei căutări, ori un
// articol. Textele vin din content/wiki.ts (generate din regulile jocului).

import { useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { DinoThumb, Modal } from '../components/ui';
import {
  WIKI_ARTICLES,
  WIKI_BY_ID,
  WIKI_CATEGORIES,
  searchWiki,
  type WikiArticle,
  type WikiCategory,
  type WikiSection,
} from '../content/wiki';
import '../styles/wiki.css';

/** Articolele de pe prima pagină, la „Începe de aici”. */
const START_HERE = ['first-steps', 'feeding', 'gold', 'breeding'];

const categoryName = (id: WikiCategory) => WIKI_CATEGORIES.find((c) => c.id === id)?.name ?? '';
const countIn = (id: WikiCategory) => WIKI_ARTICLES.filter((a) => a.category === id).length;

/** `article`: deschide direct un articol (din „Du-mă acolo” și mesajele „Îți lipsesc…”). */
export function WikiScreen({ onClose, article: initial }: { onClose: () => void; article?: string }) {
  const [category, setCategory] = useState<WikiCategory | 'all'>('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(initial ?? null);
  const root = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  useFocusTrap(root);

  const article = selected ? WIKI_BY_ID.get(selected) : undefined;
  const results = useMemo(() => searchWiki(query, category), [query, category]);
  const home = !article && category === 'all' && !query.trim();

  const browse = (id: WikiCategory | 'all') => {
    setCategory(id);
    setQuery('');
    setSelected(null);
  };
  const search = (text: string) => {
    setQuery(text);
    setSelected(null);
    setCategory('all');
  };

  // la fiecare pagină nouă, conținutul pornește de sus
  // (corp cu acolade: în Chrome nou scrollTo întoarce o promisiune, iar React ar lua-o drept funcție de curățare)
  useEffect(() => {
    body.current?.scrollTo(0, 0);
  }, [selected, category]);

  return (
    <Modal title="Wikipedia" onClose={onClose} bare className="bp-modal wiki-modal">
      <div className="bp-adv" ref={root} style={{ '--tint': '#5fb98a' } as CSSProperties}>
        <header className="bp-bar">
          {article ? (
            <button className="bp-ghost wiki-back" onClick={() => setSelected(null)}>
              ← Ghid
            </button>
          ) : (
            <span className="shop-bar-icon" aria-hidden="true">
              📚
            </span>
          )}
          <div className="bp-bar-title">
            <h2>Wikipedia</h2>
          </div>
          <SearchBox value={query} onChange={search} />
        </header>

        <div className="wiki-layout">
          <CategoryNav active={category} onPick={browse} />
          <div className="wiki-content" ref={body}>
            {article ? (
              <ArticleView article={article} onOpen={setSelected} />
            ) : home ? (
              <WikiHome onOpen={setSelected} onBrowse={browse} />
            ) : (
              <WikiResults
                title={query.trim() ? `Rezultate pentru „${query.trim()}”` : categoryName(category as WikiCategory)}
                results={results}
                showCategory={category === 'all'}
                onOpen={setSelected}
                onReset={() => browse('all')}
              />
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ---------- bara de sus și coloana cu categorii ----------

function SearchBox({ value, onChange }: { value: string; onChange: (text: string) => void }) {
  return (
    <label className="wiki-search">
      <span aria-hidden="true">🔎</span>
      <input
        autoFocus
        type="search"
        aria-label="Caută în Wikipedia"
        placeholder="Caută: hrană, ouă, forjă…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button type="button" onClick={() => onChange('')} aria-label="Șterge căutarea">
          ✕
        </button>
      )}
    </label>
  );
}

function CategoryNav({ active, onPick }: { active: WikiCategory | 'all'; onPick: (id: WikiCategory | 'all') => void }) {
  const item = (id: WikiCategory | 'all', icon: string, name: string, count: number) => (
    <button key={id} className={active === id ? 'on' : ''} aria-pressed={active === id} onClick={() => onPick(id)}>
      <span aria-hidden="true">{icon}</span>
      <span className="wiki-nav-name">{name}</span>
      <span className="wiki-count">{count}</span>
    </button>
  );
  return (
    <nav className="wiki-nav" aria-label="Categorii">
      {item('all', '📚', 'Toate', WIKI_ARTICLES.length)}
      {WIKI_CATEGORIES.map((c) => item(c.id, c.icon, c.name, countIn(c.id)))}
    </nav>
  );
}

// ---------- paginile: prima pagină, rezultate, articol ----------

function WikiHome({ onOpen, onBrowse }: { onOpen: (id: string) => void; onBrowse: (id: WikiCategory) => void }) {
  return (
    <>
      <div
        className="wiki-welcome"
        style={{ backgroundImage: `url(${import.meta.env.BASE_URL}world/prehistoric-background.webp)` }}
      >
        <small>Bun venit în ghid</small>
        <h2>O lume întreagă de descoperit</h2>
        <p>Află cum crești dinozauri, îți dezvolți insulele și pregătești următoarea aventură.</p>
      </div>

      <h3 className="bp-main-title">Începe de aici</h3>
      <div className="wiki-cards">
        {START_HERE.map((id) => WIKI_BY_ID.get(id))
          .filter((a): a is WikiArticle => !!a)
          .map((a) => (
            <ArticleCard key={a.id} article={a} showCategory onOpen={onOpen} />
          ))}
      </div>

      <h3 className="bp-main-title">Explorează ghidul</h3>
      <div className="wiki-categories">
        {WIKI_CATEGORIES.map((c) => (
          <button key={c.id} className="wiki-category" onClick={() => onBrowse(c.id)}>
            <span className="wiki-icon" aria-hidden="true">
              {c.icon}
            </span>
            <span className="wiki-text">
              <strong>{c.name}</strong>
              <small>{c.description}</small>
            </span>
            <span className="wiki-arrow" aria-hidden="true">
              →
            </span>
          </button>
        ))}
      </div>

      <h3 className="bp-main-title">Ai rămas blocat?</h3>
      <div className="wiki-questions">
        {WIKI_ARTICLES.filter((a) => a.category === 'help').map((a) => (
          <button key={a.id} onClick={() => onOpen(a.id)}>
            <span aria-hidden="true">{a.icon}</span>
            {a.title}
            <span className="wiki-arrow" aria-hidden="true">
              →
            </span>
          </button>
        ))}
      </div>
    </>
  );
}

function WikiResults({
  title,
  results,
  showCategory,
  onOpen,
  onReset,
}: {
  title: string;
  results: WikiArticle[];
  /** Căutarea amestecă categoriile: atunci cardul spune din care e; într-un tab de categorie ar fi în plus. */
  showCategory: boolean;
  onOpen: (id: string) => void;
  onReset: () => void;
}) {
  return (
    <>
      <div className="wiki-results-head">
        <h3 className="bp-main-title">{title}</h3>
        <span className="bp-chip" role="status">
          {results.length} {results.length === 1 ? 'articol' : 'articole'}
        </span>
      </div>
      {results.length ? (
        <div className="wiki-cards">
          {results.map((a) => (
            <ArticleCard key={a.id} article={a} showCategory={showCategory} onOpen={onOpen} />
          ))}
        </div>
      ) : (
        <div className="wiki-empty">
          <span aria-hidden="true">🔎</span>
          <strong>Niciun articol găsit</strong>
          <p>Încearcă „ou”, „aur” sau „habitat”. Poți căuta și fără diacritice.</p>
          <button className="bp-ghost" onClick={onReset}>
            Vezi toate categoriile
          </button>
        </div>
      )}
    </>
  );
}

function ArticleView({ article, onOpen }: { article: WikiArticle; onOpen: (id: string) => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  // cititoarele de ecran anunță titlul articolului nou
  useEffect(() => {
    heading.current?.focus();
  }, [article.id]);
  return (
    <article className="wiki-article">
      <header className="wiki-article-head">
        <ArticleArt article={article} className="wiki-article-art" />
        <div>
          <small>{categoryName(article.category)}</small>
          <h2 ref={heading} tabIndex={-1}>
            {article.title}
          </h2>
          <p>{article.summary}</p>
        </div>
      </header>

      {article.sections.map((s, i) => (
        <ArticleSection key={i} section={s} />
      ))}

      {!!article.related?.length && (
        <section className="wiki-related">
          <h3 className="bp-main-title">Citește și</h3>
          <div>
            {article.related
              .map((id) => WIKI_BY_ID.get(id))
              .filter((a): a is WikiArticle => !!a)
              .map((a) => (
                <button key={a.id} className="bp-chip" onClick={() => onOpen(a.id)}>
                  {a.icon} {a.title}
                </button>
              ))}
          </div>
        </section>
      )}
    </article>
  );
}

/** O secțiune de articol: paragrafe, pași numerotați și/sau un tabel (prima coloană = antetul rândului). */
function ArticleSection({ section: s }: { section: WikiSection }) {
  return (
    <section className="wiki-section">
      <h3>{s.title}</h3>
      {s.paragraphs?.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
      {s.steps && (
        <ol>
          {s.steps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      )}
      {s.table && (
        <div className="wiki-table" role="region" aria-label={s.title} tabIndex={0}>
          <table>
            <thead>
              <tr>
                {s.table.headers.map((h) => (
                  <th scope="col" key={h}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {s.table.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) =>
                    j === 0 ? (
                      <th scope="row" key={j}>
                        {cell}
                      </th>
                    ) : (
                      <td key={j}>{cell}</td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ArticleCard({
  article,
  showCategory,
  onOpen,
}: {
  article: WikiArticle;
  showCategory?: boolean;
  onOpen: (id: string) => void;
}) {
  return (
    <button className="wiki-card" onClick={() => onOpen(article.id)}>
      <ArticleArt article={article} className="wiki-card-art" />
      <span className="wiki-text">
        {showCategory && <small>{categoryName(article.category)}</small>}
        <strong>{article.title}</strong>
        <span className="wiki-summary">{article.summary}</span>
      </span>
    </button>
  );
}

/**
 * Imaginea unui articol: dinozaurul pentru specii, pictura clădirii sau insula (`image` din wiki.ts) pentru
 * clădiri și lumi; altfel iconița articolului.
 */
function ArticleArt({ article, className }: { article: WikiArticle; className: string }) {
  const species = article.id.startsWith('species-') ? article.id.slice('species-'.length) : null;
  return (
    <span
      className={`wiki-art ${className} ${species ? 'dino' : article.image ? 'picture' : 'emoji'}`}
      aria-hidden="true"
    >
      {species ? (
        <DinoThumb species={species} tight lazy />
      ) : article.image ? (
        <img src={`${import.meta.env.BASE_URL}${article.image}`} alt="" loading="lazy" draggable={false} />
      ) : (
        article.icon
      )}
    </span>
  );
}

// ---------- accesibilitate ----------

/**
 * Tab și Shift+Tab rămân în fereastră (ciclează între primul și ultimul control). La închidere, focusul revine
 * pe butonul Wikipedia din bara de jos.
 */
function useFocusTrap(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const dialog = root.current?.closest('[role="dialog"]');
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !dialog) return;
      const controls = Array.from(dialog.querySelectorAll<HTMLElement>('button,input,[href],[tabindex="0"]')).filter(
        (e) => !e.hasAttribute('disabled') && e.getClientRects().length,
      );
      const first = controls[0];
      const last = controls.at(-1);
      const outside = !controls.includes(document.activeElement as HTMLElement);
      if (event.shiftKey && (document.activeElement === first || outside)) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && (document.activeElement === last || outside)) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', trap);
    return () => {
      document.removeEventListener('keydown', trap);
      document.querySelector<HTMLElement>('[data-tour="wikipedia"]')?.focus();
    };
  }, [root]);
}

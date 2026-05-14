import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Dispatch, FormEvent, SetStateAction } from 'react';
import { useT } from '../i18n';
import type { AppConfig } from '../types';
import type { DesignSystemSummary } from '@open-design/contracts';
import {
  createDesignSystem,
  fetchDesignSystem,
  fetchDesignSystems,
} from '../providers/registry';

// Sibling Settings section that hosts the design-systems registry.
// Lifted out of the previous LibrarySection so each surface (functional
// skills vs. design systems) gets its own dedicated nav entry instead of
// sharing a sub-tab toggle. See specs/current/skills-and-design-templates.md.

interface Props {
  cfg: AppConfig;
  setCfg: Dispatch<SetStateAction<AppConfig>>;
}

export function DesignSystemsSection({ cfg, setCfg }: Props) {
  const t = useT();
  const [designSystems, setDesignSystems] = useState<DesignSystemSummary[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewBody, setPreviewBody] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createCategory, setCreateCategory] = useState('Custom');
  const [createSummary, setCreateSummary] = useState('');
  const [createBody, setCreateBody] = useState('');
  const [createTokensCss, setCreateTokensCss] = useState('');
  const [createFixtureHtml, setCreateFixtureHtml] = useState('');
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const refreshDesignSystems = useCallback(async () => {
    const list = await fetchDesignSystems();
    setDesignSystems(list);
    return list;
  }, []);

  useEffect(() => {
    void refreshDesignSystems();
  }, [refreshDesignSystems]);

  const disabledDS = useMemo(
    () => new Set(cfg.disabledDesignSystems ?? []),
    [cfg.disabledDesignSystems],
  );

  const categories = useMemo(() => {
    const cats = new Set(designSystems.map((d) => d.category));
    return ['All', ...Array.from(cats).sort()];
  }, [designSystems]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return designSystems.filter((d) => {
      if (categoryFilter !== 'All' && d.category !== categoryFilter) return false;
      if (
        q &&
        !d.title.toLowerCase().includes(q) &&
        !d.summary.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [designSystems, categoryFilter, search]);

  const grouped = useMemo(() => {
    const groups = new Map<string, DesignSystemSummary[]>();
    for (const d of filtered) {
      const list = groups.get(d.category) ?? [];
      list.push(d);
      groups.set(d.category, list);
    }
    return groups;
  }, [filtered]);

  const openPreview = useCallback(
    async (id: string) => {
      if (previewId === id) {
        setPreviewId(null);
        setPreviewBody(null);
        return;
      }
      setPreviewId(id);
      setPreviewBody(null);
      setPreviewLoading(true);
      try {
        const detail = await fetchDesignSystem(id);
        setPreviewId((cur) => {
          if (cur === id) setPreviewBody(detail?.body ?? null);
          return cur;
        });
      } catch {
        setPreviewId((cur) => {
          if (cur === id) setPreviewBody(null);
          return cur;
        });
      } finally {
        setPreviewId((cur) => {
          if (cur === id) setPreviewLoading(false);
          return cur;
        });
      }
    },
    [previewId],
  );

  function toggleDSDisabled(id: string, enabled: boolean) {
    setCfg((c) => {
      const set = new Set(c.disabledDesignSystems ?? []);
      if (enabled) set.delete(id);
      else set.add(id);
      return { ...c, disabledDesignSystems: [...set] };
    });
  }


  async function handleCreateDesignSystem(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreateBusy(true);
    setCreateError(null);
    try {
      const result = await createDesignSystem({
        title: createTitle,
        category: createCategory,
        summary: createSummary,
        body: createBody,
        tokensCss: createTokensCss,
        fixtureHtml: createFixtureHtml,
      });
      if ('error' in result) {
        setCreateError(result.error);
        return;
      }
      await refreshDesignSystems();
      setCfg((c) => ({
        ...c,
        designSystemId: result.designSystem.id,
        disabledDesignSystems: (c.disabledDesignSystems ?? []).filter(
          (id) => id !== result.designSystem.id,
        ),
      }));
      setPreviewId(result.designSystem.id);
      setPreviewBody(null);
      setCreateTitle('');
      setCreateSummary('');
      setCreateBody('');
      setCreateTokensCss('');
      setCreateFixtureHtml('');
      setCreateOpen(false);
    } finally {
      setCreateBusy(false);
    }
  }

  return (
    <section className="settings-section settings-design-systems">
      <div className="section-head">
        <div>
          <h3>{t('settings.designSystems')}</h3>
          <p className="hint">{t('settings.designSystemsHint')}</p>
        </div>
      </div>


      <button
        type="button"
        className="ghost library-import-toggle"
        onClick={() => setCreateOpen((value) => !value)}
      >
        {createOpen ? 'Close creator' : 'Create design system'}
      </button>

      {createOpen && (
        <form className="library-import-form ds-create-form" onSubmit={handleCreateDesignSystem}>
          <div className="library-import-row">
            <label>
              Name
              <input
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
                placeholder="Motileo Mobile"
                required
              />
            </label>
            <label>
              Category
              <input
                value={createCategory}
                onChange={(e) => setCreateCategory(e.target.value)}
                placeholder="Custom"
              />
            </label>
          </div>
          <label className="library-import-block">
            Short summary
            <input
              value={createSummary}
              onChange={(e) => setCreateSummary(e.target.value)}
              placeholder="Warm mobile product system with clear interaction states."
            />
          </label>
          <label className="library-import-block">
            DESIGN.md
            <textarea
              value={createBody}
              onChange={(e) => setCreateBody(e.target.value)}
              placeholder="# Motileo Mobile

> Category: Custom
> Surface: web
> Mobile design system for...

## 1. Visual Theme..."
              rows={8}
              required
            />
          </label>
          <label className="library-import-block">
            tokens.css
            <textarea
              value={createTokensCss}
              onChange={(e) => setCreateTokensCss(e.target.value)}
              placeholder=":root {
  --bg: #f5f4ed;
  --surface: #faf9f5;
  --fg: #141413;
  --accent: #c96442;
}"
              rows={6}
            />
          </label>
          <label className="library-import-block">
            components.html
            <textarea
              value={createFixtureHtml}
              onChange={(e) => setCreateFixtureHtml(e.target.value)}
              placeholder="<section class=&quot;fixture&quot;>...</section>"
              rows={6}
            />
          </label>
          {createError && <p className="library-import-error">{createError}</p>}
          <div className="library-import-actions">
            <button type="submit" className="primary" disabled={createBusy}>
              {createBusy ? 'Creating...' : 'Create and use'}
            </button>
          </div>
        </form>
      )}

      <div className="library-toolbar">
        <input
          type="search"
          className="library-search"
          placeholder={t('settings.librarySearch')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="library-filters">
          {categories.map((cat) => {
            const count =
              cat === 'All'
                ? designSystems.length
                : designSystems.filter((d) => d.category === cat).length;
            return (
              <button
                key={cat}
                type="button"
                className={`filter-pill${categoryFilter === cat ? ' active' : ''}`}
                onClick={() => setCategoryFilter(cat)}
              >
                {cat}
                <span className="filter-pill-count">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="library-content">
        {filtered.length === 0 ? (
          <p className="library-empty">{t('settings.libraryNoResults')}</p>
        ) : (
          <>
            {Array.from(grouped.entries()).map(([category, items]) => (
              <div key={category} className="library-group">
                <h4 className="library-group-title">
                  {category}{' '}
                  <span className="library-group-count">{items.length}</span>
                </h4>
                <div className="ds-grid">
                  {items.map((ds) => (
                    <div
                      key={ds.id}
                      className={`library-ds-card${
                        disabledDS.has(ds.id) ? ' disabled' : ''
                      }`}
                    >
                      <div
                        className="library-ds-card-content"
                        onClick={() => openPreview(ds.id)}
                      >
                        {ds.swatches && ds.swatches.length > 0 && (
                          <div className="library-ds-swatches">
                            {ds.swatches.slice(0, 4).map((c, i) => (
                              <span
                                key={i}
                                className="library-ds-swatch"
                                style={{ backgroundColor: c }}
                              />
                            ))}
                          </div>
                        )}
                        <div className="library-ds-title">{ds.title}</div>
                        <div className="library-ds-summary">{ds.summary}</div>
                      </div>
                      <label
                        className="toggle-switch toggle-switch-sm"
                        title={t('settings.libraryToggleLabel')}
                      >
                        <input
                          type="checkbox"
                          checked={!disabledDS.has(ds.id)}
                          onChange={(e) =>
                            toggleDSDisabled(ds.id, e.target.checked)
                          }
                        />
                        <span className="toggle-slider" />
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {previewId && filtered.some((d) => d.id === previewId) && (
              <div className="library-preview">
                {previewLoading ? (
                  <p>{t('settings.libraryLoading')}</p>
                ) : previewBody ? (
                  <pre className="library-preview-body">{previewBody}</pre>
                ) : null}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

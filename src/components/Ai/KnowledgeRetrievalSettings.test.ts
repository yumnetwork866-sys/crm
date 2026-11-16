import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { KnowledgeRetrievalSettings } from './KnowledgeRetrievalSettings';
import { defaultRetrievalSettings } from '../../../shared/knowledgeRetrievalSettings';

function renderSettings(props: Parameters<typeof KnowledgeRetrievalSettings>[0] = {}) {
  const html = renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client: new QueryClient() },
      createElement(KnowledgeRetrievalSettings, props),
    ),
  );
  return { html, fieldset: html.match(/<fieldset[^>]*>/)?.[0] || '' };
}

describe('retrieval settings availability', () => {
  it.each([
    ['vector', 'Vector Search', 2],
    ['keyword', 'Full-Text Search', 1],
    ['hybrid', 'Hybrid Search', 3],
  ] as const)('shows controls only inside the selected %s method', (mode, label, ranges) => {
    const { html } = renderSettings({
      settings: { ...defaultRetrievalSettings, mode, hybridStrategy: 'weighted' },
      wide: true,
    });
    expect(html).toContain(`aria-label="Thiết lập ${label}"`);
    expect(html.match(/role="group"/g)).toHaveLength(1);
    expect(html.match(/type="range"/g)).toHaveLength(ranges);
  });
  it('uses the shared form without its own save button when controlled by the configuration page', () => {
    const { html, fieldset } = renderSettings({
      settings: { ...defaultRetrievalSettings, hybridStrategy: 'weighted', semanticWeight: 0.7 },
      onChange: () => undefined,
      formId: 'ai-configuration-form',
    });
    expect(fieldset).not.toContain('disabled');
    expect(html).not.toContain('Lưu thiết lập truy xuất');
    expect(html).toContain('form="ai-configuration-form"');
    expect(html).toContain('SEMANTIC 0.70');
  });
  it('allows editing defaults when a loaded API response omits retrieval settings', () => {
    const { html, fieldset } = renderSettings({ settings: undefined, loading: false });
    expect(fieldset).not.toContain('disabled');
    expect(html).toContain('Weighted Score');
    expect(html).toContain('Full-Text Search');
  });
  it('allows editing a loaded configuration', () => {
    expect(renderSettings({ settings: defaultRetrievalSettings }).fieldset).not.toContain(
      'disabled',
    );
  });
  it('locks controls while loading and explains the state', () => {
    const { html, fieldset } = renderSettings({ loading: true });
    expect(fieldset).toContain('disabled');
    expect(html).toContain('Đang tải thiết lập truy xuất');
  });
  it('preserves permission restrictions', () => {
    expect(
      renderSettings({ settings: defaultRetrievalSettings, disabled: true }).fieldset,
    ).toContain('disabled');
  });
  it('reports loading errors with a retry action', () => {
    const { html, fieldset } = renderSettings({
      loadError: 'Lỗi kết nối',
      onRetry: () => undefined,
    });
    expect(fieldset).toContain('disabled');
    expect(html).toContain('Lỗi kết nối');
    expect(html).toContain('Thử lại');
  });
});

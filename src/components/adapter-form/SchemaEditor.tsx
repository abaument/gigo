/**
 * Target-schema editing: Manual (JsonEditor) / From Docs (AI) /
 * From URL (AI). Generated schemas land in the manual editor for review.
 */

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { generateSchema, generateSchemaFromDocUrl } from '@/lib/actions';
import { JsonEditor } from '@/components/JsonEditor';
import { Tabs } from '@/components/ui/Tabs';
import { Spinner } from '@/components/ui/Spinner';

type SchemaTab = 'manual' | 'documentation' | 'url';

interface SchemaEditorProps {
  value: string;
  onChange: (value: string) => void;
  onValidChange: (valid: boolean) => void;
  onMeta?: (meta: { name?: string; description?: string }) => void;
  onSourceChange?: (source: SchemaTab, url?: string) => void;
}

export function SchemaEditor({
  value,
  onChange,
  onValidChange,
  onMeta,
  onSourceChange,
}: SchemaEditorProps) {
  const t = useTranslations('adapterForm');
  const [tab, setTab] = useState<SchemaTab>('manual');
  const [docsText, setDocsText] = useState('');
  const [docsUrl, setDocsUrl] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');

  const applyGenerated = (result: {
    success: boolean;
    schema?: string;
    schemaName?: string;
    description?: string;
    error?: string;
  }) => {
    if (result.success && result.schema) {
      onChange(result.schema);
      onMeta?.({ name: result.schemaName, description: result.description });
      setTab('manual');
    } else {
      setGenerateError(result.error || 'Generation failed');
    }
  };

  const handleGenerateFromDocs = async () => {
    if (!docsText.trim()) return;
    setIsGenerating(true);
    setGenerateError('');
    onSourceChange?.('documentation');
    applyGenerated(await generateSchema(docsText));
    setIsGenerating(false);
  };

  const handleGenerateFromUrl = async () => {
    if (!docsUrl.trim()) return;
    setIsGenerating(true);
    setGenerateError('');
    onSourceChange?.('url', docsUrl);
    applyGenerated(await generateSchemaFromDocUrl(docsUrl));
    setIsGenerating(false);
  };

  return (
    <div>
      <Tabs<SchemaTab>
        className="mb-6"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'manual', label: t('schemaTabManual') },
          { value: 'documentation', label: `✨ ${t('schemaTabDocs')}` },
          { value: 'url', label: `🔗 ${t('schemaTabUrl')}` },
        ]}
      />

      {generateError && (
        <div className="mb-4 p-3 bg-coral/10 border border-coral/30 rounded-lg text-coral text-sm font-accent">
          {generateError}
        </div>
      )}

      {tab === 'manual' && (
        <div>
          <p className="text-xs text-clay mb-2 font-accent">{t('schemaManualHelp')}</p>
          <JsonEditor value={value} onChange={onChange} onValidChange={onValidChange} />
        </div>
      )}

      {tab === 'documentation' && (
        <div>
          <label className="label">{t('docsLabel')}</label>
          <textarea
            value={docsText}
            onChange={(e) => setDocsText(e.target.value)}
            placeholder={t('docsPlaceholder')}
            className="textarea h-48"
          />
          <button
            type="button"
            onClick={handleGenerateFromDocs}
            disabled={isGenerating || !docsText.trim()}
            className="btn-primary mt-4 flex items-center gap-2 text-sm"
          >
            {isGenerating ? (
              <>
                <Spinner />
                {t('docsGenerating')}
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                {t('docsGenerate')}
              </>
            )}
          </button>
        </div>
      )}

      {tab === 'url' && (
        <div>
          <label className="label">{t('urlLabel')}</label>
          <div className="flex gap-3">
            <input
              type="url"
              value={docsUrl}
              onChange={(e) => setDocsUrl(e.target.value)}
              placeholder={t('urlPlaceholder')}
              className="input flex-1"
            />
            <button
              type="button"
              onClick={handleGenerateFromUrl}
              disabled={isGenerating || !docsUrl.trim()}
              className="btn-primary flex items-center gap-2 text-sm shrink-0"
            >
              {isGenerating ? <Spinner /> : null}
              {isGenerating ? t('urlGenerating') : t('urlGenerate')}
            </button>
          </div>
        </div>
      )}

      {value && tab !== 'manual' && (
        <div className="mt-6 pt-6 border-t border-bark">
          <p className="text-sm text-taupe font-accent mb-2">{t('generatedPreview')}</p>
          <JsonEditor value={value} onChange={onChange} onValidChange={onValidChange} minHeight="min-h-[10rem]" />
        </div>
      )}
    </div>
  );
}

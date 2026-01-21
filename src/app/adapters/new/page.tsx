/**
 * Create new adapter page with Smart Schema Generator.
 *
 * Features:
 * - Manual JSON schema input
 * - AI-powered documentation parser
 * - Destination configuration with auth
 */

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createAdapter, generateSchema, generateSchemaFromDocUrl } from '@/lib/actions';

type SchemaSourceTab = 'manual' | 'documentation' | 'url';
type AuthMethod = 'none' | 'bearer' | 'api_key' | 'basic';

export default function NewAdapterPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  
  // Basic info
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  
  // Schema configuration
  const [schemaTab, setSchemaTab] = useState<SchemaSourceTab>('manual');
  const [targetSchema, setTargetSchema] = useState('');
  const [documentationText, setDocumentationText] = useState('');
  const [documentationUrl, setDocumentationUrl] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Destination configuration
  const [enableDestination, setEnableDestination] = useState(false);
  const [destinationUrl, setDestinationUrl] = useState('');
  const [authMethod, setAuthMethod] = useState<AuthMethod>('none');
  const [authHeaderName, setAuthHeaderName] = useState('X-API-Key');
  const [authValue, setAuthValue] = useState('');
  
  // Errors
  const [error, setError] = useState('');
  const [schemaError, setSchemaError] = useState('');

  // Generate schema from documentation text
  const handleGenerateFromDocs = async () => {
    if (!documentationText.trim()) {
      setSchemaError('Please paste some documentation');
      return;
    }
    
    setIsGenerating(true);
    setSchemaError('');
    
    const result = await generateSchema(documentationText);
    
    if (result.success && result.schema) {
      setTargetSchema(result.schema);
      if (result.schemaName && !name) {
        setName(result.schemaName);
      }
      if (result.description && !description) {
        setDescription(result.description);
      }
      setSchemaTab('manual'); // Switch to manual to show/edit the result
    } else {
      setSchemaError(result.error || 'Failed to generate schema');
    }
    
    setIsGenerating(false);
  };

  // Generate schema from URL
  const handleGenerateFromUrl = async () => {
    if (!documentationUrl.trim()) {
      setSchemaError('Please enter a URL');
      return;
    }
    
    setIsGenerating(true);
    setSchemaError('');
    
    const result = await generateSchemaFromDocUrl(documentationUrl);
    
    if (result.success && result.schema) {
      setTargetSchema(result.schema);
      if (result.schemaName && !name) {
        setName(result.schemaName);
      }
      if (result.description && !description) {
        setDescription(result.description);
      }
      setSchemaTab('manual');
    } else {
      setSchemaError(result.error || 'Failed to fetch and parse URL');
    }
    
    setIsGenerating(false);
  };

  // Format JSON
  const formatJson = () => {
    try {
      const parsed = JSON.parse(targetSchema);
      setTargetSchema(JSON.stringify(parsed, null, 2));
      setSchemaError('');
    } catch {
      setSchemaError('Invalid JSON syntax');
    }
  };

  // Submit form
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Validate
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    
    if (!targetSchema.trim()) {
      setError('Target schema is required');
      return;
    }
    
    try {
      JSON.parse(targetSchema);
    } catch {
      setError('Invalid JSON in target schema');
      return;
    }
    
    if (enableDestination && !destinationUrl.trim()) {
      setError('Destination URL is required when forwarding is enabled');
      return;
    }

    startTransition(async () => {
      const result = await createAdapter({
        name,
        description: description || undefined,
        targetSchema,
        schemaSourceType: schemaTab,
        schemaSourceUrl: schemaTab === 'url' ? documentationUrl : undefined,
        destinationUrl: enableDestination ? destinationUrl : undefined,
        authMethod: enableDestination ? authMethod : undefined,
        authHeaderName: enableDestination && authMethod === 'api_key' ? authHeaderName : undefined,
        authValue: enableDestination && authMethod !== 'none' ? authValue : undefined,
      });

      if (result.success) {
        router.push('/');
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      {/* Header */}
      <div className="mb-10 animate-fade-in">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber/10 border border-amber/30 rounded-full text-amber text-xs font-accent mb-4">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Adapter
        </div>
        <h1 className="font-display text-4xl text-cream mb-3">Create Adapter</h1>
        <p className="text-taupe font-accent">
          Define your target schema and optionally configure a destination to forward transformed data.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {error && (
          <div className="p-4 bg-coral/10 border border-coral/30 rounded-lg text-coral text-sm font-accent animate-fade-in">
            {error}
          </div>
        )}

        {/* Basic Info */}
        <section className="card p-6 animate-slide-up">
          <h2 className="font-accent font-semibold text-cream text-lg mb-6 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-amber/20 text-amber text-xs flex items-center justify-center">1</span>
            Basic Information
          </h2>
          <div className="space-y-5">
            <div>
              <label htmlFor="name" className="label">
                Adapter Name <span className="text-coral">*</span>
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Stripe to HubSpot Adapter"
                className="input"
                required
              />
            </div>
            <div>
              <label htmlFor="description" className="label">Description</label>
              <input
                id="description"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of what this adapter does"
                className="input"
              />
            </div>
          </div>
        </section>

        {/* Schema Configuration */}
        <section className="card p-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <h2 className="font-accent font-semibold text-cream text-lg mb-6 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-gold/20 text-gold text-xs flex items-center justify-center">2</span>
            Target Schema
          </h2>

          {/* Tabs */}
          <div className="flex gap-2 mb-6 p-1 bg-roast rounded-lg w-fit">
            {[
              { id: 'manual', label: 'Manual' },
              { id: 'documentation', label: '✨ From Docs' },
              { id: 'url', label: '🔗 From URL' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSchemaTab(tab.id as SchemaSourceTab)}
                className={`px-4 py-2 rounded-md text-sm font-accent transition-all ${
                  schemaTab === tab.id
                    ? 'bg-amber text-espresso'
                    : 'text-taupe hover:text-cream'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {schemaError && (
            <div className="mb-4 p-3 bg-coral/10 border border-coral/30 rounded-lg text-coral text-sm font-accent">
              {schemaError}
            </div>
          )}

          {/* Manual Input */}
          {schemaTab === 'manual' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0">
                  JSON Schema <span className="text-coral">*</span>
                </label>
                <button
                  type="button"
                  onClick={formatJson}
                  className="text-xs text-amber hover:underline font-accent"
                >
                  Format JSON
                </button>
              </div>
              <textarea
                value={targetSchema}
                onChange={(e) => setTargetSchema(e.target.value)}
                placeholder={`Paste your target JSON structure, e.g.:
{
  "contact_id": "CON-001",
  "first_name": "John",
  "last_name": "Doe",
  "email": "john@example.com"
}`}
                className="textarea h-64"
                required
              />
            </div>
          )}

          {/* Documentation Input */}
          {schemaTab === 'documentation' && (
            <div>
              <label className="label">
                Paste API Documentation
              </label>
              <textarea
                value={documentationText}
                onChange={(e) => setDocumentationText(e.target.value)}
                placeholder={`Paste cURL examples, API docs, or JSON samples:

Example:
curl -X POST https://api.hubspot.com/contacts/v1/contact \\
  -H "Content-Type: application/json" \\
  -d '{
    "properties": [
      {"property": "email", "value": "john@example.com"},
      {"property": "firstname", "value": "John"}
    ]
  }'`}
                className="textarea h-48"
              />
              <button
                type="button"
                onClick={handleGenerateFromDocs}
                disabled={isGenerating}
                className="btn-primary mt-4 flex items-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Analyzing...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Generate Schema
                  </>
                )}
              </button>
            </div>
          )}

          {/* URL Input */}
          {schemaTab === 'url' && (
            <div>
              <label className="label">Documentation URL</label>
              <div className="flex gap-3">
                <input
                  type="url"
                  value={documentationUrl}
                  onChange={(e) => setDocumentationUrl(e.target.value)}
                  placeholder="https://api.example.com/docs/webhooks"
                  className="input flex-1"
                />
                <button
                  type="button"
                  onClick={handleGenerateFromUrl}
                  disabled={isGenerating}
                  className="btn-primary flex items-center gap-2"
                >
                  {isGenerating ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                  )}
                  Fetch & Generate
                </button>
              </div>
              <p className="text-xs text-clay mt-2 font-accent">
                We&apos;ll fetch the page and extract the JSON schema from the documentation.
              </p>
            </div>
          )}

          {/* Preview */}
          {targetSchema && schemaTab !== 'manual' && (
            <div className="mt-6 pt-6 border-t border-bark">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-taupe font-accent">Generated Schema Preview</span>
                <button
                  type="button"
                  onClick={() => setSchemaTab('manual')}
                  className="text-xs text-amber hover:underline font-accent"
                >
                  Edit manually
                </button>
              </div>
              <pre className="code-block text-xs max-h-48 overflow-auto">
                {targetSchema}
              </pre>
            </div>
          )}
        </section>

        {/* Destination Configuration */}
        <section className="card p-6 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-accent font-semibold text-cream text-lg flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-copper/20 text-copper text-xs flex items-center justify-center">3</span>
              Destination (Optional)
            </h2>
            <label className="flex items-center gap-3 cursor-pointer">
              <span className="text-sm text-taupe font-accent">Enable forwarding</span>
              <button
                type="button"
                onClick={() => setEnableDestination(!enableDestination)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  enableDestination ? 'bg-amber' : 'bg-bark'
                }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 rounded-full bg-cream transition-transform ${
                    enableDestination ? 'left-7' : 'left-1'
                  }`}
                />
              </button>
            </label>
          </div>

          {enableDestination ? (
            <div className="space-y-5">
              <div>
                <label className="label">
                  Destination URL <span className="text-coral">*</span>
                </label>
                <input
                  type="url"
                  value={destinationUrl}
                  onChange={(e) => setDestinationUrl(e.target.value)}
                  placeholder="https://api.yourservice.com/webhook"
                  className="input"
                />
                <p className="text-xs text-clay mt-1.5 font-accent">
                  Transformed data will be POSTed to this URL
                </p>
              </div>

              <div>
                <label className="label">Authentication</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[
                    { id: 'none', label: 'None' },
                    { id: 'bearer', label: 'Bearer Token' },
                    { id: 'api_key', label: 'API Key' },
                    { id: 'basic', label: 'Basic Auth' },
                  ].map((auth) => (
                    <button
                      key={auth.id}
                      type="button"
                      onClick={() => setAuthMethod(auth.id as AuthMethod)}
                      className={`px-4 py-2.5 rounded-lg text-sm font-accent border transition-all ${
                        authMethod === auth.id
                          ? 'bg-amber/10 border-amber text-amber'
                          : 'bg-roast border-bark text-taupe hover:border-timber'
                      }`}
                    >
                      {auth.label}
                    </button>
                  ))}
                </div>
              </div>

              {authMethod !== 'none' && (
                <div className="space-y-4 pt-4 border-t border-bark">
                  {authMethod === 'api_key' && (
                    <div>
                      <label className="label">Header Name</label>
                      <input
                        type="text"
                        value={authHeaderName}
                        onChange={(e) => setAuthHeaderName(e.target.value)}
                        placeholder="X-API-Key"
                        className="input"
                      />
                    </div>
                  )}
                  <div>
                    <label className="label">
                      {authMethod === 'bearer' && 'Bearer Token'}
                      {authMethod === 'api_key' && 'API Key Value'}
                      {authMethod === 'basic' && 'Username:Password'}
                    </label>
                    <input
                      type="password"
                      value={authValue}
                      onChange={(e) => setAuthValue(e.target.value)}
                      placeholder={
                        authMethod === 'basic' ? 'username:password' : '••••••••••••'
                      }
                      className="input"
                    />
                    <p className="text-xs text-clay mt-1.5 font-accent">
                      🔒 This will be encrypted before storage
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-taupe font-accent">
              <svg className="w-12 h-12 mx-auto mb-3 text-clay" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              <p>Enable forwarding to automatically send transformed data to another service</p>
            </div>
          )}
        </section>

        {/* Actions */}
        <div className="flex items-center justify-end gap-4 pt-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="btn-secondary"
            disabled={isPending}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary flex items-center gap-2"
            disabled={isPending || !name || !targetSchema}
          >
            {isPending ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Creating...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Adapter
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

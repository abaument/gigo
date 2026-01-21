/**
 * Homepage - GIGO Dashboard displaying all adapters.
 *
 * Shows a list of all created adapters with their webhook URLs,
 * transformation counts, and quick actions.
 */

import Link from 'next/link';
import { getAdapters } from '@/lib/actions';
import { AdapterCard } from '@/components/AdapterCard';
import { EmptyState } from '@/components/EmptyState';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const adapters = await getAdapters();

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      {/* Hero Section */}
      <section className="text-center mb-20 animate-fade-in">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber/10 border border-amber/30 rounded-full text-amber text-sm font-accent mb-6">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          AI-Powered JSON Transformation
        </div>
        <h1 className="font-display text-5xl md:text-6xl text-cream mb-6 tracking-tight">
          <span className="gigo-logo">Garbage In,</span>
          <br />
          <span className="text-cream">Gold Out</span>
        </h1>
        <p className="text-lg text-taupe max-w-2xl mx-auto mb-10 font-accent leading-relaxed">
          Transform any chaotic JSON payload into perfectly structured data. 
          Define your schema once, let AI handle the rest.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link href="/adapters/new" className="btn-primary text-base">
            Create Your First Adapter
          </Link>
          <a 
            href="https://github.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="btn-secondary text-base"
          >
            View Documentation
          </a>
        </div>
      </section>

      {/* How It Works */}
      <section className="mb-20">
        <h2 className="font-display text-2xl text-cream mb-10 text-center">
          How It Works
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="card p-8 text-center stagger-item group">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber/20 to-amber/5 border border-amber/30 flex items-center justify-center mx-auto mb-6 group-hover:shadow-[0_0_30px_rgba(212,168,83,0.2)] transition-all duration-300">
              <span className="font-display text-2xl text-amber">1</span>
            </div>
            <h3 className="font-accent font-semibold text-cream text-lg mb-3">Define Target Schema</h3>
            <p className="text-sm text-taupe font-accent leading-relaxed">
              Paste an example of the JSON structure your receiving system expects.
            </p>
          </div>
          <div className="card p-8 text-center stagger-item group">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gold/20 to-gold/5 border border-gold/30 flex items-center justify-center mx-auto mb-6 group-hover:shadow-[0_0_30px_rgba(201,162,39,0.2)] transition-all duration-300">
              <span className="font-display text-2xl text-gold">2</span>
            </div>
            <h3 className="font-accent font-semibold text-cream text-lg mb-3">Get Webhook URL</h3>
            <p className="text-sm text-taupe font-accent leading-relaxed">
              We generate a unique endpoint URL that you can use in any integration.
            </p>
          </div>
          <div className="card p-8 text-center stagger-item group">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-copper/20 to-copper/5 border border-copper/30 flex items-center justify-center mx-auto mb-6 group-hover:shadow-[0_0_30px_rgba(184,115,51,0.2)] transition-all duration-300">
              <span className="font-display text-2xl text-copper">3</span>
            </div>
            <h3 className="font-accent font-semibold text-cream text-lg mb-3">Auto-Transform</h3>
            <p className="text-sm text-taupe font-accent leading-relaxed">
              Any JSON sent to your endpoint is intelligently transformed to match your schema.
            </p>
          </div>
        </div>
      </section>

      {/* Adapters List */}
      <section>
        <div className="flex items-center justify-between mb-8">
          <h2 className="font-display text-2xl text-cream">
            Your Adapters
          </h2>
          {adapters.length > 0 && (
            <Link href="/adapters/new" className="btn-secondary text-sm">
              + New Adapter
            </Link>
          )}
        </div>

        {adapters.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-4">
            {adapters.map((adapter, index) => (
              <AdapterCard 
                key={adapter.id} 
                adapter={adapter}
                style={{ animationDelay: `${index * 0.05}s` }}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

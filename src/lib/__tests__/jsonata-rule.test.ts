import { describe, it, expect } from 'vitest';
import {
  applyRule,
  verifyRule,
  isExpressionAcceptable,
  buildRulePrompt,
  MAX_EXPRESSION_CHARS,
} from '../jsonata-rule';

const DIRTY = {
  REF_CMDE: '  fa-2026-0412 ',
  acheteur: { prenom_contact: 'jean-PIERRE', mail: '  JP.Martin@Exemple.FR ' },
  total_ttc_affiche: '1 250,50 €',
};

const RULE = `{
  "invoice_number": $uppercase($trim(REF_CMDE)),
  "customer_email": $lowercase($trim(acheteur.mail)),
  "total_incl_vat_cents": $number($replace($replace($replace(total_ttc_affiche, " ", ""), "€", ""), ",", ".")) * 100
}`;

describe('isExpressionAcceptable', () => {
  it('refuses an empty expression', () => {
    expect(isExpressionAcceptable('   ')).toMatch(/empty/i);
  });

  it('refuses an expression past the size cap', () => {
    expect(isExpressionAcceptable('a'.repeat(MAX_EXPRESSION_CHARS + 1))).toMatch(/exceeds/i);
  });

  it('accepts a normal mapping', () => {
    expect(isExpressionAcceptable(RULE)).toBeNull();
  });
});

describe('applyRule', () => {
  it('maps a dirty payload deterministically', async () => {
    const out = await applyRule(RULE, DIRTY);
    expect(out.success).toBe(true);
    expect(out.data).toEqual({
      invoice_number: 'FA-2026-0412',
      customer_email: 'jp.martin@exemple.fr',
      total_incl_vat_cents: 125050,
    });
  });

  it('gives the same result twice', async () => {
    const a = await applyRule(RULE, DIRTY);
    const b = await applyRule(RULE, DIRTY);
    expect(a.data).toEqual(b.data);
  });

  it('reports a syntax error instead of throwing', async () => {
    const out = await applyRule('{ "a": ', DIRTY);
    expect(out.success).toBe(false);
    expect(out.error).toMatch(/syntax/i);
  });

  it('reports an empty result rather than pretending it worked', async () => {
    const out = await applyRule('absent.champ', DIRTY);
    expect(out.success).toBe(false);
    expect(out.error).toMatch(/no result/i);
  });

  it('stops a runaway expression instead of letting it run', async () => {
    const started = Date.now();
    // the guard is given 200ms; the reduction alone takes seconds
    const out = await applyRule('$reduce([1..3000000], function($a, $b){ $a + $b })', {}, 200);
    expect(out.success).toBe(false);
    expect(out.error).toMatch(/exceeded/i);
    // and it really stopped, rather than returning while the work continued
    expect(Date.now() - started).toBeLessThan(1500);
  }, 10_000);
});

describe('verifyRule', () => {
  const expected = {
    invoice_number: 'FA-2026-0412',
    customer_email: 'jp.martin@exemple.fr',
    total_incl_vat_cents: 125050,
  };

  it('accepts a rule that reproduces the expected output', async () => {
    const v = await verifyRule(RULE, DIRTY, expected);
    expect(v.ok).toBe(true);
    expect(v.missingKeys).toEqual([]);
    expect(v.differingKeys).toEqual([]);
  });

  it('names the keys a rule forgot', async () => {
    const partial = '{ "invoice_number": $uppercase($trim(REF_CMDE)) }';
    const v = await verifyRule(partial, DIRTY, expected);
    expect(v.ok).toBe(false);
    expect(v.missingKeys).toContain('customer_email');
    expect(v.missingKeys).toContain('total_incl_vat_cents');
  });

  it('names the keys a rule got wrong', async () => {
    const wrong = `{
      "invoice_number": $trim(REF_CMDE),
      "customer_email": $lowercase($trim(acheteur.mail)),
      "total_incl_vat_cents": 0
    }`;
    const v = await verifyRule(wrong, DIRTY, expected);
    expect(v.ok).toBe(false);
    expect(v.differingKeys).toEqual(['invoice_number', 'total_incl_vat_cents']);
  });

  it('reports extra keys without failing on them', async () => {
    const extra = `$merge([${RULE}, { "note": "x" }])`;
    const v = await verifyRule(extra, DIRTY, expected);
    expect(v.ok).toBe(true);
    expect(v.extraKeys).toEqual(['note']);
  });

  it('surfaces a broken expression as an error, not as a mismatch', async () => {
    const v = await verifyRule('{ "a": ', DIRTY, expected);
    expect(v.ok).toBe(false);
    expect(v.error).toMatch(/syntax/i);
  });
});

describe('buildRulePrompt', () => {
  it('carries both the target and the payload, and asks for the expression alone', () => {
    const prompt = buildRulePrompt('{"a":1}', '{"b":2}');
    expect(prompt).toContain('{"a":1}');
    expect(prompt).toContain('{"b":2}');
    expect(prompt).toMatch(/ONLY the expression/i);
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_PROMPT_CHARS,
  catalogSamplePromptTexts,
  normalizePromptText,
  rankPromptThemes,
  tokenizePrompt,
  type PromptRecord,
} from './prompt-themes';

/** Most tests want raw counting behaviour, not catalog filtering. */
const noSamples = { samplePromptTexts: new Set<string>() };

describe('tokenizePrompt', () => {
  it('lowercases and drops stopwords', () => {
    assert.deepEqual(tokenizePrompt('Build me a Simple Scraper'), [
      'build',
      'simple',
      'scraper',
    ]);
  });

  it('drops product-constant words that carry no signal', () => {
    assert.deepEqual(tokenizePrompt('please help me make an agent'), []);
  });

  it('strips code fences', () => {
    const tokens = tokenizePrompt('summarize this ```const secret = 42;``` report');
    assert.deepEqual(tokens, ['summarize', 'report']);
  });

  it('strips URLs and emails so identifiers do not become themes', () => {
    const tokens = tokenizePrompt('scrape https://example.com/x?token=abc for me');
    assert.deepEqual(tokens, ['scrape']);
    assert.deepEqual(tokenizePrompt('mail bob@example.com report'), ['mail', 'report']);
  });

  it('drops bare numbers but keeps alphanumerics', () => {
    assert.deepEqual(tokenizePrompt('top 10 gpt4 results'), ['top', 'gpt4', 'results']);
  });

  it('segments CJK text instead of collapsing it', () => {
    // A recorded prompt: whitespace splitting would yield one useless token.
    const tokens = tokenizePrompt('就是不能抓取那些要人机验证的网址吗');
    assert.ok(tokens.length > 1, `expected multiple tokens, got ${JSON.stringify(tokens)}`);
    assert.ok(
      tokens.every((t) => !t.includes(' ')),
      'tokens should not contain spaces'
    );
  });

  it('truncates very long input', () => {
    const long = `unique ${'padding '.repeat(500)}tail`;
    assert.ok(long.length > MAX_PROMPT_CHARS);
    const tokens = tokenizePrompt(long);
    assert.ok(tokens.includes('unique'));
    assert.ok(!tokens.includes('tail'), 'text past the cap is ignored');
  });

  it('handles empty and punctuation-only input', () => {
    assert.deepEqual(tokenizePrompt(''), []);
    assert.deepEqual(tokenizePrompt('!!! ... ???'), []);
  });
});

describe('rankPromptThemes', () => {
  const prompts: PromptRecord[] = [
    { agentSlug: 'a', text: 'build a web scraper for news' },
    { agentSlug: 'a', text: 'build a web scraper for prices' },
    { agentSlug: 'b', text: 'generate an image of a cat' },
  ];

  it('counts distinct prompts, not occurrences', () => {
    const themes = rankPromptThemes(
      [
        { agentSlug: 'a', text: 'scraper scraper scraper scraper' },
        { agentSlug: 'a', text: 'scraper' },
      ],
      noSamples
    );
    const scraper = themes.unigrams.find((t) => t.term === 'scraper');
    assert.equal(scraper?.prompts, 2, 'repetition within one prompt must not inflate');
  });

  it('applies the minimum-prompts floor', () => {
    const themes = rankPromptThemes(prompts, { ...noSamples, minPrompts: 2 });
    assert.ok(themes.unigrams.some((t) => t.term === 'scraper'));
    assert.ok(
      !themes.unigrams.some((t) => t.term === 'cat'),
      'a term seen once is not a theme'
    );
  });

  it('surfaces bigrams separately', () => {
    const themes = rankPromptThemes(prompts, { ...noSamples, minPrompts: 2 });
    assert.ok(themes.bigrams.some((t) => t.term === 'web scraper'));
    assert.ok(!themes.unigrams.some((t) => t.term.includes(' ')));
  });

  it('attributes themes to agents, most frequent first', () => {
    const themes = rankPromptThemes(
      [
        { agentSlug: 'a', text: 'scraper one' },
        { agentSlug: 'a', text: 'scraper two' },
        { agentSlug: 'b', text: 'scraper three' },
      ],
      { ...noSamples, minPrompts: 2 }
    );
    const scraper = themes.unigrams.find((t) => t.term === 'scraper');
    assert.deepEqual(scraper?.agents, [
      { agentSlug: 'a', prompts: 2 },
      { agentSlug: 'b', prompts: 1 },
    ]);
  });

  it('respects topN', () => {
    const many: PromptRecord[] = Array.from({ length: 10 }, (_, i) => ({
      agentSlug: 'a',
      text: `term${i} term${i} shared`,
    }));
    const themes = rankPromptThemes(many, { ...noSamples, minPrompts: 1, topN: 3 });
    assert.equal(themes.unigrams.length, 3);
    assert.equal(themes.unigrams[0].term, 'shared', 'most common ranks first');
  });

  it('reports totals and tolerates empty input', () => {
    assert.deepEqual(rankPromptThemes([], noSamples), {
      totalPrompts: 0,
      samplePrompts: 0,
      organicPrompts: 0,
      distinctOrganicPrompts: 0,
      unigrams: [],
      bigrams: [],
    });
    const ranked = rankPromptThemes(prompts, noSamples);
    assert.equal(ranked.totalPrompts, 3);
    assert.equal(ranked.organicPrompts, 3);
    assert.equal(ranked.distinctOrganicPrompts, 3);
  });

  it('collapses identical prompts and skips empty tokenization', () => {
    const themes = rankPromptThemes(
      [
        { agentSlug: 'a', text: 'please help' },
        { agentSlug: 'a', text: 'scraper' },
        { agentSlug: 'a', text: 'scraper' },
      ],
      { ...noSamples, minPrompts: 1 }
    );
    assert.equal(themes.totalPrompts, 3);
    assert.equal(themes.distinctOrganicPrompts, 1);
    assert.equal(themes.unigrams.find((t) => t.term === 'scraper')?.prompts, 1);
  });

  it('excludes catalog sample prompts from themes', () => {
    const samples = new Set([normalizePromptText('Build a web scraper')]);
    const themes = rankPromptThemes(
      [
        { agentSlug: 'a', text: 'Build a web scraper' },
        { agentSlug: 'a', text: 'custom scraper for invoices' },
        { agentSlug: 'b', text: 'custom scraper for payroll' },
      ],
      { samplePromptTexts: samples, minPrompts: 2 }
    );
    assert.equal(themes.samplePrompts, 1);
    assert.equal(themes.organicPrompts, 2);
    assert.ok(themes.unigrams.some((t) => t.term === 'scraper'));
  });

  it('is deterministic for equal counts', () => {
    const input: PromptRecord[] = [
      { agentSlug: 'a', text: 'beta alpha' },
      { agentSlug: 'a', text: 'alpha beta' },
    ];
    const first = rankPromptThemes(input, { ...noSamples, minPrompts: 2 }).unigrams.map(
      (t) => t.term
    );
    const second = rankPromptThemes(input, { ...noSamples, minPrompts: 2 }).unigrams.map(
      (t) => t.term
    );
    assert.deepEqual(first, second);
    assert.deepEqual(first, ['alpha', 'beta'], 'ties break alphabetically');
  });
});

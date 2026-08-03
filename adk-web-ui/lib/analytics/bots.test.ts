import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { identifyBot } from './bots.ts';

describe('identifyBot', () => {
  it('labels OpenAI GPTBot as ai with high confidence', () => {
    const result = identifyBot(
      'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)'
    );
    assert.equal(result.isBot, true);
    assert.equal(result.botName, 'GPTBot');
    assert.equal(result.botCategory, 'ai');
    assert.equal(result.confidence, 'high');
  });

  it('labels ChatGPT-User', () => {
    const result = identifyBot('Mozilla/5.0; ChatGPT-User/1.0');
    assert.equal(result.botName, 'ChatGPT-User');
    assert.equal(result.botCategory, 'ai');
  });

  it('labels Googlebot as search', () => {
    const result = identifyBot(
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
    );
    assert.equal(result.botName, 'Googlebot');
    assert.equal(result.botCategory, 'search');
  });

  it('labels Claude-User and Claude-SearchBot separately from ClaudeBot', () => {
    assert.equal(identifyBot('compatible; Claude-User/1.0').botName, 'Claude-User');
    assert.equal(
      identifyBot('compatible; Claude-SearchBot/1.0').botName,
      'Claude-SearchBot'
    );
    assert.equal(identifyBot('compatible; ClaudeBot/1.0').botName, 'ClaudeBot');
  });

  it('prefers Applebot-Extended over Applebot', () => {
    const result = identifyBot(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko; compatible; Applebot-Extended/0.3; +http://www.apple.com/go/applebot)'
    );
    assert.equal(result.botName, 'Applebot-Extended');
    assert.equal(result.botCategory, 'ai');
  });

  it('does not mark a normal Chrome UA as bot', () => {
    const result = identifyBot(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      { language: 'en-US', source: 'client' }
    );
    assert.equal(result.isBot, false);
    assert.equal(result.botName, null);
  });

  it('names generic crawlers from the UA token instead of UnknownBot', () => {
    const result = identifyBot('Mozilla/5.0 (compatible; Acme crawler/1.0)');
    assert.equal(result.isBot, true);
    assert.equal(result.botName, 'Acme-crawler');
    assert.equal(result.confidence, 'medium');
  });

  it('labels soft-signal empty UA as UnknownBot', () => {
    const headers = new Headers(); // no sec-fetch-*
    const result = identifyBot('', {
      source: 'server',
      language: null,
      headers,
    });
    assert.equal(result.isBot, true);
    assert.equal(result.botName, 'UnknownBot');
    assert.ok(result.signals.includes('empty_ua'));
    assert.ok(result.signals.includes('missing_accept_language'));
  });

  it('keeps single soft signal as human with low confidence', () => {
    const result = identifyBot(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      { source: 'server', language: null }
    );
    assert.equal(result.isBot, false);
    assert.equal(result.confidence, 'low');
    assert.ok(result.signals.includes('missing_accept_language'));
  });

  it('labels newly discovered UnknownBot UAs', () => {
    assert.equal(
      identifyBot(
        'Mozilla/5.0 (compatible; SERankingBacklinksBot/1.0; +https://seranking.com/backlinks-crawler)'
      ).botName,
      'SERankingBacklinksBot'
    );
    assert.equal(
      identifyBot(
        'Mozilla/5.0 (compatible; DeepSeekBot/1.0; +https://www.deepseek.com/bot)'
      ).botName,
      'DeepSeekBot'
    );
    assert.equal(
      identifyBot(
        'Mozilla/5.0 (compatible; SeznamBot/4.0; +https://o-seznam.cz/napoveda/vyhledavani/en/seznambot-crawler/)'
      ).botName,
      'SeznamBot'
    );
  });
});

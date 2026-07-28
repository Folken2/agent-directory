import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  botCompany,
  botPurpose,
  rollUpBotCompanies,
  toBotAgentStat,
} from './bot-companies.ts';

describe('botCompany', () => {
  it('maps OpenAI crawlers to OpenAI', () => {
    assert.equal(botCompany('GPTBot').name, 'OpenAI');
    assert.equal(botCompany('ChatGPT-User').id, 'openai');
    assert.equal(botCompany('OAI-SearchBot').id, 'openai');
  });

  it('maps ClaudeBot to Anthropic', () => {
    assert.equal(botCompany('ClaudeBot').name, 'Anthropic');
  });

  it('rolls subsidiaries up to the parent company', () => {
    assert.equal(botCompany('LinkedInBot').name, 'Microsoft');
    assert.equal(botCompany('Bingbot').name, 'Microsoft');
    assert.equal(botCompany('Slackbot').name, 'Salesforce');
    assert.equal(botCompany('Bytespider').name, 'ByteDance');
    assert.equal(botCompany('facebookexternalhit').name, 'Meta');
    assert.equal(botCompany('WhatsApp').name, 'Meta');
  });

  it('falls back to Unidentified for unknown crawlers', () => {
    assert.equal(botCompany('UnknownBot').id, 'unknown');
    assert.equal(botCompany(null).id, 'unknown');
  });
});

describe('botPurpose', () => {
  it('separates training from answering and indexing', () => {
    assert.equal(botPurpose('GPTBot'), 'training');
    assert.equal(botPurpose('ClaudeBot'), 'training');
    assert.equal(botPurpose('ChatGPT-User'), 'ai-answers');
    assert.equal(botPurpose('Googlebot'), 'indexing');
    assert.equal(botPurpose('Twitterbot'), 'preview');
    assert.equal(botPurpose('AhrefsBot'), 'seo');
    assert.equal(botPurpose('UptimeRobot'), 'monitoring');
    assert.equal(botPurpose('SomethingElse'), 'other');
  });
});

describe('rollUpBotCompanies', () => {
  const agents = [
    toBotAgentStat('GPTBot', 300),
    toBotAgentStat('ChatGPT-User', 100),
    toBotAgentStat('ClaudeBot', 500),
    toBotAgentStat('Bingbot', 60),
    toBotAgentStat('LinkedInBot', 40),
  ];

  it('groups agents by company and sorts by volume', () => {
    const rows = rollUpBotCompanies(agents, 1000);
    assert.deepEqual(
      rows.map((r) => [r.name, r.count]),
      [
        ['Anthropic', 500],
        ['OpenAI', 400],
        ['Microsoft', 100],
      ]
    );
  });

  it('computes share of bot traffic', () => {
    const rows = rollUpBotCompanies(agents, 1000);
    assert.equal(rows[0].share, 50);
    assert.equal(rows[1].share, 40);
    assert.equal(rows[2].share, 10);
  });

  it('keeps each company’s agents ordered by count', () => {
    const rows = rollUpBotCompanies(agents, 1000);
    const openai = rows.find((r) => r.id === 'openai');
    assert.deepEqual(openai?.agents.map((a) => a.botName), [
      'GPTBot',
      'ChatGPT-User',
    ]);
  });

  it('flags companies that run AI crawlers', () => {
    const rows = rollUpBotCompanies(agents, 1000);
    assert.equal(rows.find((r) => r.id === 'anthropic')?.ai, true);
    assert.equal(rows.find((r) => r.id === 'microsoft')?.ai, false);
  });

  it('does not divide by zero', () => {
    const rows = rollUpBotCompanies([toBotAgentStat('GPTBot', 0)], 0);
    assert.equal(rows[0].share, 0);
  });
});

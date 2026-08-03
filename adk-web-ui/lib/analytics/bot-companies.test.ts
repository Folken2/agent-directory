import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  botCompany,
  botPurpose,
  brandIconUrl,
  rollUpBotCompanies,
  toBotAgentStat,
} from './bot-companies.ts';
import { identifyBot } from './bots.ts';

describe('botCompany', () => {
  it('maps OpenAI crawlers to OpenAI', () => {
    assert.equal(botCompany('GPTBot').name, 'OpenAI');
    assert.equal(botCompany('ChatGPT-User').id, 'openai');
    assert.equal(botCompany('OAI-SearchBot').id, 'openai');
  });

  it('maps Anthropic crawlers to Anthropic', () => {
    assert.equal(botCompany('ClaudeBot').name, 'Anthropic');
    assert.equal(botCompany('Claude-User').id, 'anthropic');
    assert.equal(botCompany('Claude-SearchBot').id, 'anthropic');
  });

  it('attributes the operator brand, not the conglomerate parent', () => {
    // LinkedIn is Microsoft-owned, but LinkedInBot is operated by LinkedIn.
    assert.equal(botCompany('LinkedInBot').name, 'LinkedIn');
    assert.equal(botCompany('LinkedInBot').domain, 'linkedin.com');
    // Slack is Salesforce-owned, but Slackbot is operated by Slack.
    assert.equal(botCompany('Slackbot').name, 'Slack');
    assert.equal(botCompany('Slackbot').domain, 'slack.com');
    // Bing is Microsoft’s search crawler.
    assert.equal(botCompany('Bingbot').name, 'Microsoft');
    assert.equal(botCompany('Bytespider').name, 'ByteDance');
    assert.equal(botCompany('facebookexternalhit').name, 'Meta');
    assert.equal(botCompany('WhatsApp').name, 'Meta');
    assert.equal(botCompany('Pingdom').name, 'Pingdom');
  });

  it('exposes a canonical domain for real brand icons', () => {
    assert.equal(botCompany('GPTBot').domain, 'openai.com');
    assert.equal(botCompany('ClaudeBot').domain, 'anthropic.com');
    assert.equal(botCompany('UnknownBot').domain, null);
  });

  it('falls back to Unidentified for unknown crawlers', () => {
    assert.equal(botCompany('UnknownBot').id, 'unknown');
    assert.equal(botCompany(null).id, 'unknown');
  });
});

describe('brandIconUrl', () => {
  it('returns a PNG favicon URL for a domain', () => {
    assert.equal(
      brandIconUrl('openai.com', 64),
      'https://www.google.com/s2/favicons?domain=openai.com&sz=64'
    );
  });

  it('returns null without a domain', () => {
    assert.equal(brandIconUrl(null), null);
  });
});

describe('botPurpose', () => {
  it('separates training from answering and indexing', () => {
    assert.equal(botPurpose('GPTBot'), 'training');
    assert.equal(botPurpose('ClaudeBot'), 'training');
    assert.equal(botPurpose('Claude-User'), 'ai-answers');
    assert.equal(botPurpose('Claude-SearchBot'), 'indexing');
    assert.equal(botPurpose('ChatGPT-User'), 'ai-answers');
    assert.equal(botPurpose('Googlebot'), 'indexing');
    assert.equal(botPurpose('Twitterbot'), 'preview');
    assert.equal(botPurpose('AhrefsBot'), 'seo');
    assert.equal(botPurpose('UptimeRobot'), 'monitoring');
    assert.equal(botPurpose('SomethingElse'), 'other');
  });
});

describe('identifyBot ↔ botCompany coverage', () => {
  const samples: Array<[string, string, string]> = [
    ['GPTBot/1.2', 'GPTBot', 'openai'],
    ['Claude-User/1.0', 'Claude-User', 'anthropic'],
    ['Claude-SearchBot/1.0', 'Claude-SearchBot', 'anthropic'],
    ['Perplexity-User/1.0', 'Perplexity-User', 'perplexity'],
    ['MistralAI-User/1.0', 'MistralAI-User', 'mistral'],
    ['meta-externalfetcher/1.0', 'meta-externalfetcher', 'meta'],
    ['FacebookBot/1.0', 'FacebookBot', 'meta'],
    ['Google-CloudVertexBot/1.0', 'Google-CloudVertexBot', 'google'],
    ['DuckAssistBot/1.0', 'DuckAssistBot', 'duckduckgo'],
    ['Applebot-Extended/1.0', 'Applebot-Extended', 'apple'],
    ['LinkedInBot/1.0', 'LinkedInBot', 'linkedin'],
    ['Slackbot/1.0', 'Slackbot', 'slack'],
    ['bingbot/2.0', 'Bingbot', 'microsoft'],
  ];

  for (const [ua, botName, companyId] of samples) {
    it(`maps ${botName} → ${companyId}`, () => {
      const match = identifyBot(`Mozilla/5.0 (compatible; ${ua})`);
      assert.equal(match.botName, botName);
      assert.equal(botCompany(match.botName).id, companyId);
    });
  }
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
        ['Microsoft', 60],
        ['LinkedIn', 40],
      ]
    );
  });

  it('computes share of bot traffic', () => {
    const rows = rollUpBotCompanies(agents, 1000);
    assert.equal(rows[0].share, 50);
    assert.equal(rows[1].share, 40);
    assert.equal(rows[2].share, 6);
    assert.equal(rows[3].share, 4);
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
    assert.equal(rows.find((r) => r.id === 'linkedin')?.ai, false);
  });

  it('carries domain through for icons', () => {
    const rows = rollUpBotCompanies(agents, 1000);
    assert.equal(rows.find((r) => r.id === 'openai')?.domain, 'openai.com');
    assert.equal(rows.find((r) => r.id === 'linkedin')?.domain, 'linkedin.com');
  });

  it('does not divide by zero', () => {
    const rows = rollUpBotCompanies([toBotAgentStat('GPTBot', 0)], 0);
    assert.equal(rows[0].share, 0);
  });
});

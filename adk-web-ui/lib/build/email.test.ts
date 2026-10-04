import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildLinkEmail } from './email.ts';
import { BUILD } from './test-fixtures.ts';

const LINK = 'https://site.test/builds/' + 'a'.repeat(43);
const URL_RE = /https?:\/\/[^\s"'<>]+/g;

describe('buildLinkEmail', () => {
  const msg = buildLinkEmail(BUILD, LINK);

  it('names the agent and links to it', () => {
    assert.equal(msg.subject, 'Your agent: research-summarizer');
    assert.ok(msg.text.includes(LINK));
    assert.ok(msg.html.includes(`href="${LINK}"`));
    assert.ok(msg.text.includes('site.test'));
    assert.ok(msg.text.includes('.env.example'));
    assert.ok(msg.text.includes('41 files'));
  });

  it('contains no URL or domain that did not come from the link', () => {
    for (const body of [msg.text, msg.html]) {
      for (const url of body.match(URL_RE) ?? []) assert.equal(url, LINK);
    }
    const other = buildLinkEmail(BUILD, 'http://localhost:3000/builds/x');
    assert.ok(!other.text.includes('site.test'));
    assert.ok(other.text.includes('localhost:3000'));
  });

  it('escapes HTML from the build summary', () => {
    const evil = buildLinkEmail({ ...BUILD, name: '<b>x</b>', description: '<script>alert(1)</script>' }, LINK);
    assert.ok(!evil.html.includes('<script>'));
    assert.ok(evil.html.includes('&lt;script&gt;'));
    assert.ok(evil.html.includes('&lt;b&gt;x&lt;/b&gt;'));
  });

  it('defangs URLs and header injection steered by the visitor', () => {
    const hostile = buildLinkEmail(
      {
        ...BUILD,
        name: 'x.test\r\nBcc: a@b.test',
        description: 'Go to https://phish.example/login or www.evil.test or evil.test/path now',
      },
      LINK,
    );
    for (const body of [hostile.text, hostile.html, hostile.subject]) {
      for (const url of body.match(URL_RE) ?? []) assert.equal(url, LINK);
      assert.ok(!body.includes('www.'));
      assert.ok(!body.includes('evil.test'));
      assert.ok(!body.includes('phish.example'));
    }
    assert.ok(!/[\r\n]/.test(hostile.subject));
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  KNOWN_STATIC_ROUTES,
  classifyPath,
  isKnownRoute,
  isPageView,
  normalizePath,
} from './path-classify';

describe('normalizePath', () => {
  it('strips query and hash', () => {
    assert.equal(normalizePath('/about?utm_source=x'), '/about');
    assert.equal(normalizePath('/about#team'), '/about');
  });

  it('strips a trailing slash but keeps root', () => {
    assert.equal(normalizePath('/about/'), '/about');
    assert.equal(normalizePath('/'), '/');
  });

  it('handles empty and relative input', () => {
    assert.equal(normalizePath(''), '/');
    assert.equal(normalizePath('about'), '/about');
  });
});

describe('isKnownRoute', () => {
  it('accepts static routes', () => {
    assert.equal(isKnownRoute('/'), true);
    assert.equal(isKnownRoute('/analytics/ops'), true);
    assert.equal(isKnownRoute('/settings/keys'), true);
  });

  it('accepts agent detail slugs', () => {
    assert.equal(isKnownRoute('/agents/adk_agent_builder'), true);
    assert.equal(isKnownRoute('/agents/simple_agent_web_search_EXA'), true);
  });

  it('rejects nested paths under a dynamic route', () => {
    assert.equal(isKnownRoute('/agents/foo/bar'), false);
  });
});

describe('classifyPath — real routes', () => {
  it('classifies every known route as a page', () => {
    for (const route of KNOWN_STATIC_ROUTES) {
      assert.equal(classifyPath(route), 'page', route);
    }
  });

  it('classifies agent pages as pages', () => {
    assert.equal(classifyPath('/agents/deep_research_agent'), 'page');
  });
});

describe('classifyPath — scanners', () => {
  // Every path here was actually recorded in page_views, most with is_bot=false.
  const scannerPaths = [
    '/.git/config',
    '/.git/HEAD',
    '/.git/packed-refs',
    '/app/.git/config',
    '/.env',
    '/.env.local',
    '/.env.production',
    '/.env.bak',
    '/.env.php',
    '/laravel/.env',
    '/admin.php',
    '/wp-config.php.bak',
    '/wp-config.php~',
    '/wp-content/plugins/hellopress/wp_filemanager.php',
    '/wp-json/mailpoet/v1/settings',
    '/this_is_a_new_hello_world.php',
    '/66b867516c8f01.php',
    '/1wvekeybd9it2di2vyipgr6Cdefault.php',
    '/aws-credentials.json',
    '/service-account-key.json',
    '/config/secrets.yml',
    '/config/master.key',
    '/terraform.tfvars',
    '/terraform.tfstate.backup',
    '/kubernetes/secrets.yaml',
    '/appsettings.json',
    '/web.config',
    '/swagger.json',
    '/_profiler/phpinfo',
    '/_ignition/health-check',
    '/settings.py',
    '/config/environments/production.rb',
    '/.vscode/settings.json',
    '/.anthropic/config.json',
    '/api-keys.json',
    // Extensionless dependency/tooling probes.
    '/Pipfile',
    '/Gemfile',
    '/kube/config',
    '/cloud-init/user-data',
    '/debug/vars',
    '/graphql',
    '/env',
    '/exec',
  ];

  for (const path of scannerPaths) {
    it(`flags ${path}`, () => {
      assert.equal(classifyPath(path), 'scanner');
    });
  }
});

describe('classifyPath — infra', () => {
  it('treats well-known probes as infra, not attacks', () => {
    assert.equal(classifyPath('/.well-known/traffic-advice'), 'infra');
    assert.equal(classifyPath('/robots.txt'), 'infra');
    assert.equal(classifyPath('/sitemap.xml'), 'infra');
    assert.equal(classifyPath('/favicon.ico'), 'infra');
  });
});

describe('classifyPath — missing pages', () => {
  // Recorded 404s that look like a page request rather than an attack. Whether
  // they represent real demand is the signal's call, not the classifier's —
  // most of these arrived once, from a contact-page scraper.
  it('flags plausible page requests as missing', () => {
    assert.equal(classifyPath('/terms'), 'missing');
    assert.equal(classifyPath('/help'), 'missing');
    assert.equal(classifyPath('/contact-us'), 'missing');
    assert.equal(classifyPath('/about-us'), 'missing');
    assert.equal(classifyPath('/search'), 'missing');
  });

  it('does not treat gibberish as a missing page', () => {
    assert.equal(classifyPath('/1wvekeybd9it2di2vyipgr6Cdefault.php'), 'scanner');
    assert.equal(classifyPath('/x402.ph'), 'scanner');
  });

  it('rejects overly long paths', () => {
    const long = `/${'a'.repeat(60)}`;
    assert.equal(classifyPath(long), 'scanner');
  });
});

describe('isPageView', () => {
  it('is true only for real routes', () => {
    assert.equal(isPageView('/about'), true);
    assert.equal(isPageView('/.env'), false);
    assert.equal(isPageView('/terms'), false);
    assert.equal(isPageView('/robots.txt'), false);
  });
});

/**
 * Guards against drift: adding or deleting a page must update
 * KNOWN_STATIC_ROUTES, or every view of that page silently becomes a "missing"
 * 404 in reporting.
 */
describe('KNOWN_STATIC_ROUTES matches the app directory', () => {
  const appDir = join(process.cwd(), 'app');

  function collectRoutes(dir: string, prefix = ''): string[] {
    const routes: string[] = [];
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        // Route groups `(x)` don't affect the URL; dynamic `[x]` is handled
        // by DYNAMIC_ROUTES; `api` serves no pages.
        if (entry === 'api') continue;
        if (entry.startsWith('[')) continue;
        const segment = entry.startsWith('(') ? '' : `/${entry}`;
        routes.push(...collectRoutes(full, `${prefix}${segment}`));
      } else if (entry === 'page.tsx' || entry === 'page.ts') {
        routes.push(prefix === '' ? '/' : prefix);
      }
    }
    return routes;
  }

  it('has no missing or extra entries', () => {
    const actual = collectRoutes(appDir).sort();
    const declared = [...KNOWN_STATIC_ROUTES].sort();
    assert.deepEqual(
      declared,
      actual,
      `Route list drifted.\n  declared: ${declared.join(', ')}\n  actual:   ${actual.join(', ')}`
    );
  });
});

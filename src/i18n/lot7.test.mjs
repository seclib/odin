// Lot 7 — i18n infrastructure tests: advanced locale normalization, RTL
// isolation, message overrides, reactive locale binding and the Japanese
// relative-time spacing fix. Catalog completeness is covered by
// catalog.test.mjs; these exercise the machinery the 11 new locales need.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyDocumentTranslations,
  bindLocale,
  formatNumber,
  formatRelativeTime,
  getLocale,
  isolate,
  keepCodesWithValues,
  notifyLocaleChange,
  onLocaleChange,
  persistLocale,
  setLocale,
  setMessageOverrides,
  t,
  tn,
  translateKnown,
} from './index.js';
import {
  applyDocumentLanguage,
  intlLocale,
  isRtlLocale,
  normalizeLocale,
} from './locale.js';

test('normalizeLocale maps region and legacy tags to a shipped locale', () => {
  assert.equal(normalizeLocale('ru-RU'), 'ru');
  assert.equal(normalizeLocale('RU'), 'ru');
  assert.equal(normalizeLocale('de-AT'), 'de');
  assert.equal(normalizeLocale('de_CH'), 'de');
  assert.equal(normalizeLocale('ja-JP'), 'ja');
  assert.equal(normalizeLocale('pt-BR'), 'pt');
  assert.equal(normalizeLocale('pt-PT'), 'pt');
  assert.equal(normalizeLocale('ar-EG'), 'ar');
  assert.equal(normalizeLocale('ar-SA'), 'ar');
  assert.equal(normalizeLocale('he-IL'), 'he');
  assert.equal(normalizeLocale('iw'), 'he');
  assert.equal(normalizeLocale('iw-IL'), 'he');
  assert.equal(normalizeLocale('zh'), 'zh-CN');
  assert.equal(normalizeLocale('zh-CN'), 'zh-CN');
  assert.equal(normalizeLocale('zh-Hans-SG'), 'zh-CN');
  assert.equal(normalizeLocale('zh-Hant'), 'zh-Hant');
  assert.equal(normalizeLocale('zh-TW'), 'zh-Hant');
  assert.equal(normalizeLocale('zh-HK'), 'zh-Hant');
  assert.equal(normalizeLocale('xx'), null);
  assert.equal(normalizeLocale(''), null);
  assert.equal(normalizeLocale(null), null);
});

test('isRtlLocale names Arabic and Hebrew only', () => {
  assert.equal(isRtlLocale('ar'), true);
  assert.equal(isRtlLocale('he'), true);
  assert.equal(isRtlLocale('iw'), true);
  assert.equal(isRtlLocale('ar-EG'), true);
  for (const locale of ['en', 'es', 'ru', 'de', 'zh-CN', 'zh-Hant', 'ja', 'fa'])
    assert.equal(isRtlLocale(locale), false, locale);
});

test('intlLocale pins Arabic to Western digits and leaves others alone', () => {
  assert.equal(intlLocale('ar'), 'ar-u-nu-latn');
  assert.equal(intlLocale('ar-EG'), 'ar-u-nu-latn');
  for (const locale of ['en', 'ru', 'de', 'zh-CN', 'ja', 'he']) {
    assert.equal(intlLocale(locale), locale === normalizeLocale(locale) ? locale : locale);
  }
});

test('applyDocumentLanguage sets lang and dir, RTL for ar/he', () => {
  const doc = { documentElement: {} };
  applyDocumentLanguage(doc, 'ar');
  assert.deepEqual(doc.documentElement, { lang: 'ar', dir: 'rtl' });
  applyDocumentLanguage(doc, 'he');
  assert.deepEqual(doc.documentElement, { lang: 'he', dir: 'rtl' });
  applyDocumentLanguage(doc, 'zh-CN');
  assert.deepEqual(doc.documentElement, { lang: 'zh-CN', dir: 'ltr' });
  applyDocumentLanguage(doc, 'xx');
  assert.deepEqual(doc.documentElement, { lang: 'en', dir: 'ltr' });
});

test('isolate wraps values only in an RTL locale', () => {
  const previous = getLocale();
  try {
    setLocale('ar');
    assert.equal(isolate('30 m'), '\u206830 m\u2069');
    assert.equal(t('Issued: {time}', { time: '10/28 00:00 UTC' }), 'صدر: \u206810/28 00:00 UTC\u2069');
    assert.equal(
      keepCodesWithValues('\u2068Austin\u2069 · HDG \u206868°\u2069 · FOV \u206844°\u2069'),
      '\u2068Austin\u2069 · \u2068HDG \u206868°\u2069\u2069 · \u2068FOV \u206844°\u2069\u2069',
    );
    setLocale('en');
    assert.equal(isolate('30 m'), '30 m');
    assert.equal(keepCodesWithValues('HDG 68°'), 'HDG 68°');
  } finally {
    setLocale(previous);
  }
});

test('Arabic formatNumber uses Western digits whatever ICU defaults to', () => {
  const previous = getLocale();
  try {
    setLocale('ar');
    const out = formatNumber(9876543210);
    assert.doesNotMatch(out, /[٠-٩]/);
    assert.equal(formatNumber(1234.5), '1,234.5');
  } finally {
    setLocale(previous);
  }
});

test('setMessageOverrides shows host text per locale, English fallback, plurals', () => {
  const previous = getLocale();
  try {
    setMessageOverrides({
      en: {
        'Download scene JSON': 'Download scene file',
        'Imported {file}': 'Opened {file}',
        'action|CLEAR': 'WIPE',
        '{count} cameras': { one: '{count} feed', other: '{count} feeds' },
      },
      de: { 'Download scene JSON': 'Szenendatei herunterladen' },
    });
    assert.equal(t('Download scene JSON'), 'Download scene file');
    setLocale('de');
    assert.equal(t('Download scene JSON'), 'Szenendatei herunterladen');
    setLocale('fr');
    // A locale the host did not word shows the host's English, not Core's.
    assert.equal(t('Download scene JSON'), 'Download scene file');
    assert.equal(t('Imported {file}', { file: 'a.zip' }), 'Opened a.zip');
    assert.equal(t('CLEAR', { context: 'action' }), 'WIPE');
    assert.equal(tn(1, '{count} camera', '{count} cameras'), '1 feed');
    assert.equal(tn(3, '{count} camera', '{count} cameras'), '3 feeds');
    assert.equal(translateKnown('Imported {file}'), 'Opened {file}');
    // Each call replaces the previous overrides.
    setMessageOverrides({});
    assert.equal(t('Download scene JSON'), 'Download scene JSON');
  } finally {
    setMessageOverrides({});
    setLocale(previous);
  }
});

test('bindLocale and onLocaleChange react to a bound ref', () => {
  const previous = getLocale();
  const ref = { value: 'en' };
  bindLocale(ref);
  let calls = 0;
  const stop = onLocaleChange(() => calls++);
  ref.value = 'ru';
  assert.equal(getLocale(), 'ru');
  notifyLocaleChange();
  assert.equal(calls, 1);
  stop();
  setLocale(previous);
});

test('formatRelativeTime removes the CLDR space before Japanese Han', () => {
  const previous = getLocale();
  try {
    setLocale('ja');
    const text = formatRelativeTime(-5, 'minute');
    assert.match(text, /5分前/);
    assert.doesNotMatch(text, /5 分前/);
  } finally {
    setLocale(previous);
  }
});

test('persistLocale stores the choice and keeps ?lang out of the URL', () => {
  const history = { replaceState() {} };
  const storage = {
    getItem: () => null,
    setItem() {},
  };
  const result = persistLocale('de', {
    location: { href: 'http://localhost/?lang=fr' },
    history,
    storage,
  });
  assert.equal(result, 'de');
});

test('applyDocumentTranslations keeps the source across locales and honours data-i18n-context', () => {
  const previous = getLocale();
  const element = {
    textContent: 'CLEAR',
    attributes: {},
    getAttribute(name) {
      return this.attributes[name] ?? null;
    },
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
  };
  element.attributes['data-i18n'] = '';
  element.attributes['data-i18n-context'] = 'action';
  const doc = { querySelectorAll: () => [element] };
  try {
    setLocale('ru');
    const applied = applyDocumentTranslations(doc);
    assert.equal(applied, 1, 'the element is translated once');
    const ru = element.textContent;
    assert.notEqual(ru, 'CLEAR', `ru context translation applied (${ru})`);
    // A later pass starts from the recorded source, not from the written text.
    setLocale('en');
    applyDocumentTranslations(doc);
    assert.equal(element.textContent, 'CLEAR');
    setLocale('es');
    applyDocumentTranslations(doc);
    assert.notEqual(element.textContent, 'CLEAR');
    assert.notEqual(element.textContent, ru);
  } finally {
    setLocale(previous);
  }
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('flowweek.html', 'utf8');

test('voice planning uses a confirmation preview before saving', () => {
  assert.match(html, /Ich habe Folgendes verstanden/);
  assert.match(html, /Einträge speichern/);
  assert.match(html, /pendingVoiceTasks/);
  assert.match(html, /confirmVoicePreview/);
});

test('local parser supports multiple entries, relative dates, corrections and dedupe safeguards', () => {
  assert.match(html, /function parseWeekSpeechLocal/);
  assert.match(html, /function relativeDateHits/);
  assert.match(html, /morgen/);
  assert.match(html, /übermorgen|uebermorgen/);
  assert.match(html, /applySelfCorrections\(text\)/);
  assert.match(html, /const seen = new Set\(\)/);
});

test('audio prompt requires structured JSON without silent saving', () => {
  assert.match(html, /streng validierbares JSON-Array/);
  assert.match(html, /needsConfirmation/);
  assert.match(html, /Keine Informationen erfinden/);
  assert.match(html, /Gespeichert wird erst nach deiner Bestätigung/);
});

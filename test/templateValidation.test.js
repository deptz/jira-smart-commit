const test = require('node:test');
const assert = require('node:assert/strict');
const { extractPlaceholders, validateTemplatePlaceholders } = require('../out/orchestrator/templateValidation');

test('extractPlaceholders returns unique placeholders', () => {
  const placeholders = extractPlaceholders('A {{FOO}} B {{BAR}} C {{FOO}}');
  assert.deepEqual(placeholders.sort(), ['BAR', 'FOO']);
});

test('validateTemplatePlaceholders finds unknown placeholders', () => {
  const result = validateTemplatePlaceholders('Hello {{KNOWN}} {{UNKNOWN}}', ['KNOWN']);
  assert.deepEqual(result.unknownPlaceholders, ['UNKNOWN']);
});

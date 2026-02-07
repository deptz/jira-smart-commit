const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { renderPromptTemplate } = require('../out/orchestrator/promptRenderer');

function readGolden(name) {
  return fs.readFileSync(path.join(__dirname, 'golden', name), 'utf8');
}

test('golden: firstPrompt.task', () => {
  const template = 'You are helpful.\nINPUT:\n{{DESCRIPTION}}\n';
  const out = renderPromptTemplate(template, { DESCRIPTION: 'Task body' });
  assert.equal(out, readGolden('firstPrompt.task.expected.txt'));
});

test('golden: firstPrompt.bug', () => {
  const template = 'Bug mode\nINPUT:\n{{DESCRIPTION}}\n';
  const out = renderPromptTemplate(template, { DESCRIPTION: 'Bug body' });
  assert.equal(out, readGolden('firstPrompt.bug.expected.txt'));
});

test('golden: security.review', () => {
  const template = 'SEC\n{{RECENT_COMMITS_DIFF}}\n{{STAGED_CHANGES_DIFF}}\n{{FRAMEWORK_CONTEXT}}\n';
  const out = renderPromptTemplate(template, {
    RECENT_COMMITS_DIFF: 'A',
    STAGED_CHANGES_DIFF: 'B',
    FRAMEWORK_CONTEXT: 'C',
  });
  assert.equal(out, readGolden('security.review.expected.txt'));
});

test('golden: testCoverage.enforce', () => {
  const template = 'No placeholders here\n';
  const out = renderPromptTemplate(template, {});
  assert.equal(out, readGolden('testCoverage.enforce.expected.txt'));
});

test('golden: pr.description', () => {
  const template = 'PR\n{{CONTEXT}}\n';
  const out = renderPromptTemplate(template, { CONTEXT: 'Context body' });
  assert.equal(out, readGolden('pr.description.expected.txt'));
});

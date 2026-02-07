const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  TEMP_PR_DESCRIPTION_FILE_NAME,
  buildTempPRDescriptionTemplate,
  deleteTempPRDescriptionFile,
  readTempPRDescriptionFile,
  writeTempPRDescriptionFile,
} = require('../out/pr/tempPRFile');

function mkrepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'jsc-temp-pr-'));
}

test('writes temp PR file and reads back content', () => {
  const cwd = mkrepo();
  const content = '# PR\n\nBody';
  const result = writeTempPRDescriptionFile(cwd, content);
  assert.equal(path.basename(result.path), TEMP_PR_DESCRIPTION_FILE_NAME);
  assert.equal(result.overwritten, false);

  const read = readTempPRDescriptionFile(cwd);
  assert.equal(read.body, content);
});

test('readTempPRDescriptionFile fails when placeholder remains', () => {
  const cwd = mkrepo();
  const content = buildTempPRDescriptionTemplate({ sourceBranch: 'feature/ABC-123-test', jiraKey: 'ABC-123' });
  writeTempPRDescriptionFile(cwd, content);

  assert.throws(() => readTempPRDescriptionFile(cwd), /placeholder content/);
});

test('deleteTempPRDescriptionFile removes file', () => {
  const cwd = mkrepo();
  writeTempPRDescriptionFile(cwd, '# Final PR body');
  deleteTempPRDescriptionFile(cwd);
  assert.equal(fs.existsSync(path.join(cwd, TEMP_PR_DESCRIPTION_FILE_NAME)), false);
});

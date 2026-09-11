const test = require('node:test');
const assert = require('node:assert/strict');

const { generateStudentId, normalizeStudentPayload, validateStudentPayload } = require('../src/studentService');

test('generateStudentId produces a unique EduPass ID with year and sequence', () => {
  assert.equal(generateStudentId(2026, 124), 'EP-2026-000125');
  assert.equal(generateStudentId(2026, 0), 'EP-2026-000001');
});

test('normalizeStudentPayload trims names and defaults status', () => {
  const result = normalizeStudentPayload({
    firstName: '  John  ',
    middleName: '  A. ',
    lastName: ' Doe ',
    gender: 'male',
    status: '  active ',
    academicYear: ' 2026 ',
  });

  assert.equal(result.firstName, 'John');
  assert.equal(result.middleName, 'A.');
  assert.equal(result.lastName, 'Doe');
  assert.equal(result.status, 'active');
  assert.equal(result.academicYear, '2026');
});

test('validateStudentPayload rejects incomplete student records', () => {
  assert.throws(() => validateStudentPayload({ firstName: '', lastName: 'Doe' }), /first name/i);
  assert.throws(() => validateStudentPayload({ firstName: 'John', lastName: 'Doe' }), /class/i);
});

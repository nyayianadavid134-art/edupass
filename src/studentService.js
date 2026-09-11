const ALLOWED_STATUSES = ['active', 'inactive', 'transferred', 'graduated', 'suspended', 'archived'];

function generateStudentId(year, sequenceNumber) {
  const safeYear = Number(year) || new Date().getFullYear();
  const safeSequence = Number(sequenceNumber) || 0;
  const nextSequence = Math.max(1, safeSequence + 1);
  return `EP-${safeYear}-${String(nextSequence).padStart(6, '0')}`;
}

function generateAdmissionNumber(year, sequenceNumber) {
  const safeYear = Number(year) || new Date().getFullYear();
  const safeSequence = Number(sequenceNumber) || 0;
  const nextSequence = Math.max(1, safeSequence + 1);
  return `ADM-${safeYear}-${String(nextSequence).padStart(3, '0')}`;
}

function normalizeStudentPayload(payload = {}) {
  const normalized = { ...payload };
  normalized.firstName = String(normalized.firstName || '').trim();
  normalized.middleName = String(normalized.middleName || '').trim();
  normalized.lastName = String(normalized.lastName || '').trim();
  normalized.gender = String(normalized.gender || '').trim().toLowerCase();
  normalized.status = String(normalized.status || 'active').trim().toLowerCase();
  normalized.academicYear = String(normalized.academicYear || new Date().getFullYear()).trim();
  normalized.nationality = String(normalized.nationality || '').trim();
  normalized.classId = normalized.classId || normalized.class_id || '';
  normalized.parentFullName = String(normalized.parentFullName || '').trim();
  normalized.parentRelationship = String(normalized.parentRelationship || 'Guardian').trim();
  normalized.parentPhone = String(normalized.parentPhone || '').trim();
  normalized.parentEmail = String(normalized.parentEmail || '').trim();
  return normalized;
}

function validateStudentPayload(payload) {
  const normalized = normalizeStudentPayload(payload);
  if (!normalized.firstName) throw new Error('Student first name is required.');
  if (!normalized.lastName) throw new Error('Student last name is required.');
  if (!normalized.classId) throw new Error('A valid class is required for student enrollment.');
  if (normalized.gender && !['male', 'female', 'other', 'prefer-not-to-say'].includes(normalized.gender)) {
    throw new Error('Provide a valid gender value.');
  }
  if (normalized.status && !ALLOWED_STATUSES.includes(normalized.status)) {
    throw new Error('Choose a valid student status.');
  }
  return normalized;
}

module.exports = {
  ALLOWED_STATUSES,
  generateStudentId,
  generateAdmissionNumber,
  normalizeStudentPayload,
  validateStudentPayload,
};

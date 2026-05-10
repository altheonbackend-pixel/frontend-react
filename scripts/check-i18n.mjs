import fs from 'node:fs';

const en = JSON.parse(fs.readFileSync('public/locales/en/translation.json', 'utf8'));
const fr = JSON.parse(fs.readFileSync('public/locales/fr/translation.json', 'utf8'));

const enKeys = Object.keys(en).sort();
const frKeys = Object.keys(fr).sort();
const missingInFr = enKeys.filter(key => !(key in fr));
const extraInFr = frKeys.filter(key => !(key in en));
const identicalPortalValues = enKeys.filter(
  key => key.startsWith('patient_portal.') && en[key] === fr[key],
);

if (missingInFr.length || extraInFr.length) {
  console.error('i18n key parity failed.');
  if (missingInFr.length) console.error('Missing in fr:', missingInFr.join(', '));
  if (extraInFr.length) console.error('Extra in fr:', extraInFr.join(', '));
  process.exit(1);
}

const allowedIdenticalPortalValues = new Set([
  'patient_portal.common.patient',
  'patient_portal.dashboard.condition_count_one',
  'patient_portal.dashboard.condition_count_other',
  'patient_portal.visits.documents',
  'patient_portal.labs.document',
  'patient_portal.conditions.card_title',
  'patient_portal.allergies.card_title',
  'patient_portal.severity.severe',
  'patient_portal.notifications.title',
  'patient_portal.timezones.africa_lagos',
  'patient_portal.timezones.asia_dhaka',
  'patient_portal.timezones.asia_karachi',
]);

const unexpectedIdentical = identicalPortalValues.filter(
  key => !allowedIdenticalPortalValues.has(key),
);

if (unexpectedIdentical.length) {
  console.error('Unexpected patient portal French values still match English:');
  console.error(unexpectedIdentical.join('\\n'));
  process.exit(1);
}

console.log(`i18n check passed (${enKeys.length} keys, en/fr parity OK).`);

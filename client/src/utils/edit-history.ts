import type { EditHistoryChange } from '@shared/api.interface';

export const EDIT_FIELD_LABELS: Record<string, string> = {
  changeType: 'Change Type',
  logFrom: 'Log-From',
  logTo: 'Log-To',
  effectiveDate: 'Effective Date',
  remark: 'Remark',
};

export function formatEditChange(change: EditHistoryChange): string {
  const label: string = EDIT_FIELD_LABELS[change.field] || change.field;
  const from: string = (change.from ?? '').trim();
  const to: string = (change.to ?? '').trim();

  if (from === '' && to !== '') {
    return `Added "${label}": ${to}`;
  }
  if (from !== '' && to === '') {
    return `Cleared "${label}" (was: ${from})`;
  }
  return `Changed "${label}" from "${from}" to "${to}"`;
}

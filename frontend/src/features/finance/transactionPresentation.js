export const TRANSACTION_TYPES = ['expense', 'revenue', 'commission', 'adjustment'];
export const TRANSACTION_STATUSES = ['pending', 'completed', 'cancelled'];
export const REFERENCE_KINDS = ['service', 'task', 'order', 'project'];
export const validReference = (value) => /^[1-9][0-9]*$/.test(String(value)) && Number.isSafeInteger(Number(value));

export function transactionProofHref(raw) {
  let proof = raw;
  if (typeof proof === 'string') {
    try { proof = JSON.parse(proof); } catch { proof = { url: proof }; }
  }
  const nested = proof?.file;
  const path = proof?.url || proof?.path || proof?.filePath || proof?.file_url || proof?.location || proof?.secure_url || (typeof nested === 'string' ? nested : nested?.url || nested?.path || nested?.filePath);
  if (typeof path !== 'string' || !path.trim() || (/^[a-z][a-z0-9+.-]*:/i.test(path) && !/^https?:\/\//i.test(path)) || /^\/{2}|[\\\r\n]/.test(path)) return '';
  if (/^https?:\/\//i.test(path)) return path;
  const base = window.__TERANGA_FILE_BASE_URL || window.__TERANGA_API_BASE_URL?.replace(/\/api\/?$/, '') || process.env.REACT_APP_FILE_BASE_URL || '';
  return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

export function casePath(kind, id) {
  return kind === 'task' ? `/tasks/${id}` : `/${kind}s/${id}`;
}

export function statementCSV(rows) {
  const cell = (value) => {
    const safe = typeof value === 'string' && /^[=+@\-\t\r]/.test(value) ? `'${value}` : String(value ?? '');
    return `"${safe.replace(/"/g, '""')}"`;
  };
  return '\uFEFF' + [['id','type','status','amount','currency','paymentMethod','description','serviceId','taskId','orderId','projectId','createdAt'], ...rows.map((row) => [row.id,row.type,row.status,Number(row.amount),row.currency,row.paymentMethod,row.description,row.serviceId,row.taskId,row.orderId,row.projectId,row.createdAt])].map((row) => row.map(cell).join(';')).join('\r\n');
}

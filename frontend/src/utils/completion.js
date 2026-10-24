export function needsCompletionReport(completion) {
  if (!completion?.required) return false;
  const kinds = new Set((completion.report?.attachments || []).map((file) => file.kind));
  return !completion.report?.summary?.trim() ||
    (completion.requiredEvidenceTypes || []).some((kind) => !kinds.has(kind));
}

export function focusCompletionReport() {
  const panel = document.getElementById('completion-report');
  panel?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  (panel?.querySelector('textarea') || panel)?.focus({ preventScroll: true });
}

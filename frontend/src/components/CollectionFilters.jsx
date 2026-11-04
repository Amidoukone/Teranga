import { Search } from 'lucide-react';

// One compact, labelled toolbar for personal requests, interventions and work queues.
export default function CollectionFilters({ id, searchLabel, query, onQueryChange, onSubmit, kind, onKindChange, kindLabel, options, findLabel, placeholder, hint, maxLength = 200, disabled = false }) {
  return <form onSubmit={event => { event.preventDefault(); if (!disabled) onSubmit(); }} className="role-list-filters grid grid-cols-[minmax(0,1fr)_7.5rem] items-end gap-2 sm:gap-3">
    <div className="min-w-0">
      <label htmlFor={`${id}-search`} className="sr-only sm:not-sr-only">{searchLabel}</label>
      <div className="flex gap-1.5"><input id={`${id}-search`} aria-describedby={hint ? `${id}-hint` : undefined} placeholder={placeholder} value={query} maxLength={maxLength} disabled={disabled} onChange={event => onQueryChange(event.target.value)} className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-surface-card px-3 text-sm" />
        <button type="submit" aria-label={findLabel} title={findLabel} disabled={disabled} className="btn-secondary inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl px-2.5"><Search size={18} aria-hidden="true" /><span className="sr-only lg:not-sr-only lg:ml-2 lg:text-sm">{findLabel}</span></button>
      </div>
      {hint && <p id={`${id}-hint`} className="sr-only">{hint}</p>}
    </div>
    <div><label htmlFor={`${id}-kind`} className="sr-only sm:not-sr-only">{kindLabel}</label><select id={`${id}-kind`} value={kind} disabled={disabled} onChange={event => onKindChange(event.target.value)} className="min-h-11 w-full rounded-xl border border-border bg-surface-card px-2 text-sm sm:px-3">{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
  </form>;
}

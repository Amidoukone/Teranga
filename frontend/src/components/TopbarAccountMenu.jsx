import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { ChevronDown, LifeBuoy, Lock, LogOut, Settings, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './LanguageSwitcher';

export default function TopbarAccountMenu({ user, display, initial, roleLabel, open, onToggle, onClose, onLogout, panelRef, warmup }) {
  const { t } = useTranslation();
  const [showLegal, setShowLegal] = useState(false);
  return <div className="relative shrink-0">
    <button type="button" onClick={onToggle} aria-label={t('nav.userMenu')} title={t('nav.userMenu')} aria-expanded={open} aria-controls="user-menu" aria-haspopup="dialog"
      className={`relative z-50 inline-flex min-h-11 items-center gap-1 rounded-xl px-1.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${open ? 'bg-primary/10' : 'hover:bg-surface-main'}`}>
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary" aria-hidden="true">{initial}</span>
      <ChevronDown size={14} aria-hidden="true" className={`hidden text-text-muted transition-transform sm:block ${open ? 'rotate-180' : ''}`} />
    </button>
    <AnimatePresence>{open && <>
      <div className="fixed inset-0 z-40 bg-black/10" onClick={onClose} aria-hidden="true" />
      <motion.div ref={panelRef} id="user-menu" role="dialog" aria-modal="true" aria-label={t('nav.userMenu')}
        initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.12 }}
        className="fixed inset-x-3 top-[4.5rem] z-50 max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-2xl border border-border bg-surface-card p-2 shadow-xl md:absolute md:inset-x-auto md:right-0 md:top-full md:mt-3 md:w-80">
        <div className="flex items-start gap-2 border-b border-border px-3 py-3">
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-text-primary">{display}</p>
          <p className="mt-0.5 text-xs text-text-secondary">{roleLabel}</p>
          {(user.email || user.phone) && <p className="mt-1 truncate text-xs text-text-muted">{user.email || user.phone}</p>}</div>
          <button type="button" onClick={onClose} aria-label={t('nav.closeMenu')} className="-mr-2 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-text-muted hover:bg-surface-main"><X size={18} aria-hidden="true" /></button>
        </div>
        <nav role="menu" aria-label={t('nav.sections.account')} className="py-1">
          {[['/settings', 'nav.settings', Settings], ['/account/security', 'nav.security', Lock], ['/help-support', 'nav.helpSupport', LifeBuoy]].map(([to, label, Icon]) =>
            <Link key={to} to={to} {...warmup(to, { onClick: onClose })} role="menuitem" className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm text-text-primary transition-colors hover:bg-surface-main">
              <Icon size={17} className="text-text-muted" aria-hidden="true" />{t(label)}
            </Link>)}
        </nav>
        <div className="border-t border-border px-3 py-3"><LanguageSwitcher className="w-full" /></div>
        <div className="border-t border-border px-3 text-sm">
          <button type="button" aria-expanded={showLegal} aria-controls="topbar-legal" onClick={() => setShowLegal(value => !value)} className="flex min-h-11 w-full items-center justify-between gap-2 text-left text-xs text-text-secondary">{t('topBar.legal')}<ChevronDown size={14} aria-hidden="true" className={showLegal ? 'rotate-180' : ''} /></button>
          {showLegal && <div id="topbar-legal" className="flex flex-wrap gap-x-4 gap-y-1 pb-2 text-xs text-text-secondary">
            {[['/privacy', 'nav.privacy'], ['/terms', 'nav.terms'], ['/legal', 'nav.legal']].map(([to, label]) => <Link key={to} to={to} onClick={onClose} className="inline-flex min-h-9 items-center underline">{t(label)}</Link>)}
          </div>}
        </div>
        <nav role="menu" aria-label={t('nav.sections.session')} className="border-t border-border pt-1">
          <button type="button" onClick={onLogout} role="menuitem" className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm text-red-700 transition-colors hover:bg-red-500/10 dark:text-red-300">
            <LogOut size={17} aria-hidden="true" />{t('nav.logout')}
          </button>
        </nav>
      </motion.div>
    </>}</AnimatePresence>
  </div>;
}

import { useEffect, useRef } from 'react';
import { CloseIcon } from './Icons.jsx';

/** Bottom sheet that opens inside the phone frame. */
export default function Sheet({ open, title, eyebrow, onClose, dismissable = true, children, footer }) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    panelRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape' && dismissable) onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, dismissable, onClose]);

  if (!open) return null;
  return (
    <div className="sheet-layer" role="presentation">
      <div className="sheet-backdrop" onClick={dismissable ? onClose : undefined} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={panelRef}>
        <div className="sheet-grabber" />
        <div className="sheet-head">
          <div>
            {eyebrow && <div className="eyebrow">{eyebrow}</div>}
            <h2 className="sheet-title">{title}</h2>
          </div>
          {dismissable && (
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          )}
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-footer">{footer}</div>}
      </div>
    </div>
  );
}

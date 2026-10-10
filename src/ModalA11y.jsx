import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const ROOT_ID = 'modal-root';

function ensureRoot() {
  if (document.body.querySelector(`#${ROOT_ID}`)) return document.body.querySelector(`#${ROOT_ID}`);
  const el = document.createElement('div');
  el.id = ROOT_ID;
  el.className = 'modal-root';
  document.body.appendChild(el);
  return el;
}

function releaseRootIfEmpty() {
  const el = document.body.querySelector(`#${ROOT_ID}`);
  if (el && !el.hasChildNodes()) el.remove();
}

export default function ModalBackdrop({ onClose, children }) {
  const dialog = useRef(null);
  const trigger = useRef(null);
  const stackRef = useRef(0);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const root = ensureRoot();
    stackRef.current += 1;
    const depth = stackRef.current;

    const previous = document.activeElement;
    if (previous?.focus) trigger.current = previous;

    const handleKey = (event) => {
      if (event.key === 'Escape') onCloseRef.current();
    };

    const handleFocusIn = (event) => {
      const dialogNode = root.querySelector('[role="dialog"]');
      if (!dialogNode) return;
      const all = Array.from(
        dialogNode.querySelectorAll(
          'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (!all.length) return;
      const first = all[0];
      const last = all[all.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const releaseScroll = () => {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    };

    if (depth === 1) {
      const scrollbarWidth = document.body.offsetWidth - document.documentElement.clientWidth;
      document.body.style.paddingRight = `${scrollbarWidth}px`;
      document.body.style.overflow = 'hidden';
    }

    document.addEventListener('keydown', handleKey, true);
    document.addEventListener('focusin', handleFocusIn, true);

    return () => {
      document.removeEventListener('keydown', handleKey, true);
      document.removeEventListener('focusin', handleFocusIn, true);
      if (depth === 1) releaseScroll();
      stackRef.current -= 1;
      if (trigger.current?.focus) {
        try { trigger.current.focus(); } catch {}
      }
      trigger.current = null;
      releaseRootIfEmpty();
    };
  }, []);

  useEffect(() => {
    const root = ensureRoot();
    const node = root.querySelector('[role="dialog"]');
    if (node) {
      dialog.current = node;
      if (document.activeElement !== node) {
        try { node.focus(); } catch {}
      }
    }
  }, []);

  if (!ensureRoot()) return null;

  return createPortal(
    <div
      className="modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    ensureRoot(),
  );
}

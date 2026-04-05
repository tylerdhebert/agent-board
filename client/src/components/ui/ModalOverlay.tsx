/**
 * ModalOverlay
 *
 * Provides the common full-screen dimmed backdrop + centred content container
 * used by every modal in the app.  Clicking the backdrop calls onClose.
 * The inner container renders children and stops click propagation.
 *
 * Props:
 *   - onClose: called when the backdrop is clicked
 *   - zIndex: defaults to "z-50"; pass "z-[60]" etc. for stacked modals
 *   - maxWidth: defaults to "max-w-2xl"
 *   - children: the modal content
 *   - className: additional classes applied to the inner container
 */

interface ModalOverlayProps {
  onClose: () => void;
  zIndex?: string;
  children: React.ReactNode;
  /** Extra classes on the inner white/dark container (e.g. sizing) */
  className?: string;
}

export function ModalOverlay({
  onClose,
  zIndex = "z-50",
  children,
  className = "",
}: ModalOverlayProps) {
  return (
    <div
      className={`fixed inset-0 ${zIndex} flex items-center justify-center bg-black/45 backdrop-blur-xl`}
      onClick={onClose}
    >
      <div
        className={`modal-shell relative w-full mx-4 ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

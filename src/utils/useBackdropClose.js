import { useRef } from 'react';

/**
 * Custom hook to safely handle closing a modal when clicking outside (on the backdrop).
 * Prevents accidental closing if the user started mousedown/drag inside the modal
 * (e.g. text selection, dragging, or right-clicking) and released mouseup outside.
 *
 * @param {Function} onClose - Callback invoked when the user cleanly clicks the backdrop.
 * @returns {{ onMouseDown: Function, onClick: Function }} Props to spread onto the backdrop element.
 */
export function useBackdropClose(onClose) {
  const isMouseDownOnBackdrop = useRef(false);

  const onMouseDown = (e) => {
    // Only accept left mouse button (e.button === 0) directly on the backdrop container
    isMouseDownOnBackdrop.current = (e.target === e.currentTarget && e.button === 0);
  };

  const onClick = (e) => {
    // Only close if BOTH mousedown and click originated directly on the backdrop
    if (e.target === e.currentTarget && isMouseDownOnBackdrop.current) {
      if (typeof onClose === 'function') {
        onClose();
      }
    }
    isMouseDownOnBackdrop.current = false;
  };

  return { onMouseDown, onClick };
}

/**
 * Factory hook for components that manage multiple modals with different close handlers.
 *
 * @returns {Function} Function taking an `onClose` callback and returning `{ onMouseDown, onClick }` props.
 */
export function useBackdropPropsFactory() {
  const backdropTargetRef = useRef(null);

  return (onClose) => ({
    onMouseDown: (e) => {
      backdropTargetRef.current = (e.target === e.currentTarget && e.button === 0) ? e.currentTarget : null;
    },
    onClick: (e) => {
      if (e.target === e.currentTarget && backdropTargetRef.current === e.currentTarget) {
        if (typeof onClose === 'function') {
          onClose();
        }
      }
      backdropTargetRef.current = null;
    }
  });
}

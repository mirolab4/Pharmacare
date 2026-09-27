import { useEffect, useRef } from 'react';

interface UseHardwareBarcodeScannerOptions {
  onScan: (barcode: string) => void;
  enabled?: boolean;
}

/**
 * Hook to capture physical barcode scanner input (USB / Bluetooth / Keyboard Wedge)
 * Physical barcode scanners emulate rapid keystrokes (< 50ms) followed by an 'Enter' key.
 */
export function useHardwareBarcodeScanner({ onScan, enabled = true }: UseHardwareBarcodeScannerOptions) {
  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is holding Ctrl, Alt, or Meta keys
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const now = Date.now();
      const timeDiff = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // Physical scanners finish with 'Enter'
      if (e.key === 'Enter') {
        const potentialBarcode = bufferRef.current.trim();
        // A valid barcode is usually 3+ characters (EAN-13, EAN-8, UPC, Code 128, etc.)
        if (potentialBarcode.length >= 3) {
          // Check if target is a normal input field where user might just be submitting
          const active = document.activeElement;
          const isStandardInput = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');
          
          // Clear buffer
          bufferRef.current = '';

          // Fire the global event
          window.dispatchEvent(
            new CustomEvent('pharmacy:barcode-scanned', {
              detail: { barcode: potentialBarcode },
            })
          );

          onScan(potentialBarcode);

          // If not in a standard form submission, prevent Enter default
          if (!isStandardInput) {
            e.preventDefault();
          }
        }
        bufferRef.current = '';
        return;
      }

      // If time between keystrokes is more than 90ms, it's likely human typing, so reset buffer
      if (timeDiff > 90 && bufferRef.current.length > 0) {
        bufferRef.current = '';
      }

      // Accumulate printable characters
      if (e.key.length === 1) {
        bufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [onScan, enabled]);
}

/**
 * useIsMobile — Detects if the user is on a mobile/tablet device.
 * Returns true for phones and tablets (touch-first devices) where
 * inline PDF iframes are not supported by the browser.
 */
export function useIsMobile() {
    // Use navigator.userAgent as a lightweight check (no ResizeObserver overhead).
    // Also check maxTouchPoints for tablet/iPad detection.
    if (typeof navigator === 'undefined') return false;
    return /Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(navigator.userAgent)
        || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.userAgent)); // iPadOS
}

/* Bug 5: simulate a slow "third-party" — blocks main thread for 2.5s after page load */
window.addEventListener("load", () => {
  const start = Date.now();
  // Block the main thread synchronously for 2.5s
  while (Date.now() - start < 2500) {
    /* spin */
  }
});

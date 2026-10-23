/* Shared, versioned handshake. No user data is transmitted. Content readiness is
   explicitly signalled by each demo, independently of the iframe load event. */
(() => {
  let ready = false;
  let started = false;
  let request = null;
  const reply = () => {
    if (ready && request) window.parent.postMessage({type:'portfolio:ready', version:1, id:request.id}, request.origin);
  };
  window.addEventListener('message', (event) => {
    const data = event.data;
    if (event.source !== window.parent || !/^https?:\/\//.test(event.origin) ||
        data?.type !== 'portfolio:init' || data.version !== 1 || typeof data.id !== 'string' || data.id.length > 120) return;
    request = {id:data.id,origin:event.origin};
    reply();
  });
  window.parent.postMessage({type:'portfolio:hello',version:1}, '*');
  document.addEventListener('portfolio:content-ready', () => {
    if (started) return;
    started = true;
    Promise.resolve(document.fonts?.ready).then(() => requestAnimationFrame(() => requestAnimationFrame(() => {
      ready = true;
      document.documentElement.dataset.portfolioReady = 'true';
      performance.mark('portfolio:ready');
      reply();
    })));
  });
})();

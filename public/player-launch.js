// Creatix Player launcher (custom protocol + fallback download)
(function () {
  const DEFAULT_DOWNLOAD = '/downloads/CreatixPlayerSetup.exe';
  const DEFAULT_PROTOCOL = 'creatix://play';
  const FALLBACK_DELAY_MS = 1600;

  function getDownloadUrl() {
    if (window.CREATIX_PLAYER_DOWNLOAD) return window.CREATIX_PLAYER_DOWNLOAD;
    const body = document.body;
    if (body && body.dataset && body.dataset.playerDownload) return body.dataset.playerDownload;
    return DEFAULT_DOWNLOAD;
  }

  function buildProtocolUrl(opts) {
    const params = new URLSearchParams();
    if (opts.gameId) params.set('game', String(opts.gameId));
    if (opts.title) params.set('title', String(opts.title));
    if (opts.url) params.set('url', String(opts.url));
    if (opts.session) params.set('session', String(opts.session));
    return `${DEFAULT_PROTOCOL}?${params.toString()}`;
  }

  function ensureModal() {
    let modal = document.getElementById('creatix-player-modal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'creatix-player-modal';
    modal.style.cssText = [
      'position: fixed',
      'inset: 0',
      'background: rgba(0,0,0,0.5)',
      'display: none',
      'align-items: center',
      'justify-content: center',
      'z-index: 9999'
    ].join(';');

    modal.innerHTML = `
      <div style="background:#111;color:#fff;padding:22px 24px;border-radius:12px;max-width:420px;width:90%;border:1px solid rgba(255,255,255,0.15)">
        <h3 style="margin:0 0 8px 0">Creatix Player requis</h3>
        <p style="margin:0 0 14px 0;opacity:0.85">Le Player n'est pas installé ou n'a pas répondu. Installe-le pour rejoindre le jeu.</p>
        <div style="display:flex;gap:10px;justify-content:flex-end">
          <button id="creatix-player-cancel" style="background:#333;color:#fff;border:none;border-radius:8px;padding:8px 12px;cursor:pointer">Annuler</button>
          <a id="creatix-player-download" href="#" style="background:#00c26e;color:#fff;text-decoration:none;border-radius:8px;padding:8px 12px;font-weight:600">Télécharger</a>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    const cancel = modal.querySelector('#creatix-player-cancel');
    cancel.addEventListener('click', () => (modal.style.display = 'none'));
    return modal;
  }

  function showDownloadModal() {
    const modal = ensureModal();
    const link = modal.querySelector('#creatix-player-download');
    link.href = getDownloadUrl();
    modal.style.display = 'flex';
  }

  function attemptOpen(protocolUrl) {
    let didHide = false;
    const onVisibility = () => {
      if (document.hidden) didHide = true;
    };
    document.addEventListener('visibilitychange', onVisibility, { once: true });

    // Use a hidden iframe to trigger the protocol handler without leaving the page.
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = protocolUrl;
    document.body.appendChild(iframe);

    setTimeout(() => {
      document.removeEventListener('visibilitychange', onVisibility);
      iframe.remove();
      if (!didHide) showDownloadModal();
    }, FALLBACK_DELAY_MS);
  }

  window.launchCreatixPlayer = function (opts) {
    const currentUrl = window.location.href;
    const protocolUrl = buildProtocolUrl({
      gameId: opts.gameId,
      title: opts.title,
      url: opts.url || currentUrl,
      session: opts.session
    });
    attemptOpen(protocolUrl);
  };
})();

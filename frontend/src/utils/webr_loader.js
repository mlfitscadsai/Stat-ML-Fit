var webr = null;

async function initLocalWebR() {
  const baseUrl = new URL('/webr/dist/', window.location.href).href;
  const swUrl = new URL('/webr/', window.location.href).href;
  const { WebR } = await import(new URL('webr.mjs', baseUrl).href);
  const instance = new WebR({
    baseUrl,
    serviceWorkerUrl: swUrl,
    interactive: false,
  });
  await instance.init();
  return instance;
}

async function initCdnWebR() {
  const { WebR } = await import('https://webr.r-wasm.org/v0.4.3/webr.mjs');
  const instance = new WebR({ interactive: false });
  await instance.init();
  return instance;
}

export const loadWebR = async () => {
  if (!webr) {
    try {
      webr = await initLocalWebR();
    } catch (localErr) {
      console.warn('Local WebR failed, trying CDN fallback:', localErr);
      webr = await initCdnWebR();
    }
  }
  return webr;
};

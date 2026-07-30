const BANNER_ID = "courtlab-pwa-banner";

function showBanner(message: string, action?: { label: string; run: () => void }) {
  document.getElementById(BANNER_ID)?.remove();

  const banner = document.createElement("aside");
  banner.id = BANNER_ID;
  banner.setAttribute("role", "status");
  Object.assign(banner.style, {
    position: "fixed",
    zIndex: "10000",
    right: "16px",
    bottom: "16px",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    maxWidth: "min(420px, calc(100vw - 32px))",
    padding: "12px 14px",
    border: "1px solid rgba(255,255,255,.18)",
    borderRadius: "14px",
    color: "#f7fbf8",
    background: "#18221d",
    boxShadow: "0 12px 36px rgba(0,0,0,.35)",
    font: "600 14px/1.35 system-ui, sans-serif",
  });

  const text = document.createElement("span");
  text.textContent = message;
  banner.append(text);

  if (action) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = action.label;
    Object.assign(button.style, {
      padding: "8px 11px",
      border: "0",
      borderRadius: "9px",
      color: "#102019",
      background: "#7ee2a8",
      font: "700 13px system-ui, sans-serif",
      cursor: "pointer",
      whiteSpace: "nowrap",
    });
    button.addEventListener("click", action.run);
    banner.append(button);
  }

  document.body.append(banner);
  return banner;
}

function announceConnection() {
  if (!navigator.onLine) {
    showBanner("Sei offline: CourtLab continua a funzionare su questo dispositivo.");
    return;
  }

  const banner = document.getElementById(BANNER_ID);
  if (banner?.textContent?.startsWith("Sei offline")) {
    banner.remove();
  }
}

window.addEventListener("offline", announceConnection);
window.addEventListener("online", announceConnection);
announceConnection();

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      let refreshing = false;
      let updateRequested = false;

      navigator.serviceWorker.addEventListener("controllerchange", () => {
        // The first install must never reload an active setup/game.
        if (!updateRequested || refreshing) return;
        refreshing = true;
        window.location.reload();
      });

      const offerUpdate = (worker: ServiceWorker) => {
        showBanner("È disponibile una nuova versione di CourtLab.", {
          label: "Aggiorna",
          run: () => {
            updateRequested = true;
            worker.postMessage({ type: "SKIP_WAITING" });
          },
        });
      };

      if (registration.waiting) offerUpdate(registration.waiting);

      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        worker?.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            offerUpdate(worker);
          }
        });
      });

      window.setInterval(() => registration.update(), 60 * 60 * 1000);
    } catch (error) {
      console.error("Registrazione offline non riuscita", error);
    }
  });
}

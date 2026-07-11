const SERVICE_WORKER_VERSION = "v2";

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || !import.meta.env.PROD) {
    return;
  }

  window.addEventListener("load", () => {
    void navigator.serviceWorker
      .register(`/sw.js?version=${SERVICE_WORKER_VERSION}`)
      .then((registration) => {
        void registration.update();

        registration.addEventListener("updatefound", () => {
          const installingWorker = registration.installing;

          if (!installingWorker) {
            return;
          }

          installingWorker.addEventListener("statechange", () => {
            if (
              installingWorker.state === "activated" &&
              navigator.serviceWorker.controller
            ) {
              window.location.reload();
            }
          });
        });
      });
  });
}

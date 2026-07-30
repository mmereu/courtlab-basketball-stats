# PWA e funzionamento offline

CourtLab viene distribuita come Progressive Web App installabile.

## Comportamento

- La build genera `pwa-assets.json` con tutti gli asset versionati presenti in `dist`.
- Al primo accesso online il service worker conserva shell, JavaScript, CSS, icone e pagine.
- Le navigazioni senza rete ricevono l'app già memorizzata; `offline.html` è il fallback di emergenza.
- Quando una nuova build è pronta, quella in uso resta attiva. Un banner propone **Aggiorna** e il reload avviene soltanto dopo la scelta dell'utente.
- Un banner segnala il passaggio offline. Il browser controlla una nuova versione ogni ora e a ogni nuova sessione.

## Installazione

Su Android/Chrome usare **Installa app** dal menu. Su iPad/iPhone usare **Condividi → Aggiungi alla schermata Home**. HTTPS è obbligatorio fuori da `localhost`.

## Limiti

Questa base rende offline l'interfaccia e gli asset. La persistenza delle partite e la successiva sincronizzazione cloud richiedono il livello dati IndexedDB/sync, separato dal service worker.

## Verifica manuale

1. Eseguire `npm run build` e `npm run preview`.
2. Aprire l'app una volta online.
3. In DevTools → Application verificare manifest, service worker attivo e cache `courtlab-*`.
4. Impostare Network → Offline e ricaricare.
5. Pubblicare una nuova build: la sessione aperta deve mostrare il pulsante **Aggiorna** senza ricaricarsi da sola.

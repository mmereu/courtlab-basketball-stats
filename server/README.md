# CourtLab Cloud API

Backend self-hosted minimale, senza dipendenze Python esterne. I dati completi del
workspace sono sincronizzati come snapshot JSON con versione ottimistica.

## Configurazione

Variabili obbligatorie:

```ini
COURTLAB_TOKEN_SECRET=generare-un-segreto-casuale-di-almeno-32-caratteri
```

Variabili opzionali:

```ini
COURTLAB_DATABASE=/var/lib/courtlab/courtlab.sqlite3
COURTLAB_BIND=127.0.0.1
COURTLAB_PORT=8092
COURTLAB_TOKEN_TTL=28800
COURTLAB_ALLOW_REGISTRATION=false
COURTLAB_ALLOWED_ORIGIN=https://basketcoach.duckdns.org
```

Generare il segreto direttamente sulla VPS, senza salvarlo nel repository:

```bash
python3 -c 'import secrets; print(secrets.token_urlsafe(48))'
```

Per creare il primo account impostare temporaneamente
`COURTLAB_ALLOW_REGISTRATION=true`, registrarsi e riportarlo a `false`.

## API

- `POST /api/register`: `email`, `password`, `workspaceName`
- `POST /api/login`: `email`, `password`
- `GET /api/me`: Bearer token
- `GET /api/snapshot`: Bearer token
- `PUT /api/snapshot`: Bearer token, `{ "version": 0, "data": {...} }`
- `GET /api/members`: elenco collaboratori, solo owner
- `POST /api/invitations`: crea invito monouso `coach`/`viewer`, solo owner
- `POST /api/invitations/accept`: crea un nuovo account usando l'invito
- `PATCH /api/members/{id}`: cambia ruolo, solo owner
- `DELETE /api/members/{id}`: rimuove collaboratore, solo owner
- `DELETE /api/account`: elimina account e dati personali
- `GET /api/health`

Una scrittura con versione superata restituisce HTTP `409 VERSION_CONFLICT`.
I ruoli sono `owner`, `coach` e `viewer`; il viewer non può scrivere. Gli inviti
scadono, sono utilizzabili una sola volta e nel database viene conservato soltanto
l'hash del token. Non è possibile rimuovere o retrocedere l'ultimo owner.

### Eliminazione account e privacy

`DELETE /api/account` elimina definitivamente l'utente. Se è l'unico membro del
workspace vengono eliminati anche workspace, snapshot e inviti tramite vincoli
SQLite. Se è l'ultimo owner ma sono presenti collaboratori, l'API risponde
`409 TRANSFER_REQUIRED`: prima occorre promuovere un collaboratore a owner oppure
rimuovere gli altri membri. Un token appartenente a un account eliminato non
supera più la verifica della membership.

## Test

```bash
cd server
python3 -m unittest -v
```

## systemd

Installare `app.py` in `/opt/courtlab/server/` e creare
`/etc/courtlab/api.env` leggibile solo da root (`chmod 600`).

```ini
[Unit]
Description=CourtLab Cloud API
After=network.target

[Service]
Type=simple
User=courtlab
Group=courtlab
WorkingDirectory=/opt/courtlab/server
EnvironmentFile=/etc/courtlab/api.env
ExecStart=/usr/bin/python3 /opt/courtlab/server/app.py
Restart=on-failure
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/courtlab

[Install]
WantedBy=multi-user.target
```

## Caddy

Affiancare l'API al sito esistente mantenendo SQLite non esposto:

```caddyfile
basketcoach.duckdns.org {
    handle /api/* {
        reverse_proxy 127.0.0.1:8092
    }
    handle {
        reverse_proxy 127.0.0.1:8091
    }
}
```

Il processo deve ascoltare solo su `127.0.0.1`; HTTPS termina su Caddy.

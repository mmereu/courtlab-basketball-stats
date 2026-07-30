# Backend cloud

La migrazione `migrations/001_core.sql` definisce il modello multi-tenant per:

- organizzazioni e ruoli;
- squadre, stagioni e roster;
- partite multiple;
- eventi idempotenti per dispositivo;
- revisioni con audit;
- link condivisibili;
- Row Level Security.

## Stato

Lo schema è pronto per un progetto Supabase, ma non viene ancora applicato in
produzione: servono URL e chiavi di un progetto oppure un'istanza self-hosted.
L'app deve continuare a funzionare local-first anche quando il backend non è
raggiungibile.

## Comandi previsti

```bash
supabase link --project-ref <project-ref>
supabase db push
```

Prima del primo rilascio cloud vanno aggiunti test di isolamento fra due
organizzazioni e una funzione transazionale per creare organizzazione e
membership owner nello stesso passaggio.

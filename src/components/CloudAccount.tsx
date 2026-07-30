import { FormEvent, useState } from "react";
import {
  createCloudInvitation, listCloudMembers, removeCloudMember, updateCloudMember,
  type CloudMember, type CloudRevision, type CloudUser,
} from "../cloud";
import type { CloudSyncStatus } from "../autoSync";

export default function CloudAccount({
  user, syncing, status, lastSync, error, onLogin, onRegister, onAcceptInvite,
  onLogout, onUpload, onDownload, onListRevisions, onRestoreRevision, onDeleteAccount,
}: {
  user?: CloudUser;
  syncing: boolean;
  status: CloudSyncStatus;
  lastSync?: number;
  error?: string;
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (email: string, password: string, displayName: string) => Promise<void>;
  onAcceptInvite: (token: string, email: string, password: string) => Promise<void>;
  onLogout: () => void;
  onUpload: () => Promise<void>;
  onDownload: () => Promise<void>;
  onListRevisions: () => Promise<CloudRevision[]>;
  onRestoreRevision: (revision: number) => Promise<void>;
  onDeleteAccount: () => Promise<void>;
}) {
  const inviteToken = new URLSearchParams(window.location.search).get("invite");
  const [open, setOpen] = useState(Boolean(inviteToken));
  const [register, setRegister] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [manage, setManage] = useState(false);
  const [members, setMembers] = useState<CloudMember[]>([]);
  const [inviteLink, setInviteLink] = useState<string>();
  const [revisions, setRevisions] = useState<CloudRevision[]>();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "");
    const password = String(data.get("password") ?? "");
    if (inviteToken) await onAcceptInvite(inviteToken, email, password);
    else if (register) await onRegister(email, password, String(data.get("name") ?? ""));
    else await onLogin(email, password);
  };

  const openMembers = async () => {
    setMembers(await listCloudMembers());
    setManage(true);
  };

  const statusLabel = {
    local: "Salvato sul dispositivo",
    syncing: "Sincronizzazione…",
    synced: "Sincronizzato",
    offline: "Offline · sincronizzazione in attesa",
    conflict: "Conflitto da risolvere",
    error: "Sincronizzazione non riuscita",
  }[status];

  return (
    <aside className="cloud-account">
      <button className={`cloud-trigger ${user ? "connected" : ""} status-${status}`} onClick={() => setOpen(!open)}>
        <span>{syncing ? "↻" : status === "conflict" || status === "error" ? "!" : user ? "●" : "○"}</span>
        {user ? statusLabel : "Account e cloud"}
      </button>
      {open && (
        <div className="cloud-popover">
          {privacy ? (
            <div className="privacy-notice">
              <p className="cloud-kicker">PRIVACY E SICUREZZA</p>
              <h2>I dati restano sotto il tuo controllo.</h2>
              <p>La modalità offline conserva squadre, roster, partite ed eventi esclusivamente nel browser tramite IndexedDB.</p>
              <p>Creando un account, questi dati vengono copiati nel database CourtLab sul server europeo configurato per l’app. Sono conservati anche email, ruolo e password sotto forma di hash scrypt: la password originale non viene memorizzata.</p>
              <p>I dati sono usati soltanto per autenticazione, sincronizzazione, collaborazione e generazione dei report. Non vengono venduti né usati per pubblicità.</p>
              <p>Il traffico usa HTTPS. Puoi continuare a lavorare offline, uscire dall’account o richiedere la cancellazione completa del workspace al gestore CourtLab.</p>
              <p>I roster dovrebbero contenere solo i dati necessari all’attività sportiva; evitare informazioni sanitarie o documenti personali.</p>
              <button className="cloud-primary" onClick={() => setPrivacy(false)}>Torna all’account</button>
            </div>
          ) : manage ? (
            <div className="cloud-members">
              <p className="cloud-kicker">COLLABORATORI</p>
              <h2>Accessi al workspace</h2>
              {members.map((member) => (
                <div className="cloud-member" key={member.id}>
                  <span><strong>{member.email}</strong><small>{member.role}</small></span>
                  <select value={member.role} onChange={async (event) => {
                    await updateCloudMember(member.id, event.target.value as CloudUser["role"]);
                    setMembers(await listCloudMembers());
                  }}>
                    <option value="owner">Owner</option>
                    <option value="coach">Coach</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <button onClick={async () => {
                    if (!window.confirm(`Rimuovere ${member.email}?`)) return;
                    await removeCloudMember(member.id);
                    setMembers(await listCloudMembers());
                  }}>×</button>
                </div>
              ))}
              <div className="cloud-invite-actions">
                <button onClick={async () => {
                  const invitation = await createCloudInvitation("coach");
                  const url = `${window.location.origin}/?invite=${encodeURIComponent(invitation.token)}`;
                  setInviteLink(url);
                  void navigator.clipboard?.writeText(url).catch(() => undefined);
                }}>Invita coach</button>
                <button onClick={async () => {
                  const invitation = await createCloudInvitation("viewer");
                  const url = `${window.location.origin}/?invite=${encodeURIComponent(invitation.token)}`;
                  setInviteLink(url);
                  void navigator.clipboard?.writeText(url).catch(() => undefined);
                }}>Invita viewer</button>
              </div>
              {inviteLink && <label>Link invito<input readOnly value={inviteLink} onFocus={(e) => e.target.select()} /></label>}
              <button className="cloud-quiet" onClick={() => setManage(false)}>Torna all’account</button>
            </div>
          ) : <>
          {user ? (
            <>
              <p className="cloud-kicker">CONNESSO · {user.role.toUpperCase()}</p>
              <strong>{user.displayName}</strong>
              <small>{user.email}</small>
              <p><strong>{statusLabel}</strong><br />
                <small>{lastSync ? `Ultimo aggiornamento ${new Date(lastSync).toLocaleTimeString("it-IT")}` : "La prima sincronizzazione partirà automaticamente."}</small>
              </p>
              {error && <p className="cloud-error">{error}</p>}
              <p><strong>Sincronizzazione automatica protetta</strong><br />
                <small>Le modifiche vengono inviate appena c’è connessione. CourtLab blocca le sovrascritture se due dispositivi cambiano gli stessi dati in parallelo.</small>
              </p>
              {status === "conflict" && <>
                <button className="cloud-primary" disabled={syncing || user.role === "viewer"} onClick={() => void onUpload()}>
                  Usa i dati di questo dispositivo
                </button>
                <button className="cloud-quiet" disabled={syncing} onClick={() => void onDownload()}>
                  Usa la versione cloud
                </button>
              </>}
              <button className="cloud-quiet" disabled={syncing} onClick={async () => {
                setRevisions(await onListRevisions());
              }}>Cronologia e ripristino</button>
              {revisions && <div className="cloud-revisions">
                <strong>Versioni conservate</strong>
                {!revisions.length && <small>Nessuna versione ancora disponibile.</small>}
                {revisions.map((revision) => <div key={revision.version}>
                  <span>
                    <strong>v{revision.version}</strong>
                    <small>{new Date(revision.createdAt * 1000).toLocaleString("it-IT")} · {revision.teams} squadre · {revision.games} partite</small>
                  </span>
                  <button disabled={syncing || user.role === "viewer"} onClick={() => void onRestoreRevision(revision.version)}>
                    Ripristina
                  </button>
                </div>)}
              </div>}
              {user.role === "owner" && <button className="cloud-quiet" onClick={() => void openMembers()}>Gestisci collaboratori</button>}
              <button className="cloud-quiet" onClick={onLogout}>Esci dall’account</button>
              <button className="cloud-danger" onClick={() => {
                if (window.confirm("Eliminare definitivamente account e dati cloud? I dati offline resteranno su questo dispositivo.")) {
                  void onDeleteAccount();
                }
              }}>Elimina account cloud</button>
            </>
          ) : (
            <>
              <p className="cloud-kicker">{inviteToken ? "ACCETTA INVITO" : register ? "CREA ACCOUNT" : "ACCEDI"}</p>
              <h2>{inviteToken ? "Entra nel workspace CourtLab." : register ? "Proteggi e sincronizza le partite." : "Ritrova CourtLab su ogni dispositivo."}</h2>
              <form onSubmit={(event) => void submit(event)}>
                {register && !inviteToken && <label>Nome workspace<input name="name" required autoComplete="organization" /></label>}
                <label>Email<input name="email" type="email" required autoComplete="email" /></label>
                <label>Password<input name="password" type="password" minLength={12} required autoComplete={register ? "new-password" : "current-password"} /></label>
                {error && <p className="cloud-error">{error}</p>}
                <button className="cloud-primary" disabled={syncing}>{syncing ? "Attendi…" : inviteToken ? "Accetta invito" : register ? "Crea account" : "Accedi"}</button>
              </form>
              {!inviteToken && <button className="cloud-quiet" onClick={() => setRegister(!register)}>
                {register ? "Ho già un account" : "Crea un nuovo account"}
              </button>}
              <small>I dati restano disponibili offline anche dopo l’accesso.</small>
            </>
          )}
          <button className="cloud-quiet" onClick={() => setPrivacy(true)}>Privacy e sicurezza</button>
          </>}
        </div>
      )}
    </aside>
  );
}

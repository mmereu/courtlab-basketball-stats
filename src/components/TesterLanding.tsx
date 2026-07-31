import { FormEvent, useState } from "react";
import "./tester-landing.css";

type SubmitState = "idle" | "sending" | "sent" | "error";

export default function TesterLanding() {
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [error, setError] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitState("sending");
    setError("");
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    try {
      const response = await fetch("/api/tester-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          email: values.email,
          phone: values.phone,
          organization: values.organization,
          category: values.category,
          role: values.role,
          device: values.device,
          message: values.message,
          website: values.website,
          consent: values.consent === "on",
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error?.message || "Invio non riuscito");
      form.reset();
      setSubmitState("sent");
    } catch (value) {
      setError(value instanceof Error ? value.message : "Invio non riuscito");
      setSubmitState("error");
    }
  };

  return (
    <main className="tester-page">
      <nav className="tester-nav">
        <a className="tester-brand" href="/">
          <img src="/novara-basket-v4.jpeg" alt="" />
          <span>CourtLab</span>
        </a>
        <div>
          <a href="#come-funziona">Come funziona</a>
          <a href="#candidatura">Candidati</a>
          <a className="tester-nav-app" href="/">Apri CourtLab</a>
        </div>
      </nav>

      <header className="tester-hero">
        <div className="tester-hero-copy">
          <p className="tester-kicker">PROGRAMMA COACH TESTER</p>
          <h1>Prova CourtLab.<br /><em>Miglioralo con noi.</em></h1>
          <p className="tester-lead">
            Cerchiamo allenatori e staff di pallacanestro disponibili a usare
            CourtLab durante partite reali e a raccontarci cosa funziona,
            cosa rallenta e cosa manca.
          </p>
          <div className="tester-hero-actions">
            <a className="tester-primary" href="#candidatura">Diventa tester</a>
            <a className="tester-secondary" href="#come-funziona">Scopri il programma</a>
          </div>
          <ul className="tester-trust">
            <li>Gratuito</li>
            <li>Funziona offline</li>
            <li>Supporto diretto</li>
            <li>Open source MIT</li>
          </ul>
        </div>
        <div className="tester-hero-visual">
          <div className="tester-score-card">
            <span>PARTITA LIVE · Q3</span>
            <div><strong>54</strong><i>—</i><strong>49</strong></div>
            <small>Sincronizzato automaticamente</small>
          </div>
          <img src="/tester-report.png" alt="Report CourtLab con box score e shot chart" />
        </div>
      </header>

      <section className="tester-strip" aria-label="Funzioni principali">
        <article><strong>01</strong><span>Scouting live<br />da bordo campo</span></article>
        <article><strong>02</strong><span>Statistiche individuali<br />e di squadra</span></article>
        <article><strong>03</strong><span>Report PDF<br />ed Excel</span></article>
        <article><strong>04</strong><span>PC, tablet<br />e cellulare</span></article>
      </section>

      <section className="tester-program" id="come-funziona">
        <div className="tester-section-heading">
          <p className="tester-kicker">NON CERCHIAMO COMPLIMENTI</p>
          <h2>Cerchiamo feedback da campo.</h2>
          <p>
            CourtLab è già in produzione. Il programma serve a provarlo in
            contesti diversi e a decidere le prossime migliorie insieme a chi
            registra davvero una partita.
          </p>
        </div>
        <div className="tester-steps">
          <article>
            <span>1</span><h3>Ti candidi</h3>
            <p>Ci racconti quale squadra segui, il tuo ruolo e il dispositivo che useresti.</p>
          </article>
          <article>
            <span>2</span><h3>Prepariamo la prova</h3>
            <p>Configuriamo società, squadra e roster e facciamo una breve simulazione insieme.</p>
          </article>
          <article>
            <span>3</span><h3>La usi in partita</h3>
            <p>Registri almeno due gare. CourtLab continua a funzionare anche senza connessione.</p>
          </article>
          <article>
            <span>4</span><h3>Ci dici la verità</h3>
            <p>Quindici minuti di confronto su velocità, chiarezza, affidabilità e funzioni mancanti.</p>
          </article>
        </div>
      </section>

      <section className="tester-exchange">
        <div>
          <p className="tester-kicker">COSA RICEVI</p>
          <h2>Non sei un utente qualsiasi.</h2>
          <ul>
            <li>Configurazione iniziale assistita</li>
            <li>Supporto diretto durante il periodo di prova</li>
            <li>Accesso gratuito a tutte le funzioni disponibili</li>
            <li>Priorità sulle richieste nate dalle partite reali</li>
          </ul>
        </div>
        <div>
          <p className="tester-kicker">COSA CHIEDIAMO</p>
          <h2>Due partite e feedback concreto.</h2>
          <ul>
            <li>Una simulazione prima dell’utilizzo ufficiale</li>
            <li>Almeno due partite registrate</li>
            <li>Segnalazione chiara di errori o passaggi confusi</li>
            <li>Un breve confronto finale con il team CourtLab</li>
          </ul>
        </div>
      </section>

      <section className="tester-form-section" id="candidatura">
        <div className="tester-form-copy">
          <p className="tester-kicker">CANDIDATURA</p>
          <h2>Porta CourtLab nella tua prossima partita.</h2>
          <p>
            Compila il modulo. I dati servono soltanto a valutare la prova e
            ricontattarti; non saranno venduti o usati per pubblicità.
          </p>
          <div className="tester-mini-faq">
            <details><summary>Devo installare qualcosa?</summary><p>No. Apri il link e aggiungi CourtLab alla schermata Home.</p></details>
            <details><summary>Serve internet durante la partita?</summary><p>No. Le azioni vengono salvate sul dispositivo e sincronizzate quando torna la connessione.</p></details>
            <details><summary>Posso usare dati non reali?</summary><p>Sì. Per la prima simulazione puoi usare nomi e numeri di prova.</p></details>
          </div>
        </div>

        {submitState === "sent" ? (
          <div className="tester-success" role="status">
            <span>✓</span>
            <h3>Candidatura ricevuta.</h3>
            <p>Grazie. Ti ricontatteremo per organizzare la prima prova di CourtLab.</p>
            <button onClick={() => setSubmitState("idle")}>Invia un’altra candidatura</button>
          </div>
        ) : (
          <form className="tester-form" onSubmit={(event) => void submit(event)}>
            <label>Nome e cognome<input name="name" required maxLength={100} autoComplete="name" /></label>
            <label>Email<input name="email" type="email" required maxLength={160} autoComplete="email" /></label>
            <label>Telefono <small>facoltativo</small><input name="phone" type="tel" maxLength={40} autoComplete="tel" /></label>
            <label>Società<input name="organization" required maxLength={140} autoComplete="organization" /></label>
            <label>Squadra o categoria<input name="category" required maxLength={100} placeholder="Es. Under 15" /></label>
            <label>Ruolo<select name="role" required defaultValue="">
              <option value="" disabled>Seleziona</option>
              <option>Allenatore</option><option>Assistente</option>
              <option>Dirigente</option><option>Scout</option><option>Altro</option>
            </select></label>
            <label>Dispositivo principale<select name="device" required defaultValue="">
              <option value="" disabled>Seleziona</option>
              <option>Tablet</option><option>Cellulare</option>
              <option>Computer portatile</option><option>Non lo so ancora</option>
            </select></label>
            <label className="tester-form-wide">Cosa vorresti verificare?
              <textarea name="message" maxLength={1200} rows={4} placeholder="Raccontaci come rilevi oggi le statistiche e cosa ti aspetti dall’app." />
            </label>
            <label className="tester-honeypot" aria-hidden="true">Sito web<input name="website" tabIndex={-1} autoComplete="off" /></label>
            <label className="tester-consent tester-form-wide">
              <input name="consent" type="checkbox" required />
              <span>Acconsento al trattamento dei dati inviati per essere ricontattato in merito al programma tester.</span>
            </label>
            {error && <p className="tester-form-error tester-form-wide" role="alert">{error}</p>}
            <button className="tester-submit tester-form-wide" disabled={submitState === "sending"}>
              {submitState === "sending" ? "Invio in corso…" : "Invia candidatura"}
            </button>
          </form>
        )}
      </section>

      <footer className="tester-footer">
        <div className="tester-brand"><img src="/novara-basket-v4.jpeg" alt="" /><span>CourtLab</span></div>
        <p>Basketball Stats Coach · Software open source con licenza MIT</p>
        <a href="/">Apri l’applicazione di produzione →</a>
      </footer>
    </main>
  );
}

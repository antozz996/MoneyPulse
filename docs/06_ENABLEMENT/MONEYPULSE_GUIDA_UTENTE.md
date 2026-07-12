# MoneyPulse

## Guida Utente

Versione: 1.0  
Lingua: Italiano  
Scopo: spiegare in modo semplice cosa fa MoneyPulse e come usarlo bene nella pratica quotidiana.

## 1. Cos'e' MoneyPulse

MoneyPulse e' una cabina di regia finanziaria personale pensata per rispondere a una domanda concreta:

**Quanto posso spendere oggi senza mettere in difficolta' il domani?**

Non e' uno strumento pensato per fare analisi infinite o per guardare solo il passato.  
Serve soprattutto per:

- capire il margine reale di oggi;
- simulare un acquisto prima di farlo;
- tenere conto di impegni, obiettivi e ricorrenze;
- ridurre l'incertezza nelle decisioni quotidiane.

## 2. Il principio chiave

MoneyPulse e' utile solo se i dati sono aggiornati.

Il numero che vedi in `Today` non e' magia: deriva dai dati che hai inserito o sincronizzato:

- saldi dei conti;
- transazioni previste o registrate;
- spese ricorrenti;
- buffer di sicurezza;
- obiettivi di risparmio.

Se questi dati non sono aggiornati, anche il consiglio sara' meno utile.

## 3. Le schermate principali

### 3.1 Accesso

MoneyPulse usa un account personale.

Puoi:

- registrarti con nome, email e password;
- accedere per ritrovare i tuoi dati;
- uscire dall'app quando vuoi.

Uso corretto:

- usa sempre lo stesso account per non disperdere i dati;
- evita di creare account duplicati per test e uso reale;
- se cambi dispositivo, accedi con lo stesso account per ritrovare il tuo contesto.

### 3.2 Today

`Today` e' la schermata piu' importante.

Qui MoneyPulse ti mostra:

- la disponibilita' spendibile di oggi;
- il livello di rischio;
- i motivi principali del risultato;
- il prossimo punto di attenzione;
- un riepilogo utile per decidere in pochi secondi.

In pratica, `Today` serve a capire se la tua giornata finanziaria e':

- tranquilla;
- stretta;
- sotto pressione.

Uso corretto:

- apri `Today` come primo controllo della giornata;
- usalo prima di prendere decisioni di spesa discrezionale;
- se il risultato ti sembra strano, controlla prima `Money` e `Goals`;
- considera `Today` come una sintesi operativa, non come una fotografia assoluta del conto.

### 3.3 Before You Buy

`Before You Buy` serve a simulare un acquisto prima di spendere davvero.

Inserisci:

- importo;
- valuta;
- descrizione opzionale.

MoneyPulse restituisce:

- disponibilita' attuale;
- disponibilita' dopo l'acquisto;
- delta dell'impatto;
- decisione;
- motivazioni;
- livello di confidenza deterministico.

Uso corretto:

- usalo per acquisti opzionali o dubbi;
- usalo soprattutto quando l'acquisto compete con affitto, spese fisse o obiettivi;
- non usarlo solo per "vedere se il saldo basta": guarda soprattutto cosa resta dopo;
- se la spesa e' importante, prova anche piu' scenari con importi diversi.

Quando usarlo davvero bene:

- prima di un acquisto non urgente;
- prima di dividere una spesa in rate;
- quando sai che mancano ancora giorni al prossimo stipendio;
- quando hai gia' obiettivi o buffer da proteggere.

### 3.4 Money

`Money` e' la base dati che alimenta il motore decisionale.

Qui gestisci:

- conti;
- transazioni;
- eventi ricorrenti.

#### Conti

I conti rappresentano i tuoi saldi correnti.

Uso corretto:

- inserisci almeno un conto reale;
- aggiorna i saldi quando cambiano in modo significativo;
- non usare saldi stimati troppo vecchi.

#### Transazioni

Le transazioni aiutano MoneyPulse a capire entrate e uscite rilevanti.

Uso corretto:

- registra le spese essenziali con la data corretta;
- registra gli impegni gia' presi, non solo le spese gia' avvenute;
- usa le categorie in modo coerente.

#### Eventi ricorrenti

Le ricorrenze servono per entrate o uscite prevedibili.

Esempi:

- abbonamenti;
- palestra;
- stipendio ricorrente;
- entrate periodiche;
- addebiti abituali.

Uso corretto:

- usa le ricorrenze per tutto cio' che si ripete;
- evita di duplicare una spesa sia come ricorrenza sia come transazione singola, se non e' davvero necessario;
- aggiorna o disattiva una ricorrenza quando non vale piu'.

### 3.5 Goals

`Goals` serve a tenere visibile il futuro.

Gli obiettivi non sono decorativi: influenzano il consiglio di spesa.

MoneyPulse distingue in pratica due logiche:

- obiettivi di risparmio;
- buffer di sicurezza.

#### Buffer di sicurezza

Il buffer protegge una parte del denaro da spese impulsive o poco prudenti.

Uso corretto:

- imposta un buffer realistico;
- non trattarlo come denaro libero;
- consideralo intoccabile salvo vera emergenza.

#### Obiettivi

Gli obiettivi aiutano a non sacrificare il medio termine per il comfort immediato.

Uso corretto:

- crea pochi obiettivi ma chiari;
- imposta contributi pianificati realistici;
- rivedi gli importi se diventano troppo aggressivi o troppo deboli.

### 3.6 Copilot

`Copilot` e' un assistente pratico che lavora su output strutturati di MoneyPulse.

Oggi e':

- deterministico di default;
- basato sui dati disponibili nell'app;
- pensato per spiegare e orientare, non per inventare numeri.

Puoi usarlo per domande come:

- "Come sto andando?"
- "Posso spendere 300 euro questo weekend?"
- "Dove sto spendendo troppo?"
- "Come vanno i miei obiettivi?"
- "Come chiudo il mese?"
- "Fammi un piano fino allo stipendio"

Uso corretto:

- usalo dopo aver aggiornato il contesto in `Money`;
- trattalo come un interprete del motore, non come un consulente finanziario autonomo;
- se la risposta non ti convince, verifica i dati di partenza.

### 3.7 Settings

`Settings` raccoglie impostazioni operative utili.

Attualmente include soprattutto:

- lingua e regione;
- bank sync mock;
- controlli di sincronizzazione locale del contesto.

#### Lingua

Puoi cambiare lingua tra:

- Italiano
- English
- Francais
- Espanol

Uso corretto:

- scegli la lingua con cui capisci meglio i dettagli;
- dopo il cambio, l'app mantiene la preferenza localmente.

#### Bank Sync mock

La sincronizzazione bancaria attuale e' una base mock per test e sviluppo del flusso.

Significa che:

- il flusso di connessione esiste;
- puoi simulare sincronizzazioni;
- la modalita' manuale resta sempre disponibile.

Uso corretto:

- usala per provare il flusso;
- per l'uso quotidiano, continua a considerare affidabile soprattutto il dato manuale che controlli tu.

## 4. Come usare MoneyPulse bene ogni giorno

Il modo migliore per usare MoneyPulse non e' inserire tutto in modo perfetto una volta sola.  
E' tenere aggiornate poche cose importanti con continuita'.

### Routine consigliata

1. Apri `Today`.
2. Controlla se il margine di oggi e' coerente con la tua situazione.
3. Se qualcosa non torna, vai in `Money`.
4. Aggiorna saldo, transazioni o ricorrenze rilevanti.
5. Ritorna in `Today`.
6. Se devi fare una spesa, usa `Before You Buy`.
7. Se hai dubbi, chiedi un riepilogo al `Copilot`.

### Frequenza consigliata

- `Today`: ogni giorno o prima di spendere.
- `Money`: ogni volta che cambia un saldo o registri una spesa importante.
- `Goals`: una volta a settimana o quando cambiano le priorita'.
- `Before You Buy`: prima di spese non banali.

## 5. Buone pratiche

Per ottenere il massimo da MoneyPulse:

- aggiorna almeno un conto principale;
- inserisci affitto, bollette, abbonamenti e spese fisse;
- usa gli obiettivi solo se intendi davvero proteggerli;
- non gonfiare il saldo disponibile "a occhio";
- non ignorare il buffer di sicurezza;
- usa le ricorrenze per evitare dimenticanze;
- registra la data giusta delle uscite e delle entrate;
- verifica periodicamente che non ci siano dati duplicati.

## 6. Errori da evitare

- usare un saldo vecchio di settimane;
- dimenticare spese ricorrenti importanti;
- trattare il buffer come denaro libero;
- simulare acquisti senza aver aggiornato i dati di partenza;
- creare troppi obiettivi piccoli e poco significativi;
- confondere il saldo del conto con la disponibilita' reale.

## 7. Come leggere bene i risultati

### Saldo del conto

Il saldo e' il denaro presente sul conto.

### Disponibilita' reale

La disponibilita' reale e' il denaro che resta dopo aver considerato:

- entrate attese;
- obblighi essenziali;
- spese gia' impegnate;
- buffer;
- contributi agli obiettivi.

Questo e' il concetto piu' importante di tutta l'app.

### Decisione

Il motore puo' segnalare una situazione sicura, stretta o da fermare.

Interpretazione pratica:

- `safe`: c'e' margine;
- `caution`: si puo' fare, ma il margine si assottiglia;
- `hold`: la spesa o la situazione aumenta troppo la pressione.

## 8. A chi serve di piu'

MoneyPulse e' particolarmente utile se:

- vuoi evitare di accorgerti troppo tardi di aver speso troppo;
- hai entrate, spese fisse e obiettivi contemporaneamente;
- vuoi una risposta pratica, non un foglio di calcolo;
- prendi spesso decisioni di spesa "sul momento".

## 9. Limiti attuali da conoscere

Per usarlo bene, e' utile sapere anche cosa **non** fa ancora.

Ad oggi:

- la qualita' del risultato dipende dalla qualita' del dato inserito;
- il bank sync attuale e' ancora una base mock, non una connessione bancaria completa;
- il Copilot non sostituisce il motore decisionale;
- MoneyPulse non e' un consulente finanziario regolamentato;
- non e' uno strumento di investimento o trading.

## 10. Strategia d'uso consigliata

Se vuoi ottenere il massimo dall'app:

### Fase 1

- inserisci un conto principale;
- aggiungi le spese essenziali;
- imposta almeno un buffer di sicurezza.

### Fase 2

- aggiungi ricorrenze e impegni prevedibili;
- crea 1 o 2 obiettivi reali;
- usa `Today` ogni mattina.

### Fase 3

- usa `Before You Buy` prima delle spese non necessarie;
- usa `Copilot` per interpretare meglio il contesto;
- rivedi `Goals` ogni settimana.

## 11. In una frase

MoneyPulse funziona meglio quando lo usi come **strumento di decisione quotidiana**, non come archivio passivo di movimenti.

Se i dati sono aggiornati, ti aiuta a spendere con piu' lucidita' e meno ansia.

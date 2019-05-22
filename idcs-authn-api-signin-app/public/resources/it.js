const resources = {
  "signin-page-title": "Accesso",

  // Side bar
  "bar-signin-btn" : "Accedi",
  "bar-signup-btn" : "Registrati",
  "bar-signin-hdr" : "Sei già registrato?",
  "bar-signup-hdr" : "Non hai un account?",
  "bar-signin-subhdr" : "Accedi",

  // Signin form
  "signin-hdr" : "Benvenuto",
  "signin-username-fld" : "Nome Utente",
  "signin-password-fld" : "Password",
  "signin-submit-btn" : "Accedi",
  "signin-forgot-password-btn" : "Hai dimenticato la tua password?",

  // OTP form
  "otp-hdr" : "Verifica del OTP",
  "otp-info-msg" : "Per favore inserisci il codice OTP mandato a",
  "otp-fld" : "Codice OTP",
  "otp-submit-btn" : "Verifica",

  // TOTP form
  "totp-hdr" : "Verifica dell'orario OTP",
  "totp-info-msg" : "Per favore inserisci il codice OTP visualizzato in ",
  "totp-submit-btn" : "Verifica",

  // Push form
  "push-hdr" : "Verifica delle notifiche Push",
  "push-info-msg" : "Notifica inviata all'app di autenticazione sul seguente dispositivo mobile:",
  "push-info-nodisplayname-msg" : "Notifica inviata all'app di autenticazione sul tuo dispositivo mobile.",
  "push-approve-info-msg" : "Per continuare è necessario approvarla.",

  // Trusted device
  "td-msg" : "Abilita questo dispositivo per",
  "td-days-msg" : "giorni",

  // Social
  "social-user-not-registered-msg" : "L'utente non è registrato nell'IDCS. Per favore, clicca qui per registrarti.",
  "social-email-fld": "Email",
  "social-givenName-fld": "Nome",
  "social-familyName-fld": "Cognome",
  "social-mobileNo-fld": "Numero Mobile",
  "social-phoneNo-fld": "Numero di cellulare",
  "social-socialRegisterUser-hdr":"Registrazione Social",
  "social-cancel-btn": "Annulla",

  // Security Questions form
  "qa-hdr" : "Verifica delle domande di sicurezza",
  "qa-info-msg" : "Per favore, fornisci le seguenti risposte",
  "qa-submit-btn" : "Verifica",

  // Enrollment Init
  "enroll-hdr" : "Abilitazione Verifica a 2-Passaggi",
  "enroll-subhdr" : "Seleziona un metodo",
  "enroll-skip-msg" : "Salta l'Enrollment",
  "enroll-switch-msg" : "Cambiare metodo",

  // Enrollment Success
  "enroll-success-hdr" : "Il metodo di verifica a 2-Passaggi è stato configurato correttamente.",
  "enroll-success-btn" : "Fatto",
  "enroll-anotherfactor-btn" : "Esegui l'Enroll di un altro fattore",

  "factor-sms-btn" : "SMS per OTP",
  "factor-email-btn" : "E-mail per OTP",
  "factor-push-btn" : "Notifiche Push",
  "factor-totp-btn" : "Orario OTP",
  "factor-security_questions-btn" : "Domande di sicurezza",
  "factor-bypasscode-btn" : "Bypass del codice",

  "factor-sms-msg" : "Inviare un codice al numero di cellulare",
  "factor-email-msg" : "Inviare un codice per email",
  "factor-push-msg" : "Inviare una notifica all'app autenticatore su",
  "factor-totp-msg" : "Utilizzare il codice generato dall'app autenticatore su",
  "factor-security_questions-msg" : "Fornire risposte alle domande di sicurezza",
  "factor-bypasscode-msg" : "Utilizzare un codice di bypass se non è possible utilizzare un altro fattore",

  "factor-sms-msg-short" : "SMS",
  "factor-email-msg-short" : "EMAIL",
  "factor-push-msg-short" : "PUSH",
  "factor-totp-msg-short" : "TOTP",
  "factor-security_questions-msg-short" : "Q/A",
  "factor-bypasscode-msg-short" : "BYPASS",

  "factor-sms-desc" : "SMS sul numero Mobile",
  "factor-email-desc" : "Manda un email con il codice da usare",
  "factor-push-desc" : "Oracle Authenticator App",
  "factor-totp-desc" : "Orario OTP",
  "factor-security_questions-desc" : "Domande di sicurezza e risposte",
  "factor-bypasscode-desc" : "Usa un codice di sicurezza se non puoi usare un altro fattore",

  // OTP Enrollment form
  "enroll-otp-hdr" : "Iscrizione OTP tramite E-Mail ",
  "enroll-otp-info-msg" : "Per favore, inserisci il codice OTP mandato a ",
  "enroll-otp-fld" : "Codice OTP",
  "enroll-otp-submit-btn" : "Iscriviti",

  // SMS Enrollment form
  "enroll-sms-hdr" : "Iscrizione OTP tramite SMS",
  "enroll-sms-info-msg" : "Per favore, inserisci un numero mobile a cui mandare l'SMS",
  "enroll-sms-fld" : "Numero Mobile",
  "enroll-sms-submit-btn" : "Iscriviti",

  // Security Questions Enrollment form
  "enroll-qa-hdr" : "Iscrizione tramite domande di sicurezza",
  "enroll-qa-info-msg" : "Inserisci una risposta per ognuna delle domande selezionate",
  "enroll-qa-answer-fld" : "Risposta",
  "enroll-qa-hint-fld" : "Suggerimento",
  "enroll-qa-submit-btn" : "Iscriviti",
  "enroll-qa-error-sameq-twice-msg" : "La stessa domanda di sicurezza è stata scelta due volte. Per favore, seleziona un'altra domanda.",

  // TOTP Enrollment form
  "enroll-totp-hdr" : "Iscrizione tramite Time-Based OTP",
  "enroll-totp-scan-msg" : "Scansiona il codice QR utilizzando l'app mobile Oracle di autenticazione",
  "enroll-totp-respond-msg": "Quindi inserisci il codice che vedi sullo schermo del tuo cellulare nel seguente campo",
  "enroll-totp-fld" : "Codice Time-based OTP",
  "enroll-totp-submit-btn" : "Iscriviti",

  // Push Enrollment form
  "enroll-push-hdr" : "Iscrizione tramite Notifiche Push",
  "enroll-push-scan-msg" : "Scansiona il codice QR con l'app mobile Oracle di autenticazione.",

  "enroll-taplink-msg": "Premi per registrare il tuo cellulare.",

  // Bypass code form
  "bypass-hdr" : "Codice Bypass",
  "bypass-info-msg" : "Inserire il tuo codice bypass",
  "bypass-fld" : "Codice Bypass",
  "bypass-submit-btn" : "Invia",

  // Backup
  "backup-btn" : "Usa un metodo di autenticazione diverso",
  "backup-msg" : "Scegli un metodo di autenticazione diverso:",

  // Resend code
  "email-did-not-get-msg" : "Non hai ricevuto l'email?",
  "email-resend-btn" : "Rimanda l'email",
  "sms-did-not-get-msg" : "Non hai ricevuto l'SMS?",
  "sms-resend-btn" : "Rimanda l'SMS",

  // Forgot password
  "forgot-pw-btn" : "Hai dimenticato la tua Password",
  "forgot-pw-hdr" : "Hai dimenticato la tua Password?",
  "forgot-pw-info-msg" : "Per favore, inserisci il tuo nome utente per il ripristino della password.",
  "forgot-pw-fld" : "Nome Utente",
  "forgot-pw-submit-btn" : "Invia",
  "forgot-pw-success-info-msg" : "L'email per il ripristino della password è stata mandata per l'utente ",
  "forgot-pw-ok-btn": "Ok",
  "forgot-pw-did-not-get-msg": "Non hai ancora ricevuto l'email?",
  "forgot-pw-resend-btn": "Rimanda Email",
  "forgot-pw-incorrect-username-msg": "Nome utente sbagliato?",
  "forgot-pw-incorrect-username-btn": "Reimposta il Nome Utente",

  "reset-pw-hdr" : "Ripristino Password",
  "reset-pw-info-msg" : "Per favore, compila i campi password e conferma password.",
  "reset-pw-fld" : "Password",
  "reset-pw-confirm-fld" : "Conferma Password",
  "reset-pw-submit-btn" : "Invia",
  "reset-pw-success-info-msg" : "La tua password è stata correttamente ripristinata.",
  "reset-pw-windows-close-msg" : "Puoi chiudere questa pagina",
  "reset-pw-ok-btn": "Ok",
  "reset-pw-nomatch-msg" : "Password e Conferma Password non combaciano! Per favore, riprova",

  //Self RegistrationProfiles
  "signup-chooseprofile": "Scegli un Profilo Social per l'auto-registrazione",
  "signup-hdr": "Sali a bordo!",
  "signup-noprofile": "Nessun profilo di registrazione disponibile",
  "signup-btn": "Registrati",
  "signup-btndone": "FATTO",
  "signup-btnok": "Ok",
  "signup-passwordmatch": "Password e Conferma Password non combaciano",
  "signup-consent": "Acconsento",
  "signup-hello-msg": "Ciao, ",
  "signup-reg-success-msg": "La tua registrazione è andata a buon fine. Dovresti ricevere un'email di conferma a breve...",
  "signup-reg-complete-msg": "L'auto registrazione è terminata.<BR/>Puoi chiudere questa pagina.",

  // Terms of use
  "must-accept-terms": "Devi accettare i termini di utilizzo per procedere",

  // Preferred Factor
  "preferredFactor-msg" : "Imposta questo fattore come preferito",

  // Misc
  "loading-msg" : "Caricando...",
  "or-msg" : "o",
  "back-to-login-msg" : "Torna al Login",

  // Errors
  "error-required-fld" : "Campi Obbligatori vuoti",
  "error-AUTH-1120" : "Errore. Per favore, Effettua nuovamente il login.",
  "error-SDK-AUTH-9000" : "Inizializzazione fallita: token di accesso non trovato. Per favore, contattare un amministratore.",
  "error-SDK-AUTH-9001" : "Inizializzazione fallita: Stato di Inizializzazione non trovato. Per favore, contattare un'amministratore.",
  "error-SDK-AUTH-9010" : "Si è verificato un errore inatteso . Per favore, contattare un'amministratore.",
  "error-SDK-AUTH-9011" : "Si è verificato un errore inatteso . Per favore, contattare un'amministratore",
  "error-SDK-AUTH-9020" : "Ripristino della Password fallito. Il link inserito per il ripristino della password potrebbe essere scaduto.",
  "error-SDK-AUTH-9021" : "La password scelta viola una o più regole:",
  "error-SDK-AUTH-9999" : "Errore di sistema interno: dati non validi. Per favore, contattare un'amministratore.",

  "error-SSO-1002" : "L'utente è bloccato in Oracle Identity Cloud Service. Puoi utilizzare la funzione \"Password Dimenticata?\" o contattare un'amministratore per sbloccare.",
  "error-SSO-1003" : "L'utente è disattivato in Oracle Identity Cloud Service. Per favore, contattare un'amministratore."

}

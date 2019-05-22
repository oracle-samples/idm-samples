const resources = {
  "signin-page-title": "Logg inn",

  // Side bar
  "bar-signin-btn" : "Logg inn",
  "bar-signup-btn" : "Meld deg på",
  "bar-signin-hdr" : "En av oss?",
  "bar-signup-hdr" : "Har ikke en konto?",
  "bar-signin-subhdr" : "Bare logg in",

  // Signin form
  "signin-hdr" : "Velkommen",
  "signin-username-fld" : "Brukernavn",
  "signin-password-fld" : "Passord",
  "signin-submit-btn" : "Pålogging",
  "signin-forgot-password-btn" : "Glemt passord?",

  // OTP form
  "otp-hdr" : "Verifiserer engangs-passord",
  "otp-info-msg" : "Vennligts angi engangs-kode sendt til ",
  "otp-fld" : "Engangs-kode",
  "otp-submit-btn" : "verifiser",

  // TOTP form
  "totp-hdr" : "Verifiserer tidsbasert engangs-kode",
  "totp-info-msg" : "Vennligst angi tidsbasert engangs-kode slik den fremkommer i ",
  "totp-submit-btn" : "Verifiser",

  // Push form
  "push-hdr" : "Verifiser push-varsler",
  "push-info-msg" : "Varsel sendt til autentiseringprogrammet på følgende mobile enhet:",
  "push-info-nodisplayname-msg" : "Varsel sendt til autentiseringprogrammet på mobile enhet.",
  "push-approve-info-msg" : "Du må godkjenne for å kunne gå videre",

  // Trusted device
  "td-msg" : "Stol på denne enheten i ",
  "td-days-msg" : "dager",

  // Social
  "social-user-not-registered-msg" : "Bruker ikke registrert i IDCS, klikk her for å melde på.",
  "social-email-fld": "Epost",
  "social-givenName-fld": "Fornavn",
  "social-familyName-fld": "Etternavn",
  "social-mobileNo-fld": "Mobil",
  "social-phoneNo-fld": "Telefon",
  "social-socialRegisterUser-hdr": "Sosial påmelding",
  "social-cancel-btn": "Avbryt",

  // Security Questions form
  "qa-hdr" : "Verifiserer Sikkehets-spørsmål",
  "qa-info-msg" : "Vennligst gi svar på spørsmålene",
  "qa-submit-btn" : "Verifiser",

  // Enrollment Init
  "enroll-hdr" : "Slå på 2-trinns verifisering",
  "enroll-subhdr" : "Velg en metode",
  "enroll-skip-msg" : "Hopp over påmelding",
  "enroll-switch-msg" : "Bytt metode for å melde på",

  // Enrollment Success
  "enroll-success-hdr" : "2-trinns verifisering vellykket aktivert",
  "enroll-success-btn" : "Ferdig",
  "enroll-anotherfactor-btn" : "Aktiver en annen metode",

  "factor-sms-btn" : "Engangs-passord via SMS",
  "factor-email-btn" : "Engangs-passord via epost",
  "factor-push-btn" : "Push-varsler",
  "factor-totp-btn" : "Tidsbasert engangs-passord",
  "factor-security_questions-btn" : "Sikkerhets-spørsmål",
  "factor-bypasscode-btn" : "Nød-kode",

  "factor-sms-msg" : "Send en kode til mobilnummer",
  "factor-email-msg" : "Send en kode til epost",
  "factor-push-msg" : "Send et varsel til autentiseringprogrammet på",
  "factor-totp-msg" : "Bruk koden generert av autentiseringprogrammet på",
  "factor-security_questions-msg" : "Gi svar på sikkerhets-spørsmål",
  "factor-bypasscode-msg" : "Brun en nød-kode hvis du ikke kan bruke en annen faktor",

  "factor-sms-msg-short" : "SMS",
  "factor-email-msg-short" : "EPOST",
  "factor-push-msg-short" : "PUSH",
  "factor-totp-msg-short" : "TOTP",
  "factor-security_questions-msg-short" : "Q/A",
  "factor-bypasscode-msg-short" : "BYPASS",

  "factor-sms-desc" : "SMS til mobil",
  "factor-email-desc" : "Send en epost med koden",
  "factor-push-desc" : "Oracle Authenticator App",
  "factor-totp-desc" : "Tidsbasert engangs-passord",
  "factor-security_questions-desc" : "Sikkerhets-spørsmål og svar",
  "factor-bypasscode-desc" : "Bruk en reservekode dersom du ikke kan bruke en annen metode",

  // OTP Enrollment form
  "enroll-otp-hdr" : "Registering av engangs-passord sikring via epost",
  "enroll-otp-info-msg" : "Vennligst angi engangs-kode sendt til ",
  "enroll-otp-fld" : "Engangs-kode",
  "enroll-otp-submit-btn" : "Registrer",

  // SMS Enrollment form
  "enroll-sms-hdr" : "Registrering av engangs-passord via SMS",
  "enroll-sms-info-msg" : "Vennligst angi mobil for å sende SMS til",
  "enroll-sms-fld" : "Mobil",
  "enroll-sms-submit-btn" : "Registrer",

  // Security Questions Enrollment form
  "enroll-qa-hdr" : "Registering av sikkerhets-spørsmål",
  "enroll-qa-info-msg" : "Gi et svar for hvert av spørsmålene",
  "enroll-qa-answer-fld" : "Svar",
  "enroll-qa-hint-fld" : "Hint",
  "enroll-qa-submit-btn" : "Registrer",
  "enroll-qa-error-sameq-twice-msg" : "Samme sikkerhets-spørsmål er valgt to ganger. vennligst velg et annet spørsmål.",

  // TOTP Enrollment form
  "enroll-totp-hdr" : "Registering av tidsbasert engangs-passord",
  "enroll-totp-scan-msg" : "Skann QR-koden med Oracle Mobile Authenticator appen.",
  "enroll-totp-respond-msg": "Deretter angi koden du ser på telefonens skjerm i feltet nedenfor.",
  "enroll-totp-fld" : "Tidsbasert engangs-kode",
  "enroll-totp-submit-btn" : "Registrer",

  // Push Enrollment form
  "enroll-push-hdr" : "registering av push-varsler",
  "enroll-push-scan-msg" : "Skann QR-koden med Oracle Authenticator appen",

  "enroll-taplink-msg": "Trykke for a reistrere din telefon.",

  // Bypass code form
  "bypass-hdr" : "Nød-kode",
  "bypass-info-msg" : "Angi din nød-kode",
  "bypass-fld" : "Nød-kode",
  "bypass-submit-btn" : "Bekreft",

  // Backup
  "backup-btn" : "Bruk en alternativ autentiserings-metode",
  "backup-msg" : "Velg en alternativ autentiserings-medode:",

  // Resend code
  "email-did-not-get-msg" : "Har du ikke mottatt eposten?",
  "email-resend-btn" : "Send epost på nytt",
  "sms-did-not-get-msg" : "Har du ikke mottatt SMS?",
  "sms-resend-btn" : "Send SMS på nytt",

  // Forgot password
  "forgot-pw-btn" : "Glemt passord?",
  "forgot-pw-hdr" : "Glemt passord?",
  "forgot-pw-info-msg" : "Vennligst angi brukernavn for å få nytt passord.",
  "forgot-pw-fld" : "Brukernavn",
  "forgot-pw-submit-btn" : "Bekreft",
  "forgot-pw-success-info-msg" : "Epost for nytt passord sendt til brukernavn ",
  "forgot-pw-ok-btn": "Ok",
  "forgot-pw-did-not-get-msg": "Har ikke mottat eposten enda?",
  "forgot-pw-resend-btn": "Send eposten på nytt",
  "forgot-pw-incorrect-username-msg": "Ugyldig brukernavn?",
  "forgot-pw-incorrect-username-btn": "Justere brukernavn",

  "reset-pw-hdr" : "Nytt passord",
  "reset-pw-info-msg" : "Vennligst angi og bekreft nytt passord.",
  "reset-pw-fld" : "Passord",
  "reset-pw-confirm-fld" : "Bekreft passord",
  "reset-pw-submit-btn" : "Bekreft",
  "reset-pw-success-info-msg" : "Passordet ditt er endret.",
  "reset-pw-windows-close-msg" : "Du kan lukke dette vinduet.",
  "reset-pw-ok-btn": "Ok",
  "reset-pw-nomatch-msg" : "Passordene er ikke like! Vennligst prøv på nytt.",

  //Self RegistrationProfiles
  "signup-chooseprofile": "Velg en selv-registrerings profile",
  "signup-hdr": "Kom ombord!",
  "signup-noprofile": "Ingen registrerings-profil tilgjengelig",
  "signup-btn": "Meld deg på",
  "signup-btndone": "Ferdig",
  "signup-btnok": "Ok",
  "signup-passwordmatch": "Passordene er ikke like",
  "signup-consent": "Jeg aksepterer",
  "signup-hello-msg": "Hallo",
  "signup-reg-success-msg": ". Din registrering var vellykket. Du vil motta en bekreftelses-spost snart...",
  "signup-reg-complete-msg": "Selv-registering er fullført.<BR/>.Du kan lukke dette vinduet.",

  // Terms of use
  "must-accept-terms": "Du må godta vilkårene for bruk å fortsœtte",

  // Preferred Factor
  "preferredFactor-msg" : "Sett denne metode som foretrukket",

  // Misc
  "loading-msg" : "Laster...",
  "or-msg" : "eller",
  "back-to-login-msg" : "tilbake til pålogging",

  // Errors
  "error-required-fld" : "Obligatorisk felt er tomt",
  "error-AUTH-1120" : "Ugyldig tilstand. Vennligst start pålogging på nytt.",
  "error-SDK-AUTH-9000" : "Initialisering feilet: Ingen access token. Vennligst kontakt din administrator.",
  "error-SDK-AUTH-9001" : "Initialisering feilet: Ingen start-tilstand",
  "error-SDK-AUTH-9010" : "En uventet feil oppsto. Vennligst kontakt din administrator.",
  "error-SDK-AUTH-9011" : "En uventet feil oppsto. Vennligst kontakt din administrator.",
  "error-SDK-AUTH-9020" : "Nytt passord feilet. Din lenke for nytt passord kan ha utløpt.",
  "error-SDK-AUTH-9021" : "Valgt passord er i konflikt med en elelr flere regler:",
  "error-SDK-AUTH-9999" : "Intern systemfeil: ugyldig data. Vennligst kontakt din administrator.",

  "error-SSO-1002" : "Brukeren er låst i Oracle Identity Cloud Service. Du kan en bruke \"Glemt passord?\" eller kontakt din administrator for å låse opp.",
  "error-SSO-1003" : "Brukeren er låst i Oracle Identity Cloud Service. Vennligst kontakt din administrator."

}

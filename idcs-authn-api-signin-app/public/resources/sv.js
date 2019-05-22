const resources = {
  "signin-page-title": "Inloggning",

  // Side bar
  "bar-signin-btn" : "Logga in",
  "bar-signup-btn" : "Registrera nytt konto",
  "bar-signin-hdr" : "Välj",
  "bar-signup-hdr" : "Saknar konto?",
  "bar-signin-subhdr" : "Logga in",

  // Signin form
  "signin-hdr" : "Välkommen",
  "signin-username-fld" : "Användarnamn",
  "signin-password-fld" : "Lösenord",
  "signin-submit-btn" : "Logga in",
  "signin-forgot-password-btn" : "Glömt lösenord?",

  // OTP form
  "otp-hdr" : "Verifiera kod",
  "otp-info-msg" : "Ange kod skickat till ",
  "otp-fld" : "kod",
  "otp-submit-btn" : "Verifiera",

  // TOTP form
  "totp-hdr" : "Verifiera tidsbegränsad kod",
  "totp-info-msg" : "Ange tidsbegränsad kod ",
  "totp-submit-btn" : "Verifiera",

  // Push form
  "push-hdr" : "Verifiera Notifiering",
  "push-info-msg" : "Notifiering skickad till Oracle Mobile Authenticator applikation på:",
  "push-info-nodisplayname-msg" : "Notifiering skickad till Oracle Mobile Authenticator applikation.",
  "push-approve-info-msg" : "Du måste acceptera för att gå vidare",

  // Trusted device
  "td-msg" : "Lita på den här enheten i ",
  "td-days-msg" : "dagar",

  // Social
  "social-user-not-registered-msg" : "Användaren ej registrerad i IDCS. Var vänlig klicka här för att registrera.",
  "social-email-fld": "Epost",
  "social-givenName-fld": "Förnamn",
  "social-familyName-fld": "Efternamn",
  "social-mobileNo-fld": "Mobilnummer",
  "social-phoneNo-fld": "Telefonnummer",
  "social-socialRegisterUser-hdr":"Social Registration",
  "social-cancel-btn": "Avbryt",

  // Security Questions form
  "qa-hdr" : "Verifierar säkerhetsfrågorna",
  "qa-info-msg" : "Ange dina svar",
  "qa-submit-btn" : "Bekräfta",

  // Enrollment Init
  "enroll-hdr" : "Aktivera tvåfaktorsautentisering",
  "enroll-subhdr" : "Välj metod",
  "enroll-skip-msg" : "Avbryt",
  "enroll-switch-msg" : "Byt metod",

  // Enrollment Success
  "enroll-success-hdr" : "Tvåfaktorsautentisering har konfigurerats.",
  "enroll-success-btn" : "Klart",
  "enroll-anotherfactor-btn" : "Byt metod",

  "factor-sms-btn" : "Kod via SMS",
  "factor-email-btn" : "Kod via epost",
  "factor-push-btn" : "Notifieringar",
  "factor-totp-btn" : "Tidsbegränsad kod",
  "factor-security_questions-btn" : "Säkerhetsfrågor",
  "factor-bypasscode-btn" : "Förbigångskod",

  "factor-sms-msg" : "SMS till mobilnummer",
  "factor-email-msg" : "Skicka epost med kod att använda",
  "factor-push-msg" : "Oracle Authenticator App",
  "factor-totp-msg" : "Tidsbegränsad kod",
  "factor-security_questions-msg" : "Säkerhetsfrågor och svar",
  "factor-bypasscode-msg" : "Engångskod för att kringgå Tvåfaktorsautentisering",

  "factor-sms-msg-short" : "SMS",
  "factor-email-msg-short" : "Epost",
  "factor-push-msg-short" : "PUSH",
  "factor-totp-msg-short" : "TOTP",
  "factor-security_questions-msg-short" : "Q/A",
  "factor-bypasscode-msg-short" : "BYPASS",

  "factor-sms-desc" : "SMS till mobilnummer",
  "factor-email-desc" : "Skicka epost med kod att använda",
  "factor-push-desc" : "Oracle Authenticator App",
  "factor-totp-desc" : "Tidsbegränsad kod",
  "factor-security_questions-desc" : "Säkerhetsfrågor och svar",
  "factor-bypasscode-desc" : "Kod för att kringgå Tvåfaktorsautentisering",

  // OTP Enrollment form
  "enroll-otp-hdr" : "Anmälan för kod via epost  ",
  "enroll-otp-info-msg" : "Ange kod skickat till ",
  "enroll-otp-fld" : "Kod",
  "enroll-otp-submit-btn" : "Bekräfta",

  // SMS Enrollment form
  "enroll-sms-hdr" : "Anmälan för kod via SMS",
  "enroll-sms-info-msg" : "Ange mobilnummer för SMS",
  "enroll-sms-fld" : "Mobilnummer",
  "enroll-sms-submit-btn" : "Bekräfta",

  // Security Questions Enrollment form
  "enroll-qa-hdr" : "Anmälan för säkerhetsfrågor",
  "enroll-qa-info-msg" : "Ange giltigt svar för varje fråga",
  "enroll-qa-answer-fld" : "Svar",
  "enroll-qa-hint-fld" : "Tips",
  "enroll-qa-submit-btn" : "Bekräfta",
  "enroll-qa-error-sameq-twice-msg" : "Frågan redan registrerad. Var vänlig ange en annan fråga.",

  // TOTP Enrollment form
  "enroll-totp-hdr" : "Registrering för tidsbaserad kod",
  "enroll-totp-scan-msg" : "Skanna QR-koden med Oracle Mobile Authenticator App.",
  "enroll-totp-respond-msg": "Ange koden som visas i Oracle Mobile Authenticator App.",
  "enroll-totp-fld" : "Tidsbaserad kod",
  "enroll-totp-submit-btn" : "Bekräfta",

  // Push Enrollment form
  "enroll-push-hdr" : "Aktivera notifieringar",
  "enroll-push-scan-msg" : "Skanna QR-koden med Oracle Mobile Authenticator App.",

  "enroll-taplink-msg": "Klicka för att registrera din telefon.",

  // Bypass code form
  "bypass-hdr" : "Kod för att kringgå",
  "bypass-info-msg" : "Ange kod för att kringgå",
  "bypass-fld" : "Kod för att kringgå",
  "bypass-submit-btn" : "Bekräfta",

  // Backup
  "backup-btn" : "Alternativ metod för inloggning",
  "backup-msg" : "Välj metod:",

  // Resend code
  "email-did-not-get-msg" : "Ingen epost?",
  "email-resend-btn" : "Skicka om epost",
  "sms-did-not-get-msg" : "Inget SMS?",
  "sms-resend-btn" : "Skicka om SMS",

  // Forgot password
  "forgot-pw-btn" : "Glömt lösenord?",
  "forgot-pw-hdr" : "Glömt lösenord?",
  "forgot-pw-info-msg" : "Ange användarnamn för att återställa lösenord.",
  "forgot-pw-fld" : "Användarnamn",
  "forgot-pw-submit-btn" : "Bekräfta",
  "forgot-pw-success-info-msg" : "Meddelande för återställning av kod skickat till angiven epostadress ",
  "forgot-pw-ok-btn": "Ok",
  "forgot-pw-did-not-get-msg": "Inget neddelande?",
  "forgot-pw-resend-btn": "Skicka om meddelande",
  "forgot-pw-incorrect-username-msg": "Felaktigt användarnamn?",
  "forgot-pw-incorrect-username-btn": "Korrigera användarnamnet",

  "reset-pw-hdr" : "Återställ lösenord",
  "reset-pw-info-msg" : "Vänligen fyll i och bekräfta lösenord.",
  "reset-pw-fld" : "Lösenord",
  "reset-pw-confirm-fld" : "Bekräfta lösenordet",
  "reset-pw-submit-btn" : "Spara",
  "reset-pw-success-info-msg" : "Your password has been successfully reset.",
  "reset-pw-windows-close-msg" : "Den här sidan kan avslutas.",
  "reset-pw-ok-btn": "Ok",
  "reset-pw-nomatch-msg" : "Lösenorden är olika! Korrigera.",

  //Self RegistrationProfiles
  "signup-chooseprofile": "Välj profil",
  "signup-hdr": "Självregistrering!",
  "signup-noprofile": "Ingen profil tillgänglig",
  "signup-btn": "Registrera",
  "signup-btndone": "Klart",
  "signup-btnok": "Ok",
  "signup-passwordmatch": "Lösenord är olika",
  "signup-consent": "Jag accepterar",
  "signup-hello-msg": "Hej, ",
  "signup-reg-success-msg": "Din registrering lyckades. Bekräftelse är skickad till angiven epostadress...",
  "signup-reg-complete-msg": "Registrering klar.<BR/>Sidan kan stängas.",

  // Terms of use
  "must-accept-terms": "Du måste acceptera användarvillkoren för att fortsätta",

  // Preferred Factor
  "preferredFactor-msg" : "Prefererad metod",

  // Misc
  "loading-msg" : "Laddar...",
  "or-msg" : "eller",
  "back-to-login-msg" : "Tillbaks till inloggning",

  // Errors
  "error-required-fld" : "Obligatoriskt fält tomt",
  "error-AUTH-1120" : "Något gick fel. Start om från början.",
  "error-SDK-AUTH-9000" : "Inloggning misslyckades: Inget access token. Vänligen kontakta systemadministratören.",
  "error-SDK-AUTH-9001" : "Inloggning misslyckades: no initial state. Vänligen kontakta systemadministratören.",
  "error-SDK-AUTH-9010" : "Oväntat fel inträffade. Vänligen kontakta administratör.",
  "error-SDK-AUTH-9011" : "Oväntat fel inträffade. Vänligen kontakta administratör.",
  "error-SDK-AUTH-9020" : "Återställning av lösenord misslyckades. Länken för återställning för gammal.",
  "error-SDK-AUTH-9021" : "Valt lösenord uppfyller inte kriterier:",
  "error-SDK-AUTH-9999" : "Internt systemfel: ogiltigt data. Vänligen kontakta administratör.",

  "error-SSO-1002" : "Användarkonto låst i Oracle Identity Cloud Service. Använd funktionen \"Glömt lösenord?\" eller kontakta systemadministratören för att låsa upp kontot.",
  "error-SSO-1003" : "Användaren ej längre aktiv i Oracle Identity Cloud Service. Vänligen kontakta systemadministratören."

}

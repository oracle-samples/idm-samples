const resources = {
  "signin-page-title": "Anmeldung",

  // Side bar
  "bar-signin-btn" : "Anmelden",
  "bar-signup-btn" : "Registrieren",
  "bar-signin-hdr" : "Einer von uns?",
  "bar-signup-hdr" : "Noch nicht registriert?",
  "bar-signin-subhdr" : "Dann einfach anmelden",

  // Signin form
  "signin-hdr" : "Willkommen",
  "signin-username-fld" : "Benutzername",
  "signin-password-fld" : "Passwort",
  "signin-submit-btn" : "Anmelden",
  "signin-forgot-password-btn" : "Passwort vergessen?",

  // OTP form
  "otp-hdr" : "Einmal-Passwort angeben",
  "otp-info-msg" : "Bitte geben Sie das gesendete Einmal-Passwort ein. E-Mail wurde geschickt an ",
  "otp-fld" : "Einmal-Passwort Code",
  "otp-submit-btn" : "Überprüfen",

  // TOTP form
  "totp-hdr" : "Zeit-basiertes Einmal-Passwort angeben",
  "totp-info-msg" : "Bitte geben Sie das zeit-basierte Einmal-Passwort ein. Es wird angezeigt in ",
  "totp-submit-btn" : "Überprüfen",

  // Push form
  "push-hdr" : "Push-Benachrichtigung angeben",
  "push-info-msg" : "Eine Benachrichtigung wurde an die authenticator app auf dieses mobile Gerät geschickt:",
  "push-info-nodisplayname-msg" : "Eine Benachrichtigung wurde an die authenticator app auf Ihrem mobilem Gerät geschickt.",
  "push-approve-info-msg" : "Um fortzufahren müssen Sie diese bestätigen.",

  // Trusted device
  "td-msg" : "Diesem Gerät für",
  "td-days-msg" : "Tage vertrauen",

  // Social
  "social-user-not-registered-msg" : "Benutzer ist nicht in IDCS registriert. Bitte hier registrieren.",
  "social-email-fld": "E-Mail",
  "social-givenName-fld": "Vorname",
  "social-familyName-fld": "Nachname",
  "social-mobileNo-fld": "Mobilnummer",
  "social-phoneNo-fld": "Telefonnummer",
  "social-socialRegisterUser-hdr":"Anmelden über ein Soziales Netzwerk",
  "social-cancel-btn": "Abbrechen",

  // Security Questions form
  "qa-hdr" : "Beantworten Sie Ihre Sicherheitsfragen:",
  "qa-info-msg" : "Bitte beantworten Sie die Fragen.",
  "qa-submit-btn" : "Überprüfen",

  // Enrollment Init
  "enroll-hdr" : "Eine weitere Authentifizierung ist erforderlich!",
  "enroll-subhdr" : "Wählen Sie eine Methode",
  "enroll-skip-msg" : "Freischaltung überspringen",
  "enroll-switch-msg" : "Wählen Sie einen anderen zweiten Stufe",

  // Enrollment Success
  "enroll-success-hdr" : "Zweite Stufe der Überprüfung war erfolgreich und Benutzer ist aktiviert.",
  "enroll-success-btn" : "Erledigt",
  "enroll-anotherfactor-btn" : "Eine andere Überprüfung wählen",

  "factor-sms-btn" : "Einmal-Passwort als SMS",
  "factor-email-btn" : "Einmal-Passwort als E-Mail",
  "factor-push-btn" : "Push-Nachricht",
  "factor-totp-btn" : "Zeit-basiertes Einmal-Passwort",
  "factor-security_questions-btn" : "Sicherheitsfragen",
  "factor-bypasscode-btn" : "Bypass-Code",

  "factor-sms-msg" : "Einmal-Code an Ihre Mobilnummer senden",
  "factor-email-msg" : "Einmal-Code als E-Mail senden",
  "factor-push-msg" : "Eine Benachrichtigung an die Authenticator App senden",
  "factor-totp-msg" : "Von der Authenticator App erzeugten Code verwenden",
  "factor-security_questions-msg" : "Sicherheitsfragen beantworten",
  "factor-bypasscode-msg" : "Benutzen Sie den Notfall-Code wenn Sie keine andere Möglichkeit verwenden können",

  "factor-sms-msg-short" : "SMS",
  "factor-email-msg-short" : "EMAIL",
  "factor-push-msg-short" : "PUSH",
  "factor-totp-msg-short" : "APP",
  "factor-security_questions-msg-short" : "F & A",
  "factor-bypasscode-msg-short" : "BYPASS",

  "factor-sms-desc" : "SMS an eine Mobilnummer senden",
  "factor-email-desc" : "Einmal-Passwort per E-Mail erhalten",
  "factor-push-desc" : "Eine Nachricht an die Oracle Authenticator App senden",
  "factor-totp-desc" : "Zeit-basiertes Einmal-Passwort",
  "factor-security_questions-desc" : "Sicherheitsfragen und -antworten",
  "factor-bypasscode-desc" : "Verwenden Sie den Bypass-Code da eine andere Stufe nicht möglich ist.",

  // OTP Enrollment form
  "enroll-otp-hdr" : "Einmal-Passwort aus einer E-Mail angeben",
  "enroll-otp-info-msg" : "Geben Sie das Einmal-Passwort ein. E-Mail wurde geschickt an ",
  "enroll-otp-fld" : "Einmal-Passwort",
  "enroll-otp-submit-btn" : "Überprüfen",

  // SMS Enrollment form
  "enroll-sms-hdr" : "Einmal-Passwort aus einer SMS angeben",
  "enroll-sms-info-msg" : "Eine SMS an diese Mobilnummer senden.",
  "enroll-sms-fld" : "Mobilnummer",
  "enroll-sms-submit-btn" : "Überprüfen",

  // Security Questions Enrollment form
  "enroll-qa-hdr" : "Sicherheitsfragen eingeben",
  "enroll-qa-info-msg" : "Geben Sie für jede Frage eine persönliche Antwort ein:",
  "enroll-qa-answer-fld" : "Antwort",
  "enroll-qa-hint-fld" : "Merkhilfe",
  "enroll-qa-submit-btn" : "Überprüfen",
  "enroll-qa-error-sameq-twice-msg" : "Dieselbe Sicheheitsfrage wurde mehrmals gewählt. Bitte wählen Sie eine andere Frage.",

  // TOTP Enrollment form
  "enroll-totp-hdr" : "Zeit-basiertes Einmal-Passwort angeben.",
  "enroll-totp-scan-msg" : "Scannen Sie den QR-Code mit der Oracle Mobile Authenticator App.",
  "enroll-totp-respond-msg": "Geben Sie dann den Code, den Sie auf Ihrem Gerät sehen, in das Feld unten ein.",
  "enroll-totp-fld" : "Wert des zeit-basierten Einmal-Passworts",
  "enroll-totp-submit-btn" : "Überprüfen",

  // Push Enrollment form
  "enroll-push-hdr" : "Push-Nachricht eingeben",
  "enroll-push-scan-msg" : "Scannen Sie den QR-Code mit der Oracle Mobile Authenticator App.",

  "enroll-taplink-msg": "Bestätigen Sie um Ihr Gerät zu registrieren.",

  // Bypass code form
  "bypass-hdr" : "Bypass-Code",
  "bypass-info-msg" : "Geben Sie ihren Bypass-Code an",
  "bypass-fld" : "Bypass-Code",
  "bypass-submit-btn" : "Bestätigen",

  // Backup
  "backup-btn" : "Eine andere Authentifizierungsmethode verwenden",
  "backup-msg" : "Wählen Sie eine alternative Authenfizierungsmethode:",

  // Resend code
  "email-did-not-get-msg" : "Haben Sie die E-Mail erhalten?",
  "email-resend-btn" : "E-Mail nochmals senden",
  "sms-did-not-get-msg" : "Haben Sie die SMS erhalten?",
  "sms-resend-btn" : "SMS nochmals senden",

  // Forgot password
  "forgot-pw-btn" : "Passwort vergessen?",
  "forgot-pw-hdr" : "Passwort vergessen?",
  "forgot-pw-info-msg" : "Um das Passwort zurückzusetzen, geben Sie bitte ihren Benutzernamen an.",
  "forgot-pw-fld" : "Benutzername",
  "forgot-pw-submit-btn" : "Bestätigen",
  "forgot-pw-success-info-msg" : "Die E-Mail zum Passwort-Reset wurde an den Benutzer geschickt ",
  "forgot-pw-ok-btn": "OK",
  "forgot-pw-did-not-get-msg": "Haben Sie die E-Mail erhalten?",
  "forgot-pw-resend-btn": "E-Mail neu senden",
  "forgot-pw-incorrect-username-msg": "Falscher Benutzername?",
  "forgot-pw-incorrect-username-btn": "Korrigieren Sie den Benutzernamen",

  "reset-pw-hdr" : "Passwort zurücksetzen",
  "reset-pw-info-msg" : "Bitte geben Sie das Passwort zweimal ein.",
  "reset-pw-fld" : "Passwort",
  "reset-pw-confirm-fld" : "Passwort bestätigen",
  "reset-pw-submit-btn" : "Bestätigen",
  "reset-pw-success-info-msg" : "Ihr Passwort wurde erfolgreich geändert.",
  "reset-pw-windows-close-msg" : "\nSie können dieses Fenster schließen.",
  "reset-pw-ok-btn": "OK",
  "reset-pw-nomatch-msg" : "Sie haben unterschiedliche Passwort angegeben! Bitte korrigieren.",

  //Self RegistrationProfiles
  "signup-chooseprofile": "Wählen Sie ein Profil für die Registrierung",
  "signup-hdr": "Steigen Sie ein!",
  "signup-noprofile": "Keine Registrierung vorhanden",
  "signup-btn": "Registrieren",
  "signup-btndone": "ERLEDIGT",
  "signup-btnok": "OK",
  "signup-passwordmatch": "Sie haben unterschiedliche Passwort angegeben!",
  "signup-consent": "Stimme zu",
  "signup-hello-msg": "Hallo, ",
  "signup-reg-success-msg": "Ihre Registrierung war erfolgreich. Sie sollten in Kürze eine Bestätigung per E-Mail erhalten...",
  "signup-reg-complete-msg": "Die Registrierung ist abgeschlossen.<BR/>Sie können das Fenster jetzt schließen.",

  // Terms of use
  "must-accept-terms": "Um fortzufahren müssen Sie die Benutzerregeln akzeptieren",

  // Preferred Factor
  "preferredFactor-msg" : "Setzen Sie diesen Faktor als bevorzugten Faktor",

  // Misc
  "loading-msg" : "Lädt...",
  "or-msg" : "oder",
  "back-to-login-msg" : "Zurück zur Anmeldung",

  // Errors
  "error-required-fld" : "Erforderlicher Wert nicht angegeben",
  "error-AUTH-1120" : "Ungültiger Status. Bitte beginnen Sie von vorn.",
  "error-SDK-AUTH-9000" : "Initialisierung fehlgeschlagen: Kein Zugangs-Token. Bitte verständigen Sie den Administrator.",
  "error-SDK-AUTH-9001" : "Initialisierung fehlgeschlagen: Kein gültiger Status. Bitte verständigen Sie den Administrator.",
  "error-SDK-AUTH-9010" : "Ein unerwarteter Fehler ist aufgetreten. Bitte verständigen Sie den Administrator.",
  "error-SDK-AUTH-9011" : "Ein unerwarteter Fehler ist aufgetreten. Bitte verständigen Sie den Administrator.",
  "error-SDK-AUTH-9020" : "Passwort-Reset fehlgeschlagen. Ihr Link ist ungültig.",
  "error-SDK-AUTH-9021" : "Das gewählte Passwort erfüllt eine dieser Anforderungen nicht:",
  "error-SDK-AUTH-9999" : "System Fehler: Ungültige Daten. Bitte verständige Sie den Administrator.",

  "error-SSO-1002" : "Der Benutzer ist in IDCS gesperrt. Bitte entsperren Sie den Benutzer durch die Anmeldung über ein Soziales Netzwerk.",
  "error-SSO-1003" : "Der Benutzer ist in IDCS deaktiviert. Bitte melden Sie sich über ein Soziales Netzwerk an."

}

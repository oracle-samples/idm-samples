const resources = {
  "signin-page-title": "Log på",

  // Side bar
  "bar-signin-btn" : "Log på",
  "bar-signup-btn" : "Tilmeld dig",
  "bar-signin-hdr" : "En af os?",
  "bar-signin-subhdr" : "Bare log på",
  "bar-signup-hdr" : "Ingen konto?",


  // Signin form
  "signin-hdr" : "Velkommen",
  "signin-username-fld" : "Brugernavn",
  "signin-password-fld" : "Password",
  "signin-submit-btn" : "Login",
  "signin-forgot-password-btn" : "Glemt Password?",

  // OTP form
  "otp-hdr" : "Verificering af engangskode",
  "otp-info-msg" : "Venligst angiv engangskoden som blev sendt til ",
  "otp-fld" : "Engangskode",
  "otp-submit-btn" : "Godkend",

  // TOTP form
  "totp-hdr" : "Verificering af tidsbegrœnset engangskode",
  "totp-info-msg" : "Indtast tidsbegrœnset engangskode som vist på ",
  "totp-submit-btn" : "Godkend",

// Push form
  "push-hdr" : "Verifikation af Push Notifikation",
  "push-info-msg" : "En notifikation er blevet sendt til authenticator appen på din mobile enhed.",
  "push-info-nodisplayname-msg" : "En notifikation er blevet sendt til authenticator appen på følgende mobile enhed.",
  "push-approve-info-msg" : "Venligst godkend den for at fortsœtte.",


  // Trusted device
  "td-msg" : "Stol på denne enhed i ",
  "td-days-msg" : "dage",

  // Social
  "social-user-not-registered-msg" : "Bruger kontoen findes ikke i IDCS. Klick her for a oprette en konto.",
  "social-email-fld": "Email",
  "social-givenName-fld": "Fornavn",
  "social-familyName-fld": "Efternavn",
  "social-mobileNo-fld": "Mobil Nr.",
  "social-phoneNo-fld": "Tlf Nr.",
  "social-socialRegisterUser-hdr":"Social Registrering",
  "social-cancel-btn": "Fortryd",


  // Security Questions form
  "qa-hdr" : "Besvar sikkerheds spørgsmål:",
  "qa-info-msg" : "Venligst indtast svaret",
  "qa-submit-btn" : "Godkend",

  // Enrollment Init
  "enroll-hdr" : "Slå totrinsbekræftelse til",
  "enroll-subhdr" : "Vœlg sikkerhedsfaktor",
  "enroll-skip-msg" : "Spring sikkerhedsfaktor registrering over",
  "enroll-switch-msg" : "Skift faktor for at registrere dig",

  // Enrollment Success
  "enroll-success-hdr" : "Totrinsbekræftelse er blevet slået til.",
  "enroll-success-btn" : "Afslut",
  "enroll-anotherfactor-btn" : "Tilføj flere",

  "factor-sms-btn" : "Engangskode via SMS",
  "factor-email-btn" : "Engangskode via EMail",
  "factor-push-btn" : "Push",
  "factor-totp-btn" : "Tidsbaseret Engangskode",
  "factor-security_questions-btn" : "Sikkerheds spørgsmål",
  "factor-bypasscode-btn" : "Bypass kode",

  "factor-sms-msg" : "Send en kode til Mobile nr.",
  "factor-email-msg" : "Send en kode til Email",
  "factor-push-msg" : "Send en besked til Authenticator Mobil Appen på",
  "factor-totp-msg" : "Brug koden fra Authenticator Mobil Appen på",
  "factor-security_questions-msg" : "Besvar sikkerheds spørgsmålene",
  "factor-bypasscode-msg" : "Brug en Bypass kode hvis de andre faktorer ikke kan bruges",

  "factor-sms-msg-short" : "SMS",
  "factor-email-msg-short" : "EMAIL",
  "factor-push-msg-short" : "PUSH",
  "factor-totp-msg-short" : "TOTP",
  "factor-security_questions-msg-short" : "Q/A",
  "factor-bypasscode-msg-short" : "BYPASS",

  "factor-sms-desc" : "Sender Engangskode til din mobil",
  "factor-email-desc" : "Sender en Email med en kode",
  "factor-push-desc" : "Sender en besked til Authenticator Mobil Appen",
  "factor-totp-desc" : "Tids-baseret engangskode via Authenticator Mobil Appen",
  "factor-security_questions-desc" : "Sikkerheds spørgsmål og svar",
  "factor-bypasscode-desc" : "Brug en Bypass kode hvis de andre faktorer ikke kan bruges",

  // OTP Enrollment form
  "enroll-otp-hdr" : "Tilmeld engangskode via Email ",
   "enroll-otp-info-msg" : "Angiv engangskode sendt til ",
  "enroll-otp-fld" : "Engangskode",
  "enroll-otp-submit-btn" : "Tilmeld",


  // SMS Enrollment form
  "enroll-sms-hdr" : "Tilmeld engangskode via SMS",
  "enroll-sms-info-msg" : "Venligst angiv mobil nummer som kan modtage SMS beskeden",
  "enroll-sms-fld" : "Mobile Nummer",
  "enroll-sms-submit-btn" : "Tilmeld",

  // Security Questions Enrollment form
  "enroll-qa-hdr" : "Tilmeld Sikkerheds spørgsmål",
  "enroll-qa-info-msg" : "Angiv et svar til hvert spørgsmål",
  "enroll-qa-answer-fld" : "Svar",
  "enroll-qa-hint-fld" : "Hint",
  "enroll-qa-submit-btn" : "Tilmeld",
  "enroll-qa-error-sameq-twice-msg" : "Der er valgt to ens spørgsmål. Venligst vœlg et andet.",

  // TOTP Enrollment form
  "enroll-totp-hdr" : "Tilmeld tidsbaseret endgangskode",
  "enroll-totp-scan-msg" : "Scan QR koden med Oracle Mobile Authenticator Appen.",
  "enroll-totp-respond-msg": "Indtast koden fra mobilen i feltet nedenunder",
  "enroll-totp-fld" : "Engangskode",
  "enroll-totp-submit-btn" : "Tilmeld",

  // Push Enrollment form
  "enroll-push-hdr" : "Tilmeld Push Notifikationer",
  "enroll-push-scan-msg" : "Scan QR koden med Oracle Mobile Authenticator Appen.",
  "enroll-taplink-msg": "Tryk for at tilmelde din mobil.",

  // Bypass code form
  "bypass-hdr" : "Bypass kode",
  "bypass-info-msg" : "Angiv din Bypass kode",
  "bypass-fld" : "Bypass Kode",
  "bypass-submit-btn" : "Godkend",

  // Backup
  "backup-btn" : "Vœlg en alternativ",
  "backup-msg" : "Vœlg en alternativ godkendelses måde:",

  // Resend code
  "email-did-not-get-msg" : "Fik du ikke Emailen?",
  "email-resend-btn" : "Gensend Email",
  "sms-did-not-get-msg" : "Fik du ikke en SMS?",
  "sms-resend-btn" : "Gensend SMS",

 // Forgot password
  "forgot-pw-btn" : "Glemt Password?",
  "forgot-pw-hdr" : "Glemt Password?",
  "forgot-pw-info-msg" : "Angiv brugernavn for at skifte password.",
  "forgot-pw-fld" : "Brugernavn",
  "forgot-pw-submit-btn" : "Godkend",
  "forgot-pw-success-info-msg" : "Venligst tjek om du har fået en mail med et link til en Skifte Password side ",
  "forgot-pw-ok-btn": "Ok",
  "forgot-pw-did-not-get-msg": "Fik du ikke Emailen?",
  "forgot-pw-resend-btn": "Gensend Email",
  "forgot-pw-incorrect-username-msg": "Forkert brugernavn?",
  "forgot-pw-incorrect-username-btn": "Ret brugernavn",


  "reset-pw-hdr" : "Skift Password",
  "reset-pw-info-msg" : "Venligst udfyld felterne: Password og Bekrœft Password",
  "reset-pw-fld" : "Password",
  "reset-pw-confirm-fld" : "Bekrœft Password",
  "reset-pw-submit-btn" : "Godkend",
  "reset-pw-success-info-msg" : "Passwordet er blevet œndret.",
  "reset-pw-windows-close-msg" : "Venligst luk dette vindue.",
  "reset-pw-ok-btn": "Ok",
  "reset-pw-nomatch-msg" : "Password og Bekrœft Password vœrdierne er forskellige. Venligst prøv igen.",


 //Self RegistrationProfiles
  "signup-chooseprofile": "Vœlg en tilmeldings profil",
  "signup-hdr": "Bliv en del af holdet!",
  "signup-noprofile": "Der findes ingen tilmeldings profiler",
  "signup-btn": "Tilmeld dig",
  "signup-btndone": "Fœrdig",
  "signup-btnok": "Ok",
  "signup-passwordmatch": "Password og Bekrœft Password vœrdierne er forskellige",
  "signup-consent": "Jeg forstår",
  "signup-hello-msg": "Hej, ",
  "signup-reg-success-msg": "Din tilmedling er gennemført og du vil modtage en email snarest...",
  "signup-reg-complete-msg": "Tilmelding gennemført<BR/>Venligt luk dette vindue.",


 // Terms of use
  "must-accept-terms": "Du skal acceptere vilkår og betingelser før du kan fortsœtte",


  // Preferred Factor
  "preferredFactor-msg" : "Vœlg denne sikkerhedsfaktor som den fortrukne",


  // Misc
  "loading-msg" : "Indlœser...",
  "or-msg" : "eller",
  "back-to-login-msg" : "Tilbage til Login",

  // Errors

  "error-required-fld" : "Feltet skal vœre udfyldt",
  "error-AUTH-1120" : "Timeout. Venligst prøv at logge ind igen",
  "error-SDK-AUTH-9000" : "Fejl under opstart: no access token.",
  "error-SDK-AUTH-9001" : "Fejl under opstart: no initial state.",
  "error-SDK-AUTH-9010" : "Der er sket en uventet fejl.",
  "error-SDK-AUTH-9011" : "Der er sket en uventet fejl.",
  "error-SDK-AUTH-9020" : "Fejl ved Password Reset. Måske er dit Password Reset link udløbet.",
  "error-SDK-AUTH-9021" : "Det valgte Password overholder ikke følgende regler:",
  "error-AUTH-3001" : "Forkert brugernavn eller password.",
  "error-AUTH-3002" : "Brugeren er låst i Oracle Identity Cloud Service. Brug \"Glemt Password?\" linket eller kontakt administratoren.",
  "error-AUTH-3003" : "Brugeren er deaktiveret i Oracle Identity Cloud Service. Venligst kontakt administratoren.",
  "error-SSO-1002" : "Brugeren er låst i Oracle Identity Cloud Service. Brug \"Glemt Password?\" linket eller kontakt administratoren.",
  "error-SSO-1003" : "Brugeren er deaktiveret i Oracle Identity Cloud Service. Venligst kontakt administratoren.",
  "error-SDK-AUTH-9999" : "Intern System fejl: Forkert data. Venligst kontakt administratoren."

}

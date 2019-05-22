const resources = {
  "signin-page-title": "Connexion",

  // Side bar
  "bar-signin-btn" : "Se Connecter",
  "bar-signup-btn" : "S'inscrire",
  "bar-signin-hdr" : "Un des notres?",
  "bar-signup-hdr" : "Vous n'avez pas encore de compte?",
  "bar-signin-subhdr" : "Identifiez-vous",

  // Signin form
  "signin-hdr" : "Bienvenue",
  "signin-username-fld" : "Identifiant",
  "signin-password-fld" : "Mot de passe",
  "signin-submit-btn" : "Valider",
  "signin-forgot-password-btn" : "Mot de passe oublié?",

  // OTP form
  "otp-hdr" : "Validation du mot de passe usage unique",
  "otp-info-msg" : "Veuillez saisir le mot de passe usage unique envoyé à ",
  "otp-fld" : "Mot de passe usage unique",
  "otp-submit-btn" : "Valider",

  // TOTP form
  "totp-hdr" : "Validation du mot de passe temporaire à usage unique ",
  "totp-info-msg" : "Veuilez saisir le mot de passe temporaire à usage unique affiché dans ",
  "totp-submit-btn" : "Valider",

  // Push form
  "push-hdr" : "Validation de la Notification Push",
  "push-info-msg" : "Une notification a été envoyée à l'application Oracle Mobile Authenticator sur votre appareil portable.",
  "push-approve-info-msg" : "Vous devez l'approuver pour pouvoir continuer.",

  // Trusted device
  "td-msg" : "Faire confiance a cet appareil pour ",
  "td-days-msg" : "jours",

  // Social
  "social-user-not-registered-msg" : "L'utilisateur n'est pas enregistré dans IDCS. Veuillez cliquer ici pour vous enregistrer.",
  "social-email-fld": "Email",
  "social-givenName-fld": "Prénom",
  "social-familyName-fld": "Nom",
  "social-mobileNo-fld": "Numéro de téléphone portable",
  "social-phoneNo-fld": "Numéro de téléphone fixe",
  "social-socialRegisterUser-hdr":"Identifiant de réseau social",
  "social-cancel-btn": "Annuler",

  // Security Questions form
  "qa-hdr" : "Validation des questions de sécurité",
  "qa-info-msg" : "Veuillez répondre",
  "qa-submit-btn" : "Valider",

  // Enrollment Init
  "enroll-hdr" : "Autoriser l'identification deux facteurs ",
  "enroll-subhdr" : "Sélectionnez un facteur",
  "enroll-skip-msg" : "Annuler l'inscription",
  "enroll-switch-msg" : "Changer le facteur",

  // Enrollment Success
  "enroll-success-hdr" : "L'identification deux facteurs a bien été enregistrée.",
  "enroll-success-btn" : "Terminé",
  "enroll-anotherfactor-btn" : "Enregistrer un nouveau facteur",

  "factor-sms-msg" : "Envoyer un code au téléphone portable",
  "factor-email-msg" : "Envoyer un code par email",
  "factor-push-msg" : "Envoyer une notification à l'application Authenticator sur ",
  "factor-totp-msg" : "Utiliser le code généré par l'application Authenticator sur",
  "factor-security_questions-msg" : "Répondez aux questions de sécurité",
  "factor-bypasscode-msg" : "Utiliser un code de contournement si vous ne pouvez pas utiliser d'autre facteur",

  "factor-sms-msg-short" : "SMS",
  "factor-email-msg-short" : "EMAIL",
  "factor-push-msg-short" : "PUSH",
  "factor-totp-msg-short" : "TOTP",
  "factor-security_questions-msg-short" : "Q/R",
  "factor-bypasscode-msg-short" : "BY-PASS",

  "factor-sms-desc" : "SMS téléphone portable",
  "factor-email-desc" : "Envoyer un email avec le code utiliser",
  "factor-push-desc" : "Application Oracle Authenticator",
  "factor-totp-desc" : "OTP temporaire",
  "factor-security_questions-desc" : "Question et réponse de sécurité",
  "factor-bypasscode-desc" : "Utiliser un code de contournement si vous ne pouvez pas utiliser d'autre facteur ",

  // OTP Enrollment form
  "enroll-otp-hdr" : "Activer OTP par E-Mail ",
  "enroll-otp-info-msg" : "Veuillez saisir le code OTP envoyé à ",
  "enroll-otp-fld" : "Code OTP ",
  "enroll-otp-submit-btn" : "Activer",

  // SMS Enrollment form
  "enroll-sms-hdr" : "Activer OTP par SMS",
  "enroll-sms-info-msg" : "Veuillez saisir le numéro de telephone portable auquel envoyer le SMS",
  "enroll-sms-fld" : "Numéro de téléphone portable",
  "enroll-sms-submit-btn" : "Activer",

  // Security Questions Enrollment form
  "enroll-qa-hdr" : "Activer les questions de sécurité",
  "enroll-qa-info-msg" : "Saisissez une réponse pour chaque question sélectionnée",
  "enroll-qa-answer-fld" : "Réponse",
  "enroll-qa-hint-fld" : "Indice de mot de passe",
  "enroll-qa-submit-btn" : "Activer",
  "enroll-qa-error-sameq-twice-msg" : "La méme question de sécurité a été sélectionnée deux fois. Veuillez sélectionner une autre question.",

  // TOTP Enrollment form
  "enroll-totp-hdr" : "Activer un code OTP temporaire",
  "enroll-totp-scan-msg" : "Scannez le QR code avec l'application Oracle Mobile Authenticator.",
  "enroll-totp-respond-msg": "Ensuite, saisissez le code qui apparait sur votre téléphone dans le champ ci-dessous.",
  "enroll-totp-fld" : "Code OTP temporaire",
  "enroll-totp-submit-btn" : "Activer",

  // Push Enrollment form
  "enroll-push-hdr" : "Activer les Notifications Push",
  "enroll-push-scan-msg" : "Scannez le QR code avec l'application Oracle Mobile Authenticator.",
  "enroll-taplink-msg": "Tapez ici pour enregister votre téléphone",

  // Bypass code form
  "bypass-hdr" : "Code de contournement",
  "bypass-info-msg" : "Saisissez votre code de contournement",
  "bypass-fld" : "Code de contournement",
  "bypass-submit-btn" : "Valider",

  // Backup
  "backup-btn" : "Utiliser une autre méthode d'authentification",
  "backup-msg" : "Choisissez une autre méthode d'authentification:",

  // Resend code
  "email-did-not-get-msg" : "Vous n'avez pas reéu l'email?",
  "email-resend-btn" : "Renvoyer l'email",
  "sms-did-not-get-msg" : "Vous n'avez pas reéu de SMS?",
  "sms-resend-btn" : "Renvoyer le SMS",

  // Forgot password
  "forgot-pw-btn" : "Mot de passe oublié?",
  "forgot-pw-hdr" : "Mot de passe oublié?",
  "forgot-pw-info-msg" : "Veuillez entrer votre identifiant pour réinitialiser votre mot de passe.",
  "forgot-pw-fld" : "Identifiant",
  "forgot-pw-submit-btn" : "Valider",
  "forgot-pw-success-info-msg" : "L'email pour réinitialiser le mot de passe a été envoyé à ",
  "forgot-pw-ok-btn": "Ok",
  "forgot-pw-did-not-get-msg": "Vous n'avez pas encore reçu l'email?",
  "forgot-pw-resend-btn": "Renvoyer l'email ",
  "forgot-pw-incorrect-username-msg": "Identifiant incorrect",
  "forgot-pw-incorrect-username-btn": "Corriger l'identifiant ",

  "reset-pw-hdr" : "Réinitialiser le mot de passe",
  "reset-pw-info-msg" : "Veuillez saisir le mot de passe et le confirmer.",
  "reset-pw-fld" : "Mot de passe",
  "reset-pw-confirm-fld" : "Confirmation du mot de passe",
  "reset-pw-submit-btn" : "Valider",
  "reset-pw-success-info-msg" : "Votre mot de passe a été réinitialisé avec succés.",
  "reset-pw-windows-close-msg" : "Vous pouvez fermer cette fenétre.",
  "reset-pw-ok-btn": "Ok",
  "reset-pw-nomatch-msg" : "Le mot de passe et la confirmation sont différents. Veuillez rééssayer.",

  //Self RegistrationProfiles
  "signup-chooseprofile": "Veuillez choisir un profil d'auto-inscription ",
  "signup-hdr": "Montez a bord!",
  "signup-noprofile": "Pas de profil disponible",
  "signup-btn": "S'enregistrer",
  "signup-btndone": "TERMINé",
  "signup-btnok": "Ok",
  "signup-passwordmatch": "Le mot de passe et sa confirmation sont différents",
  "signup-consent": "J'approuve",
  "signup-hello-msg": "Bonjour, ",
  "signup-reg-success-msg": "Votre enregistrement est réussi. Vous devriez recevoir un email rapidement...",
  "signup-reg-complete-msg": "Auto-inscription réussie.<BR/>Vous pouvez fermer cette fenétre.",

  // Terms of use
  "must-accept-terms": "Vous devez accepter les conditions d'utilisation pour continuer",

  // Preferred Factor
  "preferredFactor-msg" : "Selectionner ce facteur comme préféré ",

  // Misc
  "loading-msg" : "Chargement en cours...",
  "or-msg" : "ou",
  "back-to-login-msg" :"Retour à la connexion",

  // Errors
  "error-required-fld" : "Champ obligatoire vide",
  "error-AUTH-1120" : "Etat invalid. Veuillez réinitialiser le processus de connexion.",
  "error-SDK-AUTH-9000" : "L'initialisation a échoué: pas d'accés au jeton. Veuillez contacter l'administrateur.",
  "error-SDK-AUTH-9001" : "L'initialisation a échoué: pas d'état initial. Veuillez contacter l'administrateur.",
  "error-SDK-AUTH-9010" : "Erreur. Veuillez contacter l'administrateur.",
  "error-SDK-AUTH-9011" : "Erreur inattendue. Veuillez contacter l'administrateur.",
  "error-SDK-AUTH-9020" : "La réinitialisation du mot de passe a échoué. Il se peut que le lien pour réinitialiser votre mot de passe ait expiré.",
  "error-SDK-AUTH-9021" : "Le mot de passe choisi enfreint au moins une des régles:",
  "error-SDK-AUTH-9999" : "Erreur interne: donnée invalide. Veuillez contacter l'administrateur.",

  "error-SSO-1002" : "L'utilisateur est verrouillé dans Oracle Identity Cloud Service. Vous pouvez soit utilizer \"Mot de passe oublié?\" ou contacter l'administrateur pour déverrouiller.",
  "error-SSO-1003" : "L'utilisateur est désactivé dans Oracle Identity Cloud Service. Veuillez contacter l'administrateur."

}

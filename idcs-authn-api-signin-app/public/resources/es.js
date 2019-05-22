const resources = {
  "signin-page-title": "Login",

  // Side bar
  "bar-signin-btn" : "Conectar",
  "bar-signup-btn" : "Registrarse",
  "bar-signin-hdr" : "¿Uno de nosotros?",
  "bar-signup-hdr" : "¿No tiene una cuenta?",
  "bar-signin-subhdr" : "Solo conectar",


  // Signin form
  "signin-hdr" : "Bienvenido",
  "signin-username-fld" : "Nombre de usuario",
  "signin-password-fld" : "Contraseña",
  "signin-submit-btn" : "Conectar",
  "signin-forgot-password-btn" : "¿Olvidó su contraseña?",

  // OTP form
  "otp-hdr" : "Verificando la contraseña de un solo uso",
  "otp-info-msg" : "Por favor digite la contraseña de un solo uso enviada a ",
  "otp-fld" : "Contraseña de un solo uso",
  "otp-submit-btn" : "Verificar",

  // TOTP form
  "totp-hdr" : "Verficando la contraseña de un solo uso OTP con tiempo",
  "totp-info-msg" : "Por favor digit Time-based OTP como se muestra en ",
  "totp-submit-btn" : "Verificar",

  // Push form
  "push-hdr" : "Verificando Notificación Push",
  "push-info-msg" : "Notificación enviada a la aplicación de autenticación en el siguiente dispositivo móvil:",
  "push-info-nodisplayname-msg" : "Notificación enviada a la aplicación de autenticación en su dispositivo móvil",
  "push-approve-info-msg" : "Debe aprobarla para continuar.",

  // Trusted device
  "td-msg" : "Confiar en este dispositivo por ",
  "td-days-msg" : "días",

  // Social
  "social-user-not-registered-msg" : "Este usuario no está registrado en IDCS. Por favor, presione aquí para registrarse.",
  "social-email-fld": "Correo electrónico",
  "social-givenName-fld": "Nombre",
  "social-familyName-fld": "Apellido",
  "social-mobileNo-fld": "Número Móbil",
  "social-phoneNo-fld": "Número de Teléfono",
  "social-socialRegisterUser-hdr":"Registro de Red Social",
  "social-cancel-btn": "Cancelar",

  // Security Questions form
  "qa-hdr" : "Verificando Preguntas de Seguridad",
  "qa-info-msg" : "Por favor provea las respuestas",
  "qa-submit-btn" : "Verificar",

  // Enrollment Init
  "enroll-hdr" : "Habilitando Verificación de 2 Pasos",
  "enroll-subhdr" : "Elija un factor",
  "enroll-skip-msg" : "Brincar el registro",
  "enroll-switch-msg" : "Cambiar el factor a registrar",

  // Enrollment Success
  "enroll-success-hdr" : "Método de Verficación de 2 Pasos ha sido configurado.",
  "enroll-success-btn" : "Listo",
  "enroll-anotherfactor-btn" : "Inscribir otro factor",

  "factor-sms-btn" : "OTP por mensaje de texto SMS",
  "factor-email-btn" : "OTP por Correo Electrónico",
  "factor-push-btn" : "Notificaciones Push",
  "factor-totp-btn" : "OTP con tiempo",
  "factor-security_questions-btn" : "Preguntas de Seguridad",
  "factor-bypasscode-btn" : "Código de Bypass",

  "factor-sms-msg" : "Contraseña de un solo uso OTP por mensaje de texto SMS",
  "factor-email-msg" : "Contraseña de un solo uso OTP por Correo Electrónico",
  "factor-push-msg" : "Notificaciones Push",
  "factor-totp-msg" : "Contraseña de un solo uso OTP con tiempo",
  "factor-security_questions-msg" : "Preguntas de Seguridad",
  "factor-bypasscode-msg" : "Código de Bypass",

  "factor-sms-msg-short" : "SMS",
  "factor-email-msg-short" : "EMAIL",
  "factor-push-msg-short" : "PUSH",
  "factor-totp-msg-short" : "TOTP",
  "factor-security_questions-msg-short" : "Q/A",
  "factor-bypasscode-msg-short" : "BYPASS",

  "factor-sms-desc" : "Mensaje de texto SMS por Número Móvil",
  "factor-email-desc" : "Enviar un correo electrónico con el código a usar",
  "factor-push-desc" : "Aplicación Oracle Authenticator",
  "factor-totp-desc" : "Contraseña de un solo uso OTP con tiempo",
  "factor-security_questions-desc" : "Preguntas de seguridad y respuestas",
  "factor-bypasscode-desc" : "Use un código bypass de seguridad si no suede user otro factor",

  // OTP Enrollment form
  "enroll-otp-hdr" : "Inscribiéndose en contraseña de un solo uso OTP por Correo Electrónico ",
  "enroll-otp-info-msg" : "Por favor digite el código OTP enviado a ",
  "enroll-otp-fld" : "Código OTP",
  "enroll-otp-submit-btn" : "Inscribirse",

  // SMS Enrollment form
  "enroll-sms-hdr" : "Inscribirse en contraseña de un solo uso OTP por mensaje de texto SMS",
  "enroll-sms-info-msg" : "Por favor digite el número móvil para enviar el mensaje de text SMS",
  "enroll-sms-fld" : "Número Móvil",
  "enroll-sms-submit-btn" : "Inscribirse",

  // Security Questions Enrollment form
  "enroll-qa-hdr" : "Inscribirse en Preguntas de Seguridad",
  "enroll-qa-info-msg" : "Digite una respuesta para cada pregunta escogida",
  "enroll-qa-answer-fld" : "Respuesta",
  "enroll-qa-hint-fld" : "Pista",
  "enroll-qa-submit-btn" : "Inscribirse",
  "enroll-qa-error-sameq-twice-msg" : "La misma pregunta de seguridad fue escogida dos veces.  Escoja otra pregunta.",

  // TOTP Enrollment form
  "enroll-totp-hdr" : "Inscribirse en Time-based OTP",
  "enroll-totp-scan-msg" : "Escanear el código QR con la aplicación Oracle Mobile Authenticator.",
  "enroll-totp-respond-msg": "Luego digite el código que ve en la pantalla del teléfono en el campo de abajo.",
  "enroll-totp-fld" : "Código Time-based OTP",
  "enroll-totp-submit-btn" : "Inscribirse",

  // Push Enrollment form
  "enroll-push-hdr" : "Inscribirse en Push Notifications",
  "enroll-push-scan-msg" : "Escanear el código QR con la aplicación Oracle Mobile Authenticator.",

  "enroll-taplink-msg": "Toque para inscribir su teléfono.",

 // Bypass code form
  "bypass-hdr" : "Código de Bypass",
  "bypass-info-msg" : "Digite su código de bypass",
  "bypass-fld" : "Código de Bypass",
  "bypass-submit-btn" : "Enviar",

  // Backup
  "backup-btn" : "Usar un método alternativo",
  "backup-msg" : "Escoge un método de autenticación alternativo:",

  // Resend code
  "email-did-not-get-msg" : "¿No recibió el correo electrónico?",
  "email-resend-btn" : "Reenviar correo electrónico",
  "sms-did-not-get-msg" : "¿No recibió el mensaje de texto SMS?",
  "sms-resend-btn" : "Reenviar mensaje de texto SMS",

  // Forgot password
  "forgot-pw-btn" : "¿Olvidó su contraseña?",
  "forgot-pw-hdr" : "¿Olvidó su contraseña?",
  "forgot-pw-info-msg" : "Por favor, digite el nombre de usuario para restablecer la contraseña.",
  "forgot-pw-fld" : "Nombre de usuario",
  "forgot-pw-submit-btn" : "Enviar",
  "forgot-pw-success-info-msg" : "Un correo electrónico ha sido enviado para restablecer la contraseña del usuario ",
  "forgot-pw-ok-btn": "Bien",
  "forgot-pw-did-not-get-msg": "¿Todavía no ha recibido el correo electrónico?",
  "forgot-pw-resend-btn": "Reenviar correo electrónico",
  "forgot-pw-incorrect-username-msg": "¿Es el nombre de usuario incorrecto?",
  "forgot-pw-incorrect-username-btn": "Arreglar nombre de usuario",

  "reset-pw-hdr" : "Restablecer Contraseña",
  "reset-pw-info-msg" : "Por favor, digite la contraseña y la confirmación de contraseña.",
  "reset-pw-fld" : "Contraseña",
  "reset-pw-confirm-fld" : "Confirmar Contraseña",
  "reset-pw-submit-btn" : "Enviar",
  "reset-pw-success-info-msg" : "Su contraseña ha sido restablecida.",
  "reset-pw-windows-close-msg" : "Puede cerrar esta ventana.",
  "reset-pw-ok-btn": "Bien",
  "reset-pw-nomatch-msg" : "¡La contraseña y la confirmación de contraseña no son iguales! Por favor, intente de nuevo.",

  //Self RegistrationProfiles
  "signup-chooseprofile": "Seleccione un Perfil de Auto Registro",
  "signup-hdr": "¡Subir a bordo!",
  "signup-noprofile": "No existen ningún perfil de registro",
  "signup-btn": "Registrarse",
  "signup-btndone": "Listo",
  "signup-btnok": "Bien",
  "signup-passwordmatch": "La contraseña y la confirmación de contraseña no son iguales",
  "signup-consent": "Estoy de acuerdo",
  "signup-hello-msg": "Hola, ",
  "signup-reg-success-msg": "Su registración fue exitosa.  Debería recibir un correo electrónico con la confirmación muy pronto...",
  "signup-reg-complete-msg": "Auto Registro fue completado.<BR/>Puede cerrar esta ventana.",

  // Misc
  "loading-msg" : "Cargando...",
  "or-msg" : "o",
  "back-to-login-msg" : "Regresar a Conectar",

  // Errors
  "error-required-fld" : "Campo requerido está vacío",
  "error-AUTH-1120" : "Estado inválido.  Por favor, reiniciar sesión.",
  "error-SDK-AUTH-9000" : "La inicialización falló: no existe el token de acceso.  Por favor, contacte al administrador.",
  "error-SDK-AUTH-9001" : "La inicializaciôn falló: no existe el estado inicial.  Por favor, contacte al administrador.",
  "error-SDK-AUTH-9010" : "Ocurrió un error inesperado.  Por favor, contacte al administrador.",
  "error-SDK-AUTH-9011" : "Ocurrió un error inesperado.  Por favor, contacte al administrador.",
  "error-SDK-AUTH-9020" : "Restablecer la contraseña falló.  El enlace para restablecer la contraseña puede haber expirado.",
  "error-SDK-AUTH-9021" : "La contraseña escogida viola una o más polîticas:",
  "error-SDK-AUTH-9999" : "Error interno del sistema: datos inválidos. Por favor, contacte al administrador.",

  "error-SSO-1002" : "El usuario está bloqueado en Oracle Identity Cloud Service. Para desbloquearlo, usted puede usar la función \"¿Olvidó su contraseña?\" o puede contactar al administrador.",
  "error-SSO-1003" : "El usuario ha sido desactivado en Oracle Identity Cloud Service. Por favor, contacte al administrador."

}

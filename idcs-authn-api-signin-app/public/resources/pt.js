const resources = {
  "signin-page-title": "Login",

  // Side bar
  "bar-signin-btn" : "Login",
  "bar-signup-btn" : "Registre-se",
  "bar-signin-hdr" : "Um de nós?",
  "bar-signup-hdr" : "Não tem conta?",
  "bar-signin-subhdr" : "Faça o login",

  // Signin form
  "signin-hdr" : "Bem Vindo",
  "signin-username-fld" : "Usuário",
  "signin-password-fld" : "Senha",
  "signin-submit-btn" : "Login",
  "signin-forgot-password-btn" : "Esqueceu a senha?",

  // OTP form
  "otp-hdr" : "Verificando OTP",
  "otp-info-msg" : "Por favor, forneça o código OTP enviado para ",
  "otp-fld" : "Código OTP",
  "otp-submit-btn" : "Verificar",

  // TOTP form
  "totp-hdr" : "Verificando OTP com Tempo de Expiração",
  "totp-info-msg" : "Por favor, forneça o código OTP apresentado em ",
  "totp-submit-btn" : "Verificar",

  // Push form
  "push-hdr" : "Verificando Notificação Push",
  "push-info-msg" : "Notificação enviada para o app de autenticação no seguinte dispositivo móvel:",
  "push-info-nodisplayname-msg" : "Notificação enviada para o app de autenticação no seu dispositivo móvel.",
  "push-approve-info-msg" : "É preciso aprová-la para prosseguir.",

  // Trusted device
  "td-msg" : "Confie neste dispositivo por ",
  "td-days-msg" : "dias",

  // Social
  "social-user-not-registered-msg" : "Usuário não registrado. Por favor, clique aqui para registrar",
  "social-email-fld": "Email",
  "social-givenName-fld": "Nome",
  "social-familyName-fld": "Sobrenome",
  "social-mobileNo-fld": "Celular",
  "social-phoneNo-fld": "Telefone",
  "social-socialRegisterUser-hdr":"Registro de Usuário de Rede Social",
  "social-cancel-btn": "Cancelar",

  // Security Questions form
  "qa-hdr" : "Verificando Perguntas de Segurança",
  "qa-info-msg" : "Responda às seguintes perguntas",
  "qa-submit-btn" : "Verificar",

  // Enrollment Init
  "enroll-hdr" : "Habilitar autenticação com dois fatores",
  "enroll-subhdr" : "Selecione um método",
  "enroll-skip-msg" : "Não Habilitar",
  "enroll-switch-msg" : "Escolher outro Método",

  // Enrollment Success
  "enroll-success-hdr" : "Método para autenticação com 2 fatores habilitado com sucesso.",
  "enroll-success-btn" : "Ok",
  "enroll-anotherfactor-btn" : "Habilitar Outro Fator",

  "factor-sms-btn" : "SMS",
  "factor-email-btn" : "OTP por EMail",
  "factor-push-btn" : "Notificações Push",
  "factor-totp-btn" : "OTP com Tempo de Expiração",
  "factor-security_questions-btn" : "Perguntas de Segurança",
  "factor-bypasscode-btn" : "Código Bypass",

  "factor-sms-msg" : "Enviar um código para o número",
  "factor-email-msg" : "Enviar um código para o email",
  "factor-push-msg" : "Enviar notificação para o app de autenticação em",
  "factor-totp-msg" : "Usar código gerado pelo app de autenticação em",
  "factor-security_questions-msg" : "Responder a perguntas de segurança",
  "factor-bypasscode-msg" : "Use um código bypass se não pode usar outro fator",

  "factor-sms-msg-short" : "SMS",
  "factor-email-msg-short" : "EMAIL",
  "factor-push-msg-short" : "PUSH",
  "factor-totp-msg-short" : "TOTP",
  "factor-security_questions-msg-short" : "Q/A",
  "factor-bypasscode-msg-short" : "BYPASS",

  "factor-sms-desc" : "SMS enviado para o telefone móvel",
  "factor-email-desc" : "Código OTP enviado para o email",
  "factor-push-desc" : "Notificação enviada ao app de autenticação",
  "factor-totp-desc" : "Código OTP com tempo de expiração enviado ao app de autenticação",
  "factor-security_questions-desc" : "Usuário escolhe perguntas de segurança",
  "factor-bypasscode-desc" : "Código Bypass caso não seja possível usar outros fatores",

  // OTP Enrollment form
  "enroll-otp-hdr" : "Habilitando OTP por E-Mail ",
  "enroll-otp-info-msg" : "Forneça o código OTP enviado para ",
  "enroll-otp-fld" : "Código OTP",
  "enroll-otp-submit-btn" : "Habilitar",

  // TOTP Enrollment form
  "enroll-totp-submit-btn" : "Habilitar",

  // SMS Enrollment form
  "enroll-sms-hdr" : "Habilitando OTP por SMS",
  "enroll-sms-info-msg" : "Forneça o número do telefone móvel para o envio do SMS",
  "enroll-sms-fld" : "Número do telefone móvel",
  "enroll-sms-submit-btn" : "Habilitar",

  // Security Questions Enrollment form
  "enroll-qa-hdr" : "Habilitando Perguntas de Segurança",
  "enroll-qa-info-msg" : "Forneça uma resposta para cada pergunta escolhida",
  "enroll-qa-answer-fld" : "Resposta",
  "enroll-qa-hint-fld" : "Dica",
  "enroll-qa-submit-btn" : "Habilitar",
  "enroll-qa-error-sameq-twice-msg" : "Mesma pergunta escolhida mais de uma vez. Selecione outra.",

  // TOTP Enrollment form
  "enroll-totp-hdr" : "Habilitando OTP com Tempo de Expiração",
  "enroll-totp-scan-msg" : "Leia o código QR com o App de Autenticação Móvel da Oracle.",
  "enroll-totp-respond-msg": "Depois forneça o código que aparece na tela do seu telefone no campo abaixo.",
  "enroll-totp-fld" : "Código OTP",
  "enroll-totp-submit-btn" : "Habilitar",

  // Push Enrollment form
  "enroll-push-hdr" : "Habilitando Notificações Push",
  "enroll-push-scan-msg" : "Leia o código QR com o Oracle Mobile Authenticator App",
  "enroll-taplink-msg": "Toque para habilitar o seu telefone móvel.",

  // Bypass code form
  "bypass-hdr" : "Verificando Código Bypass",
  "bypass-info-msg" : "Por favor forneça o seu código bypass",
  "bypass-fld" : "Código Bypass",
  "bypass-submit-btn" : "Verificar",

  // Backup
  "backup-btn" : "Use um método alternativo",
  "backup-msg" : "Escolha um método de autenticação alternativo",

  // Resend code
  "email-did-not-get-msg" : "Não recebeu o email?",
  "email-resend-btn" : "Reenviar email",
  "sms-did-not-get-msg" : "Não recebeu o SMS?",
  "sms-resend-btn" : "Reenviar SMS",

  // Forgot password
  "forgot-pw-btn" : "Esqueceu a Senha?",
  "forgot-pw-hdr" : "Esqueceu a Senha?",
  "forgot-pw-info-msg" : "Por favor, forneça o usuário para redefinir senha",
  "forgot-pw-fld" : "Usuário",
  "forgot-pw-submit-btn" : "Enviar",
  "forgot-pw-success-info-msg" : "Email com instruções para redefinição de senha enviado para ",
  "forgot-pw-ok-btn": "Ok",
  "forgot-pw-did-not-get-msg": "Ainda não recebeu o email?",
  "forgot-pw-resend-btn": "Reenviar Email",
  "forgot-pw-incorrect-username-msg": "Usuário incorreto?",
  "forgot-pw-incorrect-username-btn": "Forneça usuário",

  "reset-pw-hdr" : "Redefinir Senha",
  "reset-pw-info-msg" : "Por favor, forneça senha e a confirme",
  "reset-pw-fld" : "Senha",
  "reset-pw-confirm-fld" : "Confirmação da Senha",
  "reset-pw-submit-btn" : "Enviar",
  "reset-pw-success-info-msg" : "Sua senha foi redefinida com sucesso.",
  "reset-pw-windows-close-msg" : "Esta janela pode ser fechada.",
  "reset-pw-ok-btn": "Ok",
  "reset-pw-nomatch-msg" : "Senha e Confirmação não conferem! Por favor, tente novamente.",

  //Self RegistrationProfiles
  "signup-chooseprofile": "Escolha um Perfil de Registro",
  "signup-hdr": "Registre-se",
  "signup-noprofile": "Registro não está disponível",
  "signup-btn": "Registrar",
  "signup-btndone": "DONE",
  "signup-btnok": "Ok",
  "signup-passwordmatch": "Senha e confirmação de senha não conferem.",
  "signup-consent": "Concordo",
  "signup-hello-msg": "Olá, ",
  "signup-reg-success-msg": "Registro realizado com sucesso. Você receberá um email de confirmação em instantes.",
  "signup-reg-complete-msg": "Registro completo.<BR/>Esta janela pode seer fechada.",

  // Preferred Factor
  "preferredFactor-msg" : "Definir este método como preferido",

  // Misc
  "loading-msg" : "Carregando...",
  "or-msg" : "ou",
  "back-to-login-msg" : "Voltar para o Login",

  // Errors
  "error-required-fld" : "Campo obrigatório não preenchido",
  "error-AUTH-1120" : "Condição inválida para login. Por favor, reinicie o login.",
  "error-SDK-AUTH-9000" : "Token de acesso inexistente. Por favor, contate o administrator.",
  "error-SDK-AUTH-9001" : "Condição inicial inexistente. Por favor, contate o administrator.",
  "error-SDK-AUTH-9010" : "Erro inesperado. Por favor, contate o administrator.",
  "error-SDK-AUTH-9011" : "Erro inesperado. Por favor, contate o administrator.",
  "error-SDK-AUTH-9020" : "Redefinição de senha falhou. O link para a redefinição de senha expirou.",
  "error-SDK-AUTH-9021" : "Senha escolhida viola uma ou mais políticas:",
  "error-SDK-AUTH-9999" : "Erro interno de sistema: dados inválidos. Por favor, contate o administrador.",

  "error-SSO-1002" : "Usuário bloqueado no Oracle Identity Cloud Service. Você pode usar a função \"Esqueceu a Senha?\" para desbloquear ou contatar o administrador.",
  "error-SSO-1003" : "Usuário desativado no Oracle Identity Cloud Service. Por favor, contate o administrador para reativar."

}

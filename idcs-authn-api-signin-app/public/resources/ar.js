const resources = {
    // Signin form
    "signin-hdr" : "مرحبـــاً بك في صفحة الدخول",
    "signin-username-fld" : "إسم المستخدم",
    "signin-password-fld" : "كلمة السر",
    "signin-submit-btn" : "الدخول",
    "signin-forgot-password-btn" : "نسيت كلمة السر؟",

    // OTP form
    "otp-hdr" : "التحقق من كود الدخول",
    "otp-info-msg" : "الرجاء إدخال كود الدخول المرسل إليك",
    "otp-fld" : "كود الدخول",
    "otp-submit-btn" : "إرسل",

    // TOTP form
    "totp-hdr" : "التحقق من كود الدخول",
    "totp-submit-btn" : "إرسل",

    // Trusted device
    "td-msg" : "إحتفط به",
    "td-days-msg" : "يوماً",

    // Social
    "social-user-not-registered-msg" : "المستخدم ليس مسجلا في النظام... سجل نفسك هنا..",
    "social-email-fld": "الإيميل",
    "social-givenName-fld": "الإسم",
    "social-familyName-fld": "إسم العائلة",
    "social-mobileNo-fld": "الموبيل",
    "social-phoneNo-fld": "التليفون",
    "social-socialRegisterUser-hdr":"سجل نفسك",
    "social-cancel-btn": "إلغاء",

    // Security Questions form
    "qa-hdr" : "التحقق من أسئلة الأمان",
    "qa-info-msg" : "الرجاء الإجابة عن الأسئلة",
    "qa-submit-btn" : "التحقق",

    // Enrollment Init
    "enroll-hdr" : "Enabling 2-Step Verification",
    "enroll-subhdr" : "Select a Method",
    "enroll-skip-msg" : "Skip Enrollment",

    // Enrollment Success
    "enroll-success-hdr" : "2-Step verification method has been set successfully.",
    "enroll-success-btn" : "Done",
    "enroll-anotherfactor-btn" : "Enroll Another Factor",

    "factor-sms-btn" : "OTP over SMS",
    "factor-email-btn" : "OTP over E-Mail",
    "factor-push-btn" : "Push Notifications",
    "factor-totp-btn" : "Time-Based OTP",
    "factor-security_questions-btn" : "Security Questions",
    "factor-bypasscode-btn" : "Bypass Code",

    "factor-sms-desc" : "SMS to Mobile Number",
    "factor-email-desc" : "Send an email with a code to use",
    "factor-push-desc" : "Oracle Authenticator App",
    "factor-totp-desc" : "Time-based OTP",
    "factor-security_questions-desc" : "Security question and answers",
    "factor-bypasscode-desc" : "Use a security bypass code if you cannot use another factor",

    // OTP Enrollment form
    "enroll-otp-hdr" : "Enrolling in OTP over E-Mail ",
    "enroll-otp-info-msg" : "Please enter OTP code sent to ",
    "enroll-otp-fld" : "OTP Code",
    "enroll-otp-submit-btn" : "Enroll",

    // SMS Enrollment form
    "enroll-sms-hdr" : "Enrolling in OTP over SMS",
    "enroll-sms-info-msg" : "Please enter mobile number to send SMS",
    "enroll-sms-fld" : "Mobile Number",
    "enroll-sms-submit-btn" : "Enroll",

    // Security Questions Enrollment form
    "enroll-qa-hdr" : "Enrolling in Security Questions",
    "enroll-qa-info-msg" : "Enter an answer for each chosen question",
    "enroll-qa-answer-fld" : "Answer",
    "enroll-qa-hint-fld" : "Hint",
    "enroll-qa-submit-btn" : "Enroll",
    "enroll-qa-error-sameq-twice-msg" : "Same security question is chosen twice. Select another question.",

    // TOTP Enrollment form
    "enroll-totp-hdr" : "Enrolling in Time-based OTP",
    "enroll-totp-scan-msg" : "Scan the QR code with the Oracle Mobile Authenticator App.",
    "enroll-totp-respond-msg": "Then enter the code you see on your phone's screen in the field below.",
    "enroll-totp-fld" : "Time-based OTP Code",
    "enroll-totp-submit-btn" : "Enroll",

    // Push Enrollment form
    "enroll-push-hdr" : "Enrolling in Push Notifications",
    "enroll-push-scan-msg" : "Scan the QR code with the Oracle Mobile Authenticator App.",

    "enroll-taplink-msg": "Tap to enroll your phone.",

    // Bypass code form
    "bypass-hdr" : "Bypass Code",
    "bypass-info-msg" : "Provide your bypass code",
    "bypass-fld" : "Bypass Code",
    "bypass-submit-btn" : "Submit",

    // Backup
    "backup-btn" : "Use an alternative",
    "backup-msg" : "Choose an alternative authentication method:",

    // Resend code
    "email-did-not-get-msg" : "Did not get the email?",
    "email-resend-btn" : "Resend email",
    "sms-did-not-get-msg" : "Did not get the SMS?",
    "sms-resend-btn" : "Resend SMS",

    // Forgot password
    "forgot-pw-btn" : "نسيت كلمة السر؟",
    "forgot-pw-hdr" : "نسيت كلمة السر؟",
    "forgot-pw-info-msg" : "فضلاً أدخل إسم المستخدم لإصدار كلمة سر جديدة",
    "forgot-pw-msg" : "فضلاً أدخل إسم المستخدم لإصدار كلمة سر جديدة",
    "forgot-pw-fld" : "إسم المستخدم",
    "forgot-pw-submit-btn" : "إضغط",
    "forgot-pw-success-info-msg" : "الرجاء مراجعة إيميلك لمعرفة كلمة السر",
    "forgot-pw-ok-btn": "نعم",
    "forgot-pw-did-not-get-msg": "هل وصلك الإيميل بعد؟",
    "forgot-pw-resend-btn": "إعادة إرسال الإيميل",

    "reset-pw-hdr" : "استصدر كلمة سر جديدة",
    "reset-pw-info-msg" : "فضلاً أدخل كلمة السر الجديدة",
    "reset-pw-fld" : "كلمة السر",
    "reset-pw-confirm-fld" : "تأكد من كلمة السر",
    "reset-pw-submit-btn" : "أدخل",
    "reset-pw-success-info-msg" : "تم تغيير كلمة سرك",
    "reset-pw-windows-close-msg" : "تستطيع الآن أن تغلق هذه النافذة",
    "reset-pw-ok-btn": "نعم",

    // Misc
    "loading-msg" : "تحميل ...",
    "or-msg" : "أو",

    // Errors
    "error-required-fld" : "هذا الحقل مطلوب"

}

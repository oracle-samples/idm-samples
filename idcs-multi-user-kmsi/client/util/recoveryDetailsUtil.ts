/*
 * Lookup for details of how to work with individual MFA factors
 */
interface RecoveryDetails {
  [key:string] :RecoveryDetail
}

interface RecoveryDetail {
  getPostRequestDescription: (display:string)=>string;
  requestDisplay: string;
  getVerifyDescription?: (display:string)=>string;
}


const recoveryDetails:RecoveryDetails = {
  email:{
    requestDisplay:"Recovery Email",
    getPostRequestDescription: (display) => {
      return `A password reset notification will be sent to the recovery email address associated with your username ${display}. If you haven't received the password reset email, then please check your spam folder or contact your system administrator. You can also retry after 10 minutes.`
    },
    getVerifyDescription: (display) => {return `An email has been...`}
  },
  sms:{
    requestDisplay:"Mobile Number",
    getPostRequestDescription: (display) => {return `A OTP has been...`},
    getVerifyDescription: (display) => {return `A passcode has been sent to the mobile number associated with your account ${display}.`}
  }
}

export {recoveryDetails};
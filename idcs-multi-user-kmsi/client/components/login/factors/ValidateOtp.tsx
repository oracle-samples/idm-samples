/* tslint:disable:no-console */
import React, { Component } from 'react';
import { InterfaceCredentials } from '../../../types/uiTypes';

import "../../../css/userNamePasswordForm.css";
import "../../../css/button.css";
import "../../../css/credentialInput.css";
import { factorDetails } from '../../../util/factorDetailsUtil';
import OneTimePasswordComponent from './OneTimePasswordComponent';
import { AuthFactor, MfaCredential } from '../../../types/idcsTypes';

const DEVICE_ID_CREDENTIAL = "deviceId";
const PREFERRED_CREDENTIAL = "preferred";

/*
 * Generic OTP handler for SMS, EMAIL, Offline TOPT, etc.
 */
interface ValidateOtpFormProps {
  authFactor: "SMS"|"EMAIL"|"TOTP";
  initialUsername: string;
  displayNumber?: string;
  selectedDeviceId?: string;
  submissionInProgress: boolean;
  credentials: string[];
  changeCredentialSupported: boolean;
  handleCredentialSubmit: (submittedUsername: string, credentials: MfaCredential, authFactor:AuthFactor, keepMeSignedIn?:boolean) => void;
  handleResendCode: () => void;
  redwoodTheme: boolean;
};

type State = {
  allowResend:boolean;
  newCodeSent:boolean;
  preferred: boolean;
}

export default class ValidateOtpForm extends Component<ValidateOtpFormProps, State> {
  constructor(props: ValidateOtpFormProps) {
    super(props);
    this.state = {
      allowResend:(props.authFactor === 'SMS' || props.authFactor === 'EMAIL'),
      newCodeSent:false,
      preferred: false
    };
    this.handleCredentialSubmit = this.handleCredentialSubmit.bind(this);
    this.handleResendCode = this.handleResendCode.bind(this);
    this.handlePreferredChange = this.handlePreferredChange.bind(this);
  }

  // Wrap the submission in order to add the device id if required.
  handleCredentialSubmit(submittedUsername: string, credentials: MfaCredential, keepMeSignedIn?: boolean){
    if(this.props.selectedDeviceId){
      credentials[DEVICE_ID_CREDENTIAL] = this.props.selectedDeviceId;
      credentials[PREFERRED_CREDENTIAL] = this.state.preferred;
    }
    this.props.handleCredentialSubmit(submittedUsername, credentials, this.props.authFactor, keepMeSignedIn);
  }

  handleResendCode(){
    if(this.props.submissionInProgress || !this.state.allowResend || this.state.newCodeSent){
      // Don't send a new code if we are already doing an async, or if we have already sent one.
      return;
    }
    this.setState({newCodeSent:true});
    this.props.handleResendCode();
  }

  handlePreferredChange(event: React.ChangeEvent<HTMLInputElement>) {
    this.setState({ preferred: event.currentTarget.checked });
  }

  render() {
    // Allow codes to be resent for SMS or EMAIL
    let resendStatus: JSX.Element = null;
    if(this.state.allowResend){
      if(this.state.newCodeSent){
        resendStatus = (<div>Code has been Sent</div>);
      }else{
        resendStatus = (<div
          className="alternate-action-text"
          onClick={this.handleResendCode}
        >
          Resend Code
        </div>);
      }
    }
    return (
      <div className="username-password-container">
        {factorDetails[this.props.authFactor].getVerifyDescription(this.props.displayNumber)}
        <OneTimePasswordComponent
          submissionInProgress={this.props.submissionInProgress}
          credentials={this.props.credentials}
          initialUsername={this.props.initialUsername}
          handleCredentialSubmit={this.handleCredentialSubmit}
          redwoodTheme={this.props.redwoodTheme}
        />
        {resendStatus}
      </div>
    );
  }
}
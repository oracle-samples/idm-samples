/* tslint:disable:no-console */

/*
 * Top level handler for drawing the credential collector screens
 */

import React, { Component } from 'react';

import UsernamePasswordForm from './factors/UsernamePasswordForm';
import KmsiUserSelection from './kmsiUserSelection';
import { InterfaceCredentials, KMSIConfiguration, LoginMethod } from '../../types/uiTypes';
import { AuthFactor, MfaCredential, RequestState } from '../../types/idcsTypes';
import ValidateOtpForm from './factors/ValidateOtp';
import StatusText from '../common/StatusText';
import PushNotificationVerify from './factors/PushNotificationVerify';
import LoginFactorSelection from './LoginFactorSelection';
import { factorDetails } from '../../util/factorDetailsUtil';

// Values for each of the login types obtained from the IDCS authn context
const USERNAMEPASS = "USERNAME_PASSWORD";
const EXTIDENTITYPROVIDERS = "IDP";
const PUSHNOTIFICATION = "PUSH";
const SMSOTP = "SMS";
const EMAILOTP = "EMAIL";
const TIMEBASED_OTP = "TOTP";
const BYPASSCODE = "BYPASSCODE";
const SECURITYQUESTIONS = "SECURITY_QUESTIONS";
// Auth Factor Name
const KMSI_CREDENTIALS = "kmsiUserRef";
const SWITCH_FACTOR_OP = "getBackupFactors"

interface LoginLayoutProps {
  submissionInProgress: boolean;
  loginState: RequestState;
  statusMessage: string;
  existingKmsi: KMSIConfiguration[];
  savedUsername: string;
  redwoodTheme: boolean;
  bypassKmsi: boolean;
  showFactorSelection: boolean;
  handleCredentialSubmit: (submittedUsername: string, credentials: MfaCredential, authFactor:AuthFactor, keepMeSignedIn?: boolean) => void;
  handleClearKmsi: (kmsiUser:KMSIConfiguration) => void;
  handleResendCode: () => void;
  handleBypassKmsi: () => void;
  handleRequestPasswordRecovery: () => void;
};

interface State {
  selectedFactor: AuthFactor;
  selectedDeviceId: string;
  selectedDeviceName: string;
}

export default class LoginLayout extends Component<LoginLayoutProps, State> {
  constructor(props: LoginLayoutProps) {
    super(props);
    this.state = {
      selectedFactor: null,
      selectedDeviceId: "",
      selectedDeviceName: ""
    };
    // Binds
    this.handleSelectLoginFactor = this.handleSelectLoginFactor.bind(this);
  }

  handleSelectLoginFactor(factorName: AuthFactor, deviceName?:string, deviceId?:string){
    this.setState({
      selectedFactor: factorName,
      selectedDeviceId: deviceId,
      selectedDeviceName: deviceName
    });
    if(factorDetails[factorName].requiresInitiation){
      this.props.handleCredentialSubmit(this.props.savedUsername, {deviceId}, factorName);
    }
  }

  generateLoginForm():JSX.Element {
    // Determine which content to render
    // Is KMSI viable?
    if (!this.props.bypassKmsi && this.props.existingKmsi.length > 0 && this.props.loginState.keepMeSignedInEnabled) {
      return (<KmsiUserSelection
            credentials={[KMSI_CREDENTIALS]}
            handleKmsiBypass={this.props.handleBypassKmsi}
            handleCredentialSubmit={this.props.handleCredentialSubmit}
            handleForgetUser={this.props.handleClearKmsi}
            submissionInProgress={this.props.submissionInProgress}
            kmsiUsers={this.props.existingKmsi}
            redwoodTheme={this.props.redwoodTheme}
          />);
    }
    if(this.props.loginState.nextAuthFactors.includes(USERNAMEPASS)){
      return (
        <UsernamePasswordForm {...this.props.loginState[USERNAMEPASS]}
          initialUsername={this.props.savedUsername}
          handleCredentialSubmit={this.props.handleCredentialSubmit}
          handleRequestPasswordRecovery={this.props.handleRequestPasswordRecovery}
          submissionInProgress={this.props.submissionInProgress}
          keepMeSignedInEnabled={this.props.loginState.keepMeSignedInEnabled}
          redwoodTheme={this.props.redwoodTheme}
        />
      );
    }
    if(this.props.showFactorSelection && !this.state.selectedFactor){
      // Check for valid methods
      const loginMethods: LoginMethod[] = []
      for(const factor of this.props.loginState.nextAuthFactors){
        switch(factor){
          case BYPASSCODE:
          case SECURITYQUESTIONS:
            loginMethods.push({factor, displayName: ""});
            break;
          case TIMEBASED_OTP:
          case SMSOTP:
          case EMAILOTP:
          case PUSHNOTIFICATION:
            if(this.props.loginState[factor]?.enrolledDevices && this.props.loginState[factor]?.enrolledDevices.length > 0){
              for(const device of this.props.loginState[factor]?.enrolledDevices){
                // Add each device
                loginMethods.push({factor, displayName: device.displayName || "", deviceId: device.deviceId});
              }
            }
            break;
        }
      }
      if(loginMethods.length > 0){
        return (
          <LoginFactorSelection
            loginMethods={loginMethods}
            submissionInProgress={this.props.submissionInProgress}
            redwoodTheme={this.props.redwoodTheme}
            handleSelectLoginFactor={this.handleSelectLoginFactor}
          />);
      }
    }
    if((!this.state.selectedFactor || this.state.selectedFactor === SMSOTP) && this.props.loginState.nextAuthFactors.includes(SMSOTP)){
      return (
        <ValidateOtpForm
          authFactor={SMSOTP}
          {...this.props.loginState[SMSOTP]}
          initialUsername={this.props.savedUsername}
          selectedDeviceId={this.state.selectedDeviceId}
          handleCredentialSubmit={this.props.handleCredentialSubmit}
          displayNumber={this.state.selectedDeviceName || this.props.loginState.displayName || ""}
          submissionInProgress={this.props.submissionInProgress}
          handleResendCode={this.props.handleResendCode}
          redwoodTheme={this.props.redwoodTheme}
          changeCredentialSupported={this.props.loginState.nextOp?.includes(SWITCH_FACTOR_OP)}
        />
      )
    }
    if((!this.state.selectedFactor || this.state.selectedFactor === EMAILOTP) && this.props.loginState.nextAuthFactors.includes(EMAILOTP)){
      return (
        <ValidateOtpForm
          authFactor={EMAILOTP}
          {...this.props.loginState[EMAILOTP]}
          initialUsername={this.props.savedUsername}
          selectedDeviceId={this.state.selectedDeviceId}
          handleCredentialSubmit={this.props.handleCredentialSubmit}
          displayNumber={this.state.selectedDeviceName || this.props.loginState.displayName || ""}
          submissionInProgress={this.props.submissionInProgress}
          handleResendCode={this.props.handleResendCode}
          redwoodTheme={this.props.redwoodTheme}
          changeCredentialSupported={this.props.loginState.nextOp?.includes(SWITCH_FACTOR_OP)}
        />
      )
    }
    if((!this.state.selectedFactor || this.state.selectedFactor === TIMEBASED_OTP) && this.props.loginState.nextAuthFactors.includes(TIMEBASED_OTP)){
      return (
        <ValidateOtpForm
          authFactor={TIMEBASED_OTP}
          {...this.props.loginState[TIMEBASED_OTP]}
          initialUsername={this.props.savedUsername}
          selectedDeviceId={this.state.selectedDeviceId}
          handleCredentialSubmit={this.props.handleCredentialSubmit}
          displayNumber={this.state.selectedDeviceName || this.props.loginState.displayName || ""}
          submissionInProgress={this.props.submissionInProgress}
          handleResendCode={()=>{return;}}
          redwoodTheme={this.props.redwoodTheme}
          changeCredentialSupported={this.props.loginState.nextOp?.includes(SWITCH_FACTOR_OP)}
        />
      )
    }
    if((!this.state.selectedFactor || this.state.selectedFactor === PUSHNOTIFICATION) && this.props.loginState.nextAuthFactors.includes(PUSHNOTIFICATION)){
      return (
        <PushNotificationVerify
          initialUsername={this.props.savedUsername}
          handleCredentialSubmit={this.props.handleCredentialSubmit}
          displayName={this.state.selectedDeviceName || this.props.loginState.displayName || ""}
          selectedDeviceId={this.state.selectedDeviceId}
          submissionInProgress={this.props.submissionInProgress}
          trustDurationInDays={this.props.loginState.trustedDeviceSettings?.trustDurationInDays}
          redwoodTheme={this.props.redwoodTheme}
        />
      )
    }
    // TODO: Bypass Codes and KBA
    console.error("No Login Layout for available factors.");
    return (<div/>);
  }

  render() {
    return (
      <div className="login-content-container">
        <span className="login-spacer"/>
        <StatusText
          message={this.props.statusMessage}
          submissionInProgress={this.props.submissionInProgress}
          severity="info"
        />
        {this.generateLoginForm()}
      </div>
    );
  }

}
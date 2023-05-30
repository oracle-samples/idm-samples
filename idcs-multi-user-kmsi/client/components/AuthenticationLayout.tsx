/* tslint:disable:no-console */

/*
 * Authentication Layout is the main control class for the application, and
 * maintains the whole login state, handling conditional rendering, etc.
 */

import React, { Component } from 'react';

import { storeKmsiSetting, getExistingKmsi, clearKmsiEntry, getNextKmsiRef } from '../util/kmsiStorageUtil';

import { KMSIConfiguration, PasswordRecoveryState } from '../types/uiTypes';

import "../css/loginLayout.css";
import { AuthFactor, MfaCredential, PasswordRecoveryOption, RecoveryOption, RequestState } from '../types/idcsTypes';
import EnrollmentLayout from './enrollment/EnrollmentLayout';
import LoginLayout from './login/LoginLayout';
import UpdateExpiredPasswordForm from './password/UpdateExpiredPasswordForm';
import PasswordRecoveryLayout from './password/recovery/PasswordRecoveryLayout';
import { clearKmsi, createSession, initiateEnrollment, initiateForgotPassword, mapResponseToNewPasswordRecoveryState, mapResponseToNewRequestState, requestNewCode, setNewPassword, submitCredential, switchEnrollment, validateRecoveryCode } from '../util/authenticationUtil';
import StatusText from './common/StatusText';

const LOGIN_OPERATION = "credSubmit";
const ENROLL_OPERATION = "enrollment";
const PASSWORD_CHANGE_OPERATION = "resetPassword";
const KMSI_CREDENTIALS = "kmsiUserRef";

interface AuthenticationLayoutProps {
  initialState: RequestState;
  redwoodTheme: boolean;
}

interface State {
  submitting: boolean;
  bypassKmsi: boolean;
  loginState: RequestState;
  statusMessage: string;
  existingKmsi: KMSIConfiguration[];
  savedUsername: string;
  initialKmsiRequested: boolean;
  enrollUsesLoginScreen: boolean;
  enrollmentInitiated: boolean;
  allowSelectFactor: boolean;
  forgotPassword: boolean;
  recoveryState: PasswordRecoveryState;
};

export default class AuthenticationLayout extends Component<AuthenticationLayoutProps, State> {
  constructor(props: AuthenticationLayoutProps) {
    // console.log(JSON.stringify(props))
    super(props);
    this.state = {
      submitting: false,
      bypassKmsi: false,
      loginState: props.initialState,
      statusMessage: "",
      existingKmsi: [],
      savedUsername: "",
      initialKmsiRequested: false,
      enrollUsesLoginScreen: false,
      enrollmentInitiated: false,
      allowSelectFactor: false,
      forgotPassword: false,
      recoveryState: {
        notificationType: null,
        options: [],
        notificationEmailAddress: null,
        recoveryNotificationDisplay: null,
        deviceId: null,
        requestId: null
      }

    };
    // Binds
    this.handleCredentialSubmit = this.handleCredentialSubmit.bind(this);
    this.handleSetNewPassword = this.handleSetNewPassword.bind(this);
    this.handleClearKmsi = this.handleClearKmsi.bind(this);
    this.handleInitiateEnrollment = this.handleInitiateEnrollment.bind(this);
    this.handleSkipEnrollment = this.handleSkipEnrollment.bind(this);
    this.handleResendCode = this.handleResendCode.bind(this);
    this.handleKmsiBypass = this.handleKmsiBypass.bind(this);
    this.handleSelectOtherEnrollmentFactor = this.handleSelectOtherEnrollmentFactor.bind(this);
    this.handleInitiateForgotPassword = this.handleInitiateForgotPassword.bind(this);
    this.handleCancelRecoveryRequest = this.handleCancelRecoveryRequest.bind(this);
    this.handleRequestRecovery = this.handleRequestRecovery.bind(this);
    this.handleValidateRecoveryCode = this.handleValidateRecoveryCode.bind(this);
  }

  // On mount, check localstorage for KMSI information
  componentDidMount(): void {
    this.setState({ existingKmsi: getExistingKmsi() });
  }

  // Have to bubble this, since when we swap to MFA enrollment, then back to
  // factor validation, we lose the Bypass State
  handleKmsiBypass(): void {
    this.setState({ bypassKmsi: true });
  }

  // This class needs to handle the event from the subcomponents, to append the login context
  // Technically KMSI behaviour is slightly different, but easier to wrap that in this
  async handleCredentialSubmit(submittedUsername: string, credentials: MfaCredential, authFactor: AuthFactor, keepMeSignedIn?: boolean) {
    // Pass down 'please wait' to prevent double submissions
    this.setState({
      submitting: true,
      savedUsername: submittedUsername || this.state.savedUsername,
      initialKmsiRequested: keepMeSignedIn || this.state.initialKmsiRequested || false
    });
    let kmsiUserRef = null;
    if (credentials[KMSI_CREDENTIALS] !== undefined || keepMeSignedIn || this.state.initialKmsiRequested) {
      // If we have requested KMSI, determine the reference we will use for this user
      // There is an argument for putting this in the state - since it might be called
      // multiple times on a PUSH MFA challenge, and the read could be slightly slow
      // but that is on a 2sec poll anyway, so it isn't exactly thrashing anything.
      kmsiUserRef = credentials[KMSI_CREDENTIALS] as number || getNextKmsiRef(submittedUsername || this.state.savedUsername);
    }
    const credsResponse = await submitCredential(credentials, authFactor, keepMeSignedIn || this.state.initialKmsiRequested || false, kmsiUserRef, this.state.loginState.requestState)
    // Handle response - remembering to unset the 'please wait' status
    // Success here might be an MFA challenge, or simply a redirect after login
    // No response means there was an unknown error
    if (!credsResponse) {
      return this.setState({
        submitting: false,
        statusMessage: "Something went wrong, check the browser console for details."
      });
    }
    // If we have finished login, then redirect after storing KMSI ref if required
    if (credsResponse.postLoginRedirect) {
      if (kmsiUserRef !== undefined && credsResponse.kmsiTokenSet) {
        storeKmsiSetting({
          displayName: submittedUsername || this.state.savedUsername,
          ref: kmsiUserRef
        });
      }
      console.log("Redirecting...");
      return window.location.assign(credsResponse.postLoginRedirect);
    }
    if (credsResponse.errorCode) {
      // This is probably a login failure.
      // TODO: This might be fixable - switch on the code.
      // If we need to update the request state, clone the value into the state
      this.setState({
        statusMessage: credsResponse.errorMessage || "Error while submitting credentials"
      });
    } else {
      // Clear the status message
      this.setState({
        statusMessage: ""
      });
    }
    // A KMSI submission which requires additional followup just returns login state,
    // so we need to flag that it shouldn't be shown any more.
    if (credentials[KMSI_CREDENTIALS] !== undefined) {
      // Add additional explanation in the status - this might override an error message,
      // but in most cases that should be ok.
      this.setState({
        bypassKmsi: true,
        statusMessage: "Additional Authentication required"
      });
    }
    // If we have transitioned to a pending state, we update the loginState,
    // otherwise, when pending we can just keep everything as is for now,
    // assuming it will either fail or succeed later
    if (credsResponse.status && credsResponse.status === "pending" && this.state.loginState.status === "pending") {
      return this.setState({
        submitting: false
      });
    }
    return this.setState({
      submitting: false,
      loginState: mapResponseToNewRequestState(this.state.loginState, credsResponse)
    });
  }

  // Handle Update Password on expiry
  async handleSetNewPassword(oldPassword: string, newPassword: string) {
    // Pass down 'please wait' to prevent double submissions
    this.setState({ submitting: true });
    const setPasswordResponse = await setNewPassword(this.state.savedUsername, oldPassword, newPassword, this.state.loginState.requestState);
    // No response means there was an unknown error
    if (!setPasswordResponse) {
      return this.setState({
        submitting: false,
        statusMessage: "Something went wrong, check the browser console for details."
      });
    }
    // If we have finished login, then redirect after setting KMSI if required
    if (setPasswordResponse.postLoginRedirect) {
      return window.location.assign(setPasswordResponse.postLoginRedirect);
    }
    if (setPasswordResponse.errorMessage) {
      this.setState({
        submitting: false,
        statusMessage: setPasswordResponse.errorMessage
      });
      return;
    }
    this.setState({
      submitting: false,
      statusMessage: "",
      loginState: mapResponseToNewRequestState(this.state.loginState, setPasswordResponse)
    });
  }


  // Handler function for 'Forget a User'
  async handleClearKmsi(kmsiUser: KMSIConfiguration) {
    // Pass down 'please wait' to prevent double submissions
    this.setState({ submitting: true });
    const clearKmsiResponse = await clearKmsi(kmsiUser.ref);
    if (clearKmsiResponse) {
      // Clean up local storage
      clearKmsiEntry(kmsiUser);
      // Clean up the state
      const existingKmsi = this.state.existingKmsi.filter((value) => {
        return value.ref !== kmsiUser.ref;
      });
      this.setState({
        submitting: false,
        existingKmsi
      });
      return;
    } else {
      this.setState({ submitting: false, statusMessage: "Error while forgetting a user." });
    }



  }

  async handleSelectOtherEnrollmentFactor() {
    // Make an enrollment call to switch factors
    // Pass down 'please wait' to prevent double submissions
    this.setState({ submitting: true });
    const enrollmentReponse = await switchEnrollment(this.state.loginState.requestState);
    if (!enrollmentReponse) {
      this.setState({
        submitting: false,
        statusMessage: "Something went wrong, check the browser console for details."
      });
      return;
    }
    if (enrollmentReponse.errorCode) {
      this.setState({
        statusMessage: enrollmentReponse.errorMessage || "Error while enrolling"
      });
    } else {
      // Clear the status message
      this.setState({
        statusMessage: ""
      });
    }
    this.setState({
      submitting: false,
      loginState: mapResponseToNewRequestState(this.state.loginState, enrollmentReponse),
      enrollmentInitiated: false
    });
  }

  async handleInitiateEnrollment(factorName: AuthFactor, credentials?: MfaCredential) {
    // Pass down 'please wait' to prevent double submissions
    this.setState({ submitting: true });
    const enrollmentReponse = await initiateEnrollment(this.state.loginState.requestState, factorName, credentials);
    if (!enrollmentReponse) {
      this.setState({
        submitting: false,
        statusMessage: "Something went wrong, check the browser console for details."
      });
      return;
    }
    if (enrollmentReponse.errorCode) {
      // Hmm... Need to work out how to display this. Push status through the Enrollment layout?
      this.setState({
        statusMessage: enrollmentReponse.errorMessage || "Error while enrolling"
      });
    } else {
      // Clear the status message
      this.setState({
        statusMessage: ""
      });
    }
    // Update the request state with the values from the response
    // SMS and EMAIL both use the login screens to complete enrollment.
    enrollmentReponse.nextAuthFactors = enrollmentReponse.nextAuthFactors || [factorName];
    this.setState({
      submitting: false,
      loginState: enrollmentReponse,
      enrollUsesLoginScreen: factorName === "EMAIL" || factorName === "SMS",
      enrollmentInitiated: true
    });
    return;
  }

  async handleSkipEnrollment() {
    // Pass down 'please wait' to prevent double submissions
    this.setState({ submitting: true });
    let kmsiUserRef = null;
    if(this.state.initialKmsiRequested){
      kmsiUserRef = getNextKmsiRef(this.state.savedUsername);
    }
    const createSessionResponse = await createSession(this.state.loginState.requestState, this.state.initialKmsiRequested, kmsiUserRef);
    if (!createSessionResponse) {
      this.setState({
        submitting: false,
        statusMessage: "Something went wrong, check the browser console for details."
      });
      return;
    }
    // If we have finished login, then redirect after setting KMSI if required
    if (createSessionResponse.postLoginRedirect) {
      if (kmsiUserRef !== undefined && createSessionResponse.kmsiTokenSet) {
        storeKmsiSetting({ displayName: this.state.savedUsername, ref: kmsiUserRef });
      }
      return window.location.assign(createSessionResponse.postLoginRedirect);
    }
    // Probably should catch an unexpected lack of redirect url here?
  }

  async handleResendCode() {
    // Pass down 'please wait' to prevent double submissions
    this.setState({ submitting: true });
    const resendCodeJSON = await requestNewCode(this.state.loginState.requestState);
    if (!resendCodeJSON) {
      this.setState({
        submitting: false,
        statusMessage: "Something went wrong, check the browser console for details."
      });
      return;
    }
    // Update the loginState with the new state
    if (resendCodeJSON.errorCode) {
      this.setState({
        statusMessage: resendCodeJSON.errorMessage || "Error requesting new code."
      });
    } else {
      // Clear the status message
      this.setState({
        statusMessage: ""
      });
    }
    // Rebind the request-state
    const newLoginState: RequestState = JSON.parse(JSON.stringify(this.state.loginState));
    newLoginState.requestState = resendCodeJSON.requestState;
    this.setState({
      submitting: false,
      loginState: newLoginState
    });
    return;
  }

  async handleInitiateForgotPassword(userName: string, recoveryType?: PasswordRecoveryOption) {
    // Pass down 'please wait' to prevent double submissions
    this.setState({ submitting: true });
    const forgotPasswordResponse = await initiateForgotPassword(userName, recoveryType);
    if (!forgotPasswordResponse) {
      this.setState({
        submitting: false,
        statusMessage: "Something went wrong, check the browser console for details."
      });
      return;
    }
    this.setState({
      submitting: false,
      recoveryState: mapResponseToNewPasswordRecoveryState(this.state.recoveryState, forgotPasswordResponse)
    });
    return;
  }

  async handleValidateRecoveryCode(userName: string, otpCode: string, recoveryType: RecoveryOption) {
    // Pass down 'please wait' to prevent double submissions
    this.setState({ submitting: true });
    const validatePasscodeResponse = await validateRecoveryCode(userName, otpCode, recoveryType, this.state.recoveryState.deviceId, this.state.recoveryState.requestId);
    if (!validatePasscodeResponse) {
      this.setState({
        submitting: false,
        statusMessage: "Something went wrong, check the browser console for details."
      });
      return;
    }
    if (validatePasscodeResponse.token && validatePasscodeResponse.passwordResetUri) {
      return window.location.assign(validatePasscodeResponse.passwordResetUri + "?token=" + validatePasscodeResponse.token);
    }
    if (validatePasscodeResponse.errorCode) {
      // This is probably a validation failure.
      this.setState({
        submitting: false,
        statusMessage: validatePasscodeResponse.errorMessage || "Error validating passcode."
      });
    } else {
      // Clear the status message
      this.setState({
        submitting: false,
        statusMessage: ""
      });
    }
  }

  handleCancelRecoveryRequest() {
    this.setState({
      forgotPassword: false,
      recoveryState: {
        notificationType: null,
        options: [],
        notificationEmailAddress: null,
        recoveryNotificationDisplay: null,
        deviceId: null,
        requestId: null
      }
    });
  }

  handleRequestRecovery() {
    this.setState({ forgotPassword: true });
  }

  getLayout(): JSX.Element {
    // If we have initiated a forgotten password flow, render that unless it is cancelled.
    if (this.state.forgotPassword) {
      return (<PasswordRecoveryLayout
        submissionInProgress={this.state.submitting}
        handleInitiateForgotPassword={this.handleInitiateForgotPassword}
        handleCancelRecoveryRequest={this.handleCancelRecoveryRequest}
        handleValidateRecoveryCode={this.handleValidateRecoveryCode}
        recoveryState={this.state.recoveryState}
        redwoodTheme={this.props.redwoodTheme}
        statusMessage={this.state.statusMessage}
      />)
    }
    // If we need to change our password due to expiry or 'mustChange' flags, we
    // need to render the Password Change screen
    if (this.state.loginState.nextOp?.includes(PASSWORD_CHANGE_OPERATION)) {
      return (
        <UpdateExpiredPasswordForm
          submissionInProgress={this.state.submitting}
          passwordPolicy={this.state.loginState.passwordPolicy}
          handleSetPassword={this.handleSetNewPassword}
          redwoodTheme={this.props.redwoodTheme}
          statusMessage={this.state.statusMessage}
        />
      )
    }
    // If one of the next operations is enrollment, we need to show the enrollment screen
    // The exception to this is when we use the same screen for Factor validation as for
    // Enrollment. This is true of Email and SMS.
    if (!this.state.enrollUsesLoginScreen && this.state.loginState.nextOp?.includes(ENROLL_OPERATION)) {
      return (
        <EnrollmentLayout
          loginState={this.state.loginState}
          submissionInProgress={this.state.submitting}
          enrollmentInitiated={this.state.enrollmentInitiated}
          enrollmentRequired={this.state.loginState.mfaSettings?.enrollmentRequired}
          handleInitiateEnrollment={this.handleInitiateEnrollment}
          handleSkipEnrollment={this.handleSkipEnrollment}
          handleCredentialSubmit={this.handleCredentialSubmit}
          handleSelectOtherEnrollmentFactor={this.handleSelectOtherEnrollmentFactor}
          redwoodTheme={this.props.redwoodTheme}
        />
      );
    }
    if (this.state.loginState.nextOp?.includes(LOGIN_OPERATION)) {
      return (
        <LoginLayout
          submissionInProgress={this.state.submitting}
          loginState={this.state.loginState}
          statusMessage={this.state.statusMessage}
          existingKmsi={this.state.existingKmsi}
          savedUsername={this.state.savedUsername}
          redwoodTheme={this.props.redwoodTheme}
          showFactorSelection={this.state.allowSelectFactor}
          handleCredentialSubmit={this.handleCredentialSubmit}
          handleClearKmsi={this.handleClearKmsi}
          handleResendCode={this.handleResendCode}
          handleBypassKmsi={this.handleKmsiBypass}
          handleRequestPasswordRecovery={this.handleRequestRecovery}
          bypassKmsi={this.state.bypassKmsi}
        />
      );
    }
    // Default - which should only happen if this has been called with no context
    // i.e. from a GET, rather than a POST from IDCS.
    return (<div className="login-content-container">
      <span className="login-spacer" />
      <StatusText
        message="Cannot access /login directly. Do not bookmark this page."
        submissionInProgress={false}
        severity="info"
      />
    </div>)
  }

  render() {
    return (<div className={"login-layout" + (this.props.redwoodTheme ? " redwood" : "")}>
      {this.getLayout()}
    </div>);
  }
}
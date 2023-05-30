/* tslint:disable:no-console */

/*
 * Top level handler for drawing the MFA Enrollment screens
 */


import React, { Component } from 'react';
import EnrollmentFactorSelection from './EnrollmentFactorSelection';

import { factorDetails } from '../../util/factorDetailsUtil';
import { AuthFactor, MfaCredential, RequestState } from '../../types/idcsTypes';
import EnrollSms from './factors/EnrollSms';
import { InterfaceCredentials } from '../../types/uiTypes';
import EnrollOfflineTotp from './factors/EnrollOfflineTotp';
import EnrollOnlinePush from './factors/EnrollOnlinePush';

const SMS_FACTOR = "SMS";
const TOTP_FACTOR = "TOTP";
const EMAIL_FACTOR = "EMAIL";
const PUSH_FACTOR = "PUSH";

interface EnrollmentLayoutProps {
  loginState: RequestState;
  submissionInProgress: boolean;
  enrollmentRequired: boolean;
  enrollmentInitiated: boolean;
  handleInitiateEnrollment: (factorName: AuthFactor, credentials?:MfaCredential) => void;
  handleSkipEnrollment: () => void;
  handleCredentialSubmit: (submittedUsername: string, credentials: InterfaceCredentials, authFactor:AuthFactor, keepMeSignedIn?:boolean) => void;
  handleSelectOtherEnrollmentFactor: () => void;
  redwoodTheme: boolean;
};

interface State {
  enrollingFactor: string;
}

export default class EnrollmentLayout extends Component<EnrollmentLayoutProps, State> {
  constructor(props: EnrollmentLayoutProps) {
    super(props);
    this.state = {
      enrollingFactor: null
    }
    // Binds
    this.handleSelectEnrollmentFactor = this.handleSelectEnrollmentFactor.bind(this);
    this.handleSelectOther = this.handleSelectOther.bind(this);
  }

  handleSelectEnrollmentFactor(factorName:AuthFactor):void{
    if(!factorDetails[factorName]){
      console.log(`Factor ${factorName} is not configured.`);
      return;
    }
    this.setState({enrollingFactor: factorName});
    if(factorDetails[factorName].enrollNoDetails){
      return this.props.handleInitiateEnrollment(factorName, factorDetails[factorName].defaultCredentials);
    }
    // EMAIL has some additional checks, since a recovery email can automatically
    // be used for MFA without specifying it.
    if(factorName === EMAIL_FACTOR && this.props.loginState.EnrolledAccountRecoveryFactorsDetails?.enrolledAccRecFactorsList.includes(EMAIL_FACTOR)){
      return this.props.handleInitiateEnrollment(factorName);
    }
  }

  handleSelectOther():void{
    // Clear the enrollment factor, which will bring up
    // the Factor selection again.
    this.setState({enrollingFactor: ""});
    if(this.props.enrollmentInitiated){
      // If we have kicked off the flow with IDCS, we need to cancel it.
      this.props.handleSelectOtherEnrollmentFactor();
    }

  }

  render() {
    let layout:JSX.Element;
    switch(this.state.enrollingFactor){
      case SMS_FACTOR:
        layout = (<EnrollSms
        submissionInProgress={this.props.submissionInProgress}
        handleEnroll={this.props.handleInitiateEnrollment}
        handleSelectOther={this.handleSelectOther}
        redwoodTheme={this.props.redwoodTheme}
        />);
        break;
      case TOTP_FACTOR:
        layout = (<EnrollOfflineTotp
          submissionInProgress={this.props.submissionInProgress}
          handleCredentialSubmit={this.props.handleCredentialSubmit}
          handleSelectOther={this.handleSelectOther}
          qrImageData={this.props.loginState.TOTP?.qrCode?.imageData || ""}
          imageType={this.props.loginState.TOTP?.qrCode?.imageType || ""}
          redwoodTheme={this.props.redwoodTheme}
        />)
        break;
      case PUSH_FACTOR:
        layout = (<EnrollOnlinePush
          submissionInProgress={this.props.submissionInProgress}
          handleCredentialSubmit={this.props.handleCredentialSubmit}
          handleSelectOther={this.handleSelectOther}
          qrImageData={this.props.loginState.PUSH?.qrCode?.imageData || ""}
          imageType={this.props.loginState.PUSH?.qrCode?.imageType || ""}
          redwoodTheme={this.props.redwoodTheme}
        />);
        break;
      // Not sure if we need other factors
      default:
        layout = (<EnrollmentFactorSelection
          validFactors={this.props.loginState.nextAuthFactors}
          submissionInProgress={this.props.submissionInProgress}
          enrollmentRequired={this.props.enrollmentRequired}
          handleSelectEnrollmentFactor={this.handleSelectEnrollmentFactor}
          handleSkipEnrollment={this.props.handleSkipEnrollment}
          redwoodTheme={this.props.redwoodTheme}
        />);
    }
    return (<div className="login-content-container">
      <h3>Enable Multi-Factor Authentication</h3>
      {layout}
    </div>)
  }
}
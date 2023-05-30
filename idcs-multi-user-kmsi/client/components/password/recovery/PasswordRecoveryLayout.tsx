/* tslint:disable:no-console */
import React, { Component } from 'react';

import "../../../css/userNamePasswordForm.css";
import "../../../css/button.css";
import "../../../css/credentialInput.css";
import StatusText from '../../common/StatusText';
import RequestPasswordRecoveryForm from './RequestPasswordRecoveryForm';
import { PasswordRecoveryOption, RecoveryOption } from '../../../types/idcsTypes';
import RecoveryFactorSelection from './RecoveryFactorSelection';
import { recoveryDetails } from '../../../util/recoveryDetailsUtil';
import ValidateSMSRecoveryForm from './ValidateSMSRecoveryForm';
import { PasswordRecoveryState } from '../../../types/uiTypes';

/*
 * Username Password Form for basic username/password logins
 */
interface PasswordRecoveryLayoutProps {
  submissionInProgress: boolean;
  handleValidateRecoveryCode: (userName:string, otpCode:string, recoveryType: RecoveryOption) => void;
  handleInitiateForgotPassword: (userName: string, recoveryType?: PasswordRecoveryOption) => void;
  handleCancelRecoveryRequest: () => void;
  recoveryState: PasswordRecoveryState;
  redwoodTheme: boolean;
  statusMessage?: string;
}

type State = {
  userName: string;
}

export default class PasswordRecoveryLayout extends Component<PasswordRecoveryLayoutProps, State>{
  constructor(props: PasswordRecoveryLayoutProps) {
    super(props);
    this.state = { userName: this.props.recoveryState.recoveryNotificationDisplay || "" }
    this.handleInitiateForgotPassword = this.handleInitiateForgotPassword.bind(this);
    this.handleValidateRecoveryCode = this.handleValidateRecoveryCode.bind(this);
  }

  handleInitiateForgotPassword(userName: string, recoveryType?: PasswordRecoveryOption) {
    if (this.props.submissionInProgress) {
      return;
    }
    this.setState({ userName });
    this.props.handleInitiateForgotPassword(userName, recoveryType)
  }

  handleValidateRecoveryCode(recoveryType: RecoveryOption, otpCode: string){
    if (this.props.submissionInProgress) {
      return;
    }
    this.props.handleValidateRecoveryCode(this.state.userName, otpCode, recoveryType);
  }

  getPasswordRecoveryComponent(): JSX.Element {
    if (this.props.recoveryState.notificationType && this.props.recoveryState.notificationType === 'email') {
      return (<div>{recoveryDetails[this.props.recoveryState.notificationType].getPostRequestDescription(this.state.userName)}</div>)
    }
    if (this.props.recoveryState.notificationType && this.props.recoveryState.notificationType === 'sms') {
      return (<ValidateSMSRecoveryForm
          notificationType={this.props.recoveryState.notificationType}
          displayName={this.state.userName}
          submissionInProgress={this.props.submissionInProgress}
          handleCredentialSubmit={this.handleValidateRecoveryCode}
          handleCancelRecoveryRequest={this.props.handleCancelRecoveryRequest}
          redwoodTheme={this.props.redwoodTheme}
        />)
    }
    if (this.props.recoveryState.options && this.props.recoveryState.options.length > 1) {
      return (<RecoveryFactorSelection
        recoveryOptions={this.props.recoveryState.options}
        submissionInProgress={this.props.submissionInProgress}
        handleInitiateForgotPassword={this.handleInitiateForgotPassword}
        handleCancelRecoveryRequest={this.props.handleCancelRecoveryRequest}
        userName={this.state.userName}
        redwoodTheme={this.props.redwoodTheme}
      />)
    }
    return (<RequestPasswordRecoveryForm
      submissionInProgress={this.props.submissionInProgress}
      handleInitiateForgotPassword={this.handleInitiateForgotPassword}
      handleCancelRecoveryRequest={this.props.handleCancelRecoveryRequest}
      redwoodTheme={this.props.redwoodTheme}
    />);
  }

  render() {
    return (
      <div className="login-content-container">
        <span className="login-spacer"/>
        <StatusText
          submissionInProgress={this.props.submissionInProgress}
          severity="info"
          message={this.props.statusMessage || ""}
        />
        <h3>{this.props.recoveryState.notificationType==="email"?"Password Reset Notification Sent":"Forgot Your Password?"}</h3>
        {this.getPasswordRecoveryComponent()}
      </div>
    );
  }
}
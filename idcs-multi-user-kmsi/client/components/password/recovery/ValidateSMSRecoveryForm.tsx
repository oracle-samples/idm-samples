/* tslint:disable:no-console */
import React, { Component } from 'react';

import "../../../css/userNamePasswordForm.css";
import "../../../css/button.css";
import "../../../css/credentialInput.css";
import { recoveryDetails } from '../../../util/recoveryDetailsUtil';
import { RecoveryOption } from '../../../types/idcsTypes';

/*
 * Username Password Form for basic username/password logins
 */
interface ValidateSMSRecoveryFormProps {
  notificationType: RecoveryOption;
  displayName: string;
  submissionInProgress: boolean;
  handleCredentialSubmit: (type: RecoveryOption, otpCode: string) => void;
  handleCancelRecoveryRequest: () => void;
  redwoodTheme: boolean;
}

type State = {
  otpCode: string
}

export default class ValidateSMSRecoveryForm extends Component<ValidateSMSRecoveryFormProps, State>{
  constructor(props: ValidateSMSRecoveryFormProps) {
    super(props);
    this.state = {
      otpCode: ""
    };
    this.handleFormSubmission = this.handleFormSubmission.bind(this);
    this.handleOtpChange = this.handleOtpChange.bind(this);
    this.checkSubmit = this.checkSubmit.bind(this);
  }

  handleFormSubmission() {
    // Avoid double submission
    if (this.props.submissionInProgress) {
      return;
    }
    this.props.handleCredentialSubmit(this.props.notificationType, this.state.otpCode);
  }

  handleOtpChange(event: React.ChangeEvent<HTMLInputElement>) {
    this.setState({ otpCode: event.currentTarget.value });
  }


  checkSubmit(event: React.KeyboardEvent<HTMLInputElement>): void {
    // If we hit Enter in the last field, submit the form.
    if (event.code === "Enter") {
      this.handleFormSubmission();
    }
  }

  render() {
    return (
      <div className="username-password-container">
        {recoveryDetails[this.props.notificationType].getVerifyDescription(this.props.displayName)}
        <div className="credential-input-container">
          <div className="credential-label">Enter Passcode:</div>
          <input
            className="credential-input"
            type="text"
            value={this.state.otpCode}
            onChange={this.handleOtpChange}
            onKeyDown={this.checkSubmit}
            placeholder="123456"
          />
        </div>
        <div
          className={"flat-button action toppad" + (this.props.redwoodTheme ? " redwood" : "")}
          onClick={this.handleFormSubmission}
        >Verify</div>
        <div
          className="alternate-action-text"
          onClick={this.props.handleCancelRecoveryRequest}
        >
          Cancel
        </div>
      </div>
    );
  }
}
/* tslint:disable:no-console */
import React, { Component } from 'react';

import "../../../css/userNamePasswordForm.css";
import "../../../css/button.css";
import "../../../css/credentialInput.css";

/*
 * Username Password Form for basic username/password logins
 */
interface RequestPasswordRecoveryFormProps {
  submissionInProgress: boolean;
  handleInitiateForgotPassword: (userName: string) => void;
  handleCancelRecoveryRequest: () => void;
  redwoodTheme: boolean;
}

type State = {
  userName: string
}

export default class RequestPasswordRecoveryForm extends Component<RequestPasswordRecoveryFormProps, State>{
  constructor(props: RequestPasswordRecoveryFormProps) {
    super(props);
    this.state = {
      userName: ""
    };
    this.handleFormSubmission = this.handleFormSubmission.bind(this);
    this.handleUsernameChange = this.handleUsernameChange.bind(this);
    this.checkSubmit = this.checkSubmit.bind(this);
  }

  handleFormSubmission() {
    // Avoid double submission
    if (this.props.submissionInProgress) {
      return;
    }
    this.props.handleInitiateForgotPassword(this.state.userName);
  }

  handleUsernameChange(event: React.ChangeEvent<HTMLInputElement>) {
    this.setState({ userName: event.currentTarget.value });
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
        Having trouble with your password? Reset it here.
        <div className="credential-input-container">
          <div className="credential-label">What's your user name?</div>
          <input
            className="credential-input"
            type="text"
            value={this.state.userName}
            onChange={this.handleUsernameChange}
            onKeyDown={this.checkSubmit}
            placeholder="Enter user name"
          />
        </div>
        <div
          className={"flat-button action toppad" + (this.props.redwoodTheme ? " redwood" : "")}
          onClick={this.handleFormSubmission}
        >Next</div>
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
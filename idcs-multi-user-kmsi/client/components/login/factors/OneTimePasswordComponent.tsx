/* tslint:disable:no-console */
import React, { Component } from 'react';
import { InterfaceCredentials } from '../../../types/uiTypes';

import "../../../css/userNamePasswordForm.css";
import "../../../css/button.css";
import "../../../css/credentialInput.css";


/*
 * Sub-component for handling OTP entries
 */
interface OneTimePasswordComponentProps {
  initialUsername: string;
  submissionInProgress: boolean;
  credentials: string[];
  handleCredentialSubmit: (submittedUsername: string, credentials: InterfaceCredentials, keepMeSignedIn?:boolean) => void;
  redwoodTheme: boolean;
};

type State = {
  otp:string;
}

export default class OneTimePasswordComponent extends Component<OneTimePasswordComponentProps, State> {
  // OTP reference used for focus behaviour
  otpfield:HTMLInputElement;

  constructor(props: OneTimePasswordComponentProps) {
    super(props);
    this.state = {
      otp:""
    };
    // Binds
    this.handleFormChange = this.handleFormChange.bind(this);
    this.handleFormSubmission = this.handleFormSubmission.bind(this);
    this.checkSubmit = this.checkSubmit.bind(this);
  }

  componentDidMount(): void {
    if(this.otpfield){
      this.otpfield.focus()
    }
  }

  handleFormSubmission(){
    const credentials: InterfaceCredentials = {};
    // Map the OTP to whatever requried credentials caused us to render this...
    for(const field of this.props.credentials){
      credentials[field] = this.state.otp;
    }
    this.props.handleCredentialSubmit(this.props.initialUsername, credentials);
    // Clear the OTP field, because in every outcome it should be empty
    this.setState({otp:""});

  }

  handleFormChange(event: React.FormEvent<HTMLInputElement>):void{
    this.setState({otp: event.currentTarget.value.toUpperCase()});
  }

  //
  checkSubmit(event: React.KeyboardEvent<HTMLInputElement>):void{
    // If we hit Enter in the OTP, submit the form.
    if(event.code === "Enter" && event.currentTarget === this.otpfield){
      this.handleFormSubmission();
    }
  }

  render() {
    const self = this;
    if(this.props.submissionInProgress){
      return (<div className="username-password-container">
        <p>Submitting Credentials...</p>
      </div>);
    }
    return (
      <div className="username-password-container">
        <div className="credential-input-container">
        <div className="credential-label">Verification Code</div>
        <input
          className="credential-input"
          type="text"
          value={this.state.otp}
          onChange={this.handleFormChange}
          placeholder="123456"
          ref={(input) => { this.otpfield = input; }}
          onKeyDown={self.checkSubmit}
        />
      </div>
        <div
          className={"flat-button action toppad"+(this.props.redwoodTheme?" redwood":"")}
          onClick={this.handleFormSubmission}
        >Verify</div>
      </div>
    );
  }
}
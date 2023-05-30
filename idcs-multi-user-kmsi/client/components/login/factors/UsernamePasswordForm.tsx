/* tslint:disable:no-console */
import React, { Component } from 'react';
import { InterfaceCredentials } from '../../../types/uiTypes';

import "../../../css/userNamePasswordForm.css";
import "../../../css/button.css";
import "../../../css/credentialInput.css";
import { AuthFactor } from '../../../types/idcsTypes';

const USERNAMEPASS_FACTOR = "USERNAME_PASSWORD";
const USERNAME_CREDENTIAL = "username";
const PASSWORD_CREDENTIAL = "password";

/*
 * Username Password Form for basic username/password logins
 */
interface UsernamePasswordFormProps {
  initialUsername: string;
  submissionInProgress: boolean;
  credentials: string[];
  keepMeSignedInEnabled: boolean;
  handleCredentialSubmit: (submittedUsername: string, credentials: InterfaceCredentials, authFactor:AuthFactor, keepMeSignedIn:boolean) => void;
  handleRequestPasswordRecovery: () => void;
  redwoodTheme: boolean;
};

type State = {
  credentials: InterfaceCredentials;
  kmsi: boolean;
}

export default class UsernamePasswordForm extends Component<UsernamePasswordFormProps, State> {
  // Array of input fields, used to determine focus behaviour
  fields:HTMLInputElement[];

  constructor(props: UsernamePasswordFormProps) {
    super(props);
    this.state = {
      credentials:{},
      kmsi: false
    };
    for(const field of this.props.credentials){
      this.state.credentials[field] = "";
      if(field === USERNAME_CREDENTIAL && props.initialUsername){
        this.state.credentials[field] = props.initialUsername;
      }
    }
    this.fields = []
    // Binds
    this.handleFormChange = this.handleFormChange.bind(this);
    this.handleFormSubmission = this.handleFormSubmission.bind(this);
    this.handleKMSIChange = this.handleKMSIChange.bind(this);
    this.checkSubmit = this.checkSubmit.bind(this);
  }

  componentDidMount(): void {
    // Iterate through the fields, and add focus to the first empty one.
    // Useful when we are injecting the username using props.
    for(const field of this.fields){
      if(!field.value){
        field.focus();
        return;
      }
    }
  }

  handleFormSubmission(){
    const credentials: InterfaceCredentials = {};
    let username = "";
    // gather the required credentials
    for(const field of this.props.credentials){
      if(field === USERNAME_CREDENTIAL){
        username = this.state.credentials[field];
      }
      credentials[field] = this.state.credentials[field];
    }
    if(!username){
      username = this.props.initialUsername;
    }
    this.props.handleCredentialSubmit(username, credentials, USERNAMEPASS_FACTOR, this.state.kmsi);
    // Clear the password field, because in every outcome it should be empty
    if(this.props.credentials.includes(PASSWORD_CREDENTIAL)){
      const newCredentials = JSON.parse(JSON.stringify(this.state.credentials));
      newCredentials[PASSWORD_CREDENTIAL] = "";
      this.setState({credentials: newCredentials});
    }

  }

  handleFormChange(event: React.FormEvent<HTMLInputElement>):void{
    // Crude object clone
    const newCreds = JSON.parse(JSON.stringify(this.state.credentials));
    newCreds[event.currentTarget.id] = event.currentTarget.value
    // use the id of the event target to update the correct state entry
    this.setState({credentials: newCreds});
  }

  //
  checkSubmit(event: React.KeyboardEvent<HTMLInputElement>):void{
    // If we hit Enter in the last field, submit the form.
    if(event.code === "Enter" && event.currentTarget === this.fields[this.fields.length-1]){
      this.handleFormSubmission();
    }
  }

  handleKMSIChange(event: React.ChangeEvent<HTMLInputElement>){
    this.setState({kmsi: event.currentTarget.checked});
  }

  render() {
    const self = this;
    if(this.props.submissionInProgress){
      return (<div className="username-password-container">
        <p>Submitting Credentials...</p>
      </div>);
    }
    // Dynamically populate the form with the fields from the authn context
    let passwordPresent = false;
    const fields = this.props.credentials.map((field, index) => {
      if(field === PASSWORD_CREDENTIAL){
        passwordPresent = true;
      }
      return (<div key={index} className="credential-input-container">
        <div className="credential-label">{field.substring(0, 1).toUpperCase() + field.substring(1)}</div>
        <input
          className="credential-input"
          id={field}
          type={field === PASSWORD_CREDENTIAL ? "password" : "text"}
          value={self.state.credentials[field]}
          onChange={self.handleFormChange}
          placeholder={field.substring(0, 1).toUpperCase() + field.substring(1)}
          ref={(input) => { this.fields.push(input) }}
          onKeyDown={self.checkSubmit}
          autoComplete="off"
        />
      </div>);
    });
    let keepMySignedIn: JSX.Element = null;
    if(this.props.keepMeSignedInEnabled && passwordPresent){
      keepMySignedIn = (<div className="sign-in-options-container inline">
        <input
          className="credential-input checkbox inline-left"
          type="checkbox"
          value="kmsi"
          checked={this.state.kmsi}
          onChange={self.handleKMSIChange}
        />
        <div className="credential-label inline">Keep me signed in</div>
      </div>);
    }
    return (
      <div className="username-password-container">
        {fields}
        {keepMySignedIn}
        <div
          className={"flat-button action"+(this.props.redwoodTheme?" redwood":"")+(!this.props.keepMeSignedInEnabled||!passwordPresent?" toppad":"")}
          onClick={this.handleFormSubmission}
        >Sign In</div>
        <div
          className="alternate-action-text"
          onClick={this.props.handleRequestPasswordRecovery}
        >
          Need help signing in? Click here
        </div>
      </div>
    );
  }
}
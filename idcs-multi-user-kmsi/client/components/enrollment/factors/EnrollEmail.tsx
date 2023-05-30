/* tslint:disable:no-console */
import React, { ChangeEvent, Component } from 'react';
import 'whatwg-fetch'
import { AuthFactor, MfaCredential } from '../../../types/idcsTypes';
import { CountryCode } from '../../../types/uiTypes';
import { factorDetails } from '../../../util/factorDetailsUtil';


import '../../../css/select.css'
import '../../../css/credentialInput.css'
import '../../../css/button.css'

const EMAIL_FACTOR = "EMAIL";

//const EMAIL_REGEX = /^([!#$%&'*+\-\/=?^_`{|}~\w]+\.){0,}[!#$%&'*+\-\/=?^_`{|}~\w]+@\w+([\.-]?\w+)*$/
/*
 * Handler for gathering email address if not already provided
 */
interface EnrollEmailProps {
  submissionInProgress: boolean;
  handleEnroll: (factorName: AuthFactor, credentials?:MfaCredential) => void;
  handleSelectOther: () => void;
  redwoodTheme: boolean;
};

interface State {
  emailAddress: string
}

export default class EnrollEmail extends Component<EnrollEmailProps, State> {
  getCountryCodeController: AbortController;

  constructor(props: EnrollEmailProps) {
    super(props);
    this.state = {
      emailAddress: ""
    }
    // Binds
    this.handleEmailChange = this.handleEmailChange.bind(this);
    this.handleSubmission = this.handleSubmission.bind(this);
  }

  handleEmailChange(event:ChangeEvent<HTMLInputElement>){
    this.setState({emailAddress:event.target.value});
  }

  componentWillUnmount(): void {
    this.getCountryCodeController.abort();
  }

  handleSubmission(): void {
    console.log("Email submitted...")
    // Avoid double submission
    if(this.props.submissionInProgress){
      return;
    }
    // Validate the values TODO: this?
    //
    if(!this.state.emailAddress){
      return;
    }
    // Reformat the phone number and country code
    // Strip spaces and dashes from the phone number
    // Strip the Country Letters and prefix with "+"
    const credentials:MfaCredential = {
      phoneNumber:this.state.emailAddress.replace(/[\s-]/g, ""),
    }
    console.log("Submitting: " +JSON.stringify(credentials));
    this.props.handleEnroll(EMAIL_FACTOR, credentials);
  }

  render(){
    return (<div>
      {factorDetails[EMAIL_FACTOR].enrollmentDescription}
      <div className="credential-input-container">
        <div className="credential-label">Email Address:</div>
        <div className="credential-input-container inline nopad">
          <input
            className="credential-input inline-right"
            type="text"
            value={this.state.emailAddress}
            onChange={this.handleEmailChange}
            placeholder="abc@abc.abc"
          />
        </div>
      </div>

      <div
        className={"flat-button action toppad"+(this.props.redwoodTheme?" redwood":"")}
        onClick={this.handleSubmission}
      >
        Send Code
      </div>
      <div
        className="alternate-action-text"
        onClick={this.props.handleSelectOther}
      >
        Enroll a Different Factor
      </div>
    </div>)
  }
}
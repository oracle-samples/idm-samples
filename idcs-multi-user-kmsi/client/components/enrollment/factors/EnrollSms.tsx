/* tslint:disable:no-console */
import React, { ChangeEvent, Component } from 'react';
import 'whatwg-fetch'
import { AuthFactor, MfaCredential } from '../../../types/idcsTypes';
import { CountryCode } from '../../../types/uiTypes';
import { factorDetails } from '../../../util/factorDetailsUtil';


import '../../../css/select.css'
import '../../../css/credentialInput.css'
import '../../../css/button.css'

const SMS_FACTOR = "SMS";
/*
 * Handler for gathering phone number information
 */
interface EnrollSmsProps {
  submissionInProgress: boolean;
  handleEnroll: (factorName: AuthFactor, credentials?:MfaCredential) => void;
  handleSelectOther: () => void;
  redwoodTheme: boolean;
};

interface State {
  countryCodes: CountryCode[]
  countryCode: string
  phoneNumber: string
}

export default class EnrollSms extends Component<EnrollSmsProps, State> {
  getCountryCodeController: AbortController;

  constructor(props: EnrollSmsProps) {
    super(props);
    this.state = {
      countryCodes: [{label:"", value:""}],
      countryCode: "",
      phoneNumber: ""
    }
    // Abort handlers so we can cancel requests on unmount.
    this.getCountryCodeController = new AbortController();
    // Binds
    this.handleNumberChange = this.handleNumberChange.bind(this);
    this.handleSelect = this.handleSelect.bind(this);
    this.handleSubmission = this.handleSubmission.bind(this);
  }

  // Dynamically retrieve the country codes
  async componentDidMount(): Promise<void> {
    if(this.state.countryCodes.length === 1){
      try{
        const countryCodeResponse = await fetch('/res/countrycodes', {signal: this.getCountryCodeController.signal});
        const countryCodes = await countryCodeResponse.json() as CountryCode[];
        this.setState({countryCodes: [{label:"", value:""}].concat(countryCodes)});
      }catch(error){
        if(error.name !== "AbortError"){
          console.error(error);
        }
      }
    }
  }

  handleSelect(event:ChangeEvent<HTMLSelectElement>){
    this.setState({countryCode:event.target.value});
  }

  handleNumberChange(event:ChangeEvent<HTMLInputElement>){
    // check if the updated value only contains numbers, dashes or spaces
    if(/^[\d -]*$/.test(event.target.value)){
      this.setState({phoneNumber:event.target.value})
    }
  }

  componentWillUnmount(): void {
    this.getCountryCodeController.abort();
  }

  handleSubmission(): void {
    console.log("SMS submitted...")
    // Avoid double submission
    if(this.props.submissionInProgress){
      return;
    }
    // Validate the values
    if(!this.state.countryCode || !this.state.phoneNumber){
      return;
    }
    // Reformat the phone number and country code
    // Strip spaces and dashes from the phone number
    // Strip the Country Letters and prefix with "+"
    const credentials:MfaCredential = {
      phoneNumber:this.state.phoneNumber.replace(/[\s-]/g, ""),
      countryCode:"+" +this.state.countryCode.replace(/[A-Z]+_/, "")
    }
    console.log("Submitting: " +JSON.stringify(credentials));
    this.props.handleEnroll(SMS_FACTOR, credentials);
  }

  render(){
    const countryCodes = this.state.countryCodes.map((code, i) => (
      <option value={code.value} key={"countryCode" +i}>{code.label}</option>
    ))
    return (<div>
      {factorDetails[SMS_FACTOR].enrollmentDescription}
      <div className="credential-input-container">
        <div className="credential-label">Phone Number:</div>
        <div className="credential-input-container inline nopad">
          <select
            className="flat-select inline"
            onChange={this.handleSelect}
            value={this.state.countryCode}
          >
            {countryCodes}
          </select>
          <input
            className="credential-input inline-right"
            type="text"
            value={this.state.phoneNumber}
            onChange={this.handleNumberChange}
            placeholder="123456789"
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
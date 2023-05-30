/* tslint:disable:no-console */
import React, { Component } from 'react';
import 'whatwg-fetch'
import { InterfaceCredentials } from '../../../types/uiTypes';
import { factorDetails } from '../../../util/factorDetailsUtil';


import '../../../css/select.css'
import '../../../css/credentialInput.css'
import '../../../css/button.css'
import '../../../css/qrcode.css'
import OneTimePasswordComponent from '../../login/factors/OneTimePasswordComponent';
import ProgressSpinner from '../../common/ProgressSpinner';
import { AuthFactor } from '../../../types/idcsTypes';

const TOTP_FACTOR = "TOTP";
const TOTP_CREDENTIALS = ["otpCode"];
/*
 * Handler for generating QR code to scan
 */
interface EnrollOfflineTotpProps {
  submissionInProgress: boolean;
  handleCredentialSubmit: (submittedUsername: string, credentials: InterfaceCredentials, authFactor:AuthFactor, keepMeSignedIn?:boolean) => void;
  handleSelectOther: () => void;
  qrImageData: string;
  imageType: string;
  redwoodTheme: boolean;
};

export default class EnrollOfflineTotp extends Component<EnrollOfflineTotpProps> {

  constructor(props: EnrollOfflineTotpProps) {
    super(props);
    this.state = {}
    this.handleCredentialSubmit = this.handleCredentialSubmit.bind(this);
  }
  handleCredentialSubmit(submittedUsername:string, credentials:InterfaceCredentials){
    this.props.handleCredentialSubmit(submittedUsername, credentials, TOTP_FACTOR);
  }

  render(){
    let qrCode:JSX.Element;
    if(this.props.qrImageData){
      qrCode = (<img src={`data:${this.props.imageType.toLowerCase()};base64, ${this.props.qrImageData}`}/>);
    }else{
      qrCode = (<ProgressSpinner />);
    }
    return (<div>
      {factorDetails[TOTP_FACTOR].enrollmentDescription}
      <div className="enroll-qr">
        {qrCode}
      </div>
      <OneTimePasswordComponent
        submissionInProgress={this.props.submissionInProgress}
        credentials={TOTP_CREDENTIALS}
        initialUsername={""}
        handleCredentialSubmit={this.handleCredentialSubmit}
        redwoodTheme={this.props.redwoodTheme}
      />
      <div
        className="alternate-action-text"
        onClick={this.props.handleSelectOther}
      >
        Enroll a Different Factor
      </div>
    </div>)
  }
}
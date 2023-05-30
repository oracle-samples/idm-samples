/* tslint:disable:no-console */
import React, { Component } from 'react';
import 'whatwg-fetch'
import { factorDetails } from '../../../util/factorDetailsUtil';


import '../../../css/select.css'
import '../../../css/credentialInput.css'
import '../../../css/button.css'
import '../../../css/qrcode.css'
import { InterfaceCredentials } from '../../../types/uiTypes';
import ProgressSpinner from '../../common/ProgressSpinner';
import { AuthFactor } from '../../../types/idcsTypes';

const PUSH_FACTOR = "PUSH";
// How often to check if enrollment has completed
const POLL_INTERVAL = 2000;

/*
 * Handler for generating QR code to scan, then poll for completion
 */
interface EnrollOnlinePushProps {
  submissionInProgress: boolean;
  handleCredentialSubmit: (submittedUsername: string, credentials: InterfaceCredentials, authFactor:AuthFactor, keepMeSignedIn?:boolean) => void;
  handleSelectOther: () => void;
  qrImageData: string;
  imageType: string;
  redwoodTheme: boolean;
};

interface State {
  pollIntervalId: ReturnType<typeof setInterval>
}

export default class EnrollOnlinePush extends Component<EnrollOnlinePushProps, State> {

  constructor(props: EnrollOnlinePushProps) {
    super(props);
    this.state = {
      pollIntervalId: null
    }
  }

  componentDidMount() {
    const intervalId = setInterval(()=>{
      if(!this.props.submissionInProgress){
        this.props.handleCredentialSubmit("", {}, PUSH_FACTOR);
      }
    }, POLL_INTERVAL);
    this.setState({pollIntervalId: intervalId});
  }

  componentWillUnmount(){
    // Safety clear of the polling instruction
    if(this.state.pollIntervalId){
      clearInterval(this.state.pollIntervalId);
    }
  }

  render(){
    let qrCode:JSX.Element;
    if(this.props.qrImageData){
      qrCode = (<img src={`data:${this.props.imageType.toLowerCase()};base64, ${this.props.qrImageData}`}/>);
    }else{
      qrCode = (<ProgressSpinner />);
    }
    return (<div>
      {factorDetails[PUSH_FACTOR].enrollmentDescription}
      <div className="enroll-qr">
        {qrCode}
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
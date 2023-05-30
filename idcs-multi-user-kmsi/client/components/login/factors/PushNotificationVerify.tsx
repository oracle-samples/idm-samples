/* tslint:disable:no-console */
import React, { Component } from 'react';
import { InterfaceCredentials } from '../../../types/uiTypes';

import "../../../css/userNamePasswordForm.css";
import { factorDetails } from '../../../util/factorDetailsUtil';
import ProgressSpinner from '../../common/ProgressSpinner';
import { DeviceMobileIcon } from '@primer/octicons-react';
import { AuthFactor, MfaCredential } from '../../../types/idcsTypes';

// How often to check if login has completed
const POLL_INTERVAL = 2000;

const PUSH_FACTOR = "PUSH"
const DEVICE_ID_CREDENTIAL = "deviceId";
const PREFERRED_CREDENTIAL = "preferred";

/*
 * Login Handler for PUSH, which polls for completion against IDCS.
 */
interface PushNotificationVerifyProps {
  initialUsername: string;
  displayName?: string;
  selectedDeviceId?: string;
  submissionInProgress: boolean;
  trustDurationInDays?: number
  handleCredentialSubmit: (submittedUsername: string, credentials: MfaCredential, authFactor:AuthFactor, keepMeSignedIn?: boolean) => void;
  redwoodTheme: boolean;

};

type State = {
  pollIntervalId: ReturnType<typeof setInterval>;
  trusted: boolean;
  preferred: boolean;
  selectOtherClicked: boolean;
}

export default class PushNotificationVerify extends Component<PushNotificationVerifyProps, State> {
  constructor(props: PushNotificationVerifyProps) {
    super(props);
    this.state = {
      pollIntervalId: null,
      trusted: false,
      preferred: false,
      selectOtherClicked: false
    };
    // Binds
    this.handleTrustedChange = this.handleTrustedChange.bind(this);
    this.handlePreferredChange = this.handlePreferredChange.bind(this);
  }

  componentDidMount() {
    const intervalId = setInterval(() => {
      if (!this.props.submissionInProgress && !this.state.selectOtherClicked) {
        const credentials:MfaCredential = {};
        if(this.props.selectedDeviceId){
          credentials[DEVICE_ID_CREDENTIAL] = this.props.selectedDeviceId;
          credentials[PREFERRED_CREDENTIAL] = this.state.preferred;
        }
        this.props.handleCredentialSubmit("", credentials, PUSH_FACTOR);
      }
    }, POLL_INTERVAL);
    this.setState({ pollIntervalId: intervalId });
  }

  componentWillUnmount() {
    // Safety clear of the polling instruction
    if (this.state.pollIntervalId) {
      clearInterval(this.state.pollIntervalId);
    }
  }

  handleTrustedChange(event: React.ChangeEvent<HTMLInputElement>) {
    this.setState({ trusted: event.currentTarget.checked });
  }

  handlePreferredChange(event: React.ChangeEvent<HTMLInputElement>) {
    this.setState({ preferred: event.currentTarget.checked });
  }

  render() {
    return (
      <div className="username-password-container">
        {factorDetails[PUSH_FACTOR].getVerifyDescription(this.props.displayName)}
        <ProgressSpinner
          size={60}
          innerIcon={<DeviceMobileIcon size={24} />}
        />
      </div>
    );
  }
}
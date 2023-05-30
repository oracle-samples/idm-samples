/* tslint:disable:no-console */
import React, { Component } from 'react';
import { InterfaceCredentials, KMSIConfiguration } from '../../types/uiTypes';
import { XIcon } from '@primer/octicons-react';

import "../../css/selectableList.css";
import "../../css/KmsiUserSelection.css";
import "../../css/button.css";
import "../../css/credentialInput.css";
import { AuthFactor } from '../../types/idcsTypes';

const KMSI_FACTOR = "KMSI"
// Technically we could support multiple mappings between the stored users, but no reason to at this point
const REFERENCE_FIELD = "ref";

/*
 * Username Password Form for basic username/password logins
 */
interface KmsiUserSelectionProps {
  credentials: string[];
  submissionInProgress: boolean;
  handleCredentialSubmit: (submittedUsername: string, credentials: InterfaceCredentials, authFactor:AuthFactor) => void;
  handleForgetUser: (kmsiUser: KMSIConfiguration) => void;
  handleKmsiBypass: () => void;
  kmsiUsers: KMSIConfiguration[];
  redwoodTheme: boolean;
};

type State = {
  enableForget: boolean;
}

export default class KmsiUserSelection extends Component<KmsiUserSelectionProps, State> {
  constructor(props: KmsiUserSelectionProps) {
    super(props);
    this.state = {
      enableForget: false
    };
    // Binds
    this.handleUserSelection = this.handleUserSelection.bind(this);
    this.toggleForgetUsers = this.toggleForgetUsers.bind(this);
    this.handleForgetUser = this.handleForgetUser.bind(this);
  }

  handleUserSelection = function (event: React.MouseEvent<HTMLDivElement, MouseEvent>, index: number) {
    if (this.props.submissionInProgress) {
      // Avoid double submission
      return;
    }
    // Pass up the KMSI reference, wrapped in a credentials object
    const credentials = {} as InterfaceCredentials;
    for (const field of this.props.credentials) {
      if (this.props.kmsiUsers[index][REFERENCE_FIELD] !== undefined) {
        // Just map the reference to every credential. If something more
        // complex is needed in the future, this can be adapted.
        credentials[field] = this.props.kmsiUsers[index][REFERENCE_FIELD];
      }
    }
    this.props.handleCredentialSubmit(this.props.kmsiUsers[index].displayName, credentials, KMSI_FACTOR);
  }

  handleForgetUser = function (event: React.MouseEvent<HTMLDivElement, MouseEvent>, index: number) {
    // Forget is a section of the user row...
    event.stopPropagation();
    if (this.props.submissionInProgress) {
      // Avoid double submission
      return;
    }
    this.props.handleForgetUser(this.props.kmsiUsers[index]);
  }

  toggleForgetUsers = function (event: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    this.setState({ enableForget: !this.state.enableForget });
  }

  render() {
    const self = this;
    const kmsiUsers = this.props.kmsiUsers.map((kmsiUser, index) => {
      return (<div
        key={index}
        className={"selection-item kmsi-user-item" + (this.props.redwoodTheme ? " redwood" : "")}
        onClick={(e) => this.handleUserSelection(e, index)}
      >
        {kmsiUser.displayName}
        {self.state.enableForget ? <div
          className={"kmsi-forget-user" + (this.props.redwoodTheme ? " redwood" : "")}
          onClick={(e) => this.handleForgetUser(e, index)}
        ><XIcon
            size={24}
          /></div> : <div />}
      </div>);
    })
    return (
      <div className="kmsi-user-selection">
        Continue as:
        <div className="kmsi-user-list selection-list">
          {kmsiUsers}
        </div>
        <div
          className={"flat-button action" + (this.props.redwoodTheme ? " redwood" : "")}
          onClick={this.props.handleKmsiBypass}
        >Sign In as a Different User</div>
        <div
          className="alternate-action-text"
          onClick={this.toggleForgetUsers}
        >
          {(this.state.enableForget ? "Cancel" : "Forget a User")}
        </div>
      </div>
    );
  }
}
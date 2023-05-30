/* tslint:disable:no-console */
import React, { Component } from 'react';


import "../../../css/selectableList.css";
import "../../../css/button.css";
import "../../../css/credentialInput.css";
import { PasswordRecoveryOption, RecoveryOption } from '../../../types/idcsTypes';
import { recoveryDetails } from '../../../util/recoveryDetailsUtil';

/*
 * Selector for MFA factors for enrollment
 */
interface RecoveryFactorSelectionProps {
  recoveryOptions: PasswordRecoveryOption[];
  submissionInProgress: boolean;
  userName: string;
  handleInitiateForgotPassword: (userName: string,  recoveryType?: PasswordRecoveryOption) => void;
  handleCancelRecoveryRequest: () => void;
  redwoodTheme: boolean;
};


export default class RecoveryFactorSelection extends Component<RecoveryFactorSelectionProps> {
  constructor(props: RecoveryFactorSelectionProps) {
    super(props);
    // Binds
    this.handleSelectRecoveryFactor = this.handleSelectRecoveryFactor.bind(this);
  }

  handleSelectRecoveryFactor = function (event: React.MouseEvent<HTMLDivElement, MouseEvent>, index: number) {
    if (this.props.submissionInProgress) {
      // Avoid double submission
      return;
    }
    this.props.handleInitiateForgotPassword(this.props.userName, this.props.recoveryOptions[index]);
  }

  render() {
    const recoveryMethods = this.props.recoveryOptions.map((factor, index) => {
      if(recoveryDetails[factor.type]){
        return (<div
          key={index}
          className={"selection-item" + (this.props.redwoodTheme ? " redwood" : "")}
          onClick={(e) => this.handleSelectRecoveryFactor(e, index)}
        >
          {recoveryDetails[factor.type].requestDisplay}
        </div>);
      }
      return null;
    });
    return (
      <div>
        Select an account recovery method:
        <div className="selection-list">
          {recoveryMethods}
        </div>
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
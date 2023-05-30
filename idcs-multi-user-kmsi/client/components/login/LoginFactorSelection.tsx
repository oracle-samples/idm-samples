/* tslint:disable:no-console */
import React, { Component } from 'react';

import { factorDetails } from '../../util/factorDetailsUtil';

import "../../css/selectableList.css";
import "../../css/button.css";
import "../../css/credentialInput.css";
import { AuthFactor } from '../../types/idcsTypes';
import { LoginMethod } from '../../types/uiTypes';

/*
 * Selector for MFA factors for login
 */
interface LoginSelectionProps {
  loginMethods: LoginMethod[]
  submissionInProgress: boolean;
  handleSelectLoginFactor: (factorName: AuthFactor, deviceId?:string, deviceName?:string) => void;
  redwoodTheme: boolean;
};


export default class LoginFactorSelection extends Component<LoginSelectionProps> {
  constructor(props: LoginSelectionProps) {
    super(props);
    // Binds
    this.handleSelectLoginFactor = this.handleSelectLoginFactor.bind(this);
  }

  handleSelectLoginFactor = function (event: React.MouseEvent<HTMLDivElement, MouseEvent>, index: number) {
    if (this.props.submissionInProgress) {
      // Avoid double submission
      return;
    }
    this.props.handleSelectLoginFactor(this.props.loginMethods[index].factor, this.props.loginMethods[index].displayName, this.props.loginMethods[index].deviceId);
  }

  render() {
    const self = this;
    const factors = this.props.loginMethods.map((method, index) => {
      if(factorDetails[method.factor]){
        return (<div
          key={index}
          className={"selection-item" + (this.props.redwoodTheme ? " redwood" : "")}
          onClick={(e) => this.handleSelectLoginFactor(e, index)}
        >
          {factorDetails[method.factor].getloginDescription(method.displayName)}
        </div>);
      }
      return (<div/>);
    })
    return (
      <div>
        <div className="selection-list">
          {factors}
        </div>
      </div>
    );
  }
}
/* tslint:disable:no-console */
import React, { Component } from 'react';

import { factorDetails } from '../../util/factorDetailsUtil';

import "../../css/selectableList.css";
import "../../css/button.css";
import "../../css/credentialInput.css";
import { AuthFactor } from '../../types/idcsTypes';

/*
 * Selector for MFA factors for enrollment
 */
interface EnrollmentSelectionProps {
  validFactors: string[];
  submissionInProgress: boolean;
  enrollmentRequired: boolean;
  handleSelectEnrollmentFactor: (factorName: AuthFactor) => void;
  handleSkipEnrollment: () => void;
  redwoodTheme: boolean;
};


export default class EnrollmentFactorSelection extends Component<EnrollmentSelectionProps> {
  constructor(props: EnrollmentSelectionProps) {
    super(props);
    // Binds
    this.handleSelectEnrollmentFactor = this.handleSelectEnrollmentFactor.bind(this);
    this.handleSkipEnrollment = this.handleSkipEnrollment.bind(this);
  }

  handleSelectEnrollmentFactor = function (event: React.MouseEvent<HTMLDivElement, MouseEvent>, index: number) {
    if (this.props.submissionInProgress) {
      // Avoid double submission
      return;
    }
    this.props.handleSelectEnrollmentFactor(this.props.validFactors[index]);
  }

  handleSkipEnrollment = function (event: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    if (this.props.submissionInProgress) {
      // Avoid double submission
      return;
    }
    this.props.handleSkipEnrollment();
  }

  render() {
    const self = this;
    const factors = this.props.validFactors.map((factor, index) => {
      if(factorDetails[factor]){
        return (<div
          key={index}
          className={"selection-item" + (this.props.redwoodTheme ? " redwood" : "")}
          onClick={(e) => this.handleSelectEnrollmentFactor(e, index)}
        >
          {factorDetails[factor].enrollmentDisplay}
        </div>);
      }
      return (<div/>);

    })
    let skipEnrollment = (<div/>);
    if(!this.props.enrollmentRequired){
      skipEnrollment = (<div
        className="alternate-action-text"
        onClick={this.handleSkipEnrollment}
      >
        Skip Enrollment
      </div>);
    }
    return (
      <div>
        <div className="selection-list">
          {factors}
        </div>
        {skipEnrollment}
      </div>
    );
  }
}
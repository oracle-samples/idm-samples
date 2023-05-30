/* tslint:disable:no-console */
import React, { Component } from 'react';

import "../../css/statusText.css";

/*
 * Status rendering
 */
interface StatusTextProps {
  severity: "info" | "error";
  message: string;
  submissionInProgress: boolean;
};

export default class StatusText extends Component<StatusTextProps> {
  render() {
    // console.log(this.props);
    return (
      <div className={`status-container ${this.props.severity}`}>
        {this.props.submissionInProgress?' ':(this.props.message?this.props.message:' ')}
      </div>
    );
  }
}
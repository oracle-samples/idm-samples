/* tslint:disable:no-console */
import React, { Component } from 'react';

import "../../css/progressSpinner.css";

/*
 * Progress Spinner rendering
 */
interface ProgressSpinnerProps {
  innerIcon?:JSX.Element;
  size?:number;
  iconBorder?: boolean;
};

export default class ProgressSpinner extends Component<ProgressSpinnerProps> {
  render() {
    let innerComponents = (<div/>);
    if(this.props.innerIcon){
      innerComponents = (<div className={`inner-element${(this.props.iconBorder?" inner-border":"")}`}>
        {this.props.innerIcon}
      </div>)
    }
    return (
      <div className="sk-circle" style={{width: `${this.props.size}px`, height: `${this.props.size}px`}}>
        {innerComponents}
        <div className="sk-circle1 sk-child"></div>
        <div className="sk-circle2 sk-child"></div>
        <div className="sk-circle3 sk-child"></div>
        <div className="sk-circle4 sk-child"></div>
        <div className="sk-circle5 sk-child"></div>
        <div className="sk-circle6 sk-child"></div>
        <div className="sk-circle7 sk-child"></div>
        <div className="sk-circle8 sk-child"></div>
        <div className="sk-circle9 sk-child"></div>
        <div className="sk-circle10 sk-child"></div>
        <div className="sk-circle11 sk-child"></div>
        <div className="sk-circle12 sk-child"></div>
      </div>
    );
  }
}
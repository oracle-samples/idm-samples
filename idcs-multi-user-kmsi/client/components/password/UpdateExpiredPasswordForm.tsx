/* tslint:disable:no-console */
import React, { Component } from 'react';

import "../../css/userNamePasswordForm.css";
import "../../css/button.css";
import "../../css/credentialInput.css";
import { validatePasswordComplexity } from '../../util/passwordPolicy';
import { CheckCircleFillIcon, CheckCircleIcon, XCircleFillIcon } from '@primer/octicons-react';
import { PasswordPolicy } from '../../types/idcsTypes';
import { PasswordPolicyResponse } from '../../types/uiTypes';
import StatusText from '../common/StatusText';

/*
 * Username Password Form for basic username/password logins
 */
interface UpdateExpiredPasswordFormProps {
  submissionInProgress: boolean;
  initialUsername?: string;
  passwordPolicy: PasswordPolicy
  handleSetPassword: (oldPassword:string, newPassword:string)=>void;
  redwoodTheme:boolean;
  statusMessage?:string;
}

type State = {
  oldPassword:string;
  newPassword:string;
  confirmPassword:string;
  passwordPolicyStatus: PasswordPolicyResponse;
}

export default class UpdateExpiredPasswordForm extends Component<UpdateExpiredPasswordFormProps, State>{
  constructor(props: UpdateExpiredPasswordFormProps) {
    super(props);
    this.state = {
      oldPassword:"",
      newPassword:"",
      confirmPassword:"",
      passwordPolicyStatus: validatePasswordComplexity("", props.passwordPolicy, props.initialUsername)
    };
    this.handleFormSubmission = this.handleFormSubmission.bind(this);
    this.checkPasswordValid = this.checkPasswordValid.bind(this);
    this.handleOldPasswordChange = this.handleOldPasswordChange.bind(this);
    this.handleNewPasswordChange = this.handleNewPasswordChange.bind(this);
    this.handleConfirmPasswordChange = this.handleConfirmPasswordChange.bind(this);
    this.checkSubmit = this.checkSubmit.bind(this);
  }

  checkPasswordValid():boolean{
    if(this.state.newPassword !== this.state.confirmPassword){
      return false;
    }
    for(const rule of this.state.passwordPolicyStatus.rules){
      if(!rule.evalOnSubmit && !rule.result){
        return false;
      }
    }
    return true;
  }

  handleFormSubmission(){
    // Avoid double submission
    if(this.props.submissionInProgress){
      return;
    }
    // Validate password policy
    if(!this.checkPasswordValid()){
      return;
    }
    this.props.handleSetPassword(this.state.oldPassword, this.state.newPassword);
    // Should probably clear the old one.
    // Need to work out how to display failure messages
  }

  handleOldPasswordChange(event: React.ChangeEvent<HTMLInputElement>){
    this.setState({oldPassword:event.currentTarget.value});
  }

  handleNewPasswordChange(event: React.ChangeEvent<HTMLInputElement>){
    this.setState({
      newPassword:event.currentTarget.value,
      passwordPolicyStatus: validatePasswordComplexity(event.currentTarget.value, this.props.passwordPolicy, this.props.initialUsername)
    });
  }

  handleConfirmPasswordChange(event: React.ChangeEvent<HTMLInputElement>){
    this.setState({confirmPassword:event.currentTarget.value});
  }

  checkSubmit(event: React.KeyboardEvent<HTMLInputElement>):void{
    // If we hit Enter in the last field, submit the form.
    if(event.code === "Enter"){
      this.handleFormSubmission();
    }
  }

  getPolicyIcon(evalOnSubmit:boolean, result?:boolean):JSX.Element{
    if(evalOnSubmit){
      return (<CheckCircleIcon size={16} />);
    }
    if(result){
      return (<CheckCircleFillIcon size={16} fill="#6bab17"/>);
    }
    return (<XCircleFillIcon size={16} fill="#e4001e"/>);
  }

  render(){
    const passwordRules = this.state.passwordPolicyStatus.rules.map((rule, index)=>{
      return (
      <div
        className="password-policy-rule"
        key={index}
      >
        {this.getPolicyIcon(rule.evalOnSubmit, rule.result)}
        {`${rule.description}`/*${rule.evalOnSubmit?" (Evaluated on submission)":""}`*/}
      </div>);
    });
    // Add a check for confirm password matching new password
    passwordRules.splice(0, 0, (<div
      className="password-policy-rule"
      key="match-passwords"
    >
      {this.getPolicyIcon(false, this.state.newPassword === this.state.confirmPassword)}
      Passwords must match
    </div>));
    passwordRules.concat(this.state.passwordPolicyStatus.rules.map((rule, index)=>{
      return (
      <div
        className="password-policy-rule"
        key={index}
      >
        {this.getPolicyIcon(rule.evalOnSubmit, rule.result)}
        {`${rule.description}`/*${rule.evalOnSubmit?" (Evaluated on submission)":""}`*/}
      </div>);
    }));
    return (
      <div className="login-content-container">
        <h3>Set New Password</h3>
        <StatusText
          submissionInProgress={this.props.submissionInProgress}
          severity="info"
          message={this.props.statusMessage || ""}
        />
        <div className="update-password-container">
          <div className="username-password-container">
            <div className="credential-input-container nopad">
              <div className="credential-label">Old Password</div>
              <input
                className="credential-input"
                type="password"
                value={this.state.oldPassword}
                onChange={this.handleOldPasswordChange}
                placeholder="Password"
              />
            </div>
            <div className="credential-input-container">
              <div className="credential-label">New Password</div>
              <input
                className="credential-input"
                type="password"
                value={this.state.newPassword}
                onChange={this.handleNewPasswordChange}
                placeholder="Password"
              />
            </div>
            <div className="credential-input-container">
              <div className="credential-label">Confirm Password</div>
              <input
                className="credential-input"
                type="password"
                value={this.state.confirmPassword}
                onChange={this.handleConfirmPasswordChange}
                onKeyDown={this.checkSubmit}
                placeholder="Password"
              />
            </div>
            <div
              className={"flat-button action toppad"+(this.props.redwoodTheme?" redwood":"")}
              onClick={this.handleFormSubmission}
            >Set New Password</div>
          </div>
          <div className="password-policy-rules-container">
            {passwordRules}
          </div>
        </div>
      </div>
    );
  }
}
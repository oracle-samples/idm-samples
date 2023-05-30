import React, { Component } from 'react';
import AuthenticationLayout from './AuthenticationLayout';


import "../css/loginLayout.css";
import { RequestState } from '../types/idcsTypes';

interface AppProps {
  initialState: RequestState;
  redwoodTheme: boolean;
}

export default class App extends Component<AppProps> {
  render() {
    return (
      <div className="login-layout-container">
        <AuthenticationLayout
          initialState={this.props.initialState}
          redwoodTheme={this.props.redwoodTheme}
        />
      </div>
    );
  }
}


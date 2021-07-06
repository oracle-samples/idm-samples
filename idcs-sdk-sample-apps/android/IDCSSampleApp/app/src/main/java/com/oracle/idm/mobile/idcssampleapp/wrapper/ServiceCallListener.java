/*
 * Copyright (c) 2000, 2021, Oracle and/or its affiliates.
 *
 *   Licensed under the Universal Permissive License v 1.0 as shown at
 *   http://oss.oracle.com/licenses/upl.
 */

package com.oracle.idm.mobile.idcssampleapp.wrapper;

import oracle.idm.mobile.OMMobileSecurityException;
import oracle.idm.mobile.auth.OMAuthenticationChallenge;
import oracle.idm.mobile.auth.OMAuthenticationCompletionHandler;
import oracle.idm.mobile.auth.OMAuthenticationContext;
import oracle.idm.mobile.auth.logout.OMLogoutCompletionHandler;
import oracle.idm.mobile.configuration.OMMobileSecurityConfiguration;

public interface ServiceCallListener {
    void onSetupCompleted(OMMobileSecurityConfiguration omMobileSecurityConfiguration, oracle.idm.mobile.OMMobileSecurityException e);

    void onAuthenticationChallenge(OMAuthenticationChallenge omAuthenticationChallenge, OMAuthenticationCompletionHandler omAuthenticationCompletionHandler);

    void onAuthenticationCompleted(OMAuthenticationContext omAuthenticationContext, OMMobileSecurityException e);

    void onLogoutChallenge(OMAuthenticationChallenge omAuthenticationChallenge, OMLogoutCompletionHandler omLogoutCompletionHandler);

    void onLogoutCompleted(OMMobileSecurityException e);

    void onErrorMessage(String msg);
}

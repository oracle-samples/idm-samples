/*
 * Copyright (c) 2000, 2021, Oracle and/or its affiliates.
 *
 *   Licensed under the Universal Permissive License v 1.0 as shown at
 *   http://oss.oracle.com/licenses/upl.
 */

package com.oracle.idm.mobile.idcssampleapp.wrapper;

public class Const {
    //    this is the tenant discovery URL (OpenIDConnectDiscoveryURL)
    public static final String OPEN_ID_DISCOVERY_URL = "https://MYTENANT.identity.oraclecloud.com/.well-known/idcs-configuration";
    //this is the redirection URL
    public static final String OPEND_ID_REDIRECT_EP = "idcsmobileapp://nodata";
    // this is the OAuthClientID for the client obtained from web console
    public static final String OPEN_ID_CLIENT_ID = "SDK_MOBILE_APP_CLIENT_ID";

    public static final String OAUTH_AUTHZ_CODE_RESOURCE_URL = "https://MYTENANT.identity.oraclecloud.com/";

    public static final String URL_MY_APPS = OAUTH_AUTHZ_CODE_RESOURCE_URL + "admin/v1/MyApps/";
    public static final String URL_MY_GROUPS = OAUTH_AUTHZ_CODE_RESOURCE_URL + "admin/v1/MyGroups/";


    public static final int REQUEST_CODE_LOGIN = 10001;
    public static final int REQUEST_CODE_LOGOUT = 10002;
    public static final int REQUEST_CODE_COMPLETED_SUCCESS = 10005;
    public static final int REQUEST_CODE_LAUNCH_HOME = 10100;
    public static final int REQUEST_CODE_FINISH_HOME = 10101;
    public static final int REQUEST_CODE_LOGOUT_HOME = 10102;


    public enum AppBrowserMode {
        EMBEDDED,
        EXTERNAL,
        CHROMETAB
    }
}

/*
 * This file is subject to the terms and conditions defined in
 * file 'LICENSE.MD' which is part of this source code package.
 */
package com.example.utils;

/**
 * It contains the resource server configuration and constants
 * Like a properties file, but simpler
 */
public class ResourceServerConfig {
    
    //YOUR IDENTITY DOMAIN AND APPLICATION CREDENTIALS
    public static final String CLIENT_ID = "";
    public static final String CLIENT_SECRET = "";
    public static final String IDCS_URL = "";
    
    //INFORMATION ABOUT THE SALESINSIGHT APPLICATION
    public static final String SCOPE_AUD = "http://localhost:8080/salesinsight/";
    public static final String SCOPE_QUOTE = "quote";
    public static final String SCOPE_INSIGHT = "insight";
    public static final String SCOPE_PIPELINE = "pipeline";
    public static final String SCOPE_REPORT = "report";
    
    //INFORMATION ABOUT IDENTITY CLOUD SERVICES
    public static final String JWK_URL=IDCS_URL+"/admin/v1/SigningCert/jwk";
    public static final String TOKEN_URL=IDCS_URL+"/oauth2/v1/token";
    
    //PROXY
    public static final boolean HAS_PROXY = false;
    public static final String PROXY_HOST = "http://my.proxy.com";
    public static final int PROXY_PORT = 80;
}

package com.example.utils;

import java.net.URLEncoder;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.logging.Level;
import java.util.logging.Logger;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;
/*
 * This file is subject to the terms and conditions defined in
 * file 'LICENSE.MD' which is part of this source code package.
 */
public class OICOAuthClient {
    private static final String CLASS = OICOAuthClient.class.getName();
    private static final Logger LOGGER = java.util.logging.Logger.getLogger(CLASS);

    /**
     * This method prepare the URL request for authorization code in Identity Cloud Services.
     * @param request the HTTP request object.
     * @param response the HTTP response object.
     * @throws Exception if method fails for any errors.
     */
    public static void getAuthzCodeRequest(HttpServletRequest request, HttpServletResponse response) throws Exception{
        final String LOG_METHOD = "getAuthorizationCodeRequest";
        if (LOGGER.isLoggable(Level.FINER)) {
            LOGGER.entering(CLASS, LOG_METHOD);
        }
        
        HttpSession session = request.getSession();
        
        //IDENTIFIES THE SCOPE SENT ON VARIABLE resource
        String scopeValue = request.getParameter("resource");
        
        //IF REQUEST IS FOR ALL SCOPES
        if(scopeValue.equals(ClientConfig.SCOPE_ALL)){
            scopeValue = ClientConfig.getAllScopes();
        }
        
        try {
            //PREPARES THE AUTHORIZATION CODE REQUEST, PASSING
            //THE CLIENT_ID AND RETURN_URI FROM THE APPLICATION
            //AND THE SCOPE REQUESTED
            String url = ClientConfig.AUTHZ_SERVICE_URL
                         + "?client_id="
                         + ClientConfig.CLIENT_ID 
                         + "&response_type=code&redirect_uri="  + ClientConfig.APP_RETURN_URI
                         + "&scope=" + URLEncoder.encode(scopeValue, "UTF8")
                         + "&nonce=" + UUID.randomUUID().toString();
            
            //SAVING THE URL ON THE SESSION, SO YOU CAN SEE THIS INFORMATION LATER
            session.setAttribute("authzRequestURL", url);
            //LOGGING THE URL
            if (LOGGER.isLoggable(Level.FINE)) {
                Object[] params = { url };
                LOGGER.log(Level.FINE, "RP_REDIRECT_TO", params);
            }
            //REDIRECTING USER FOR AUTHORIZATION CODE REQUEST
            response.sendRedirect(url);
        }catch(Exception ex){
            LOGGER.log(Level.SEVERE, ".RP_IDP_USER_AUTHN_ERROR", ex);
            if (LOGGER.isLoggable(Level.FINER)) {
                LOGGER.exiting(CLASS, LOG_METHOD);
            }
            throw ex;
        }
    }//getAuthzCodeRequest

    /**
     * Gets access token using the authorization code returned by Identity Cloud Services
     * @param httpReq object containing the authorization code
     * @return String containing the access token
     * @throws Exception
     */
    public static String getAccessToken(HttpServletRequest httpReq)
                    throws Exception {
        final String LOG_METHOD = "getAccessToken";
        if (LOGGER.isLoggable(Level.FINER)) {
            LOGGER.entering(CLASS, LOG_METHOD);
        }
        
        //Authorization code
        String code = httpReq.getParameter("code");
        if (code == null || code.length() == 0) {
            LOGGER.log(Level.SEVERE, "RP_OAUTH_AUTHORIZATION_CODE_NULL");
            throw new Exception(".RP_OAUTH_AUTHORIZATION_CODE_NULL");
        }
        
        String aCode;
        String oauthAccessToken;

        try {
            aCode = URLEncoder.encode(code, "UTF8");
        } catch (Exception e) {
            aCode = code;
        }
        HttpSession session = httpReq.getSession();

        try {
            session.setAttribute("authzResponse", aCode);
            String authURL = ClientConfig.TOKEN_SERVICE_URL;
            
            if (!authURL.contains("http")) {
                authURL = httpReq.getScheme() + "://" + httpReq.getServerName() + ":" + httpReq.getServerPort() + authURL;
            }
            
            String postBody = "grant_type=authorization_code"+"&code="+aCode;
            
            LOGGER.log(Level.INFO, "OICOAuthClient: postBody: {0}", postBody);
            Response httpResponse;
            Map<String, String> requestOptions = new HashMap<>();
            requestOptions.put("Accept", "*/*");
            String authzHdrVal = ClientConfig.CLIENT_ID+":"+ClientConfig.CLIENT_SECRET;
            LOGGER.log(Level.INFO, "OICOAuthClient: base64 encode: {0}", authzHdrVal);

            requestOptions.put("Authorization", "Basic "  + Base64.getEncoder().encodeToString(authzHdrVal.getBytes("UTF-8")));
            LOGGER.info("OICOAuthClient: base64 encode: " + Base64.getEncoder().encodeToString(authzHdrVal.getBytes("UTF-8")));
            
            httpResponse = execHttpRequest(authURL, "POST", requestOptions, postBody);
            
            LOGGER.info("OICOAuthClient get accessToken status: " + httpResponse.getStatus());


            String result = httpResponse.getResponseBodyAsString("UTF-8");
            LOGGER.info("OICOAuthClient accessToken result: " + result);
            
            //Access Token
            oauthAccessToken = result;

            session.setAttribute("tokenRequestURL", authURL);
            session.setAttribute("tokenRequestParams", requestOptions);
            session.setAttribute("tokenRequestBody", postBody);
            session.setAttribute("tokenResponse", oauthAccessToken);

            LOGGER.info("OICOAuthClient accessToken result1: " + oauthAccessToken);
            
        } catch (Exception ex) {
            LOGGER.log(Level.SEVERE, ".RP_IDP_USER_ACCESS_TOKEN_ERROR", ex);
            throw new Exception(ex);
        }
        return oauthAccessToken;
    }//getAccessToken

    /**
     * Retrieve information about the end-user in Identity Cloud Services
     */
    public static String getUserInfo(String accessToken) {
        final String LOG_METHOD = "validateAccessToken";
        if (LOGGER.isLoggable(Level.FINER)) {
            LOGGER.entering(CLASS, LOG_METHOD);
        }

        LOGGER.info("OICOAuthClient:accessToken" + accessToken);

        try {
            accessToken = URLEncoder.encode(accessToken, "UTF8");
        } catch (Exception e) {

            LOGGER.log(Level.SEVERE, String.format("Error decoding access token ==> %s", e.getMessage()));
        }

        String result = null;
        try {
            String resURL = ClientConfig.USERINFO_SERVICE_URL + "?access_token=" + accessToken ;
            LOGGER.info("OICOAuthClient resource request url: " + resURL);

            Response httpResponse;
            Map<String, String> requestOptions = new HashMap<>();
            requestOptions.put("Authorization", "Bearer " + accessToken);

            requestOptions.put("Accept", "*/*");
            httpResponse = execHttpRequest(resURL, "GET", requestOptions, null);

            result = httpResponse.getResponseBodyAsString("UTF-8");
            LOGGER.info("OICOAuthClient validate accessToken result: " + result);

        } catch (Exception ex) {
            LOGGER.info("OICOAuthClient getting resource exception: " + ex);
        }
        return result;
    }//getUserInfo

    /**
     * Executes a HTTP Call
     */
    private static Response execHttpRequest(String url, 
                                            String method, 
                                            Map<String, String> requestOptions, 
                                            String httpData) throws Exception {
        return HttpUtil.doHttpRequest(url, method,
                                                       httpData, requestOptions,
                                                       ClientConfig.HAS_PROXY,
                                                       ClientConfig.PROXY_HOST,
                                                       ClientConfig.PROXY_PORT);
    }

}

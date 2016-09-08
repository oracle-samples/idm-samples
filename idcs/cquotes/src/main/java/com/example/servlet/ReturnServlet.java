/*
 * This file is subject to the terms and conditions defined in
 * file 'LICENSE.MD' which is part of this source code package.
 */
package com.example.servlet;

import java.io.IOException;
import java.util.logging.Logger;

import javax.servlet.RequestDispatcher;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;
import java.util.logging.Level;

import com.example.beans.UserBean;
import com.example.utils.ClientConfig;
import com.example.utils.OICOAuthClient;

import org.codehaus.jettison.json.JSONObject;
import com.nimbusds.jwt.SignedJWT;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * @author subbarao.evani@oracle.com
 *
 */
public class ReturnServlet extends HttpServlet {
    private static final long serialVersionUID = 1L;
    private static final String CLASS = ReturnServlet.class.getName();
    private static Logger LOGGER = java.util.logging.Logger.getLogger(CLASS);

    /**
     * @see HttpServlet#HttpServlet()
     */
    public ReturnServlet() {
        super();
    }

    /**
     * @see HttpServlet#doGet(HttpServletRequest request, HttpServletResponse
     *      response)
     */
    protected void doGet(HttpServletRequest request,
                         HttpServletResponse response) throws ServletException, IOException {
        processRequest(request, response);
    }

    /**
     * @see HttpServlet#doPost(HttpServletRequest request, HttpServletResponse
     *      response)
     */
    protected void doPost(HttpServletRequest request,
                          HttpServletResponse response) throws ServletException, IOException {
        processRequest(request, response);
    }
    
    /**
     * Process a return from Identity Cloud Services
     */
    private void processRequest(HttpServletRequest request,
                                HttpServletResponse response) throws ServletException, IOException {
        String errorMsg = request.getParameter("error");
        if (errorMsg != null) {
            RequestDispatcher rd = request.getRequestDispatcher("/error.jsp?errorMsg="+errorMsg);
            rd.forward(request, response);
            return;
        }
        try {
            HttpSession session = request.getSession();
            String accessToken = OICOAuthClient.getAccessToken(request);
            String idToken = null;
            try {
                JSONObject json = new JSONObject(accessToken);
                accessToken = json.getString("access_token");
                idToken = json.getString("id_token");
                session.setAttribute("idToken", idToken);
            } catch (Exception e) {
                LOGGER.info("ReturnServlet: at0 ex:" + e);

            }
            LOGGER.info("ReturnServlet: at1:" + accessToken);
            String requestedResourceName = (String) session
                            .getAttribute("requestedResourceName");
            
            if (idToken != null) {
                SignedJWT plainJWT;

                try {
                    plainJWT = SignedJWT.parse(idToken);
                    LOGGER.info("ReturnServlet: ID Token claims:" + plainJWT.getJWTClaimsSet());
                    request.setAttribute("prn", plainJWT.getJWTClaimsSet().getSubject());
                    LOGGER.log(Level.INFO, "ReturnServlet: prn set value {0}", session.getAttribute("prn"));
                } catch (Exception e) {
                    // Invalid plain JWT encoding
                    LOGGER.log(Level.INFO, "ReturnServlet: at2 ex: {0}", e);
                }
                
                String userInfoResult = OICOAuthClient.getUserInfo(accessToken);
                if (userInfoResult != null) {
                    JSONObject json = new JSONObject(userInfoResult);
                    UserBean userInfo = new UserBean(json.getString("birthdate"), 
                                                     json.getString("family_name"), 
                                                     json.getString("gender"), 
                                                     json.getString("given_name"), 
                                                     json.getString("name"), 
                                                     json.getString("preferred_username"), 
                                                     json.getString("sub"), 
                                                     json.getString("website"));
                    session.setAttribute("userInfo", userInfo);
                }
            }
            LOGGER.log(Level.INFO, "ReturnServlet: Client requestedResourceName: {0}", requestedResourceName);
            if (accessToken != null) {
                LOGGER.log(Level.INFO, "ReturnServlet: tokenValue{0}", accessToken);

                SignedJWT accessTokenJWT = SignedJWT.parse(accessToken);
                String scopes = accessTokenJWT.getJWTClaimsSet().getStringClaim("scope");
                
                if(scopes.contains(ClientConfig.SCOPE_QUOTE)){
                    request.setAttribute(ClientConfig.SCOPE_QUOTE, this.sendGet(ClientConfig.SCOPE_QUOTE,accessToken));
                }
                if(scopes.contains(ClientConfig.SCOPE_INSIGHT)){
                    request.setAttribute(ClientConfig.SCOPE_INSIGHT, this.sendGet(ClientConfig.SCOPE_INSIGHT,accessToken));
                }
                if(scopes.contains(ClientConfig.SCOPE_PIPELINE)){
                    request.setAttribute(ClientConfig.SCOPE_PIPELINE, this.sendGet(ClientConfig.SCOPE_PIPELINE,accessToken));
                }
                if(scopes.contains(ClientConfig.SCOPE_REPORT)){
                    request.setAttribute(ClientConfig.SCOPE_REPORT, this.sendGet(ClientConfig.SCOPE_REPORT,accessToken));
                }
                
                RequestDispatcher rd = request
                                .getRequestDispatcher("/index.jsp");
                rd.forward(request, response);

                // }
            } else {
                RequestDispatcher rd = request
                                .getRequestDispatcher("/error.jsp?errorMsg=No OAuth Access Token received");
                rd.forward(request, response);
            }
        } catch (Exception ex) {
            RequestDispatcher rd = request
                            .getRequestDispatcher("/error.jsp?errorMsg=No OAuth Access Token received");
            rd.forward(request, response);
            LOGGER.log(Level.INFO, "ReturnServlet: at final ex: {0}", ex);
        }
    }
    
    // HTTP GET request
    private String sendGet(String scope, String token) throws Exception {
        String resourceServerHost = ClientConfig.SCOPE_AUD;
        String url = resourceServerHost+scope+"?token="+token;
        URL obj = new URL(url);
        HttpURLConnection con = (HttpURLConnection) obj.openConnection();
        con.setRequestMethod("GET");
        System.out.println(con.getContent().toString());
        BufferedReader in = new BufferedReader(new InputStreamReader(con.getInputStream()));
        String inputLine;
        StringBuilder response = new StringBuilder();
        while ((inputLine = in.readLine()) != null) {
            response.append(inputLine);
        }
        in.close();
        return response.toString();
    }
}

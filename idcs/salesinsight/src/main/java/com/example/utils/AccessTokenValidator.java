/*
 * This file is subject to the terms and conditions defined in
 * file 'LICENSE.MD' which is part of this source code package.
 */
package com.example.utils;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.source.ImmutableJWKSet;
import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.proc.BadJOSEException;
import com.nimbusds.jose.proc.JWSKeySelector;
import com.nimbusds.jose.proc.JWSVerificationKeySelector;
import com.nimbusds.jose.proc.SecurityContext;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.proc.BadJWTException;
import com.nimbusds.jwt.proc.ConfigurableJWTProcessor;
import com.nimbusds.jwt.proc.DefaultJWTProcessor;
import java.io.CharArrayWriter;
import java.io.IOException;
import java.io.PrintWriter;
import java.text.DateFormat;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.logging.Level;
import java.util.logging.Logger;
import javax.servlet.Filter;
import javax.servlet.FilterChain;
import javax.servlet.FilterConfig;
import javax.servlet.ServletException;
import javax.servlet.ServletRequest;
import javax.servlet.ServletResponse;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

/**
 * Validates access tokens sent to sales insight
 */
public class AccessTokenValidator implements Filter {
    
    private static JWKSet jwk;
    private static boolean isSafe = false;
    private static final ConfigurableJWTProcessor JWT_PROCESSOR = new DefaultJWTProcessor();
    private static JWKSource keySource;
    private static JWSKeySelector keySelector;
    
    @Override
    public void init(FilterConfig arg0) throws ServletException {
        try {
            jwk = JWKUtil.getJWK();
            keySource = new ImmutableJWKSet(jwk);
            keySelector = new JWSVerificationKeySelector(JWSAlgorithm.RS256, keySource);
            JWT_PROCESSOR.setJWSKeySelector(keySelector);
            AccessTokenValidator.isSafe = true;
            Logger.getLogger(AccessTokenValidator.class.getName()).log(Level.INFO, "Signing Key from IDCS successfully loaded!");
        } catch (Exception ex) {
            Logger.getLogger(AccessTokenValidator.class.getName()).log(Level.SEVERE, "Error loading Signing Key from IDCS", ex);
            AccessTokenValidator.isSafe = false;
        }
    }
    
    //Validates incoming requests and checks if the incoming token is valid
    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain) throws IOException, ServletException {
        if(AccessTokenValidator.isSafe){
            HttpServletRequest req = (HttpServletRequest) request;
            HttpServletResponse res = (HttpServletResponse) response;
            //Gets request URI
            String uri = req.getRequestURI();
            uri = uri.substring((uri.lastIndexOf("/")+1));
            String url = req.getServerName();

            System.out.println(uri);
            System.out.println(url);


            //Gets Access Token
            String accessToken = req.getParameter("token");
            if(accessToken == null){
                handleError(req, res, chain, "No access token provided");
            }else{
                try {
                    SecurityContext ctx =null;
                    JWTClaimsSet claimsSet = JWT_PROCESSOR.process(accessToken, ctx);
                    //VALIDATE AUDIENCE

                    if(claimsSet.getAudience().indexOf(ResourceServerConfig.SCOPE_AUD) >= 0){
                        //CORRECT AUDIENCE
                        System.out.println("GOOD AUDIENCE");
                        //VALIDATE SCOPE   
                        String scopes = claimsSet.getStringClaim("scope");
                        if(!scopes.contains(uri)){
                            throw new BadJWTException("Scope "+uri+" not authorized.");
                        }
                    }

                    DateFormat df = new SimpleDateFormat("dd/MM/yy HH:mm:ss");
                    Date currentDate = new Date();
                    Date exp = claimsSet.getExpirationTime();
                    System.out.println(df.format(exp));
                    System.out.println(df.format(currentDate));
                } catch (JOSEException ex) {
                    ex.printStackTrace();
                    //Logger.getLogger(AccessTokenValidator.class.getName()).log(Level.SEVERE, "System Exception validating the JWT signature", ex);
                    //throw new ServletException(ex);
                    handleError(req, res, chain, ex.getMessage());
                } catch (BadJOSEException ex) {
                    ex.printStackTrace();
                    handleError(req, res, chain, ex.getMessage());
                    //BadJWEException, BadJWSException, BadJWTException
                    //Bad JSON Web Encryption (JWE) exception. Used to indicate a JWE-protected object that couldn't be successfully decrypted or its integrity has been compromised.
                    //Bad JSON Web Signature (JWS) exception. Used to indicate an invalid signature or hash-based message authentication code (HMAC).
                    //Bad JSON Web Token (JWT) exception.
                } catch (ParseException ex) {
                    ex.printStackTrace();
                    handleError(req, res, chain, ex.getMessage());
                }
            }
            chain.doFilter(req, res);
        }else{
            handleError(request, response, chain, "Resource Server application is not able to validate tokens");
        }
    }

    private void handleError(ServletRequest req, ServletResponse res, FilterChain chain, String msg) throws IOException, ServletException {
        PrintWriter out = res.getWriter();
        CustResponseWrapper wrapper = new CustResponseWrapper((HttpServletResponse)res);
        chain.doFilter(req, wrapper);
        if(wrapper.getContentType().contains("text/plain")){
            CharArrayWriter caw = new CharArrayWriter();
            caw.write("Error While Validating Token: " + msg);
            res.setContentLength(caw.toString().length());
            out.write(caw.toString());
            out.close();
        }else if(wrapper.getContentType().contains("application/json")){
            CharArrayWriter caw = new CharArrayWriter();
            caw.write("{'error_msg':'Error While Validating Token: "+msg+"'}");
            res.setContentLength(caw.toString().length());
            out.write(caw.toString());
            out.close();
        }else if(wrapper.getContentType().contains("text/html")){
            CharArrayWriter caw = new CharArrayWriter();
            caw.write(wrapper.toString().substring(0, wrapper.toString().indexOf("</body>")-1));
            caw.write("<p>\n Error While Validating Token <font color='red'>" + msg + "</font>");
            caw.write("\n</body></html>");
            res.setContentLength(caw.toString().length());
            out.write(caw.toString());
            out.close();
        }else{
            CharArrayWriter caw = new CharArrayWriter();
            caw.write(wrapper.toString());
            caw.write("Error While Validating Token: " + msg);
            res.setContentLength(caw.toString().length());
            out.write(caw.toString());
            out.close();
        }
    }

    @Override
    public void destroy() {}
}

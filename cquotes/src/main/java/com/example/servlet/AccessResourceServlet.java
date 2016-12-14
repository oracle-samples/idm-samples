/*
 * This file is subject to the terms and conditions defined in
 * file 'LICENSE.MD' which is part of this source code package.
 */
package com.example.servlet;

import java.io.IOException;
import java.util.logging.Logger;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import com.example.utils.OICOAuthClient;
import java.util.logging.Level;


/**
 * Prepare requests from Customer Quotes application to /getResource
 */
public class AccessResourceServlet extends HttpServlet {
    private static final long serialVersionUID = 1L;
    private static final String CLASS = AccessResourceServlet.class.getName();
    private static final Logger LOGGER = java.util.logging.Logger.getLogger(CLASS);

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
        processRequest(request, response);
    }


    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
        processRequest(request, response);
    }

    private void processRequest(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
        try {
            LOGGER.info("ResourceServlet: processRequest: authenticateUser:");
            OICOAuthClient.getAuthzCodeRequest(request,  response); 	           
        }catch(Exception ex){
            LOGGER.log(Level.SEVERE, "ResourceServlet: at ex:{0}", ex);
        }
    }

}

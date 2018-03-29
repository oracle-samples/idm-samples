/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
package sampleapp.servlet;

import sampleapp.util.ConnectionOptions;
import java.io.IOException;
import java.io.PrintWriter;
import java.util.HashMap;
import java.util.Map;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import oracle.security.jps.idcsbinding.shared.AuthenticationManager;
import oracle.security.jps.idcsbinding.shared.AuthenticationManagerImpl;
import oracle.security.jps.idcsbinding.shared.IDCSTokenAssertionConfiguration;

/**
 * The AuthSevlet class maps to the /auth URL. 
 * It uses the SDK to generate the authorization code URL, and redirects the browser to the generated URL.
 * @author felippe.oliveira@oracle.com
 * @Copyright Oracle
 */
public class AuthServlet extends HttpServlet {

    /**
     * Processes requests for both HTTP <code>GET</code> and <code>POST</code>
     * methods.
     *
     * @param request servlet request
     * @param response servlet response
     * @throws ServletException if a servlet-specific error occurs
     * @throws IOException if an I/O error occurs
     */
    protected void processRequest(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        //Loading the configurations
        Map<String, Object> options = new ConnectionOptions().getOptions();
        //Configuration object instance with the parameters loaded.
        IDCSTokenAssertionConfiguration config = new IDCSTokenAssertionConfiguration(options);
        //Authentication Manager loaded with the configurations.
        AuthenticationManager am = new AuthenticationManagerImpl(config);
        //Using Authentication Manager to generate the Authorization Code URL, passing the
        //application's callback URL as parameter, along with code value and code parameter.
        String authzURL = am.getAuthorizationCodeUrl(redirectUrl, scope, "1234", "code");
        //Redirecting the browser to the Oracle Identity Cloud Service Authorization URL.
        response.sendRedirect(authzURL);
    }

    // <editor-fold defaultstate="collapsed" desc="HttpServlet methods. Click on the + sign on the left to edit the code.">
    /**
     * Handles the HTTP <code>GET</code> method.
     *
     * @param request servlet request
     * @param response servlet response
     * @throws ServletException if a servlet-specific error occurs
     * @throws IOException if an I/O error occurs
     */
    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        processRequest(request, response);
    }

    /**
     * Handles the HTTP <code>POST</code> method.
     *
     * @param request servlet request
     * @param response servlet response
     * @throws ServletException if a servlet-specific error occurs
     * @throws IOException if an I/O error occurs
     */
    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        processRequest(request, response);
    }

    /**
     * Returns a short description of the servlet.
     *
     * @return a String containing servlet description
     */
    @Override
    public String getServletInfo() {
        return "Short description";
    }// </editor-fold>

}

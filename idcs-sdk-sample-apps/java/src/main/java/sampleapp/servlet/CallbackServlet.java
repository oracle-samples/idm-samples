/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
package sampleapp.servlet;

import sampleapp.util.ConnectionOptions;
import java.io.IOException;
import java.io.PrintWriter;
import java.util.Map;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;
import oracle.security.jps.idcsbinding.api.AccessToken;
import oracle.security.jps.idcsbinding.api.IdToken;
import oracle.security.jps.idcsbinding.api.AuthenticationResult;
import oracle.security.jps.idcsbinding.api.IDCSAppRole;
import oracle.security.jps.idcsbinding.api.IDCSGroup;
import oracle.security.jps.idcsbinding.api.IDCSUser;
import oracle.security.jps.idcsbinding.api.OAuthToken;
import oracle.security.jps.idcsbinding.shared.*;

/**
 * The CallbackServlet maps to the /callback URL, and uses the authorization code parameter 
 * to request an access token. The access token is then stored in the user session, 
 * along with the userId and displayName values. 
 * Then, the Servlet forwards the request to the private/home.jsp page.
 * @Copyright Oracle
 */
public class CallbackServlet extends HttpServlet {

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
        //After Oracle Identity Cloud Service authenticates the user, the browser is redirected to the
        //callback URL, implemented as a Servlet.
        IDCSTokenAssertionConfiguration config = new IDCSTokenAssertionConfiguration(options);
        //Authentication Manager loaded with the configurations.
        AuthenticationManager am = AuthenticationManagerFactory.getInstance(config);
        //Getting the authorization code from the "code" parameter
        String authzCode = request.getParameter("code");
        
        //Using the Authentication Manager to exchange the Authorization Code to an Access Token.
        AuthenticationResult ar = am.authorizationCode(authzCode);
        //Getting the Access Token object and its String value.
        AccessToken access_token = ar.getToken(OAuthToken.TokenType.ACCESS_TOKEN);
        String access_token_string = access_token.getToken();
        //Getting the ID Token object and its String value.
        IdToken id_token = ar.getToken(OAuthToken.TokenType.ID_TOKEN);
        String id_token_string = id_token.getToken();
        //Validating both Tokens to acquire information for User such as UserID, 
        //DisplayName, list of groups and AppRoles assigned to the user.
        IdToken id_token_validated = am.validateIdToken(id_token_string);
        //Storing information into the HTTP Session.
        HttpSession session=request.getSession();
        session.setAttribute("access_token", access_token_string);
        session.setAttribute("id_token", id_token_string);
        session.setAttribute("userId", id_token_validated.getUserId());
        session.setAttribute("displayName", id_token_validated.getDisplayName());
	//Forwarding the request to the Home page.
        request.getRequestDispatcher("private/home.jsp").forward(request, response);
     }

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

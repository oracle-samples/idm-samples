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
import oracle.security.jps.idcsbinding.api.AuthenticationResult;
import oracle.security.jps.idcsbinding.api.IDCSAppRole;
import oracle.security.jps.idcsbinding.api.IDCSGroup;
import oracle.security.jps.idcsbinding.api.IDCSUser;
import oracle.security.jps.idcsbinding.shared.*;

/**
 * The CallbackServlet maps to the /callback URL, and uses the authorization code parameter 
 * to request an access token. The access token is then stored in the user session, 
 * along with the userId and displayName values. 
 * Then, the Servlet forwards the request to the private/home.jsp page.
 * @author felippe.oliveira@oracle.com
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
        AuthenticationManager am = new AuthenticationManagerImpl(config);
        //Getting the authorization code from the "code" parameter
        String authzCode = request.getParameter("code");
        //Using the Authentication Manager to exchange the Authorization Code to an Access Token.
        AuthenticationResult ar = am.authorizationCode(authzCode);
        //Getting the Access Token Value.
        String access_token = ar.getAccessToken();
        //The application then creates a User Session.
        IDCSUserManager um = new IDCSUserManagerImpl(config);
        IDCSUser user = um.getAuthenticatedUser(access_token);
        net.minidev.json.JSONObject json = user.getUser();
        //Storing information into the HTTP Session.
        HttpSession session=request.getSession();
        session.setAttribute("access_token", access_token);
        session.setAttribute("userId", user.getId());
		//Getting information from within the JSON object.
        String displayName = json.getAsString("displayName");
        session.setAttribute("displayName", displayName);
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

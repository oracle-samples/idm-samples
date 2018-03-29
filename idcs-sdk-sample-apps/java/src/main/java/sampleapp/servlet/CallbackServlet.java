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
 *
 * @author felippe.oliveira@oracle.com
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
        Map<String, Object> options = new ConnectionOptions().getOptions();
        IDCSTokenAssertionConfiguration config = new IDCSTokenAssertionConfiguration(options);
        AuthenticationManager am = new AuthenticationManagerImpl(config); 
        String authzCode = request.getParameter("code");
        AuthenticationResult ar = am.authorizationCode(authzCode);
        String access_token = ar.getAccessToken();
        
        IDCSUserManager um = new IDCSUserManagerImpl(config);
        IDCSUser user = um.getAuthenticatedUser(access_token);
        user = um.getUser(user.getId());
        net.minidev.json.JSONObject json = user.getUser();
        
        HttpSession session=request.getSession();
        session.setAttribute("access_token", access_token);
        session.setAttribute("userId", user.getId());

        String displayName = json.getAsString("displayName");
        session.setAttribute("displayName", displayName);

        request.getRequestDispatcher("private/home.jsp").forward(request, response);
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

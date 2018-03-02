/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
package oracle.custom.ui.servlet;

import java.io.IOException;
import java.io.PrintWriter;
import java.net.MalformedURLException;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.URL;
import java.util.logging.Level;
import java.util.logging.Logger;
import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import oracle.custom.ui.common.DomainName;
import oracle.custom.ui.oauth.vo.CredentialsList;
import oracle.custom.ui.oauth.vo.OpenIdConfiguration;

/**
 *
 * @author npattar
 */
@WebServlet(name = "LogoutServlet", urlPatterns = {"/logout/*"})
public class LogoutServlet extends HttpServlet {

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
        final String domain = DomainName.getDomainName();
        String atToken = (String)request.getSession().getAttribute("IDTOKEN");
        String acToken = (String)request.getSession().getAttribute("ATTOKEN");
        StringBuffer url = request.getRequestURL();
        String uri = request.getRequestURI();
        String ctx = request.getContextPath();
        String base = url.substring(0, url.length() - uri.length() + ctx.length()) + "/";
        response.setContentType("text/html;charset=UTF-8");
        
        try (PrintWriter out = response.getWriter()) {
            try {
                if (request.getSession().getAttribute("AUTHENTICATED") != null) {
                    OpenIdConfiguration idconfig = OpenIdConfiguration.getInstance(domain);
                    System.out.println("Calling endpoint " + idconfig.getLogoutEndpoint() + " At " + atToken);
                    String logOut = idconfig.getLogoutEndpoint(); 
                    String tenantName = DomainName.getDomainName();

                    String clientId = CredentialsList.getCredentials()
                            .get(tenantName).getAppId();
                    logOut = logOut + "?state=123" + "&client_id=" + clientId;
                    if (request.getParameter("send") != null && 
                            Boolean.valueOf(request.getParameter("send"))) {
                        logOut = logOut + "&post_logout_redirect_uri=" + (base);
                    }
                    if (atToken != null) {
                        logOut = logOut + "&id_token_hint=" + atToken;
                    } else {
                        logOut = logOut + "&method=oidc&token=" + acToken ;
                    }
                    System.out.println("doing logout with url \n " + logOut);
                    response.sendRedirect(logOut);
                }
            } catch (Exception es) {
                es.printStackTrace();
                response.sendRedirect("/error.jsp");
            } finally {
                request.getSession().invalidate();
            }
        }
    }
    public static void main(String args[]) throws URISyntaxException {
        try {
            new URL("");
        } catch (MalformedURLException ex) {
          ex.printStackTrace();
        }
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

/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

// this servlet simply initiated the login flow
// it does this by sening an OAuth / OpenID Connect Authorization Code request

package oracle.custom.ui.servlet;

import java.io.IOException;
import java.io.PrintWriter;
import java.net.URI;
import java.util.UUID;
import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import oracle.custom.ui.common.DomainName;
import oracle.custom.ui.oauth.vo.CredentialsList;
import oracle.custom.ui.oauth.vo.OpenIdConfiguration;
import org.apache.http.client.utils.URIBuilder;
import org.apache.http.client.utils.URLEncodedUtils;

/**
 *
 * @author npattar
 */
@WebServlet(name = "LoginServlet", urlPatterns = {"/login"})
public class LoginServlet extends HttpServlet {

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
        response.setContentType("text/html;charset=UTF-8");
        //System.out.println("User Agent " + request.getHeader("User-Agent"));
        try (PrintWriter out = response.getWriter()) {
            // if we come back here after the user is already authenticated it means
            // that we're looking for OAuth consent
            if (request.getSession().getAttribute("AUTHENTICATED") != null) {
                request.getRequestDispatcher("/oauthallowed.jsp").forward(request, response);
            }
            try {
                String tenantName = (String) DomainName.getDomainName();

                String endpoint = OpenIdConfiguration.getInstance(tenantName).getAuthzEndpoint();
                String clientId = CredentialsList.getCredentials()
                        .get(tenantName).getId();
                StringBuffer url = request.getRequestURL();
                String uri = request.getRequestURI();
                String ctx = request.getContextPath();
                String base = url.substring(0, url.length() - uri.length() + ctx.length()) + "/";
                //String redirecturl = base + "atreturn/";
                //String openIdConfig = endpoint + "?client_id=" + clientId + 
                //        "&response_type=code&redirect_uri=" + redirecturl + 
                //        "&scope=urn:opc:idm:t.user.me+openid+urn:opc:idm:__myscopes__&nonce=" + UUID.randomUUID().toString();

                URIBuilder builder = new URIBuilder( endpoint );
                builder.addParameter("client_id", clientId );
                builder.addParameter("response_type","code");
                builder.addParameter("redirect_uri", base + "atreturn/");
                builder.addParameter("scope","urn:opc:idm:t.user.me openid urn:opc:idm:__myscopes__");
                builder.addParameter("nonce",UUID.randomUUID().toString());
                URI redirectUrl = builder.build();

                System.out.println("Opend Id URL is " + redirectUrl.toString());
                response.sendRedirect(redirectUrl.toString());
            } catch (Exception ex) {
                ex.printStackTrace();
                request.getRequestDispatcher("/error.jsp").forward(request, response);
            }
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

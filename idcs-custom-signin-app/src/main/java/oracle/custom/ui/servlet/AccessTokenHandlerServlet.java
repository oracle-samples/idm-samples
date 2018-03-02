/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
package oracle.custom.ui.servlet;

import java.io.IOException;
import java.util.Base64;
import java.util.Map;
import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import oracle.custom.ui.common.DomainName;
import oracle.custom.ui.oauth.utils.AccessTokenUtils;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.type.TypeReference;

/**
 *
 * @author npattar
 */
@WebServlet(name = "AccessTokenHandlerServlet", urlPatterns = {"/atreturn/*"})
public class AccessTokenHandlerServlet extends HttpServlet {

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
        String tenantName = DomainName.getDomainName();
        String code = request.getParameter("code");
        StringBuffer url = request.getRequestURL();
        String uri = request.getRequestURI();
        String ctx = request.getContextPath();
        String base = url.substring(0, url.length() - uri.length() + ctx.length()) + "/";
        String redirecturl = base + "atreturn/";
        try {
            System.out.println("Getting access token...");
            AccessTokenUtils.AccessToken atToken = 
                    AccessTokenUtils.generateAccessTokenForApp(tenantName, redirecturl, code);
            if (atToken != null && atToken.getAccess_token() != null) {
                request.getSession().setAttribute("AUTHENTICATED", "AUTHENTICATED");
                request.getSession().setAttribute("ATTOKEN", atToken.getAccess_token());
                request.getSession().setAttribute("IDTOKEN", atToken.getId_token());
                
                // this extracts info from the Access Token
                // NOTE: it's generally a good idea to use a library for this
                //       but this code is intended as a demo so we're skipping that
                String tokens [] = atToken.getAccess_token().split("\\.");
                String d = new String(Base64.getDecoder().decode(tokens[1]));
                request.getSession().setAttribute("ATTOKEN_CLAIMS", d);
                ObjectMapper mapper = new ObjectMapper();
                Map<String, Object> map = mapper.readValue(d,
                        new TypeReference<Map<String, Object>>() {});
                //System.out.println("User display name is: " + map.get("user_displayname"));
                request.getSession().setAttribute("UserName", map.get("user_displayname"));

                // then just get the claims out of the ID token as well
                tokens = atToken.getId_token().split("\\.");
                d = new String(Base64.getDecoder().decode(tokens[1]));
                request.getSession().setAttribute("IDTOKEN_CLAIMS", d);

                response.sendRedirect(base);
                return;
            }
        } catch (Exception ex) {
            ex.printStackTrace();
        }      
        response.sendRedirect(base + "error.jsp");
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

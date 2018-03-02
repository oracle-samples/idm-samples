/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
package oracle.custom.ui.servlet;

import java.io.IOException;
import java.io.PrintWriter;
import java.net.URI;
import java.net.URLEncoder;
import java.util.Map;
import java.util.UUID;
import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import oracle.custom.ui.oauth.vo.OpenIdConfiguration;
import oracle.custom.ui.utils.ServerUtils;
import org.apache.http.HttpEntity;
import org.apache.http.HttpHost;
import org.apache.http.HttpResponse;
import org.apache.http.client.HttpClient;
import org.apache.http.client.methods.CloseableHttpResponse;
import org.apache.http.client.methods.HttpGet;
import org.apache.http.client.utils.URIBuilder;
import org.apache.http.client.utils.URLEncodedUtils;
import org.apache.http.util.EntityUtils;

/**
 *
 * @author cmj
 */
@WebServlet(name = "ConfigInputCheck", urlPatterns = {"/ConfigInputCheck"})
public class ConfigInputCheck extends HttpServlet {

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
        System.out.println("processing ConfigInputCheck request");
        try {
            PrintWriter out = response.getWriter();
            
            String whichform = request.getParameter("whichform");

            String domain = request.getParameter("domain");                
            String idcsUrl = request.getParameter("idcsUrl");
            String myUrl = request.getParameter("myUrl");

            String clientId = request.getParameter("clientId");
            String clientSecret = request.getParameter("clientSecret");

            String appId = request.getParameter("appId");
            String appSecret = request.getParameter("appSecret");
            switch ( whichform ) {
                case "checkOpenID":
                    OpenIdConfiguration openidConf = OpenIdConfiguration.getButDontSave(idcsUrl);
                    
                    URIBuilder builder = new URIBuilder( openidConf.getAuthzEndpoint() );
                    builder.addParameter("client_id", clientId );
                    builder.addParameter("response_type","code");
                    builder.addParameter("redirect_uri", myUrl + "atreturn/");
                    builder.addParameter("scope","urn:opc:idm:t.user.me openid urn:opc:idm:__myscopes__");
                    builder.addParameter("nonce",UUID.randomUUID().toString());
                    
                    URI url = builder.build();
                    
                    System.out.println("URL: " + url.toString() );
                    
                    // now go get it
                    HttpClient client = ServerUtils.getClient();

                    HttpGet get = new HttpGet(url);
                    HttpHost host = new HttpHost(url.getHost(), url.getPort(), url.getScheme());
                    HttpResponse httpResponse = client.execute(host, get);
                    try {
                        // IDCS behavior has changed.
                        // older versions returned 303 with a Location: header
                        // current version returns 200 with HTML
                        
                        if ( ( httpResponse.getStatusLine().getStatusCode() == 303 ) ||
                             ( httpResponse.getStatusLine().getStatusCode() == 200 )) {
                                System.out.println("Request seems to have worked");
                                out.print( "Success?");
                        }
                        else
                            throw new ServletException( "Invalid status from OAuth AZ URL. Expected 303, got " + httpResponse.getStatusLine().getStatusCode() );
                        
                    } finally {
                        if (response instanceof CloseableHttpResponse) {
                            ((CloseableHttpResponse) response).close();
                        }
                    }
                    break;
                    
                default:
                    throw new Exception("Invalid request");
            }

        }
        catch ( Exception e ) {
            e.printStackTrace();
            throw new ServletException( "Error.");
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
        //processRequest(request, response);
        throw new ServletException( "Do not call.");
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

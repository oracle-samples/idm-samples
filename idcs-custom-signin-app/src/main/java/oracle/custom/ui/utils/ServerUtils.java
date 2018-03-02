/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
package oracle.custom.ui.utils;

import java.io.ByteArrayInputStream;
import java.net.URI;
import java.security.KeyManagementException;
import java.security.NoSuchAlgorithmException;
import java.security.PublicKey;
import java.security.SecureRandom;
import java.security.cert.CertificateException;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.util.Base64;
import java.util.List;
import javax.net.ssl.HostnameVerifier;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLSession;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;
import oracle.custom.ui.common.DomainName;
import oracle.custom.ui.oauth.utils.AccessTokenUtils;
import oracle.custom.ui.oauth.vo.Credentials;
import oracle.custom.ui.oauth.vo.CredentialsList;
import org.apache.http.HttpEntity;
import org.apache.http.HttpHost;
import org.apache.http.HttpResponse;
import org.apache.http.client.HttpClient;
import org.apache.http.client.methods.CloseableHttpResponse;
import org.apache.http.client.methods.HttpGet;
import org.apache.http.impl.client.HttpClientBuilder;
import org.apache.http.util.EntityUtils;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.codehaus.jettison.json.JSONArray;
import org.codehaus.jettison.json.JSONObject;

/**
 *
 * @author npattar
 */
public class ServerUtils {
    
    public static String prepareRemoteIdpContent(String sResponseData, boolean remoteIdps)
            throws Exception {
        StringBuffer buffer = new StringBuffer();
        if (sResponseData != null && remoteIdps) {
            buffer.append("<div class=\"panel x2\">");
            buffer.append("<h3 class=\"green-color text-left\">Sign In With Remote IDPs</h3><br/>");

            JSONObject obj = new JSONObject(sResponseData);
            JSONArray array = obj.getJSONArray("remoteIdps");
            if (array.length() > 0) {
                for (int i = 0; i < array.length() ; i++) {
                    JSONObject rIdp = array.getJSONObject(i);
                    String tenantName = rIdp.getString("name");
                    String idpId = rIdp.getString("id");
                    buffer.append("<img height=\"30px\" width=\"30px\" src=\"img/idp.png\"></img>&nbsp;&nbsp;&nbsp;")
                            .append("<a style=\"font-size: x-large\" href=\"javascript:void(0);\"  onclick=\"activateIdp('")
                            .append(tenantName).append("', '").append(idpId).append("' )\">").append(tenantName).append("</a>");
                }
            }
            array = obj.getJSONArray("socialIdps");
            if (array != null && array.length() > 0) {
                for (int i = 0; i < array.length() ; i++) {
                    JSONObject rIdp = array.getJSONObject(i);
                    String tenantName = rIdp.getString("name");
                    String idpId = rIdp.getString("id");
                    buffer.append("<img height=\"30px\" width=\"30px\" src=\"img/idp.png\"></img>&nbsp;&nbsp;&nbsp;")
                            .append("<a style=\"font-size: x-large\" href=\"javascript:void(0);\"  onclick=\"activateSocialIdp('")
                            .append(tenantName).append("', '").append(idpId).append("' )\">").append(tenantName).append("</a>");
                }
            }
            buffer.append("</div>");
        }
        return buffer.toString();
    }
    
    public static String getIDCSServerURL(String domainName) {
        return getIDCSBaseURL(domainName) + "/sso/v1/user/secure/login";
    }
    
    public static String getIDCSBaseURL(String domainName) {
        //return DomainName.getProtocol() + "://" + domainName + DomainName.getHostSuffix();
        return CredentialsList.getCredentials().get(DomainName.getDomainName()).getIdcsUrl();

    }
    
    public static SSLContext getContext() throws NoSuchAlgorithmException, KeyManagementException {
        TrustManager tms [] = new TrustManager[] {
           new X509TrustManager() {
                @Override
                public void checkClientTrusted(X509Certificate[] xcs, String string)
                        throws CertificateException {
                
                }

                @Override
                public void checkServerTrusted(X509Certificate[] xcs, String string)
                        throws CertificateException {
                
                }

                @Override
                public X509Certificate[] getAcceptedIssuers() {
                    return null;
                }
           }
        };
        
        SSLContext context = SSLContext.getInstance("TLS");
        context.init(null, tms, new SecureRandom());
        return context;
    }
    
    
    public static HttpClient getClient() throws NoSuchAlgorithmException, KeyManagementException {
        SSLContext context = getContext();
        HostnameVerifier allHostsValid = (String hostname, SSLSession session) -> {
            return true; 
        };
       
        HttpClient client;
        client = HttpClientBuilder.create()
                .disableCookieManagement()
                .disableRedirectHandling()
                .setSSLContext(context)
                .setSSLHostnameVerifier(allHostsValid)
                .build();
        
        
        return client;
    }
    
    public static HttpClient getClient(String tenantName) throws NoSuchAlgorithmException, KeyManagementException {
        SSLContext context = getContext();
        HostnameVerifier allHostsValid = (String hostname, SSLSession session) -> {
            return true;
        }; 
       
        HttpClient client;
        client = HttpClientBuilder.create()
                .disableCookieManagement()
                .disableRedirectHandling()
                .setSSLContext(context)
                .setSSLHostnameVerifier(allHostsValid)
                .build();
        
       
        return client;
    }
    
    public static PublicKey getServerPublicKey(String domainName) throws Exception {
        HttpClient client = getClient(domainName);
        PublicKey key = null;
        String url = getIDCSBaseURL(domainName) + "/admin/v1/SigningCert/jwk";
        URI uri = new URI(url);
        HttpHost host = new HttpHost(uri.getHost(), uri.getPort(), uri.getScheme());
        HttpGet httpGet = new HttpGet(uri);
        httpGet.addHeader("Authorization", "Bearer " + AccessTokenUtils.getAccessToken(domainName));
        HttpResponse response = client.execute(host, httpGet);
        try {
            HttpEntity entity2 = response.getEntity();
            String res = EntityUtils.toString(entity2);
            EntityUtils.consume(entity2);
            ObjectMapper mapper = new ObjectMapper();
            System.out.println("result is " +res );
            SigningKeys signingKey = mapper.readValue(res, SigningKeys.class);
            
            String base64Cert = signingKey.getKeys().get(0).getX5c().get(0);
            byte encodedCert[] = Base64.getDecoder().decode(base64Cert);
            ByteArrayInputStream inputStream  =  new ByteArrayInputStream(encodedCert);
            
            CertificateFactory certFactory = CertificateFactory.getInstance("X.509");
            X509Certificate cert = (X509Certificate)certFactory.generateCertificate(inputStream);
            key = cert.getPublicKey();
        } finally {
            if (response instanceof CloseableHttpResponse) {
                ((CloseableHttpResponse)response).close();
            }
        }
        return key;
    }
}

@JsonIgnoreProperties(ignoreUnknown = true)
class SigningKeys {
    List<SigningKey> keys;
     public List<SigningKey> getKeys() {
        return keys;
    }

    public void setKeys(List<SigningKey> x5c) {
        this.keys = x5c;
    }
}       

@JsonIgnoreProperties(ignoreUnknown = true)
class SigningKey {
    private List<String> x5c;

    public List<String> getX5c() {
        return x5c;
    }

    public void setX5c(List<String> x5c) {
        this.x5c = x5c;
    }
}

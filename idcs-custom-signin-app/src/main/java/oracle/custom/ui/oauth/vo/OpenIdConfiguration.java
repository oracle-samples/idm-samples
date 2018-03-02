/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
package oracle.custom.ui.oauth.vo;

import java.net.URI;
import java.util.HashMap;
import java.util.Map;
import oracle.custom.ui.utils.ServerUtils;
import org.apache.http.HttpEntity;
import org.apache.http.HttpHost;
import org.apache.http.HttpResponse;
import org.apache.http.client.HttpClient;
import org.apache.http.client.methods.CloseableHttpResponse;
import org.apache.http.client.methods.HttpGet;
import org.apache.http.util.EntityUtils;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.ObjectMapper;


/**
 *
 * @author npattar
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class OpenIdConfiguration {
    private static final String endpoint = "/.well-known/openid-configuration";
    private static final String OAUTH_ENDP = "authorization_endpoint";
    private static final String TOKEN_ENDP = "token_endpoint";
    private static final String LOGOUT_ENDP = "end_session_endpoint";
    
    private static Map<String, OpenIdConfiguration> configMap = new HashMap<String, OpenIdConfiguration>();
    private String authzEndpoint;
    private String tokenEndpoint;
    private String logoutEndpoint;

    @JsonProperty(LOGOUT_ENDP)
    public String getLogoutEndpoint() {
        return logoutEndpoint;
    }

    @JsonProperty(LOGOUT_ENDP)
    public void setLogoutEndpoint(String logoutEndpoint) {
        this.logoutEndpoint = logoutEndpoint;
    }

    @JsonProperty(OAUTH_ENDP)
    public String getAuthzEndpoint() {
        return authzEndpoint;
    }

    @JsonProperty(OAUTH_ENDP)
    public void setAuthzEndpoint(String authzEndpoint) {
        this.authzEndpoint = authzEndpoint;
    }

    @JsonProperty(TOKEN_ENDP)
    public String getTokenEndpoint() {
        return tokenEndpoint;
    }

    @JsonProperty(TOKEN_ENDP)
    public void setTokenEndpoint(String tokenEndpoint) {
        this.tokenEndpoint = tokenEndpoint;
    }
    
    public static OpenIdConfiguration getInstance(String tenantName)
        throws Exception {
        if (configMap.containsKey(tenantName.toLowerCase())) {
            return configMap.get(tenantName.toLowerCase());
        }
        String url = ServerUtils.getIDCSBaseURL(tenantName) + endpoint;
        System.out.println("URL for tenant '" + tenantName + "' is '" + url + "'");
        HttpClient client = ServerUtils.getClient(tenantName);
        URI uri = new URI(url);
        HttpGet get = new HttpGet(uri);
        HttpHost host = new HttpHost(uri.getHost(), uri.getPort(), uri.getScheme());
        HttpResponse response = client.execute(host, get);
        try {
            HttpEntity entity2 = response.getEntity();
            String res = EntityUtils.toString(entity2);
            EntityUtils.consume(entity2);
            ObjectMapper mapper = new ObjectMapper();
            //res = res.replaceAll("secureoracle.idcs.internal.oracle.com:443", "oc-140-86-12-131.compute.oraclecloud.com");
            OpenIdConfiguration openIdConfigInstance = mapper.readValue(res, OpenIdConfiguration.class);
            
            configMap.put(tenantName.toLowerCase(), openIdConfigInstance);
            return openIdConfigInstance;          
        } finally {
            if (response instanceof CloseableHttpResponse) {
                ((CloseableHttpResponse)response).close();
            }
        }
    }
    
    public static OpenIdConfiguration getButDontSave(String baseUrl)
        throws Exception {
        
        String url = baseUrl + endpoint;
        System.out.println("URL is '" + url + "'");
        HttpClient client = ServerUtils.getClient();
        URI uri = new URI(url);
        HttpGet get = new HttpGet(uri);
        HttpHost host = new HttpHost(uri.getHost(), uri.getPort(), uri.getScheme());
        HttpResponse response = client.execute(host, get);
        try {
            HttpEntity entity2 = response.getEntity();
            String res = EntityUtils.toString(entity2);
            EntityUtils.consume(entity2);
            ObjectMapper mapper = new ObjectMapper();
            //res = res.replaceAll("secureoracle.idcs.internal.oracle.com:443", "oc-140-86-12-131.compute.oraclecloud.com");
            OpenIdConfiguration openIdConfigInstance = mapper.readValue(res, OpenIdConfiguration.class);
            
            return openIdConfigInstance;          
        } finally {
            if (response instanceof CloseableHttpResponse) {
                ((CloseableHttpResponse)response).close();
            }
        }
    }
    
}

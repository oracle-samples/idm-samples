/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
package oracle.custom.ui.oauth.utils;

import java.net.URI;
import java.util.Base64;
import oracle.custom.ui.oauth.vo.Credentials;
import oracle.custom.ui.oauth.vo.CredentialsList;
import oracle.custom.ui.oauth.vo.OpenIdConfiguration;
import oracle.custom.ui.utils.ServerUtils;
import org.apache.http.HttpEntity;
import org.apache.http.HttpHeaders;
import org.apache.http.HttpHost;
import org.apache.http.HttpResponse;
import org.apache.http.client.HttpClient;
import org.apache.http.client.methods.CloseableHttpResponse;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.entity.StringEntity;
import org.apache.http.util.EntityUtils;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 *
 * @author npattar
 */
public class AccessTokenUtils {
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class AccessToken {
        private String access_token;
        private String expires_in;
        private String token_type;
        private String id_token;

        public String getId_token() {
            return id_token;
        }

        public void setId_token(String id_token) {
            this.id_token = id_token;
        }

        public String getAccess_token() {
            return access_token;
        }

        public void setAccess_token(String access_token) {
            this.access_token = access_token;
        }

        public String getExpires_in() {
            return expires_in;
        }

        public void setExpires_in(String expires_in) {
            this.expires_in = expires_in;
        }

        public String getToken_type() {
            return token_type;
        }

        public void setToken_type(String token_type) {
            this.token_type = token_type;
        }
    }
    
    public static String getAccessToken(String tenantName) throws Exception {
        Credentials creds = CredentialsList.getCredentials().get(tenantName);
        HttpClient client = ServerUtils.getClient(tenantName);
        String url =  OpenIdConfiguration.getInstance(tenantName).getTokenEndpoint();
        URI uri = new URI(url);
        HttpHost host = new HttpHost(uri.getHost(), uri.getPort(), uri.getScheme());
        HttpPost httpPost = new HttpPost(uri);
        HttpEntity entity = new StringEntity("grant_type=client_credentials&scope=urn:opc:idm:__myscopes__");
        httpPost.setEntity(entity);  
        httpPost.setHeader(HttpHeaders.CONTENT_TYPE, "application/x-www-form-urlencoded");
        String concat = creds.getAppId() + ":" + creds.getAppSecret();
        String auth = Base64.getEncoder()
                .encodeToString(concat.getBytes());
        httpPost.setHeader(HttpHeaders.AUTHORIZATION,
                    "Basic " + auth);
        
        HttpResponse response = client.execute(host, httpPost);
        try {
            HttpEntity entity2 = response.getEntity();
            String res = EntityUtils.toString(entity2);
            EntityUtils.consume(entity2);
            ObjectMapper mapper = new ObjectMapper();
            AccessToken token = mapper.readValue(res, AccessToken.class);
            return token.getAccess_token();
        } finally {
            if (response instanceof CloseableHttpResponse) {
                ((CloseableHttpResponse)response).close();
            }
        }
    }
    
    public static String getAccessToken(String clientId, String secret, String tenantName) throws Exception {
        HttpClient client = ServerUtils.getClient(tenantName);
        String url =  OpenIdConfiguration.getInstance(tenantName).getTokenEndpoint();
        URI uri = new URI(url);
        HttpHost host = new HttpHost(uri.getHost(), uri.getPort(), uri.getScheme());
        HttpPost httpPost = new HttpPost(uri);
        HttpEntity entity = new StringEntity("grant_type=client_credentials&scope=urn:opc:idm:__myscopes__");
        httpPost.setEntity(entity);  
        httpPost.setHeader(HttpHeaders.CONTENT_TYPE, "application/x-www-form-urlencoded");
        String concat = clientId + ":" + secret;
        String auth = Base64.getEncoder()
                .encodeToString(concat.getBytes());
        httpPost.setHeader(HttpHeaders.AUTHORIZATION,
                    "Basic " + auth);
        
        HttpResponse response = client.execute(host, httpPost);
        try {
            HttpEntity entity2 = response.getEntity();
            String res = EntityUtils.toString(entity2);
            EntityUtils.consume(entity2);
            ObjectMapper mapper = new ObjectMapper();
            AccessToken token = mapper.readValue(res, AccessToken.class);
            return token.getAccess_token();
        } finally {
            if (response instanceof CloseableHttpResponse) {
                ((CloseableHttpResponse)response).close();
            }
        }
    }
    
    
    public static AccessToken generateAccessTokenForApp(String tenantName,
            String redirecturl, String code) throws Exception {
        Credentials creds = CredentialsList.getCredentials().get(tenantName);
        HttpClient client = ServerUtils.getClient(tenantName);
        String url =  OpenIdConfiguration.getInstance(tenantName).getTokenEndpoint();
        URI uri = new URI(url);
        HttpHost host = new HttpHost(uri.getHost(), uri.getPort(), uri.getScheme());
        HttpPost httpPost = new HttpPost(uri);
        
        HttpEntity entity = new StringEntity("grant_type=authorization_code&code=" +
                code + "&redirect_uri=" + redirecturl);
        httpPost.setEntity(entity);  
        httpPost.setHeader(HttpHeaders.CONTENT_TYPE, "application/x-www-form-urlencoded");
        String concat = creds.getId()+ ":" + creds.getKey();
        String auth = Base64.getEncoder()
                .encodeToString(concat.getBytes());
        httpPost.setHeader(HttpHeaders.AUTHORIZATION,
                    "Basic " + auth);
        
        HttpResponse response = client.execute(host, httpPost);
        try {
            HttpEntity entity2 = response.getEntity();
            String res = EntityUtils.toString(entity2);
            EntityUtils.consume(entity2);
            ObjectMapper mapper = new ObjectMapper();
            System.out.println("Value received " + res);
            
            AccessToken token = mapper.readValue(res, AccessToken.class);
            return token;
        } finally {
            if (response instanceof CloseableHttpResponse) {
                ((CloseableHttpResponse)response).close();
            }
        }
    }
    
    public static AccessToken generateAccessToken(String tenantName,
            String redirecturl, String code) throws Exception {
        Credentials creds = CredentialsList.getCredentials().get(tenantName);
        HttpClient client = ServerUtils.getClient(tenantName);
        String url =  OpenIdConfiguration.getInstance(tenantName).getTokenEndpoint();
        URI uri = new URI(url);
        HttpHost host = new HttpHost(uri.getHost(), uri.getPort(), uri.getScheme());
        HttpPost httpPost = new HttpPost(uri);
        
        HttpEntity entity = new StringEntity("grant_type=authorization_code&code=" +
                code + "&redirect_uri=" + redirecturl);
        httpPost.setEntity(entity);  
        httpPost.setHeader(HttpHeaders.CONTENT_TYPE, "application/x-www-form-urlencoded");
        String concat = creds.getId() + ":" + creds.getKey();
        String auth = Base64.getEncoder()
                .encodeToString(concat.getBytes());
        httpPost.setHeader(HttpHeaders.AUTHORIZATION,
                    "Basic " + auth);
        
        HttpResponse response = client.execute(host, httpPost);
        try {
            HttpEntity entity2 = response.getEntity();
            String res = EntityUtils.toString(entity2);
            EntityUtils.consume(entity2);
            ObjectMapper mapper = new ObjectMapper();
            System.out.println("Value received " + res);
            
            AccessToken token = mapper.readValue(res, AccessToken.class);
            return token;
        } finally {
            if (response instanceof CloseableHttpResponse) {
                ((CloseableHttpResponse)response).close();
            }
        }
    }
    
    public static void main(String args[]) throws Exception {
        System.out.println("Token is " + getAccessToken("cisco"));
    }
}

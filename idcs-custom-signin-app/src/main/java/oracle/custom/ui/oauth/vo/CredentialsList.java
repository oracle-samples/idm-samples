/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
package oracle.custom.ui.oauth.vo;

/**
 *
 * @author npattar
 */


import java.io.File;
import java.util.HashMap;
import java.util.Map;
import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.fasterxml.jackson.databind.ObjectMapper;

public class CredentialsList {
    private static Map<String, Credentials> credentials;
    
    static {
        File f = new File("client.secrets");
        System.out.println("file path:: " + f.getAbsolutePath());
        try {
            if (f.exists()) {
                ObjectMapper mapper = new ObjectMapper();
                CredentialsList list = mapper.readValue(f, CredentialsList.class);
                credentials = list.getCredentials();
            } else {
                credentials = new HashMap<String, Credentials>();
                System.out.println("Credentials are " + credentials);
            }
        } catch (Exception ex) {
            ex.printStackTrace();
        }
    }
    
    public CredentialsList() {
        credentials = new HashMap<>();
    }


    public static Map<String, Credentials> getCredentials() {
        return credentials;
    }

    public static void setCredentials(Map<String, Credentials> creds) {
        credentials = creds;
    }

    @JsonAnySetter
    public void set(String name, Object value) {
        if (value != null) {
            Map<String, Object> values = 
                    (Map<String, Object>) value;
            Credentials crs = new Credentials();
            crs.setId("" + values.get("id"));
            crs.setKey("" + values.get("key"));
            crs.setAppId("" + values.get("appId"));
            crs.setAppSecret("" + values.get("appSecret"));
            crs.setIdcsUrl("" + values.get("idcsUrl"));
            credentials.put(name, crs);
        }
    }
    //public static void storeAppConfigId(String appId, String secret, String domain) {
    //    Credentials crds = credentials.get(domain);
    //    if (crds == null) {
    //        crds = new Credentials();
    //    }
    //    crds.setAppId(appId);
    //    crds.setAppSecret(secret);
    //    credentials.put(domain, crds);
    //    ObjectMapper mapper = new ObjectMapper();
    //    try {
    //        mapper.defaultPrettyPrintingWriter()
    //                .writeValue(new File("client.secrets"),credentials);            
    //    } catch (Exception ex) {
    //        ex.printStackTrace();
    //    }
    //}
    //
    //public static void storeClientIdSecret(String clientId, String secret,
    //        String domain) {
    //    Credentials crds = credentials.get(domain);
    //    if (crds == null) {
    //        crds = new Credentials();
    //    }
    //    crds.setId(clientId);
    //    crds.setKey(secret);
    //    credentials.put(domain, crds);
    //    ObjectMapper mapper = new ObjectMapper();
    //    try {
    //        mapper.defaultPrettyPrintingWriter()
    //                .writeValue(new File("client.secrets"),credentials);            
    //    } catch (Exception ex) {
    //        ex.printStackTrace();
    //    }
    //}
    
    public static void store( String domain, String url, String appId, String appSecret, String clientId, String clientSecret ) {
        Credentials crds = credentials.get(domain);
        if (crds == null) {
            crds = new Credentials();
        }
        
        crds.setIdcsUrl(url);
        crds.setAppId(appId);
        crds.setAppSecret(appSecret);
        crds.setId(clientId);
        crds.setKey(clientSecret);
        credentials.put(domain, crds);
        ObjectMapper mapper = new ObjectMapper();
        try {
            mapper.writerWithDefaultPrettyPrinter()
                    .writeValue(new File("client.secrets"),credentials);            
        } catch (Exception ex) {
            ex.printStackTrace();
        }
    }
}
/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
package sampleapp.util;

import java.util.HashMap;
import java.util.Map;
import oracle.security.jps.idcsbinding.shared.Constants;
import oracle.security.jps.idcsbinding.shared.IDCSTokenAssertionConfiguration;


/**
 *
 * @author felippe.oliveira@oracle.com
 */
public class ConnectionOptions {
    
    private Map<String,Object> options = new HashMap<String,Object>();
    
    public ConnectionOptions(){
        this.options = new HashMap<>();
    }
    
    public Map<String,Object> getOptions(){
                    

        this.options.put(Constants.TOKEN_ISSUER, "https://identity.oraclecloud.com");
        this.options.put("redirectURL", "http://localhost:8080/callback");
        this.options.put("scope", "urn:opc:idm:t.user.me openid");
        this.options.put("logoutSufix", "/sso/v1/user/logout");
        this.options.put("SSLEnabled", "true");
        return this.options;
    }
}

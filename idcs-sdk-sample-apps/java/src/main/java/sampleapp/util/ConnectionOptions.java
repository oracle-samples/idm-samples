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
 * This class provides the parameters for the SDK to connect with a 
 * Oracle Identity Cloud Service instance.
 * The list of parameters must be added to a HashMap.
 * @author felippe.oliveira@oracle.com
 * @Copyright Oracle
 */
public class ConnectionOptions {
    
    //Instance of a HashMap.
    private Map<String,Object> options = new HashMap<>();
    
    public ConnectionOptions(){
        this.options = new HashMap<>();
    }
    
    public Map<String,Object> getOptions(){
        //Adding Oracle Identity Cloud Service connection parameters to the HashMap instance.
        this.options.put(IDCSTokenAssertionConfiguration.IDCS_HOST, "identity.oraclecloud.com");
        this.options.put(IDCSTokenAssertionConfiguration.IDCS_PORT, "443");
        this.options.put(IDCSTokenAssertionConfiguration.IDCS_CLIENT_ID, "123456789abcdefghij");
        this.options.put(IDCSTokenAssertionConfiguration.IDCS_CLIENT_SECRET, "abcde-12345-zyxvu-98765-qwerty");
        this.options.put(IDCSTokenAssertionConfiguration.IDCS_CLIENT_TENANT, "idcs-abcd1234");
        this.options.put(Constants.AUDIENCE_SERVICE_URL, "https://idcs-abcd1234.identity.oraclecloud.com");
        this.options.put(Constants.TOKEN_ISSUER, "https://identity.oraclecloud.com/");
        this.options.put(Constants.TOKEN_CLAIM_SCOPE, "urn:opc:idm:t.user.me openid");
        this.options.put("SSLEnabled", "true");
        this.options.put("redirectURL", "http://localhost:8080/callback");
        this.options.put("logoutSufix", "/oauth2/v1/userlogout");
        this.options.put(Constants.LOG_LEVEL, "INFO");
        this.options.put(Constants.CONSOLE_LOG, "True");
        return this.options;
    }
}

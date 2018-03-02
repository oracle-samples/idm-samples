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
public class Credentials {
    String id = "";

    String key = "";
    
    String appId = "";
    
    String appSecret = "";
    
    String idcsUrl = "";

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getKey() {
        return key;
    }

    public void setKey(String key) {
        this.key = key;
    }
    
    public void setAppId(String appId) {
        this.appId = appId;
    }
    
    public String getAppId() {
        return appId;
    }
    
    
    public String getAppSecret() {
        return appSecret;
    }

    public void setAppSecret(String key) {
        this.appSecret = key;
    }
    
        public String getIdcsUrl() {
        return idcsUrl;
    }

    public void setIdcsUrl(String idcsUrl) {
        this.idcsUrl = idcsUrl;
    }
    
}

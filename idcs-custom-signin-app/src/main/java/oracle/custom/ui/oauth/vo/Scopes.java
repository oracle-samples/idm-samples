/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
package oracle.custom.ui.oauth.vo;

import java.util.List;

/**
 *
 * @author npattar
 */
public class Scopes {
    List<Scope> scopes = null;
    public void setScopes(List<Scope> s) {
        scopes = s;
    }
    public List<Scope> getScopes() {
        return scopes;
    }
}

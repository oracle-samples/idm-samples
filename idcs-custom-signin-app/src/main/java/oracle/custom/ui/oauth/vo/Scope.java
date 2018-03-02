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
public class Scope {
    String description;
    String value;
    public void setDescription(String d) {
        this.description = d;
    }
    public void setValue(String va) {
        value = va;
    }

    public String getDescription() {
        return description;
    }

    public String getValue() {
        return value;
    }
}

/*
 * This file is subject to the terms and conditions defined in
 * file 'LICENSE.MD' which is part of this source code package.
 */
package com.example.beans;

/**
 * Represents a logged user on Customer Quotes
 */
public class UserBean {
    private final String birthdate;
    private final String lastName;
    private final String firstName;
    private final String gender;
    private final String displayName;
    private final String username;
    private final String sub;
    private final String website;
    
    public UserBean(String birthdate, String lastName, String firstName, 
                    String gender, String displayName, String username, 
                    String sub, String website){
        this.birthdate = birthdate;
        this.lastName = lastName;
        this.firstName = firstName;
        this.gender = gender;
        this.displayName = displayName;
        this.username = username;
        this.sub = sub;
        this.website = website;
    }//UserBean
    
    public String getBirthdate() {
        return birthdate;
    }

    public String getLastName() {
        return lastName;
    }

    public String getFirstName() {
        return firstName;
    }

    public String getGender() {
        return gender;
    }

    public String getDisplayName() {
        return displayName;
    }

    public String getUsername() {
        return username;
    }

    public String getSub() {
        return sub;
    }

    public String getWebsite() {
        return website;
    }
}

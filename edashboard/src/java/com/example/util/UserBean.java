/**
 * This file is subject to the terms and conditions defined in file 'LICENSE.MD' which is part of this source code package.
 */
package com.example.util;

import java.security.Principal;
import javax.servlet.http.HttpServletRequest;

/**
 * Object that represents a logged user
 */
public class UserBean {
    
    private String userId;
    private String fullName;
    private boolean principalSet = false;
    
    private static final String DUMMY_USER_NAME = "Dummy User";
    private static final String DUMMY_USER_ID = "dummyuser";
    
    /**
     * Dummy constructor for tests
     */
    public UserBean() {
        this.userId = DUMMY_USER_NAME;
        this.fullName = DUMMY_USER_ID;
    }
    
    /**
     * Constructor using a Principal
     * @param request
     */
    public UserBean(HttpServletRequest request){
      if(request.getUserPrincipal() != null){
        //if principal exists, get data from the Principal object
        Principal user = request.getUserPrincipal();
        this.fullName = user.getName();
        this.userId = user.toString();
        this.principalSet = true;
      }else{
        //if principal does not exists, get dummy data
        this.fullName = request.getHeader(DUMMY_USER_NAME);
        this.userId = request.getHeader(DUMMY_USER_ID);
        this.principalSet = false;
      }
    }

    public String getUserId() {
        return userId;
    }

    public String getFullName() {
        return fullName;
    }
    
    public boolean isPrincipalSet() {
        return principalSet;
    }
}


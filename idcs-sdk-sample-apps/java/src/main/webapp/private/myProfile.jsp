<%--
  ~  Copyright (c) 2000, 2021, Oracle and/or its affiliates.
  ~
  ~   Licensed under the Universal Permissive License v 1.0 as shown at
  ~   http://oss.oracle.com/licenses/upl.
  --%>

<%if(session.getAttribute("access_token")==null) response.sendRedirect("/login.html");%>
<!DOCTYPE html>
<%
/**
 * The /private/myProfile.jsp page accesses the user's access token previously set in the session, 
 * calls the getAuthenticatedUser method to retrieve the user's information, and then formats it as HTML.
 * @author felippe.oliveira@oracle.com
 * @Copyright Oracle
*/
  java.util.Map<String, Object> options = new sampleapp.util.ConnectionOptions().getOptions();
  //Configuration object instance with the parameters loaded.
  oracle.security.jps.idcsbinding.shared.IDCSTokenAssertionConfiguration configuration = new oracle.security.jps.idcsbinding.shared.IDCSTokenAssertionConfiguration(options);
  oracle.security.jps.idcsbinding.shared.AuthenticationManager am = oracle.security.jps.idcsbinding.shared.AuthenticationManagerFactory.getInstance(configuration);
  
  //Getting the Access Token and the Id Token from the session object
  String access_token_string = (String)session.getAttribute("access_token");
  String id_token_string = (String)session.getAttribute("id_token");

  //Validating the ID Token to get user information, groups and app roles associated with the user.
  oracle.security.jps.idcsbinding.api.AccessToken access_token_validated = am.validateAccessToken(access_token_string);
  oracle.security.jps.idcsbinding.api.IdToken id_token_validated = am.validateIdToken(id_token_string);

%>
<html>
  <head>
    <meta content="text/html; charset=UTF-8" http-equiv="content-type">
    <title>Java SDK Sample Application</title>
    <link href="../css/sample-app.css" rel="stylesheet" type="text/css">
  </head>
  <body>
    <table style="width: 100%;border-spacing:0px;table-layout:fixed;">
      <tbody>
        <tr class="header">
          <td style="width: 300px;" nowrap="nowrap">
            <table style="width: 100%;padding:5px;border:0px solid white;">
              <tbody>
                <tr>
                  <td>&nbsp;</td>
                </tr>
                <tr>
                  <td nowrap="nowrap">&nbsp;<font class="lightTextLarge">Java Sample Application</font>&nbsp;</td>
                </tr>
                <tr>
                  <td>&nbsp;</td>
                </tr>
              </tbody>
            </table>
          </td>
          <td>&nbsp;</td>
          <td style="width: 300px;">
            <table style="width: 100%;padding:5px;border:0px solid white;">
              <tbody>
                <tr>
                  <td align="left"><font class="lightTextSmall">Welcome,&nbsp;<%=session.getAttribute("displayName")%></font></td>
                  <td align="right"><a href="/logout"><font

                        class="lightTextLarge">Log Out</font></a>&nbsp;</td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
        <tr class="center">
          <td style="width: 300px;" valign="top">
            <table class="leftMenu">
              <tbody>
                <tr>
                  <td><a href="/private/home.jsp"><font class="darkTextLarge">Home</font></a> </td>
                </tr>
                <tr>
                  <td><font class="notSelectedTextLarge">My Profile</font></td>
                </tr>
                <tr>
                  <td>&nbsp;</td>
                </tr>
              </tbody>
            </table>
          </td>
          <td style="padding: 15px;vertical-align:top;word-wrap:break-word;"><font class="darkTextSmall">
              <p><b>Information from the Identity Token:</b></p><p><%
              out.println("DisplayName = "+ id_token_validated.getDisplayName() +"<br>");
              out.println("IdentityDomain = "+ id_token_validated.getIdentityDomain() +"<br>");
              out.println("UserName = "+ id_token_validated.getUserName()+"<br>");
              out.println("UserId = "+ id_token_validated.getUserId()+"<br>");
              out.println("Issuer = "+ id_token_validated.getIssuer()+"<br>");

              java.util.List<oracle.security.jps.idcsbinding.api.IDCSAppRole> appRoles = id_token_validated.getAppRoles();
              if(!appRoles.isEmpty()){
                out.println("App Roles:<br>");
                for(oracle.security.jps.idcsbinding.api.IDCSAppRole appRole: appRoles){
                    out.println("&nbsp;appRole = "+ appRole.getName() +"<br>");
                }//for
              }//if

              java.util.List<oracle.security.jps.idcsbinding.api.IDCSGroup> groups = id_token_validated.getGroupMembership();
              if(!groups.isEmpty()){
                out.println("Groups:<br>");
                for(oracle.security.jps.idcsbinding.api.IDCSGroup group: groups){
                    out.println("&nbsp;group = "+ group.getName() +"<br>");
                }//for
              }//if
              %>
              </p>
              <p><b>Access Token:</b></p><p><%=access_token_string%></p>
            </font> </td>
          <td style="width: 300px;">&nbsp; <span style="font-family: &quot;Source Sans Pro&quot;,sans-serif;"><br>
            </span></td>
        </tr>
        <tr class="footer">
          <td colspan="3" style="text-align: center;" nowrap="nowrap"><a

              class="lightTextSmall" href="http://www.oracle.com/pls/topic/lookup?ctx=cpyr&amp;id=en">Copyright &copy; 2019, Oracle and/or its affiliates. All rights reserved.</a></td>
        </tr>
      </tbody>
    </table>
  </body>
</html>

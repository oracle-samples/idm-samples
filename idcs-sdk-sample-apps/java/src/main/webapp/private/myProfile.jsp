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
 
  String access_token = session.getAttribute("access_token").toString();
  //User Manager loaded with the configurations
  oracle.security.jps.idcsbinding.shared.IDCSUserManager um = new oracle.security.jps.idcsbinding.shared.IDCSUserManagerImpl(configuration);
  //Using the access_token value to get an object instance representing the User Profile.
  oracle.security.jps.idcsbinding.api.IDCSUser user = um.getAuthenticatedUser(access_token);
  //Getting the user details in json object format.
  net.minidev.json.JSONObject json = user.getUser();
  //User information can now be accessed and printed in the page.
  String jsonString = json.toString();
%>
<html>
  <head>
    <meta content="text/html; charset=UTF-8" http-equiv="content-type">
    <title>Java SDK Sample Application</title>
    <link href="../css/sample-app.css" rel="stylesheet" type="text/css">
  </head>
  <body>
    <table style="width: 100%;border-spacing:0px;">
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
                  <td><a href="/private/appDetails.jsp"><font class="darkTextLarge">App Details</font></a> </td>
                </tr>
                <tr>
                  <td>&nbsp;</td>
                </tr>
              </tbody>
            </table>
          </td>
          <td style="padding: 15px;vertical-align:top;"><font class="darkTextSmall">
              <p>Your Profile:</p><p><%=jsonString%></p>
              <p><%=jsonString%></p>
            </font> </td>
          <td style="width: 300px;">&nbsp; <span style="font-family: &quot;Source Sans Pro&quot;,sans-serif;"><br>
            </span></td>
        </tr>
        <tr class="footer">
          <td colspan="3" style="text-align: center;" nowrap="nowrap"><a

              class="lightTextSmall" href="http://www.oracle.com/pls/topic/lookup?ctx=cpyr&amp;id=en">Copyright © 2018, Oracle and/or its affiliates. All rights reserved.</a></td>
        </tr>
      </tbody>
    </table>
  </body>
</html>

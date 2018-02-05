<%if(session.getAttribute("access_token")==null) response.sendRedirect("/login.html");%>
<!DOCTYPE html>
<%
    //Replace the code block with the code provided in the OBE section 3, step 5.

%>
<html>
  <head>
    <meta content="text/html; charset=UTF-8" http-equiv="content-type">
    <title>index.html</title>
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

              class="lightTextSmall" href="http://www.oracle.com/pls/topic/lookup?ctx=cpyr&amp;id=en">Copyright © 2015, 2017, Oracle and/or its affiliates. All rights reserved.</a></td>
        </tr>
      </tbody>
    </table>
  </body>
</html>

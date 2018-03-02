<%-- 
    Document   : consent
    Created on : Aug 29, 2017, 1:21:59 PM
    Author     : npattar
--%>

<%@page import="oracle.custom.ui.common.DomainName"%>
<%@page import="oracle.custom.ui.utils.ServerUtils"%>
<%@page import="oracle.custom.ui.oauth.vo.Scope"%>
<%@page import="oracle.custom.ui.oauth.vo.Scopes"%>
<%@page import="org.codehaus.jackson.map.ObjectMapper"%>
<%@page import="java.util.List"%>
<%@page import="oracle.custom.ui.utils.EncryptionUtils"%>
<%@page import="com.sun.org.apache.xml.internal.security.encryption.EncryptedData"%>
<%@page contentType="text/html" pageEncoding="UTF-8"%>
<!DOCTYPE html>
<html>
    <head>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <title>JSP Page</title>
    </head>
    <%
        String attr = DomainName.getDomainName();
        String imgUrl = EncryptionUtils.decrypt(attr, "clientIconUrl", request);
        imgUrl = imgUrl == null || imgUrl.isEmpty() ? request.getContextPath() + "/img/test.png" : imgUrl;
        String scopes = EncryptionUtils.decrypt(attr, "scopes", request);
        ObjectMapper mapper = new ObjectMapper();
        Scopes scopeList = mapper.readValue(scopes, Scopes.class);
        String ocis = EncryptionUtils.decrypt(attr, "OAUTH_OCIS_REQ", request);
    %>
    <body>
    <center>
        <form action="<%=ServerUtils.getIDCSBaseURL(attr)%>/oauth2/v1/consent" method="post" >
            <input type="hidden" name="OAUTH_OCIS_REQ" value="<%=ocis%>"/>
            <table border="1"> 
                <tr style="border:none"><th style="text-align: center">Consent Form</th></tr>
                <tr style="border:none"><td style="border:none;text-align: center"><img src="<%=imgUrl%>"</td></tr>
                
                <tr style="border:none"><td style="border:none;text-align: center">This application would like to access to following information</td></tr>
                <tr style="border:none">
                    <td style="border:none; ">
                        <ul>
                <%
                    if (scopeList != null && scopeList.getScopes() != null) {
                       for(Scope s: scopeList.getScopes()) {
                           
                        %>
                        <input type="hidden" name="scope" value="<%=s.getValue()%>"/>
                        <li><%=s.getDescription()%></li>
                        <%
                        }
                    }
                %>
                        </ul>
                
                </tr>
                <tr style="border:none"><td style="text-align: center;border:none">
                        <input type="submit" value="authorize" name="authorize" value="Allow" style="background-color: green; color:white;"/>
                        <input type="submit" value="deny" name="authorize" value="Deny" style="background-color: red; color:white;"/>
                </td></tr>
            </table>
        </form>
    </center>
    </body>
    
</html>

<%--
    Document   : config.jsp
    Created on : Nov 3, 2017, 12:25:31 PM
    Author     : cmj
--%>
<%@page import="oracle.custom.ui.oauth.utils.AccessTokenUtils"%>
<%
    if ( request.getMethod() == "POST" ) {
        // if the user is POSTing then save the changes
        String whichform = request.getParameter("whichform");

        String domain = request.getParameter("domain");                
        String url = request.getParameter("idcsUrl");

        String clientId = request.getParameter("clientId");
        String clientSecret = request.getParameter("clientSecret");

        String appId = request.getParameter("appId");
        String appSecret = request.getParameter("appSecret");

        switch ( whichform ) {
            case "domain":
                DomainName.setDomainName(domain);
                break;
            
            case "credentials":

                CredentialsList.store(domain, url, appId, appSecret, clientId, clientSecret);
                                
                break;
                            
            default:
                System.out.println( "someone is doing something wacky. I'm going to ignore it." );
                break;
        }
        
        String accessToken = null;
        try {
            AccessTokenUtils.getAccessToken(DomainName.getDomainName());
        }
        catch ( Exception e ) {
            
        }
    }
%>

<%@page import="oracle.custom.ui.common.DomainName"%>
<%@page import="java.util.Map"%>
<%@page import="oracle.custom.ui.oauth.vo.Credentials"%>
<%@page import="oracle.custom.ui.oauth.vo.CredentialsList"%>
<%@page contentType="text/html" pageEncoding="UTF-8"%>
<!DOCTYPE html>
<html>
    <head>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <title>Config info / update page</title>
  	<!--<script src="/custom/ui/scripts/jquery.min.js"></script>-->
        <script>
            function enableDisableForms() {
                namesMatch = document.forms["config"].elements["domain"].value == document.forms["domainselector"].elements["domain"].value;
                
                toggleElement( document.forms["domainselector"].elements["submitButton"], !namesMatch );
                
                elements = document.forms["config"].elements
                for (var i = 0, element; element = elements[i++];) {
                    toggleElement(element, namesMatch)
                }                
            }
            
            function toggleElement( element, active ) {
                if ( active ) {
                    element.classList.remove("disabled");
                    element.enabled=false;
                }
                else {
                    element.classList.add("disabled");
                    element.enabled=true;
                }                
            }
            
            function removeSpaces(element) {
                if ( element.value = element.value.trim() );
            }

            //function updateCheckUrlButton() {
            //    if ( !document.forms["config"].elements["checkUrlButton"].classList.contains("disabled") ) {
            //        // check the URL
            //        var parser = document.createElement('a');
            //        parser.href = document.forms["config"].elements["idcsUrl"].value;
            //        if ( parser.href.startsWith( window.location.protocol + "//" + window.location.host ) ) {
            //            toggleElement(document.forms["config"].elements["checkUrlButton"], false)
            //        }
            //    }
            //}
            
            function checkUrl() {
                // check the URL
                var parser = document.createElement('a');
                parser.href = document.forms["config"].elements["idcsUrl"].value;
                if ( parser.href.startsWith( window.location.protocol + "//" + window.location.host ) ) {
                    alert("Invalid URL. Please enter a valid URL.\nHint: 'https://' plus the IDCS hostname")
                    return;
                }
                
                var http = new XMLHttpRequest();
                var url = document.forms["config"].elements["idcsUrl"].value + "/.well-known/idcs-configuration";
                http.open("GET", url, true);
                http.onreadystatechange = function() {//Call a function when the state changes.
                    if(http.readyState == 4) {
                        if ( http.status == 200)
                            alert("URL appears to be OK");
                        else
                            alert("URL appears to be invalid");
                    }
                }
                http.send();
            }
            
            function checkOpenIDClientSettings() {
                var http = new XMLHttpRequest();
                http.open("POST", "./ConfigInputCheck", true);
                http.setRequestHeader("Content-type", "application/x-www-form-urlencoded");

                url = window.location.toString();
                url = url.substring(0, url.lastIndexOf("/")+1);
                params = "whichform=checkOpenID" +
                         "&idcsUrl="           + encodeURIComponent(document.forms["config"].elements["idcsUrl"].value)      +
                         "&myUrl="         + encodeURIComponent( url )+
                         "&clientId="      + encodeURIComponent(document.forms["config"].elements["clientId"].value)     +
                         "&clientSecret="  + encodeURIComponent(document.forms["config"].elements["clientSecret"].value);

                http.onreadystatechange = function() {                    
                    if(http.readyState == 4) {
                        if ( http.status == 200)
                            alert("OpenID Configuration OK - was able to make request to 'authorize' endpoint.\n\nNOTE: Secret not verified!");
                        else
                            alert("Invalid OpenID Configuation!");
                    }
                }
                console.log("Params: " + params);
                http.send(params);
            }
            
            
            function checkAppSettings() {
                    var http = new XMLHttpRequest();
                    // i should get the OpenID config and then get the token endpoint from there
                    // but this is just a demo
                    http.open("POST", document.forms["config"].elements["idcsUrl"].value + "/oauth2/v1/token", true);
                    http.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
                    params = "grant_type=client_credentials&scope=urn:opc:idm:__myscopes__";
                    
                    http.setRequestHeader("Authorization", "Basic " + btoa( document.forms["config"].elements["appId"].value + ":" + document.forms["config"].elements["appSecret"].value))
                    
                    console.log( "App ID: " + document.forms["config"].elements["appId"].value )
                    console.log( "App Secret: " + document.forms["config"].elements["appSecret"].value)
                    
                    http.onreadystatechange = function() {//Call a function when the state changes.
                        if(http.readyState == 4) {
                            if ( http.status == 200) {
                                alert("URL and appID and appSecret appear to be OK");
                                console.log("response" + http.responseText)
                            }
                            else
                                alert("Error. Please check URL, App ID, and App Secret");
                        }
                    }
                    http.send(params);
            }
        </script>

    	
	<style type="text/css">
	.rcorner2 {
		border-radius: 25px;
		background: #DFDEDD;
		padding: 10px;
		width: 55%;
		height: 12px;
	}
	
	.rcorner3 {
		border-radius: 5px;
		background: #DFDEDD;
		padding: 10px;
		width: 55%;
		height: 12px;
	}

	.rcorner {
		border-radius: 25px;
		background: #DFDEDD;
		padding: 20px;
		width: 55%;
		height: 20px;
	}

	.pad {
		padding: 5px;
	}

	.button {
		background-color: Green ;
		border: thin;
		color: white;
		padding: 5px 40px;
		text-align: center;
		text-decoration: none;
		display: inline-block;
		font-size: 14px;
		margin: 4px 2px;
		cursor: pointer;
		border-radius: 8px;
	}

        .disabled {
		background-color: Grey ;
	}

        
	.textstyle {
		font-family: "Tahoma";
	}

	.round {
		border-radius: 8px;
		outline: none;
	}
	</style>
	
  </head>
  <html>
  <body style="background-color: white">
      <div align="center">
        <h1>Use this page to adjust the configuration of the login demonstration app</h1>

        <form method="post" name="domainselector"
              onload='document.forms["domainselector"].elements["domainselection"].value="<%=DomainName.getDomainName()%>";'
              onsubmit='document.forms["domainselector"].elements["submitButton"].classList.add("disabled")'>
            <input type="hidden" name="whichform" value="domain"/>
            <table>
                <tr>
                    <th colspan="2">Select / change currently active domain name</th>
                </tr>
                <tr>
                    <th align="right">Domain name:</th>
                    <td>
                        <input type="text" class="round textstyle pad" name="domain" value="<%=DomainName.getDomainName()%>" size="20"
                               oninput='enableDisableForms()'
                               />
                        <input type="submit" class="button disabled" name="submitButton" value="Save"/>
                </tr>
                
                <%
                    if ( 0 != CredentialsList.getCredentials().size() ) {
                        %>
                <tr>
                    <td colspan="2">
                        or choose an existing: 
                        <%
                            Map<String, Credentials> allcreds = CredentialsList.getCredentials();
                            for ( String str : allcreds.keySet() ) {
                                %>
                                <input type='button' class="button" value='<%=str%>' onclick='document.forms["domainselector"].elements["domain"].value="<%=str%>";enableDisableForms();document.forms["domainselector"].submit();'/>
                                <%
                            }
                        %>                        
                    </td>
                </tr>
                <%
                    }
                %>                    
                
            </table>
        </form>

        <hr/>
        <form method="post" name="config">
            <input type="hidden" name="domain" value="<%=DomainName.getDomainName()%>"/>
            <input type="hidden" name="whichform" value="credentials"/>
            <table border="0">

                <%
                    String url       = "";
                    String id        = "";
                    String key       = "";
                    String appId     = "";
                    String appSecret = "";

                    oracle.custom.ui.oauth.vo.Credentials creds = CredentialsList.getCredentials().get( DomainName.getDomainName() );
                    if ( null != creds ) {
                        url       = creds.getIdcsUrl();
                        id        = creds.getId();
                        key       = creds.getKey();
                        appId     = creds.getAppId();
                        appSecret = creds.getAppSecret();
                    }                    

                %>

                <tr>
                    <th align="right">Domain:</th>
                    <td colspan="2"><%=DomainName.getDomainName()%></td>
                </tr>

                <tr>
                    <th align="right">Oracle Identity Cloud Service URL Url : </th>
                    <td colspan="2"><input type="text" class="round textstyle pad" name="idcsUrl" value="<%=url%>" size="100"/></td>
                    <td><input type="button" class="button" value="check" name="checkUrlButton" onclick="checkUrl();"/></td>
                </tr>
                
                <tr><td colspan="4"><hr/></td></tr>

                <tr>
                    <th align="left" rowspan="2">OpenID Connect app<BR/>(i.e "Authorization Code" app)</th>

                    <th align="right">Client ID : </th>
                    <td><input type="text"  class="round textstyle pad" name="clientId" value="<%=id%>" size="50"/></td>
                    <td rowspan="2"><input type="button" class="button" value="check" name="checkApp" onclick="checkOpenIDClientSettings();"/></td>
                </tr>
                <tr>
                    <th align="right">Client Secret: </th>
                    <td><input type="text"  class="round textstyle pad"  name="clientSecret" value="<%=key%>" size="50"/></td>
                </tr>

                <tr><td colspan="4"><hr/></td></tr>
                
                <tr>
                    <th align="left" rowspan="2">Credential submission app<BR/>(i.e "Client Credentials" app)</th>

                    <th align="right">App ID:</th>
                    <td><input type="text"  class="round textstyle pad" name="appId" value="<%=appId%>" size="50"/></td>
                    <td rowspan="2"><input type="button" class="button" value="check" name="checkApp" onclick="checkAppSettings();"/></td>
                </tr>
                <tr>
                    <th align="right">App Secret:</th>
                    <td><input type="text"  class="round textstyle pad"  name="appSecret" value="<%=appSecret%>" size="50" oninput='removeSpaces(this);'/></td>
                </tr>

                <tr><td colspan="4"><hr/></td></tr>
                
                <tr>
                    <td colspan="3" style="text-align: center">
                        <input type="submit" class="button" name="submitCreds" value="Save"/>
                        <input type="reset" class="button" value="Reset"/>
                </tr>
            </table>
        </form>
                
        <hr/>

        <a href=".">Return home</a>
    </div>
</body>
</html>

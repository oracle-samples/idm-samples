<%--This file is subject to the terms and conditions defined in
file 'LICENSE.MD' which is part of this source code package.--%>
<%@ page language="java" contentType="text/html; charset=ISO-8859-1"
    pageEncoding="ISO-8859-1" 
    import="com.example.utils.ClientConfig, com.example.beans.UserBean, org.codehaus.jettison.json.JSONObject"%>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Example | Customer Quotes</title>
  <meta name="description" content="A sample code">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script src="js/jquery.min.js"></script>
  <script src="js/scripts.js"></script>
  <link rel="stylesheet" href="css/style.css">
  <link rel="stylesheet" href="css/font-awesome.min.css">
</head>

<script>
  $(document).ready(function() {
    $('#myConsole').click(function(){
      var url = '<%= ClientConfig.MYCONSOLE_UI_URL %>';
      window.open(url);
    });
    $('#adminConsole').click(function(){
      var url = '<%=ClientConfig.ADMIN_UI_URL%>';
      window.open(url);
    });
    $("#loginButton").click(function() {
      window.location.href='getResource?resource=openid';
    });
    $('#logoutlink').click(function(){
      var url = '<%=ClientConfig.LOGOUT_SERVICE_URL%>?post_logout_redirect_uri=<%=ClientConfig.APP_POST_LOGOUT_REDIRECT_URI+"&id_token_hint="+session.getAttribute("idToken")%>';
      window.location.href = url;
    });
  });
</script>

<body>

<% 
UserBean userInfo = (UserBean)session.getAttribute("userInfo");
%>
<!-- LOGIN SNIPPET: BEGIN -->
<div class="header-area">
  <ul class="topnav" id="myTopnav">
    <li><a class="active" href="#"><i class="fa fa-line-chart" aria-hidden="true"></i> Customer Quotes</a></li>
    <!-- MENU SNIPPET: BEGIN -->
    <% if (userInfo != null) { %>
      <li><a href="#" id="myConsole"><i class="fa fa-user" aria-hidden="true"></i> <%=userInfo.getUsername()%> (My Profile)</a></li>
      <li><a href="#" id="adminConsole"><i class="fa fa-lock" aria-hidden="true"></i> Manage Identities</a></li>
      <li><a href="#" id="logoutlink"><i class="fa fa-sign-out" aria-hidden="true"></i> Logout</a></li>
      <li class="icon">
        <a href="javascript:void(0);" style="font-size:15px;" onclick="topMenu()"><i class="fa fa-bars" aria-hidden="true"></i></a>
      </li>
    <% } %>
    <!-- MENU SNIPPET: END -->
  </ul>
</div>
<div class="main-area">
  <div class="center wrap cls">
    <article>
    <hr>
    <!-- CONTENT: BEGIN -->
    <% if (userInfo != null) { %><!-- CONTENT: LOGGED USER -->
      <header>
        <h1>Hello, <u><%=userInfo.getDisplayName()%></u>!</h1>
        <p>Welcome to <strong>Customer Quotes</strong>, a sample application.</p>
        <% if(ClientConfig.IS_RESOURCE_SERVER_ACTIVE) { %>
          <p>Few API Calls:</p>
          <a class="bt bt-red" href="#" onclick="window.top.location.href='/cquotes/getResource?resource=<%=ClientConfig.SCOPE_AUD+ClientConfig.SCOPE_QUOTE%>';return false;"><i class="fa fa-exclamation-triangle" aria-hidden="true"></i> Urgent Quotes</a>
          <a class="bt bt-green" href="#" onclick="window.top.location.href='/cquotes/getResource?resource=<%=ClientConfig.SCOPE_AUD+ClientConfig.SCOPE_INSIGHT%>';return false;"><i class="fa fa-line-chart" aria-hidden="true"></i> Sales Insights</a>
          <a class="bt bt-navy" href="#" onclick="window.top.location.href='/cquotes/getResource?resource=<%=ClientConfig.SCOPE_AUD+ClientConfig.SCOPE_REPORT%>';return false;"><i class="fa fa-file-text" aria-hidden="true"></i> Sales Report</a>
          <a class="bt bt-orange" href="#" onclick="window.top.location.href='/cquotes/getResource?resource=<%=ClientConfig.SCOPE_AUD+ClientConfig.SCOPE_PIPELINE%>';return false;"><i class="fa fa-calendar" aria-hidden="true"></i> Sales Pipeline</a>
          <a class="bt bt-blue" href="#" onclick="window.top.location.href='/cquotes/getResource?resource=<%=ClientConfig.SCOPE_ALL%>';return false;"><i class="fa fa-pie-chart" aria-hidden="true"></i> Complete Report</a>
        <% } %>
      </header>
      <section>
        <% String quote  = (String)request.getAttribute(ClientConfig.SCOPE_QUOTE);
          if (quote != null) { %>
          <hr><h2><i class="fa fa-exclamation-triangle" aria-hidden="true"></i> Quote Alert!</h2><%=quote%>
        <% } %>
        <% String insight  = (String)request.getAttribute(ClientConfig.SCOPE_INSIGHT);
          if (insight != null) { %>
          <hr><h2><i class="fa fa-line-chart" aria-hidden="true"></i> New insights to raise your sales</h2><%=insight%>
        <% } %>
        <% String report  = (String)request.getAttribute(ClientConfig.SCOPE_REPORT);
          if (report != null) { %>
          <hr><h2><i class="fa fa-file-text" aria-hidden="true"></i> Sales report</h2><%=report%>
        <% } %>
        <% String pipeline  = (String)request.getAttribute(ClientConfig.SCOPE_PIPELINE);
          if (pipeline != null) { %>
          <hr><h2><i class="fa fa-calendar" aria-hidden="true"></i> Pipeline prediction</h2><%=pipeline%>
        <% } %>
        <hr>
        <h4 class="box" id="b1"><span class="white">?</span> What happened? (click here to know more)</h4>
        <div id="box1" hidden="true">
          <p>The customer quotes application executed the following process:</p>
          <img src="img/OAuthLogin.jpg" alt="Image">
          <h4 class="box" id="b2"><span class="white">1</span> Authorization Code Request (Click to expand)</h4>
          <div id="box2" hidden="true">
            <p>Authorization Code Request - GET: As part of this request flow, user login and consent gets done, if not already given consent.</p>
            <pre><%=session.getAttribute("authzRequestURL")%></pre>
            <p>Authorization Code Response:</p>
            <pre><%=session.getAttribute("authzResponse")%></pre>
          </div>
          <h4 class="box" id="b3"><span class="white">2</span> Access Token Request (Click to expand)</h4>
          <div id="box3" hidden="true">
            <p>Access Token Request - POST: Sends authorization code along with client details to get access token.</p>
            <p>URL:</p>
            <pre><%=session.getAttribute("tokenRequestURL")%></pre>
            <p>Headers:</p>
            <pre><%=session.getAttribute("tokenRequestParams")%></pre>
            <p>Body:</p>
            <pre><%=session.getAttribute("tokenRequestBody")%></pre>
            <p>Access Token Response:</p>
            <pre><%=session.getAttribute("tokenResponse")%></pre>
          </div>
        </div>
      </section>
    <% }else{ %><!-- CONTENT: BEFORE LOGIN -->
      <header>
        <h1>Customer Quotes</h1>
        <p>Welcome to <strong>Customer Quotes</strong>, a sample application.</p>
        <p>To access a quote: <a class="bt bt-red" id="loginButton"><img src="img/IdentityMgmt_w_32.png" aria-hidden="true"/> Login with Identity Cloud Service</a></p>
      </header>
      <hr>
      <section>
        <h2>What happens when I click Login with Identity Cloud Service?</h2>
        <h4 class="box" id="b1"><span class="white">?</span> What happens when I click login? (click here to know more)</h4>
        <div id="box1" hidden="true">
          <p>The customer quotes application will launch the following process:</p>
          <img src="img/OAuthLogin.jpg" alt="Image">
        </div>
      </section>
    <% } %>
    </article>
  </div> <!-- #main -->
</div> <!-- #main-area -->

</body>
</html>

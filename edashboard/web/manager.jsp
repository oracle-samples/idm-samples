<%--This file is subject to the terms and conditions defined in
file 'LICENSE.MD' which is part of this source code package.--%>
<%@page contentType="text/html" pageEncoding="UTF-8"%>
<!DOCTYPE html>
<%@ page import="com.example.util.UserBean"%>
<%UserBean user = new UserBean(request);%>
<html>
    <head>
        <meta charset="utf-8">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <meta http-equiv="X-Frame-Options" content="deny">
        <title>Example - Welcome <%=user.getFullName()%></title>
        <meta name="description" content="A sample code">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <script src="js/jquery.min.js"></script>
        <script src="js/scripts.js"></script>
        <link rel="stylesheet" href="css/style.css">
        <link rel="stylesheet" href="css/font-awesome.min.css">
    </head>
    <body>
<div class="header-area">
  <ul class="topnav" id="myTopnav">
    <li><a class="active" href="#"><i class="fa fa-line-chart" aria-hidden="true"></i> Employee Dashboard</a></li>
    <!-- MENU SNIPPET: BEGIN -->
    <li><a href="#"><i class="fa fa-user" aria-hidden="true"></i> Logged as: <%=user.getUserId()%></a></li>
    <li class="icon">
      <a href="javascript:void(0);" style="font-size:15px;" onclick="topMenu()"><i class="fa fa-bars" aria-hidden="true"></i></a>
    </li>
    <!-- MENU SNIPPET: END -->
  </ul>
</div>
<div class="main-area">
  <div class="center wrap cls">
    <article>
    <hr>
    <!-- CONTENT: BEGIN -->
      <header>
        <p>Options:</p>
        <a class="bt bt-blue" href="#" onclick="window.top.location.href='index.jsp';return false;"><i class="fa fa-home" aria-hidden="true"></i> Index</a>
        <a class="bt bt-green" href="#" onclick="window.top.location.href='myprofile.jsp';return false;"><i class="fa fa-user" aria-hidden="true"></i> My Profile</a>
        <a class="bt bt-navy" href="#" onclick="window.top.location.href='employee.jsp';return false;"><i class="fa fa-thumbs-up" aria-hidden="true"></i> Employee perks</a>
        <a class="bt bt-orange" href="#" onclick="window.top.location.href='manager.jsp';return false;"><i class="fa fa-sitemap" aria-hidden="true"></i> Management watch</a>
        <a class="bt bt-red" href="#" onclick="window.top.location.href='securityReport.jsp';return false;"><i class="fa fa-lock" aria-hidden="true"></i> Security Report</a>
      </header>
      <section>
        <hr>
        <h2><i class="fa fa-sitemap" aria-hidden="true"></i> Management Watch</h2>
        <p>This page proves you have manager clearance :D</p>
        <hr>
        <h4 class="box" id="b1"><span class="white">?</span> Technical information? (click here)</h4>
        <p>
            <b>userid:</b> <%=user.getUserId()%><br />
            <b>full name:</b> <%=user.getFullName()%><br />
            <b>Principal:</b> <%=user.isPrincipalSet()%>
        </p>
        <div id="box1" hidden="true">
          <h4 class="box" id="b2"><span class="white">1</span> Server information</h4>
          <div id="box2" hidden="true">
            <b>Servlet Engine:</b> <%= session.getServletContext().getMajorVersion() %>.<%= session.getServletContext().getMinorVersion() %><br />
            <b>JSP Engine:</b> <%= JspFactory.getDefaultFactory().getEngineInfo().getSpecificationVersion()%><br />
            <b>Application Server:</b> <%= application.getServerInfo()%><br />
          </div>
        </div>
      </section>
    </article>
  </div> <!-- #main -->
</div> <!-- #main-area -->
</body>
</html>

<%--This file is subject to the terms and conditions defined in
file 'LICENSE.MD' which is part of this source code package.--%>
<%@page contentType="text/html" pageEncoding="UTF-8"%>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta http-equiv="X-Frame-Options" content="deny">
  <title>Example</title>
  <meta name="description" content="A sample code - Error page">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script src="js/jquery.min.js"></script>
  <script src="js/scripts.js"></script>
  <link rel="stylesheet" href="css/style.css">
  <link rel="stylesheet" href="css/font-awesome.min.css">
</head>

<body>

<!-- LOGIN SNIPPET: BEGIN -->
<div class="header-area">
  <ul class="topnav" id="myTopnav">
    <li><a class="active" href="#"><i class="fa fa-line-chart" aria-hidden="true"></i> Employee Dashboard</a></li>
  </ul>
</div>
<div class="main-area">
  <div class="center wrap cls">
    <article>
    <hr>
    <!-- CONTENT: BEGIN -->
      <header>
        <h1>Ops!</h1>
        <p>It seems like something went wrong.</p>
        <p><strong>Authorization Error!</strong> <a href="index.jsp" class="alert-link">return to home.</a></p>
        <p><a class="bt bt-navy" href="index.jsp"><i class="fa fa-undo" aria-hidden="true"></i> | Go back Home</a></p>
      </header>
      <hr>
    </article>
  </div> <!-- #main -->
</div> <!-- #main-area -->

</body>
</html>
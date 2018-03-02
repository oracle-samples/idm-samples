<%
    boolean loggedIn = request.getSession().getAttribute("AUTHENTICATED") != null;
    //request.getSession().getAttribute("UserName")
%>
<!DOCTYPE html>
<html lang="en">
<head>

    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="">
    <meta name="author" content="">

    <title>Landing Page - Start Bootstrap Theme</title>

    <!-- Bootstrap Core CSS -->
    <link href="css/bootstrap.min.css" rel="stylesheet">

    <!-- Custom CSS -->
    <link href="css/landing-page.css" rel="stylesheet">

    <!-- Custom Fonts -->
    <link href="https://fonts.googleapis.com/css?family=Lato:300,400,700,300italic,400italic,700italic" rel="stylesheet" type="text/css">

    <!-- HTML5 Shim and Respond.js IE8 support of HTML5 elements and media queries -->
    <!-- WARNING: Respond.js doesn't work if you view the page via file:// -->
    <!--[if lt IE 9]>
        <script src="https://oss.maxcdn.com/libs/html5shiv/3.7.0/html5shiv.js"></script>
        <script src="https://oss.maxcdn.com/libs/respond.js/1.4.2/respond.min.js"></script>
    <![endif]-->

</head>

<body>

    <!-- Navigation -->
    <nav class="navbar navbar-default navbar-fixed-top topnav" role="navigation">
        <div class="container topnav">
            <!-- Brand and toggle get grouped for better mobile display -->
            <div class="navbar-header">
                <button type="button" class="navbar-toggle" data-toggle="collapse" data-target="#bs-example-navbar-collapse-1">
                    <span class="sr-only">Toggle navigation</span>
                    <span class="icon-bar"></span>
                    <span class="icon-bar"></span>
                    <span class="icon-bar"></span>
                </button>
                <!--a class="navbar-brand topnav" href="#">Start Bootstrap</a-->
            </div>
            <!-- Collect the nav links, forms, and other content for toggling -->
            <div class="collapse navbar-collapse" id="bs-example-navbar-collapse-1">
                <ul class="nav navbar-nav navbar-right">
                    <li>
                        <%
                        if ( !loggedIn ) {
                        %>
                        <a href="login">Login</a>
                        <%
                        }
                        else {
                        %>
                        <a href="logout">Logout</a>
                        <%
                        }
                        %>
                    </li>

                    <li>
                        <a href="config.jsp">Configuration</a>
                    </li>
                </ul>
            </div>
            <!-- /.navbar-collapse -->
        </div>
        <!-- /.container -->
    </nav>


    <!-- Header -->
    <a name="about"></a>
    <div class="intro-header">
        <div class="container">

            <div class="row">
                <div class="col-lg-12">
                    <div class="intro-message">
                        <h1>Welcome</h1>
                        <hr class="intro-divider"/>
                        <% 
                            if ( !loggedIn )
                                out.print( "You are NOT logged in." );
                            else
                                out.print( "You are logged in as " + request.getSession().getAttribute("UserName") );
                        %>
                        
                        <hr class="intro-divider"/>

                        <%
                        if ( !loggedIn ) {
                        %>
                            <a href="login" class="btn btn-default btn-lg">Login</a>
                        <%
                        }
                        else {
                        %>
                            <a href="logout" class="btn btn-default btn-lg">Logout</a>
                        <%
                        }
                        %>
                        &nbsp;&nbsp;&nbsp; 
                        <a href="term.jsp" class="btn btn-default btn-lg">Terminate J2EE Session</a>
                        &nbsp;&nbsp;&nbsp;
                        <a href="config.jsp" class="btn btn-default btn-lg">Configuration</a>
                        
                        <P/>
                        &nbsp;
                        <P/>

                        <%
                        if ( loggedIn ) {
                        %>
                        <a href="#atoken" class="btn btn-default btn-lg">Access Token content</a>
                        <a href="#idtoken" class="btn btn-default btn-lg">Identity Token content</a>
                        <%
                        }
                        %>


                    </div>
                </div>
            </div>

        </div>
        <!-- /.container -->

    </div>
    <!-- /.intro-header -->

    <!-- Page Content -->

<%
    if ( loggedIn ) {
%>
    <a  name="atoken"></a>
    
    <div class="content-section-a">

        <div class="container">
            <h2>Access Token:</h2>
            <div class="row">
                Raw:<BR/>
                <%=request.getSession().getAttribute("ATTOKEN")%>
                <P/>
                <HR/>
                Claims:
                <div id="ATCLAIMS"></div>
            </div>
        </div>

        <!-- /.container -->

    </div>
    <!-- /.content-section-a -->

    <a  name="idtoken"></a>

    <div class="content-section-b">
        <div class="container">

            <h2>ID Token:</h2>
            ID&nbsp;Token:
            Raw:<BR/>
            <%=request.getSession().getAttribute("IDTOKEN")%>
            <P/>
            <HR/>
            Claims:
            <div id="IDCLAIMS"></div>

        </div>
    </div>

    <script src="js/prettyprint.js"></script>
    <script>
        document.getElementById('ATCLAIMS').appendChild( prettyPrint(JSON.parse('<%=request.getSession().getAttribute("ATTOKEN_CLAIMS")%>') ) );
        document.getElementById('IDCLAIMS').appendChild( prettyPrint(JSON.parse('<%=request.getSession().getAttribute("IDTOKEN_CLAIMS")%>') ) );
    </script>

<%
    } //if ( loggedIn )
    else {
%>
    <a  name="login"></a>
    
    <div class="content-section-a">

        <div class="container">
            <iframe width="500" height="400" id="loginframe"></iframe>
        </div>
        <form name="urlinput">
            <input type="text" name="url" value="" onload='document.forms["urlinput"].elements["url"].value = document.getElementById("loginframe").src;' size='100'><BR>
            <input type="button" value="Go" onclick="">
        </form>
    </div>
<%
    } // else ( around if logged in
%>
    
    <!-- jQuery -->
    <script src="scripts/jquery.min.js"></script>

    <!-- Bootstrap Core JavaScript -->
    <script src="js/bootstrap.min.js"></script>

</body>

</html>

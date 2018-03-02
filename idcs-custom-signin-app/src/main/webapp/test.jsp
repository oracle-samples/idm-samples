<!doctype html>
<html>
  <head>
    <script src="<%=request.getContextPath()%>/scripts/jquery.min.js"></script>
    <script type="text/javascript">
      $(document).ready(function() { 
        var socialLoginResult = '<%= request.getParameter("OCIS_REQ_SOCIAL") %>';
        var socialLoginError;
        if(!socialLoginResult){
          socialLoginError = 'error';
        }
        var dataToSend = {
          queryStr: socialLoginResult,
          error: socialLoginError
        };
        localStorage.setItem('storage', JSON.stringify(dataToSend));
        // for IE window.close() always ask user consent before closing the window
        // which is not a good UX. Below line will close the window without consent
        open(location, '_self').close(); 
      });
    </script>
  </head>
<body>
<h1>this is test <%= request.getParameter("OCIS_REQ_SOCIAL") %></h1>
</body>
</html>

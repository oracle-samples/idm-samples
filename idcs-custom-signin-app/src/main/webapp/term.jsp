<%
    request.getSession().invalidate();
    response.sendRedirect( request.getContextPath() );
%>
<%@page import="oracle.custom.ui.common.DomainName"%>
<%@page import="oracle.custom.ui.utils.ServerUtils"%>
<%@page import="oracle.custom.ui.oauth.utils.AccessTokenUtils"%>
<%@ page import="java.util.*" %>
<html>
<head>
  <link href="<%=request.getContextPath()%>/custom.css" rel="stylesheet" type="text/css">
  	<script src="<%=request.getContextPath()%>/scripts/jquery.min.js"></script>
    <%
            String attr = DomainName.getDomainName();
    %>
    
  <script>
      
        var GlobalConfig = {
          accessToken: '<%=AccessTokenUtils.getAccessToken(attr)%>',
          idcsURL: '<%=ServerUtils.getIDCSServerURL(attr)%>',
          idcsBaseURL: '<%=ServerUtils.getIDCSBaseURL(attr)%>'        
        };
        
        
        var oncheck = function() {            
            $.ajax({
                    type: "GET",
                    url: GlobalConfig.idcsBaseURL + "/admin/v1/Me",
                    contentType: "application/json",
                    dataType: "json",
                    headers: {
                        'Authorization':'Bearer <%=session.getAttribute("ATTOKEN")%>'
                    }
            }).done(function(msg) {
                alert(msg);
            }).fail(function(qXHR, ex){
                alert(ex);
            });
        };
        </script>
        <script type="text/javascript">
            $(document).ready(function() {	
                $("#test").click(function() {
                    alert("clicked");
                    oncheck();  
                });
            });
        
    </script>
</head>
<body>
<%
                HashMap headerMap = new HashMap();
                Enumeration eNames = request.getHeaderNames();
                while (eNames.hasMoreElements()) {
                String name = (String) eNames.nextElement();
                        String value = normalize(request.getHeader(name));
                        headerMap.put(name, value);
                }
%>
<div class="muck-up">
  <div class="overlay"></div>
  <div class="top">
    <div class="nav">
      <span class="ion-android-menu"></span>
      <input type="button" name="test" value="clickme" id ="test"/>
      <p>Timeline</p>
      &nbsp;&nbsp;&nbsp;<a href="<%=request.getContextPath()%>/logout/">Logout</a>
      &nbsp;&nbsp;&nbsp;<a href="<%=request.getContextPath()%>/logout/?send=true">New Logout</a>
      
      
      <span class="ion-ios-more-outline"></span>
    </div>
    <div class="user-profile">
      <img src="https://raw.githubusercontent.com/arjunamgain/FilterMenu/master/images/profile.jpg">
      <div class="user-details">
          <h4><%= request.getSession().getAttribute("UserName")%></h4>
      </div>
    </div>
  </div>
  <div class="clearfix"></div>
  <div class="filter-btn">
    <a id="one" href="#"><i class="ion-ios-checkmark-outline"></i></a>
    <a id="two" href="#"><i class="ion-ios-alarm-outline"></i></a>
    <a id="three" href="#"><i class="ion-ios-heart-outline"></i></a>
    <a id="all" href="#"><i class="ion-ios-star-outline"></i></a>
    <span class="toggle-btn ion-android-funnel"></span>
  </div>
  <div class="clearfix"></div>
  <div class="bottom">
    <div class="title">
      <h3>My Tasks</h3>
      <small>February 8,2015</small>
    </div>
    <ul class="tasks">
      <li class="one red">
        <span class="task-title">Make New Icon</span>
        <span class="task-time">5pm</span>
        <span class="task-cat">Web App</span>

      </li>
      <li class="one red">
        <span class="task-title">Catch up with Brian</span>
        <span class="task-time">3pm</span>
        <span class="task-cat">Mobile Project</span>

      </li>
      <li class="two green">
        <span class="task-title">Design Explorations</span>
        <span class="task-time">2pm</span>
        <span class="task-cat">Company Web site</span>

      </li>
      </li>
      <li class="tow green hang">
        <span class="task-title">Team Meeting</span>
        <span class="task-time">2pm</span>
        <span class="task-cat">Hangouts</span>
        <img src="https://raw.githubusercontent.com/arjunamgain/FilterMenu/master/images/2.jpg">
        <img src="https://raw.githubusercontent.com/arjunamgain/FilterMenu/master/images/3.jpg">
        <img src="https://raw.githubusercontent.com/arjunamgain/FilterMenu/master/images/profile.jpg">
      </li>
      <li class="three yellow">
        <span class="task-title">New Projects</span>
        <span class="task-time">2pm</span>
        <span class="task-cat">Starting</span>


      </li>

      <li class="three yellow">
        <span class="task-title">Lunch with Mary</span>
        <span class="task-time">2pm</span>
        <span class="task-cat">Grill House</span>
      </li>
      <li class="three yellow">
        <span class="task-title">Team Meeting</span>
        <span class="task-time">2pm</span>
        <span class="task-cat">Hangouts</span>
      </li>
      
    </ul>
  </div>
</div>
</body>
</html>

<%!
   private String normalize(String value)
   {
      StringBuffer sb = new StringBuffer();
      for (int i = 0; i < value.length(); i++) {
         char c = value.charAt(i);
         sb.append(c);
         if (c == ';')
            sb.append("<br>");
      }
      return sb.toString();
   }
%>

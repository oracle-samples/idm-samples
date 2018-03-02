<%
//    response.setHeader("X-Frame-Options", "SAMEORIGIN");
%>
<%@page import="oracle.custom.ui.common.DomainName"%>
<%@page import="oracle.custom.ui.utils.EncryptionUtils"%>
<%@page import="org.codehaus.jettison.json.JSONArray"%>
<%@page import="org.codehaus.jettison.json.JSONObject"%>
<%@page import="java.util.Base64"%>
<%@page import="javax.crypto.spec.IvParameterSpec"%>
<%@page import="java.security.MessageDigest"%>
<%@page import="javax.crypto.spec.SecretKeySpec"%>
<%@page import="javax.crypto.Cipher"%>
<%@page import="javax.crypto.SecretKey"%>
<%@page import="java.security.PublicKey"%>
<%@page import="java.util.Iterator"%>
<%@page import="java.util.Comparator"%>
<%@page import="java.util.ArrayList"%>
<%@page import="java.util.Collections"%>
<%@page import="java.util.List"%>
<%@page import="oracle.custom.ui.utils.JCECryptoCache"%>
<%@page import="java.security.Signature"%>
<%@page import="java.net.URLDecoder"%>
<%@page import="oracle.custom.ui.utils.ServerUtils"%>
<%@page import="oracle.custom.ui.oauth.utils.AccessTokenUtils"%>
<!doctype html>
<html>
  <head>
        <script src="<%=request.getContextPath()%>/scripts/tabcontent.js" type="text/javascript"></script>
        <link href="<%=request.getContextPath()%>/templates/template1/tabcontent.css" rel="stylesheet" type="text/css" />
  	<meta http-equiv="X-UA-Compatible" content="IE=Edge">
	<meta name="viewport" content="width=device-width">
	<link rel="icon" type="image/x-icon" href="favicon.ico">
	<link rel="stylesheet" type="text/css" href="<%=request.getContextPath()%>/css/bootstrap.min.css">
	<link rel="stylesheet" type="text/css" href="<%=request.getContextPath()%>/css/login.css">
  	<script src="<%=request.getContextPath()%>/scripts/jquery.min.js"></script>
    <%
            String attr = DomainName.getDomainName();
            String accessToken = AccessTokenUtils.getAccessToken(attr);
            if ( null == accessToken ) {
                %>
                <script>
                    alert( "Unable to acquire access token. Please check your configuration.");
                    window.location = "<%=request.getContextPath()%>/config.jsp";
                </script>
                <%
            }

    %>
    <script>
      var GlobalConfig = {
        accessToken: '<%=accessToken%>',
        idcsURL: '<%=ServerUtils.getIDCSServerURL(attr)%>',
        idcsBaseURL: '<%=ServerUtils.getIDCSBaseURL(attr)%>'        
      };
      
      function activateIdp(name, idpId) {
        var details = {};
        details.op = "choose_idp";
        details.rememberAuthnChoice = false;
        details.idpName = name;
        details.idpName = name;
        details.idpId = idpId;
        
        var dataDet = JSON.stringify(details);              
        $.ajax({
                type: "POST",
                url: GlobalConfig.idcsURL,
                data: dataDet,
                contentType: "application/json",
                dataType: "json",
                xhrFields: {
                    withCredentials: true
                },
                crossDomain: true,
                headers: {
                    'Authorization':'Bearer ' + GlobalConfig.accessToken
                }
        }).done(function(msg) {
            if (msg.success) {
                window.location = msg.redirectUrl;
            }
        }).fail(function(qXHR, ex){
                alert(ex);
        });
      };
      
      function activateSocialIdp(name, idpId) {
        var consentWindow = window.open('', name, 'location=no, resizable=yes, scrollbars=yes, status=yes');
        $(consentWindow.document).ready(function() {
          
          var details = {};
          details.op = "choose_socialidp";
          details.rememberAuthnChoice = false;
          details.idpName = name;
          details.idpName = name;
          details.idpId = idpId;
          //details.redirectUrl = '<%=request.getContextPath()%>/test.jsp';
          details.redirectUrl = '/sso/v1/user/login';
          var dataDet = JSON.stringify(details);
          $.ajax({
            type: "POST",
            url: GlobalConfig.idcsURL,
            data: dataDet,
            contentType: "application/json",
            dataType: "json",
            xhrFields: {
              withCredentials: true
            },
            crossDomain: true,
            headers: {
              'Authorization':'Bearer ' + GlobalConfig.accessToken
            }
          }).done(function(msg) {
            if (msg.success) {
             consentWindow.location = msg.redirectUrl;
             //var timer = setInterval(checkChild, 500);
            }
          }).fail(function(qXHR, ex){
            alert(ex);
          });
        });   
      };
      
      <% 
        String sResponseData = EncryptionUtils.decryptData(attr,
                "loginCtx", request);
        String data = null;
        boolean remoteIdps = false;
        boolean mfaData = false;
        if (sResponseData != null) {
            JSONObject obj = new JSONObject(sResponseData);
            if (obj.has("isMfaResponse") && 
                    Boolean.valueOf(obj.getString("isMfaResponse"))) {
                data = sResponseData;
                mfaData = true;
            } else {
                remoteIdps = true;
            }
        }
      %>
      var sResponse = {          
          mfaResp: <%=data%>
      };
      
    </script>	
	<style type="text/css">
            .squaredFour {
  width: 20px;
  position: relative;
  margin: 20px auto;
  label {
    width: 20px;
    height: 20px;
    cursor: pointer;
    position: absolute;
    top: 0;
    left: 0;
    background: #fcfff4;
    background: linear-gradient(top, #fcfff4 0%, #dfe5d7 40%, #b3bead 100%);
    border-radius: 4px;
    box-shadow: inset 0px 1px 1px white, 0px 1px 3px rgba(0,0,0,0.5);
    &:after {
      content: '';
      width: 9px;
      height: 5px;
      position: absolute;
      top: 4px;
      left: 4px;
      border: 3px solid #333;
      border-top: none;
      border-right: none;
      background: transparent;
      opacity: 0;
      transform: rotate(-45deg);
    }
    &:hover::after {
      opacity: 0.5;
    }
  }
  input[type=checkbox] {
    visibility: hidden;
    &:checked + label:after {
      opacity: 1;
    }
  }    
}
		.wrapper {
			margin-right: 100px;
			height: 200px;
		}
		.content {
			float: left;
			margin-left: 450px;
		}
		.sidebar {
			float: left;
			margin-left: 100px;
		}
		.cleared {
			clear: both;
		}
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
			background-color: gray; /* Green */
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

		.textstyle {
			font-family: "Tahoma";
		}

		.round {
			border-radius: 8px;
			outline: none;
		}
	</style>
	
	<script type="text/javascript">
            $(document).ready(function() {	
                function onStorageEvent(storageEvent) {
                  if (storageEvent.key === 'storage' && storageEvent.newValue !== null) {
                    var data = JSON.parse(storageEvent.newValue);
                    if (data.queryStr) {
                      var val = encodeURIComponent(data.queryStr);
                      var queryStr = 'OCIS_REQ_SOCIAL=' + val;
                      window.location = '<%=ServerUtils.getIDCSBaseURL(attr)%>/sso/v1/user/login?' + queryStr;             
                    } else if (data.userProfile) {
                      alert('user not registered');
                    } else if (data.error) {
                      alert(data.error);
                    }            
                    localStorage.removeItem('storage');
                  }
                };
                window.addEventListener('storage', onStorageEvent, false);                  

                var atToken = null;
                if (sResponse.mfaResp) {
                  atToken = sResponse.mfaResp.authenticationToken;   
                }
                var isTrustedChecked = false;
                var preQuestions = [];
                preQuestions["CarModel"] = "What is the model of your first car?";
                preQuestions["GraduationYear"] = "Which year your graduation completed?";
                preQuestions["FirstSchool"] = "What is the name of first school?";
                preQuestions["FirstMobile"] = "What is the model of your first mobile?";
                preQuestions["MaidenName"] = "What is your mother maiden name?";
                preQuestions["FirstCompany"] = "What is your first company?";
                preQuestions["BestFriend"] = "What is the name of your best friend?";

                var enrollAnotherFactor = false;
                var timer;
                var maxQuestions = 3;
                var maxAnswers = 3;
                var settingsURL = GlobalConfig.idcsBaseURL +
                        '<%=ServerUtils.getIDCSBaseURL(attr)%>/admin/v1/SecurityQuestionSettings/SecurityQuestionSettings';

                $("#enrollAdditionalFactor").click(function(){
                    $("#additionalFactor").hide();
                    displayEnrollmnetOptions(addFactorEnrollmentResponse);
                    enrollAnotherFactor = true;
                });

                $.ajax({
                    type:"GET",
                    url: settingsURL,
                    dataType: "json",
                    contentType: "application/json",
                    headers: {
                             'Authorization':'Bearer ' + GlobalConfig.accessToken
                    }
                }).done(function(msg){	
                    maxQuestions = msg.numQuestionsToSetup;
                    maxAnswers = msg.numQuestionsToAns;
                });
                $("#loginUserNameAuth").click(function(){
                    var credentials = {};
                    credentials.username = $("#username").val();
                    credentials.password = $("#password").val();
                    credentials.authFactor = "USERNAME_PASSWORD";
                    credentials.credType = "USERNAME_PASSWORD";
                    credentials.scenario = $("#action").val();
                    initiateAuth(credentials);
                });

                var factor = "";			
                $("#security_questionsLoginAuth").click(function(){
                    var credentials = {};
                    var qAns = [];
                    for(var i = 0 ; i < maxAnswers ;  i ++) {
                            if($("#security_questionsQuestion" + (i+1)).val() != null
                            && $("#security_questionsQuestion" + (i+1)).val() != "") {
                                    qAns[i] = {};
                                    qAns[i].id = $("#security_questionsQuestion" + (i+1)).val();
                                    qAns[i].answer = $("#security_questionsAnswer" +(i+1)).val();
                            }	
                    }


                    credentials.authFactor = "SECURITY_QUESTIONS";
                    credentials.scenario = $("#action").val();
                    credentials.resend = "true";
                    credentials.credType = "ANSWERS";
                    credentials.securityQuestions = qAns;
                    initiateAuth2(credentials, defaultFunction);		
                });

                $("#security_questionsEnrollmentAuth").click(function(){
                    var credentials = {};
                    var qAns = [];

                    for(var i = 0 ; i < maxQuestions ;  i ++) {
                            if($("#security_questionsEQuestion" + (i+1)).val() != null
                            && $("#security_questionsEQuestion" + (i+1)).val() != "") {
                                    qAns[i] = {};
                                    qAns[i].id = $("#security_questionsEQuestion" + (i+1)).val();
                                    qAns[i].answer = $("#security_questionsEAnswer" +(i+1)).val();
                                    qAns[i].hintText = $("#security_questionsEHint" + (i+1)).val();
                            }	
                    }

                    credentials.authFactor = "SECURITY_QUESTIONS";
                    credentials.scenario = $("#action").val();
                    credentials.resend = "true";
                    credentials.credType = "ANSWERS";
                    credentials.securityQuestions = qAns;
                    initiateAuth2(credentials, defaultFunction );		
                });

                $("#smsLoginAuth").click(function(){
                    var credentials = {};
                    credentials.deviceId = $("#smsDeviceId").val();
                    credentials.authFactor = "SMS";
                    credentials.requestId = $("#smsRequestId").val();
                    credentials.scenario = $("#action").val();
                    credentials.resend = "true";
                    credentials.credType = "OTP_CODE";
                    credentials.otpCode = $("#smsverificationCode").val();
                    initiateAuth2(credentials, defaultFunction );		
                });

                $("#smsOtpCodeButton").click(function(){
                    var credentials = {};
                    credentials.deviceId = $("#smsDeviceId").val();
                    credentials.authFactor = "SMS";
                    credentials.requestId = $("#smsRequestId").val();
                    credentials.scenario = $("#action").val();
                    credentials.resend = "true";
                    credentials.credType = "OTP_CODE";
                    credentials.otpCode = $("#smsEnrollmentOtpCode").val();
                    initiateAuth2(credentials, defaultFunction );		
                });


                $("#emailLoginAuth").click(function(){
                    var credentials = {};
                    credentials.deviceId = $("#emailDeviceId").val();
                    credentials.authFactor = "EMAIL";
                    credentials.requestId = $("#emailRequestId").val();
                    credentials.scenario = $("#action").val();
                    credentials.resend = "true";
                    credentials.credType = "OTP_CODE";
                    credentials.otpCode = $("#emailverificationCode").val();                   
                    initiateAuth2(credentials, defaultFunction );		
                });
                
                $("#emailELoginAuth").click(function(){
                    var credentials = {};
                    credentials.deviceId = $("#emailEDeviceId").val();
                    credentials.authFactor = "EMAIL";
                    credentials.requestId = $("#emailERequestId").val();
                    credentials.scenario = $("#action").val();
                    credentials.resend = "true";
                    credentials.credType = "OTP_CODE";
                    credentials.otpCode = $("#emailEVerificationCode").val();                   
                    initiateAuth2(credentials, defaultFunction );		
                });
                
                $("#smsEnrollmentAuth").click(function(){
                    var credentials = {};
                    credentials.phoneNo = $("#smsPhoneNumber").val();
                    credentials.requestId = $("#smsERequestId").val();
                    credentials.authFactor = "SMS";
                    credentials.credType = "PHONE_NO";
                    credentials.scenario = $("#action").val();
                    initiateEnrollment2("sms", "SMS", null, credentials);		
                });

                $("#totpLoginAuth").click(function(){
                    var credentials = {};
                    credentials.requestId = $("#totpRequestId").val();
                    credentials.deviceId = $("#totpDeviceId").val();
                    credentials.otpCode = $("#verificationCode").val();
                    credentials.authFactor = "TOTP";
                    credentials.credType = "TOTP_CODE";
                    credentials.scenario = $("#action").val();                
                    initiateAuth(credentials);
                });
                
                $("#backupFactorsLogin").click(function(){
                    var credentials = {};
                    credentials.backupFactors = true;
                    initiateAuth2(credentials, function(msg) {
                    });
                });

                function hideAll() {
                    $("#emailArea").hide();
                    $("#username_passwordArea").hide();
                    $("#totpArea").hide();
                    $("#smsArea").hide();
                    $("#totpEnrollmentArea").hide();
                    $("#smsEnrollmentArea").hide();
                    $("#emailEnrollmentArea").hide();
                    $("#security_questionsArea").hide();
                    $("#pushArea").hide();
                    $("#pushEnrollmentArea").hide();
                    $("#resetPwd").hide();
                    $("#backupAndTrusted").hide();
                    $("#security_questionsEnrollmentArea").hide();
                }


                $("#totpEnrollmentAuth").click(function(){
                    var credentials = {};
                    credentials.deviceId = $("#totpEDeviceId").val();
                    credentials.requestId = $("#totpERequestId").val();
                    credentials.otpCode = $("#totpEverificationCode").val();
                    credentials.authFactor = "TOTP";
                    credentials.credType = "TOTP_CODE";
                    credentials.scenario = $("#action").val();
                    initiateAuth(credentials);
                });
                $("#notConnected").click(function() {
                    var channels = "TOTP";
                    var offline = "false";				
                    if ($(this).is(':checked')) {
                            $("#textboxTotpArea").show();
                            $("#textboxTotpSubmitButtonArea").show();
                            offline = "true";
                    } else {
                            $("#textboxTotpArea").hide();
                            $("#textboxTotpSubmitButtonArea").hide();
                    }
                    factor = "TOTP";
                    initiateEnrollment("totp", offline, channels, $("#action").val(), null);

                });

                $("#trustUA").click(function() {
                        isTrustedChecked = true;
                });
                var loadQuestions = function (questions) {
                    if (questions == null) {
                        var qsURL = '<%=ServerUtils.getIDCSBaseURL(attr)%>/admin/v1/SecurityQuestions?filter=active eq "true"';
                        $.ajax({
                            type:"GET",
                            url: qsURL,
                            dataType: "json",
                            contentType: "application/json",
                            headers: {
                                     'Authorization':'Bearer ' + GlobalConfig.accessToken
                            }
                        }).done(function(msg){						
                            var qsns = msg.Resources;
                            var len = qsns.length;
                            for(var m = 0 ; m < maxQuestions ; m ++ ) {
                                $('#security_questionsEQuestion'+ (m+1)).append(new Option("Select", "Select"));
                                $('#security_questionsEQuestion'+ (m+1)).show();
                                for(j = 0; j < len ; j ++) {
                                    $('#security_questionsEQuestion' + (m+1)).append(new Option(qsns[j].questionText[1].value, qsns[j].id));
                                }
                            }
                        }).fail(function(){
                            var predefQuestions = [
                                {"questionText" : "What is the model of your first car?", "id": "CarModel"},
                                {"questionText" : "Which year your graduation completed?", "id": "GraduationYear"},
                                {"questionText" : "What is the name of first school?", "id": "FirstSchool"},
                                {"questionText" : "What is the model of your first mobile?", "id": "FirstMobile"},
                                {"questionText" : "What is your mother maiden name?", "id": "MaidenName"},
                                {"questionText" : "What is your first company?", "id": "FirstCompany"},
                                {"questionText" : "What is the name of your best friend?", "id": "BestFriend"}
                            ];
                            var len = predefQuestions.length;


                            $('#security_questionsEQuestion1').append(new Option("Select", "Select"));
                            $('#security_questionsEQuestion2').append(new Option("Select", "Select"));
                            $('#security_questionsEQuestion3').append(new Option("Select", "Select"));
                            for(j = 0; j < len ; j ++) {
                                $('#security_questionsEQuestion1').append(new Option(predefQuestions[j].questionText, predefQuestions[j].id));
                                $('#security_questionsEQuestion2').append(new Option(predefQuestions[j].questionText, predefQuestions[j].id));
                                $('#security_questionsEQuestion3').append(new Option(predefQuestions[j].questionText, predefQuestions[j].id));
                            }

                        });
                    } else {
                        $("#security_questionsArea").show();
                        $("#security_questionsEnrollmentArea").hide();
                        var l = questions.length;
                        for(var ij = 0; ij < l ; ij ++) {
                            var text = questions[ij].localizedText;
                            if (text === null) {
                                    text = preQuestions[questions[ij].id];
                            }
                            $("#security_questionsQuestionDiv" + ( ij + 1 )).html("<p>" + text + "</p>");
                            $("#security_questionsQuestion" + ( ij + 1 )).val(questions[ij].id);
                            $("#security_questionsQuestionDiv" + ( ij + 1 )).show();
                            $("#security_questionsAnswer" + ( ij + 1 )).show();
                        }
                }
            };

            $("#skip").click(function(){
                var credentials = {};
                credentials.skipEnrollment = "true";
                skipped = true;
                initiateAuth(credentials);
            });

            var initiateEnrollment = function(key, offline, mfactor, scenario, attributes) {
                var credentials = {};
                credentials.authFactor = mfactor;
                credentials.scenario = scenario;
                credentials.offline = offline;
                initiateEnrollment2(key, mfactor, attributes, credentials)
            };
            
            var initiateEnrollment2 = function(key, mfactor, attributes, credentials) {
                clearTimeout(timer);
                var handleCallback = function(msg){
                    if(mfactor === "SECURITY_QUESTIONS") {
                        loadQuestions(attributes.securityQuestions);
                    } else if(mfactor === 'SMS') {
                        $("#smsPhoneNoSubmitInputArea").hide();
                        $("#smsPhoneNoSubmitButtonArea").hide();
                        $("#smsOtpCodeSubmitButtonArea").show();
                        $("#smsOtpCodeSubmitInputArea").show();
                        $("#smsEnrollmentDisplayText").html("Enter the otp code sent to your number " + msg.displayMessage);
                        $("#" + key + "DeviceId").val(msg.deviceId);
                        $("#" + key + "RequestId").val(msg.requestId);
                        $("#" + key + "EDeviceId").val(msg.deviceId);
                        $("#" + key + "ERequestId").val(msg.requestId);
                    } else if(msg.qrcode.imageData != null) {
                        var img = 'data:image/png;base64,'; 
                        var qrImage = img + msg.qrcode.imageData;
                        if(mfactor === "PUSH") {
                                $("#pushQrCodeDisplay").css("content", 'url(' + qrImage + ')');
                        } else {
                                $("#qrCodeDisplay").css("content", 'url(' + qrImage + ')');
                        }
                        $("#deviceId").val(msg.deviceId);
                        $("#requestId").val(msg.requestId);

                        if(mfactor === "PUSH" || mfactor === "TOTP") {
                                if(msg.requestId != null && offline === "false") {
                                        factor = mfactor;
                                        timer = setInterval(invokeTimeEvent, 5000);
                                }
                        }
                        $("#" + key + "EDeviceId").val(msg.deviceId);
                        $("#" + key + "ERequestId").val(msg.requestId);
                        $("#content").val(msg.qrcode.qrCodeData);
                    }
                };
                initiateAuth2(credentials, handleCallback);
            };

            var addParam = function(myform, msg, paramName) {
                param = document.createElement("input");
                param.value = msg.postParams[paramName];
                param.name = paramName;
                myform.appendChild(param);
            };
            var addFactorEnrollmentResponse = null;
            var originalEnrollmentResponse = null;
            
            var mappingIds = {};

            var counter = 1;
            var prepareList = function(prefix, data, type) {
                if (type === currentFactor) {
                    return;
                }
                if (typeof data !== 'undefined' && data !== null) {
                    if (typeof data.attributes.devices !== 'undefined') {
                        var len = data.attributes.devices.length;
                        for(var m = 0 ; m < len ; m ++ ) {
                            var dev = data.attributes.devices[m];
                            var text = prefix + '&nbsp;<font color="blue"><i><b>' + dev.displayName + '</b></i></font>';
                            var key = "devices" +  counter;
                            mappingIds[key] = {};
                            mappingIds[key].deviceId = dev.deviceId;
                            mappingIds[key].factor = type;
                            if (typeof dev.displayName !== 'undefined') {
                                mappingIds[key].displayName = dev.displayName;
                            }
                            $("#devicesText" + counter).html(text);
                            $("#devices" + counter).show();
                            counter++;
                        }
                    }
                }
            };


            
            
            var showBackupDeviceDetails = function(msg) {
                mappingIds = {};
                counter = 1;
                for(var i = 1; i < 10; i ++) {
                    $("#devices" + i).hide();
                }
                prepareList("Enter OTP Code generated on the OMA App ", msg.requiredCredentials.TOTP, "TOTP");
                prepareList("Send Push Notification to OMA App ", msg.requiredCredentials.PUSH, "PUSH");
                prepareList("Send OTP code to mobile number ", msg.requiredCredentials.SMS, "SMS");
                prepareList("Send OTP code to email id ", msg.requiredCredentials.EMAIL, "EMAIL");                           
                var nextAuths = msg.nextAuthFactors;
                for (var j = 1; j < nextAuths.length; j ++) {
                    if (nextAuths[j] === 'BYPASSCODE') {
                        var text = 'Enter Bypass code';
                        var key = "devices" +  counter;
                        mappingIds[key] = {};
                        mappingIds[key].factor = "BYPASSCODE";
                        $("#devicesText" + counter).html(text);
                        $("#devices" + counter).show();
                        counter++;
                        break;
                    }
                }
                
                if (currentFactor !== 'SECURITY_QUESTIONS') {
                    if (typeof msg.requiredCredentials.SECURITY_QUESTIONS !== 'undefined') {
                        var text = 'Answer Security Questions';
                        var key = "devices" +  counter;
                        mappingIds[key] = {};
                        mappingIds[key].factor = "SECURITY_QUESTIONS";
                        mappingIds[key].questions = msg.requiredCredentials.SECURITY_QUESTIONS.attributes.securityQuestions;
                        $("#devicesText" + counter).html(text);
                        $("#devices" + counter).show();
                        counter++;
                    }
                }

                if (counter > 1) {
                    $("#backupDeviceDetails").show();
                }
            };
            var backupOptionsRetrieved = null;
            var showBackupIfCounterGt1 = false;
            $("#backupFactorsLogin").click(function(){
                clearTimeout(timer);
                var details = {};
                details.backupFactors = true;
                if (backupOptionsRetrieved == null) {
                    initiateAuth3(details, function(msg) {
                        $("#backupAndTrusted").hide();
                        showBackupDeviceDetails(msg);
                    }, function(ex, qXHR){
                       $("#error").show();
                       $("#error").html("<h3>Error occurred: " + qXHR.responseText() + "</h3>");
                    });
                } else if (showBackupIfCounterGt1) {
                    showBackupIfCounterGt1 = true;
                    $("#backupDeviceDetails").show();
                }
            });


            var displayEnrollmnetOptions = function(resp) {
                var msg = null;
                if (originalEnrollmentResponse != null) {
                    msg = originalEnrollmentResponse;
                } else {
                    msg = resp;
                }
                var channels = msg.nextAuthFactors;
                var length = channels.length;
                hideAll();
                $("#skipArea").show();
                $("#enrollmentOptions").show();
                $("#enrollmentHeader").show();
                $("#buttonList").html("");
                for (var i = 0; i < length; i++) {
                    if(channels[i] != null && channels[i] !== 'BYPASSCODE') {								
                        $("#buttonList").html(
                            $("#buttonList").html() +
                            '<li><a id="' + channels[i].toLowerCase() + '" href="#' + 
                            channels[i].toLowerCase() +'EnrollmentArea">' +
                               channels[i] + '</a></li>');
                    }
                }
                $("#email").click(function(){
                    hideAll();
                    var emailAttributes = msg.requiredCredentials.EMAIL;
                    clearTimeout(timer);
                    $("#emailDeviceId").val(msg.deviceId);
                    $("#emailRequestId").val(msg.requestId);
                    $("#action").val(emailAttributes.action);
                    $("#emailERequestId").val(msg.requestId);
                    $("#emailEDeviceId").val(msg.deviceId);
                    $("#requestId").val(msg.requestId);

                    if(emailAttributes.action === "ENROLLMENT") {
                        $("#emailEnrollmentArea").show();
                        var credentials = {};
                        credentials.authFactor = "EMAIL";
                        credentials.scenario = emailAttributes.action;
                        credentials.resend = "true";
                        initiateAuth2(credentials, 
                            function(text) {
                                $("#emailDeviceId").val(text.deviceId);
                                $("#emailRequestId").val(text.requestId);
                                $("#emailEDeviceId").val(text.deviceId);
                                $("#emailERequestId").val(text.requestId);
                                $("#emailEText").html("<p>OTP Code Sent to Email ID: " +
                                    text.displayMessage + "</p>");
                            }
                        );	
                    } else {
                        $("#emailArea").show();
                        $("#backupArea").show();
                        if(msg.trustedEpFlagEnabled) {									
                            $("#trustUA").show();
                        }
                        $("#emailText").html("<p>OTP Code Sent to Email ID: " +
                                emailAttributes.attributes.devices[0].displayName + "</p>");
                        var credentials = {};
                        credentials.authFactor = "EMAIL";
                        credentials.scenario = $("#action").val();
                        credentials.resend = "true";
                        initiateAuth2(credentials, defaultFunction);	
                    }
                    $("#totp").css("background-color","gray");
                    $("#sms").css("background-color","gray");
                    $("#bypasscode").css("background-color","gray");
                    $("#security_questions").css("background-color","gray");
                    $("#push").css("background-color","gray");
                    $("#email").css("background-color","green");

                });	

                $("#sms").click(function(){
                    hideAll();
                    var smsAttributes = msg.requiredCredentials.SMS;
                    clearTimeout(timer);
                    if(smsAttributes.action === "ENROLLMENT") {
                        $("#smsEDeviceId").val(msg.deviceId);
                        $("#smsEnrollmentArea").show();
                        $("#smsERequestId").val(msg.requestId);
                        $("#deviceId").val(msg.deviceId);
                    } else {
                        $("#smsDeviceId").val(msg.deviceId);
                        $("#smsRequestId").val(msg.requestId);
                        $("#smsArea").show();
                        $("#backupArea").show();
                        if(msg.trustedEpFlagEnabled) {

                                $("#trustUA").show();
                        }
                        $("#smsDeviceId").val(smsAttributes.attributes.devices[0].deviceId);
                        $("#smsText").html("<p>SMS Sent to Phone Number: " +smsAttributes.attributes.devices[0].displayName + "</p>");
                        var credentials = {};
                        credentials.deviceId = $("#smsDeviceId").val();
                        credentials.authFactor = "SMS";
                        credentials.requestId = $("#smsRequestId").val();
                        credentials.scenario = $("#action").val();
                        credentials.resend = "true";
                        credentials.credType = "OTP_CODE";
                        credentials.otpCode = $("#smsverificationCode").val();
                        initiateAuth2(credentials, defaultFunction );	
                    }
                    $("#action").val(smsAttributes.action);
                    $("#requestId").val(msg.requestId);
                    $("#totp").css("background-color","gray");
                    $("#sms").css("background-color","green");
                    $("#bypasscode").css("background-color","gray");
                    $("#security_questions").css("background-color","gray");
                    $("#push").css("background-color","gray");
                    $("#email").css("background-color","gray");

                });							

                $("#push").click(function(){
                    hideAll();
                    var pushAttributes = msg.requiredCredentials.PUSH;
                    if(pushAttributes === null || pushAttributes.action === "ENROLLMENT") {
                        $("#pushEnrollmentArea").show();

                        $("#pushERequestId").val(msg.requestId);
                        $("#pushEDeviceId").val(msg.deviceId);
                        $("#deviceId").val(msg.deviceId);
                        var channels = "PUSH";
                        initiateEnrollment("push", "false", channels, pushAttributes.action, null);
                    } else {
                        if(msg.trustedEpFlagEnabled) {
                                $("#trustUA").show();
                        }
                        $("#pushArea").show();
                        $("#backupArea").show();
                        $("#pushDeviceId").val(pushAttributes.attributes.devices[0].deviceId);
                        $("#deviceId").val(pushAttributes.attributes.devices[0].deviceId);
                        /*initiateRequest("AUTHENTICATION", $("#deviceId").val(), "PUSH");*/
                    }
                    $("#action").val(pushAttributes.action);
                    $("#sms").css("background-color","gray");
                    $("#totp").css("background-color","gray");
                    $("#bypasscode").css("background-color","gray");
                    $("#security_questions").css("background-color","gray");
                    $("#push").css("background-color","green");
                    $("#email").css("background-color","gray");
                });
                $("#totp").click(function(){
                    hideAll();
                    var totpAttributes = msg.requiredCredentials.TOTP;
                    if(totpAttributes === null || totpAttributes.action === "ENROLLMENT") {
                        $("#totpEnrollmentArea").show();
                        $("#totpERequestId").val(msg.requestId);
                        $("#totpEDeviceId").val(msg.deviceId);
                        $("#deviceId").val(msg.deviceId);
                        var channels = "TOTP";
                        initiateEnrollment("totp", "false", channels, totpAttributes.action, null);
                    } else {
                        $("#totpArea").show();
                        $("#backupArea").show();
                        $("#displayText").html("<p>Enter TOTP Code from " +totpAttributes.attributes.devices[0].displayName +"</p>");
                        if(msg.trustedEpFlagEnabled) {

                                $("#trustUA").show();
                        }
                        $("#totpDeviceId").val(totpAttributes.attributes.devices[0].deviceId);
                        $("#deviceId").val(totpAttributes.attributes.devices[0].deviceId);
                    }
                    $("#action").val(totpAttributes.action);
                    $("#sms").css("background-color","gray");
                    $("#totp").css("background-color","green");
                    $("#bypasscode").css("background-color","gray");
                    $("#security_questions").css("background-color","white");
                    $("#email").css("background-color","gray");
                });

                $("#security_questions").click(function(){
                    hideAll();
                    var security_questionsAttributes = msg.requiredCredentials.SECURITY_QUESTIONS;
                    $("#action").val(security_questionsAttributes.action);
                    if(security_questionsAttributes.action === "ENROLLMENT") {
                            $("#security_questionsEnrollmentArea").show();
                            var channels = "SECURITY_QUESTIONS";
                            initiateEnrollment("security_questions", "false", channels,
                                security_questionsAttributes.action, security_questionsAttributes.attributes);
                    } else {
                            $("#security_questionsArea").show();
                            $("#backupArea").show();
                            var qs = security_questionsAttributes.attributes.securityQuestions;
                            var l = security_questionsAttributes.attributes.securityQuestions.length;
                            for(var ij = 0; ij < l ; ij ++) {
                                    var text = qs[ij].localizedText;
                                    var hint = qs[ij].hintText;
                                    if (text === null) {
                                            text = preQuestions[qs[ij].id];
                                    }

                                    if(hint !== null){
                                            text = text + "(Hint: " + hint + ")";
                                    }
                                    $("#security_questionsQuestion" + ( ij + 1 )).val(qs[ij].id);
                                    $("#security_questionsQuestionText" + ( ij + 1 )).html(text);
                                    $("#security_questionsQuestionDiv" + ( ij + 1 )).show();									
                            }
                    }
                    $("#sms").css("background-color","gray");
                    $("#totp").css("background-color","gray");
                    $("#bypasscode").css("background-color","gray");
                    $("#security_questions").css("background-color","green");
                    $("#email").css("background-color","gray");
                });
            };
            
            var backupChooser = function() {
                var details = mappingIds[this.id];
                hideAll();
                var f = details.factor;
                if (f !== currentFactor) {
                    $(".preferredfactor").show();
                } else {
                    $(".preferredfactor").show();
                }
                if (f === "TOTP") {
                    $("#totpDeviceId").val(details.deviceId);
                    $("#totpArea").show();
                    $("#displayText").html("<p>Enter TOTP Code from " + details.displayName + "</p>");
                } else if (f === "SMS") {
                    var creds = {};
                    creds.deviceId = details.deviceId;
                    creds.authFactor = "SMS";
                    initiateAuth2(creds, function(msg){
                        $("#smsArea").show();
                        $("#smsDeviceId").val(msg.deviceId);
                        $("#smsRequestId").val(msg.requestId);
                        $("#smsText").html("<p>SMS Sent to Phone Number:  " + details.displayName + "</p>");
                    });
                } else if (f === "SECURITY_QUESTIONS") {
                    $("#security_questionsArea").show();
                    $("#securityQuestionsPreferred").show();
                    var sq = details.questions;
                    var len = sq.length;
                    for(var m = 0 ; m < len ; m ++ ) {
                        $('#security_questionsQuestionDiv'+ (m+1)).show();
                        $('#security_questionsQuestionText'+ (m+1)).html("<p>" + sq[m].localizedText + "</p>");
                        $('#security_questionsQuestion'+ (m+1)).val(sq[m].id);
                    }
                    /*initiateRequest();*/
                } else if (f === "PUSH") {
                    var creds = {};
                    creds.deviceId = details.deviceId;
                    creds.authFactor = "PUSH";
                    initiateAuth2(creds, function(msg){
                        $("#pushArea").show();
                        $("#pushDeviceId").val(msg.deviceId);
                        $("#pushRequestId").val(msg.requestId);
                        $("#pushDisplayText").html("Waiting for push notification approval on device: " + details.displayName)
                        timer = setInterval(invokeTimeEvent, timeInterval);
                    });
                } else if (f === "EMAIL") {
                    var creds = {};
                    creds.authFactor = "EMAIL";
                    initiateAuth2(creds, function(msg){
                        $("#emailText").html("<p>Enter the OTP received on the email id: " + details.displayName + "</p>");
                        $("#emailArea").show();
                        $("#emailDeviceId").val(msg.deviceId);
                        $("#emailRequestId").val(msg.requestId);
                        
                    });
                }  else if (f === "BYPASSCODE") {
                    $("#bypasscodeArea").show();
                }
                $("#backupDeviceDetails").hide();
                $("#backupAndTrusted").show();
            };

            var enrollmentInProgress = false;
            var startAdditionalFactorEnrollment = function( ) {
                hideAll();
                $("#enrollmentOptions").hide();
                $("#enrollmentHeader").hide();
                $("#skipArea").hide();
                $("#additionalFactor").show();
            };
            
            
            $("#disableBackupFactors").click(function() {
                $("#backupDeviceDetails").hide();
                $("#backupAndTrusted").show();
            });

            $(".backupChooser").click(backupChooser);
            $(".preferredon").click(function(){
                if ($(this).is(':checked')) {
                    changePreferredFactor = true;
                } else {
                    changePreferredFactor = false;
                }

            });
            $(".trusted").click(function(){
                if ($(this).is(':checked')) {
                    trustThisDevice = true;
                } else {
                    trustThisDevice = false;
                }                            
            });
            var currentFactor = null;
            var defaultFunction = function(msg) {
                if ( msg.nextOp === "postRedirect" || msg.nextOp === 'redirect') {
                    clearTimeout(timer);
                    if(typeof msg.redirectUrl !== 'undefined' && msg.redirectUrl !== null) {
                        if (enrollmentInProgress) {
                            startAdditionalFactorEnrollment();
                            addFactorEnrollmentResponse = msg;
                            return;
                        } else {
                            if (msg.nextOp === 'redirect') {
                            window.location = msg.redirectUrl;
                        } else {
                            var myform = document.createElement("form");
                            myform.method = "post";
                            if (msg.redirectUrl.indexOf("consent") > 0) {
                                myform.action = "<%=request.getContextPath()%>/consent/";
                                addParam(myform, msg, "OAUTH_OCIS_REQ");
                                addParam(myform, msg, "clientId");
                                addParam(myform, msg, "clientName");
                                addParam(myform, msg, "clientIconUrl");
                                addParam(myform, msg, "scopes");
                                addParam(myform, msg, "signature");
                            } else {
                                myform.action = msg.redirectUrl;
                                if (typeof msg.postParams["OCIS_REQ"] !== "undefined") {
                                    param = document.createElement("input");
                                    param.value = msg.postParams.OCIS_REQ;
                                    param.name = "OCIS_REQ";
                                    myform.appendChild(param);

                                } else {

                                    param = document.createElement("input");
                                    param.value = msg.postParams.state;
                                    param.name = "state";
                                    myform.appendChild(param);

                                    param = document.createElement("input");
                                    param.value = msg.postParams.id_token;
                                    param.name = "id_token";
                                    myform.appendChild(param);

                                    param = document.createElement("input");
                                    param.value = msg.postParams["X-HOST-IDENTIFIER-NAME"];
                                    param.name = "X-HOST-IDENTIFIER-NAME";
                                    myform.appendChild(param);
                                }
                            }
                            document.body.appendChild(myform);
                            myform.submit();
                        }

                        }
                    } else {
                        startAdditionalFactorEnrollment();
                        addFactorEnrollmentResponse = msg;
                        return;
                    }
                } else if(msg.nextOp === "AUTH_SUCCESS" || 
                    msg.nextOp === "cred_collect" || msg.nextOp === "CRED_COLLECT") {
                    if (msg.nextOp === "AUTH_SUCCESS") {
                        startAdditionalFactorEnrollment();
                        addFactorEnrollmentResponse = msg;
                        return;
                    }
                    var channels = msg.nextAuthFactors;
                    if(channels != null) {
                        if (enrollmentInProgress == false) {
                            originalEnrollmentResponse = msg;
                        }
                        enrollmentInProgress = true;
                        displayEnrollmnetOptions(msg);
                        if(typeof msg.userPreference !== 'undefined' && msg.userPreference !== null) {
                            $("#backupAndTrusted").show();
                            currentFactor = msg.userPreference.authFactor;
                            enrollmentInProgress = false;
                            var prefFactor = msg.userPreference.authFactor;
                            $("#buttonspace").hide();
                            $("#enrollmentOptions").hide();
                            $("#enrollmentHeader").hide();
                            $("#skipArea").hide();
                            if (prefFactor === "TOTP") {
                                $("#action").val("AUTHENTICATION");
                                $("#totpDeviceId").val(msg.deviceId);
                                $("#totpArea").show();
                                $("#displayText").html("<p>Enter TOTP Code from " + getDisplayName(msg.deviceId, msg.requiredCredentials.TOTP) +"</p>");
                                $("#totpDeviceId").val(msg.deviceId);
                                $("#deviceId").val(msg.deviceId);
                            } else if (prefFactor === "SMS") {
                                $("#action").val("AUTHENTICATION");
                                $("#smsDeviceId").val(msg.deviceId);
                                $("#smsRequestId").val(msg.requestId);
                                $("#deviceId").val(msg.deviceId);
                                $("#requestId").val(msg.requestId);
                                $("#smsArea").show();
                                $("#smsText").html("<p>SMS Sent to Phone Number: " + getDisplayName(msg.deviceId, msg.requiredCredentials.SMS) + "</p>");
                                /*initiateRequest();*/
                            } else if (prefFactor === "SECURITY_QUESTIONS") {
                                $("#action").val("AUTHENTICATION");
                                $("#security_questions").trigger("click");
                                /*initiateRequest();*/
                            } else if (prefFactor === "PUSH") {
                                $("#action").val("AUTHENTICATION");
                                $("#pushDeviceId").val(msg.deviceId);
                                $("#deviceId").val(msg.deviceId);
                                $("#requestId").val(msg.requestId);
                                $("#pushRequestId").val(msg.requestId);
                                factor = "PUSH";
                                timer = setInterval(invokeTimeEvent, 5000);
                                $("#pushArea").show();
                            } else if (prefFactor === "EMAIL") {
                                $("#action").val("AUTHENTICATION");
                                $("#emailDeviceId").val(msg.deviceId);
                                $("#deviceId").val(msg.deviceId);
                                $("#requestId").val(msg.requestId);
                                $("#emailRequestId").val(msg.requestId);
                                factor = "EMAIL";
                                $("#emailText").html("<p>Enter the OTP received on the email id: " +
                                            msg.requiredCredentials.EMAIL.attributes.devices[0].displayName + "</p>");
                                $("#emailArea").show();
                            }
                            if(msg.trustedEpFlagEnabled) {
                                $("#trustUA").show();
                            }   
                        }
                    }
                } else if(!typeof msg.errors !== 'undefined') {
                    var cause = msg.errors[0];
                    if(!typeof cause.code !== 'undefined') {                                           
                        if (cause.code === 'SSO-1005') {                                    
                            hideAll();
                            $("#resetPwd").show();
                        } else {
                            $("#error").show();
                            $("#error").html('<h4 style="color: red">' +
                                cause.code + " : " + cause.message +  '</h4>');
                        }
                        return;
                    }
                }
            };

            $("#resetPwdBut").click(function(){
                var pwdReset = {};
                pwdReset.schemas = [
                    "urn:ietf:params:scim:schemas:oracle:idcs:MePasswordMustChanger"
                ];

                pwdReset.password = $("#newPwd").val();
                pwdReset.oldPassword = $("#currentPwd").val();
                pwdReset.mappingAttribute = "userName";
                pwdReset.mappingAttributeValue = $("#username").val();

                $.ajax({
                    type:"POST",
                    url: GlobalConfig.idcsBaseURL + "/admin/v1/MePasswordMustChanger",
                    data: JSON.stringify(pwdReset),
                    dataType: "json",
                    contentType: "application/json",
                    headers: {
                        'Authorization':'Bearer ' + GlobalConfig.accessToken
                    }
                }).done(function(msg){	
                    var credentials = {};
                    credentials.username = $("#username").val();
                    credentials.password = $("#newPwd").val();
                    credentials.authFactor = "USERNAME_PASSWORD";
                    credentials.credType = "USERNAME_PASSWORD";
                    credentials.scenario = $("#action").val();
                    initiateAuth(credentials);
                }).fail(function(ex, qXHR){
                    $("#resetPwdResponseText").html("<h4>Unalbe to reset password <h4>");
                });

            });

            $("#done").click(function(){
                var credentials = {};
                if (enrollAnotherFactor === true) {
                    credentials.enrollmentCompleted = "true";
                } else {
                    credentials.skipEnrollment = "true";
                }
                enrollmentInProgress = false;
                initiateAuth3(credentials, defaultFunction);
            });


            var getDisplayName = function(dId, attributes) {
                if (attributes === null) {
                        return "No Device Display Name";
                }
                var devicesList = attributes.attributes.devices;
                if (devicesList === null) {
                        return "Device list is not retrieved";
                }
                var len = devicesList.length;
                for (var i = 0 ; i < len ; i ++) {
                        if (devicesList[i].deviceId === dId) {
                                return devicesList[i].displayName;
                        }
                }
                return "No Device name found";
            };

            var invokeTimeEvent = function() {
                var credentials = {};
                credentials.deviceId = $("#deviceId").val();
                credentials.requestId = $("#requestId").val();
                credentials.authFactor = factor;
                credentials.scenario = $("#action").val();
                initiateAuth2(credentials);
            };	

            var initiateAuth = function(creds){
                initiateAuth2(creds, defaultFunction);
            };

            var trustThisDevice = false;
            var changePreferredFactor = false;
            var initiateAuth2 = function(creds, callback){
                if (enrollAnotherFactor) {
                    creds.additionalFactor = "true";
                }
                if (trustThisDevice) {
                    creds.deviceTrusted = "true";
                }
                if (changePreferredFactor) {
                    creds.updatePreference = "true";
                }
                initiateAuth3(creds, callback);
            };
            var initiateAuth3 = function(creds, callback) {
                $("#error").hide();
                var details = {};
                details.op = "cred_submit";
                details.credentials = creds;
                details.credentials.authenticationToken = atToken;
                var dataDet = JSON.stringify(details);              
                $.ajax({
                        type: "POST",
                        url: GlobalConfig.idcsURL,
                        data: dataDet,
                        contentType: "application/json",
                        dataType: "json",
                        xhrFields: {
                            withCredentials: true
                        },
                        crossDomain: true,
                        headers: {
                            'Authorization':'Bearer ' + GlobalConfig.accessToken
                        }
                }).done(function(msg) {
                    atToken = msg.authenticationToken;
                    callback(msg);
                }).fail(function(ex, qXHR){
                   $("#error").show();
                   $("#error").html("<h3>Error occurred: " + qXHR.responseText() + "</h3>");
                }); 
            };
            <%
                if (data != null) {
            %>
                if (sResponse.mfaResp) {
                  defaultFunction(sResponse.mfaResp);
                }
            <%
                }
            %>
        });
    </script>

  </head>
  <html>
  <body style="background-color: #f1f2f7">
  	<nav class="navbar navbar-deafult navbar-fixed-top white-bg">
  		<div class="container-fluid login-page-header minimum-header">
  			<div class="navbar-header">
  				<button type="button" class="navbar-toggle collapsed" data-toggle="collapse" data-target="#navbar" aria-expanded="false" aria-controls="navbar">
  					<span class="sr-only">Toggle navigation</span>
  					<span class="icon-bar"></span>
  					<span class="icon-bar"></span>
  					<span class="icon-bar"></span>
  				</button>
  				<a class="navbar-brand" href="#">
  					<img class="logo" src="<%=request.getContextPath()%>/img/orcl.png">
  				</a>
  			</div>
  			<div id="navbar" class="navbar-collapse collapse">

  			</div>
  		</div>
  	</nav>
  	
	
	<br>
	<div id="controlsArea" style="margin: 2;">		
		<input type="hidden" id="content" name="content" value=""/>
		<input type="hidden" id="deviceId" name="deviceId" value=""/>
		<input type="hidden" id="requestId" name="requestId" value=""/>
		<input type="hidden" id="action" name="action" value=""/>
                    <div class="logincenterblock col-lg-4 col-md-6 col-sm-6 col-xs-12 login-width">
                    	<div class="module-login module-login-width">
                            <div id="error" style="display: none">
                                
                            </div>
                            <div id="enrollmentHeader" style="display:none" class="clearfix">
                                <div class="col-lg-12 col-md-12 col-sm-12 x2">
                                    <div class="row">
                                        <h2 class="primary-btn orange f20 left login-btn btn-block">2-Step Enrollment</h4>
                                    </div>
                                </div>
                            </div>
                            <div id="enrollmentOptions" class="panel x2" style="display: none">
                                <div style="width: 500px;padding: 5px 0 5px;">
                                    <ul class="tabs" id="buttonList" data-persist="true" style="padding: 0px;">
                                        
                                    </ul>
                                    <div class="tabcontents">
                                        <div id="totpEnrollmentArea" style="display: none; ">
                                            <div class="panel x2">
                                                <h1 class="black-color x1 text-left">2-Step Enrollment</h1>
                                                <br/>
                                                <form action="" method="post">
                                                        <img  alt="QR Code Missing" id="qrCodeDisplay"/>
                                                        <br>
                                                        <input type="hidden" id="totpERequestId" name="totpERequestId" value=""/>		
                                                        <input type="hidden" id="totpEDeviceId" name="totpEDeviceId" value=""/>

                                                        <div id="textboxTotpArea" style="display: none">
                                                            <h4 class="black-color x1 text-left" id="">Enter the code manually.</h4>
                                                            <input autocomplete="off" type="text" 
                                                                   class="form-control input large-input input-lg col-lg-12 col-md-12 col-sm-12"
                                                                   placeholder="TOTP Code" value="" 
                                                                   name="totpEverificationCode" id="totpEverificationCode"/>
                                                        </div>
                                                        <div class="clearfix">
                                                            <input type="checkbox" value="None" id="notConnected" name="check" />Check this box if you are not connected to Internet.
                                                        </div>
                                                </form>
                                                <br/>

                                            </div>
                                            <div class="clearfix" id="textboxTotpSubmitButtonArea" style="display: none">
                                                <div class="col-lg-12 col-md-12 col-sm-12 x2">
                                                    <div class="row">
                                                            <input type="button" class="primary-btn orange f20 left login-btn btn-block"
                                                                   name="Submit" value="Submit" id="totpEnrollmentAuth" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                         <div id="smsEnrollmentArea" style="display: none">
                                            <div class="panel x2">
                                                <h1 class="black-color x1 text-left">2-Step Enrollment</h1>
                                                <br/>
                                                <form action="" method="post">
                                                        <input type="hidden" id="smsERequestId" name="smsERequestId" value=""/>		
                                                        <input type="hidden" id="smsEDeviceId" name="smsEDeviceId" value=""/>
                                                        <div class="clearfix" id="smsPhoneNoSubmitInputArea" >
                                                            <h4 class="black-color x1 text-left" id="">Enter Phone number to be enrolled.</h4>
                                                            <input autocomplete="off" type="password" 
                                                                   class="form-control input large-input input-lg col-lg-12 col-md-12 col-sm-12"
                                                                   placeholder="Phone Number" value="" 
                                                                   name="smsPhoneNumber" id="smsPhoneNumber"/>
                                                        </div>
                                                        <div class="clearfix" id="smsOtpCodeSubmitInputArea" style="display: none">
                                                            <h4 class="black-color x1 text-left" id="smsEnrollmentDisplayText"></h4>
                                                            <input autocomplete="off" type="password" 
                                                                   class="form-control input large-input input-lg col-lg-12 col-md-12 col-sm-12"
                                                                   placeholder="OTP Number" value="" 
                                                                   name="smsEnrollmentOtpCode" id="smsEnrollmentOtpCode"/>
                                                        </div>
                                                </form>
                                            </div>
                                            <div class="clearfix">
                                                <div class="col-lg-12 col-md-12 col-sm-12 x2">
                                                    <div class="row" id="smsPhoneNoSubmitButtonArea">
                                                            <input type="button" class="primary-btn orange f20 left login-btn btn-block"
                                                                   name="Submit" value="Submit" id="smsEnrollmentAuth" />
                                                    </div>
                                                    <div class="row" id="smsOtpCodeSubmitButtonArea" style="display: none">
                                                            <input type="button" class="primary-btn orange f20 left login-btn btn-block"
                                                                   name="Submit" value="Submit" id="smsOtpCodeButton" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div id="security_questionsEnrollmentArea" style="display: none">
                                            <div class="panel x2">
                                                <h1 class="black-color x1 text-left">2-Step Enrollment</h1>
                                                <form action="" method="post">
                                                    <div class="clearfix" id="totp_codeArea" >
                                                        <h4 class="black-color x1 text-left" style="margin-top: 10px;" 
                                                            id="">Select Security Questions for Enrollment</h4>
                                                        <h4 class="black-color x1 text-left" id="">Select Question 1</h4>
                                                        <select class="col-lg-12 col-md-12 col-sm-12"
                                                                name="security_questionsEQuestion1" id="security_questionsEQuestion1"
                                                                style="">				
                                                        </select>
                                                        <input autocomplete="off" type="password" 
                                                                   class="form-control input large-input input-lg col-lg-12 col-md-12 col-sm-12"
                                                                   placeholder="Enter Answer" value="" style="margin-top:4px;"
                                                                   name="security_questionsEAnswer1" id="security_questionsEAnswer1"/>
                                                        <input autocomplete="off" type="text" 
                                                                   class="form-control input large-input input-lg col-lg-12 col-md-12 col-sm-12"
                                                                   placeholder="Enter Hint Text" value="" style="margin-top:4px;"
                                                                   name="security_questionsEHint1" id="security_questionsEHint1"/><br/>

                                                        <br>
                                                        <h4 class="black-color x1 text-left" style="margin-top: 100px;" id="">Select Question 2</h4>
                                                        <select class="col-lg-12 col-md-12 col-sm-12" style=""
                                                                name="security_questionsEQuestion2" id="security_questionsEQuestion2">				
                                                        </select>
                                                        <input autocomplete="off" type="password" 
                                                                   class="form-control input large-input input-lg col-lg-12 col-md-12 col-sm-12"
                                                                   placeholder="Enter Answer" value=""  style="margin-top:4px;"
                                                                   name="security_questionsEAnswer2" id="security_questionsEAnswer2"/>
                                                        <input autocomplete="off" type="text" 
                                                                   class="form-control input large-input input-lg col-lg-12 col-md-12 col-sm-12"
                                                                   placeholder="Enter Hint Text" value="" style="margin-top:4px;"
                                                                   name="security_questionsEHint2" id="security_questionsEHint2"/><br/><br/>


                                                        <h4 class="black-color x1 text-left" style="margin-top: 100px;" id="">Select Question 3</h4>
                                                        <select class="col-lg-12 col-md-12 col-sm-12" style=""
                                                                name="security_questionsEQuestion3" id="security_questionsEQuestion3">				
                                                        </select>
                                                        <input autocomplete="off" type="password" 
                                                                   class="form-control input large-input input-lg col-lg-12 col-md-12 col-sm-12"
                                                                   placeholder="Enter Answer" value="" style="margin-top:4px;"
                                                                   name="security_questionsEAnswer3" id="security_questionsEAnswer3"/>
                                                        <input autocomplete="off" type="text" 
                                                                   class="form-control input large-input input-lg col-lg-12 col-md-12 col-sm-12"
                                                                   placeholder="Enter Hint Text" value="" style="margin-top:4px;"
                                                                   name="security_questionsEHint3" id="security_questionsEHint3"/>



                                                    </div>
                                                </form>
                                            </div>
                                            <div class="clearfix">
                                                <div class="col-lg-12 col-md-12 col-sm-12 x2">
                                                        <div class="row">
                                                                <input type="button" class="primary-btn orange f20 left login-btn btn-block"
                                                                       name="Submit" value="Submit" id="security_questionsEnrollmentAuth" />
                                                        </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="clearfix" id="pushEnrollmentArea" style="display: none">
                                            <div class="panel x2">
                                                <h1 class="black-color x1 text-left">2-Step Enrollment</h1>
                                                <br/>
                                                <form action="/auth/v1/user/login" method="post">
                                                        <img  alt="QR Code Missing" id="pushQrCodeDisplay"/>
                                                        <br>
                                                        <img src="<%=request.getContextPath()%>/img/loading.gif" height="80" width="80" style="padding: 30px;"/> 
                                                        <h4 class="black-color x1 text-left" id="" style="text-align: center">
                                                            Waiting for push authentication request to be completed......</h4>
                                                        <br>
                                                        <div id="pushText"></div>				
                                                        <br>
                                                        <input type="hidden" id="pushERequestId" name="pusERequestId" value=""/>		
                                                        <input type="hidden" id="pushEDeviceId" name="pushEDeviceId" value=""/>
                                                        <div id="statusMsgDisplay">
                                                        </div>
                                                </form>
                                            </div>
                                        </div>

                                        <div id="emailEnrollmentArea" style="display: none">
                                            <div class="panel x2">
                                                <h1 class="black-color x1 text-left">2-Step Enrollment</h1>
                                                <br/>
                                                <form action="" method="post">
                                                    <input type="hidden" id="emailERequestId" name="emailERequestId" value=""/>		
                                                    <input type="hidden" id="emailEDeviceId" name="emailEDeviceId" value=""/>
                                                    <div class="clearfix" id="totp_codeArea" >
                                                        <h4 class="black-color x1 text-left" id="emailEText"></h4>
                                                        <input autocomplete="off" type="text" 
                                                               class="form-control input large-input input-lg col-lg-12 col-md-12 col-sm-12"
                                                               placeholder="Enter OTP Code" value="" 
                                                               name="emailEVerificationCode" id="emailEVerificationCode"/>
                                                    </div>
                                                </form>
                                                <br/>
                                            </div>
                                            <div class="clearfix">
                                                <div class="col-lg-12 col-md-12 col-sm-12 x2">
                                                    <div class="row">
                                                            <input type="button" class="primary-btn orange f20 left login-btn btn-block"
                                                                   name="Submit" value="Submit" id="emailELoginAuth" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                            </div>
                            <div id="skipArea" style="display:none" class="clearfix">
                                <div class="col-lg-12 col-md-12 col-sm-12 x2">
                                    <div class="row">
                                            <input type="button" class="primary-btn orange f20 left login-btn btn-block"
                                                   name="skip" value="Skip Enrollment" id="skip" />
                                    </div>
                                </div>
                            </div>

                            
                            <div id="username_passwordArea" class="wrapped" style="">
                    <%
                    if (remoteIdps) {
                    %>
                        <div id="" class="content">
                        <%
                    }
                    %>
                    <form class="form-horizontal" action="" method="post">
                        <input type="hidden" id="authFactor" name="authFactor" value="USERNAME_PASSWORD"/>
                        <div class="panel x2">
                            <h1 class="black-color x1 text-left">My Account Log-in</h1>
                            <div class="clearfix">
                                <div class="col-lg-12 col-md-12 col-sm-12 x2">
                                    <div class="row">
                                        <input autocomplete="off" type="text" class="form-control input large-input input-lg col-lg-12 col-md-12 col-sm-12" placeholder="Username" name="username" id="username" value="" />
                                    </div>
                                </div>
                                <div class="col-lg-12 col-md-12 col-sm-12 x2">
                                    <div class="row">
                                        <input autocomplete="off" type="password" class="form-control input large-input input-lg col-lg-12 col-md-12 col-sm-12" placeholder="Password" name="password" id="password" value="" />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <br/>
                        <div class="clearfix">
                            <div class="col-lg-12 col-md-12 col-sm-12 x2">
                                <div class="row">
                                    <input type="button" class="primary-btn orange f20 left login-btn btn-block" name="SignIn" value="SignIn" id="loginUserNameAuth" />
                                    <!-- hidden submit button to allow for enter to submit -->
                                    <!--<input type="submit" style="position: absolute; left: -9999px; width: 1px; height: 1px;" tabindex="-1" />-->
                                </div>
                            </div>
                    </form>
                    <%
                    if (remoteIdps) {
                    %>
                        </div>
                        <div id="" class="sidebar">
                            Sign In With Remote IDPs<br>
                            <%
                                JSONObject obj = new JSONObject(sResponseData);
                                JSONArray array = obj.getJSONArray("remoteIdps");
                                if (array.length() > 0) {
                                    for (int i = 0; i < array.length() ; i++) {
                                        JSONObject rIdp = array.getJSONObject(i);
                                        String tenantName = rIdp.getString("name");
                                        String idpId = rIdp.getString("id");
                                        %>
                                        <img height="30px" width="30px" src="<%=request.getContextPath()%>/img/idp.png">
                                        </img>&nbsp;&nbsp;&nbsp;<a style="font-size: x-large" href="javascript:void(0);"
                                                                   onclick="activateIdp('<%=tenantName%>', '<%=idpId%>' )"><%=tenantName%><a/>
                                        <%
                                    }
                                }
                                array = obj.getJSONArray("socialIdps");

                                if (array != null && array.length() > 0) {
                                    for (int i = 0; i < array.length() ; i++) {
                                        JSONObject rIdp = array.getJSONObject(i);
                                        String tenantName = rIdp.getString("name");
                                        String idpId = rIdp.getString("id");
                                        %>
                                        <img height="30px" width="30px" src="<%=request.getContextPath()%>/img/idp.png">
                                        </img>&nbsp;&nbsp;&nbsp;<a style="font-size: x-large" href="javascript:void(0);"
                                                                   onclick="activateSocialIdp('<%=tenantName%>', '<%=idpId%>' )"><%=tenantName%><a/>
                                        <%
                                    }
                                }
                            %>
                            
                        </div>
                        <div id="" class="cleared">
                        <%    
                    }  
                    %>
                    </div>
		</div>
                <div id="totpArea" style="display: none">
                    <div class="panel x2">
                        <h1 class="black-color x1 text-left">2-Step Verification</h1>
                        <br/>
			<form action="" method="post">
                            <input type="hidden" id="totpRequestId" name="totpRequestId" value=""/>		
                            <input type="hidden" id="totpDeviceId" name="totpDeviceId" value=""/>
                            <div class="clearfix" id="totp_codeArea" >
                                <h4 class="black-color x1 text-left" id="displayText"></h4>
                                <input autocomplete="off" type="text" 
                                       class="form-control input large-input input-lg col-lg-12 col-md-12 col-sm-12"
                                       placeholder="Enter Time based OTP Code" value="" 
                                       name="verificationCode" id="verificationCode"/>
                            </div>

                            <div class="col-lg-12 col-md-12 col-sm-12 preferredfactor" style="padding-top: 20px; display: none">
                                <div class="row text-left">
                                    <div class="input-switch inline-block text-vertical-align">
                                        <div class="switch">
                                                <input id="p1" class="preferredon switch-toggle switch-toggle-round-flat" name="preferredFactor"
                                                       type="checkbox" value="false"><label for="p1"></label>
                                        </div>
                                    </div>

                                    <span class="f16 text-vertical-align inline-block black-color">Set this factor as default factor for next login</span>
                                </div>
                            </div>

                            <div class="inline-block col  trusteddisplays" display: none">
                                <div class="input-switch inline-block text-vertical-align">
                                        <div class="switch">
                                                <input id="t1" class="trusted switch-toggle switch-toggle-round-flat" name="trustEP" type="checkbox" value="False"/>
                                                <label for="t1"></label>
                                        </div>
                                </div>
                                <span class="f16 text-vertical-align inline-block black-color">Trust this device</span>                                    
                            </div>
			</form>
                        <br/>
                    </div>
                    <div class="clearfix">
                        <div class="col-lg-12 col-md-12 col-sm-12 x2">
                            <div class="row">
                                    <input type="button" class="primary-btn orange f20 left login-btn btn-block"
                                           name="Submit" value="Submit" id="totpLoginAuth" />
                            </div>
                        </div>
                    </div>
                </div>
                
                <div id="smsArea" style="display: none">
                    <div class="panel x2">
                        <h1 class="black-color x1 text-left">2-Step Verification</h1>
                        <br/>
			<form action="" method="post">
                            <input type="hidden" id="smsRequestId" name="smsRequestId" value=""/>		
                            <input type="hidden" id="smsDeviceId" name="smsDeviceId" value=""/>
                            <div class="clearfix" id="totp_codeArea" >
                                <h4 class="black-color x1 text-left" id="smsText"></h4>
                                <input autocomplete="off" type="password" 
                                       class="form-control input large-input input-lg col-lg-12 col-md-12 col-sm-12"
                                       placeholder="Enter OTP Code" value="" 
                                       name="smsverificationCode" id="smsverificationCode"/>
                            </div>

                            <div class="col-lg-12 col-md-12 col-sm-12 preferredfactor" style="padding-top: 20px; display: none">
                                <div class="row text-left">
                                    <div class="input-switch inline-block text-vertical-align">
                                        <div class="switch">
                                                <input id="p2" class="preferredon switch-toggle switch-toggle-round-flat" name="preferredFactor"
                                                       type="checkbox" value="false"><label for="p2"></label>
                                        </div>
                                    </div>

                                    <span class="f16 text-vertical-align inline-block black-color">Set this factor as default factor for next login</span>
                                </div>
                            </div>

                            <div class="inline-block col  trusteddisplays" display: none">
                                <div class="input-switch inline-block text-vertical-align">
                                        <div class="switch">
                                                <input id="t2" class="trusted switch-toggle switch-toggle-round-flat" name="trustEP" type="checkbox" value="False">
                                                <label for="t2"></label>
                                        </div>
                                </div>
                                <span class="f16 text-vertical-align inline-block black-color">Trust this device</span>                                    
                            </div>
			</form>
                        <br/>
                    </div>
                    <div class="clearfix">
                        <div class="col-lg-12 col-md-12 col-sm-12 x2">
                            <div class="row">
                                    <input type="button" class="primary-btn orange f20 left login-btn btn-block"
                                           name="Submit" value="Submit" id="smsLoginAuth" />
                            </div>
                        </div>
                    </div>
                </div>
                
		
		<div class="clearfix" id="security_questionsArea" style="display: none">
                    <div class="panel x2">
                    <h1 class="black-color x1 text-left">2-Step Verification</h1>
                    <br/>
			<form action="" method="post">
                            <input type="hidden" value="" id="security_questionsQuestion1"/>
                            <input type="hidden" value="" id="security_questionsQuestion2"/>
                            <input type="hidden" value="" id="security_questionsQuestion3"/>
                            <div class="clearfix" id="security_questionsQuestionDiv1" style="display: none">
                                <h4 class="black-color x1 text-left" id="security_questionsQuestionText1"></h4>
                                <input autocomplete="off" type="password" class="form-control input large-input input-lg col-lg-12 col-md-12 col-sm-12" placeholder="Security Question Answer" value="" 
                                       name="security_questionsAnswer1" id="security_questionsAnswer1"/>
                            </div>
                            <div class="clearfix"  id="security_questionsQuestionDiv2" style="display: none">>
                                <h4 class="black-color x1 text-left" id="security_questionsQuestionText2"></h4>
                                <input autocomplete="off" type="password" class="form-control input large-input input-lg col-lg-12 col-md-12 col-sm-12" placeholder="Security Question Answer" value="" 
                                           name="security_questionsAnswer2" id="security_questionsAnswer2"/>
                            </div>
                            <div class="clearfix"  id="security_questionsQuestionDiv3" style="display: none">
                                <h4 class="black-color x1 text-left" id="security_questionsQuestionText3"></h4>
                                <input autocomplete="off" type="password" class="form-control input large-input input-lg col-lg-12 col-md-12 col-sm-12" placeholder="Security Question Answer" value="" 
                                           name="security_questionsAnswer3" id="security_questionsAnswer3"/>
                            </div>
                            
                                                            
                                <div class="col-lg-12 col-md-12 col-sm-12 preferredfactor" style="padding-top: 20px; display: none">
                                    <div class="row text-left">
                                        <div class="input-switch inline-block text-vertical-align">
                                            <div class="switch">
                                                    <input id="p3" class="preferredon switch-toggle switch-toggle-round-flat" name="preferredFactor"
                                                           type="checkbox" value="false"><label for="p3"></label>
                                            </div>
                                        </div>

                                        <span class="f16 text-vertical-align inline-block black-color">Set this factor as default factor for next login</span>
                                    </div>
                                </div>
                                
                                <div class="inline-block col  trusteddisplays" display: none">
                                    <div class="input-switch inline-block text-vertical-align">
                                            <div class="switch">
                                                    <input id="t3" class="trusted switch-toggle switch-toggle-round-flat" name="trustEP" type="checkbox" value="False">
                                                    <label for="t3"></label>
                                            </div>
                                    </div>
                                    <span class="f16 text-vertical-align inline-block black-color">Trust this device</span>                                    
                                </div>
                        </div>
                        <div class="clearfix">
                            <div class="col-lg-12 col-md-12 col-sm-12 x2">
                                    <div class="row">
                                            <input type="button" class="primary-btn orange f20 left login-btn btn-block"
                                                   name="Submit" value="Submit" id="security_questionsLoginAuth" />
                                    </div>
                            </div>
                        </div>
                </div>
			</form>
		</div>
		<div class="clearfix" id="bypasscodeArea" style="display: none">
                    <div class="panel x2">
                        <h1 class="black-color x1 text-left">2-Step Verification</h1>
                        <br/>
                    
                        <form action="" method="post">
                            <div class="clearfix" id="bypasscodetextbox" >
                                <h4 class="black-color x1 text-left" id="">Enter Bypass code</h4>
                                <input autocomplete="off" type="password" class="form-control input large-input input-lg col-lg-12 col-md-12 col-sm-12" 
                                       placeholder="BypassCode" value="" 
                                       name="bypassCode" id="bypassCode"/>
                            </div>
                        </form>
                    </div>
                    <div class="clearfix">
                        <div class="col-lg-12 col-md-12 col-sm-12 x2">
                            <div class="row">
                                    <input type="button" class="primary-btn orange f20 left login-btn btn-block"
                                           name="Submit" value="Submit" id="bypasscodeLoginAuth" />
                            </div>
                        </div>
                    </div>
		</div>
		
		<div class="clearfix" id="pushArea" style="display: none">
                    <div class="panel x2">
                        <h1 class="black-color x1 text-left">2-Step Verification</h1>
                        <br/>
			<form action="" method="post">
                            <input type="hidden" id="pushRequestId" name="pushRequestId" value=""/>		
                            <input type="hidden" id="pushDeviceId" name="pushDeviceId" value=""/>
                            <img src="<%=request.getContextPath()%>/img/loading.gif" height="70" width="70" style="padding: 20px;"/> 
                            
                            <h4 class="black-color x1 text-left" id="" style="text-align: center" id="pushDisplayText"></h4>

                            <div class="col-lg-12 col-md-12 col-sm-12 preferredfactor" style="padding-top: 20px; display: none">
                                <div class="row text-left">
                                    <div class="input-switch inline-block text-vertical-align">
                                        <div class="switch">
                                                <input id="p4" class="preferredon switch-toggle switch-toggle-round-flat" name="preferredFactor"
                                                       type="checkbox" value="false"><label for="p4"></label>
                                        </div>
                                    </div>

                                    <span class="f16 text-vertical-align inline-block black-color">Set this factor as default factor for next login</span>
                                </div>
                            </div>

                            <div class="inline-block col  trusteddisplays" display: none">
                                <div class="input-switch inline-block text-vertical-align">
                                        <div class="switch">
                                                <input id="t4" class="trusted switch-toggle switch-toggle-round-flat" name="trustEP" type="checkbox" value="False">
                                                <label for="t4"></label>
                                        </div>
                                </div>
                                <span class="f16 text-vertical-align inline-block black-color">Trust this device</span>                                    
                            </div>
			</form>
                                
                    </div>
		</div>
                                
                
                <div id="emailArea" style="display: none">
                    <div class="panel x2">
                        <h1 class="black-color x1 text-left">2-Step Verification</h1>
                        <br/>
                        <form action="" method="post">
                            <input type="hidden" id="emailRequestId" name="emailRequestId" value=""/>		
                            <input type="hidden" id="emailDeviceId" name="emailDeviceId" value=""/>
                            <div class="clearfix" id="totp_codeArea" >
                                <h4 class="black-color x1 text-left" id="emailText"></h4>
                                <input autocomplete="off" type="text" 
                                       class="form-control input large-input input-lg col-lg-12 col-md-12 col-sm-12"
                                       placeholder="Enter OTP Code" value="" 
                                       name="emailverificationCode" id="emailverificationCode"/>
                            </div>
                                                            
                            <div class="col-lg-12 col-md-12 col-sm-12  preferredfactor" style="padding-top: 20px; display: none">
                                <div class="row text-left">
                                    <div class="input-switch inline-block text-vertical-align">
                                        <div class="switch">
                                                <input id="p5" class="preferredon switch-toggle switch-toggle-round-flat" name="preferredFactor"
                                                       type="checkbox" value="false"><label for="p5"></label>
                                        </div>
                                    </div>

                                    <span class="f16 text-vertical-align inline-block black-color">Set this factor as default factor for next login</span>
                                </div>
                            </div>

                            <div class="inline-block col  trusteddisplays" display: none">
                                <div class="input-switch inline-block text-vertical-align">
                                        <div class="switch">
                                                <input id="t5" class="trusted switch-toggle switch-toggle-round-flat" name="trustEP" type="checkbox" value="False">
                                                <label for="t5"></label>
                                        </div>
                                </div>
                                <span class="f16 text-vertical-align inline-block black-color">Trust this device</span>                                    
                            </div>
                        </form>
                        <br/>
                        <div class="clearfix">
                            <div class="col-lg-12 col-md-12 col-sm-12 x2">
                                <div class="row">
                                    <input type="button" class="primary-btn orange f20 left login-btn btn-block"
                                           name="Submit" value="Submit" id="emailLoginAuth" />
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
                                
                <div id="backupDeviceDetails" style="display: none">
                    <div class="panel x2">
                        <div class="row text-left" id="deviceDetails">       
                            <%
                                for(int i = 1; i < 10 ; i++) {
                            %>
                            <input type="radio" style="display: none; text-decoration: none;" class="backupChooser" 
                                   name="deviceDetails" id="devices<%=i%>"><span id="devicesText<%=i%>"></span></input></br>
                            <%
                                }
                            %>
                            <a href="#" id="disableBackupFactors">Close</a>
                        </div>		
                    </div>
                </div>

                <div id="backupAndTrusted" style="display: none">
                    <div class="panel x2">
                        <div class="row text-left">                                    
                            <div class="inline-block col text-right">
                                <div class="inline-block text-right">
                                    <div class="text-right">
                                        <a href="javascript:void(0);" name="ChooseBackup" value="ChooseBackup" id="backupFactorsLogin">
                                            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                                            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                                            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                                            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                                            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Backup Authentication</a>
                                    </div>
                                </div>    
                            </div>
                        </div>		
                    </div>
                </div>
		
		<div id="additionalFactor" class="panel x2" style="display: none">
                    <div  >
                            <div id="responseText"></div>
                            <h3 style="color: green">Do you want to enroll additional factor ?</h3>
                            <br/>
                            <br/>
                            <input type="button" class="primary-btn orange" style="margin-right: 20px;" id="enrollAdditionalFactor" value="Enroll"/>
                            <input type="button" class="primary-btn orange" id="done" value="Done"/>
                    </div>
                </div>
                <div id="resetPwd" style="display: none">
                    <div class="panel x2">
                        <h1 class="black-color x1 text-left">Reset Password</h1>
                        <div class="clearfix">
                            <h3 id="resetPwdResponseText" 
                                style="color: green"></h3>
                        </div>
                        <div class="clearfix">
                            <span><h4 style="text-align: left;color: green;">Change your password</h4></span>
                            <input autocomplete="off" type="password" class="form-control input large-input input-lg col-lg-12 col-md-12 col-sm-12" 
                                           placeholder="Old Password" value="" style="margin-top: 5px;"
                                           name="currentPwd" id="currentPwd"/>
                            <input autocomplete="off" type="password" class="form-control input large-input input-lg col-lg-12 col-md-12 col-sm-12" 
                                           placeholder="New Password" value="" style="margin-top: 3px;"
                                           name="newPwd" id="newPwd"/>
                            <input autocomplete="off" type="password" class="form-control input large-input input-lg col-lg-12 col-md-12 col-sm-12" 
                                           placeholder="Confirm Password" value="" style="margin-top: 3px;"
                                           name="confirmPwd" id="confirmPwd"/>
                        </div>
                    </div>
                    <div class="clearfix">
                        <div class="col-lg-12 col-md-12 col-sm-12 x2">
                            <div class="row">
                                    <input type="button" class="primary-btn orange f20 left login-btn btn-block"
                                           name="Submit" value="Submit" id="resetPwdBut" />
                            </div>
                        </div>
                    </div>
		</div>
            </div>
        </div>
    </center>
  </body>
</html>

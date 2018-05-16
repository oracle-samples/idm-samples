/**
 *
 * @author IJ <Indranil Jha>
 */

angular.module('customLoginApp')
    
    .controller('baseController', ['$scope',  'baseFactory', '$http', '$location', '$state', function($scope, baseFactory,$http, $location, $state){
                
        $scope.error = false;
        $scope.uierrormessage = "";
        
        var convertToJSON = function(data) {
            var temp1 = {};
            var pairs = data.split('&');
            pairs.forEach(function(pair) {
                pair = pair.split('=');
                temp1[pair[0]] = pair[1]
            });
            
            temp2 = JSON.stringify(temp1);
            ret = JSON.parse(temp2);
            return ret;
        }
         
        $scope.sessionform = {};
        $scope.isIDP = false;
        $scope.idpList = [];
        
        var addParam = function(myform, value, paramName) {
            param = document.createElement("input");
            param.value = value;
            param.name = paramName;
            myform.appendChild(param);
        }
        
 
        baseFactory.getConfig(function(data) { 
            $scope.idcsconfig = data;
        });
        
        baseFactory.getGlobalToken().get(function(response) {
                $scope.apitoken = response["token"];
                $scope.headers = {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + $scope.apitoken};
            },
            function(response) {
                $scope.message = "Error: "+response.status + " " + response.statusText;
        }); 
        
        
        urlctx = $location.search().ctx;
        
        
        /**
         * Check whether this is a social registration request. Extract social user data and request state.
         */
        
        if(urlctx){
              parsed = decodeURIComponent(atob(urlctx));
              result = convertToJSON(parsed);
              $scope.dosocialreg = (result.dosocialreg === 'true');
              if($scope.dosocialreg){
                  $scope.scimData = JSON.parse(result.scimData);
                  $scope.idpRegRequestState = result.requestState;
              }  
        }
        /**
         * Extract the initial request state for the login flow. Get the list of IDP's if present.
         */
       
        baseFactory.getLoginContext().get(function(response) {
                $scope.loginCtx = JSON.parse(response["ctx"]);

                nextOp = $scope.loginCtx.nextOp;
                nextAuthFactors = $scope.loginCtx.nextAuthFactors;
                $scope.requestState = $scope.loginCtx.requestState;
                if (nextAuthFactors.indexOf("IDP") >= 0){

                      $scope.isIDP = true;
                      $scope.idpList = $scope.loginCtx.IDP.configuredIDPs;
                }
            },
            function(response) {
                $scope.message = "Error: "+response.status + " " + response.statusText;
        }); 
        
       
        /**
         * Standard username-password login flow
         */
        $scope.login = function(){
                
            postdata = {"op":"credSubmit","credentials": {"username": $scope.username,"password": $scope.password}, "requestState": $scope.requestState};
            postreq = {
                method: 'POST',
                url: $scope.idcsconfig.sdkurl,
                headers: $scope.headers,
                data: postdata
            };

            $http(postreq).then(function(postresp) {
                authnToken = postresp.data.authnToken;
                var myform = document.createElement("form");
                myform.method = "POST";
                myform.action = $scope.idcsconfig.sdksessionurl;
                addParam(myform, authnToken, "authnToken");
                document.body.appendChild(myform);

                myform.submit();

            }, function(error){
                err = error.data;
                if(err.cause){
                    if (err.cause[0].code === 'SSO-1005') {
                       console.log("Reset Password - to be implemented");
                    }else{
                        $scope.error = true;
                        $scope.uierrormessage = err.cause[0].code + " : " + err.cause[0].message;
                    }
                }
            });
            
        };
        
        /**
         * Initiate IdP login flow
         */
        $scope.idpLogin = function(idp){ 
            var idpform = document.createElement("form");
            idpform.method = "POST";
            idpform.action = $scope.idcsconfig.sdkidpurl;
            addParam(idpform, $scope.requestState, "requestState");
            addParam(idpform, idp.idpName, "idpName");
            addParam(idpform, "SOCIAL", "idpType");
            addParam(idpform, idp.idpId, "idpId");
            addParam(idpform, $scope.idcsconfig.clientID, "clientId");
            addParam(idpform, false, "rememberAuthnChoice");
            document.body.appendChild(idpform);

            idpform.submit();     
        };
        
        $scope.initSocialRegister = function(){
            $state.go('app.socialregister', {'scimData': $scope.scimData, 'requestState': $scope.idpRegRequestState, 'headers': $scope.headers});
        }   
    }])


   .controller('idpController', ['$scope',  'baseFactory', function($scope, baseFactory){
       
       var addParam = function(myform, value, paramName) {
            param = document.createElement("input");
            param.value = value;
            param.name = paramName;
            myform.appendChild(param);
        }
       
        
        baseFactory.getConfig(function(data) { 
            $scope.idcsconfig = data;
        });
       
       /**
         * IdP login flow after IdP authentication is complete
         */
       
       baseFactory.getCurrentAuthnToken().get(function(response) {
            authnToken = response["authnToken"];;
            var myform = document.createElement("form");
            myform.method = "POST";
            myform.action = $scope.idcsconfig.sdksessionurl;
            addParam(myform, authnToken, "authnToken");
            document.body.appendChild(myform);
            myform.submit();        
        });   
    }])

    .controller('socialregisterController', ['$scope',  'baseFactory', '$stateParams', '$state', '$http', function($scope, baseFactory, $stateParams, $state, $http){
        $scope.socialregisterForm = {};
        $scope.userdata = $stateParams.scimData;
        
        baseFactory.getConfig(function(data) { 
            $scope.idcsconfig = data;
        });
        
        var addParam = function(myform, value, paramName) {
            param = document.createElement("input");
            param.value = value;
            param.name = paramName;
            myform.appendChild(param);
        }
        
        /**
         * Social registration flow
         */
        $scope.register = function(){
             $scope.userdata.userName = $scope.userdata.email;
             postregdata = {"op":"socialregister","socialSCIMAttrs": $scope.userdata, "requestState": $stateParams.requestState, "userMappingAttr": "email"};
             postregreq = {
                    method: 'POST',
                    url: $scope.idcsconfig.sdkurl,
                    headers: $stateParams.headers,
                    data: postregdata
                };

            $http(postregreq).then(function(postregresp) {
                authnToken = postregresp.data.authnToken;
                var myform = document.createElement("form");
                myform.method = "POST";
                myform.action = $scope.idcsconfig.sdksessionurl;
                addParam(myform, authnToken, "authnToken");
                document.body.appendChild(myform);

                myform.submit();

            });
         };
        
        $scope.cancel = function(){
             $scope.socialregisterForm.$setPristine();
             $scope.dosocialreg = false;
        };
        
    }])

;


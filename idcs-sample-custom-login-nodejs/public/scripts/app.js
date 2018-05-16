/**
 *
 * @author IJ <Indranil Jha>
 */

'use strict';

angular.module('customLoginApp', ['ui.router','ngResource', 'ui.bootstrap'])
.directive('ngConfirmClick', [
    function(){
        return {
            restrict: 'A',
            link: function (scope, element, attr) {
                element.bind('click',function (event) {
                    var message = attr.ngConfirmMessage;
                    if (message && confirm(message)) {
                        scope.$apply(attr.ngConfirmClick);
                    }
                });
            }
        };
}])

.directive('equal', function() {

    return {
      require: 'ngModel',
      scope: {
        equal: '='
      },
      link: function(scope, elem, attr, ctrl) {

        ctrl.$validators.equal = function(modelValue, viewValue) {
          return modelValue === scope.equal;
        };

        scope.$watch('equal', function(newVal, oldVal) {
          ctrl.$validate();
        });
      }
    };
  })


.filter('datecheck', ['$filter', function($filter) {
	return function(input, val, property, from) {
		
		var retArray = [];
        if(!val)
            return input; 
        
        var dtst = $filter('date')(val, 'MM-dd-yyyy HH:mm:ss');
        var dt = new Date(dtst);
        
		angular.forEach(input, function(obj){
			var rdtst = obj[property];
            var rdt = new Date(rdtst);
            
            if(from) {
                if( rdt >= dt)
				    retArray.push(obj);			
			}else {
                if( rdt <= dt)
				    retArray.push(obj);	
            }
		}); 
		
		return retArray; 
	};
}])

.config(function($stateProvider, $urlRouterProvider, $locationProvider, $httpProvider) {

        $stateProvider
        
            // Route for the signin page
            .state('app', {
                url:'/',
                views: {
                    'header': {
                        templateUrl : 'views/header.html'
                    },
                    'content': {
                        templateUrl : 'views/home.html',
                        controller  : 'baseController'
                    },
                    'footer': {
                        templateUrl : 'views/footer.html',
                    }
                }

            })
        
            // Route for the signin page
           .state('app.signin', {
                url:'signin',
                views: {
                    'header': {
                        templateUrl : 'views/header.html'
                    },
                    'content': {
                        templateUrl : 'views/home.html',
                        controller  : 'baseController'
                    },
                    'footer': {
                        templateUrl : 'views/footer.html',
                    }
                }

            })
        
            // Placeholder route after IDP login is complete
            .state('app.idpsignin', {
                url:'idpsignin',
                views: {
                    'header@': {template: '<html></html>'},
                    'content@': {
                        controller  : 'idpController'
                    },
                    'footer@': {template: '<html></html>'}
                }
            })
        
            // Social registration page
            .state('app.socialregister', {
                url:'socialregister',
                views: {
                    'content@': {
                        templateUrl : 'views/socialregister.html',
                        controller  : 'socialregisterController'
                    }
                },
                params: {scimData: {}, headers: '', requestState: ''}     
            })
        
            //Error
            .state('app.error', {
                url:'error',
                views: {
                    'content@': {
                        templateUrl : 'views/error.html'
                    }
                }
            });
    
        $urlRouterProvider.otherwise('/');

    })

.run(function($rootScope) {
    
})

;

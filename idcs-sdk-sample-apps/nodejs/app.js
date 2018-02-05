//Import libraries
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var exphbs = require('express-handlebars');
var expressValidator = require('express-validator');
var session = require('express-session');
var passport = require('passport');
var OIDCStrategy = require('passport-idcs').OIDCStrategy;
var IdcsAuthenticationManager = require('passport-idcs').IdcsAuthenticationManager;
var IdcsUserManager = require('passport-idcs').IdcsUserManager;

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
var auth = require('./auth.js');
var config = require('./config.js');

console.log('Using ClientId='+ auth.oracle.ClientId);

//Init app
var app = express();

// View Engine setting
app.set('views', path.join(__dirname, 'views'));
// app.engine('handlebars', exphbs({defaultLayout:'layout'}));
app.engine('handlebars', exphbs({
  defaultLayout: 'publicLayout',
  helpers: {
    toString : function(object) {
      return JSON.stringify(object, null, 2);
    },
    ifequals: function(obj1, obj2, options) {
      if(obj1==obj2) {
        return options.fn(this);
      } else {
        return options.inverse(this);
      }
    }
  }
}));

app.set('view engine', 'handlebars');

//BodyParser middleware setting
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

//Public folder for static content.
app.use(express.static(path.join(__dirname, 'public')));

//Express Session setting
app.use(session({
    secret: 'sample_application',
    saveUninitialized: true,
    resave: true
}));

// serialize and deserialize
passport.serializeUser(function(user, done) {
  done(null, user);
});
passport.deserializeUser(function(obj, done) {
  done(null, obj);
});

passport.use(new OIDCStrategy(auth.oracle,
  (idToken, tenant, user, done) => {
    // console.log('verify', user);
    done(null, user);
  }));


//Express Validator setting
app.use(expressValidator({
  errorFormatter: function(param, msg, value) {
      var namespace = param.split('.')
      , root    = namespace.shift()
      , formParam = root;

    while(namespace.length) {
      formParam += '[' + namespace.shift() + ']';
    }
    return {
      param : formParam,
      msg   : msg,
      value : value
    };
  }
}));

//Global variables
app.use(function (req, res, next) {
  res.locals.user = req.user || null;
  next();
});

//Passport initialization
app.use(passport.initialize());
app.use(passport.session());

//-------------
//Routes section
//Public acess
app.get('/', function(req, res){
	res.render('index', {title: 'Index'});
  });
app.get('/login', function(req, res){
	res.render('login', {title: 'Login'});
  });
app.get('/about', function(req, res){
	res.render('about', {title: 'About'});
  });
app.get('/fail', function(req, res){
	res.render('fail', {title: 'Fail'});
  });
app.get('/logout', function(req, res){
  req.logout();
  res.clearCookie();
   res.redirect(auth.oracle.IDCSHost + auth.oracle.logoutSufix);
  //res.redirect("/");
  });

//Add the handler of the /auth/oracle route here (section 3, step 3)

//Add the handler of the /callback route here (section 3, step 4)

//Add the handler of the /auth route here (section 3, step 6)

//Add the handler of the /home, /appDetails and /userInfo routes here (section 3, step 7)

//Add the handler of the /myProfile route here (section 3, step 9)

// Set Port
app.set('port', (process.env.PORT || config.APP_DEFAULT_PORT));
app.listen(app.get('port'), function(){
	console.log('Server started on port '+app.get('port'));
});

function ensureAuthenticated(req, res, next) {
  console.log('\nensureAuthenticated req.user='+ JSON.stringify(req.user));
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login')
}
module.exports = app;

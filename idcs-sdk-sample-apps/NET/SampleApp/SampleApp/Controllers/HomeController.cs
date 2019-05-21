using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;
using System.Web.Security;
using IDCSClient;
using SampleApp.Models;

namespace SampleApp.Controllers
{
    [AllowAnonymous]
    public class HomeController : Controller
    {
        
        public ActionResult Index()
        {
            System.Diagnostics.Debug.Print("Debug ActionResult Index");
            ViewBag.Title = "Index";
            return View();
        }

        public ActionResult About()
        {
            System.Diagnostics.Debug.Print("Debug ActionResult About");
            ViewBag.Title = "About";
            ViewBag.Message = "This Sample application was created to help you working with Oracle Identity Cloud Service SDK.";
            return View();
        }

        public ActionResult Login()
        {
            System.Diagnostics.Debug.Print("Debug ActionResult Login");
            ViewBag.Title = "Login";
            return View();
        }

        /**
         * This method uses the SDK to generate the authorization code URL, and redirects the browser to the generated URL.
         * @Copyright Oracle
         */
        public ActionResult Oracle()
        {
            System.Diagnostics.Debug.Print("Debug ActionResult Oracle");
            System.Collections.Generic.Dictionary<String, String> options = new ConnectionOptions().GetOptions();
            //Authentication Manager loaded with the configurations.
            IDCSClient.AuthenticationManager am = new IDCSClient.AuthenticationManager(options);
            //Generating the authorization URL.
            String authzURL = am.getAuthorizationCodeUrl(options["redirectURL"], options["scope"], "1234", "code");
            //Redirecting to the authorization URL.
            return Redirect(authzURL);
        }

        /**
        * This method uses the authorization code parameter to request an access token. 
        * The access token is then stored in the user session, along with other information of the signed in user. 
        * Then, the method forwards the request to the Home page.
        * @Copyright Oracle
        */
        public ActionResult Callback(String code)
        {
            System.Diagnostics.Debug.Print("Debug ActionResult Callback");

            if (code == null)
            {
                return RedirectToAction("Login", "Home");
            }
            else { 
                ViewBag.Title = "Callback";
            
                //Authentication Manager loaded with the configurations.
                IDCSClient.AuthenticationManager am = new IDCSClient.AuthenticationManager(new ConnectionOptions().GetOptions());

                //Using the Authentication Manager to exchange the Authorization Code to an Access Token.
                IDCSClient.AuthenticationResult authResult = am.authorizationCode(code);
            
                //Getting the Access Token object and its String value.
                String accessTokenString = authResult.getAccessToken();
                //Getting the ID Token object and its String value.
                String idTokenString = authResult.getIdToken();

                //Converting both ID and access tokens from string to corresponding objects.
                AccessToken accessToken = am.verifyAccessToken(accessTokenString);
                IdToken idToken = am.verifyIdToken(idTokenString);

                //Storing token objects into the HTTP Session.
                Session["accessToken"] = accessToken;
                Session["idToken"] = idToken;

                //Setting .NET framework authentication           
                String id = idToken.GetUserId();
                FormsAuthentication.SetAuthCookie(id, false);

                //Redirecting the browser to the Home page.
                return RedirectToAction("Home", "Private");
            }
        }


    }
}
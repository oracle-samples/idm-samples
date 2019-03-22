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
    //[Authorize]
    public class PrivateController : Controller
    {
        // GET: Private/Home
        public ActionResult Home()
        {
            if (Session["idToken"] == null)
            {
                return RedirectToAction("Login", "Home");
            }
            else {
                ViewBag.Title = "Home";
                //Accessing the tokens from the session.
                IdToken idToken = (IdToken)Session["idToken"];
                //Providing user information to the page.
                var user = new User() { DisplayName = idToken.GetDisplayName() };
                return View(user);
            }
        }

        // GET: Private/MyProfile
        public ActionResult MyProfile()
        {
            if (Session["idToken"] == null)
            {
                return RedirectToAction("Login", "Home");
            }
            else
            {
                ViewBag.Title = "My Profile";
                //Accessing the tokens from the session.
                IdToken idToken = (IdToken)Session["idToken"];
                //Providing user information to the page.
                var user = new User()
                {
                    DisplayName = idToken.GetDisplayName(),
                    IdDomain = idToken.GetIdentityDomain(),
                    UserID = idToken.GetUserId(),
                    Issuer = idToken.getIssuer(),
                    Token = idToken.getToken()
                };
                return View(user);
            }
        }

        /**
        * This method logs the user out from the application and then redirects the user to Oracle Identity 
        * Cloud Service log out URL.
        * @author felippe.oliveira@oracle.com
        * @Copyright Oracle
        */
        public ActionResult Logout()
        {
            if (Session["idToken"] == null)
            {
                return RedirectToAction("Login", "Home");
            }
            else
            {
                IdToken idToken = (IdToken)Session["idToken"];
                Session.RemoveAll();
                Request.Cookies.Clear();
                Response.Cookies.Clear();
                FormsAuthentication.SignOut();
                System.Collections.Generic.Dictionary<String, String> options = new ConnectionOptions().GetOptions();
                return Redirect(options["BaseUrl"] + options["logoutSufix"] + "?post_logout_redirect_uri=http%3A//localhost%3A3001&id_token_hint=" + idToken.getToken());
            }
        }

    }
}
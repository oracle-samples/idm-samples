//
//  LoginViewController.swift
//  IDCSSample
//
//  Created by Shivaprasad on 4/27/18.
//  Copyright © 2018 Oracle. All rights reserved.
//

import UIKit
import IDMMobileSDKv2
import SafariServices

let NotificationForSafriViewClose = Notification.Name("CloseSafariViewControllerNotification")

class LoginViewController: UIViewController ,OMMobileSecurityServiceDelegate,UserLogoutCallback,SFSafariViewControllerDelegate, EmbeddedLoginControllerDelegate{
  
    
    
    @IBOutlet weak var productLabel: UILabel!
    @IBOutlet weak var loadingIndicator: UIActivityIndicatorView!
    
    @IBOutlet weak var overlayView: UIView!
    @IBOutlet weak var signInButton: UIButton!
    @IBOutlet weak var iconImageView: UIImageView!
    var embeddedViewController: EmbeddedLoginViewController!
    
    
    var mss: OMMobileSecurityService? = nil;
    var currentContext: OMAuthenticationContext? = nil;
    var currentChallenge: OMAuthenticationChallenge? = nil;
    var mssConfig : NSMutableDictionary? = [:]
    var safariViewController : SFSafariViewController? = nil
    var logoutStarted : Bool = false;
    
    override func viewDidLoad() {
        super.viewDidLoad()
        // Do any additional setup after loading the view, typically from a nib.
        self.navigationController?.isNavigationBarHidden = true
        NotificationCenter.default.addObserver(self, selector: #selector(self.didCloseSafriView), name: NotificationForSafriViewClose, object: nil)
        
        //This mesthod initalises the config parms to IDCS login
        let setUpDone = self.setupMSS()
        let dict = self.mssConfig as! [String: AnyObject];
        
        if setUpDone && (ComparisonResult.orderedSame != (dict[OM_PROP_BROWSERMODE]as! String).caseInsensitiveCompare(OM_PROP_BROWSERMODE_EXTERNAL))
        {
            self.signInButton.isHidden = true;
            self.loadingIndicator.startAnimating()
            self.loginDone([])
        }
    }

    override func didReceiveMemoryWarning() {
        super.didReceiveMemoryWarning()
        // Dispose of any resources that can be recreated.
    }

    func setupMSS() -> Bool {
        
        let config:NSMutableDictionary? = [:]
        config![OM_PROP_AUTHSERVER_TYPE] = OM_PROP_OPENID_CONNECT_SERVER
        config![OM_PROP_OAUTH_AUTHORIZATION_GRANT_TYPE] = OM_OAUTH_AUTHORIZATION_CODE
        config![OM_PROP_APPNAME] = "IDCSSample"
        config![OM_PROP_OAUTH_SCOPE] = Set(arrayLiteral: "openid", "urn:opc:idm:t.user.me")
        
		//To use this sample app you need to modify the below parms
        // OM_PROP_OPENID_CONNECT_CONFIGURATION_URL: The IDCS configuration URL endpoint
        // OM_PROP_OAUTH_CLIENT_ID : Client Id of the App created in IDCS console
        // OM_PROP_OAUTH_REDIRECT_ENDPOINT : Redrect URL given during App creation
        config![OM_PROP_OPENID_CONNECT_CONFIGURATION_URL] = "https://MYTENANT.identity.oraclecloud.com/.well-known/idcs-configuration"
        config![OM_PROP_OAUTH_CLIENT_ID] = "SDK_MOBILE_APP_CLIENT_ID"
        config![OM_PROP_OAUTH_REDIRECT_ENDPOINT] = "idcsmobileapp://nodata"

        //To enable External browser flow use OM_PROP_BROWSERMODE_EXTERNAL as value to key OM_PROP_BROWSERMODE
        //config![OM_PROP_BROWSERMODE] =  OM_PROP_BROWSERMODE_EXTERNAL
        //config![OM_PROP_BROWSERMODE] =  OM_PROP_BROWSERMODE_EMBEDDED
        config![OM_PROP_BROWSERMODE] =  OM_PROP_BROWSERMODE_EMBEDDED_SAFARI

        var configError : NSError? = nil
        
        do {
            self.mssConfig = config
            try  self.mss = OMMobileSecurityService.init(properties: config as! [String: Any], delegate: self as OMMobileSecurityServiceDelegate)
        }
        catch let error as NSError {
            configError = error
            print(error)
            let alert = UIAlertController(title: "Config Error", message:"Invalid Configuration" , preferredStyle: UIAlertControllerStyle.alert)
            alert.addAction(UIAlertAction(title: "OK", style: .default, handler:nil))
            self.present(alert, animated: true, completion: nil)
        }
       
        return (configError == nil) ? true : false
    }

     @objc func didCloseSafriView() -> Void
    {
        print("didCloseSafriView")
        self.signInButton.isHidden = true;
        self.loadingIndicator.startAnimating()
        
        if self.safariViewController != nil && !self.logoutStarted{
            
            self.safariViewController?.dismiss(animated: true, completion: {
                self.safariViewController = nil
            })
        }
        let url = UserDefaults.standard.url(forKey: "url")
        var dictionary = self.currentChallenge?.authData
        dictionary!["frontChannelResponse"] = url 
        self.currentChallenge?.authChallengeHandler(dictionary,UInt(OMProceed))
    }
    
    // MARK: Login and Logout Methods related Methods

    @IBAction func loginDone(_ sender: Any) {
        
        if (self.mss != nil) {
            
            _ = self.mss?.setup() as Error?
           // print(error as! Error)

        }
        
    }
    
    // MARK: UserLogoutCallback related Methods
    
    func didSelectLogout() {
        //
        self.logoutStarted = true;
        self.mss?.logout(true)
    }

    // MARK: OMMobileSecurityServiceDelegate Methods
    
    //This method is called once configuration downloads are completed
    func mobileSecurityService(_ mss: OMMobileSecurityService!, completedSetupWith configuration: OMMobileSecurityConfiguration!, error: Error!)
    {
        if error != nil {
            
            let alert = UIAlertController(title: "Setup Failed", message:self.errorMessageForError(error: (error as! NSError)) , preferredStyle: UIAlertControllerStyle.alert)
            alert.addAction(UIAlertAction(title: "OK", style: .default, handler:nil))
            self.present(alert, animated: true, completion: nil)

        }
        else
        {
            let error =  self.mss?.startAuthenticationProcess(nil)
            
            if error != nil {
                
                print("error = \(String(describing: error))")
                
            }

        }
    }
    
    //This method is will get called many times based on input required
    func mobileSecurityService(_ mss: OMMobileSecurityService!, didReceive challenge: OMAuthenticationChallenge!) {
        
        var dictionary = challenge.authData
       self.currentChallenge = challenge
        //Challenge for untrusted server cert
        if (challenge.challengeType == OMChallengeServerTrust)
        {
            self.currentChallenge?.authChallengeHandler(dictionary,UInt(OMCancel))
        }
            //Challenge for OMChallengeExternalBrowser to load frontChannelURL
        else if (challenge.challengeType == OMChallengeExternalBrowser)
        {
            let url = dictionary!["frontChannelURL"]
            if (UIApplication.shared.canOpenURL(url as! URL))
            {
                UIApplication.shared.open(url as! URL, options: [:], completionHandler: nil);
            }
        }             //Challenge for OMChallengeEmbeddedSafari to load frontChannelURL
        else if(challenge.challengeType == OMChallengeEmbeddedSafari)
        {
            let url = dictionary!["frontChannelURL"] as! URL
            
            if (url.scheme == "http" ||
                url.scheme == "https"){
                self.launchSFSafri(url: (url as! URL));
            }
            else
            {
                //Add alert
                self.currentChallenge?.authChallengeHandler(nil,UInt(OMCancel))
                let alert = UIAlertController(title: "Alert", message: "Unsupported URL", preferredStyle: UIAlertControllerStyle.alert)
                alert.addAction(UIAlertAction(title: "OK", style: .default, handler:nil))
                self.present(alert, animated: true, completion: nil)
            }
        }
        else if (challenge.challengeType == OMChallengeEmbeddedBrowser)
        {
            self.loadEmbededViewController()
        }


    }
    
    //This method is will get called after authentication completed if error obj is there it means Authentication is failed otherwise it contains OMAuthenticationContext object
    func mobileSecurityService(_ mss: OMMobileSecurityService!, didFinishAuthentication context: OMAuthenticationContext!, error: Error!) {
        self.currentChallenge = nil;

        if error != nil {
            self.signInButton.isHidden = false;
            self.loadingIndicator.stopAnimating()
            let alert = UIAlertController(title: "Alert", message:self.errorMessageForError(error: (error as! NSError)) , preferredStyle: UIAlertControllerStyle.alert)
            alert.addAction(UIAlertAction(title: "OK", style: .default, handler:nil))
            self.present(alert, animated: true, completion: nil)

        }
        else
        {
            print("sucesses \(context)")
            
            if(self.mssConfig![OM_PROP_BROWSERMODE] as? String == OM_PROP_BROWSERMODE_EMBEDDED as String){
                
                self.embeddedViewController.dismiss(animated: false, completion:{
                    self.embeddedViewController = nil;
                })
            }
            
            NetworkManager.shared().setBaseUrl(baseUrl: self.getCurrentInstanceBaseUrl())
            self.loadingIndicator.stopAnimating()
          let userDashBordViewController =  UserDashboardViewController.init(nibName: "UserDashboardViewController", bundle: Bundle.main)
            userDashBordViewController.context = context;
            userDashBordViewController.delegate = self;
            self.navigationController?.pushViewController(userDashBordViewController, animated: true)
        }
    }
    
    //This method is will get called many times based on input for doing logout
    func mobileSecurityService(_ mss: OMMobileSecurityService!, didReceiveLogoutAuthenticationChallenge challenge: OMAuthenticationChallenge!)
    {
        var dictionary = challenge.authData
        self.currentChallenge = challenge

        if (challenge.challengeType == OMChallengeExternalBrowser)
        {
            let url = dictionary![OM_PROP_LOGOUT_URL]
            
            if (UIApplication.shared.canOpenURL(url as! URL))
            {
                UIApplication.shared.open(url as! URL, options: [:], completionHandler: nil);
            }
        }
        else if (challenge.challengeType == OMChallengeEmbeddedSafari)
        {
            let url = dictionary![OM_PROP_LOGOUT_URL]
            self.launchSFSafri(url: (url as! URL));
        }
        else if (challenge.challengeType == OMChallengeEmbeddedBrowser)
        {
            self.loadEmbededViewController()
        }
    }
    
    
    //This method is will get called after logout completed if error obj is there it means logout is failed otherwise it suesses

    func mobileSecurityService(_ mss: OMMobileSecurityService!, didFinishLogout error: Error!) {
        self.signInButton.isHidden = false;
        self.logoutStarted = false;
        self.currentChallenge = nil;
        if error == nil && (self.mssConfig![OM_PROP_BROWSERMODE] as! String) != OM_PROP_BROWSERMODE_EXTERNAL{
    
            self.perform(#selector(loginDone(_:)), with: [], afterDelay:1);
        }
        else
        {
            self.loadingIndicator.stopAnimating()
        }
        print("logout sucesses with error \(error)")

    }
    
    func getCurrentInstanceBaseUrl()->URL
    {
        let urlStr =  (self.mssConfig![OM_PROP_OPENID_CONNECT_CONFIGURATION_URL] != nil) ? self.mssConfig![OM_PROP_OPENID_CONNECT_CONFIGURATION_URL] :
            self.mssConfig![OM_PROP_AUTHORIZATION_ENDPOINT]

        let loginUrl = URL(string : urlStr as! String)!

        var baseUrlStr : String = String(loginUrl.scheme!) + String("://") + String(loginUrl.host!)
        
        if let port = loginUrl.port
        {
            baseUrlStr = baseUrlStr + String(describing: port)
        }

        return URL(string : baseUrlStr )!
    }

    
    // MARK: SFSafariViewController related Methods

    func launchSFSafri(url :URL)  {
        
        var loadViewAnimated = true
        
        if self.safariViewController != nil{

            loadViewAnimated = false;
            self.overlayView.isHidden = false;
            self.safariViewController?.dismiss(animated: loadViewAnimated, completion: {
                self.safariViewController = nil
            })
        }
        
        let safriVc = SFSafariViewController.init(url: url, entersReaderIfAvailable: false)
            safriVc.delegate = self as? SFSafariViewControllerDelegate
            self.present(safriVc, animated: loadViewAnimated, completion:{() -> Void in
                self.overlayView.isHidden = true;
                var frame = safriVc.view.frame
                frame.size = CGSize(width: frame.width, height: frame.height + 44.0)
                safriVc.view.frame = frame
                self.safariViewController = safriVc
                
            } )


        
    }
    
    func loadEmbededViewController()  {
    
        var dictionary = self.currentChallenge?.authData

        if self.embeddedViewController == nil {
            
            let viewController = EmbeddedLoginViewController.init(nibName: "EmbeddedLoginViewController", bundle: Bundle.main)
            viewController.delegate = self;
            let navcontroller = UINavigationController.init(rootViewController: viewController)
            self.present(navcontroller, animated: false, completion:{
                
                
                if let webView = viewController.webView{
                    
                    dictionary![OM_PROP_AUTH_WEBVIEW] = webView
                    self.currentChallenge?.authChallengeHandler(dictionary,UInt(OMProceed))
                }
                else
                {
                    self.currentChallenge?.authChallengeHandler(dictionary,UInt(OMCancel))
                }
                
                
            })
            self.embeddedViewController = viewController
        }
        else
        {
            if let webView = self.embeddedViewController.webView{
                
                dictionary![OM_PROP_AUTH_WEBVIEW] = webView
                self.currentChallenge?.authChallengeHandler(dictionary,UInt(OMProceed))
            }
            else
            {
                self.currentChallenge?.authChallengeHandler(dictionary,UInt(OMCancel))
            }

        }
    }
    
    func safariViewControllerDidFinish(_ controller: SFSafariViewController) {
        
        let dictionary = self.currentChallenge?.authData
        self.currentChallenge?.authChallengeHandler(dictionary,UInt(OMCancel))

        print("safariViewControllerDidFinish")
    }
    
    func safariViewController(_ controller: SFSafariViewController, didCompleteInitialLoad didLoadSuccessfully: Bool) {
        print("didCompleteInitialLoad")

    }
    
    func safariViewController(_ controller: SFSafariViewController, initialLoadDidRedirectTo URL: URL) {
        print("initialLoadDidRedirectTo")

    }
    
    func safariViewController(_ controller: SFSafariViewController, excludedActivityTypesFor URL: URL, title: String?) -> [UIActivityType] {
       
        print("excludedActivityTypesFor")

        return []
    }
    
    func errorMessageForError(error : NSError) -> String {
        
        var errorMessage = "Unknow Error"
        
        switch (error.code as Int){
        case Int(OMERR_USER_CANCELED_AUTHENTICATION):
            errorMessage = "User Canceled Authentication"
        default:
            errorMessage = error.localizedDescription
        }
        
        return errorMessage
    }
    
    func didSelectCancel() {
        self.embeddedViewController = nil;
        let dictionary = self.currentChallenge?.authData
        self.currentChallenge?.authChallengeHandler(dictionary,UInt(OMCancel))

    }

    
}



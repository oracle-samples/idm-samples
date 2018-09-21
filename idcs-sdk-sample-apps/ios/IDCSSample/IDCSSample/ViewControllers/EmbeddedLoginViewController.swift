//
//  EmbeddedLoginViewController.swift
//  IDCSSample
//
//  Created by Shivaprasad on 7/18/18.
//  Copyright © 2018 Oracle. All rights reserved.
//

import UIKit
import IDMMobileSDKv2

protocol EmbeddedLoginControllerDelegate {
    
    func didSelectCancel()
}

class EmbeddedLoginViewController: UIViewController,UIWebViewDelegate {

    @IBOutlet weak var webView: UIWebView!
    weak var delegate : LoginViewController?

    override func viewDidLoad() {
        super.viewDidLoad()

        self.navigationItem.leftBarButtonItem = UIBarButtonItem.init(barButtonSystemItem: .cancel, target: self, action: #selector(canelDone))
    }

    override func didReceiveMemoryWarning() {
        super.didReceiveMemoryWarning()
        // Dispose of any resources that can be recreated.
    }
    
    @objc func canelDone(sender : Any) ->Void{
        
        self.dismiss(animated: true) {
            if  let method = self.delegate?.didSelectCancel {
                method()
            }

        }

    }

    /*
    // MARK: - Navigation

    // In a storyboard-based application, you will often want to do a little preparation before navigation
    override func prepare(for segue: UIStoryboardSegue, sender: Any?) {
        // Get the new view controller using segue.destinationViewController.
        // Pass the selected object to the new view controller.
    }
    */

    func webView(_ webView: UIWebView, shouldStartLoadWith request: URLRequest, navigationType: UIWebViewNavigationType) -> Bool {
        
        let uri = self.delegate?.mssConfig![OM_PROP_OAUTH_REDIRECT_ENDPOINT]
        let url = URL.init(string: uri as! String)
        
        if request.url?.scheme == url?.scheme {
            return false;
        }
        
        return true;
    }
}

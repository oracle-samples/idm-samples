//
//  App.swift
//  IDCSSample
//
//  Created by Shivaprasad on 5/4/18.
//  Copyright © 2018 Oracle. All rights reserved.
//

import UIKit

struct MyAppsConstants {
    static let appDisplayName = "display";
    static let appIcon = "appIcon";
    static let appInfo = "app";
    static let appDescription = "description"
}
class App: NSObject {

    var appName : String?
    var appDescription : String?
    var appLogo : Any?
    
     init(with info:Dictionary<String, Any>) {
        
        let appInfo = info[MyAppsConstants.appInfo] as! Dictionary<String,Any>
        self.appName = appInfo[MyAppsConstants.appDisplayName] as? String
        self.appLogo = appInfo[MyAppsConstants.appIcon]
        self.appDescription = appInfo[MyAppsConstants.appDescription] as? String

    }
}

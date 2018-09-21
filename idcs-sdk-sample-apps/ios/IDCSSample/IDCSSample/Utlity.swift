//
//  Utlity.swift
//  IDCSSample
//
//  Created by Shivaprasad on 5/13/18.
//  Copyright © 2018 Oracle. All rights reserved.
//

import UIKit

class Utlity: NSObject {

  class func getProfilePicName(forUser userName:String) -> String {
        
        let substr = userName.split(separator: " ") as Array<Any>
        var profileName : String? = nil
        
        if substr.count > 1 {
            
            let firstName = substr.first as! Substring
            let lastName = substr.last as! Substring
            profileName = String(firstName.prefix(1)).uppercased() + String(lastName.prefix(1)).uppercased()
        }
        else
        {
            let name = String(substr.first  as! Substring)
            profileName = String(name.prefix(2)).uppercased()
        }
        return profileName!
    }

}

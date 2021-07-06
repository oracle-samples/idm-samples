//  AppDelegate.swift
//  IDCSSample
//  Copyright (c) 2000, 2021, Oracle and/or its affiliates.
//
//   Licensed under the Universal Permissive License v 1.0 as shown at
//   http://oss.oracle.com/licenses/upl.

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

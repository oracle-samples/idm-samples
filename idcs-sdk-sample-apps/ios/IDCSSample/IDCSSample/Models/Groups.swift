//
//  Groups.swift
//  IDCSSample
//
//  Created by Shivaprasad on 5/7/18.
//  Copyright © 2018 Oracle. All rights reserved.
//

import UIKit

struct MyGroupsModelConstants {
    static let groupDisplayName = "displayName";
    static let groupID = "id";
    static let groupDescription = "description";
    static let groupExtension = "urn:ietf:params:scim:schemas:oracle:idcs:extension:group:Group";
}

class Groups: NSObject {

    var groupName : String?
    var groupID : String?
    var groupDescription : String?

    init(with info:Dictionary<String, Any>) {
        
        self.groupName = info[MyGroupsModelConstants.groupDisplayName] as? String
        self.groupID = info[MyGroupsModelConstants.groupID] as? String
        
        if let groupExtension : Dictionary<String, Any> = info[MyGroupsModelConstants.groupExtension] as? Dictionary<String, Any> {
            
             self.groupDescription = groupExtension[MyGroupsModelConstants.groupDescription] as? String
        }
        
       

    }

}

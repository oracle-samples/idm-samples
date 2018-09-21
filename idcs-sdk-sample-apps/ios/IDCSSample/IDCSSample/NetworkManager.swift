//
//  NetworkManager.swift
//  IDCSSample
//
//  Created by Shivaprasad on 5/2/18.
//  Copyright © 2018 Oracle. All rights reserved.
//

import UIKit
import IDMMobileSDKv2

typealias CompletionHandler = (_ responce:Any?, _ error:Error?) -> Void

class NetworkManager: NSObject {

    private var context : OMAuthenticationContext? = nil
    private var baseUrl : URL? = nil

    private static var sharedNetworkManager: NetworkManager = {

        let networkManager = NetworkManager()
        return networkManager
    }()
    
    private override init()
    {
    }
    
    class func shared() -> NetworkManager {
        return sharedNetworkManager
    }
    
    func currentAuthContext(context : OMAuthenticationContext?) -> Void {
        self.context = context
    }
    
    func setBaseUrl(baseUrl : URL?) -> Void {
        self.baseUrl = baseUrl
    }

    func url(withPath path:String) -> URL {
        
        let url2 = NSURL(fileURLWithPath:path, relativeTo:self.baseUrl)
        return  url2 as URL
    }
    
    func getMyApps(completionHandler :@escaping CompletionHandler) -> Void
    {
        let headders: NSMutableDictionary? = [:]
        let token =   self.context?.tokens.firstObject as! OMToken
    
        headders!["Authorization"] = "Bearer " + (token.tokenValue)!
        
        getDataFormUrl(url: self.url(withPath: "admin/v1/MyApps"), headders: headders as? [String : Any]) { (data, error) in
            
            if error != nil {
                
                completionHandler(nil,error!);
            }
            else
            {
                let json = try? JSONSerialization.jsonObject(with: data as! Data , options: [.allowFragments]) as! Dictionary <String,Any>
                
                let appList : Array<Any> = json!["Resources"] as! Array<Any>
                
                let appObjList : NSMutableArray =  []
                
                for appInfo in appList{
                    
                    let appObj = App.init(with: appInfo as! Dictionary<String, Any>)
                    appObjList.add(appObj)
                }
                
                completionHandler(appObjList ,nil)

            }

        }
    }
 
    func getMyInfo(completionHandler :@escaping CompletionHandler) -> Void {
        
        getDataFormUrl(url: self.url(withPath: "admin/v1/Me"), headders: self.getBaicHeadders() as? [String : Any]) { (data, error) in
            
            if error != nil {
                
                completionHandler(nil,error!);
            }
            else
            {
                let json = try? JSONSerialization.jsonObject(with: data as! Data , options: [.allowFragments]) as! Dictionary <String,Any>
                
                let emailList : Array<Any> = json!["emails"] as! Array<Any>
                
                completionHandler(emailList ,nil)
                
            }
            
        }
        
    }

    
    
    func getMyGroups(completionHandler :@escaping CompletionHandler) -> Void
    {
        
        let headders: NSMutableDictionary? = [:]
        let token =   self.context?.tokens.firstObject as! OMToken
        
        headders!["Authorization"] = "Bearer " + (token.tokenValue)!
        
//        self.url(withPath: "admin/v1/MyGroups?count=48&startIndex=1&sortBy=displayName&sortOrder=ascending&attributes=id%2CdisplayName")
        getDataFormUrl(url: self.url(withPath: "admin/v1/MyGroups"), headders: headders as? [String : Any]) { (data, error) in
            
            if error != nil {
                
                completionHandler(nil,error!);
            }
            else
            {
                let json = try? JSONSerialization.jsonObject(with: data as! Data , options: [.allowFragments]) as! Dictionary <String,Any>
                
                let groupList : Array<Any> = json!["Resources"] as! Array<Any>
                
                let groupObjList : NSMutableArray =  []
                
                for groupInfo in groupList{
                    let groupObj = Groups.init(with: groupInfo as! Dictionary<String, Any>)
                    groupObjList.add(groupObj)
                }
                
                completionHandler(groupObjList ,nil)
                
            }
            
        }

    }

    func getDataFormUrl(url : URL , headders headder:[String : Any]?, completionHandler :@escaping CompletionHandler) ->  Void
    {
        let currentsession = URLSession.init(configuration: URLSessionConfiguration.default, delegate: nil, delegateQueue: OperationQueue.main)
        

        let request = NSMutableURLRequest.init(url: url, cachePolicy: URLRequest.CachePolicy.useProtocolCachePolicy, timeoutInterval: 30)
        
        request.allHTTPHeaderFields = headder as? [String : String]
        request.httpMethod = "GET"

        let task = currentsession.dataTask(with: request as URLRequest, completionHandler:{ (data, response, error) in
            
            if error != nil{
                
                completionHandler(nil,error!);
            }
            else if (response as! HTTPURLResponse).statusCode == 200
            {
                completionHandler(data,nil)
            }
            else
            {
                let error = NSError.init(domain:"IDCS Error", code: (response as! HTTPURLResponse).statusCode, userInfo: [ : ])
                completionHandler(data, error)
            }
            
        })
        
        task.resume()
    }
    
    func getBaicHeadders() -> NSMutableDictionary {
        
        let headders: NSMutableDictionary? = [:]
        let token =   self.context?.tokens.firstObject as! OMToken
        
        headders!["Authorization"] = "Bearer " + (token.tokenValue)!

        return headders!
    }
}

//
//  UserDashboardViewController.swift
//  IDCSSample
//
//  Created by Shivaprasad on 5/2/18.
//  Copyright © 2018 Oracle. All rights reserved.
//

import UIKit
import IDMMobileSDKv2

extension UIView {
    func makeCircular() {
        self.layer.cornerRadius = min(self.frame.size.height, self.frame.size.width) / 2.0
        self.clipsToBounds = true
    }
}

extension UIImage {
    
    class func base64Convert(base64String: String?) -> UIImage{
        
        guard let base64ImageString = base64String, base64ImageString != nil else {
            
            print("Image is empty")
            return #imageLiteral(resourceName: "logo-Image")
        }
        // !!! Separation part is optional, depends on your Base64String !!!
        let temp = base64String?.components(separatedBy: ",")
        let dataDecoded : Data = Data(base64Encoded: temp![1], options: .ignoreUnknownCharacters)!
        let decodedimage = UIImage(data: dataDecoded)
        return decodedimage!
    }
}
protocol UserLogoutCallback{
    
    func didSelectLogout()
}

class UserDashboardViewController: UIViewController,UITableViewDelegate,UITableViewDataSource {

    @IBOutlet weak var profileName: UILabel!
    var context : OMAuthenticationContext? = nil
    @IBOutlet weak var userName: UILabel!
    var groupDataSource: NSMutableArray? = []
    @IBOutlet weak var emailID: UILabel!
    var myAppsDataSource: NSMutableArray? = []
    var delegate:UserLogoutCallback? = nil
    @IBOutlet weak var myappSegment: UISegmentedControl!
    
    @IBOutlet weak var loadingIndicator: UIActivityIndicatorView!
    @IBOutlet weak var tableView: UITableView!
    override func viewDidLoad() {
        super.viewDidLoad()

        self.tableView.register(UINib(nibName: "MyAppTableViewCell", bundle: nil), forCellReuseIdentifier: "MyApps")
        self.tableView.register(UINib(nibName: "MyGroupTableViewCell", bundle: nil), forCellReuseIdentifier: "MyGroups")
        
        self.userName.text = self.context?.userInfo["user_displayname"] as? String
        self.profileName.text =  Utlity.getProfilePicName(forUser: self.userName.text!)
        self.emailID.text =  self.context?.userInfo["sub"] as? String
        
        self.profileName.makeCircular()
        
        //Performs Network call to server to fetch the apps, group and User profile data
        self.startNetworkActivity()

    }

    
    override func didReceiveMemoryWarning() {
        super.didReceiveMemoryWarning()
        // Dispose of any resources that can be recreated.
    }
    
    func startNetworkActivity()  {
        
        self.loadingIndicator.startAnimating()
        
        NetworkManager.shared().currentAuthContext(context: self.context!)
        NetworkManager.shared().getMyApps { (data, error) in

            print(data!)

            if error == nil
            {
                self.myAppsDataSource = data as? NSMutableArray
                self.tableView.reloadData()
                self.loadingIndicator.stopAnimating()
            }
        }
        
        NetworkManager.shared().getMyGroups{ (data, error) in
            
            print(data!)
            if error == nil
            {
                self.groupDataSource = data as? NSMutableArray
            }
            
        }
        
        NetworkManager.shared().getMyInfo { (info, error) in
            print(info!)
            
            if error == nil
            {
                let infoObjList : Array = info as! Array<Any>
                
                if  infoObjList.isEmpty == false{
                    let infoDict : Dictionary<String,Any> = infoObjList[0] as! Dictionary
                    self.emailID.text = infoDict["value"] as? String
                }
            }
            
        }

    }

    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {

        if myappSegment.selectedSegmentIndex == 0{
            return self.myAppsDataSource!.count
        }
        else
        {
            return self.groupDataSource!.count
        }
    }
    
    func tableView(_ tableView: UITableView, heightForRowAt indexPath: IndexPath) -> CGFloat {
        return 80.0
    }
    
    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        
        if myappSegment.selectedSegmentIndex == 0{
            let cell = tableView.dequeueReusableCell(withIdentifier: "MyApps") as! MyAppTableViewCell

            let app = self.myAppsDataSource![indexPath.row] as? App
            cell.titleLabel.text = app?.appName
            cell.appDescription.text = app?.appDescription
            cell.logoImageView.image = UIImage.base64Convert(base64String: app?.appLogo as? String)
            
            cell.selectionStyle = UITableViewCellSelectionStyle.none
            return cell
        }
        else
        {
            let currentGroup = self.groupDataSource![indexPath.row] as? Groups
            let cell = tableView.dequeueReusableCell(withIdentifier: "MyGroups") as! MyGroupTableViewCell
            cell.titleLabel.text = currentGroup?.groupName
            cell.groupDescription.text = currentGroup?.groupDescription
            cell.profileNameLabel.text = Utlity.getProfilePicName(forUser: (currentGroup?.groupName)!)
            cell.profileNameLabel.makeCircular()
            cell.selectionStyle = UITableViewCellSelectionStyle.none
            return cell
        }
        
        return UITableViewCell()
    }
    
    @IBAction func logoutDone(_ sender: Any) {
        
        if  let method = self.delegate?.didSelectLogout {
            method()
        }
        self.navigationController?.popViewController(animated: true)

    }
    @IBAction func currentSegmentChanged(_ sender: Any) {
        
        self.tableView.reloadData()
    }

    /*
    // MARK: - Navigation

    // In a storyboard-based application, you will often want to do a little preparation before navigation
    override func prepare(for segue: UIStoryboardSegue, sender: Any?) {
        // Get the new view controller using segue.destinationViewController.
        // Pass the selected object to the new view controller.
    }
    */

}

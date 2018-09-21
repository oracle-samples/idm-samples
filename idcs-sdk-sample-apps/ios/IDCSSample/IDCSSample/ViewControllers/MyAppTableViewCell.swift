//
//  MyAppTableViewCell.swift
//  IDCSSample
//
//  Created by Shivaprasad on 5/13/18.
//  Copyright © 2018 Oracle. All rights reserved.
//

import UIKit

class MyAppTableViewCell: UITableViewCell {

    @IBOutlet weak var appDescription: UILabel!
    @IBOutlet weak var logoImageView: UIImageView!
    @IBOutlet weak var desLabel: UILabel!
    @IBOutlet weak var titleLabel: UILabel!
    override func awakeFromNib() {
        super.awakeFromNib()
        // Initialization code
    }

    override func setSelected(_ selected: Bool, animated: Bool) {
        super.setSelected(selected, animated: animated)

        // Configure the view for the selected state
    }
    
}

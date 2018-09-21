//
//  MyGroupTableViewCell.swift
//  IDCSSample
//
//  Created by Shivaprasad on 5/14/18.
//  Copyright © 2018 Oracle. All rights reserved.
//

import UIKit

class MyGroupTableViewCell: UITableViewCell {
    @IBOutlet weak var titleLabel: UILabel!
    
    @IBOutlet weak var groupDescription: UILabel!
    @IBOutlet weak var profileNameLabel: UILabel!

    override func awakeFromNib() {
        super.awakeFromNib()
        // Initialization code
    }

    override func setSelected(_ selected: Bool, animated: Bool) {
        super.setSelected(selected, animated: animated)

        // Configure the view for the selected state
    }

}

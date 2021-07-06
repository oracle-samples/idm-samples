//  AppDelegate.swift
//  IDCSSample
//  Copyright (c) 2000, 2021, Oracle and/or its affiliates.
//
//   Licensed under the Universal Permissive License v 1.0 as shown at
//   http://oss.oracle.com/licenses/upl.

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

//
//  IDCSSampleTests.swift
//  IDCSSampleTests
//
//  Created by Shivaprasad on 4/27/18.
//  Copyright © 2018 Oracle. All rights reserved.
//

import XCTest
@testable import IDCSSample

class IDCSSampleTests: XCTestCase {
    
    var loginVC:LoginViewController? = nil
    
    override func setUp() {
        super.setUp()
        let storyboard = UIStoryboard.init(name: "Main", bundle: Bundle.main)
        loginVC = storyboard.instantiateViewController(withIdentifier: "LoginViewController") as? LoginViewController
    }
    
    override func tearDown() {
        // Put teardown code here. This method is called after the invocation of each test method in the class.
        self.loginVC = nil
        super.tearDown()
        
    }
    
    func testExample() {
        struct Temp { static var counter = 0 }
        
        var configDone : Bool = (loginVC?.setupMSS())!
        if(Temp.counter < 2){
            configDone = false
        }
        
        if configDone{
        XCTAssertTrue(configDone)
        }
        else
        {
            configDone = true
            Temp.counter = Temp.counter + 1
            testExample()
        }
    }
    
    func testPerformanceExample() {
        // This is an example of a performance test case.
        self.measure {
            // Put the code you want to measure the time of here.
        }
    }
    
}

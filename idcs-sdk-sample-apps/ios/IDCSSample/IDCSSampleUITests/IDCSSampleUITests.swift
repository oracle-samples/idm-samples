//  AppDelegate.swift
//  IDCSSample
//  Copyright (c) 2000, 2021, Oracle and/or its affiliates.
//
//   Licensed under the Universal Permissive License v 1.0 as shown at
//   http://oss.oracle.com/licenses/upl.

import XCTest

class IDCSSampleUITests: XCTestCase {
        
    override func setUp() {
        super.setUp()
        
        // Put setup code here. This method is called before the invocation of each test method in the class.
        
        // In UI tests it is usually best to stop immediately when a failure occurs.
        continueAfterFailure = false
        // UI tests must launch the application that they test. Doing this in setup will make sure it happens for each test method.
        XCUIApplication().launch()

        // In UI tests it’s important to set the initial state - such as interface orientation - required for your tests before they run. The setUp method is a good place to do this.
    }
    
    override func tearDown() {
        // Put teardown code here. This method is called after the invocation of each test method in the class.
        super.tearDown()
    }
    
    func testLogin()  {
        
        XCUIApplication().buttons["Sign In"]/*@START_MENU_TOKEN@*/.press(forDuration: 0.5);/*[[".tap()",".press(forDuration: 0.5);"],[[[-1,1],[-1,0]]],[0]]@END_MENU_TOKEN@*/
        
        sleep(10)

        let app = XCUIApplication()

        let username  =  app.textFields["User Name"]
        username.tap()
        username.typeText("shiva")
        
        let password  =  app.secureTextFields["Password"]
        password.tap()
        password.typeText("Welcome1@")
        app.buttons["Sign In"].tap()
        sleep(5)
        
    }
    func testExample() {
        // Use recording to get started writing UI tests.
        // Use XCTAssert and related functions to verify your tests produce the correct results.
    }
    
}

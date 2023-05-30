import { expect } from "chai";
import { test } from "mocha";

import { deriveDeviceDisplayName } from "../../client/util/deviceUtil";


const testData = [
  {
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.113 Safari/537.36",
    browser: "Chrome",
    platform: "Windows",
  },
  {
    userAgent: "Mozilla/5.0 (Windows NT 5.1; rv:7.0.1) Gecko/20100101 Firefox/7.0.1",
    browser: "Firefox",
    platform: "Windows",
  },
  {
    userAgent: "Mozilla/5.0 (Windows NT 6.1; WOW64; rv:54.0) Gecko/20100101 Firefox/54.0",
    browser: "Firefox",
    platform: "Windows",
  },
  {
    userAgent: "Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.90 Safari/537.36",
    browser: "Chrome",
    platform: "Windows",
  },
  {
    userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/44.0.2403.157 Safari/537.36",
    browser: "Chrome",
    platform: "Linux",
  },
  {
    userAgent: "Mozilla/5.0 (Windows NT 6.1; WOW64; rv:40.0) Gecko/20100101 Firefox/40.1",
    browser: "Firefox",
    platform: "Windows",
  },
  {
    userAgent: "Mozilla/4.0 (compatible; MSIE 9.0; Windows NT 6.1)",
    browser: "Internet Explorer",
    platform: "Windows",
  },
  {
    userAgent: "Mozilla/5.0 (Windows NT 5.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.90 Safari/537.36",
    browser: "Chrome",
    platform: "Windows",
  },
  {
    userAgent: "Mozilla/5.0 (Windows NT 6.2; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.90 Safari/537.36",
    browser: "Chrome",
    platform: "Windows",
  },
  {
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.79 Safari/537.36 Edge/14.14393",
    browser: "Edge",
    platform: "Windows",
  },
  {
    userAgent: "Mozilla/5.0 (Windows NT 6.3; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.113 Safari/537.36",
    browser: "Chrome",
    platform: "Windows",
  },
  {
    userAgent: "Mozilla/5.0 (Windows NT 6.1; WOW64; Trident/7.0; rv:11.0) like Gecko",
    browser: "Internet Explorer",
    platform: "Windows",
  },
  {
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/52.0.2743.116 Safari/537.36 Edge/15.15063",
    browser: "Edge",
    platform: "Windows",
  },
  {
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/603.3.8 (KHTML, like Gecko)",
    browser: "",
    platform: "Mac",
  },
  {
    userAgent: "Mozilla/5.0 (Windows NT 10.0; WOW64; rv:50.0) Gecko/20100101 Firefox/50.0",
    browser: "Firefox",
    platform: "Windows",
  },
  {
    userAgent: "Mozilla/5.0 (Windows NT 10.0; WOW64; rv:52.0) Gecko/20100101 Firefox/52.0",
    browser: "Firefox",
    platform: "Windows",
  },
  {
    userAgent: "Mozilla/5.0 (Windows NT 6.1; WOW64; rv:50.0) Gecko/20100101 Firefox/50.0",
    browser: "Firefox",
    platform: "Windows",
  },
  {
    userAgent: "Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.79 Safari/537.36 Edge/14.14393",
    browser: "Edge",
    platform: "Windows",
  },
  {
    userAgent: "Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/46.0.2486.0 Safari/537.36 Edge/13.10586",
    browser: "Edge",
    platform: "Windows",
  },
  {
    userAgent: "Mozilla/5.0 (Windows NT 10.0; WOW64; rv:54.0) Gecko/20100101 Firefox/54.0",
    browser: "Firefox",
    platform: "Windows",
  },
  {
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/57.0.2987.133 Safari/537.36",
    browser: "Chrome",
    platform: "Windows",
  },
  {
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.90 Safari/537.36",
    browser: "Chrome",
    platform: "Windows",
  },
  {
    userAgent: "Mozilla/5.0 (Windows NT 6.1; Trident/7.0; rv:11.0) like Gecko",
    browser: "Internet Explorer",
    platform: "Windows",
  },
  {
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/46.0.2486.0 Safari/537.36 Edge/13.10586",
    browser: "Edge",
    platform: "Windows",
  },
  {
    userAgent: "Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1; WOW64; Trident/5.0)",
    browser: "Internet Explorer",
    platform: "Windows",
  },
  {
    userAgent: "Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/57.0.2987.133 Safari/537.36",
    browser: "Chrome",
    platform: "Windows",
  },
  {
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/55.0.2883.87 Safari/537.36",
    browser: "Chrome",
    platform: "Windows",
  },
  {
    userAgent: "Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko",
    browser: "Internet Explorer",
    platform: "Windows",
  },
  {
    userAgent: "Mozilla/5.0 (Windows NT 6.1; WOW64; rv:52.0) Gecko/20100101 Firefox/52.0",
    browser: "Firefox",
    platform: "Windows",
  },
  {
    userAgent: "Mozilla/5.0 (Windows NT 6.2; WOW64; Trident/7.0; rv:11.0) like Gecko",
    browser: "Internet Explorer",
    platform: "Windows",
  },
  {
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/63.0.3239.84 Safari/537.36",
    browser: "Chrome",
    platform: "Windows",
  },
  {
    userAgent: "Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/55.0.2883.87 Safari/537.36",
    browser: "Chrome",
    platform: "Windows",
  },
  {
    userAgent: "Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 Edge/12.10240",
    browser: "Edge",
    platform: "Windows",
  },
  {
    userAgent: "Mozilla/5.0 (Windows NT 6.3; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/46.0.2486.0 Safari/537.36 Edge/13.10586",
    browser: "Edge",
    platform: "Windows",
  },
  {
    userAgent: "Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/52.0.2743.116 Safari/537.36 Edge/15.15063",
    browser: "Edge",
    platform: "Windows",
  },
  {
    userAgent: "Mozilla/5.0 (Windows NT 6.1; WOW64; rv:41.0) Gecko/20100101 Firefox/41.0",
    browser: "Firefox",
    platform: "Windows",
  },
  {
    userAgent: "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/46.0.2490.80 Safari/537.36",
    browser: "Chrome",
    platform: "Windows",
  },
  {
    userAgent: "Mozilla/5.0 (Windows NT 6.3; WOW64; Trident/7.0; rv:11.0) like Gecko",
    browser: "Internet Explorer",
    platform: "Windows",
  },
  {
    userAgent: "Mozilla/5.0 (Windows NT 6.1; WOW64; rv:46.0) Gecko/20100101 Firefox/46.0",
    browser: "Firefox",
    platform: "Windows",
  },
  {
    userAgent: "Mozilla/5.0 (Windows NT 5.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.79 Safari/537.36 Edge/14.14393",
    browser: "Edge",
    platform: "Windows",
  },
  {
    userAgent: "Mozilla/5.0 (Windows NT 6.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.79 Safari/537.36 Edge/14.14393",
    browser: "Edge",
    platform: "Windows",
  },
  {
    userAgent: "Mozilla/5.0 (Windows NT 6.2; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.79 Safari/537.36 Edge/14.14393",
    browser: "Edge",
    platform: "Windows",
  },
  {
    userAgent: "Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.0; Trident/5.0)",
    browser: "Internet Explorer",
    platform: "Windows",
  },
  {
    userAgent: "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.106 Safari/537.36",
    browser: "Chrome",
    platform: "Windows",
  },
  {
    userAgent: "Mozilla/5.0 (Windows NT 6.1; WOW64; rv:44.0) Gecko/20100101 Firefox/44.0",
    browser: "Firefox",
    platform: "Windows",
  },
  {
    userAgent: "Mozilla/5.0 (Windows NT 6.3; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.79 Safari/537.36 Edge/14.14393",
    browser: "Edge",
    platform: "Windows",
  },
  {
    userAgent: "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/48.0.2564.109 Safari/537.36",
    browser: "Chrome",
    platform: "Windows",
  },
  {
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_6) AppleWebKit/601.7.7 (KHTML, like Gecko) Version/9.1.2 Safari/601.7.7",
    browser: "Safari",
    platform: "Mac",
  },
  {
    userAgent: "Mozilla/5.0 (iPad; CPU OS 9_3_2 like Mac OS X) AppleWebKit/601.1.46 (KHTML, like Gecko) Version/9.0 Mobile/13F69 Safari/601.1",
    browser: "Safari",
    platform: "iPad",
  },
  {
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/63.0.3239.132 Safari/537.36",
    browser: "Chrome",
    platform: "Windows",
  }
]

function setUserAgent(val) {
  Object.defineProperty(global.navigator, 'userAgent', {
    value: val
  });
}

before(() => {
  Object.defineProperty(global, 'navigator', {
    value: {
      userAgent: "",
    },
    configurable: true,
    writable: true
  });
  Object.defineProperty(global.navigator, 'userAgent', {
    configurable: true,
    writable: true
  })
});

describe("Device Identificiation Utility", () => {
  it("Defaults to unknown device if no UserAgent", () => {
    setUserAgent(null)
    let result = deriveDeviceDisplayName();
    let expectedResult = "Unknown Non-Browser Device";
    expect(result).to.equal(expectedResult);
  });

  it("Defaults to Unknown Platform if User Agent is malformed", () => {
    setUserAgent("malformed");
    let result = deriveDeviceDisplayName();
    let expectedResult = "Unknown Platform";
    expect(result).to.equal(expectedResult);
  });

  describe("Testing a Wide range of Common User Agents", ()=>{
    testData.forEach(({userAgent, browser, platform}, index) =>{
      it(`#${index+1}: ${userAgent}`, ()=>{
        setUserAgent(userAgent);
        let result = deriveDeviceDisplayName();
        expect(result).to.equal(`${browser}${browser?" on ":""}${platform}`);
      });
    });
  });
  
});
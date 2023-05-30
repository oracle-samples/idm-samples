interface RegexDict {
  [key: string]: RegExp;
}

/*
 * Need a friendly name for KMSI session management in the console
 * Derive one from the user agent.
 * Just going to use a simple '<Browser> on <Platform>'
 */

// I guess these lists need maintaining every now and again...
const BrowserRegex: RegexDict = {
  Edge: /edge/i,
  Amaya: /amaya/i,
  Konqueror: /konqueror/i,
  Epiphany: /epiphany/i,
  SeaMonkey: /seamonkey/i,
  Flock: /flock/i,
  OmniWeb: /omniweb/i,
  Chromium: /chromium|crios/i,
  Chrome: /chrome/i,
  Safari: /safari/i,
  "Internet Explorer": /msie|trident/i,
  Opera: /opera|OPR/i,
  "Playstation Browser": /playstation/i,
  Firefox: /firefox/i,
  WinJs: /msapphost/i,
  PhantomJS: /phantomjs/i,
  UC: /UCBrowser/i
}

const PlatformRegex: RegexDict = {
  Windows: /windows nt/i,
  "Windows Phone": /windows phone/i,
  Mac: /macintosh/i,
  Linux: /linux/i,
  Wii: /wii/i,
  Playstation: /playstation/i,
  iPad: /ipad/i,
  iPod: /ipod/i,
  iPhone: /iphone/i,
  Android: /android/i,
  Blackberry: /blackberry/i,
  Samsung: /samsung/i,
  Curl: /curl/i,
  Postman: /postman/i
}

function deriveDeviceDisplayName():string{
  let userAgentString = navigator.userAgent;
  if(!userAgentString){
    return "Unknown Non-Browser Device";
  }
  userAgentString = userAgentString.trim();
  let browser = "";
  for(const browserTest in BrowserRegex){
    if(BrowserRegex[browserTest].test(userAgentString)){
      browser = browserTest;
      break;
    }
  }
  let platform = "Unknown Platform";
  for(const platformTest in PlatformRegex){
    if(PlatformRegex[platformTest].test(userAgentString)){
      platform = platformTest;
      break;
    }
  }
  return browser +(browser?" on ":"") +platform;
}

export {deriveDeviceDisplayName};
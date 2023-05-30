/*
 * Utility to encode the data we need into the cookie which is used for KMSI.
 *
 * The cookie needs to contain the user_id, since that is used for forgetting
 * KMSI sessions.
 *
 */

const ENC_ALG = 'aes-128-cbc';
const COOKIE_VALUE_SEPERATOR = "_";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

interface SplitKmsiCookieResult {
  userId: string;
  kmsiToken: string;
}

function createKmsiCookie(token:string, userId?:string, secret?:string):string {
  let cookieValue = token;
  if(userId && secret){
    cookieValue += COOKIE_VALUE_SEPERATOR;
    cookieValue += _encryptUserId(userId, secret);
  }
  return cookieValue;
}

function splitKmsiCookie(cookieValue:string, secret?:string):SplitKmsiCookieResult {
  const cookieSplitIndex = cookieValue.lastIndexOf(COOKIE_VALUE_SEPERATOR);
  let userId:string = null;
  let kmsiToken:string = null;
  if(cookieSplitIndex !== -1 && cookieSplitIndex+1 !== cookieValue.length){
    kmsiToken = cookieValue.substring(0, cookieSplitIndex);
    if(secret){
      userId = _decryptUserId(cookieValue.substring(cookieSplitIndex+1), secret);
    }
  }
  return {
    userId,
    kmsiToken
  };
}

/*
 * The Machine ID just needs to be mostly non-clashing, while also not being
 * so opaque that it makes the display in console awkward.
 * Trying 4 bytes, Base64'd to 6 chars for now.
 */
function generateMachineId():string {
  // Shouldn't be padding, but just in case...
  return randomBytes(4).toString('base64').replace(/=/g, '');
}

/*
 * Need to store an opaque reference to the User ID in the cookie,
 * so we will store it encrypted.
 * User Ids are UUIDs, which can be parsed as hex to allow for a shorter
 * output string.
 */
function _encryptUserId(userId:string, secret:string):string{
  // Validate the userId format - it should be a type4 UUID.
  const isHex = /^[0-9a-f]{32}$/.test(userId);
  let userIdBuffer:Buffer;
  // Flexibly handle an unexpected non-hex format
  if(isHex){
    userIdBuffer = Buffer.from(userId, 'hex');
  }else{
    userIdBuffer = Buffer.from(userId, 'utf-8');
  }
  // Generate an IV using the supplied secret
  // Simple alg: hash the key and take the first 16 bytes.
  const hash = createHash('sha256')
      .update(secret)
      .digest();
  const key = hash.subarray(0, 16);
  const iv = Buffer.alloc(16);
  iv.fill(0);
  const cipher = createCipheriv(ENC_ALG, key, iv);
  // Base64 produces 3 bytes per 2 bytes, where hex is 2:1
  let encrypted = cipher.update(userIdBuffer, undefined, 'base64')
  encrypted += cipher.final('base64');
  return encrypted;
}

function _decryptUserId(encryptedUserId:string, secret:string):string{
  // Validate the userId format (lazily checking both URL encoded and non)
  const isBase64 = /^[0-9a-zA-Z+\/_-]*={0,2}$/.test(encryptedUserId);
  if(!isBase64){
    return null;
  }
  // Generate an IV using the supplied secret
  // Simple alg: hash the key and take the first 16 bytes.
  const hash = createHash('sha256')
      .update(secret)
      .digest();
  const key = hash.subarray(0, 16);
  const iv = Buffer.alloc(16);
  iv.fill(0);
  const decipher = createDecipheriv(ENC_ALG, key, iv);
  let decrypted = decipher.update(encryptedUserId, 'base64', 'hex');
  decrypted += decipher.final('hex');
  // So, we have a resulting hex string - but how do we know whether it is the
  // right UserId format? I guess we assume that if the response is the right
  // length, then it is appropriate?
  if(decrypted.length === 32){
    return decrypted;
  }
  // Otherwise, parse it to UTF8
  return Buffer.from(decrypted, 'hex').toString('utf8');
}

export {createKmsiCookie, splitKmsiCookie, generateMachineId, SplitKmsiCookieResult};
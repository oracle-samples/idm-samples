/**
 *
 * @author IJ <Indranil Jha>
 */

const querystring = require('querystring');  
var secrets = require('../config/secrets');
var crypto = require('crypto');
var NodeRSA = require('node-rsa');
var ByteBuffer = require('ByteBuffer');

IDCSRestClient = require('node-rest-client').Client
var loginClient = new IDCSRestClient();

getTenantName = function(hostname) {
    return hostname.split(".")[0];
};

getBytes = function (str) {
    return str.charCodeAt(0);
};

generateKey = function (salt, key) {
    secretBytes = Buffer.concat([salt, new Buffer(key)]);
    mdInstance = crypto.createHash('sha256');
    mdInstance.update(secretBytes);
    digest = mdInstance.digest();
    macKeyBytes = digest.slice(0, 16);
    aesKeyBytes = digest.slice(16, 32);
    return [salt, aesKeyBytes, macKeyBytes];
};

calculateHMAC = function(data, hmacKey) {
    return crypto.createHmac("sha256", hmacKey).update(data).digest("hex");
};

decryptWithKey = function(data, key, iv) {
    var decipher = crypto.createDecipheriv("aes-128-cbc", key, iv);
    decipher.setAutoPadding(true);
    var result = decipher.update(data);
    result += decipher.final();

    return result;
}

decrypt = function(data, tenant, key){
   SALT_LENGTH = 8
   TOTAL_LENGTH = 4;
   DATA_LENGTH = 4;
   TAG_LENGTH = 2;
   HMAC_LENGTH = 16;
    
    
   salt = data.slice(0, SALT_LENGTH);
   data = data.slice(SALT_LENGTH);
    
    
   headerOffset = 0;
   totalLength = ByteBuffer.wrap(data,littleEndian=true).readInt();
   headerOffset += TOTAL_LENGTH;
       
   if (totalLength != data.length)
       return null;
   
   dataLength = ByteBuffer.wrap(data,littleEndian=true).readInt(offset = headerOffset);
   headerOffset += DATA_LENGTH;
    
   ivLength = data[headerOffset++];
   khashLength = data[headerOffset++];
   encryptedHmacData = data.slice(headerOffset, headerOffset + dataLength);
   headerOffset += dataLength;
 
   iv = data.slice(headerOffset, headerOffset + ivLength);
   headerOffset += ivLength;
    
   khash = data.slice(headerOffset, headerOffset + khashLength);
    
   headerOffset = 0;
   encryptedDataTotalLength = ByteBuffer.wrap(encryptedHmacData,littleEndian=true).readInt();
   headerOffset += TOTAL_LENGTH; 
    
   encryptedDataLength = ByteBuffer.wrap(encryptedHmacData,littleEndian=true).readInt(offset = headerOffset);
   headerOffset += DATA_LENGTH;
    
   tagLength = ByteBuffer.wrap(encryptedHmacData,littleEndian=true).readInt16(offset = headerOffset);
   headerOffset += TAG_LENGTH;
    
   encryptedData = encryptedHmacData.slice(headerOffset, headerOffset + encryptedDataLength);
   headerOffset += encryptedDataLength;
   tag = encryptedHmacData.slice(headerOffset, headerOffset + tagLength);

   if (encryptedDataTotalLength != encryptedHmacData.length) {
       return null;
   }
    
   hashDataOffset = 0;
   hashData = [];
   t = new Buffer(8).fill(0);
   hashData =  Buffer.concat([iv, encryptedData, t]);
    
   decryptionKey = generateKey(salt, key);

   
   hmacCompute = calculateHMAC(hashData, decryptionKey[2]);
   hmac = new Buffer(hmacCompute, 'hex').slice(0,16);

   if (hmac.equals(tag)){
       plaintext = decryptWithKey(encryptedData, decryptionKey[1], iv);
       return JSON.parse(plaintext);
   }

};

convertCertificateToPem = function(_cert) {
  var cert = _cert;
  var beginCert = '-----BEGIN CERTIFICATE-----';
  var endCert = '-----END CERTIFICATE-----';

  cert = cert.replace('\n', '');
  cert = cert.replace(beginCert, '');
  cert = cert.replace(endCert, '');

  var result = beginCert;
  while (cert.length > 0) {

    if (cert.length > 64) {
      result += '\n' + cert.substring(0, 64);
      cert = cert.substring(64, cert.length);
    } else {
      result += '\n' + cert;
      cert = '';
    }
  }

  if (result[result.length] !== '\n') {
    result += '\n';
  }
  result += endCert + '\n';
  return result;
}

/**
  * Get the access token to be used by the custom login UI
  */

exports.idcsanon = function() {
    var options = secrets.idcsanon;
    var anonclient = new IDCSRestClient();
  
    var postData = "grant_type=" + options.grant_type + "&scope=" + options.scope;
    var base64Creds = "Basic " + new Buffer(options.clientID +":"+options.clientSecret).toString("base64");
    var args = {
	   headers: { 
                    "Authorization": base64Creds,
                    "Content-Type" : "application/x-www-form-urlencoded; charset=utf-8"
                },
       data: postData
    };
    anonclient.post(options.tokenURL, args, function (data, response) {
        global.idcstoken = data.access_token;
    });
};

/**
  * Extract the login context and redirect to the custom login page
  */

exports.dologin = function(req, res) {
    var loginCtx = req.body.loginCtx;
    var signature = req.body.signature;
    
    var options = secrets.idcsanon;
    var anonclient = new IDCSRestClient();
  
    var args = {
	   headers: { 
                    "Authorization": "Bearer " + idcstoken ,
                    "Content-Type" : "application/x-www-form-urlencoded; charset=utf-8"
                }
    };
    
    anonclient.get(options.jwkURL, args, function (data, response) {
        signingKey = data.keys;
        base64Cert = signingKey[0].x5c[0];
        publickey = convertCertificateToPem(base64Cert);
        
        var verifier = crypto.createVerify('sha256');
        verifier.update('loginCtx', 'utf8');
        verifier.update(loginCtx, 'utf8');
        var ver = verifier.verify(publickey, signature,'base64');
        if(ver){
            
            var sha256Hash = crypto.createHash('sha256');
            sha256Hash.update(getTenantName(secrets.idcshost).toLowerCase());
            var digest = sha256Hash.digest();
            var encryptionKey = digest.slice(0, 16);
            
            var iv = new Buffer(16);
            iv.fill(0);

            var decipher = crypto.createDecipheriv('aes-128-cbc', encryptionKey, iv);
            global.decryptedLoginCtx = decipher.update(loginCtx, 'base64', 'utf8');
            global.decryptedLoginCtx += decipher.final('utf8');
            res.redirect('/#!/signin');
        }   
    });
    
};

/**
  * Handle scenarios other than the standard username-password flow such as - IdP login, social registration, or login error 
  */

exports.handleSigninError = function(req, res) {
    
    var options = secrets.idcsanon;
    
    isRegister = req.body.isSocialRegister;
    bool = isRegister == null ? false : true;
    requestState = req.body.requestState;
    global.authnToken = req.body.authnToken;
    status = req.body.status;
    
    
    userData = req.body.userData;
    
    if(userData != null){
        userBean = decrypt(Buffer(req.body.userData, 'base64'), getTenantName(secrets.idcshost).toLowerCase(), options.clientSecret);
        scimData = userBean["scim_user_attr"];
    }
    
    error = !bool && (global.authnToken == null);
    if (error) {
        code = req.body.code;
        message = req.body.message;
        return;
    }
    if (!bool && !error) {
        res.redirect('/#!/idpsignin');
    } else if (bool && !error) {
        paramStr = querystring.stringify({"dosocialreg":true,"scimData":scimData, "requestState":requestState});
        param = new Buffer(paramStr).toString('base64')
        res.redirect('/#!/signin?ctx=' + param);
    }
};

exports.getLoginContext = function(req, res) {
    res.json({'token': global.idcstoken, 'ctx':global.decryptedLoginCtx});
};

exports.getCurrentAuthnToken = function(req, res) {
    res.json({'authnToken': global.authnToken});
};

exports.getConfigData = function(req, res) {
    res.json(secrets.idcsanon);
};

exports.getGlobalToken = function(req, res) {
    res.json({'token': global.idcstoken});
};




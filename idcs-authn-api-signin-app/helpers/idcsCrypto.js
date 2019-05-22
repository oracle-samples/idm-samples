var obfuscationKey = "";

const crypto = require('crypto');
var logger = require('./logging');


var tenantName = undefined;
var obfuscationKey = undefined;

var tenantCert = undefined;

exports.tenantCert = undefined;

// The loginCtx and errorCtx are both obfuscated by encrypting them with an
// key derived from the IDCS tenant name.
//
// To generate the key perform the following steps:
// 1) acquire the tenant name
//    The most readily available source of this value is an IDCS Access Token.
//    An IDCS AT is a JWT and the value of the user.tenant.name claim contains
//    the string we need.
// 2) translate the tenant name to lowercase ASCII
// 3) Perform a SHA-256 Message Digest on lowercase tenant name
//
// The results of that is 32 bytes
// The first 16 bytes of that will be used as the key

// To decrypt the loginCtx:
//
// * Use a cipher of type AES 128 CBC with PKCS5 Padding
// * The Initialization Vector (IV) is 16 bytes of NUL (i.e. ASCII code 0)
// * The encrypted data is a Base64 encoded UTF-8 string


function setTenantName( t ) {
  tenantName = t;
  const hash = crypto.createHash('sha256')
    .update(tenantName)
    .digest();
  logger.log("Hash length is " + hash.byteLength);
  obfuscationKey = hash.slice(0, 16);
  logger.log("Key length is " + obfuscationKey.byteLength);
}

exports.setTenantName = setTenantName;


function decrypt( encrypted ) {
  var iv = Buffer.alloc(16);
  iv.fill(0);

  const decipher = crypto.createDecipheriv('aes-128-cbc', obfuscationKey, iv);
  var decrypted = decipher.update(encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  logger.log("loginCtx decrypted: " + decrypted);

  return decrypted;
}
exports.decrypt = decrypt;


// The signature on the POST data is not that complicated

// we need the tenant certificate (which we get from the JWKS URI)
// and then it's a simple SHA 256 verifier

function setTenantCert( cert ) {
  // this is a trick.
  // "crypto" doesn't seem to have a simple function to load a PEM cert.
  // So to make sure I have a valid cert I just encrypt a nonsense string
  try {
    crypto.publicEncrypt(cert, Buffer.from('foo'));

    // No exception means everything went fine.
    // in that case save the cert into the var
    tenantCert = cert;
  }
  catch (err) {
    logger.error("Tenant certificate does not appear to be valid!");
  }
}
exports.setTenantCert = setTenantCert;

function getTenantCert() {
  return tenantCert;
}

exports.getTenantCert = getTenantCert;

// verifySignature is used to verify the signature of an incoming POST
// i.e. the handoff from IDCS to the custom login app
// Params:
// * what   : the string literal "loginCtx" or "errorCtx"
// * data   : the POST param's content
// * sig    : the signature (req.body.signature)
function verifySignature( what, data, sig ) {
  var verifier = crypto.createVerify('sha256');
  verifier.update(what,'utf8');
  verifier.update(data, 'utf8');

  logger.log( "Verifying signature" );
  if ( verifier.verify(tenantCert, sig, 'base64') ) {
    logger.log( "Signature verified" );
    return;
  }
  else {
    logger.error( "Signature did NOT verify!" );
    throw("Invalid request. Please see server side logs.");
  }
}

exports.verifySignature = verifySignature;


var SALT_LENGTH = 8;
var TOTAL_LENGTH = 4;
var DATA_LENGTH = 4;
var TAG_LENGTH = 2;

// TODO: cleanup code...
function decryptSocial(encryptedString, clientSecret) {
    // convert encryptedStrign to array of bytes
    var data = Buffer.from(encryptedString, 'base64');

    logger.log('client secret: ' + clientSecret);
    //buffer
    var salt = data.slice(0, SALT_LENGTH);
    logger.log('salt: ' + salt);
    logger.log('data length: before: ' + data.length);
    data = data.slice(SALT_LENGTH, data.length);
    logger.log('data length: after: ' + data.length);
    var headerOffset = 0;
    var totalLength = data.readInt32LE(headerOffset);
    headerOffset += TOTAL_LENGTH;
    logger.log('data length: ' + data.length);
    logger.log('total length: ' + totalLength);

    if (totalLength != data.length) {
        return null;
    }
    var dataLength = data.readInt32LE(headerOffset);
    headerOffset += DATA_LENGTH;
    var ivLength = data[headerOffset++];
    headerOffset++;
    logger.log('iv.length: ' + ivLength);

    var encryptedHmacData = data.slice(headerOffset, headerOffset + dataLength);
    headerOffset += dataLength;
    //buffer
    var iv = data.slice(headerOffset, headerOffset + ivLength);

    // HMAC header format - [ U32(LEN) | U32(DATALEN) | U16(TAGLEN) | DATA |
    // TAG ]
    // Resetting header offset for encrypted hmac data processing
    headerOffset = 0;
    var encryptedDataTotalLength = encryptedHmacData.readInt32LE(headerOffset);
    headerOffset += TOTAL_LENGTH;
    if (encryptedDataTotalLength != encryptedHmacData.length) {
        logger.log('something is broken');
    }
    var encryptedDataLength = encryptedHmacData.readInt32LE(headerOffset);
    headerOffset += DATA_LENGTH;

    headerOffset += TAG_LENGTH;
    //buffer
    var encryptedData = encryptedHmacData.slice(headerOffset, headerOffset + encryptedDataLength);

    //buffer
    var decryptionKey = generateSocialKey(salt, clientSecret);

    const decipher = crypto.createDecipheriv('aes-128-cbc', decryptionKey, iv);
    var decrypted = decipher.update(encryptedData);
    decrypted += decipher.final('utf8');
    logger.log("userData  decrypted: " + decrypted);
    return decrypted;

}

function generateSocialKey(salt, clientSecret) {
    //buffer
    var secretBytes = Buffer.concat([salt, Buffer.from(clientSecret, 'utf8')]);
    const keyBytes = crypto.createHash('sha256')
        .update(secretBytes)
        .digest();

    //byte[] macKeyBytes = Arrays.copyOfRange(keyBytes, 0, 16);
    var aesKeyBytes = keyBytes.slice(16, 32);
    return aesKeyBytes;
}


exports.decryptSocial = decryptSocial;

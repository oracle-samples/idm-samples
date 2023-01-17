function register(response) {
  var fidoResponseData = JSON.parse(response.FIDO_AUTHENTICATOR.fidoData.fidoData);
  var options = {};
  fidoResponseData.forEach(function (attr) {
    var name = attr.name;
    options[name] = attr.value;
  });
  var publicKeyCredentialCreationOptions = {
    challenge: Uint8Array.from(
      options.challenge, function (char) {
        return char.charCodeAt(0);
      }),
    rp: {
      id: options.rpId,
      name: options.rpName,
    },
    user: {
      id: Uint8Array.from(
        options.userId, function (char) {
          return char.charCodeAt(0);
        }),
      name: options.userName,
      displayName: options.userDisplayName,
    },
    pubKeyCredParams: options.publicKeyAlgorithms,
    //pubKeyCredParams: [{alg: -35, type: "public-key"}],
    authenticatorSelection: {
      userVerification: options.authSelectionUserVerification
    },
    'timeout': options.timeout,
    'attestation': options.attestation.toLowerCase()
  };

  if (options.authSelectionResidentKey) {
    publicKeyCredentialCreationOptions.authenticatorSelection.residentKey = options.authSelectionResidentKey;
    publicKeyCredentialCreationOptions.authenticatorSelection.requireResidentKey = options.authSelectionRequireResidentKey;
  }

  if (options.excludeCredentials) {
    publicKeyCredentialCreationOptions.excludeCredentials = options.excludeCredentials;
  }

  if (options.authSelectionAttachment) {
    publicKeyCredentialCreationOptions.authenticatorSelection.authenticatorAttachment = options.authSelectionAttachment;
  }
  // call the Webauthn for registration
  var promise = new Promise(function (resolve, reject) {
    navigator_credentials_create(publicKeyCredentialCreationOptions).then(function (credential) {
      resolve(credential);
    })
  });
  return promise;
}

function authenticate(response) {
  var fidoResponseData = JSON.parse(response.FIDO_AUTHENTICATOR.fidoData.fidoData);
  var options = {};
  var allowCredentials = [];
  fidoResponseData.forEach(function (attr) {
    var name = attr.name;
    options[name] = attr.value;
  });
  if (options.allowCredentials) {
    options.allowCredentials.forEach(function (allowCredential) {
      allowCredentials.push({
        id: Uint8Array.from(window.atob(allowCredential.id),
          function (char) {
            return char.charCodeAt(0);
          }),
        type: allowCredential.type
      });
    });
  }

  var publicKeyCredentialRequestOptions = {
    challenge: Uint8Array.from(
      options.challenge, function (char) { return char.charCodeAt(0); }),
    allowCredentials: allowCredentials,
    rpId: options.rpId,
    timeout: options.timeout,
    userVerification: options.authSelectionUserVerification,
    extensions: {
      appid: options.appId
    },
  };

  // call the Webauthn for authentiacte
  var promise = new Promise(function (resolve, reject) {
    navigator_credentials_get(publicKeyCredentialRequestOptions).then(function (credential) {
      resolve(credential);
    })
  });
  return promise;
}

function navigator_credentials_create(options) {
  var promise = new Promise(function (resolve, reject) {
    if (navigator && navigator.credentials && navigator.credentials.create) {
      navigator.credentials.create({ publicKey: options }).then(function (credential) {
        resolve(credential);
      }).catch(function (error) {
        reject(error);
      });
    } else {
      // webauthn not supported, throw error
    }
  });
  return promise;
}

function navigator_credentials_get(options) {
  var promise = new Promise(function (resolve, reject) {
    if (navigator && navigator.credentials && navigator.credentials.get) {
      navigator.credentials.get({ publicKey: options }).then(function (credential) {
        resolve(credential);
      }).catch(function (error) {
        reject(error);
      });
    } else {
      // webauthn not supported, throw error
    }
  });
  return promise;
}

function encodeJson(value) {
  return JSON.stringify(value, replacer, 2);
}

function replacer(name, value) {
  if (value && value.constructor === Uint8Array) {
    return encodeArray(value);
  }

  if (value && value.constructor === ArrayBuffer) {
    return encodeArray(value);
  }

  /* global PublicKeyCredential */
  if (value && value.constructor === PublicKeyCredential) {
    return {
      id: value.id,
      type: value.type,
      rawId: value.rawId,
      response: value.response,
    };
  }

  /* global AuthenticatorAttestationResponse */
  if (value && value.constructor === AuthenticatorAttestationResponse) {
    return {
      clientDataJSON: value.clientDataJSON,
      attestationObject: value.attestationObject,
    };
  }

  /* global AuthenticatorAssertionResponse */
  if (value && value.constructor === AuthenticatorAssertionResponse) {
    return {
      clientDataJSON: value.clientDataJSON,
      authenticatorData: value.authenticatorData,
      signature: value.signature,
      userHandle: value.userHandle,
    };
  }

  if (value && value.constructor === CryptoKey) {
    return {
      type: value.type,
      extractable: value.extractable,
      algorithm: value.algorithm,
      usages: value.usages,
    };
  }
  return value;
}

function encodeArray(array) {
  return btoaUrlSafe(Array.from(new Uint8Array(array), function (char) {
    return String.fromCharCode(char);
  }).join(''));
}

function btoaUrlSafe(textParam) {
  var text = textParam;
  if (text === null) {
    return null;
  }

  /*
   * Replace '+' with '-'.
   * Replace '/' with '_'.
   * Remove trailing padding characters
   */

  text = btoa(text)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return text;
}

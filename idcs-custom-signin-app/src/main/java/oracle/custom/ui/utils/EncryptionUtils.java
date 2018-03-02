/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
package oracle.custom.ui.utils;

import java.security.MessageDigest;
import java.security.PublicKey;
import java.security.Signature;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import javax.servlet.http.HttpServletRequest;

/**
 *
 * @author npattar
 */
public class EncryptionUtils {
    
    public static String decrypt(String attr, String attrName, HttpServletRequest request) {
        String val = request.getParameter(attrName);
        return decrypt(attr, attrName, val);
    }
    
    public static String decrypt(String attr, String attrName, String attrDecryptValue ) {
        String attrDecrypt = attrDecryptValue;
        String tenantName = attr;
        final String SHA_256_ALG = "SHA-256";
        final String ENCRYPTION_ALG = "AES/CBC/PKCS5Padding";
        final String SECRET_KEY_ALG = "AES";
        String data = null;
        MessageDigest md = null;
        byte[] keyBytes = new byte[16];
        try {
            md = JCECryptoCache.getMessageDigestInstance(SHA_256_ALG);
            byte[] digest = md.digest(tenantName.toLowerCase().getBytes("UTF-8"));
            System.arraycopy(digest, 0, keyBytes, 0, 16);
        } catch (Exception ex) {
            ex.printStackTrace();
        } finally {
            JCECryptoCache.releaseMessageDigestInstance(md);
        }

        // encrypt the data
        Cipher decipher = null;
        try {
            decipher = JCECryptoCache.getCipherInstance(ENCRYPTION_ALG);
            SecretKey secretKey = new SecretKeySpec(keyBytes, SECRET_KEY_ALG);
            decipher.init(Cipher.DECRYPT_MODE, 
                    secretKey, new IvParameterSpec(new byte[16]));
            byte[] decryptedData = decipher.doFinal(Base64.getDecoder().decode(attrDecrypt.getBytes("UTF-8")));
            data = new String(decryptedData);
            System.out.println("" + data);
        } catch (Exception ex) {
            ex.printStackTrace();
        }
        return data;
    }
    
    public static String decryptData(String attr, String attrName, HttpServletRequest request) {
        String loginCtx = request.getParameter(attrName);
        String signature = request.getParameter("signature");
        final String SHA_256_ALG = "SHA-256";
        final String ENCRYPTION_ALG = "AES/CBC/PKCS5Padding";
        final String SECRET_KEY_ALG = "AES";
        final String SIGNATURE_ALG = "SHA256withRSA";
        boolean isVerified = false;
        
        Signature _signVerify = null;
        if (loginCtx != null && signature != null) {
            try {
                PublicKey publicKey = ServerUtils.getServerPublicKey(attr);
                _signVerify = JCECryptoCache.getSignatureInstance(SIGNATURE_ALG);
                _signVerify.initVerify(publicKey);
                _signVerify.update(attrName.getBytes("UTF-8"));
                _signVerify.update(loginCtx.getBytes("UTF-8"));
                System.out.println("signature is " + signature);
                isVerified = _signVerify.verify(Base64.getDecoder()
                        .decode(signature.getBytes("UTF-8")));
            } catch (Exception ex) {
                ex.printStackTrace();
            }
        }
        String sResponseData = null;
        if (isVerified) {
            String tenantName = attr;
            MessageDigest md = null;
            byte[] keyBytes = new byte[16];
            try {
                md = JCECryptoCache.getMessageDigestInstance(SHA_256_ALG);
                byte[] digest = md.digest(tenantName.toLowerCase().getBytes("UTF-8"));
                System.arraycopy(digest, 0, keyBytes, 0, 16);
            } catch (Exception ex) {
                ex.printStackTrace();
            } finally {
                JCECryptoCache.releaseMessageDigestInstance(md);
            }

            // encrypt the data
            Cipher decipher = null;
            try {
                decipher = JCECryptoCache.getCipherInstance(ENCRYPTION_ALG);
                SecretKey secretKey = new SecretKeySpec(keyBytes, SECRET_KEY_ALG);
                decipher.init(Cipher.DECRYPT_MODE, 
                        secretKey, new IvParameterSpec(new byte[16]));
                byte[] decryptedData = decipher.doFinal(Base64.getDecoder().decode(loginCtx.getBytes("UTF-8")));
                sResponseData = new String(decryptedData);
                System.out.println("" + sResponseData);
            } catch (Exception ex) {
                ex.printStackTrace();
            }
        }
        return sResponseData;
    }
    
    public static void main(String args[]) {
        decrypt("cisco", "clientIconUrl", "O8X3DNg0SrsV+992IzpVHLCwGcsw89gqPc53goWKbw7hKtVUk5MsGeWQeZFXqJ/VUIg4ktvYSY2bByhYbcQeL7vJcEyX9KiOw0WLc8nYnITIr3DZc69iUFjvMIdVD6x2");    
    }
}

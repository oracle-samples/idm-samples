/*******************************************************************************
 * Copyright (c) 2015 Oracle and/or its affiliates. All rights reserved.
 *******************************************************************************/

package oracle.custom.ui.utils;

import java.security.KeyFactory;
import java.security.KeyPairGenerator;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.Signature;
import java.security.cert.CertificateException;
import java.security.cert.CertificateFactory;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedQueue;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.Mac;
import javax.crypto.NoSuchPaddingException;

/**
 * This class acts as a cache for JCE Crypto instances (Cipher, MessageDigest...) to avoid the 
 * JDK issue where threads are blocked by the Provider.getInstance() method (see Bug 22950528).
 * 
 * IDCS classes wishing to use JCE classes will need to use this class to get an instance of
 * Cipher, MessageDigest... via the JCECryptoCache.get*Instance(), by passing arguments that are 
 * identical than the ones used when directly instantiating JCE instances *.getInstance() (replace
 * the * by Cipher, MessageDigest...). Once done with the crypto operation, the IDCS classes will
 * need to invoke JCECryptoCache.release*Instance(object) to return the object to the cache.
 * 
 * This class uses a simple caching logic, and to avoid any possible memory leaks that could be
 * present in JCE classes after an extended use of the JCE instances, the cached JCE instances
 * will be purged every 30 minutes.
 * @since 16.3.4
 */

// This class is available to internal APIs only and will not be packaged in the jar available to external clients
public class JCECryptoCache {
    private static final Map<String, CachedEntriesList> CIPHER_CACHE = new ConcurrentHashMap<>(20);
    private static final Map<String, CachedEntriesList> MESSAGE_DIGEST_CACHE = new ConcurrentHashMap<>(20);
    private static final Map<String, CachedEntriesList> SIGNATURE_CACHE = new ConcurrentHashMap<>(20);
    private static final Map<String, CachedEntriesList> MAC_CACHE = new ConcurrentHashMap<>(20);
    private static final Map<String, CachedEntriesList> KEY_GENERATOR_CACHE = new ConcurrentHashMap<>(20);
    private static final Map<String, CachedEntriesList> KEY_PAIR_GENERATOR_CACHE = new ConcurrentHashMap<>(20);
    private static final Map<String, CachedEntriesList> KEY_FACTORY_CACHE = new ConcurrentHashMap<>(20);
    private static final Map<String, CachedEntriesList> CERTIFICATE_FACTORY_CACHE = new ConcurrentHashMap<>(20);
    
    private static final long MAX_LIFETIME = 30 * 60 * 1000; // 30 minutes
    
    static {
        // algorithms used in the IDCS environment, create the list
        CIPHER_CACHE.put("AES/CBC/PKCS5Padding", new CachedEntriesList());
        CIPHER_CACHE.put("PBEWithSHA1AndDESede", new CachedEntriesList());
        SIGNATURE_CACHE.put("SHA1withRSA", new CachedEntriesList());
        SIGNATURE_CACHE.put("SHA256withRSA", new CachedEntriesList());
        MAC_CACHE.put("HmacSHA256", new CachedEntriesList());
        MESSAGE_DIGEST_CACHE.put("SHA-1", new CachedEntriesList());
        MESSAGE_DIGEST_CACHE.put("SHA-256", new CachedEntriesList());
        KEY_FACTORY_CACHE.put("RSA", new CachedEntriesList());
        CERTIFICATE_FACTORY_CACHE.put("X.509", new CachedEntriesList());
    }
    
    public static Cipher getCipherInstance(String algorithm) throws NoSuchPaddingException, NoSuchAlgorithmException {
        Cipher cipher = (Cipher) getCachedObject(CIPHER_CACHE, algorithm);
        
        if (cipher == null) {
            return Cipher.getInstance(algorithm);
        } else {
            return cipher;
        }
    }
    
    public static void releaseCipherInstance(Cipher cipher) {
        if (cipher != null) {
            storeCachedObject(CIPHER_CACHE, cipher.getAlgorithm(), cipher);
        }
    }
    
    public static Signature getSignatureInstance(String algorithm) throws NoSuchAlgorithmException {
        Signature signature = (Signature) getCachedObject(SIGNATURE_CACHE, algorithm);
        
        if (signature == null) {
            return Signature.getInstance(algorithm);
        } else {
            return signature;
        }
    }
    
    public static void releaseSignatureInstance(Signature signature) {
        if (signature != null) {
            storeCachedObject(SIGNATURE_CACHE, signature.getAlgorithm(), signature);
        }
    }
    
    public static MessageDigest getMessageDigestInstance(String algorithm) throws NoSuchAlgorithmException {
        MessageDigest messageDigest = (MessageDigest) getCachedObject(MESSAGE_DIGEST_CACHE, algorithm);
        
        if (messageDigest == null) {
            return MessageDigest.getInstance(algorithm);
        } else {
            messageDigest.reset();
            return messageDigest;
        }
    }
    
    public static void releaseMessageDigestInstance(MessageDigest messageDigest) {
        if (messageDigest != null) {
            storeCachedObject(MESSAGE_DIGEST_CACHE, messageDigest.getAlgorithm(), messageDigest);
        }
    }
    
    public static Mac getMacInstance(String algorithm) throws NoSuchAlgorithmException {
        Mac mac = (Mac) getCachedObject(MAC_CACHE, algorithm);
        
        if (mac == null) {
            return Mac.getInstance(algorithm);
        } else {
            return mac;
        }
    }
    
    public static void releaseMacInstance(Mac mac) {
        if (mac != null) {
            storeCachedObject(MAC_CACHE, mac.getAlgorithm(), mac);
        }
    }
    
    public static KeyGenerator getKeyGeneratorInstance(String algorithm) throws NoSuchAlgorithmException {
        KeyGenerator keyGenerator = (KeyGenerator) getCachedObject(KEY_GENERATOR_CACHE, algorithm);
        
        if (keyGenerator == null) {
            return KeyGenerator.getInstance(algorithm);
        } else {
            return keyGenerator;
        }
    }
    
    public static void releaseKeyGeneratorInstance(KeyGenerator keyGenerator) {
        if (keyGenerator != null) {
            storeCachedObject(KEY_GENERATOR_CACHE, keyGenerator.getAlgorithm(), keyGenerator);
        }
    }
    
    public static KeyPairGenerator getKeyPairGeneratorInstance(String algorithm) throws NoSuchAlgorithmException {
        KeyPairGenerator keyPairGenerator = (KeyPairGenerator) getCachedObject(KEY_PAIR_GENERATOR_CACHE, algorithm);
        
        if (keyPairGenerator == null) {
            return KeyPairGenerator.getInstance(algorithm);
        } else {
            return keyPairGenerator;
        }
    }
    
    public static void releaseKeyPairGeneratorInstance(KeyPairGenerator keyPairGenerator) {
        if (keyPairGenerator != null) {
            storeCachedObject(KEY_PAIR_GENERATOR_CACHE, keyPairGenerator.getAlgorithm(), keyPairGenerator);
        }
    }
    
    public static KeyFactory getKeyFactoryInstance(String algorithm) throws NoSuchAlgorithmException {
        KeyFactory keyFactory = (KeyFactory) getCachedObject(KEY_FACTORY_CACHE, algorithm);
        
        if (keyFactory == null) {
            return KeyFactory.getInstance(algorithm);
        } else {
            return keyFactory;
        }
    }
    
    public static void releaseKeyFactoryInstance(KeyFactory keyFactory) {
        if (keyFactory != null) {
            storeCachedObject(KEY_FACTORY_CACHE, keyFactory.getAlgorithm(), keyFactory);
        }
    }
    
    public static CertificateFactory getCertificateFactoryInstance(String algorithm) throws CertificateException {
        CertificateFactory certificateFactory = (CertificateFactory) getCachedObject(CERTIFICATE_FACTORY_CACHE, algorithm);
        
        if (certificateFactory == null) {
            return CertificateFactory.getInstance(algorithm);
        } else {
            return certificateFactory;
        }
    }
    
    public static void releaseCertificateFactoryInstance(CertificateFactory certificateFactory) {
        if (certificateFactory != null) {
            storeCachedObject(CERTIFICATE_FACTORY_CACHE, certificateFactory.getType(), certificateFactory);
        }
    }
    
    private static void storeCachedObject(Map<String, CachedEntriesList> cache, String algorithm, Object object) {
        CachedEntriesList entriesList = cache.get(algorithm);
        if (entriesList == null || entriesList.getCreationTime() > System.currentTimeMillis() + MAX_LIFETIME) {
            // if the cached list is too old, we wipe it out
            entriesList = new CachedEntriesList();
            cache.put(algorithm, entriesList);
        }
        
        entriesList.storeCacheEntry(object);
    }
    
    private static Object getCachedObject(Map<String, CachedEntriesList> cache, String algorithm) {
        CachedEntriesList entriesList = cache.get(algorithm);
        if (entriesList == null || entriesList.getCreationTime() > System.currentTimeMillis() + MAX_LIFETIME) {
            // if the cached list is too old, we wipe it out
            entriesList = new CachedEntriesList();
            cache.put(algorithm, entriesList);
        }
        
        return entriesList.getCachedEntry();
    }
    
    public static class CachedEntriesList  {
        private ConcurrentLinkedQueue<Object> cachedEntries = new ConcurrentLinkedQueue<>();
        private long creationTime;
        
        public CachedEntriesList() {
            creationTime = System.currentTimeMillis();
        }
        
        public Object getCachedEntry() {
            return cachedEntries.poll();
        }
        
        public void storeCacheEntry(Object value) {
            cachedEntries.add(value);
        }
        
        public long getCreationTime() {
            return creationTime;
        }
    }
}

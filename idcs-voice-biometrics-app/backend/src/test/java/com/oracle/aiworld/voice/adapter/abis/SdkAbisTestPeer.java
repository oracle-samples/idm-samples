package com.oracle.aiworld.voice.adapter.abis;
import com.oracle.voicebiometrics.*;
import com.oracle.common.*;
import com.google.protobuf.util.JsonFormat;
import java.net.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import org.json.*;

/** Local binary-protobuf peer. It exercises the real SDK socket and state machine. */
final class SdkAbisTestPeer implements AutoCloseable {
    interface Handler { void accept(SdkAbisTestPeer server, VoiceBiometricEvent.ClientBiometricEventData message) throws Exception; }
    final ServerSocket listener;
    final BlockingQueue<VoiceBiometricEvent.ClientBiometricEventData> messages = new LinkedBlockingQueue<>();
    final AtomicReference<Throwable> error = new AtomicReference<>();
    final AtomicInteger sequence = new AtomicInteger();
    final CountDownLatch resultObserved = new CountDownLatch(1);
    volatile int outputByteCount;
    volatile String handshakeRequest;
    volatile WebSocket peer;
    volatile Handler handler;
    volatile String terminalType = "VERIFICATION_COMPLETED";
    volatile int registrationSamples = 1;
    volatile JSONObject sessionReadyParameters;
    int receivedSamples;
    SdkAbisTestPeer() throws Exception { this(new ServerSocket(0, 1, InetAddress.getByName("127.0.0.1"))); }
    SdkAbisTestPeer(ServerSocket listener) throws Exception {
        this.listener = listener;
        Thread accept = new Thread(() -> {
            try {
                Socket accepted = listener.accept();
                peer = WebSocket.builder().socket(accepted).webSocketDelegate(new WebSocketDelegate() {
                    public void webSocketDelegateConnected(WebSocket socket, String request, String response) {
                        peer = socket;
                        handshakeRequest = request;
                        try { send("SESSION_READY", 0, "START_VOICE_CAPTURE", null); } catch (Exception e) { error.set(e); }
                    }
                    public void webSocketDelegateReadMessage(WebSocket socket, Object bytes) {
                        try {
                            var message = VoiceBiometricEvent.ClientToServerMessage.parseFrom((byte[]) bytes).getBiometricEvent().getData();
                            messages.add(message);
                            if (handler != null) handler.accept(SdkAbisTestPeer.this, message);
                            else respond(message);
                        } catch (Throwable e) { error.set(e); }
                    }
                    public void webSocketDelegateException(WebSocket socket, Exception e) { error.compareAndSet(null, e); }
                    public void webSocketDelegateDisconnected(WebSocket socket) {}
                    public void webSocketDelegateConnecting(WebSocket socket) {}
                    public void webSocketDelegateWroteMessage(WebSocket socket, Object message) {}
                    public void webSocketDelegateReceivedCloseMessage(WebSocket socket, int code, String message) {}
                }).build();
            } catch (Throwable e) { if (!listener.isClosed()) error.set(e); }
        }, "mock-abis-peer");
        accept.setDaemon(true); accept.start();
    }
    String origin() { return (listener instanceof javax.net.ssl.SSLServerSocket ? "wss://localhost:" : "ws://127.0.0.1:") + listener.getLocalPort(); }
    AbisRequestClient requests() {
        return (method, uri, body) -> {
            if ("POST".equals(method)) return new JSONObject().put("id", "session1").put("sessionToken", "FAKE_TOKEN");
            return new JSONObject().put("voiceBiometricRegistrationResult", new JSONObject()
                .put("biometricRecordId", "record1").put("utterance", new JSONObject().put("result", "SUCCESSFUL")));
        };
    }
    CloudSession cloud(SessionType type, VoiceSessionConfiguration config) throws Exception {
        CloudSessionDelegate delegate = (CloudSessionDelegate) java.lang.reflect.Proxy.newProxyInstance(
            getClass().getClassLoader(), new Class<?>[] {CloudSessionDelegate.class}, (proxy, method, args) -> {
                if (method.getName().equals("cloudSessionDelegateUtteranceResult")) resultObserved.countDown();
                return null;
            });
        var builder = CloudSession.builder().sessionType(type).cloudSessionDelegate(delegate)
            .sessionServerBaseURL("https://example.invalid/session").webSocketServerBaseURL(origin())
            .compartmentID("mock").biometricStoreID("mock").configuration(config).requestClient(requests());
        if (type == SessionType.verification) builder.biometricRecordID("record1");
        return builder.build();
    }
    void respond(VoiceBiometricEvent.ClientBiometricEventData message) throws Exception {
        long ack = message.getSequence();
        switch (message.getMessageType()) {
            case VOICE_CAPTURE_STARTED -> send("VOICE_CAPTURE_STARTED_ACK", ack, "RECORD_UTTERANCE", null);
            case UTTERANCE -> {
                if (terminalType.equals("VERIFICATION_COMPLETED")) {
                    send("UTTERANCE_ACCEPTED", ack, "RECORD_UTTERANCE", null);
                    send("UTTERANCE_VERIFICATION_RESULT", ack, "RECORD_UTTERANCE",
                        new JSONObject().put("code", "MATCH").put("message", "Synthetic match"));
                } else send("UTTERANCE_ACCEPTED", ack,
                    ++receivedSamples >= registrationSamples ? "WAIT" : "RECORD_UTTERANCE", null);
            }
            case VOICE_CAPTURE_ENDED -> {
                send("VOICE_CAPTURE_ENDED_ACK", ack, "WAIT", null);
                send(terminalType, ack, "SHOW_SUCCESS", null);
            }
            default -> throw new AssertionError("Unexpected client message");
        }
    }
    synchronized void send(String type, long ack, String action, JSONObject result) throws Exception {
        sendAs("session1", type, sequence.incrementAndGet(), ack, action, result);
    }
    synchronized void sendAs(String sessionId, String type, int seq, long ack, String action, JSONObject result) throws Exception {
        JSONObject data = new JSONObject().put("messageType", type).put("sequence", "" + seq)
            .put("ackClientSequence", "" + ack).put("action", action)
            .put("sessionStatus", type.endsWith("COMPLETED") || type.startsWith("REGISTRATION_")
                || type.equals("SESSION_EXPIRED") ? "CLOSED" : "OPEN");
        if (result != null) data.put("result", result);
        if (type.equals("SESSION_READY") && sessionReadyParameters != null)
            for (String key : sessionReadyParameters.keySet()) data.put(key, sessionReadyParameters.get(key));
        if (type.equals("UTTERANCE_REJECTED")) data.put("error", new JSONObject().put("code", "REQUEST_REJECTED"));
        var event = VoiceBiometricEvent.ServerToClientMessage.newBuilder();
        JsonFormat.parser().merge(new JSONObject().put("session", new JSONObject().put("sessionId", sessionId))
            .put("biometricEvent", new JSONObject().put("data", data)).toString(), event);
        byte[] encoded = event.build().toByteArray();
        outputByteCount += encoded.length + (encoded.length <= 125 ? 2 : encoded.length <= 65535 ? 4 : 10);
        if (!peer.write(encoded)) throw new IllegalStateException("Peer refused write");
    }
    VoiceBiometricEvent.ClientBiometricEventData take(VoiceBiometricEvent.ClientMessageType type) throws Exception {
        long until = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
        while (System.nanoTime() < until) {
            var message = messages.poll(50, TimeUnit.MILLISECONDS);
            if (message != null && message.getMessageType() == type) return message;
            if (error.get() != null) throw new AssertionError(error.get());
        }
        throw new AssertionError("Missing client message: " + type);
    }
    public void close() throws Exception {
        if (peer != null) peer.destruct(); listener.close();
    }
}

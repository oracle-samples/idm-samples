const statusEl = document.querySelector('#status');
const readerEl = document.querySelector('#reader');
const identityEl = document.querySelector('#identity');
const identityNameEl = document.querySelector('#identityName');
const identityMetaEl = document.querySelector('#identityMeta');
const signOutEl = document.querySelector('#signOut');
const signedOutEl = document.querySelector('#signedOut');
const signInEyebrowEl = document.querySelector('#signInEyebrow');
const signInTitleEl = document.querySelector('#signInTitle');
const signInMessageEl = document.querySelector('#signInMessage');
const signInLinkEl = document.querySelector('#signInLink');
const authenticatedContentEl = document.querySelector('#authenticatedContent');
const readerSelectEl = document.querySelector('#readerSelect');
const refreshReadersEl = document.querySelector('#refreshReaders');
const enrollFingerEl = document.querySelector('#enrollFinger');
const enrollSeed2El = document.querySelector('#enrollSeed2');
const verifyFingerEl = document.querySelector('#verifyFinger');
const verifySeed2El = document.querySelector('#verifySeed2');
const enrollPinErrorEl = document.querySelector('#enrollPinError');
const verifyPinErrorEl = document.querySelector('#verifyPinError');
const beginEnrollmentEl = document.querySelector('#beginEnrollment');
const verifyFingerprintEl = document.querySelector('#verifyFingerprint');
const unenrollFingerprintEl = document.querySelector('#unenrollFingerprint');

const consentDialogEl = document.querySelector('#enrollmentConsent');
const consentTitleEl = document.querySelector('#consentTitle');
const consentStatementEl = document.querySelector('#consentStatement');
const consentErrorEl = document.querySelector('#consentError');
const agreeEnrollmentEl = document.querySelector('#agreeEnrollment');
const declineEnrollmentEl = document.querySelector('#declineEnrollment');

const unenrollmentDialogEl = document.querySelector('#unenrollmentConfirmation');
const unenrollmentTitleEl = document.querySelector('#unenrollmentTitle');
const confirmUnenrollmentEl = document.querySelector('#confirmUnenrollment');
const cancelUnenrollmentEl = document.querySelector('#cancelUnenrollment');

const outcomeScreenEl = document.querySelector('#outcomeScreen');
const outcomeIconEl = document.querySelector('#outcomeIcon');
const outcomeEyebrowEl = document.querySelector('#outcomeEyebrow');
const outcomeTitleEl = document.querySelector('#outcomeTitle');
const outcomeMessageEl = document.querySelector('#outcomeMessage');
const outcomeReferenceWrapEl = document.querySelector('#outcomeReferenceWrap');
const outcomeReferenceEl = document.querySelector('#outcomeReference');
const outcomePrimaryEl = document.querySelector('#outcomePrimary');
const outcomeBackEl = document.querySelector('#outcomeBack');

let initialReaderLoadPending = true;
let readerLoadInProgress = false;
let readerPreparationInProgress = false;
let operationInProgress = false;
let enrollmentState = 'idle';
let pendingEnrollment = null;
let outcomePrimaryAction = null;
let hadAuthenticatedSession = false;

configurePinValidation(enrollSeed2El);
configurePinValidation(verifySeed2El);

function setStatus(message, tone = '') {
  statusEl.textContent = message;
  statusEl.className = tone;
}

function normalizedStatus(value) {
  return String(value || '').trim().toUpperCase();
}

function safeReference(source) {
  if (!source || typeof source !== 'object') {
    return '';
  }

  const candidate =
    source.transactionId ??
    source.reference ??
    source.referenceId ??
    source.clientReferenceId ??
    source.ecId;
  if (typeof candidate !== 'string' && typeof candidate !== 'number') {
    return '';
  }

  const value = String(candidate).trim();
  return value && value.length <= 160 ? value : '';
}

function safeResultMessage(value, fallback) {
  return typeof value === 'string' && value.trim() && value.length <= 500
    ? value.trim()
    : fallback;
}

function safeCaptureError(error) {
  const message = String(error && error.message || '');
  return /(quality|pad|liveness|reader|finger|capture|reposition|presentation)/i.test(message) &&
    message.length <= 300
    ? message
    : 'The fingerprint capture could not be completed. Check the reader and try again.';
}

function isCaptureFailure(error) {
  return /^(CAPTURE_|BRIDGE_)/.test(String(error && error.code || ''));
}

function requirePin(input) {
  if (/^[0-9]{6,19}$/.test(input.value.trim())) return true;
  const message = 'Enter a numeric PIN number with 6 to 19 digits.';
  showPinError(input, message);
  input.focus();
  return false;
}

function configurePinValidation(input) {
  input.addEventListener('input', () => {
    if (/^[0-9]{6,19}$/.test(input.value.trim())) {
      clearPinError(input);
    }
  });
}

function pinErrorElement(input) {
  return input === enrollSeed2El ? enrollPinErrorEl : verifyPinErrorEl;
}

function showPinError(input, message) {
  const errorEl = pinErrorElement(input);
  input.setAttribute('aria-invalid', 'true');
  errorEl.textContent = message;
  errorEl.hidden = false;
}

function clearPinError(input) {
  const errorEl = pinErrorElement(input);
  input.removeAttribute('aria-invalid');
  errorEl.hidden = true;
  errorEl.textContent = '';
}

function isAlreadyEnrolled(value) {
  const status = normalizedStatus(value && (value.status || value.code));
  const message = String(value && value.message || '');
  return status.includes('ALREADY_ENROLLED') || /already enrolled/i.test(message);
}

function syncWorkspaceControls() {
  const busy =
    operationInProgress ||
    enrollmentState !== 'idle' ||
    readerLoadInProgress ||
    readerPreparationInProgress;
  const apiInProgress =
    operationInProgress ||
    readerLoadInProgress ||
    readerPreparationInProgress ||
    ['initiating', 'continuing', 'cancelling'].includes(enrollmentState);

  document.body.classList.toggle('api-operation-in-progress', apiInProgress);

  beginEnrollmentEl.disabled = busy;
  verifyFingerprintEl.disabled = busy;
  unenrollFingerprintEl.disabled = busy;
  enrollFingerEl.disabled = busy;
  enrollSeed2El.disabled = busy;
  verifyFingerEl.disabled = busy;
  verifySeed2El.disabled = busy;
  readerSelectEl.disabled = busy;
  refreshReadersEl.disabled = busy;
  signOutEl.disabled = busy;
}

function setConsentBusy(busy) {
  consentDialogEl.setAttribute('aria-busy', String(busy));
  agreeEnrollmentEl.disabled = busy;
  declineEnrollmentEl.disabled = busy;
}

function setConsentError(message = '') {
  consentErrorEl.textContent = message;
  consentErrorEl.hidden = !message;
}

function resetEnrollmentFlow({ restoreFocus = false } = {}) {
  pendingEnrollment = null;
  enrollmentState = 'idle';
  setConsentBusy(false);
  setConsentError();
  consentStatementEl.textContent = '';
  consentStatementEl.removeAttribute('lang');
  agreeEnrollmentEl.textContent = 'Agree and capture';

  if (consentDialogEl.open) {
    consentDialogEl.close();
  }

  syncWorkspaceControls();
  if (restoreFocus && !authenticatedContentEl.hidden) {
    beginEnrollmentEl.focus();
  }
}

async function api(url, data) {
  const response = await fetch(url, {
    method: data === undefined ? 'GET' : 'POST',
    headers: data === undefined ? {} : { 'Content-Type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  let json = {};

  try {
    json = await response.json();
  } catch {
    json = {};
  }

  if (!response.ok) {
    const error = new Error(json.error || json.message || 'Request failed');
    error.retryable = json.retryable === true;
    error.code = json.code;
    error.httpStatus = response.status;
    error.reference = safeReference(json);
    throw error;
  }

  return json;
}

function showSignedOut({ expired = false, focus = false } = {}) {
  resetEnrollmentFlow();
  operationInProgress = false;
  if (!expired) {
    hadAuthenticatedSession = false;
  }
  syncWorkspaceControls();

  identityEl.hidden = true;
  readerEl.hidden = true;
  signOutEl.hidden = true;
  authenticatedContentEl.hidden = true;
  outcomeScreenEl.hidden = true;
  signedOutEl.hidden = false;

  signInEyebrowEl.textContent = expired ? 'SESSION EXPIRED' : 'AUTHENTICATION REQUIRED';
  signInTitleEl.textContent = expired ? 'Your session has expired' : 'Sign in to continue';
  signInMessageEl.textContent = expired
    ? 'Sign in again before continuing fingerprint enrollment or verification.'
    : 'Sign in with your OCI IAM account before enrolling or verifying a fingerprint.';

  if (focus) {
    signInTitleEl.setAttribute('tabindex', '-1');
    signInTitleEl.focus();
  }
}

function showAuthenticated(session) {
  hadAuthenticatedSession = true;
  identityNameEl.textContent = session.user.name;
  identityMetaEl.textContent = session.user.email;
  identityEl.hidden = false;
  readerEl.hidden = false;
  signOutEl.hidden = false;
  signedOutEl.hidden = true;

  if (outcomeScreenEl.hidden && !consentDialogEl.open) {
    authenticatedContentEl.hidden = false;
  }
}

function handleSessionError(error) {
  if (!error || error.code !== 'SIGN_IN_REQUIRED') {
    return false;
  }

  showSignedOut({ expired: hadAuthenticatedSession, focus: true });
  return true;
}

function showOutcome({
  tone,
  eyebrow,
  title,
  message,
  reference = '',
  primaryLabel = '',
  primaryAction = null,
  backLabel = 'Back',
}) {
  const icons = { success: '✓', warning: '!', error: '×', neutral: 'i' };
  outcomePrimaryAction = primaryAction;
  authenticatedContentEl.hidden = true;
  signedOutEl.hidden = true;
  outcomeScreenEl.hidden = false;
  outcomeScreenEl.className = `outcome-screen outcome-${tone}`;
  outcomeIconEl.textContent = icons[tone] || icons.neutral;
  outcomeEyebrowEl.textContent = eyebrow;
  outcomeTitleEl.textContent = title;
  outcomeMessageEl.textContent = message;
  outcomeBackEl.textContent = backLabel;

  outcomeReferenceEl.textContent = reference;
  outcomeReferenceWrapEl.hidden = !reference;
  outcomePrimaryEl.textContent = primaryLabel;
  outcomePrimaryEl.hidden = !primaryLabel || !primaryAction;

  outcomeTitleEl.focus();
}

function returnToWorkspace(focusTarget = beginEnrollmentEl) {
  if (!signedOutEl.hidden) {
    return;
  }

  outcomePrimaryAction = null;
  outcomeScreenEl.hidden = true;
  authenticatedContentEl.hidden = false;
  setStatus('Ready. Select a reader and choose an operation.');
  focusTarget.focus();
}

function showEnrollmentAlready(result) {
  showOutcome({
    tone: 'warning',
    eyebrow: 'ENROLLMENT NOT CHANGED',
    title: 'A fingerprint is already enrolled',
    message:
      'Verify the existing fingerprint, or choose Back and then Unenroll fingerprint to remove the test enrollment before starting a new one. Nothing has been removed automatically.',
    reference: safeReference(result),
    primaryLabel: 'Verify fingerprint',
    primaryAction: 'verify',
  });
}

function showEnrollmentFailure(error, title = 'Enrollment could not be completed') {
  if (isCaptureFailure(error)) {
    showOutcome({
      tone: 'warning',
      eyebrow: 'CAPTURE NEEDS ATTENTION',
      title: 'Fingerprint capture could not be completed',
      message: safeCaptureError(error),
      reference: error && (error.reference || safeReference(error)),
      primaryLabel: 'Begin enrollment again',
      primaryAction: 'enroll',
    });
    return;
  }

  showOutcome({
    tone: 'error',
    eyebrow: 'ENROLLMENT FAILED',
    title,
    message: safeResultMessage(
      error && error.message,
      'IAM could not complete fingerprint enrollment. Try again, or use the transaction reference when requesting support.',
    ),
    reference: error && (error.reference || safeReference(error)),
    primaryLabel: 'Try enrollment again',
    primaryAction: 'enroll',
  });
}

function showEnrollmentResult(result) {
  if (isAlreadyEnrolled(result)) {
    showEnrollmentAlready(result);
    return;
  }

  const status = normalizedStatus(result && (result.status || result.outcome));
  if (['ENROLLED', 'SUCCESS', 'SUCCEEDED', 'COMPLETED'].includes(status)) {
    showOutcome({
      tone: 'success',
      eyebrow: 'ENROLLMENT COMPLETE',
      title: 'Fingerprint enrolled successfully',
      message: safeResultMessage(
        result.message,
        'The fingerprint is now bound to the signed-in IAM user.',
      ),
      reference: safeReference(result),
      primaryLabel: 'Verify fingerprint',
      primaryAction: 'verify',
    });
    return;
  }

  showEnrollmentFailure({ reference: safeReference(result) });
}

function showVerificationResult(result) {
  const status = normalizedStatus(result && (result.status || result.outcome));
  const reference = safeReference(result);

  if (status === 'NOT_ENROLLED') {
    showOutcome({
      tone: 'warning',
      eyebrow: 'VERIFICATION NOT STARTED',
      title: 'No fingerprint enrollment found',
      message: safeResultMessage(
        result && result.message,
        'IAM reports that this user has no fingerprint enrollment. Verification stopped before fingerprint capture.',
      ),
      reference,
      primaryLabel: 'Begin enrollment',
      primaryAction: 'enroll',
    });
    return;
  }

  if (status === 'MATCH') {
    showOutcome({
      tone: 'success',
      eyebrow: 'VERIFICATION COMPLETE',
      title: 'Fingerprint verified',
      message: safeResultMessage(
        result.message,
        'The captured fingerprint matches the enrolled reference.',
      ),
      reference,
      primaryLabel: 'Verify again',
      primaryAction: 'verify',
    });
    return;
  }

  if (status === 'NO_MATCH') {
    showOutcome({
      tone: 'error',
      eyebrow: 'VERIFICATION RESULT',
      title: 'Fingerprint or PIN number did not match',
      message: safeResultMessage(
        result.message,
        'The captured fingerprint or PIN number did not match the enrolled reference.',
      ),
      reference,
      primaryLabel: 'Try verification again',
      primaryAction: 'verify',
    });
    return;
  }

  if (status === 'INCONCLUSIVE') {
    showOutcome({
      tone: 'warning',
      eyebrow: 'VERIFICATION INCONCLUSIVE',
      title: 'IAM could not determine a match',
      message: safeResultMessage(
        result.message,
        'No conclusive verification result was returned. Reposition the finger and try again.',
      ),
      reference,
      primaryLabel: 'Try verification again',
      primaryAction: 'verify',
    });
    return;
  }

  showVerificationFailure({ reference });
}

function showVerificationFailure(error) {
  if (error && error.code === 'FINGERPRINT_FACTOR_AMBIGUOUS') {
    showOutcome({
      tone: 'warning',
      eyebrow: 'FACTOR SELECTION REQUIRED',
      title: 'Multiple fingerprint enrollments need attention',
      message:
        'IAM returned more than one fingerprint factor, so the app did not choose one or capture a fingerprint. Unenroll the test fingerprints and enroll the intended reader again, or add explicit factor selection.',
      reference: error.reference || safeReference(error),
      primaryLabel: 'Unenroll test fingerprints',
      primaryAction: 'unenroll',
    });
    return;
  }

  if (
    error &&
    ['FINGERPRINT_NOT_ENROLLED', 'NOT_ENROLLED'].includes(String(error.code || ''))
  ) {
    showVerificationResult({
      status: 'NOT_ENROLLED',
      message: error.message,
      reference: error.reference,
    });
    return;
  }

  if (error && error.code === 'UPSTREAM_TIMEOUT') {
    showOutcome({
      tone: 'warning',
      eyebrow: 'VERIFICATION INCONCLUSIVE',
      title: 'IAM verification timed out',
      message: 'IAM did not return a match decision before the timeout. No verification result was assumed.',
      reference: error.reference || safeReference(error),
      primaryLabel: 'Try verification again',
      primaryAction: 'verify',
    });
    return;
  }

  if (isCaptureFailure(error)) {
    showOutcome({
      tone: 'warning',
      eyebrow: 'CAPTURE NEEDS ATTENTION',
      title: 'A usable fingerprint was not captured',
      message: safeCaptureError(error),
      reference: error.reference || safeReference(error),
      primaryLabel: error.retryable ? 'Retry capture' : 'Try verification again',
      primaryAction: 'verify',
    });
    return;
  }

  showOutcome({
    tone: 'error',
    eyebrow: 'VERIFICATION ERROR',
    title: 'Verification could not be completed',
    message: safeResultMessage(
      error && error.message,
      'A technical error prevented IAM from completing verification. Check the reader and try again.',
    ),
    reference: error && (error.reference || safeReference(error)),
    primaryLabel: 'Try verification again',
    primaryAction: 'verify',
  });
}

async function refresh() {
  try {
    const session = await api('/api/session');
    showAuthenticated(session);
    await refreshBridge();
  } catch (error) {
    showSignedOut({ expired: hadAuthenticatedSession, focus: hadAuthenticatedSession });
  }
}

async function refreshBridge() {
  try {
    await api('/api/bridge');
    readerEl.textContent = 'BRIDGE CONNECTED';
    readerEl.className = 'badge good';
    if (initialReaderLoadPending && !authenticatedContentEl.hidden) {
      await loadReaders();
    }
    return true;
  } catch (error) {
    if (handleSessionError(error)) {
      return false;
    }
    readerEl.textContent = 'BRIDGE UNAVAILABLE';
    readerEl.className = 'badge bad';
    return false;
  }
}

async function loadReaders() {
  if (readerLoadInProgress || enrollmentState !== 'idle' || operationInProgress) {
    return;
  }

  readerLoadInProgress = true;
  syncWorkspaceControls();
  const previousReader = readerSelectEl.value;

  try {
    const result = await api('/api/readers');
    const readers = Array.isArray(result.readers) ? result.readers : [];
    readerSelectEl.replaceChildren();
    for (const [index, reader] of readers.entries()) {
      const option = new Option(readerDisplayLabel(reader.label, index, readers.length), reader.id);
      option.title = reader.label;
      readerSelectEl.add(option);
    }

    if (readers.length) {
      readerSelectEl.value = readers.some((reader) => reader.id === previousReader)
        ? previousReader
        : readers[0].id;
      await prepareSelectedReader();
      initialReaderLoadPending = false;
    }

    setStatus(
      readers.length
        ? 'Selected reader is ready for enrollment or verification.'
        : 'No fingerprint readers found.',
      readers.length ? '' : 'badtext',
    );
  } catch (error) {
    if (!handleSessionError(error)) {
      setStatus('Could not refresh fingerprint readers. Check the bridge and try again.', 'badtext');
    }
  } finally {
    readerLoadInProgress = false;
    syncWorkspaceControls();
  }
}

function readerDisplayLabel(label, index, readerCount) {
  const rawLabel = String(label || '').trim();
  const metadata = rawLabel.match(
    /\[vendor=(.*?)\s*\(0x[0-9a-f]+\);\s*product=(.*?)\s*\(0x[0-9a-f]+\)\]/i,
  );
  if (!metadata) return rawLabel || `Fingerprint reader ${index + 1}`;

  const vendor = metadata[1].trim();
  const product = metadata[2].trim();
  const name = [vendor, product].filter(Boolean).join(' — ');
  if (!name) return `Fingerprint reader ${index + 1}`;
  return readerCount > 1 ? `${name} (${index + 1})` : name;
}

async function prepareSelectedReader() {
  if (!readerSelectEl.value) {
    return;
  }

  readerPreparationInProgress = true;
  syncWorkspaceControls();
  setStatus('Preparing selected reader…');

  try {
    await api('/api/readers/select', { reader: readerSelectEl.value });
    setStatus('Selected reader is ready.');
  } finally {
    readerPreparationInProgress = false;
    syncWorkspaceControls();
  }
}

function requireSelectedReader() {
  if (readerSelectEl.value) {
    return true;
  }

  setStatus('Select and prepare a fingerprint reader first.', 'badtext');
  refreshReadersEl.focus();
  return false;
}

async function beginEnrollment() {
  if (enrollmentState !== 'idle' || operationInProgress || !requireSelectedReader() || !requirePin(enrollSeed2El)) {
    return;
  }

  enrollmentState = 'initiating';
  syncWorkspaceControls();
  setStatus('Requesting IAM enrollment consent. No fingerprint is being captured yet.');

  try {
    const result = await api('/api/enroll/initiate', {
      finger: enrollFingerEl.value,
      reader: readerSelectEl.value,
      seed2: enrollSeed2El.value,
    });

    if (
      typeof result.flowId !== 'string' ||
      !result.flowId ||
      typeof result.consentText !== 'string' ||
      !result.consentText.trim()
    ) {
      throw new Error('IAM did not return a usable consent request.');
    }

    pendingEnrollment = { flowId: result.flowId };
    enrollmentState = 'awaiting-consent';
    syncWorkspaceControls();
    consentStatementEl.textContent = result.consentText;
    if (
      typeof result.consentLocale === 'string' &&
      /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(result.consentLocale)
    ) {
      consentStatementEl.setAttribute('lang', result.consentLocale);
    }

    setConsentError();
    setConsentBusy(false);
    consentDialogEl.showModal();
    consentTitleEl.focus();
    setStatus('Review the IAM consent statement before fingerprint capture.');
  } catch (error) {
    if (handleSessionError(error)) {
      return;
    }

    resetEnrollmentFlow();
    if (isAlreadyEnrolled(error)) {
      showEnrollmentAlready({ message: error.message, reference: error.reference });
    } else {
      showEnrollmentFailure(error, 'Enrollment could not be started');
    }
  }
}

async function continueEnrollment() {
  if (enrollmentState !== 'awaiting-consent' || !pendingEnrollment || !requirePin(enrollSeed2El)) {
    return;
  }

  enrollmentState = 'continuing';
  setConsentBusy(true);
  syncWorkspaceControls();
  setConsentError();
  setStatus('Consent accepted. Waiting for fingerprint capture…');

  try {
    const result = await api('/api/enroll/continue', {
      flowId: pendingEnrollment.flowId,
      action: 'ACCEPTED',
      seed2: enrollSeed2El.value,
    });

    resetEnrollmentFlow();
    showEnrollmentResult(result);
  } catch (error) {
    if (handleSessionError(error)) {
      return;
    }

    if (error.retryable) {
      enrollmentState = 'awaiting-consent';
      setConsentBusy(false);
      syncWorkspaceControls();
      const captureFailed = isCaptureFailure(error);
      agreeEnrollmentEl.textContent = captureFailed ? 'Agree and retry capture' : 'Agree and retry enrollment';
      const message = captureFailed
        ? safeCaptureError(error)
        : safeResultMessage(
            error && error.message,
            'IAM could not complete the request. You can retry this enrollment or decline consent.',
          );
      setConsentError(message);
      setStatus(`${captureFailed ? 'Capture' : 'Enrollment'} needs attention: ${message}`, 'badtext');
      agreeEnrollmentEl.focus();
      return;
    }

    resetEnrollmentFlow();
    if (isAlreadyEnrolled(error)) {
      showEnrollmentAlready({ message: error.message, reference: error.reference });
    } else {
      showEnrollmentFailure(error);
    }
  }
}

async function declineEnrollment() {
  if (enrollmentState !== 'awaiting-consent' || !pendingEnrollment) {
    return;
  }

  const { flowId } = pendingEnrollment;
  enrollmentState = 'cancelling';
  setConsentBusy(true);
  syncWorkspaceControls();
  setConsentError();
  setStatus('Declining fingerprint enrollment consent…');

  let result = null;
  let cancellationError = null;
  try {
    result = await api('/api/enroll/cancel', { flowId });
  } catch (error) {
    cancellationError = error;
  }

  if (handleSessionError(cancellationError)) {
    return;
  }

  const iamAcknowledged = Boolean(
    !cancellationError && result && result.iamAcknowledged === true,
  );
  const iamError = safeResultMessage(
    cancellationError && cancellationError.message || result && result.message,
    'The app could not confirm that IAM recorded the decline.',
  );
  resetEnrollmentFlow();
  showOutcome({
    tone: 'neutral',
    eyebrow: 'CONSENT DECLINED',
    title: 'Fingerprint enrollment was not continued',
    message: iamAcknowledged
      ? 'IAM recorded the declined consent. No fingerprint data was submitted for enrollment.'
      : `Decline did not submit fingerprint data. IAM reported: ${iamError}`,
    reference: safeReference(result) || cancellationError && cancellationError.reference || '',
    primaryLabel: 'Begin enrollment again',
    primaryAction: 'enroll',
  });
}

async function verifyFingerprint() {
  if (operationInProgress || enrollmentState !== 'idle' || !requireSelectedReader() || !requirePin(verifySeed2El)) {
    return;
  }

  operationInProgress = true;
  syncWorkspaceControls();
  setStatus('Preparing and verifying fingerprint…');

  try {
    const result = await api('/api/verify', {
      finger: verifyFingerEl.value,
      reader: readerSelectEl.value,
      seed2: verifySeed2El.value,
    });
    operationInProgress = false;
    syncWorkspaceControls();
    showVerificationResult(result);
  } catch (error) {
    operationInProgress = false;
    syncWorkspaceControls();
    if (!handleSessionError(error)) {
      showVerificationFailure(error);
    }
  }
}

function showUnenrollmentResult(result) {
  const status = normalizedStatus(result && (result.status || result.outcome));
  const reference = safeReference(result);

  if (status === 'NOT_ENROLLED') {
    showOutcome({
      tone: 'warning',
      eyebrow: 'NOTHING TO REMOVE',
      title: 'No fingerprint enrollment found',
      message: safeResultMessage(
        result && result.message,
        'IAM reports that this user has no fingerprint enrollment.',
      ),
      reference,
      primaryLabel: 'Begin enrollment',
      primaryAction: 'enroll',
    });
    return;
  }

  if (['UNENROLLED', 'DELETED', 'SUCCESS'].includes(status)) {
    showOutcome({
      tone: 'success',
      eyebrow: 'UNENROLLMENT COMPLETE',
      title: 'Fingerprint enrollment removed',
      message: safeResultMessage(
        result && result.message,
        'The test fingerprint enrollment was removed.',
      ),
      reference,
      primaryLabel: 'Begin enrollment',
      primaryAction: 'enroll',
    });
    return;
  }

  showUnenrollmentFailure({ reference });
}

function showUnenrollmentFailure(error) {
  showOutcome({
    tone: 'error',
    eyebrow: 'UNENROLLMENT FAILED',
    title: 'Fingerprint could not be unenrolled',
    message: safeResultMessage(
      error && error.message,
      'IAM could not remove the fingerprint enrollment. Try again, or use the transaction reference when requesting support.',
    ),
    reference: error && (error.reference || safeReference(error)),
    primaryLabel: 'Try unenrollment again',
    primaryAction: 'unenroll',
  });
}

async function unenrollFingerprint() {
  if (
    operationInProgress ||
    enrollmentState !== 'idle'
  ) {
    return;
  }

  operationInProgress = true;
  syncWorkspaceControls();
  setStatus('Removing the test fingerprint enrollment…');

  try {
    const result = await api('/api/unenroll', {});
    operationInProgress = false;
    syncWorkspaceControls();
    showUnenrollmentResult(result);
  } catch (error) {
    operationInProgress = false;
    syncWorkspaceControls();
    if (!handleSessionError(error)) {
      showUnenrollmentFailure(error);
    }
  }
}

function requestUnenrollment() {
  if (operationInProgress || enrollmentState !== 'idle' || unenrollmentDialogEl.open) {
    return;
  }

  unenrollmentDialogEl.showModal();
  unenrollmentTitleEl.focus();
}

function cancelUnenrollment() {
  if (!unenrollmentDialogEl.open) {
    return;
  }

  unenrollmentDialogEl.close();
  if (!authenticatedContentEl.hidden) {
    unenrollFingerprintEl.focus();
  }
}

refreshReadersEl.addEventListener('click', () => {
  void loadReaders();
});

readerSelectEl.addEventListener('change', async () => {
  try {
    await prepareSelectedReader();
  } catch (error) {
    if (!handleSessionError(error)) {
      setStatus('Could not prepare the selected reader. Refresh readers and try again.', 'badtext');
    }
  }
});

signOutEl.addEventListener('click', async () => {
  signOutEl.disabled = true;

  try {
    const response = await fetch('/logout', { method: 'POST' });
    if (!response.ok) {
      throw new Error('Sign-out failed.');
    }
    showSignedOut();
  } catch {
    setStatus('Sign-out could not be completed. Try again.', 'badtext');
  } finally {
    signOutEl.disabled = false;
  }
});

beginEnrollmentEl.addEventListener('click', () => {
  void beginEnrollment();
});

agreeEnrollmentEl.addEventListener('click', () => {
  void continueEnrollment();
});

declineEnrollmentEl.addEventListener('click', () => {
  void declineEnrollment();
});

confirmUnenrollmentEl.addEventListener('click', () => {
  if (unenrollmentDialogEl.open) {
    unenrollmentDialogEl.close();
  }
  void unenrollFingerprint();
});

cancelUnenrollmentEl.addEventListener('click', cancelUnenrollment);

unenrollmentDialogEl.addEventListener('cancel', (event) => {
  event.preventDefault();
  cancelUnenrollment();
});

consentDialogEl.addEventListener('cancel', (event) => {
  event.preventDefault();
  if (enrollmentState === 'awaiting-consent') {
    void declineEnrollment();
  }
});

document.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) {
    return;
  }

  const control = event.target.closest('[data-action]');
  if (!control) {
    return;
  }

  if (control.dataset.action === 'verify') {
    void verifyFingerprint();
  } else if (control.dataset.action === 'unenroll') {
    requestUnenrollment();
  }
});

outcomePrimaryEl.addEventListener('click', () => {
  const action = outcomePrimaryAction;
  if (action === 'enroll') {
    returnToWorkspace(beginEnrollmentEl);
    void beginEnrollment();
  } else if (action === 'verify') {
    returnToWorkspace(verifyFingerprintEl);
    void verifyFingerprint();
  } else if (action === 'unenroll') {
    returnToWorkspace(unenrollFingerprintEl);
    requestUnenrollment();
  }
});

outcomeBackEl.addEventListener('click', () => {
  returnToWorkspace();
});

refresh();
setInterval(refreshBridge, 5000);

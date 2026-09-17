/*
  ============================================================================
    ESP32 FINGERPRINT ERP ATTENDANCE MACHINE - HARDENED VERSION
  ============================================================================

  Existing functions preserved:
    - Fingerprint attendance
    - Frontend-controlled enrollment through backend polling
    - OLED status screens
    - Green/red LED + buzzer feedback
    - Serial diagnostic commands
    - Physical sensor slot check/delete
    - Device-authenticated HTTP API

  Main reliability improvements:
    1. OLED heartbeat + I2C presence check + automatic OLED re-initialization.
    2. Stable-finger confirmation before attendance fingerprint search to reduce
       false/noise-triggered scans.
    3. A second confirmation search is required before declaring "No Match".
    4. Enrollment result is persisted in NVS and retried until backend accepts it.
    5. Enrollment is NOT reported successful when verification is skipped/fails.
    6. Attendance requests include a persistent idempotency/event ID.
    7. Wi-Fi retry/backoff prevents constant reconnect loops.
    8. Sensor-slot code 12 is treated as an empty slot only when the sensor
       database is confirmed empty; otherwise it is treated as an error.
    9. Runtime reset/heap diagnostics are printed at startup.

  IMPORTANT HARDWARE NOTE:
    A boot-time "csum err" is a flash/power/board/flash-configuration problem.
    No application sketch can guarantee a fix for a corrupted SPI flash read.
    This sketch adds diagnostics and reduces runtime stress, but the board still
    must be flashed cleanly and powered stably.

  BACKEND CONTRACT:

  GET /api/device/fingerprint-enroll/pending
      Headers: x-device-code, x-device-secret
      Response with job:
        {
          "success": true,
          "data": {
            "enrollmentId": 12,
            "employeeId": 25,
            "sensorSlot": 7,
            "fingerName": "Right Thumb"
          }
        }
      Response without job:
        { "success": true, "data": null }

  POST /api/device/fingerprint-enroll/result
      Headers: x-device-code, x-device-secret
      Body:
        {
          "enrollmentId": 12,
          "employeeId": 25,
          "sensorSlot": 7,
          "fingerName": "Right Thumb",
          "success": true,
          "confidence": 120,
          "error": "..."
        }
      The same enrollmentId may be submitted more than once. The backend must
      handle this endpoint idempotently.

  POST /api/device/fingerprint-enroll/log
      Headers: x-device-code, x-device-secret
      Body:
        { "enrollmentId": 12, "message": "..." }

  POST /api/attendance/punch
      Headers: x-device-code, x-device-secret, Idempotency-Key
      Body:
        {
          "sensorSlot": 7,
          "eventId": "ESP32-001-..."
        }
      IMPORTANT: To fully prevent duplicate IN/OUT records after a network
      timeout, the backend must persist eventId/Idempotency-Key and ignore an
      already-processed eventId.

  SECURITY:
    Rotate the device secret before production because the previous source file
    exposed the secret in plain text.
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <esp_system.h>

#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Adafruit_Fingerprint.h>

// ============================================================================
// WIFI CONFIGURATION
// ============================================================================

const char* WIFI_SSID = "Dharm's S24";
const char* WIFI_PASSWORD = "Bhadani@99";

// ============================================================================
// ERP BACKEND CONFIGURATION
// ============================================================================

const char* BACKEND_BASE_URL = "http://10.72.179.69:5000";
const char* DEVICE_CODE = "ESP32-001";
const char* DEVICE_SECRET = "c008c665a1ee695f7d088dc98da43f91e772c98fc388695d08bd34ab4c7c1b93";

const char* ATTENDANCE_ENDPOINT = "/api/attendance/punch";
const char* ENROLLMENT_PENDING_ENDPOINT = "/api/device/fingerprint-enroll/pending";
const char* ENROLLMENT_RESULT_ENDPOINT = "/api/device/fingerprint-enroll/result";
const char* ENROLLMENT_LOG_ENDPOINT = "/api/device/fingerprint-enroll/log";

// ============================================================================
// TIMING
// ============================================================================

const unsigned long ENROLLMENT_POLL_INTERVAL = 5000;
const unsigned long ENROLLMENT_RESULT_RETRY_INTERVAL = 10000;
const unsigned long ATTENDANCE_SCAN_INTERVAL = 150;
const unsigned long ATTENDANCE_EVENT_COOLDOWN = 2500;

const unsigned long STARTUP_STATUS_DISPLAY_MS = 900;
const unsigned long STARTUP_BACKEND_RETRY_DELAY_MS = 1000;
const uint8_t STARTUP_BACKEND_RETRIES = 3;

const uint16_t HTTP_CONNECT_TIMEOUT = 3000;
const uint16_t HTTP_TIMEOUT = 8000;

const unsigned long ENROLLMENT_STAGE_TIMEOUT = 30000;
const unsigned long FINGER_REMOVAL_TIMEOUT = 15000;

// Wi-Fi retry control.
const unsigned long WIFI_CONNECT_TIMEOUT = 8000;
const unsigned long WIFI_RETRY_INTERVAL = 10000;

// Attendance false-trigger filtering.
const unsigned long FINGER_CONFIRM_DELAY_MS = 90;
const unsigned long SECOND_MATCH_CONFIRM_TIMEOUT_MS = 1800;
const uint8_t ATTENDANCE_NO_MATCH_CONFIRMATIONS = 2;

// OLED reliability.
const unsigned long OLED_HEARTBEAT_INTERVAL = 5000;
const unsigned long OLED_RECOVERY_INTERVAL = 15000;
const uint16_t OLED_I2C_TIMEOUT_MS = 60;
const uint32_t OLED_I2C_CLOCK_HZ = 100000;

// Sensor-specific behavior observed on this project.
const uint8_t SENSOR_EMPTY_DB_ERROR_CODE = 12;

unsigned long lastAttendanceScan = 0;
unsigned long lastEnrollmentPoll = 0;
unsigned long lastEnrollmentResultRetry = 0;
unsigned long lastAttendanceEvent = 0;
unsigned long lastWiFiAttempt = 0;

// ============================================================================
// FINGERPRINT SENSOR PINS
// ============================================================================

#define FINGERPRINT_RX 16
#define FINGERPRINT_TX 17

// ============================================================================
// OUTPUT PINS
// ============================================================================

#define GREEN_LED 25
#define RED_LED   26
#define BUZZER    27

// ============================================================================
// OLED CONFIGURATION
// ============================================================================

#define OLED_SDA 21
#define OLED_SCL 22
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
#define OLED_ADDRESS 0x3C

Adafruit_SSD1306 display(
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  &Wire,
  OLED_RESET
);

bool oledInitialized = false;
String oledLine1 = "";
String oledLine2 = "";
String oledLine3 = "";
String oledLine4 = "";

unsigned long lastOLEDRefresh = 0;
unsigned long lastOLEDRecovery = 0;

// ============================================================================
// FINGERPRINT SENSOR
// ============================================================================

HardwareSerial FingerSerial(2);
Adafruit_Fingerprint finger = Adafruit_Fingerprint(&FingerSerial);

bool fingerprintInitialized = false;

// ============================================================================
// MACHINE MODE
// ============================================================================

enum MachineMode {
  ATTENDANCE_MODE,
  ENROLLMENT_MODE
};

MachineMode currentMode = ATTENDANCE_MODE;

// ============================================================================
// ENROLLMENT JOB
// ============================================================================

struct EnrollmentJob {
  bool valid;
  long enrollmentId;
  int employeeId;
  int sensorSlot;
  String fingerName;
};

EnrollmentJob currentEnrollment = {
  false,
  0,
  0,
  0,
  ""
};

// ============================================================================
// PERSISTENT ENROLLMENT RESULT
// ============================================================================

struct PendingEnrollmentResult {
  bool pending;
  long enrollmentId;
  int employeeId;
  int sensorSlot;
  String fingerName;
  bool success;
  int confidence;
  String errorMessage;
};

PendingEnrollmentResult pendingEnrollmentResult = {
  false,
  0,
  0,
  0,
  "",
  false,
  0,
  ""
};

Preferences enrollmentPrefs;
Preferences attendancePrefs;

uint32_t attendanceSequence = 0;

// ============================================================================
// RESET / DIAGNOSTICS
// ============================================================================

void printResetDiagnostics() {
  esp_reset_reason_t reason = esp_reset_reason();

  Serial.println();
  Serial.println("========================================");
  Serial.println(" ESP32 RESET / RUNTIME DIAGNOSTICS");
  Serial.println("========================================");
  Serial.print("Reset reason code: ");
  Serial.println((int)reason);
  Serial.print("Free heap: ");
  Serial.println(ESP.getFreeHeap());
  Serial.print("Min free heap: ");
  Serial.println(ESP.getMinFreeHeap());
  Serial.print("Chip revision: ");
  Serial.println(ESP.getChipRevision());
  Serial.print("Chip model: ");
  Serial.println(ESP.getChipModel());
  Serial.print("Flash size: ");
  Serial.println(ESP.getFlashChipSize());
  Serial.print("SDK version: ");
  Serial.println(ESP.getSdkVersion());
  Serial.println("========================================");
}

// ============================================================================
// OLED HELPERS
// ============================================================================

bool oledI2CPresent() {
  Wire.beginTransmission(OLED_ADDRESS);
  uint8_t error = Wire.endTransmission();
  return error == 0;
}

void initOLEDBus() {
  Wire.begin(OLED_SDA, OLED_SCL);
  Wire.setClock(OLED_I2C_CLOCK_HZ);
  Wire.setTimeOut(OLED_I2C_TIMEOUT_MS);
}

bool initializeOLED() {
  Serial.println("Initializing OLED...");

  initOLEDBus();
  delay(20);

  if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDRESS)) {
    oledInitialized = false;
    Serial.println("OLED initialization FAILED.");
    return false;
  }

  oledInitialized = true;
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.display();

  lastOLEDRefresh = millis();
  lastOLEDRecovery = millis();

  Serial.println("OLED initialized successfully.");
  return true;
}

void drawCachedOLED() {
  if (!oledInitialized) {
    if (!initializeOLED()) {
      return;
    }
  }

  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);

  display.setCursor(0, 0);
  display.println(oledLine1);

  display.setCursor(0, 16);
  display.println(oledLine2);

  display.setCursor(0, 32);
  display.println(oledLine3);

  display.setCursor(0, 48);
  display.println(oledLine4);

  display.display();
  lastOLEDRefresh = millis();
}

void showOLED(
  const String& line1,
  const String& line2 = "",
  const String& line3 = "",
  const String& line4 = ""
) {
  oledLine1 = line1;
  oledLine2 = line2;
  oledLine3 = line3;
  oledLine4 = line4;

  drawCachedOLED();
}

void recoverOLED() {
  unsigned long now = millis();

  if (now - lastOLEDRecovery < OLED_RECOVERY_INTERVAL) {
    return;
  }

  lastOLEDRecovery = now;

  Serial.println("Attempting OLED recovery...");

  // Reset the I2C peripheral first. This is safe because the OLED is the only
  // device defined on this bus in this project.
  Wire.end();
  delay(20);
  initOLEDBus();
  delay(20);

  if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDRESS)) {
    oledInitialized = false;
    Serial.println("OLED recovery failed.");
    return;
  }

  oledInitialized = true;
  Serial.println("OLED recovery succeeded.");
  drawCachedOLED();
}

void serviceOLED() {
  unsigned long now = millis();

  if (!oledInitialized) {
    if (now - lastOLEDRecovery >= OLED_RECOVERY_INTERVAL) {
      recoverOLED();
    }
    return;
  }

  // If the controller lost its display state because of a transient I2C/power
  // event, periodically resend the current screen.
  if (now - lastOLEDRefresh >= OLED_HEARTBEAT_INTERVAL) {
    if (oledI2CPresent()) {
      drawCachedOLED();
    } else {
      oledInitialized = false;
      recoverOLED();
    }
  }
}

// ============================================================================
// OUTPUT HELPERS
// ============================================================================

void allOutputsOff() {
  digitalWrite(GREEN_LED, LOW);
  digitalWrite(RED_LED, LOW);
  noTone(BUZZER);
}

void successSignal() {
  digitalWrite(RED_LED, LOW);
  digitalWrite(GREEN_LED, HIGH);

  tone(BUZZER, 2200, 120);
  delay(160);
  tone(BUZZER, 2600, 120);
  delay(170);
  noTone(BUZZER);

  delay(450);
  digitalWrite(GREEN_LED, LOW);
}

void errorSignal() {
  digitalWrite(GREEN_LED, LOW);
  digitalWrite(RED_LED, HIGH);

  tone(BUZZER, 500, 160);
  delay(200);
  tone(BUZZER, 500, 160);
  delay(200);
  noTone(BUZZER);

  delay(450);
  digitalWrite(RED_LED, LOW);
}

// ============================================================================
// WIFI
// ============================================================================

bool connectWiFi(bool force = false) {
  unsigned long now = millis();

  if (!force && now - lastWiFiAttempt < WIFI_RETRY_INTERVAL) {
    return WiFi.status() == WL_CONNECTED;
  }

  lastWiFiAttempt = now;

  Serial.println();
  Serial.println("====================================");
  Serial.println("Connecting to Wi-Fi...");
  Serial.println("====================================");

  if (WiFi.status() == WL_CONNECTED) {
    return true;
  }

  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long startTime = millis();

  while (
    WiFi.status() != WL_CONNECTED &&
    millis() - startTime < WIFI_CONNECT_TIMEOUT
  ) {
    serviceOLED();
    delay(250);
    Serial.print(".");
  }

  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("Wi-Fi connected.");
    Serial.print("ESP32 IP: ");
    Serial.println(WiFi.localIP());

    showOLED(
      "WiFi Connected",
      WiFi.localIP().toString(),
      "Starting machine..."
    );
    delay(800);
    return true;
  }

  Serial.println("Wi-Fi connection failed.");

  showOLED(
    "WiFi Failed",
    "Retry Scheduled",
    "Attendance may be Offline"
  );

  return false;
}

bool ensureWiFi() {
  if (WiFi.status() == WL_CONNECTED) {
    return true;
  }

  return connectWiFi(false);
}

// ============================================================================
// HTTP HELPERS
// ============================================================================

String makeUrl(const char* endpoint) {
  return String(BACKEND_BASE_URL) + String(endpoint);
}

void addDeviceHeaders(HTTPClient& http) {
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-code", DEVICE_CODE);
  http.addHeader("x-device-secret", DEVICE_SECRET);
}

bool backendConfigured() {
  if (String(BACKEND_BASE_URL).indexOf("YOUR_PC_IP") >= 0) {
    Serial.println("ERROR: BACKEND_BASE_URL is not configured.");
    return false;
  }

  if (String(DEVICE_SECRET).indexOf("YOUR_DEVICE_SECRET") >= 0) {
    Serial.println("ERROR: DEVICE_SECRET is not configured.");
    return false;
  }

  return true;
}

// ============================================================================
// BACKEND CONNECTIVITY CHECK
// ============================================================================

bool checkBackendConnectivity() {
  Serial.println();
  Serial.println("====================================");
  Serial.println(" CHECKING BACKEND CONNECTION");
  Serial.println("====================================");

  if (!backendConfigured()) {
    return false;
  }

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Backend check skipped: Wi-Fi is not connected.");
    return false;
  }

  String url = makeUrl(ENROLLMENT_PENDING_ENDPOINT);

  for (uint8_t attempt = 1; attempt <= STARTUP_BACKEND_RETRIES; attempt++) {
    Serial.print("Backend check attempt ");
    Serial.print(attempt);
    Serial.print("/");
    Serial.println(STARTUP_BACKEND_RETRIES);
    Serial.print("GET: ");
    Serial.println(url);

    HTTPClient http;
    http.setConnectTimeout(HTTP_CONNECT_TIMEOUT);
    http.setTimeout(HTTP_TIMEOUT);

    if (!http.begin(url)) {
      Serial.println("HTTP begin failed.");
    } else {
      addDeviceHeaders(http);
      int httpCode = http.GET();

      Serial.print("Backend HTTP code: ");
      Serial.println(httpCode);

      if (httpCode > 0) {
        String response = http.getString();
        Serial.println("Backend response:");
        Serial.println(response);

        bool ok = httpCode >= 200 && httpCode < 300;
        http.end();

        if (ok) {
          Serial.println("Backend connection: OK");
          return true;
        }

        if (httpCode == 401 || httpCode == 403) {
          Serial.println("Backend reachable, but device authentication failed.");
          return false;
        }
      } else {
        Serial.print("Backend connection error: ");
        Serial.println(http.errorToString(httpCode));
      }

      http.end();
    }

    if (attempt < STARTUP_BACKEND_RETRIES) {
      delay(STARTUP_BACKEND_RETRY_DELAY_MS);
    }
  }

  Serial.println("Backend connection: FAILED");
  return false;
}

// ============================================================================
// STARTUP STATUS
// ============================================================================

void showStartupStatus(
  const String& component,
  const String& status,
  const String& detail = ""
) {
  showOLED(
    component,
    status,
    detail,
    "Please wait..."
  );

  delay(STARTUP_STATUS_DISPLAY_MS);
}

void testGreenLED() {
  Serial.println("Testing GREEN LED...");
  showStartupStatus("GREEN LED", "TESTING", "Turning ON...");

  digitalWrite(GREEN_LED, HIGH);
  delay(500);
  digitalWrite(GREEN_LED, LOW);

  showStartupStatus("GREEN LED", "OK", "Test complete");
}

void testRedLED() {
  Serial.println("Testing RED LED...");
  showStartupStatus("RED LED", "TESTING", "Turning ON...");

  digitalWrite(RED_LED, HIGH);
  delay(500);
  digitalWrite(RED_LED, LOW);

  showStartupStatus("RED LED", "OK", "Test complete");
}

void testBuzzer() {
  Serial.println("Testing BUZZER...");
  showStartupStatus("BUZZER", "TESTING", "Listen for beep");

  tone(BUZZER, 1800, 180);
  delay(230);
  tone(BUZZER, 2400, 180);
  delay(230);
  noTone(BUZZER);

  showStartupStatus("BUZZER", "OK", "Test complete");
}

// ============================================================================
// FINGERPRINT SENSOR SETUP / INFORMATION
// ============================================================================

bool checkFingerprintSensor() {
  Serial.println("Checking fingerprint sensor...");

  if (!finger.verifyPassword()) {
    fingerprintInitialized = false;
    Serial.println("Fingerprint sensor: NOT FOUND");
    return false;
  }

  fingerprintInitialized = true;
  Serial.println("Fingerprint sensor: CONNECTED");

  if (finger.getParameters() == FINGERPRINT_OK) {
    Serial.print("Sensor capacity: ");
    Serial.println(finger.capacity);
    Serial.print("Security level: ");
    Serial.println(finger.security_level);
  }

  if (finger.getTemplateCount() == FINGERPRINT_OK) {
    Serial.print("Stored templates: ");
    Serial.println(finger.templateCount);
  }

  return true;
}

void showSensorInfo() {
  Serial.println();
  Serial.println("========== SENSOR INFO ==========");

  if (!finger.verifyPassword()) {
    Serial.println("Status: NOT CONNECTED");
    Serial.println("=================================");
    return;
  }

  Serial.println("Status: CONNECTED");
  Serial.print("Template capacity: ");
  Serial.println(finger.capacity);
  Serial.print("Security level: ");
  Serial.println(finger.security_level);
  Serial.print("Device address: 0x");
  Serial.println(finger.device_addr, HEX);

  if (finger.getTemplateCount() == FINGERPRINT_OK) {
    Serial.print("Stored templates: ");
    Serial.println(finger.templateCount);
  }

  Serial.println("=================================");
}

// ============================================================================
// ATTENDANCE READY
// ============================================================================

void showAttendanceReady() {
  currentMode = ATTENDANCE_MODE;
  allOutputsOff();

  showOLED(
    "Fingerprint Machine",
    "Attendance Mode",
    "Place Finger...",
    WiFi.status() == WL_CONNECTED ? "WiFi: Connected" : "WiFi: Offline"
  );
}

// ============================================================================
// FINGER WAIT HELPERS
// ============================================================================

uint8_t waitForFingerImage(unsigned long timeoutMs) {
  unsigned long startTime = millis();

  while (millis() - startTime < timeoutMs) {
    serviceOLED();

    uint8_t result = finger.getImage();

    if (result == FINGERPRINT_OK) {
      return FINGERPRINT_OK;
    }

    if (result == FINGERPRINT_NOFINGER) {
      delay(80);
      continue;
    }

    return result;
  }

  return FINGERPRINT_TIMEOUT;
}

bool waitForFingerRemoval(unsigned long timeoutMs) {
  unsigned long startTime = millis();

  while (millis() - startTime < timeoutMs) {
    serviceOLED();

    uint8_t result = finger.getImage();

    if (result == FINGERPRINT_NOFINGER) {
      return true;
    }

    delay(80);
  }

  return false;
}

// ============================================================================
// STABLE FINGER DETECTION
// ============================================================================

uint8_t waitForStableFingerImage(unsigned long timeoutMs) {
  unsigned long startTime = millis();

  while (millis() - startTime < timeoutMs) {
    serviceOLED();

    uint8_t first = finger.getImage();

    if (first == FINGERPRINT_NOFINGER) {
      delay(60);
      continue;
    }

    if (first != FINGERPRINT_OK) {
      return first;
    }

    // A second consecutive image is required. This filters short electrical
    // noise / transient sensor activations which otherwise look like a finger.
    delay(FINGER_CONFIRM_DELAY_MS);

    uint8_t second = finger.getImage();

    if (second == FINGERPRINT_OK) {
      return FINGERPRINT_OK;
    }

    if (second == FINGERPRINT_NOFINGER) {
      // Transient activation. Keep waiting silently rather than showing a red
      // "No Match" error to the user.
      delay(60);
      continue;
    }

    return second;
  }

  return FINGERPRINT_NOFINGER;
}

// ============================================================================
// PERSISTENT ENROLLMENT RESULT
// ============================================================================

void clearPendingEnrollmentResult() {
  enrollmentPrefs.begin("enr_result", false);
  enrollmentPrefs.clear();
  enrollmentPrefs.end();

  pendingEnrollmentResult.pending = false;
  pendingEnrollmentResult.enrollmentId = 0;
  pendingEnrollmentResult.employeeId = 0;
  pendingEnrollmentResult.sensorSlot = 0;
  pendingEnrollmentResult.fingerName = "";
  pendingEnrollmentResult.success = false;
  pendingEnrollmentResult.confidence = 0;
  pendingEnrollmentResult.errorMessage = "";
}

void savePendingEnrollmentResult(
  const EnrollmentJob& job,
  bool success,
  int confidence,
  const String& errorMessage
) {
  enrollmentPrefs.begin("enr_result", false);

  enrollmentPrefs.putBool("pending", true);
  enrollmentPrefs.putLong("enrId", job.enrollmentId);
  enrollmentPrefs.putInt("empId", job.employeeId);
  enrollmentPrefs.putInt("slot", job.sensorSlot);
  enrollmentPrefs.putString("finger", job.fingerName);
  enrollmentPrefs.putBool("success", success);
  enrollmentPrefs.putInt("confidence", confidence);
  enrollmentPrefs.putString("error", errorMessage);

  enrollmentPrefs.end();

  pendingEnrollmentResult.pending = true;
  pendingEnrollmentResult.enrollmentId = job.enrollmentId;
  pendingEnrollmentResult.employeeId = job.employeeId;
  pendingEnrollmentResult.sensorSlot = job.sensorSlot;
  pendingEnrollmentResult.fingerName = job.fingerName;
  pendingEnrollmentResult.success = success;
  pendingEnrollmentResult.confidence = confidence;
  pendingEnrollmentResult.errorMessage = errorMessage;
}

void loadPendingEnrollmentResult() {
  enrollmentPrefs.begin("enr_result", true);

  bool pending = enrollmentPrefs.getBool("pending", false);

  if (!pending) {
    enrollmentPrefs.end();
    pendingEnrollmentResult.pending = false;
    return;
  }

  pendingEnrollmentResult.pending = true;
  pendingEnrollmentResult.enrollmentId = enrollmentPrefs.getLong("enrId", 0);
  pendingEnrollmentResult.employeeId = enrollmentPrefs.getInt("empId", 0);
  pendingEnrollmentResult.sensorSlot = enrollmentPrefs.getInt("slot", 0);
  pendingEnrollmentResult.fingerName = enrollmentPrefs.getString("finger", "");
  pendingEnrollmentResult.success = enrollmentPrefs.getBool("success", false);
  pendingEnrollmentResult.confidence = enrollmentPrefs.getInt("confidence", 0);
  pendingEnrollmentResult.errorMessage = enrollmentPrefs.getString("error", "");

  enrollmentPrefs.end();

  Serial.println("Pending enrollment result recovered from NVS.");
  Serial.print("Enrollment ID: ");
  Serial.println(pendingEnrollmentResult.enrollmentId);
}

// ============================================================================
// ENROLLMENT LOG
// ============================================================================

bool reportEnrollmentLog(const String& message) {
  if (message.length() == 0) {
    return false;
  }

  if (!currentEnrollment.valid || currentEnrollment.enrollmentId <= 0) {
    Serial.println("Enrollment log skipped: no active enrollment job.");
    return false;
  }

  if (!backendConfigured() || !ensureWiFi()) {
    return false;
  }

  HTTPClient http;
  String url = makeUrl(ENROLLMENT_LOG_ENDPOINT);

  http.setConnectTimeout(HTTP_CONNECT_TIMEOUT);
  http.setTimeout(HTTP_TIMEOUT);

  if (!http.begin(url)) {
    Serial.println("HTTP begin failed for enrollment log.");
    return false;
  }

  addDeviceHeaders(http);

  JsonDocument doc;
  doc["enrollmentId"] = currentEnrollment.enrollmentId;
  doc["message"] = message;

  String body;
  serializeJson(doc, body);

  int httpCode = http.POST(body);
  String response = http.getString();

  Serial.print("Enrollment log HTTP code: ");
  Serial.println(httpCode);

  if (response.length() > 0) {
    Serial.println("Enrollment log response:");
    Serial.println(response);
  }

  bool ok = httpCode >= 200 && httpCode < 300;
  http.end();
  return ok;
}

// ============================================================================
// FINGERPRINT ENROLLMENT VERIFICATION
// ============================================================================

bool verifyStoredFingerprint(
  int sensorSlot,
  int& confidenceOut,
  String& errorMessageOut
) {
  confidenceOut = 0;
  errorMessageOut = "";

  reportEnrollmentLog("Fingerprint template saved. Preparing verification scan...");

  showOLED(
    "Enrollment",
    "Saved Successfully",
    "Test Finger",
    "Place Finger"
  );

  uint8_t result = waitForStableFingerImage(ENROLLMENT_STAGE_TIMEOUT);

  if (result != FINGERPRINT_OK) {
    errorMessageOut =
      "Verification scan failed. Sensor code: " + String(result);
    reportEnrollmentLog(errorMessageOut);
    return false;
  }

  reportEnrollmentLog("Verification fingerprint captured.");

  result = finger.image2Tz();

  if (result != FINGERPRINT_OK) {
    errorMessageOut =
      "Verification image conversion failed. Sensor code: " + String(result);
    reportEnrollmentLog(errorMessageOut);
    return false;
  }

  result = finger.fingerFastSearch();

  if (result != FINGERPRINT_OK) {
    errorMessageOut =
      "Verification search failed. Sensor code: " + String(result);
    reportEnrollmentLog(errorMessageOut);
    return false;
  }

  confidenceOut = finger.confidence;

  Serial.print("Verification matched slot: ");
  Serial.println(finger.fingerID);
  Serial.print("Confidence: ");
  Serial.println(finger.confidence);

  if (finger.fingerID != sensorSlot) {
    errorMessageOut =
      "Verification matched slot " + String(finger.fingerID) +
      " instead of assigned slot " + String(sensorSlot) + ".";
    reportEnrollmentLog(errorMessageOut);
    return false;
  }

  reportEnrollmentLog(
    "Verification successful. Matched assigned slot " +
    String(sensorSlot) + " with confidence " + String(confidenceOut) + "."
  );

  return true;
}

// ============================================================================
// FINGERPRINT SLOT CHECK
// ============================================================================

bool isKnownEmptySlotResult(uint8_t result) {
  if (result == FINGERPRINT_NOTFOUND || result == FINGERPRINT_BADLOCATION) {
    return true;
  }

  // Code 12 was observed after clearing this project's sensor database.
  // Only accept it as "empty" when the sensor itself confirms the whole
  // database is empty. Otherwise keep it as a real read/database error.
  if (result == SENSOR_EMPTY_DB_ERROR_CODE) {
    if (finger.getTemplateCount() == FINGERPRINT_OK && finger.templateCount == 0) {
      return true;
    }
  }

  return false;
}

// ============================================================================
// ENROLL FINGERPRINT
// ============================================================================

bool enrollFingerprint(
  int sensorSlot,
  int& verificationConfidence,
  String& errorMessageOut
) {
  verificationConfidence = 0;
  errorMessageOut = "";

  Serial.println();
  Serial.println("====================================");
  Serial.println(" STARTING FINGERPRINT ENROLLMENT");
  Serial.println("====================================");
  Serial.print("Employee ID: ");
  Serial.println(currentEnrollment.employeeId);
  Serial.print("Enrollment ID: ");
  Serial.println(currentEnrollment.enrollmentId);
  Serial.print("Sensor Slot: ");
  Serial.println(sensorSlot);
  Serial.print("Finger Name: ");
  Serial.println(currentEnrollment.fingerName);

  reportEnrollmentLog(
    "Enrollment started for employee " +
    String(currentEnrollment.employeeId) +
    ", slot " + String(sensorSlot) + "."
  );

  // ----------------------------------------------------------
  // CHECK SLOT
  // ----------------------------------------------------------

  reportEnrollmentLog("Checking physical sensor slot " + String(sensorSlot) + "...");

  uint8_t result = finger.loadModel(sensorSlot);

  if (result == FINGERPRINT_OK) {
    errorMessageOut =
      "Sensor slot " + String(sensorSlot) + " is already occupied.";

    showOLED(
      "Enrollment Failed",
      "Slot Occupied",
      "Slot: " + String(sensorSlot),
      "Choose another slot"
    );

    errorSignal();
    reportEnrollmentLog(errorMessageOut);
    return false;
  }

  if (!isKnownEmptySlotResult(result)) {
    errorMessageOut =
      "Could not safely check sensor slot " + String(sensorSlot) +
      ". Sensor code: " + String(result) + ".";

    showOLED(
      "Enrollment Failed",
      "Slot Check Error",
      "Code: " + String(result),
      "Check Sensor"
    );

    errorSignal();
    reportEnrollmentLog(errorMessageOut);
    return false;
  }

  reportEnrollmentLog("Sensor slot " + String(sensorSlot) + " is available.");

  // ----------------------------------------------------------
  // FIRST SCAN
  // ----------------------------------------------------------

  showOLED(
    "ENROLLMENT MODE",
    "Employee: " + String(currentEnrollment.employeeId),
    "Place Finger",
    "Scan 1 of 2"
  );

  reportEnrollmentLog("Place the finger on the sensor for scan 1 of 2.");

  result = waitForFingerImage(ENROLLMENT_STAGE_TIMEOUT);

  if (result != FINGERPRINT_OK) {
    errorMessageOut =
      "First fingerprint scan failed. Sensor code: " + String(result) + ".";
    reportEnrollmentLog(errorMessageOut);
    errorSignal();
    return false;
  }

  reportEnrollmentLog("First fingerprint image captured.");

  result = finger.image2Tz(1);

  if (result != FINGERPRINT_OK) {
    errorMessageOut =
      "First fingerprint image conversion failed. Sensor code: " +
      String(result) + ".";
    reportEnrollmentLog(errorMessageOut);
    errorSignal();
    return false;
  }

  reportEnrollmentLog("First fingerprint scan processed successfully.");

  // ----------------------------------------------------------
  // REMOVE FINGER
  // ----------------------------------------------------------

  showOLED(
    "ENROLLMENT MODE",
    "First Scan OK",
    "Remove Finger",
    "Please remove now"
  );

  reportEnrollmentLog("Remove the finger before scan 2 of 2.");

  if (!waitForFingerRemoval(FINGER_REMOVAL_TIMEOUT)) {
    errorMessageOut = "Finger removal timeout after first scan.";
    reportEnrollmentLog(errorMessageOut);
    errorSignal();
    return false;
  }

  delay(300);

  // ----------------------------------------------------------
  // SECOND SCAN
  // ----------------------------------------------------------

  showOLED(
    "ENROLLMENT MODE",
    "Place SAME Finger",
    "Scan 2 of 2",
    "Hold steadily"
  );

  reportEnrollmentLog("Place the SAME finger for scan 2 of 2.");

  result = waitForFingerImage(ENROLLMENT_STAGE_TIMEOUT);

  if (result != FINGERPRINT_OK) {
    errorMessageOut =
      "Second fingerprint scan failed. Sensor code: " + String(result) + ".";
    reportEnrollmentLog(errorMessageOut);
    errorSignal();
    return false;
  }

  reportEnrollmentLog("Second fingerprint image captured.");

  result = finger.image2Tz(2);

  if (result != FINGERPRINT_OK) {
    errorMessageOut =
      "Second fingerprint image conversion failed. Sensor code: " +
      String(result) + ".";
    reportEnrollmentLog(errorMessageOut);
    errorSignal();
    return false;
  }

  reportEnrollmentLog("Second fingerprint scan processed successfully.");

  // ----------------------------------------------------------
  // CREATE MODEL
  // ----------------------------------------------------------

  showOLED(
    "ENROLLMENT MODE",
    "Creating Template...",
    "Please wait"
  );

  result = finger.createModel();

  if (result != FINGERPRINT_OK) {
    errorMessageOut =
      "Fingerprint model creation failed. Sensor code: " + String(result) + ".";

    showOLED(
      "Enrollment Failed",
      "Fingerprints",
      "Do Not Match",
      "Try Again"
    );

    reportEnrollmentLog(errorMessageOut);
    errorSignal();
    return false;
  }

  reportEnrollmentLog("Fingerprint template created successfully.");

  // ----------------------------------------------------------
  // STORE MODEL
  // ----------------------------------------------------------

  showOLED(
    "ENROLLMENT MODE",
    "Saving Template...",
    "Slot: " + String(sensorSlot),
    "Please wait"
  );

  result = finger.storeModel(sensorSlot);

  if (result != FINGERPRINT_OK) {
    errorMessageOut =
      "Fingerprint storage failed for sensor slot " +
      String(sensorSlot) + ". Sensor code: " + String(result) + ".";

    reportEnrollmentLog(errorMessageOut);
    errorSignal();
    return false;
  }

  reportEnrollmentLog(
    "Fingerprint template stored successfully in sensor slot " +
    String(sensorSlot) + "."
  );

  // ----------------------------------------------------------
  // REMOVE FINGER BEFORE TEST
  // ----------------------------------------------------------

  showOLED(
    "Fingerprint Saved",
    "Remove Finger",
    "Preparing Test...",
    "Do not skip test"
  );

  if (!waitForFingerRemoval(FINGER_REMOVAL_TIMEOUT)) {
    // IMPORTANT: physical template exists, but verification did not happen.
    // Do NOT report success. Delete the unverified model when possible.
    errorMessageOut =
      "Finger removal timed out after saving. Verification was not completed.";

    reportEnrollmentLog(errorMessageOut);
    reportEnrollmentLog(
      "Attempting to remove unverified template from sensor slot " +
      String(sensorSlot) + "."
    );

    uint8_t loadResult = finger.loadModel(sensorSlot);
    if (loadResult == FINGERPRINT_OK) {
      uint8_t deleteResult = finger.deleteModel(sensorSlot);
      if (deleteResult == FINGERPRINT_OK) {
        reportEnrollmentLog("Unverified template removed successfully.");
      } else {
        errorMessageOut +=
          " Physical cleanup FAILED; slot may still contain an unverified template.";
        reportEnrollmentLog(errorMessageOut);
      }
    } else {
      errorMessageOut +=
        " Could not confirm template for cleanup; slot must be checked manually.";
      reportEnrollmentLog(errorMessageOut);
    }

    showOLED(
      "Enrollment Failed",
      "Verification Skipped",
      "Template Cleanup",
      "Check Slot"
    );

    errorSignal();
    return false;
  }

  delay(300);

  // ----------------------------------------------------------
  // IMMEDIATE VERIFICATION
  // ----------------------------------------------------------

  bool verified = verifyStoredFingerprint(
    sensorSlot,
    verificationConfidence,
    errorMessageOut
  );

  // Always require finger removal before leaving enrollment mode.
  waitForFingerRemoval(5000);

  if (!verified) {
    if (errorMessageOut.length() == 0) {
      errorMessageOut =
        "Fingerprint verification failed after the template was saved.";
    }

    reportEnrollmentLog(
      "Verification failed. Removing the physical fingerprint template from sensor slot " +
      String(sensorSlot) + "."
    );

    uint8_t loadResult = finger.loadModel(sensorSlot);

    if (loadResult == FINGERPRINT_OK) {
      uint8_t deleteResult = finger.deleteModel(sensorSlot);

      if (deleteResult == FINGERPRINT_OK) {
        reportEnrollmentLog(
          "Physical fingerprint template removed successfully from slot " +
          String(sensorSlot) + "."
        );
      } else {
        errorMessageOut +=
          " Physical sensor cleanup FAILED. Slot " + String(sensorSlot) +
          " may still contain the fingerprint.";
        reportEnrollmentLog(errorMessageOut);
      }
    } else {
      errorMessageOut +=
        " Could not confirm stored template before cleanup. Slot " +
        String(sensorSlot) + " must be checked manually.";
      reportEnrollmentLog(errorMessageOut);
    }

    showOLED(
      "Enrollment Failed",
      "Verification Failed",
      "Template Cleanup",
      "Check Slot if needed"
    );

    errorSignal();
    return false;
  }

  reportEnrollmentLog(
    "Fingerprint enrollment and verification completed successfully."
  );

  showOLED(
    "Enrollment Success",
    "Slot: " + String(sensorSlot),
    "Fingerprint Ready",
    "Attendance Ready"
  );

  successSignal();
  return true;
}

// ============================================================================
// FETCH PENDING ENROLLMENT JOB
// ============================================================================

bool fetchPendingEnrollment(EnrollmentJob& job) {
  job.valid = false;
  job.enrollmentId = 0;
  job.employeeId = 0;
  job.sensorSlot = 0;
  job.fingerName = "";

  if (pendingEnrollmentResult.pending) {
    Serial.println("Pending enrollment result still needs backend confirmation.");
    return true;
  }

  if (!backendConfigured()) {
    Serial.println("Enrollment poll stopped: backend configuration is invalid.");
    return false;
  }

  if (!ensureWiFi()) {
    Serial.println("Enrollment poll stopped: Wi-Fi is not connected.");
    return false;
  }

  HTTPClient http;
  String url = makeUrl(ENROLLMENT_PENDING_ENDPOINT);

  http.setConnectTimeout(HTTP_CONNECT_TIMEOUT);
  http.setTimeout(HTTP_TIMEOUT);

  if (!http.begin(url)) {
    Serial.println("ERROR: HTTP begin failed for enrollment queue.");
    return false;
  }

  addDeviceHeaders(http);

  int httpCode = http.GET();

  if (httpCode <= 0) {
    Serial.print("ERROR: Enrollment queue request failed: ");
    Serial.println(http.errorToString(httpCode));
    http.end();
    return false;
  }

  String response = http.getString();

  Serial.print("Enrollment queue HTTP code: ");
  Serial.println(httpCode);
  Serial.println("Enrollment queue response:");
  Serial.println(response);

  if (httpCode == 401 || httpCode == 403) {
    Serial.println("ERROR: Device authentication was rejected by backend.");
    http.end();
    return false;
  }

  if (httpCode < 200 || httpCode >= 300) {
    http.end();
    return false;
  }

  JsonDocument doc;
  DeserializationError error = deserializeJson(doc, response);

  if (error) {
    Serial.print("ERROR: Could not parse enrollment queue JSON: ");
    Serial.println(error.c_str());
    http.end();
    return false;
  }

  bool success = doc["success"] | false;

  if (!success) {
    Serial.println("ERROR: Backend returned success=false for enrollment queue.");
    http.end();
    return false;
  }

  JsonVariant data = doc["data"];

  if (data.isNull()) {
    http.end();
    return true;
  }

  job.enrollmentId = data["enrollmentId"] | 0;
  job.employeeId = data["employeeId"] | 0;
  job.sensorSlot = data["sensorSlot"] | 0;
  job.fingerName = data["fingerName"] | "";

  if (
    job.enrollmentId <= 0 ||
    job.employeeId <= 0 ||
    job.sensorSlot < 1
  ) {
    Serial.println("ERROR: Invalid enrollment job received from backend.");
    http.end();
    return false;
  }

  if (finger.capacity > 0 && job.sensorSlot > finger.capacity) {
    Serial.print("ERROR: Backend assigned sensor slot ");
    Serial.print(job.sensorSlot);
    Serial.print(" but sensor capacity is ");
    Serial.println(finger.capacity);
    http.end();
    return false;
  }

  job.valid = true;

  http.end();
  return true;
}

// ============================================================================
// SEND ENROLLMENT RESULT
// ============================================================================

bool sendEnrollmentResultToBackend(
  const EnrollmentJob& job,
  bool success,
  int confidence,
  const String& errorMessage
) {
  if (!backendConfigured() || !ensureWiFi()) {
    return false;
  }

  HTTPClient http;
  String url = makeUrl(ENROLLMENT_RESULT_ENDPOINT);

  http.setConnectTimeout(HTTP_CONNECT_TIMEOUT);
  http.setTimeout(HTTP_TIMEOUT);

  if (!http.begin(url)) {
    return false;
  }

  addDeviceHeaders(http);

  // Enrollment ID is the logical idempotency key for this operation.
  http.addHeader("Idempotency-Key", String("enrollment-") + String(job.enrollmentId));

  JsonDocument doc;
  doc["enrollmentId"] = job.enrollmentId;
  doc["employeeId"] = job.employeeId;
  doc["sensorSlot"] = job.sensorSlot;
  doc["fingerName"] = job.fingerName;
  doc["success"] = success;
  doc["confidence"] = confidence;

  if (errorMessage.length() > 0) {
    doc["error"] = errorMessage;
  }

  String body;
  serializeJson(doc, body);

  int httpCode = http.POST(body);
  String response = http.getString();

  Serial.print("Enrollment result HTTP code: ");
  Serial.println(httpCode);
  if (response.length() > 0) {
    Serial.println(response);
  }

  bool ok = httpCode >= 200 && httpCode < 300;
  http.end();
  return ok;
}

bool reportEnrollmentResult(
  const EnrollmentJob& job,
  bool success,
  int confidence,
  const String& errorMessage
) {
  bool ok = sendEnrollmentResultToBackend(
    job,
    success,
    confidence,
    errorMessage
  );

  if (ok) {
    clearPendingEnrollmentResult();
    return true;
  }

  // Persist the exact result so it survives a Wi-Fi outage or ESP32 reboot.
  savePendingEnrollmentResult(
    job,
    success,
    confidence,
    errorMessage
  );

  Serial.println("Enrollment result saved to NVS for retry.");
  return false;
}

// ============================================================================
// RETRY PERSISTED ENROLLMENT RESULT
// ============================================================================

bool retryPendingEnrollmentResult() {
  if (!pendingEnrollmentResult.pending) {
    return true;
  }

  unsigned long now = millis();

  if (now - lastEnrollmentResultRetry < ENROLLMENT_RESULT_RETRY_INTERVAL) {
    return false;
  }

  lastEnrollmentResultRetry = now;

  EnrollmentJob job;
  job.valid = true;
  job.enrollmentId = pendingEnrollmentResult.enrollmentId;
  job.employeeId = pendingEnrollmentResult.employeeId;
  job.sensorSlot = pendingEnrollmentResult.sensorSlot;
  job.fingerName = pendingEnrollmentResult.fingerName;

  Serial.println("Retrying persisted enrollment result...");

  bool ok = sendEnrollmentResultToBackend(
    job,
    pendingEnrollmentResult.success,
    pendingEnrollmentResult.confidence,
    pendingEnrollmentResult.errorMessage
  );

  if (ok) {
    Serial.println("Persisted enrollment result accepted by backend.");
    clearPendingEnrollmentResult();
    return true;
  }

  Serial.println("Persisted enrollment result still not accepted.");
  return false;
}

// ============================================================================
// START ENROLLMENT
// ============================================================================

void processEnrollmentJob(const EnrollmentJob& job) {
  if (!job.valid) {
    return;
  }

  // Do not run a new enrollment while a previous result is waiting for backend
  // confirmation. That prevents the same pending backend job from being taken
  // repeatedly and causing slot-occupied errors.
  if (pendingEnrollmentResult.pending) {
    Serial.println("Enrollment blocked until previous result is synchronized.");
    return;
  }

  currentEnrollment = job;
  currentMode = ENROLLMENT_MODE;

  showOLED(
    "ENROLLMENT REQUEST",
    "Employee: " + String(job.employeeId),
    "Slot: " + String(job.sensorSlot),
    job.fingerName
  );

  delay(1200);

  int verificationConfidence = 0;
  String errorMessage = "";

  bool enrollmentSuccess = enrollFingerprint(
    job.sensorSlot,
    verificationConfidence,
    errorMessage
  );

  if (enrollmentSuccess) {
    reportEnrollmentLog(
      "Device reports enrollment success. Sending completion to backend..."
    );
  } else if (errorMessage.length() == 0) {
    errorMessage = "Fingerprint enrollment failed on the device.";
  }

  bool reported = reportEnrollmentResult(
    job,
    enrollmentSuccess,
    verificationConfidence,
    errorMessage
  );

  if (!reported) {
    Serial.println("WARNING: Enrollment result queued for retry.");
  }

  currentEnrollment.valid = false;
  currentMode = ATTENDANCE_MODE;

  showOLED(
    enrollmentSuccess ? "Enrollment Complete" : "Enrollment Failed",
    reported ? "Backend Updated" : "Backend Retry Queued",
    "Returning to",
    "Attendance Mode"
  );

  delay(1000);
  waitForFingerRemoval(5000);
  showAttendanceReady();
}

// ============================================================================
// POLL ENROLLMENT CONTROL
// ============================================================================

void pollEnrollmentRequest(bool force = false) {
  if (currentMode != ATTENDANCE_MODE) {
    return;
  }

  if (pendingEnrollmentResult.pending) {
    retryPendingEnrollmentResult();
    return;
  }

  unsigned long now = millis();

  if (!force && now - lastEnrollmentPoll < ENROLLMENT_POLL_INTERVAL) {
    return;
  }

  lastEnrollmentPoll = now;

  EnrollmentJob job;

  bool requestHandled = fetchPendingEnrollment(job);

  if (!requestHandled) {
    return;
  }

  if (!job.valid) {
    return;
  }

  processEnrollmentJob(job);
}

// ============================================================================
// ATTENDANCE EVENT ID
// ============================================================================

void loadAttendanceSequence() {
  attendancePrefs.begin("attendance", false);
  attendanceSequence = attendancePrefs.getUInt("sequence", 0);
  attendancePrefs.end();
}

String nextAttendanceEventId() {
  attendanceSequence++;

  attendancePrefs.begin("attendance", false);
  attendancePrefs.putUInt("sequence", attendanceSequence);
  attendancePrefs.end();

  uint64_t chipId = ESP.getEfuseMac();
  char chipText[17];
  snprintf(chipText, sizeof(chipText), "%08lX", (unsigned long)(chipId & 0xFFFFFFFFULL));

  return String(DEVICE_CODE) + "-" + String(chipText) + "-" + String(attendanceSequence);
}

// ============================================================================
// IDENTIFY FINGERPRINT FOR ATTENDANCE
// ============================================================================

// Returns:
//   -3 = transient activation / no stable second scan
//   -2 = no finger
//   -1 = sensor/read error
//    0 = confirmed no match
//   >0 = matched fingerprint slot

int identifyFingerprint() {
  uint8_t result = waitForStableFingerImage(700);

  if (result == FINGERPRINT_NOFINGER || result == FINGERPRINT_TIMEOUT) {
    return -2;
  }

  if (result != FINGERPRINT_OK) {
    return -1;
  }

  result = finger.image2Tz();

  if (result != FINGERPRINT_OK) {
    return -1;
  }

  result = finger.fingerFastSearch();

  if (result == FINGERPRINT_OK) {
    Serial.print("Fingerprint matched. Slot ID: ");
    Serial.println(finger.fingerID);
    Serial.print("Confidence: ");
    Serial.println(finger.confidence);
    return finger.fingerID;
  }

  if (result != FINGERPRINT_NOTFOUND) {
    return -1;
  }

  // Do not immediately show red for a single no-match result. Confirm the
  // same physical presence with another complete capture/search.
  showOLED(
    "Fingerprint Detected",
    "Confirming...",
    "Hold Finger",
    "Please wait"
  );

  unsigned long confirmStart = millis();
  uint8_t noMatchCount = 1;

  while (millis() - confirmStart < SECOND_MATCH_CONFIRM_TIMEOUT_MS) {
    serviceOLED();

    uint8_t stable = waitForStableFingerImage(500);

    if (stable == FINGERPRINT_NOFINGER || stable == FINGERPRINT_TIMEOUT) {
      return -3;
    }

    if (stable != FINGERPRINT_OK) {
      return -1;
    }

    uint8_t convertResult = finger.image2Tz();
    if (convertResult != FINGERPRINT_OK) {
      return -1;
    }

    uint8_t searchResult = finger.fingerFastSearch();

    if (searchResult == FINGERPRINT_OK) {
      Serial.print("Fingerprint matched on confirmation. Slot ID: ");
      Serial.println(finger.fingerID);
      Serial.print("Confidence: ");
      Serial.println(finger.confidence);
      return finger.fingerID;
    }

    if (searchResult == FINGERPRINT_NOTFOUND) {
      noMatchCount++;

      if (noMatchCount >= ATTENDANCE_NO_MATCH_CONFIRMATIONS) {
        return 0;
      }

      delay(80);
      continue;
    }

    return -1;
  }

  return -3;
}

// ============================================================================
// SEND ATTENDANCE TO BACKEND
// ============================================================================

bool sendAttendanceToBackend(int sensorSlot, const String& eventId) {
  if (sensorSlot < 1) {
    return false;
  }

  if (!backendConfigured()) {
    return false;
  }

  if (!ensureWiFi()) {
    return false;
  }

  HTTPClient http;
  String url = makeUrl(ATTENDANCE_ENDPOINT);

  http.setConnectTimeout(HTTP_CONNECT_TIMEOUT);
  http.setTimeout(HTTP_TIMEOUT);

  if (!http.begin(url)) {
    Serial.println("HTTP begin failed for attendance.");
    return false;
  }

  addDeviceHeaders(http);
  http.addHeader("Idempotency-Key", eventId);

  JsonDocument doc;
  doc["sensorSlot"] = sensorSlot;
  doc["eventId"] = eventId;

  String body;
  serializeJson(doc, body);

  Serial.println();
  Serial.println("Attendance request:");
  Serial.println(body);

  int httpCode = http.POST(body);

  Serial.print("Attendance HTTP code: ");
  Serial.println(httpCode);

  String response = http.getString();
  Serial.println("Attendance response:");
  Serial.println(response);

  if (httpCode <= 0) {
    Serial.print("Attendance HTTP error: ");
    Serial.println(http.errorToString(httpCode));
  }

  bool ok = httpCode >= 200 && httpCode < 300;
  http.end();
  return ok;
}

// ============================================================================
// ATTENDANCE LOOP
// ============================================================================

void attendanceLoop() {
  if (!fingerprintInitialized) {
    return;
  }

  unsigned long now = millis();

  if (now - lastAttendanceScan < ATTENDANCE_SCAN_INTERVAL) {
    return;
  }

  lastAttendanceScan = now;

  int result = identifyFingerprint();

  if (result == -2 || result == -3) {
    // No stable physical finger. Do not show an error and do not light RED.
    return;
  }

  if (result > 0) {
    Serial.println();
    Serial.println("====================================");
    Serial.println(" FINGERPRINT MATCH");
    Serial.println("====================================");
    Serial.print("Sensor Slot: ");
    Serial.println(result);

    if (millis() - lastAttendanceEvent < ATTENDANCE_EVENT_COOLDOWN) {
      Serial.println("Attendance event ignored due to cooldown.");
      waitForFingerRemoval(3000);
      showAttendanceReady();
      return;
    }

    String eventId = nextAttendanceEventId();

    showOLED(
      "Fingerprint Found",
      "Slot: " + String(result),
      "Sending..."
    );

    bool success = sendAttendanceToBackend(result, eventId);

    if (success) {
      lastAttendanceEvent = millis();

      Serial.println("Attendance recorded successfully.");

      showOLED(
        "Attendance Success",
        "Slot: " + String(result),
        "Recorded"
      );

      successSignal();
    } else {
      Serial.println("Attendance was NOT confirmed by backend.");

      showOLED(
        "Attendance Failed",
        "Slot: " + String(result),
        "Check Backend",
        "Event: " + eventId.substring(0, 18)
      );

      errorSignal();
    }

    waitForFingerRemoval(5000);
    showAttendanceReady();
    return;
  }

  if (result == 0) {
    // Only a confirmed no-match reaches this branch.
    Serial.println("Fingerprint confirmed but NOT recognized.");

    showOLED(
      "Fingerprint Failed",
      "No Match Found",
      "Try Again"
    );

    errorSignal();
    waitForFingerRemoval(3000);
    showAttendanceReady();
    return;
  }

  Serial.println("Fingerprint reading error.");

  showOLED(
    "Fingerprint Error",
    "Read Failed",
    "Try Again"
  );

  errorSignal();
  delay(350);
  showAttendanceReady();
}

// ============================================================================
// CHECK PHYSICAL SENSOR SLOT
// ============================================================================

void checkSensorSlot(int slot) {
  Serial.println();
  Serial.println("====================================");
  Serial.print(" CHECKING SENSOR SLOT: ");
  Serial.println(slot);
  Serial.println("====================================");

  if (slot < 1 || slot > finger.capacity) {
    Serial.println("Invalid sensor slot.");
    return;
  }

  uint8_t result = finger.loadModel(slot);

  Serial.print("loadModel() result code: ");
  Serial.println(result);

  if (result == FINGERPRINT_OK) {
    Serial.println("RESULT: SLOT IS OCCUPIED.");
  } else if (isKnownEmptySlotResult(result)) {
    Serial.println("RESULT: SLOT IS EMPTY / NO TEMPLATE FOUND.");
  } else {
    Serial.println("RESULT: SENSOR CHECK COULD NOT BE COMPLETED SAFELY.");
    Serial.println("Treat this as a sensor communication/database error.");
  }

  Serial.println("====================================");
}

// ============================================================================
// DELETE PHYSICAL SENSOR SLOT
// ============================================================================

void deleteSensorSlot(int slot) {
  Serial.println();
  Serial.println("====================================");
  Serial.print(" DELETE SENSOR SLOT: ");
  Serial.println(slot);
  Serial.println("====================================");

  if (slot < 1 || slot > finger.capacity) {
    Serial.println("Invalid sensor slot.");
    return;
  }

  uint8_t checkResult = finger.loadModel(slot);

  if (checkResult != FINGERPRINT_OK) {
    Serial.println("No deletable fingerprint template was confirmed in this slot.");
    Serial.print("Sensor result code: ");
    Serial.println(checkResult);
    return;
  }

  Serial.println("WARNING: A fingerprint template exists in this physical slot.");
  Serial.println("Type YES and press Enter to permanently delete it.");
  Serial.println("Any other input cancels the operation.");

  while (!Serial.available()) {
    serviceOLED();
    delay(20);
  }

  String confirmation = Serial.readStringUntil('\n');
  confirmation.trim();
  confirmation.toUpperCase();

  if (confirmation != "YES") {
    Serial.println("Deletion cancelled.");
    return;
  }

  uint8_t result = finger.deleteModel(slot);

  Serial.print("deleteModel() result code: ");
  Serial.println(result);

  if (result == FINGERPRINT_OK) {
    Serial.println("PHYSICAL FINGERPRINT DELETED SUCCESSFULLY.");
  } else {
    Serial.println("FAILED TO DELETE PHYSICAL FINGERPRINT.");
  }

  Serial.println("====================================");
}

// ============================================================================
// SERIAL DIAGNOSTIC COMMANDS
// ============================================================================

void printCommands() {
  Serial.println();
  Serial.println("====================================");
  Serial.println(" FINGERPRINT MACHINE COMMANDS");
  Serial.println("====================================");
  Serial.println("A = Attendance Mode");
  Serial.println("P = Check pending enrollment now");
  Serial.println("C = Check physical sensor slot");
  Serial.println("D = Delete physical sensor slot (confirmation required)");
  Serial.println("S = Sensor Information");
  Serial.println("W = Reconnect Wi-Fi");
  Serial.println("R = Reinitialize OLED");
  Serial.println("T = Print runtime diagnostics");
  Serial.println("====================================");
  Serial.println();
}

void handleSerialCommands() {
  if (!Serial.available()) {
    return;
  }

  String command = Serial.readStringUntil('\n');
  command.trim();
  command.toUpperCase();

  if (command == "A") {
    currentEnrollment.valid = false;
    showAttendanceReady();
    Serial.println("Switched to ATTENDANCE MODE.");
    return;
  }

  if (command == "P") {
    Serial.println("Manual enrollment queue check...");
    pollEnrollmentRequest(true);
    return;
  }

  if (command == "C") {
    Serial.println("Enter sensor slot number:");

    while (!Serial.available()) {
      serviceOLED();
      delay(20);
    }

    String input = Serial.readStringUntil('\n');
    input.trim();

    int slot = input.toInt();

    if (slot < 1 || slot > finger.capacity) {
      Serial.println("Invalid sensor slot.");
      return;
    }

    checkSensorSlot(slot);
    return;
  }

  if (command == "D") {
    Serial.println("Enter sensor slot number to delete:");

    while (!Serial.available()) {
      serviceOLED();
      delay(20);
    }

    String input = Serial.readStringUntil('\n');
    input.trim();

    int slot = input.toInt();

    if (slot < 1 || slot > finger.capacity) {
      Serial.println("Invalid sensor slot.");
      return;
    }

    deleteSensorSlot(slot);
    return;
  }

  if (command == "S") {
    showSensorInfo();
    return;
  }

  if (command == "W") {
    connectWiFi(true);
    showAttendanceReady();
    return;
  }

  if (command == "R") {
    oledInitialized = false;
    lastOLEDRecovery = 0;
    recoverOLED();
    showAttendanceReady();
    Serial.println("OLED reinitialization requested.");
    return;
  }

  if (command == "T") {
    printResetDiagnostics();
    return;
  }

  Serial.println("Unknown command. Use A, P, C, D, S, W, R, or T.");
}

// ============================================================================
// SETUP
// ============================================================================

void setup() {
  Serial.begin(115200);
  delay(500);

  printResetDiagnostics();

  // Outputs.
  pinMode(GREEN_LED, OUTPUT);
  pinMode(RED_LED, OUTPUT);
  pinMode(BUZZER, OUTPUT);
  allOutputsOff();

  // OLED.
  if (!initializeOLED()) {
    Serial.println("OLED unavailable at startup; machine will continue and retry.");
    digitalWrite(RED_LED, HIGH);
    delay(250);
    digitalWrite(RED_LED, LOW);
  }

  showOLED(
    "Fingerprint Machine",
    "Starting...",
    "Running diagnostics",
    "Please wait..."
  );
  delay(900);

  Serial.println();
  Serial.println("========================================");
  Serial.println(" FINGERPRINT ERP MACHINE STARTUP");
  Serial.println(" Hardened reliability version");
  Serial.println("========================================");

  // ----------------------------------------------------------
  // HARDWARE OUTPUT TESTS
  // ----------------------------------------------------------
  testGreenLED();
  testRedLED();
  testBuzzer();

  // ----------------------------------------------------------
  // FINGERPRINT UART / SENSOR TEST
  // ----------------------------------------------------------
  Serial.println("Initializing fingerprint sensor...");
  showStartupStatus(
    "Fingerprint",
    "INITIALIZING",
    "Sensor UART..."
  );

  FingerSerial.begin(
    57600,
    SERIAL_8N1,
    FINGERPRINT_RX,
    FINGERPRINT_TX
  );

  finger.begin(57600);
  delay(1000);

  bool fingerprintOK = checkFingerprintSensor();

  if (fingerprintOK) {
    showStartupStatus(
      "Fingerprint",
      "OK",
      "Sensor Connected"
    );
  } else {
    showStartupStatus(
      "Fingerprint",
      "FAILED",
      "Check TX/RX/Power"
    );

    errorSignal();
  }

  // ----------------------------------------------------------
  // NVS RECOVERY DATA
  // ----------------------------------------------------------
  loadPendingEnrollmentResult();
  loadAttendanceSequence();

  // ----------------------------------------------------------
  // WIFI TEST
  // ----------------------------------------------------------
  showOLED(
    "WiFi",
    "CHECKING...",
    "Connecting",
    "Please wait..."
  );

  bool wifiOK = connectWiFi(true);

  if (wifiOK) {
    showStartupStatus(
      "WiFi",
      "OK",
      WiFi.localIP().toString()
    );
  } else {
    showStartupStatus(
      "WiFi",
      "FAILED",
      "Will retry in background"
    );
  }

  // ----------------------------------------------------------
  // BACKEND TEST
  // ----------------------------------------------------------
  bool backendOK = false;

  if (wifiOK) {
    showOLED(
      "Backend",
      "CHECKING...",
      "Contacting API",
      "Please wait..."
    );

    backendOK = checkBackendConnectivity();

    if (backendOK) {
      showStartupStatus(
        "Backend",
        "OK",
        "API Connected"
      );
    } else {
      showStartupStatus(
        "Backend",
        "FAILED",
        "Will retry in background"
      );
    }
  } else {
    showStartupStatus(
      "Backend",
      "SKIPPED",
      "WiFi not connected"
    );
  }

  // ----------------------------------------------------------
  // FINAL STARTUP RESULT
  // ----------------------------------------------------------
  if (fingerprintOK && wifiOK && backendOK) {
    showOLED(
      "SYSTEM READY",
      "Fingerprint: OK",
      "WiFi: OK",
      "Backend: OK"
    );

    digitalWrite(GREEN_LED, HIGH);
    delay(450);
    digitalWrite(GREEN_LED, LOW);
    delay(350);
  } else {
    showOLED(
      "SYSTEM WARNING",
      fingerprintOK ? "Fingerprint: OK" : "Fingerprint: FAIL",
      wifiOK ? "WiFi: OK" : "WiFi: RETRY",
      backendOK ? "Backend: OK" : "Backend: RETRY"
    );

    digitalWrite(RED_LED, HIGH);
    delay(300);
    digitalWrite(RED_LED, LOW);
    delay(350);
  }

  // First enrollment poll happens immediately.
  lastEnrollmentPoll = millis() - ENROLLMENT_POLL_INTERVAL;
  lastEnrollmentResultRetry = millis() - ENROLLMENT_RESULT_RETRY_INTERVAL;

  currentMode = ATTENDANCE_MODE;
  currentEnrollment.valid = false;

  showAttendanceReady();
  printCommands();

  Serial.println("Machine initialized.");
  Serial.println("Normal state: ATTENDANCE_MODE");
}

// ============================================================================
// MAIN LOOP
// ============================================================================

void loop() {
  serviceOLED();
  handleSerialCommands();

  // Background Wi-Fi maintenance. Do not constantly reconnect.
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi(false);
  }

  if (currentMode == ATTENDANCE_MODE) {
    // Persisted enrollment result takes priority over requesting another job.
    if (pendingEnrollmentResult.pending) {
      retryPendingEnrollmentResult();
    } else {
      pollEnrollmentRequest();
    }

    if (currentMode == ATTENDANCE_MODE) {
      attendanceLoop();
    }
  }

  delay(10);
}

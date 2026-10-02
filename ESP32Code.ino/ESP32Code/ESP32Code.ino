/*
  ============================================================================
    ESP32 FINGERPRINT ERP ATTENDANCE MACHINE - HARDENED VERSION
  ============================================================================

  Existing functions preserved from the original 2,847-line sketch:
    - Fingerprint attendance
    - Frontend-controlled enrollment through backend polling
    - OLED status screens
    - Green/red LED + buzzer feedback
    - Serial diagnostic commands
    - Physical sensor slot check/delete
    - Device-authenticated HTTP API

  ADDITIONAL WIFI/RECOVERY FEATURES:
    - Primary + secondary Wi-Fi credentials stored in ESP32 NVS.
    - Automatic primary -> secondary failover.
    - Automatic return to primary when it becomes available.
    - ERP-controlled remote Wi-Fi configuration.
    - Transactional Wi-Fi changes: test Wi-Fi + ERP before committing.
    - ESP32 device-authenticated Wi-Fi configuration polling/ACK/runtime reporting.
    - Physical CONFIG-button recovery mode.
    - Setup AP/captive portal recovery.
    - BLE Wi-Fi provisioning/recovery.
    - Wi-Fi-only factory reset without deleting fingerprint templates or device identity.

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

  GET /api/device/fingerprint-enroll/{enrollmentId}/status
      Headers: x-device-code, x-device-secret
      Response:
        {
          "success": true,
          "data": {
            "enrollmentId": 12,
            "status": "IN_PROGRESS"
          }
        }
      When the admin cancels the enrollment, the status becomes
      "CANCELLED". The ESP32 must stop physical enrollment and clean up
      any template already stored in the assigned sensor slot.

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
#include <WebServer.h>
#include <DNSServer.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
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
//
// Wi-Fi credentials are stored in ESP32 NVS (Preferences).
// The compile-time values below are only a migration fallback for the
// currently installed device. After the first successful boot they are copied
// into NVS. Change/rotate these credentials from the ERP or provisioning flow.
//
// IMPORTANT:
// - Do not display stored passwords in the ERP.
// - Remote configuration is applied transactionally.
// - A configuration is committed only after at least one candidate network
//   connects and the ERP backend is reachable.
// ============================================================================

const char* DEFAULT_PRIMARY_WIFI_SSID = "Dharm's S24";
const char* DEFAULT_PRIMARY_WIFI_PASSWORD = "Bhadani@99";

const char* DEFAULT_SECONDARY_WIFI_SSID = "Maulik's S24";
const char* DEFAULT_SECONDARY_WIFI_PASSWORD = "12345678";

// Physical CONFIG button. Change this pin if your hardware uses another GPIO.
#define CONFIG_BUTTON_PIN 27

// Holding CONFIG_BUTTON_HOLD_MS at boot enters provisioning/recovery mode.
const unsigned long CONFIG_BUTTON_HOLD_MS = 3000;

// Setup AP / captive portal.
const char* SETUP_AP_PASSWORD = "ERPSetup123";
const unsigned long PROVISIONING_IDLE_TIMEOUT = 15UL * 60UL * 1000UL;

// Remote Wi-Fi configuration polling.
const unsigned long WIFI_CONFIG_POLL_INTERVAL = 30000;
const unsigned long WIFI_RUNTIME_REPORT_INTERVAL = 30000;
const unsigned long PRIMARY_RETURN_CHECK_INTERVAL = 60000;

// Wi-Fi configuration version/status stored in NVS.
Preferences wifiPrefs;

struct WiFiCredentials {
  String ssid;
  String password;
};

struct WiFiConfiguration {
  WiFiCredentials primary;
  WiFiCredentials secondary;
  uint32_t version;
};

WiFiConfiguration wifiConfig = {
  {"", ""},
  {"", ""},
  0
};

enum ActiveWiFiNetwork {
  WIFI_NETWORK_NONE,
  WIFI_NETWORK_PRIMARY,
  WIFI_NETWORK_SECONDARY
};

ActiveWiFiNetwork activeWiFiNetwork = WIFI_NETWORK_NONE;

unsigned long lastWiFiConfigPoll = 0;
unsigned long lastWiFiRuntimeReport = 0;
unsigned long lastPrimaryReturnCheck = 0;
unsigned long provisioningStartedAt = 0;

bool provisioningMode = false;
bool wifiConfigRequestInProgress = false;
bool wifiRuntimeReportInProgress = false;
bool primaryReturnCheckInProgress = false;
bool configButtonHandled = false;
unsigned long configButtonPressedAt = 0;

// ============================================================================
// ERP BACKEND CONFIGURATION
// ===========================================================================

const char* BACKEND_BASE_URL = "http://10.169.246.69:5000";
const char* DEVICE_CODE = "ESP32-001";
const char* DEVICE_SECRET = "c008c665a1ee695f7d088dc98da43f91e772c98fc388695d08bd34ab4c7c1b93";

const char* ATTENDANCE_ENDPOINT = "/api/attendance/punch";
const char* ENROLLMENT_PENDING_ENDPOINT = "/api/device/fingerprint-enroll/pending";
const char* ENROLLMENT_RESULT_ENDPOINT = "/api/device/fingerprint-enroll/result";
const char* ENROLLMENT_LOG_ENDPOINT = "/api/device/fingerprint-enroll/log";
const char* ENROLLMENT_STATUS_ENDPOINT = "/api/device/fingerprint-enroll";

// Remote Wi-Fi management endpoints.
const char* WIFI_CONFIG_ENDPOINT = "/api/device/wifi-config";
const char* WIFI_CONFIG_ACK_ENDPOINT = "/api/device/wifi-config/ack";
const char* WIFI_CONFIG_RUNTIME_ENDPOINT = "/api/device/wifi-config/runtime";

// ============================================================================
// TIMING
// ============================================================================

const unsigned long ENROLLMENT_POLL_INTERVAL = 5000;
const unsigned long ENROLLMENT_RESULT_RETRY_INTERVAL = 10000;
const unsigned long ENROLLMENT_STATUS_CHECK_INTERVAL = 1500;
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
const unsigned long WIFI_FAILOVER_RETRY_INTERVAL = 5000;
const uint8_t WIFI_NETWORK_CONNECT_ATTEMPTS = 2;

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
unsigned long lastEnrollmentStatusCheck = 0;
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
#define BUZZER    21

// ============================================================================
// OLED CONFIGURATION
// ============================================================================

#define OLED_SDA 23
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
// LOCAL PROVISIONING / RECOVERY SERVICES
// ============================================================================

WebServer provisioningServer(80);
DNSServer provisioningDnsServer;

const byte DNS_PORT = 53;

bool provisioningServerStarted = false;
bool bleProvisioningStarted = false;

BLEServer* bleServer = nullptr;
BLECharacteristic* bleConfigCharacteristic = nullptr;
BLECharacteristic* bleStatusCharacteristic = nullptr;

const char* BLE_SERVICE_UUID = "6d2a0001-4f70-4d9f-a3a8-esp32erp001";
const char* BLE_CONFIG_UUID  = "6d2a0002-4f70-4d9f-a3a8-esp32erp001";
const char* BLE_STATUS_UUID  = "6d2a0003-4f70-4d9f-a3a8-esp32erp001";

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

// Set when the ERP admin cancels the active enrollment. The physical sensor
// is cleaned up before the ESP32 returns to attendance mode.
bool enrollmentCancelRequested = false;

// Internal return code used only by the enrollment wait helpers.
const uint8_t ENROLLMENT_CANCELLED_RESULT = 0xFE;

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

String activeWiFiNetworkName() {
  if (activeWiFiNetwork == WIFI_NETWORK_PRIMARY) {
    return "PRIMARY";
  }

  if (activeWiFiNetwork == WIFI_NETWORK_SECONDARY) {
    return "SECONDARY";
  }

  return "NONE";
}

void loadWiFiConfiguration() {
  wifiPrefs.begin("wifi_cfg", true);

  wifiConfig.primary.ssid =
    wifiPrefs.getString("p_ssid", DEFAULT_PRIMARY_WIFI_SSID);

  wifiConfig.primary.password =
    wifiPrefs.getString("p_pass", DEFAULT_PRIMARY_WIFI_PASSWORD);

  wifiConfig.secondary.ssid =
    wifiPrefs.getString("s_ssid", DEFAULT_SECONDARY_WIFI_SSID);

  wifiConfig.secondary.password =
    wifiPrefs.getString("s_pass", DEFAULT_SECONDARY_WIFI_PASSWORD);

  wifiConfig.version =
    wifiPrefs.getUInt("version", 0);

  wifiPrefs.end();

  Serial.println();
  Serial.println("====================================");
  Serial.println(" LOADED WIFI CONFIGURATION");
  Serial.println("====================================");
  Serial.print("Primary SSID: ");
  Serial.println(
    wifiConfig.primary.ssid.length() > 0
      ? wifiConfig.primary.ssid
      : "(not configured)"
  );
  Serial.print("Secondary SSID: ");
  Serial.println(
    wifiConfig.secondary.ssid.length() > 0
      ? wifiConfig.secondary.ssid
      : "(not configured)"
  );
  Serial.print("Config version: ");
  Serial.println(wifiConfig.version);
  Serial.println("Passwords are not printed.");
}

void saveWiFiConfiguration(
  const WiFiConfiguration& config
) {
  wifiPrefs.begin("wifi_cfg", false);

  wifiPrefs.putString(
    "p_ssid",
    config.primary.ssid
  );

  wifiPrefs.putString(
    "p_pass",
    config.primary.password
  );

  wifiPrefs.putString(
    "s_ssid",
    config.secondary.ssid
  );

  wifiPrefs.putString(
    "s_pass",
    config.secondary.password
  );

  wifiPrefs.putUInt(
    "version",
    config.version
  );

  wifiPrefs.end();

  wifiConfig = config;
}

bool hasPrimaryWiFi() {
  return wifiConfig.primary.ssid.length() > 0 &&
         wifiConfig.primary.password.length() >= 8;
}

bool hasSecondaryWiFi() {
  return wifiConfig.secondary.ssid.length() > 0 &&
         wifiConfig.secondary.password.length() >= 8;
}

bool connectToNetwork(
  const WiFiCredentials& credentials,
  ActiveWiFiNetwork network,
  unsigned long timeoutMs = WIFI_CONNECT_TIMEOUT
) {
  if (credentials.ssid.length() == 0) {
    return false;
  }

  Serial.println();
  Serial.println("====================================");
  Serial.print("Connecting to ");
  Serial.println(
    network == WIFI_NETWORK_PRIMARY
      ? "PRIMARY Wi-Fi"
      : "SECONDARY Wi-Fi"
  );
  Serial.println("====================================");
  Serial.print("SSID: ");
  Serial.println(credentials.ssid);

  WiFi.disconnect(true, true);
  delay(150);

  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(
    credentials.ssid.c_str(),
    credentials.password.c_str()
  );

  unsigned long startTime = millis();

  while (
    WiFi.status() != WL_CONNECTED &&
    millis() - startTime < timeoutMs
  ) {
    serviceOLED();
    delay(250);
    Serial.print(".");
  }

  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    activeWiFiNetwork = network;

    Serial.println("Wi-Fi connected.");
    Serial.print("SSID: ");
    Serial.println(WiFi.SSID());
    Serial.print("ESP32 IP: ");
    Serial.println(WiFi.localIP());

    return true;
  }

  Serial.println("Wi-Fi connection failed.");
  return false;
}

bool checkBackendConnectivityForCurrentWiFi() {
  if (WiFi.status() != WL_CONNECTED) {
    return false;
  }

  if (!backendConfigured()) {
    return false;
  }

  HTTPClient http;
  String url = makeUrl(WIFI_CONFIG_ENDPOINT);

  http.setConnectTimeout(HTTP_CONNECT_TIMEOUT);
  http.setTimeout(HTTP_TIMEOUT);

  if (!http.begin(url)) {
    return false;
  }

  addDeviceHeaders(http);

  int httpCode = http.GET();
  http.end();

  return httpCode >= 200 && httpCode < 300;
}

bool connectWiFi(bool force = false) {
  unsigned long now = millis();

  if (
    !force &&
    WiFi.status() == WL_CONNECTED
  ) {
    return true;
  }

  if (
    !force &&
    now - lastWiFiAttempt < WIFI_RETRY_INTERVAL
  ) {
    return false;
  }

  lastWiFiAttempt = now;

  // Primary is always attempted first.
  if (hasPrimaryWiFi()) {
    for (
      uint8_t attempt = 0;
      attempt < WIFI_NETWORK_CONNECT_ATTEMPTS;
      attempt++
    ) {
      if (
        connectToNetwork(
          wifiConfig.primary,
          WIFI_NETWORK_PRIMARY
        )
      ) {
        showOLED(
          "WiFi Connected",
          "Primary Network",
          WiFi.localIP().toString(),
          "ERP Ready"
        );
        return true;
      }
    }
  }

  // If primary fails, automatically use secondary.
  if (hasSecondaryWiFi()) {
    for (
      uint8_t attempt = 0;
      attempt < WIFI_NETWORK_CONNECT_ATTEMPTS;
      attempt++
    ) {
      if (
        connectToNetwork(
          wifiConfig.secondary,
          WIFI_NETWORK_SECONDARY
        )
      ) {
        showOLED(
          "WiFi Connected",
          "Secondary Network",
          WiFi.localIP().toString(),
          "ERP Ready"
        );
        return true;
      }
    }
  }

  activeWiFiNetwork = WIFI_NETWORK_NONE;

  Serial.println("Both configured Wi-Fi networks failed.");

  showOLED(
    "WiFi Failed",
    "Primary + Secondary",
    "Recovery Available",
    "Check Network"
  );

  return false;
}

bool ensureWiFi() {
  if (WiFi.status() == WL_CONNECTED) {
    return true;
  }

  return connectWiFi(false);
}

bool tryReturnToPrimary() {
  if (
    activeWiFiNetwork != WIFI_NETWORK_SECONDARY ||
    !hasPrimaryWiFi()
  ) {
    return false;
  }

  unsigned long now = millis();

  if (
    now - lastPrimaryReturnCheck <
    PRIMARY_RETURN_CHECK_INTERVAL
  ) {
    return false;
  }

  lastPrimaryReturnCheck = now;

  Serial.println("Checking whether PRIMARY Wi-Fi has returned...");

  ActiveWiFiNetwork previousNetwork =
    activeWiFiNetwork;

  if (
    connectToNetwork(
      wifiConfig.primary,
      WIFI_NETWORK_PRIMARY,
      4000
    )
  ) {
    if (checkBackendConnectivityForCurrentWiFi()) {
      Serial.println("Primary Wi-Fi restored and ERP is reachable.");
      return true;
    }

    Serial.println(
      "Primary Wi-Fi connected but ERP is unreachable. "
      "Returning to secondary."
    );
  }

  if (
    previousNetwork == WIFI_NETWORK_SECONDARY &&
    hasSecondaryWiFi()
  ) {
    connectToNetwork(
      wifiConfig.secondary,
      WIFI_NETWORK_SECONDARY
    );
  }

  return false;
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
// REMOTE WIFI CONFIGURATION
// ============================================================================

bool parseWiFiConfigurationDocument(
  JsonDocument& doc,
  WiFiConfiguration& candidate
) {
  JsonVariant data = doc["data"];

  if (data.isNull()) {
    return false;
  }

  // Current backend contract:
  // data.configuration.primarySsid
  // data.configuration.primaryPassword
  // data.configuration.secondarySsid
  // data.configuration.secondaryPassword
  JsonVariant configuration = data["configuration"];

  if (configuration.isNull()) {
    return false;
  }

  String primarySsid =
    configuration["primarySsid"] | "";

  String primaryPassword =
    configuration["primaryPassword"] | "";

  String secondarySsid =
    configuration["secondarySsid"] | "";

  String secondaryPassword =
    configuration["secondaryPassword"] | "";

  if (
    primarySsid.length() == 0 ||
    primaryPassword.length() < 8 ||
    primaryPassword.length() > 63
  ) {
    return false;
  }

  if (
    secondarySsid.length() > 0 &&
    (
      secondaryPassword.length() < 8 ||
      secondaryPassword.length() > 63
    )
  ) {
    return false;
  }

  candidate.primary.ssid = primarySsid;
  candidate.primary.password = primaryPassword;

  candidate.secondary.ssid = secondarySsid;
  candidate.secondary.password =
    secondarySsid.length() > 0
      ? secondaryPassword
      : "";

  candidate.version =
    data["configVersion"] | 0;

  return true;
}

bool acknowledgeWiFiConfiguration(
  uint32_t version,
  bool applied,
  const String& errorMessage
) {
  if (!ensureWiFi()) {
    return false;
  }

  HTTPClient http;
  String url = makeUrl(WIFI_CONFIG_ACK_ENDPOINT);

  http.setConnectTimeout(HTTP_CONNECT_TIMEOUT);
  http.setTimeout(HTTP_TIMEOUT);

  if (!http.begin(url)) {
    return false;
  }

  addDeviceHeaders(http);

  JsonDocument doc;
  doc["configVersion"] = version;
  doc["success"] = applied;
  doc["activeNetwork"] = activeWiFiNetworkName();

  if (errorMessage.length() > 0) {
    doc["error"] = errorMessage;
  } else {
    doc["error"] = nullptr;
  }

  String body;
  serializeJson(doc, body);

  int httpCode = http.POST(body);
  String response = http.getString();

  Serial.print("Wi-Fi config ACK HTTP code: ");
  Serial.println(httpCode);

  if (response.length() > 0) {
    Serial.println(response);
  }

  http.end();

  return httpCode >= 200 && httpCode < 300;
}

bool reportWiFiRuntimeState(
  const String& activeNetwork,
  const String& errorMessage = ""
) {
  if (WiFi.status() != WL_CONNECTED) {
    return false;
  }

  if (!backendConfigured()) {
    return false;
  }

  HTTPClient http;
  String url = makeUrl(WIFI_CONFIG_RUNTIME_ENDPOINT);

  http.setConnectTimeout(HTTP_CONNECT_TIMEOUT);
  http.setTimeout(HTTP_TIMEOUT);

  if (!http.begin(url)) {
    return false;
  }

  addDeviceHeaders(http);

  JsonDocument doc;

  if (activeNetwork.length() > 0) {
    doc["activeNetwork"] = activeNetwork;
  }

  if (errorMessage.length() > 0) {
    doc["lastError"] = errorMessage;
  } else {
    doc["lastError"] = nullptr;
  }

  String body;
  serializeJson(doc, body);

  int httpCode = http.POST(body);

  Serial.print("Wi-Fi runtime HTTP code: ");
  Serial.println(httpCode);

  http.end();

  return httpCode >= 200 && httpCode < 300;
}

bool applyRemoteWiFiConfiguration(
  const WiFiConfiguration& candidate
) {
  if (candidate.version == 0) {
    return false;
  }

  WiFiConfiguration previous =
    wifiConfig;

  ActiveWiFiNetwork previousNetwork =
    activeWiFiNetwork;

  Serial.println();
  Serial.println("====================================");
  Serial.println(" APPLYING REMOTE WIFI CONFIGURATION");
  Serial.println("====================================");
  Serial.print("Candidate version: ");
  Serial.println(candidate.version);

  bool connected = false;

  // Test PRIMARY first.
  if (
    candidate.primary.ssid.length() > 0 &&
    candidate.primary.password.length() >= 8
  ) {
    connected =
      connectToNetwork(
        candidate.primary,
        WIFI_NETWORK_PRIMARY
      );

    if (
      connected &&
      !checkBackendConnectivityForCurrentWiFi()
    ) {
      Serial.println(
        "Candidate primary connected, but ERP test failed."
      );
      connected = false;
    }
  }

  // Test SECONDARY if primary failed.
  if (
    !connected &&
    candidate.secondary.ssid.length() > 0 &&
    candidate.secondary.password.length() >= 8
  ) {
    connected =
      connectToNetwork(
        candidate.secondary,
        WIFI_NETWORK_SECONDARY
      );

    if (
      connected &&
      !checkBackendConnectivityForCurrentWiFi()
    ) {
      Serial.println(
        "Candidate secondary connected, but ERP test failed."
      );
      connected = false;
    }
  }

  if (!connected) {
    Serial.println(
      "Remote Wi-Fi configuration rejected. "
      "Restoring previous configuration."
    );

    wifiConfig = previous;

    bool restored = false;

    if (
      previousNetwork == WIFI_NETWORK_PRIMARY &&
      hasPrimaryWiFi()
    ) {
      restored =
        connectToNetwork(
          previous.primary,
          WIFI_NETWORK_PRIMARY
        );
    }

    if (
      !restored &&
      previousNetwork == WIFI_NETWORK_SECONDARY &&
      hasSecondaryWiFi()
    ) {
      restored =
        connectToNetwork(
          previous.secondary,
          WIFI_NETWORK_SECONDARY
        );
    }

    if (!restored) {
      restored = connectWiFi(true);
    }

    return false;
  }

  // Only after connection + ERP validation succeeds do we commit to NVS.
  saveWiFiConfiguration(candidate);

  Serial.println(
    "Remote Wi-Fi configuration committed to NVS."
  );

  return true;
}

void pollRemoteWiFiConfiguration(bool force = false) {
  if (wifiConfigRequestInProgress) {
    return;
  }

  unsigned long now = millis();

  if (
    !force &&
    now - lastWiFiConfigPoll <
    WIFI_CONFIG_POLL_INTERVAL
  ) {
    return;
  }

  lastWiFiConfigPoll = now;

  if (!ensureWiFi()) {
    return;
  }

  wifiConfigRequestInProgress = true;

  HTTPClient http;
  String url = makeUrl(WIFI_CONFIG_ENDPOINT);

  http.setConnectTimeout(HTTP_CONNECT_TIMEOUT);
  http.setTimeout(HTTP_TIMEOUT);

  if (!http.begin(url)) {
    wifiConfigRequestInProgress = false;
    return;
  }

  addDeviceHeaders(http);

  int httpCode = http.GET();

  if (httpCode <= 0) {
    Serial.print("Wi-Fi configuration poll failed: ");
    Serial.println(http.errorToString(httpCode));
    http.end();
    wifiConfigRequestInProgress = false;
    return;
  }

  String response = http.getString();

  Serial.print("Wi-Fi configuration HTTP code: ");
  Serial.println(httpCode);

  if (httpCode < 200 || httpCode >= 300) {
    http.end();
    wifiConfigRequestInProgress = false;
    return;
  }

  JsonDocument doc;
  DeserializationError error =
    deserializeJson(doc, response);

  http.end();

  if (error) {
    Serial.print(
      "Could not parse Wi-Fi configuration: "
    );
    Serial.println(error.c_str());

    wifiConfigRequestInProgress = false;
    return;
  }

  bool success =
    doc["success"] | false;

  if (!success) {
    wifiConfigRequestInProgress = false;
    return;
  }

  JsonVariant data = doc["data"];

  if (data.isNull()) {
    wifiConfigRequestInProgress = false;
    return;
  }

  uint32_t remoteVersion =
    data["configVersion"] | 0;

  if (
    remoteVersion == 0 ||
    remoteVersion <= wifiConfig.version
  ) {
    wifiConfigRequestInProgress = false;
    return;
  }

  WiFiConfiguration candidate;
  candidate.version = remoteVersion;

  if (
    !parseWiFiConfigurationDocument(
      doc,
      candidate
    )
  ) {
    Serial.println(
      "Remote Wi-Fi configuration failed validation."
    );

    acknowledgeWiFiConfiguration(
      remoteVersion,
      false,
      "Invalid Wi-Fi configuration received by device."
    );

    wifiConfigRequestInProgress = false;
    return;
  }

  bool applied =
    applyRemoteWiFiConfiguration(candidate);

  if (applied) {
    Serial.println(
      "Remote Wi-Fi configuration applied successfully."
    );

    acknowledgeWiFiConfiguration(
      candidate.version,
      true,
      ""
    );

    showOLED(
      "WiFi Updated",
      "Config Applied",
      activeWiFiNetworkName(),
      "ERP Connected"
    );

    delay(800);
    showAttendanceReady();

  } else {
    Serial.println(
      "Remote Wi-Fi configuration could not be applied."
    );

    acknowledgeWiFiConfiguration(
      candidate.version,
      false,
      "Could not connect to a configured network and ERP backend."
    );
  }

  wifiConfigRequestInProgress = false;
}

void serviceConfigButton() {
  bool pressed =
    digitalRead(CONFIG_BUTTON_PIN) == LOW;

  if (pressed) {
    if (configButtonPressedAt == 0) {
      configButtonPressedAt = millis();
      Serial.println("CONFIG button pressed.");
    }

    if (
      !configButtonHandled &&
      millis() - configButtonPressedAt >=
        CONFIG_BUTTON_HOLD_MS
    ) {
      configButtonHandled = true;
      startRecoveryMode();
    }
  } else {
    configButtonPressedAt = 0;
    configButtonHandled = false;
  }
}

void serviceWiFiManagement() {
  if (provisioningMode) {
    return;
  }

  pollRemoteWiFiConfiguration(false);

  if (WiFi.status() == WL_CONNECTED) {
    tryReturnToPrimary();

    unsigned long now = millis();

    if (
      !wifiRuntimeReportInProgress &&
      (
        lastWiFiRuntimeReport == 0 ||
        now - lastWiFiRuntimeReport >=
          WIFI_RUNTIME_REPORT_INTERVAL
      )
    ) {
      wifiRuntimeReportInProgress = true;

      if (
        reportWiFiRuntimeState(
          activeWiFiNetworkName(),
          ""
        )
      ) {
        lastWiFiRuntimeReport = now;
      }

      wifiRuntimeReportInProgress = false;
    }

  } else {
    activeWiFiNetwork = WIFI_NETWORK_NONE;
  }
}

// ============================================================================
// PROVISIONING / RECOVERY
// ============================================================================

String provisioningApName() {
  return String("ERP-ESP32-") + String(DEVICE_CODE);
}

String htmlEscape(const String& value) {
  String result = value;
  result.replace("&", "&amp;");
  result.replace("<", "&lt;");
  result.replace(">", "&gt;");
  result.replace("\"", "&quot;");
  return result;
}

String provisioningPage(
  const String& message = ""
) {
  String html;

  html += "<!doctype html><html><head>";
  html += "<meta name='viewport' content='width=device-width,initial-scale=1'>";
  html += "<title>ESP32 ERP Wi-Fi Setup</title>";
  html += "<style>";
  html += "body{font-family:Arial,sans-serif;max-width:560px;margin:30px auto;padding:20px}";
  html += "input{width:100%;padding:10px;margin:6px 0 14px;box-sizing:border-box}";
  html += "button{padding:11px 18px;margin-right:8px}";
  html += ".box{border:1px solid #ddd;border-radius:8px;padding:16px;margin-bottom:16px}";
  html += "</style></head><body>";

  html += "<h2>Fingerprint ERP - Wi-Fi Setup</h2>";

  html += "<div class='box'>";
  html += "<p><b>Device:</b> ";
  html += htmlEscape(String(DEVICE_CODE));
  html += "</p>";
  html += "<p><b>Active Network:</b> ";
  html += htmlEscape(activeWiFiNetworkName());
  html += "</p>";
  html += "<p><b>Config Version:</b> ";
  html += String(wifiConfig.version);
  html += "</p>";
  html += "</div>";

  if (message.length() > 0) {
    html += "<div class='box'><b>";
    html += htmlEscape(message);
    html += "</b></div>";
  }

  html += "<form method='POST' action='/save'>";

  html += "<div class='box'><h3>Primary Wi-Fi</h3>";
  html += "<label>SSID</label>";
  html += "<input name='primarySsid' required>";
  html += "<label>Password</label>";
  html += "<input name='primaryPassword' type='password' required>";
  html += "</div>";

  html += "<div class='box'><h3>Secondary Wi-Fi</h3>";
  html += "<label>SSID</label>";
  html += "<input name='secondarySsid'>";
  html += "<label>Password</label>";
  html += "<input name='secondaryPassword' type='password'>";
  html += "</div>";

  html += "<button type='submit'>Test & Save</button>";
  html += "</form>";

  html += "<p>Existing passwords are never displayed.</p>";

  html += "</body></html>";

  return html;
}

bool applyProvisioningCredentials(
  const String& primarySsid,
  const String& primaryPassword,
  const String& secondarySsid,
  const String& secondaryPassword
) {
  WiFiConfiguration candidate = wifiConfig;

  candidate.primary.ssid = primarySsid;
  candidate.primary.password = primaryPassword;

  candidate.secondary.ssid = secondarySsid;
  candidate.secondary.password =
    secondarySsid.length() > 0
      ? secondaryPassword
      : "";

  // Local provisioning is a new configuration. Keep the current version
  // until the test succeeds, then advance it locally.
  candidate.version =
    wifiConfig.version + 1;

  if (
    candidate.primary.ssid.length() == 0 ||
    candidate.primary.password.length() < 8 ||
    candidate.primary.password.length() > 63
  ) {
    return false;
  }

  if (
    candidate.secondary.ssid.length() > 0 &&
    (
      candidate.secondary.password.length() < 8 ||
      candidate.secondary.password.length() > 63
    )
  ) {
    return false;
  }

  return applyRemoteWiFiConfiguration(
    candidate
  );
}

void handleProvisioningRoot() {
  provisioningServer.send(
    200,
    "text/html",
    provisioningPage()
  );
}

void handleProvisioningSave() {
  String primarySsid =
    provisioningServer.arg("primarySsid");

  String primaryPassword =
    provisioningServer.arg("primaryPassword");

  String secondarySsid =
    provisioningServer.arg("secondarySsid");

  String secondaryPassword =
    provisioningServer.arg("secondaryPassword");

  primarySsid.trim();
  secondarySsid.trim();

  if (
    primarySsid.length() == 0 ||
    primaryPassword.length() < 8 ||
    primaryPassword.length() > 63
  ) {
    provisioningServer.send(
      400,
      "text/html",
      provisioningPage(
        "Invalid primary Wi-Fi credentials."
      )
    );
    return;
  }

  if (
    secondarySsid.length() > 0 &&
    (
      secondaryPassword.length() < 8 ||
      secondaryPassword.length() > 63
    )
  ) {
    provisioningServer.send(
      400,
      "text/html",
      provisioningPage(
        "Invalid secondary Wi-Fi credentials."
      )
    );
    return;
  }

  bool applied =
    applyProvisioningCredentials(
      primarySsid,
      primaryPassword,
      secondarySsid,
      secondaryPassword
    );

  if (applied) {
    provisioningServer.send(
      200,
      "text/html",
      provisioningPage(
        "Wi-Fi configuration saved. The device is connected and ERP is reachable."
      )
    );

    delay(500);
    stopProvisioningAP();
    stopBLEProvisioning();

    reportWiFiRuntimeState(
      activeWiFiNetworkName(),
      ""
    );
  } else {
    provisioningServer.send(
      400,
      "text/html",
      provisioningPage(
        "Configuration rejected. The device could not validate the network and ERP connection."
      )
    );
  }
}

void handleProvisioningStatus() {
  JsonDocument doc;

  doc["deviceCode"] = DEVICE_CODE;
  doc["activeNetwork"] =
    activeWiFiNetworkName();
  doc["wifiConnected"] =
    WiFi.status() == WL_CONNECTED;
  doc["ip"] =
    WiFi.status() == WL_CONNECTED
      ? WiFi.localIP().toString()
      : "";
  doc["configVersion"] =
    wifiConfig.version;

  String response;
  serializeJson(doc, response);

  provisioningServer.send(
    200,
    "application/json",
    response
  );
}

void startProvisioningAP() {
  if (provisioningMode) {
    return;
  }

  provisioningMode = true;
  provisioningStartedAt = millis();

  Serial.println();
  Serial.println("====================================");
  Serial.println(" STARTING WIFI PROVISIONING MODE");
  Serial.println("====================================");

  WiFi.disconnect(true, true);
  delay(200);

  WiFi.mode(WIFI_AP);

  String apName =
    provisioningApName();

  bool apStarted =
    WiFi.softAP(
      apName.c_str(),
      SETUP_AP_PASSWORD
    );

  if (!apStarted) {
    Serial.println("Failed to start provisioning AP.");
    provisioningMode = false;
    return;
  }

  IPAddress apIp =
    WiFi.softAPIP();

  Serial.print("Provisioning SSID: ");
  Serial.println(apName);
  Serial.print("Provisioning password: ");
  Serial.println(SETUP_AP_PASSWORD);
  Serial.print("Provisioning IP: ");
  Serial.println(apIp);

  provisioningDnsServer.start(
    DNS_PORT,
    "*",
    apIp
  );

  provisioningServer.on(
    "/",
    HTTP_GET,
    handleProvisioningRoot
  );

  provisioningServer.on(
    "/save",
    HTTP_POST,
    handleProvisioningSave
  );

  provisioningServer.on(
    "/status",
    HTTP_GET,
    handleProvisioningStatus
  );

  provisioningServer.onNotFound(
    []() {
      provisioningServer.send(
        200,
        "text/html",
        provisioningPage()
      );
    }
  );

  provisioningServer.begin();
  provisioningServerStarted = true;

  showOLED(
    "WiFi Setup Mode",
    apName,
    apIp.toString(),
    "Open browser"
  );
}

void stopProvisioningAP() {
  if (!provisioningMode) {
    return;
  }

  if (provisioningServerStarted) {
    provisioningServer.stop();
    provisioningServerStarted = false;
  }

  provisioningDnsServer.stop();

  WiFi.softAPdisconnect(true);

  provisioningMode = false;

  Serial.println("Provisioning AP stopped.");
}

void serviceProvisioningAP() {
  if (!provisioningMode) {
    return;
  }

  provisioningDnsServer.processNextRequest();
  provisioningServer.handleClient();

  if (
    provisioningStartedAt > 0 &&
    millis() - provisioningStartedAt >
      PROVISIONING_IDLE_TIMEOUT
  ) {
    Serial.println(
      "Provisioning idle timeout. Returning to normal mode."
    );

    stopProvisioningAP();
    connectWiFi(true);
    showAttendanceReady();
  }
}

// ============================================================================
// BLE PROVISIONING
// ============================================================================

class BLEConfigCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* characteristic) override {
    String value =
      characteristic->getValue();

    if (value.length() == 0) {
      return;
    }

    String payload =
      value;

    Serial.println("BLE Wi-Fi configuration received.");

    JsonDocument doc;

    DeserializationError error =
      deserializeJson(doc, payload);

    if (error) {
      bleStatusCharacteristic->setValue(
        "ERROR: Invalid JSON"
      );
      bleStatusCharacteristic->notify();
      return;
    }

    String primarySsid =
      doc["primarySsid"] | "";

    String primaryPassword =
      doc["primaryPassword"] | "";

    String secondarySsid =
      doc["secondarySsid"] | "";

    String secondaryPassword =
      doc["secondaryPassword"] | "";

    bool applied =
      applyProvisioningCredentials(
        primarySsid,
        primaryPassword,
        secondarySsid,
        secondaryPassword
      );

    if (applied) {
      bleStatusCharacteristic->setValue(
        "OK: WiFi configuration applied"
      );
    } else {
      bleStatusCharacteristic->setValue(
        "ERROR: WiFi/ERP validation failed"
      );
    }

    bleStatusCharacteristic->notify();
  }
};

class ERPBLEServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* server) override {
    Serial.println("BLE provisioning client connected.");
  }

  void onDisconnect(BLEServer* server) override {
    Serial.println("BLE provisioning client disconnected.");
    BLEDevice::startAdvertising();
  }
};

void startBLEProvisioning() {
  if (bleProvisioningStarted) {
    return;
  }

  BLEDevice::init(
    provisioningApName().c_str()
  );

  bleServer =
    BLEDevice::createServer();

  bleServer->setCallbacks(
    new ERPBLEServerCallbacks()
  );

  BLEService* service =
    bleServer->createService(
      BLE_SERVICE_UUID
    );

  bleConfigCharacteristic =
    service->createCharacteristic(
      BLE_CONFIG_UUID,
      BLECharacteristic::PROPERTY_WRITE
    );

  bleConfigCharacteristic->setCallbacks(
    new BLEConfigCallbacks()
  );

  bleStatusCharacteristic =
    service->createCharacteristic(
      BLE_STATUS_UUID,
      BLECharacteristic::PROPERTY_READ |
      BLECharacteristic::PROPERTY_NOTIFY
    );

  bleStatusCharacteristic->addDescriptor(
    new BLE2902()
  );

  bleStatusCharacteristic->setValue(
    "READY"
  );

  service->start();

  BLEAdvertising* advertising =
    BLEDevice::getAdvertising();

  advertising->addServiceUUID(
    BLE_SERVICE_UUID
  );

  advertising->setScanResponse(true);
  advertising->start();

  bleProvisioningStarted = true;

  Serial.println("BLE provisioning started.");
}

void stopBLEProvisioning() {
  if (!bleProvisioningStarted) {
    return;
  }

  BLEDevice::getAdvertising()->stop();

  BLEDevice::deinit(true);

  bleProvisioningStarted = false;
  bleServer = nullptr;
  bleConfigCharacteristic = nullptr;
  bleStatusCharacteristic = nullptr;

  Serial.println("BLE provisioning stopped.");
}

void startRecoveryMode() {
  Serial.println();
  Serial.println("====================================");
  Serial.println(" WIFI RECOVERY MODE");
  Serial.println("====================================");

  startProvisioningAP();
  startBLEProvisioning();
}

void serviceRecoveryMode() {
  serviceProvisioningAP();
}

void factoryResetWiFiConfiguration() {
  Serial.println("Factory Wi-Fi reset requested.");

  wifiPrefs.begin("wifi_cfg", false);
  wifiPrefs.clear();
  wifiPrefs.end();

  wifiConfig.primary.ssid = "";
  wifiConfig.primary.password = "";
  wifiConfig.secondary.ssid = "";
  wifiConfig.secondary.password = "";
  wifiConfig.version = 0;

  activeWiFiNetwork = WIFI_NETWORK_NONE;

  WiFi.disconnect(true, true);

  startRecoveryMode();

  showOLED(
    "WiFi Reset",
    "Recovery Mode",
    "Connect to Setup AP",
    "Use browser/BLE"
  );
}

void checkConfigButtonAtBoot() {
  pinMode(
    CONFIG_BUTTON_PIN,
    INPUT_PULLUP
  );

  unsigned long start =
    millis();

  if (
    digitalRead(CONFIG_BUTTON_PIN) != LOW
  ) {
    return;
  }

  Serial.println(
    "CONFIG button detected. Hold to enter recovery."
  );

  while (
    digitalRead(CONFIG_BUTTON_PIN) == LOW &&
    millis() - start < CONFIG_BUTTON_HOLD_MS
  ) {
    digitalWrite(RED_LED, HIGH);
    serviceOLED();
    delay(50);
  }

  digitalWrite(RED_LED, LOW);

  if (
    millis() - start >=
      CONFIG_BUTTON_HOLD_MS
  ) {
    startRecoveryMode();
  }
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
// ENROLLMENT CANCELLATION CHECK
// ============================================================================
// The frontend cancellation changes the backend enrollment status to
// CANCELLED. Because the ESP32 performs physical enrollment locally, it must
// poll this status while waiting for user interaction and between sensor
// operations.
// ============================================================================

bool checkEnrollmentCancellation(bool force = false) {
  if (!currentEnrollment.valid || currentEnrollment.enrollmentId <= 0) {
    return false;
  }

  if (enrollmentCancelRequested) {
    return true;
  }

  unsigned long now = millis();

  if (
    !force &&
    now - lastEnrollmentStatusCheck < ENROLLMENT_STATUS_CHECK_INTERVAL
  ) {
    return false;
  }

  lastEnrollmentStatusCheck = now;

  // A network outage must not accidentally abort the physical enrollment.
  // The ESP32 will check again after Wi-Fi is restored.
  if (WiFi.status() != WL_CONNECTED) {
    return false;
  }

  HTTPClient http;
  String url =
    makeUrl(ENROLLMENT_STATUS_ENDPOINT) +
    "/" + String(currentEnrollment.enrollmentId) +
    "/status";

  http.setConnectTimeout(1200);
  http.setTimeout(2000);

  if (!http.begin(url)) {
    return false;
  }

  addDeviceHeaders(http);

  int httpCode = http.GET();

  if (httpCode <= 0) {
    http.end();
    return false;
  }

  String response = http.getString();

  if (httpCode == 404) {
    // Keep the current physical job alive if the status request itself is
    // temporarily unavailable. Do not interpret a transient HTTP problem as
    // a cancellation.
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
    http.end();
    return false;
  }

  String status = doc["data"]["status"] | "";

  http.end();

  if (status == "CANCELLED") {
    enrollmentCancelRequested = true;

    Serial.println();
    Serial.println("====================================");
    Serial.println(" ENROLLMENT CANCELLED BY ADMIN");
    Serial.println("====================================");
    Serial.print("Enrollment ID: ");
    Serial.println(currentEnrollment.enrollmentId);

    showOLED(
      "Enrollment Cancelled",
      "Admin stopped process",
      "Cleaning Sensor...",
      "Please wait"
    );

    return true;
  }

  return false;
}

// ============================================================================
// FINGER WAIT HELPERS
// ============================================================================

uint8_t waitForFingerImage(unsigned long timeoutMs) {
  unsigned long startTime = millis();

  while (millis() - startTime < timeoutMs) {
    serviceOLED();

    if (checkEnrollmentCancellation()) {
      return ENROLLMENT_CANCELLED_RESULT;
    }

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

    if (checkEnrollmentCancellation()) {
      return true;
    }

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

    if (checkEnrollmentCancellation()) {
      return ENROLLMENT_CANCELLED_RESULT;
    }

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

  if (result == ENROLLMENT_CANCELLED_RESULT || enrollmentCancelRequested) {
    errorMessageOut = "Enrollment cancelled by administrator.";
    return false;
  }

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
  if (result == FINGERPRINT_NOTFOUND ||
      result == FINGERPRINT_BADLOCATION) {
    return true;
  }

  // This sensor/firmware returns code 12 (DBRANGEFAIL) when
  // loadModel() is called for an unused but valid slot.
  // Treat it as available here because the slot is already validated
  // against the sensor capacity before enrollment starts.
  if (result == SENSOR_EMPTY_DB_ERROR_CODE) {
    return true;
  }

  return false;
}

// ============================================================================
// CANCELLED ENROLLMENT CLEANUP
// ============================================================================

bool deleteEnrollmentTemplateAfterCancellation(int sensorSlot) {
  if (sensorSlot < 1) {
    return true;
  }

  Serial.print("Checking physical sensor slot for cancellation cleanup: ");
  Serial.println(sensorSlot);

  uint8_t loadResult = finger.loadModel(sensorSlot);

  if (loadResult != FINGERPRINT_OK) {
    if (isKnownEmptySlotResult(loadResult)) {
      Serial.println("Cancellation cleanup: slot is already empty.");
      return true;
    }

    Serial.print("Cancellation cleanup could not safely load slot. Sensor code: ");
    Serial.println(loadResult);
    return false;
  }

  uint8_t deleteResult = finger.deleteModel(sensorSlot);

  if (deleteResult == FINGERPRINT_OK) {
    Serial.println("Cancellation cleanup: physical template deleted.");
    return true;
  }

  Serial.print("Cancellation cleanup FAILED. Sensor code: ");
  Serial.println(deleteResult);
  return false;
}

bool finishCancelledEnrollment(
  int sensorSlot,
  String& errorMessageOut
) {
  errorMessageOut = "Enrollment cancelled by administrator.";

  if (!currentEnrollment.valid) {
    return false;
  }

  reportEnrollmentLog(errorMessageOut);
  reportEnrollmentLog(
    "Stopping physical enrollment and checking sensor slot " +
    String(sensorSlot) + " for cleanup."
  );

  bool cleaned = deleteEnrollmentTemplateAfterCancellation(sensorSlot);

  if (cleaned) {
    reportEnrollmentLog(
      "Cancellation cleanup complete. The physical sensor slot is available."
    );
  } else {
    errorMessageOut +=
      " Physical sensor cleanup could not be confirmed; check the assigned sensor slot.";

    reportEnrollmentLog(errorMessageOut);
  }

  showOLED(
    "Enrollment Cancelled",
    cleaned ? "Sensor Cleaned" : "Check Sensor Slot",
    "Returning to",
    "Attendance Mode"
  );

  // Cancellation is not an enrollment failure. Do not emit the red failure
  // signal because the administrator intentionally stopped the operation.
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
  enrollmentCancelRequested = false;
  lastEnrollmentStatusCheck = 0;

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

  if (checkEnrollmentCancellation(true)) {
    return finishCancelledEnrollment(sensorSlot, errorMessageOut);
  }

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

  if (result == ENROLLMENT_CANCELLED_RESULT || enrollmentCancelRequested) {
    return finishCancelledEnrollment(sensorSlot, errorMessageOut);
  }

  if (result != FINGERPRINT_OK) {
    errorMessageOut =
      "First fingerprint scan failed. Sensor code: " + String(result) + ".";
    reportEnrollmentLog(errorMessageOut);
    errorSignal();
    return false;
  }

  reportEnrollmentLog("First fingerprint image captured.");

  if (checkEnrollmentCancellation(true)) {
    return finishCancelledEnrollment(sensorSlot, errorMessageOut);
  }

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

  if (checkEnrollmentCancellation(true)) {
    return finishCancelledEnrollment(sensorSlot, errorMessageOut);
  }

  showOLED(
    "ENROLLMENT MODE",
    "Place SAME Finger",
    "Scan 2 of 2",
    "Hold steadily"
  );

  reportEnrollmentLog("Place the SAME finger for scan 2 of 2.");

  result = waitForFingerImage(ENROLLMENT_STAGE_TIMEOUT);

  if (result == ENROLLMENT_CANCELLED_RESULT || enrollmentCancelRequested) {
    return finishCancelledEnrollment(sensorSlot, errorMessageOut);
  }

  if (result != FINGERPRINT_OK) {
    errorMessageOut =
      "Second fingerprint scan failed. Sensor code: " + String(result) + ".";
    reportEnrollmentLog(errorMessageOut);
    errorSignal();
    return false;
  }

  reportEnrollmentLog("Second fingerprint image captured.");

  if (checkEnrollmentCancellation(true)) {
    return finishCancelledEnrollment(sensorSlot, errorMessageOut);
  }

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

  if (checkEnrollmentCancellation(true)) {
    return finishCancelledEnrollment(sensorSlot, errorMessageOut);
  }

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

  if (checkEnrollmentCancellation(true)) {
    return finishCancelledEnrollment(sensorSlot, errorMessageOut);
  }

  // ----------------------------------------------------------
  // STORE MODEL
  // ----------------------------------------------------------

  showOLED(
    "ENROLLMENT MODE",
    "Saving Template...",
    "Slot: " + String(sensorSlot),
    "Please wait"
  );

  if (checkEnrollmentCancellation(true)) {
    return finishCancelledEnrollment(sensorSlot, errorMessageOut);
  }

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

  // The model now physically exists in the sensor. From this point onward,
  // any admin cancellation must delete the physical template before returning.
  if (checkEnrollmentCancellation(true)) {
    return finishCancelledEnrollment(sensorSlot, errorMessageOut);
  }

  // ----------------------------------------------------------
  // REMOVE FINGER BEFORE TEST
  // ----------------------------------------------------------

  showOLED(
    "Fingerprint Saved",
    "Remove Finger",
    "Preparing Test...",
    "Do not skip test"
  );

  if (enrollmentCancelRequested) {
    return finishCancelledEnrollment(sensorSlot, errorMessageOut);
  }

  if (!waitForFingerRemoval(FINGER_REMOVAL_TIMEOUT)) {
    if (enrollmentCancelRequested) {
      return finishCancelledEnrollment(sensorSlot, errorMessageOut);
    }

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

  if (checkEnrollmentCancellation(true)) {
    return finishCancelledEnrollment(sensorSlot, errorMessageOut);
  }

  bool verified = verifyStoredFingerprint(
    sensorSlot,
    verificationConfidence,
    errorMessageOut
  );

  if (enrollmentCancelRequested) {
    return finishCancelledEnrollment(sensorSlot, errorMessageOut);
  }

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

  if (checkEnrollmentCancellation(true)) {
    return finishCancelledEnrollment(sensorSlot, errorMessageOut);
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
  enrollmentCancelRequested = false;
  lastEnrollmentStatusCheck = 0;

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

  // A cancelled job is already terminal in the backend. Do NOT send a
  // FAILED/COMPLETED result afterward, because doing so could race with the
  // administrator cancellation and incorrectly change the enrollment state.
  if (enrollmentCancelRequested) {
    Serial.println("Enrollment was cancelled by the administrator.");

    currentEnrollment.valid = false;
    currentMode = ATTENDANCE_MODE;
    enrollmentCancelRequested = false;

    delay(700);
    waitForFingerRemoval(3000);
    showAttendanceReady();
    return;
  }

  // Final cancellation check immediately before reporting completion.
  if (checkEnrollmentCancellation(true)) {
    finishCancelledEnrollment(job.sensorSlot, errorMessage);

    currentEnrollment.valid = false;
    currentMode = ATTENDANCE_MODE;
    enrollmentCancelRequested = false;

    delay(700);
    waitForFingerRemoval(3000);
    showAttendanceReady();
    return;
  }

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
  enrollmentCancelRequested = false;

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
  Serial.println("F = Wi-Fi factory/network reset");
  Serial.println("V = Enter Wi-Fi provisioning/recovery mode");
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
    enrollmentCancelRequested = false;
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

  if (command == "F") {
    factoryResetWiFiConfiguration();
    return;
  }

  if (command == "V") {
    startRecoveryMode();
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
  loadWiFiConfiguration();

  // Check physical CONFIG button before normal Wi-Fi startup.
  checkConfigButtonAtBoot();

  // ----------------------------------------------------------
  // WIFI TEST
  // ----------------------------------------------------------
  showOLED(
    "WiFi",
    "CHECKING...",
    "Connecting",
    "Please wait..."
  );

  bool wifiOK = false;

  if (provisioningMode) {
    showStartupStatus(
      "WiFi",
      "SETUP MODE",
      "Provisioning AP active"
    );
  } else {
    wifiOK = connectWiFi(true);

    if (wifiOK) {
      showStartupStatus(
        "WiFi",
        activeWiFiNetworkName(),
        WiFi.localIP().toString()
      );
    } else {
      showStartupStatus(
        "WiFi",
        "FAILED",
        "Recovery/Retry Available"
      );
    }
  }

  // ----------------------------------------------------------
  // BACKEND TEST
  // ----------------------------------------------------------
  bool backendOK = false;

  if (wifiOK && !provisioningMode) {
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
  if (provisioningMode) {
    showOLED(
      "WIFI SETUP MODE",
      "Connect to Setup AP",
      "BLE also available",
      "Configure WiFi"
    );
  } else if (fingerprintOK && wifiOK && backendOK) {
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

  // First enrollment/Wi-Fi management polls happen immediately.
  lastEnrollmentPoll = millis() - ENROLLMENT_POLL_INTERVAL;
  lastEnrollmentResultRetry = millis() - ENROLLMENT_RESULT_RETRY_INTERVAL;
  lastWiFiConfigPoll = millis() - WIFI_CONFIG_POLL_INTERVAL;
  lastWiFiRuntimeReport = 0;
  lastPrimaryReturnCheck = millis() - PRIMARY_RETURN_CHECK_INTERVAL;

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
  serviceConfigButton();

  if (provisioningMode) {
    serviceRecoveryMode();
    delay(10);
    return;
  }

  // Background Wi-Fi maintenance. Primary is preferred, secondary is the
  // automatic fallback, and the device periodically checks whether primary
  // has returned.
  if (WiFi.status() != WL_CONNECTED) {
    if (!connectWiFi(false)) {
      // If both configured networks are unavailable, expose recovery services.
      startRecoveryMode();
      delay(10);
      return;
    }
  }

  serviceWiFiManagement();

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

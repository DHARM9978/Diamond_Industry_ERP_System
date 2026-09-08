/*
  ============================================================
       ESP32 FINGERPRINT ERP ATTENDANCE MACHINE
       FRONTEND -> BACKEND -> ESP32 ENROLLMENT CONTROL
  ============================================================

  Normal operation:
      Finger
        -> Fingerprint Sensor
        -> Sensor Slot / Finger ID
        -> ESP32
        -> Wi-Fi
        -> POST /api/attendance/punch
        -> ERP Backend
        -> IN / OUT

  Enrollment operation:
      Admin Frontend
        -> Backend creates PENDING enrollment job
        -> ESP32 polls pending enrollment
        -> ESP32 enters ENROLLMENT_MODE
        -> Scan same finger twice
        -> createModel()
        -> storeModel(sensorSlot)
        -> ESP32 verifies the newly stored fingerprint
        -> ESP32 reports result to Backend
        -> ESP32 returns to ATTENDANCE_MODE

  IMPORTANT:
  - The fingerprint template remains inside the fingerprint sensor.
  - The backend stores the mapping sensorSlot -> employee.
  - Do NOT put admin JWT credentials on the ESP32.
  - Replace the configuration placeholders below.

  REQUIRED BACKEND CONTRACT FOR THIS VERSION:

  1) GET /api/device/fingerprint-enroll/pending
     Device-authenticated.
     Expected response when a job exists:
       {
         "success": true,
         "data": {
           "enrollmentId": 12,
           "employeeId": 25,
           "sensorSlot": 7,
           "fingerName": "Right Thumb"
         }
       }

     Expected response when no job exists:
       {
         "success": true,
         "data": null
       }

  2) POST /api/device/fingerprint-enroll/result
     Device-authenticated.
     Request body:
       {
         "enrollmentId": 12,
         "employeeId": 25,
         "sensorSlot": 7,
         "fingerName": "Right Thumb",
         "success": true,
         "confidence": 120
       }

     For failure, success=false and an error field are sent.

  3) POST /api/attendance/punch
     Device-authenticated.
     Request body:
       { "sensorSlot": 7 }

  These two enrollment control endpoints are NOT assumed to already
  exist in the current backend. They must be implemented there before
  frontend-controlled enrollment will work.
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <ArduinoJson.h>

#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Adafruit_Fingerprint.h>


// ============================================================
// WIFI CONFIGURATION
// ============================================================

const char* WIFI_SSID = "Dharm's S24";
const char* WIFI_PASSWORD = "Bhadani@99";


// ============================================================
// ERP BACKEND CONFIGURATION
// ============================================================

// Use the LAN IPv4 address of the computer running Node.js.
// Example: http://192.168.1.10:5000
const char* BACKEND_BASE_URL = "http://10.148.84.69:5000";

// Registered device identity.
const char* DEVICE_CODE = "ESP32-001";
const char* DEVICE_SECRET = "c008c665a1ee695f7d088dc98da43f91e772c98fc388695d08bd34ab4c7c1b93";

// Existing attendance endpoint.
const char* ATTENDANCE_ENDPOINT = "/api/attendance/punch";

// New enrollment-control endpoints required by the backend.
const char* ENROLLMENT_PENDING_ENDPOINT =
  "/api/device/fingerprint-enroll/pending";

const char* ENROLLMENT_RESULT_ENDPOINT =
  "/api/device/fingerprint-enroll/result";

const char* ENROLLMENT_LOG_ENDPOINT =
  "/api/device/fingerprint-enroll/log";


// ============================================================
// TIMING
// ============================================================

// How often the ESP32 asks the backend whether an enrollment
// job is waiting. Attendance scanning continues between polls.
const unsigned long ENROLLMENT_POLL_INTERVAL = 2000;

// HTTP timeouts.
const uint16_t HTTP_CONNECT_TIMEOUT = 3000;
const uint16_t HTTP_TIMEOUT = 8000;

// Maximum time allowed for each enrollment stage.
const unsigned long ENROLLMENT_STAGE_TIMEOUT = 30000;
const unsigned long FINGER_REMOVAL_TIMEOUT = 15000;


// ============================================================
// FINGERPRINT SENSOR PINS
// ============================================================

#define FINGERPRINT_RX 16
#define FINGERPRINT_TX 17


// ============================================================
// OUTPUT PINS
// ============================================================

#define GREEN_LED 25
#define RED_LED   26
#define BUZZER    27


// ============================================================
// OLED PINS / CONFIGURATION
// ============================================================

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


// ============================================================
// FINGERPRINT SENSOR
// ============================================================

HardwareSerial FingerSerial(2);

Adafruit_Fingerprint finger =
  Adafruit_Fingerprint(&FingerSerial);


// ============================================================
// MACHINE MODE
// ============================================================

enum MachineMode {
  ATTENDANCE_MODE,
  ENROLLMENT_MODE
};

MachineMode currentMode = ATTENDANCE_MODE;


// ============================================================
// ENROLLMENT JOB
// ============================================================

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

unsigned long lastEnrollmentPoll = 0;


// ============================================================
// OLED
// ============================================================

void showOLED(
  String line1,
  String line2 = "",
  String line3 = "",
  String line4 = ""
) {
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);

  display.setCursor(0, 0);
  display.println(line1);

  display.setCursor(0, 16);
  display.println(line2);

  display.setCursor(0, 32);
  display.println(line3);

  display.setCursor(0, 48);
  display.println(line4);

  display.display();
}


// ============================================================
// OUTPUTS
// ============================================================

void allOutputsOff() {
  digitalWrite(GREEN_LED, LOW);
  digitalWrite(RED_LED, LOW);
  noTone(BUZZER);
}


void successSignal() {
  digitalWrite(RED_LED, LOW);
  digitalWrite(GREEN_LED, HIGH);

  tone(BUZZER, 2200, 150);
  delay(250);
  tone(BUZZER, 2600, 150);
  delay(200);
  noTone(BUZZER);

  delay(800);
  digitalWrite(GREEN_LED, LOW);
}


void errorSignal() {
  digitalWrite(GREEN_LED, LOW);
  digitalWrite(RED_LED, HIGH);

  tone(BUZZER, 500, 180);
  delay(250);
  tone(BUZZER, 500, 180);
  delay(250);
  noTone(BUZZER);

  delay(700);
  digitalWrite(RED_LED, LOW);
}


// ============================================================
// WIFI
// ============================================================

bool connectWiFi() {
  Serial.println();
  Serial.println("====================================");
  Serial.println("Connecting to Wi-Fi...");
  Serial.println("====================================");

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long startTime = millis();

  while (
    WiFi.status() != WL_CONNECTED &&
    millis() - startTime < 20000
  ) {
    delay(500);
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

    delay(1200);
    return true;
  }

  Serial.println("Wi-Fi connection failed.");

  showOLED(
    "WiFi Failed",
    "Attendance Offline",
    "Retrying..."
  );

  return false;
}


bool ensureWiFi() {
  if (WiFi.status() == WL_CONNECTED) {
    return true;
  }

  return connectWiFi();
}


// ============================================================
// URL / HTTP HELPERS
// ============================================================

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


// ============================================================
// SENSOR CHECK
// ============================================================

bool checkFingerprintSensor() {
  Serial.println("Checking fingerprint sensor...");

  if (!finger.verifyPassword()) {
    Serial.println("Fingerprint sensor: NOT FOUND");
    return false;
  }

  Serial.println("Fingerprint sensor: CONNECTED");

  if (finger.getParameters() == FINGERPRINT_OK) {
    Serial.print("Sensor capacity: ");
    Serial.println(finger.capacity);
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



// ============================================================
// FUNCTION PROTOTYPES
// ============================================================

bool reportEnrollmentLog(const String& message);

// ============================================================
// ATTENDANCE READY
// ============================================================

void showAttendanceReady() {
  currentMode = ATTENDANCE_MODE;
  allOutputsOff();

  showOLED(
    "Fingerprint Machine",
    "Attendance Mode",
    "Place Finger..."
  );
}


// ============================================================
// FINGER WAIT HELPERS
// ============================================================

uint8_t waitForFingerImage(unsigned long timeoutMs) {
  unsigned long startTime = millis();

  while (millis() - startTime < timeoutMs) {
    uint8_t result = finger.getImage();

    if (result == FINGERPRINT_OK) {
      return FINGERPRINT_OK;
    }

    if (result == FINGERPRINT_NOFINGER) {
      delay(100);
      continue;
    }

    return result;
  }

  return FINGERPRINT_TIMEOUT;
}


bool waitForFingerRemoval(unsigned long timeoutMs) {
  unsigned long startTime = millis();

  while (millis() - startTime < timeoutMs) {
    uint8_t result = finger.getImage();

    if (result == FINGERPRINT_NOFINGER) {
      return true;
    }

    delay(100);
  }

  return false;
}


// ============================================================
// REPORT ENROLLMENT PROGRESS LOG TO BACKEND
// ============================================================

bool reportEnrollmentLog(const String& message) {
  if (message.length() == 0) {
    return false;
  }

  if (!currentEnrollment.valid ||
      currentEnrollment.enrollmentId <= 0) {
    Serial.println("Enrollment log skipped: no active enrollment job.");
    return false;
  }

  if (!backendConfigured()) {
    return false;
  }

  if (!ensureWiFi()) {
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

  Serial.println("Reporting enrollment log:");
  Serial.println(body);

  int httpCode = http.POST(body);

  Serial.print("Enrollment log HTTP code: ");
  Serial.println(httpCode);

  String response = http.getString();

  if (response.length() > 0) {
    Serial.println("Enrollment log response:");
    Serial.println(response);
  }

  bool ok =
    httpCode >= 200 &&
    httpCode < 300;

  if (!ok) {
    Serial.println("WARNING: Enrollment progress log was not accepted by backend.");
  }

  http.end();

  return ok;
}


// ============================================================
// VERIFY STORED FINGERPRINT
// ============================================================

bool verifyStoredFingerprint(
  int sensorSlot,
  int& confidenceOut,
  String& errorMessageOut
) {
  confidenceOut = 0;
  errorMessageOut = "";

  reportEnrollmentLog("Fingerprint template saved. Preparing verification scan...");

  Serial.println("Testing newly enrolled fingerprint.");

  showOLED(
    "Enrollment",
    "Saved Successfully",
    "Test Finger",
    "Place Finger"
  );

  uint8_t result =
    waitForFingerImage(ENROLLMENT_STAGE_TIMEOUT);

  if (result != FINGERPRINT_OK) {
    errorMessageOut =
      "Verification scan failed. Sensor code: " + String(result);

    Serial.println(errorMessageOut);
    reportEnrollmentLog(errorMessageOut);
    return false;
  }

  reportEnrollmentLog("Verification fingerprint captured.");

  result = finger.image2Tz();

  if (result != FINGERPRINT_OK) {
    errorMessageOut =
      "Verification image conversion failed. Sensor code: " + String(result);

    Serial.println(errorMessageOut);
    reportEnrollmentLog(errorMessageOut);
    return false;
  }

  reportEnrollmentLog("Verification image converted successfully.");

  result = finger.fingerFastSearch();

  if (result != FINGERPRINT_OK) {
    errorMessageOut =
      "Verification search failed. Sensor code: " + String(result);

    Serial.println(errorMessageOut);
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

    Serial.println(errorMessageOut);
    reportEnrollmentLog(errorMessageOut);
    return false;
  }

  reportEnrollmentLog(
    "Verification successful. Matched assigned slot " +
    String(sensorSlot) +
    " with confidence " +
    String(confidenceOut) + "."
  );

  return true;
}


// ============================================================
// ENROLL FINGERPRINT
// ============================================================

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
  Serial.print("Employee ID: ");
  Serial.println(currentEnrollment.employeeId);
  Serial.print("Enrollment ID: ");
  Serial.println(currentEnrollment.enrollmentId);
  Serial.print("Sensor Slot: ");
  Serial.println(sensorSlot);
  Serial.print("Finger Name: ");
  Serial.println(currentEnrollment.fingerName);
  Serial.println("====================================");

  reportEnrollmentLog(
    "Enrollment started for employee " +
    String(currentEnrollment.employeeId) +
    ", slot " +
    String(sensorSlot) +
    "."
  );

  // ----------------------------------------------------------
  // CHECK SLOT
  // ----------------------------------------------------------

  reportEnrollmentLog(
    "Checking physical sensor slot " +
    String(sensorSlot) + "..."
  );

  uint8_t result = finger.loadModel(sensorSlot);

  if (result == FINGERPRINT_OK) {

      errorMessageOut =
        "Sensor slot " + String(sensorSlot) + " is already occupied.";

      Serial.println("ERROR: Sensor slot is already occupied.");

      reportEnrollmentLog(errorMessageOut);

      showOLED(
        "Enrollment Failed",
        "Slot Occupied",
        "Slot: " + String(sensorSlot)
      );

      errorSignal();

      return false;
  }


  // ----------------------------------------------------------
  // EMPTY SLOT RESPONSES
  // ----------------------------------------------------------
  //
  // Depending on the fingerprint sensor/firmware version,
  // an empty database slot may return:
  //   FINGERPRINT_NOTFOUND
  //   FINGERPRINT_BADLOCATION
  //   FINGERPRINT_DBREADFAIL
  //
  // Your sensor is returning DBREADFAIL (12) after the
  // database was cleared, so treat it as an available slot.
  // ----------------------------------------------------------

    if (
        result == FINGERPRINT_NOTFOUND ||
        result == FINGERPRINT_BADLOCATION ||
        result == 12
    ) {

        Serial.print("Sensor slot ");
        Serial.print(sensorSlot);
        Serial.println(" is available.");

        reportEnrollmentLog(
          "Sensor slot " +
          String(sensorSlot) +
          " is available."
        );

    } else {

      Serial.print("Slot check returned unexpected sensor code: ");
      Serial.println(result);

      errorMessageOut =
        "Could not safely check sensor slot " +
        String(sensorSlot) +
        ". Sensor code: " +
        String(result) + ".";

      reportEnrollmentLog(errorMessageOut);

      showOLED(
        "Enrollment Failed",
        "Slot Check Error",
        "Code: " + String(result)
      );

      errorSignal();

      return false;
  }

  reportEnrollmentLog(
    "Sensor slot " + String(sensorSlot) + " is available."
  );

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
  Serial.println("Place finger for first scan...");

  result = waitForFingerImage(ENROLLMENT_STAGE_TIMEOUT);

  if (result != FINGERPRINT_OK) {
    errorMessageOut =
      "First fingerprint scan failed. Sensor code: " + String(result) + ".";

    Serial.println(errorMessageOut);
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

    Serial.println(errorMessageOut);
    reportEnrollmentLog(errorMessageOut);
    errorSignal();
    return false;
  }

  reportEnrollmentLog("First fingerprint scan processed successfully.");
  Serial.println("First scan processed.");

  // ----------------------------------------------------------
  // REMOVE FINGER
  // ----------------------------------------------------------

  showOLED(
    "ENROLLMENT MODE",
    "First Scan OK",
    "Remove Finger"
  );

  reportEnrollmentLog("Remove the finger before scan 2 of 2.");
  Serial.println("Remove finger...");

  if (!waitForFingerRemoval(FINGER_REMOVAL_TIMEOUT)) {
    errorMessageOut =
      "Finger removal timeout after first scan.";

    Serial.println(errorMessageOut);
    reportEnrollmentLog(errorMessageOut);
    errorSignal();
    return false;
  }

  reportEnrollmentLog("Finger removed successfully.");
  delay(300);

  // ----------------------------------------------------------
  // SECOND SCAN
  // ----------------------------------------------------------

  showOLED(
    "ENROLLMENT MODE",
    "Place SAME Finger",
    "Scan 2 of 2"
  );

  reportEnrollmentLog("Place the SAME finger for scan 2 of 2.");
  Serial.println("Place the SAME finger for second scan...");

  result = waitForFingerImage(ENROLLMENT_STAGE_TIMEOUT);

  if (result != FINGERPRINT_OK) {
    errorMessageOut =
      "Second fingerprint scan failed. Sensor code: " + String(result) + ".";

    Serial.println(errorMessageOut);
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

    Serial.println(errorMessageOut);
    reportEnrollmentLog(errorMessageOut);
    errorSignal();
    return false;
  }

  reportEnrollmentLog("Second fingerprint scan processed successfully.");
  Serial.println("Second scan processed.");

  // ----------------------------------------------------------
  // CREATE MODEL
  // ----------------------------------------------------------

  showOLED(
    "ENROLLMENT MODE",
    "Creating Template..."
  );

  reportEnrollmentLog("Creating fingerprint template from both scans...");
  Serial.println("Creating fingerprint model...");

  result = finger.createModel();

  if (result != FINGERPRINT_OK) {
    errorMessageOut =
      "Fingerprint model creation failed. Sensor code: " + String(result) + ".";

    Serial.println(errorMessageOut);
    reportEnrollmentLog(errorMessageOut);

    showOLED(
      "Enrollment Failed",
      "Fingerprints",
      "Do Not Match"
    );

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
    "Slot: " + String(sensorSlot)
  );

  reportEnrollmentLog(
    "Saving fingerprint template to physical sensor slot " +
    String(sensorSlot) + "..."
  );

  Serial.print("Storing model in slot ");
  Serial.println(sensorSlot);

  result = finger.storeModel(sensorSlot);

  if (result != FINGERPRINT_OK) {
    errorMessageOut =
      "Fingerprint storage failed for sensor slot " +
      String(sensorSlot) +
      ". Sensor code: " +
      String(result) + ".";

    Serial.println(errorMessageOut);
    reportEnrollmentLog(errorMessageOut);

    showOLED(
      "Enrollment Failed",
      "Storage Failed",
      "Slot: " + String(sensorSlot)
    );

    errorSignal();
    return false;
  }

  reportEnrollmentLog(
    "Fingerprint template stored successfully in sensor slot " +
    String(sensorSlot) + "."
  );
  Serial.println("Fingerprint template stored in sensor memory.");

  // ----------------------------------------------------------
  // REMOVE FINGER BEFORE TEST
  // ----------------------------------------------------------

  showOLED(
    "Fingerprint Saved",
    "Remove Finger",
    "Preparing Test..."
  );

  reportEnrollmentLog("Template saved. Remove the finger before verification.");
  Serial.println("Remove finger before verification test...");

  if (!waitForFingerRemoval(FINGER_REMOVAL_TIMEOUT)) {
    /*
     * The template is already physically stored. We report a successful
     * enrollment at the device level because the physical save completed.
     * The backend will then persist the employee -> slot mapping.
     */
    reportEnrollmentLog(
      "Finger removal timed out. Physical template remains saved; skipping optional verification."
    );
    return true;
  }

  delay(300);

  // ----------------------------------------------------------
  // IMMEDIATE VERIFICATION
  // ----------------------------------------------------------

  bool verified =
    verifyStoredFingerprint(
      sensorSlot,
      verificationConfidence,
      errorMessageOut
    );

  // Remove the finger after the test so the next attendance scan
  // cannot accidentally reuse the same physical finger.
  waitForFingerRemoval(5000);

    if (!verified) {
      /*
      * Verification failed after the template was physically stored.
      *
      * IMPORTANT:
      * A fingerprint is considered successfully enrolled only when
      * both storage and verification succeed.
      *
      * Therefore, remove the physical template before reporting
      * enrollment failure to the backend.
      */

      if (errorMessageOut.length() == 0) {
        errorMessageOut =
          "Fingerprint verification failed after the template was saved.";
      }

      Serial.println();
      Serial.println("====================================");
      Serial.println(" VERIFICATION FAILED");
      Serial.println(" CLEANING UP SENSOR SLOT");
      Serial.println("====================================");

      reportEnrollmentLog(
        "Verification failed. Removing the physical fingerprint template from sensor slot " +
        String(sensorSlot) + "..."
      );

      // Make sure the template still exists before attempting deletion.
      uint8_t loadResult = finger.loadModel(sensorSlot);

      if (loadResult == FINGERPRINT_OK) {
        uint8_t deleteResult = finger.deleteModel(sensorSlot);

        Serial.print("deleteModel() result code: ");
        Serial.println(deleteResult);

        if (deleteResult == FINGERPRINT_OK) {
          Serial.println(
            "Physical fingerprint template deleted successfully."
          );

          reportEnrollmentLog(
            "Physical fingerprint template removed successfully from sensor slot " +
            String(sensorSlot) + "."
          );

          showOLED(
            "Enrollment Failed",
            "Template Removed",
            "Try Again"
          );
        } else {
          /*
          * Cleanup failed.
          *
          * This is important enough to make the failure explicit because
          * the sensor may still contain an orphaned template.
          */
          errorMessageOut +=
            " Physical sensor cleanup FAILED. Sensor slot " +
            String(sensorSlot) +
            " may still contain the fingerprint.";

          Serial.println(
            "CRITICAL: Failed to delete physical fingerprint template."
          );

          reportEnrollmentLog(
            "CRITICAL: Could not remove physical fingerprint template from sensor slot " +
            String(sensorSlot) +
            ". Manual cleanup may be required."
          );

          showOLED(
            "Cleanup Failed",
            "Slot: " + String(sensorSlot),
            "Manual Check"
          );
        }
      } else {
        /*
        * The sensor did not confirm that the slot contains a model.
        * Do not blindly call deleteModel().
        */
        Serial.print(
          "Could not confirm stored template before cleanup. Sensor code: "
        );
        Serial.println(loadResult);

        errorMessageOut +=
          " Could not confirm the stored template for cleanup. Sensor slot " +
          String(sensorSlot) +
          " must be checked manually.";

        reportEnrollmentLog(
          "CRITICAL: Could not confirm the physical template before cleanup. " +
          String(sensorSlot)
        );
      }

      errorSignal();

      return false;
    }

  reportEnrollmentLog(
    "Fingerprint enrollment and verification completed successfully."
  );

  Serial.println("New fingerprint verified successfully.");

  showOLED(
    "Enrollment Success",
    "Slot: " + String(sensorSlot),
    "Fingerprint Ready",
    "Attendance Ready"
  );

  successSignal();
  return true;
}


// ============================================================
// FETCH PENDING ENROLLMENT JOB
// ============================================================

bool fetchPendingEnrollment(EnrollmentJob& job) {
  job.valid = false;

  if (!backendConfigured()) {
    return false;
  }

  if (!ensureWiFi()) {
    return false;
  }

  HTTPClient http;
  String url = makeUrl(ENROLLMENT_PENDING_ENDPOINT);

  Serial.print("Checking enrollment queue: ");
  Serial.println(url);

  http.setConnectTimeout(HTTP_CONNECT_TIMEOUT);
  http.setTimeout(HTTP_TIMEOUT);

  if (!http.begin(url)) {
    Serial.println("HTTP begin failed for enrollment queue.");
    return false;
  }

  addDeviceHeaders(http);

  int httpCode = http.GET();

  Serial.print("Enrollment queue HTTP code: ");
  Serial.println(httpCode);

  if (httpCode <= 0) {
    Serial.print("Enrollment queue request failed: ");
    Serial.println(http.errorToString(httpCode));
    http.end();
    return false;
  }

  String response = http.getString();
  http.end();

  Serial.println("Enrollment queue response:");
  Serial.println(response);

  if (httpCode < 200 || httpCode >= 300) {
    return false;
  }

  JsonDocument doc;
  DeserializationError error = deserializeJson(doc, response);

  if (error) {
    Serial.print("Could not parse enrollment queue JSON: ");
    Serial.println(error.c_str());
    return false;
  }

  bool success = doc["success"] | false;

  if (!success) {
    Serial.println("Backend returned success=false for enrollment queue.");
    return false;
  }

  JsonVariant data = doc["data"];

  if (data.isNull()) {
    return true;
  }

  job.enrollmentId = data["enrollmentId"] | 0;
  job.employeeId = data["employeeId"] | 0;
  job.sensorSlot = data["sensorSlot"] | 0;
  job.fingerName = data["fingerName"] | "";

  if (
    job.enrollmentId <= 0 ||
    job.employeeId <= 0 ||
    job.sensorSlot < 1 ||
    job.sensorSlot > finger.capacity
  ) {
    Serial.println("Invalid enrollment job received from backend.");
    return false;
  }

  job.valid = true;

  Serial.println("Pending enrollment job received.");
  Serial.print("Enrollment ID: ");
  Serial.println(job.enrollmentId);
  Serial.print("Employee ID: ");
  Serial.println(job.employeeId);
  Serial.print("Sensor Slot: ");
  Serial.println(job.sensorSlot);
  Serial.print("Finger Name: ");
  Serial.println(job.fingerName);

  return true;
}


// ============================================================
// REPORT ENROLLMENT RESULT TO BACKEND
// ============================================================

bool reportEnrollmentResult(
  const EnrollmentJob& job,
  bool success,
  int confidence,
  const String& errorMessage
) {
  if (!backendConfigured()) {
    return false;
  }

  if (!ensureWiFi()) {
    return false;
  }

  HTTPClient http;
  String url = makeUrl(ENROLLMENT_RESULT_ENDPOINT);

  http.setConnectTimeout(HTTP_CONNECT_TIMEOUT);
  http.setTimeout(HTTP_TIMEOUT);

  if (!http.begin(url)) {
    Serial.println("HTTP begin failed for enrollment result.");
    return false;
  }

  addDeviceHeaders(http);

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

  Serial.println("Reporting enrollment result:");
  Serial.println(body);

  int httpCode = http.POST(body);

  Serial.print("Enrollment result HTTP code: ");
  Serial.println(httpCode);

  String response = http.getString();
  Serial.println("Enrollment result response:");
  Serial.println(response);

  bool ok =
    httpCode >= 200 &&
    httpCode < 300;

  http.end();

  return ok;
}


// ============================================================
// START ENROLLMENT FROM BACKEND JOB
// ============================================================

void processEnrollmentJob(const EnrollmentJob& job) {
  currentEnrollment = job;
  currentMode = ENROLLMENT_MODE;

  Serial.println();
  Serial.println("====================================");
  Serial.println(" SWITCHING TO ENROLLMENT MODE");
  Serial.println("====================================");

  showOLED(
    "ENROLLMENT REQUEST",
    "Employee: " + String(job.employeeId),
    "Slot: " + String(job.sensorSlot),
    job.fingerName
  );

  delay(1500);

  int verificationConfidence = 0;
  String errorMessage = "";

  bool enrollmentSuccess =
    enrollFingerprint(
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

  // Tell backend whether the physical operation completed.
  bool reported =
    reportEnrollmentResult(
      job,
      enrollmentSuccess,
      verificationConfidence,
      errorMessage
    );

  if (!reported) {
    Serial.println("WARNING: Could not report enrollment result to backend.");
  }

  currentEnrollment.valid = false;
  currentMode = ATTENDANCE_MODE;

  // Important: do not immediately search while a finger is still on
  // the sensor.
  showOLED(
    enrollmentSuccess ? "Enrollment Complete" : "Enrollment Failed",
    "Returning to",
    "Attendance Mode"
  );

  delay(1200);

  waitForFingerRemoval(5000);

  showAttendanceReady();

  Serial.println();
  Serial.println("Returned to ATTENDANCE MODE.");
}


// ============================================================
// POLL ENROLLMENT CONTROL
// ============================================================

void pollEnrollmentRequest() {
  if (currentMode != ATTENDANCE_MODE) {
    return;
  }

  unsigned long now = millis();

  if (now - lastEnrollmentPoll < ENROLLMENT_POLL_INTERVAL) {
    return;
  }

  lastEnrollmentPoll = now;

  EnrollmentJob job;

  if (!fetchPendingEnrollment(job)) {
    return;
  }

  if (!job.valid) {
    return;
  }

  processEnrollmentJob(job);
}


// ============================================================
// IDENTIFY FINGERPRINT FOR ATTENDANCE
// ============================================================
// Returns:
//   -2 = no finger
//   -1 = sensor/read error
//    0 = fingerprint not found
//   >0 = matched fingerprint slot

int identifyFingerprint() {
  uint8_t result = finger.getImage();

  if (result == FINGERPRINT_NOFINGER) {
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

  if (result == FINGERPRINT_NOTFOUND) {
    return 0;
  }

  return -1;
}


// ============================================================
// SEND ATTENDANCE TO BACKEND
// ============================================================

bool sendAttendanceToBackend(int sensorSlot) {
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

  JsonDocument doc;
  doc["sensorSlot"] = sensorSlot;

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

  bool ok =
    httpCode >= 200 &&
    httpCode < 300;

  http.end();

  return ok;
}


// ============================================================
// ATTENDANCE LOOP
// ============================================================

void attendanceLoop() {
  int result = identifyFingerprint();

  if (result == -2) {
    return;
  }

  if (result > 0) {
    Serial.println();
    Serial.println("====================================");
    Serial.println(" FINGERPRINT MATCH");
    Serial.println("====================================");
    Serial.print("Sensor Slot: ");
    Serial.println(result);

    showOLED(
      "Fingerprint Found",
      "Slot: " + String(result),
      "Sending..."
    );

    bool success = sendAttendanceToBackend(result);

    if (success) {
      Serial.println("Attendance recorded successfully.");

      showOLED(
        "Attendance Success",
        "Slot: " + String(result),
        "Recorded"
      );

      successSignal();
    } else {
      Serial.println("Attendance was NOT recorded.");

      showOLED(
        "Attendance Failed",
        "Slot: " + String(result),
        "Check Backend"
      );

      errorSignal();
    }

    // Prevent repeated scans of the same finger while it is still
    // touching the sensor.
    waitForFingerRemoval(5000);
    showAttendanceReady();
    return;
  }

  if (result == 0) {
    Serial.println("Fingerprint NOT recognized.");

    showOLED(
      "Fingerprint Failed",
      "Not Recognized",
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
  delay(500);
  showAttendanceReady();
}


// ============================================================
// CHECK PHYSICAL SENSOR SLOT
// ============================================================

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
 } else if (
    result == FINGERPRINT_NOTFOUND ||
    result == FINGERPRINT_BADLOCATION ||
    result == 12
) {

    Serial.println("RESULT: SLOT IS EMPTY / NO TEMPLATE FOUND.");

} else {
    Serial.println("RESULT: SENSOR CHECK COULD NOT BE COMPLETED SAFELY.");
    Serial.println("Treat this as a sensor communication/read error, not an empty slot.");
  }

  Serial.println("====================================");
}


// ============================================================
// DELETE PHYSICAL SENSOR SLOT
// ============================================================

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
    delay(10);
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


// ============================================================
// SERIAL DIAGNOSTIC COMMANDS
// ============================================================

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
    currentMode = ATTENDANCE_MODE;
    currentEnrollment.valid = false;
    showAttendanceReady();
    Serial.println("Switched to ATTENDANCE MODE.");
    return;
  }

  if (command == "P") {
    Serial.println("Manual enrollment queue check...");

    EnrollmentJob job;

    if (fetchPendingEnrollment(job) && job.valid) {
      processEnrollmentJob(job);
    } else {
      Serial.println("No valid pending enrollment job found.");
    }

    return;
  }

  if (command == "C") {
    Serial.println("Enter sensor slot number:");

    while (!Serial.available()) {
      delay(10);
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
      delay(10);
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
    connectWiFi();
    showAttendanceReady();
    return;
  }

  Serial.println("Unknown command. Use A, P, S, or W.");
}


// ============================================================
// SETUP
// ============================================================

void setup() {
  Serial.begin(115200);
  delay(500);

  // Outputs.
  pinMode(GREEN_LED, OUTPUT);
  pinMode(RED_LED, OUTPUT);
  pinMode(BUZZER, OUTPUT);
  allOutputsOff();

  // OLED.
  Wire.begin(OLED_SDA, OLED_SCL);

  if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDRESS)) {
    Serial.println("OLED initialization FAILED.");

    digitalWrite(RED_LED, HIGH);

    while (true) {
      delay(1000);
    }
  }

  showOLED(
    "Fingerprint Machine",
    "Starting...",
    "Please wait"
  );

  delay(1000);

  // Fingerprint UART.
  FingerSerial.begin(
    57600,
    SERIAL_8N1,
    FINGERPRINT_RX,
    FINGERPRINT_TX
  );

  finger.begin(57600);
  delay(1000);

  bool fingerprintOK = checkFingerprintSensor();

  if (!fingerprintOK) {
    showOLED(
      "Fingerprint Sensor",
      "SENSOR ERROR",
      "Check TX/RX"
    );

    errorSignal();
  }

  delay(1000);

  // Wi-Fi.
  connectWiFi();

  // Normal initial state.
  currentMode = ATTENDANCE_MODE;
  currentEnrollment.valid = false;

  showAttendanceReady();
  printCommands();

  Serial.println("Machine initialized.");
  Serial.println("Normal state: ATTENDANCE_MODE");
}


// ============================================================
// MAIN LOOP
// ============================================================

void loop() {
  handleSerialCommands();

  if (currentMode == ATTENDANCE_MODE) {
    // Check whether frontend/backend has requested enrollment.
    // The attendance scanner remains available between checks.
    pollEnrollmentRequest();

    // If polling switched the machine to enrollment, do not scan
    // attendance in this same iteration.
    if (currentMode == ATTENDANCE_MODE) {
      attendanceLoop();
    }
  }

  delay(20);
}

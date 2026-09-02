#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Adafruit_Fingerprint.h>

// ==========================================================
// WIFI CONFIGURATION
// ==========================================================

const char* WIFI_SSID = "Dharm's S24";

// KEEP YOUR EXISTING WORKING PASSWORD HERE
const char* WIFI_PASSWORD = "Bhadani@99";


// ==========================================================
// ERP BACKEND
// ==========================================================

const char* BACKEND_URL =
    "http://10.83.106.69:5000";

const char* ATTENDANCE_ENDPOINT =
    "/api/attendance/punch";

const char* ENROLLMENT_ENDPOINT =
    "/api/device/fingerprint-enroll";


// ==========================================================
// DEVICE CREDENTIALS
// ==========================================================

// KEEP YOUR EXISTING WORKING VALUES HERE

const char* DEVICE_CODE =
    "ESP32-001";

const char* DEVICE_SECRET =
    "c008c665a1ee695f7d088dc98da43f91e772c98fc388695d08bd34ab4c7c1b93";


// ==========================================================
// FINGERPRINT SENSOR
//
// Fingerprint TX -> ESP32 GPIO 16
// Fingerprint RX -> ESP32 GPIO 17
// ==========================================================

#define FINGERPRINT_RX 16
#define FINGERPRINT_TX 17

HardwareSerial fingerprintSerial(2);

Adafruit_Fingerprint finger =
    Adafruit_Fingerprint(&fingerprintSerial);


// ==========================================================
// LED / BUZZER
// ==========================================================

#define GREEN_LED 25
#define RED_LED   26
#define BUZZER    27


// ==========================================================
// OLED
// ==========================================================

#define OLED_SDA 21
#define OLED_SCL 22

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64

#define OLED_RESET -1

Adafruit_SSD1306 display(
    SCREEN_WIDTH,
    SCREEN_HEIGHT,
    &Wire,
    OLED_RESET
);


// ==========================================================
// SYSTEM STATUS
// ==========================================================

bool fingerprintOK = false;
bool wifiOK = false;
bool backendOK = false;

bool enrollmentMode = false;


// ==========================================================
// FUNCTION DECLARATIONS
// ==========================================================

void showOLED(
    String line1,
    String line2 = "",
    String line3 = "",
    String line4 = ""
);

void beepSuccess();

void beepError();

bool checkFingerprintSensor();

bool connectWiFi();

bool checkBackend();

int getFingerprintID();

bool sendAttendancePunch(
    int sensorSlot
);


// NEW ENROLLMENT FUNCTIONS

bool enrollFingerprint(
    int employeeId,
    int sensorSlot,
    String fingerName
);

bool sendFingerprintEnrollment(
    int employeeId,
    int sensorSlot,
    String fingerName
);

String readSerialLine(
    const char* prompt
);

bool waitForFingerRemoval();


// ATTENDANCE FEEDBACK

void attendanceSuccess();

void attendanceFailed();


// ==========================================================
// SETUP
// ==========================================================

void setup() {

    Serial.begin(115200);

    delay(1000);


    Serial.println();

    Serial.println(
        "========================================"
    );

    Serial.println(
        "      ESP32 FINGERPRINT ERP SYSTEM"
    );

    Serial.println(
        "========================================"
    );

    Serial.println();


    // ======================================================
    // GPIO SETUP
    // ======================================================

    pinMode(
        GREEN_LED,
        OUTPUT
    );

    pinMode(
        RED_LED,
        OUTPUT
    );

    pinMode(
        BUZZER,
        OUTPUT
    );


    digitalWrite(
        GREEN_LED,
        LOW
    );

    digitalWrite(
        RED_LED,
        LOW
    );

    digitalWrite(
        BUZZER,
        LOW
    );


    // ======================================================
    // OLED
    // ======================================================

    Wire.begin(
        OLED_SDA,
        OLED_SCL
    );


    if (
        display.begin(
            SSD1306_SWITCHCAPVCC,
            0x3C
        )
    ) {

        showOLED(
            "ESP32 ERP",
            "Starting system..."
        );

        Serial.println(
            "OLED: OK"
        );

    } else {

        Serial.println(
            "OLED: FAILED"
        );
    }


    // ======================================================
    // ESP32 SYSTEM CHECK
    // ======================================================

    Serial.println(
        "[1/4] ESP32 SYSTEM CHECK"
    );

    Serial.println(
        "ESP32 started successfully."
    );


    Serial.print(
        "Chip model: "
    );

    Serial.println(
        ESP.getChipModel()
    );


    Serial.print(
        "CPU frequency: "
    );

    Serial.print(
        ESP.getCpuFreqMHz()
    );

    Serial.println(
        " MHz"
    );


    Serial.print(
        "Free heap: "
    );

    Serial.println(
        ESP.getFreeHeap()
    );


    Serial.println(
        "ESP32 system: OK"
    );


    // ======================================================
    // FINGERPRINT SENSOR
    // ======================================================

    Serial.println();

    Serial.println(
        "[2/4] FINGERPRINT SENSOR CHECK"
    );


    fingerprintSerial.begin(
        57600,
        SERIAL_8N1,
        FINGERPRINT_RX,
        FINGERPRINT_TX
    );


    finger.begin(
        57600
    );


    fingerprintOK =
        checkFingerprintSensor();


    // ======================================================
    // WIFI
    // ======================================================

    Serial.println();

    Serial.println(
        "[3/4] WIFI CHECK"
    );


    wifiOK =
        connectWiFi();


    // ======================================================
    // BACKEND
    // ======================================================

    Serial.println();

    Serial.println(
        "[4/4] ERP BACKEND CHECK"
    );


    if (wifiOK) {

        backendOK =
            checkBackend();

    } else {

        backendOK = false;

        Serial.println(
            "Backend check skipped because WiFi failed."
        );
    }


    // ======================================================
    // FINAL STATUS
    // ======================================================

    Serial.println();

    Serial.println(
        "========================================"
    );

    Serial.println(
        "          FINAL SYSTEM STATUS"
    );

    Serial.println(
        "========================================"
    );


    Serial.print(
        "ESP32 System       : "
    );

    Serial.println(
        "OK"
    );


    Serial.print(
        "Fingerprint Sensor : "
    );

    Serial.println(
        fingerprintOK
            ? "OK"
            : "FAILED"
    );


    Serial.print(
        "WiFi               : "
    );

    Serial.println(
        wifiOK
            ? "OK"
            : "FAILED"
    );


    Serial.print(
        "ERP Backend        : "
    );

    Serial.println(
        backendOK
            ? "OK"
            : "FAILED"
    );


    Serial.println(
        "========================================"
    );


    if (
        fingerprintOK &&
        wifiOK &&
        backendOK
    ) {

        showOLED(
            "SYSTEM READY",
            "Attendance Mode",
            "Place Finger"
        );


        Serial.println();

        Serial.println(
            "SYSTEM READY"
        );

        Serial.println(
            "Attendance Mode"
        );

        Serial.println();

        Serial.println(
            "Commands:"
        );

        Serial.println(
            "A = Attendance Mode"
        );

        Serial.println(
            "E = Fingerprint Enrollment"
        );

    } else {

        showOLED(
            "SYSTEM NOT READY",
            "Check components"
        );


        Serial.println();

        Serial.println(
            "SYSTEM NOT READY"
        );
    }
}


// ==========================================================
// MAIN LOOP
// ==========================================================

void loop() {

    // ======================================================
    // SERIAL COMMANDS
    // ======================================================

    if (Serial.available()) {

        char command =
            Serial.read();


        // Clear remaining newline characters

        while (
            Serial.available()
        ) {

            char c =
                Serial.peek();


            if (
                c == '\n' ||
                c == '\r'
            ) {

                Serial.read();

            } else {

                break;
            }
        }


        // ==================================================
        // ENROLLMENT MODE
        // ==================================================

        if (
            command == 'E' ||
            command == 'e'
        ) {

            enrollmentMode = true;


            Serial.println();

            Serial.println(
                "========================================"
            );

            Serial.println(
                "         FINGERPRINT ENROLLMENT"
            );

            Serial.println(
                "========================================"
            );


            showOLED(
                "ENROLLMENT MODE",
                "Starting..."
            );


            // ==================================================
            // EMPLOYEE ID
            // ==================================================

            String employeeIdText =
                readSerialLine(
                    "Enter Employee ID:"
                );


            if (
                employeeIdText.length() == 0
            ) {

                Serial.println(
                    "Employee ID cannot be empty."
                );

                beepError();

                enrollmentMode = false;

                return;
            }


            int employeeId =
                employeeIdText.toInt();


            if (
                employeeId <= 0
            ) {

                Serial.println(
                    "Invalid Employee ID."
                );

                beepError();

                enrollmentMode = false;

                return;
            }


            // ==================================================
            // SENSOR SLOT
            // ==================================================

            String sensorSlotText =
                readSerialLine(
                    "Enter Sensor Slot:"
                );


            if (
                sensorSlotText.length() == 0
            ) {

                Serial.println(
                    "Sensor slot cannot be empty."
                );

                beepError();

                enrollmentMode = false;

                return;
            }


            int sensorSlot =
                sensorSlotText.toInt();


            if (
                sensorSlot < 1 ||
                sensorSlot > 127
            ) {

                Serial.println(
                    "Sensor slot must be between 1 and 127."
                );

                beepError();

                enrollmentMode = false;

                return;
            }


            // ==================================================
            // FINGER NAME
            // ==================================================

            String fingerName =
                readSerialLine(
                    "Enter Finger Name:"
                );


            if (
                fingerName.length() == 0
            ) {

                fingerName =
                    "Unknown";
            }


            // ==================================================
            // SHOW DETAILS
            // ==================================================

            Serial.println();

            Serial.println(
                "========================================"
            );

            Serial.println(
                "        ENROLLMENT DETAILS"
            );

            Serial.println(
                "========================================"
            );


            Serial.print(
                "Employee ID : "
            );

            Serial.println(
                employeeId
            );


            Serial.print(
                "Sensor Slot : "
            );

            Serial.println(
                sensorSlot
            );


            Serial.print(
                "Finger Name : "
            );

            Serial.println(
                fingerName
            );


            Serial.println(
                "========================================"
            );


            showOLED(
                "Employee: " + String(employeeId),
                "Slot: " + String(sensorSlot),
                fingerName
            );


            delay(1500);


            // ==================================================
            // START PHYSICAL ENROLLMENT
            // ==================================================

            bool success =
                enrollFingerprint(
                    employeeId,
                    sensorSlot,
                    fingerName
                );


            if (success) {

                Serial.println();

                Serial.println(
                    "========================================"
                );

                Serial.println(
                    "       ENROLLMENT COMPLETED"
                );

                Serial.println(
                    "========================================"
                );


                Serial.println(
                    "Fingerprint is now registered."
                );


                showOLED(
                    "ENROLLMENT",
                    "SUCCESS",
                    "Employee: " + String(employeeId)
                );


            } else {

                Serial.println();

                Serial.println(
                    "Enrollment failed."
                );


                showOLED(
                    "ENROLLMENT",
                    "FAILED"
                );
            }


            enrollmentMode = false;


            delay(2000);


            Serial.println();

            Serial.println(
                "Returning to attendance mode..."
            );


            showOLED(
                "SYSTEM READY",
                "Attendance Mode",
                "Place Finger"
            );


            delay(1000);
        }


        // ==================================================
        // ATTENDANCE MODE
        // ==================================================

        else if (
            command == 'A' ||
            command == 'a'
        ) {

            enrollmentMode = false;


            Serial.println();

            Serial.println(
                "ATTENDANCE MODE"
            );


            showOLED(
                "ATTENDANCE MODE",
                "Place Finger"
            );
        }
    }


    // ======================================================
    // ATTENDANCE
    // ======================================================

    if (
        !enrollmentMode &&
        fingerprintOK &&
        wifiOK &&
        backendOK
    ) {

        int fingerprintID =
            getFingerprintID();


        if (
            fingerprintID > 0
        ) {

            Serial.println();

            Serial.println(
                "========================================"
            );


            Serial.print(
                "Fingerprint matched. ID: "
            );

            Serial.println(
                fingerprintID
            );


            Serial.println(
                "Sending attendance to ERP..."
            );


            showOLED(
                "Fingerprint",
                "Matched",
                "ID: " + String(fingerprintID)
            );


            beepSuccess();


            digitalWrite(
                GREEN_LED,
                HIGH
            );


            bool success =
                sendAttendancePunch(
                    fingerprintID
                );


            if (success) {

                attendanceSuccess();

            } else {

                attendanceFailed();
            }


            digitalWrite(
                GREEN_LED,
                LOW
            );


            delay(3000);


            showOLED(
                "SYSTEM READY",
                "Place Finger"
            );
        }
    }


    delay(100);
}


// ==========================================================
// READ SERIAL LINE
// ==========================================================

String readSerialLine(
    const char* prompt
) {

    Serial.println();

    Serial.println(
        prompt
    );


    showOLED(
        "Input Required",
        prompt
    );


    String input = "";


    unsigned long startTime =
        millis();


    while (
        millis() - startTime < 30000
    ) {

        if (
            Serial.available()
        ) {

            input =
                Serial.readStringUntil(
                    '\n'
                );


            input.trim();


            Serial.print(
                "Received: "
            );

            Serial.println(
                input
            );


            return input;
        }


        delay(50);
    }


    Serial.println(
        "Input timeout."
    );


    return "";
}


// ==========================================================
// CHECK FINGERPRINT SENSOR
// ==========================================================

bool checkFingerprintSensor() {

    Serial.println(
        "Checking fingerprint sensor..."
    );


    if (
        finger.verifyPassword()
    ) {

        Serial.println(
            "Fingerprint sensor: OK"
        );


        if (
            finger.getParameters()
            == FINGERPRINT_OK
        ) {

            Serial.print(
                "Sensor capacity: "
            );

            Serial.println(
                finger.capacity
            );
        }


        return true;

    } else {

        Serial.println(
            "Fingerprint sensor: FAILED"
        );

        return false;
    }
}


// ==========================================================
// CONNECT WIFI
// ==========================================================

bool connectWiFi() {

    Serial.println(
        "Connecting to WiFi..."
    );


    WiFi.mode(
        WIFI_STA
    );


    WiFi.begin(
        WIFI_SSID,
        WIFI_PASSWORD
    );


    int attempts = 0;


    while (
        WiFi.status() != WL_CONNECTED &&
        attempts < 40
    ) {

        Serial.print(
            "."
        );

        delay(500);

        attempts++;
    }


    Serial.println();


    if (
        WiFi.status()
        == WL_CONNECTED
    ) {

        Serial.println(
            "WiFi: OK"
        );


        Serial.print(
            "ESP32 IP: "
        );

        Serial.println(
            WiFi.localIP()
        );


        Serial.print(
            "Gateway: "
        );

        Serial.println(
            WiFi.gatewayIP()
        );


        Serial.print(
            "Signal RSSI: "
        );

        Serial.print(
            WiFi.RSSI()
        );

        Serial.println(
            " dBm"
        );


        return true;

    } else {

        Serial.println(
            "WiFi: FAILED"
        );

        return false;
    }
}


// ==========================================================
// CHECK BACKEND
// ==========================================================

bool checkBackend() {

    Serial.println();

    Serial.println(
        "Testing backend: "
    );


    Serial.print(
        BACKEND_URL
    );


    Serial.println(
        "/"
    );


    HTTPClient http;


    String url =
        String(BACKEND_URL);


    http.begin(
        url
    );


    http.setTimeout(
        5000
    );


    int httpCode =
        http.GET();


    Serial.print(
        "Backend HTTP response: "
    );


    Serial.println(
        httpCode
    );


    if (
        httpCode > 0
    ) {

        Serial.println(
            "Backend connection: OK"
        );


        http.end();

        return true;

    } else {

        Serial.print(
            "Backend connection: FAILED - "
        );


        Serial.println(
            http.errorToString(
                httpCode
            )
        );


        http.end();

        return false;
    }
}


// ==========================================================
// FINGERPRINT SEARCH
// ==========================================================

int getFingerprintID() {

    uint8_t result =
        finger.getImage();


    if (
        result ==
        FINGERPRINT_NOFINGER
    ) {

        return -1;
    }


    if (
        result !=
        FINGERPRINT_OK
    ) {

        return -1;
    }


    Serial.println();

    Serial.println(
        "Fingerprint detected."
    );


    result =
        finger.image2Tz();


    if (
        result !=
        FINGERPRINT_OK
    ) {

        Serial.println(
            "Fingerprint image conversion failed."
        );

        return -1;
    }


    result =
        finger.fingerSearch();


    if (
        result ==
        FINGERPRINT_OK
    ) {

        Serial.println(
            "Fingerprint match found."
        );


        Serial.print(
            "Sensor ID: "
        );


        Serial.println(
            finger.fingerID
        );


        Serial.print(
            "Confidence: "
        );


        Serial.println(
            finger.confidence
        );


        return finger.fingerID;
    }


    if (
        result ==
        FINGERPRINT_NOTFOUND
    ) {

        Serial.println(
            "No fingerprint match found."
        );


        showOLED(
            "Fingerprint",
            "Not recognized"
        );


        beepError();


        digitalWrite(
            RED_LED,
            HIGH
        );


        delay(1000);


        digitalWrite(
            RED_LED,
            LOW
        );


        return -1;
    }


    Serial.println(
        "Fingerprint search error."
    );


    return -1;
}


// ==========================================================
// SEND ATTENDANCE TO ERP
// ==========================================================

bool sendAttendancePunch(
    int sensorSlot
) {

    if (
        WiFi.status()
        != WL_CONNECTED
    ) {

        Serial.println(
            "WiFi disconnected."
        );


        return false;
    }


    Serial.println();

    Serial.println(
        "Connecting to ERP API..."
    );


    String url =
        String(BACKEND_URL)
        +
        String(ATTENDANCE_ENDPOINT);


    Serial.println(
        url
    );


    HTTPClient http;


    http.begin(
        url
    );


    http.setTimeout(
        10000
    );


    http.addHeader(
        "Content-Type",
        "application/json"
    );


    // ======================================================
    // DEVICE AUTHENTICATION
    // ======================================================

    http.addHeader(
        "X-Device-Code",
        DEVICE_CODE
    );


    http.addHeader(
        "X-Device-Secret",
        DEVICE_SECRET
    );


    // ======================================================
    // REQUEST BODY
    // ======================================================

    String requestBody =
        "{\"sensorSlot\":"
        +
        String(sensorSlot)
        +
        "}";


    Serial.print(
        "Request body: "
    );


    Serial.println(
        requestBody
    );


    int httpCode =
        http.POST(
            requestBody
        );


    Serial.print(
        "HTTP Response Code: "
    );


    Serial.println(
        httpCode
    );


    if (
        httpCode > 0
    ) {

        String response =
            http.getString();


        Serial.println();

        Serial.println(
            "ERP RESPONSE:"
        );


        Serial.println(
            response
        );


        if (
            httpCode >= 200 &&
            httpCode < 300
        ) {

            http.end();

            return true;
        }
    }

    else {

        Serial.print(
            "HTTP request failed: "
        );


        Serial.println(
            http.errorToString(
                httpCode
            )
        );
    }


    http.end();


    return false;
}


// ==========================================================
// ENROLL FINGERPRINT
// ==========================================================

bool enrollFingerprint(
    int employeeId,
    int sensorSlot,
    String fingerName
) {

    Serial.println();

    Serial.println(
        "========================================"
    );

    Serial.println(
        "       FINGERPRINT ENROLLMENT"
    );

    Serial.println(
        "========================================"
    );


    Serial.print(
        "Employee ID: "
    );


    Serial.println(
        employeeId
    );


    Serial.print(
        "Sensor Slot: "
    );


    Serial.println(
        sensorSlot
    );


    Serial.print(
        "Finger Name: "
    );


    Serial.println(
        fingerName
    );


    // ======================================================
    // VALIDATE SLOT
    // ======================================================

    if (
        sensorSlot < 1 ||
        sensorSlot > 127
    ) {

        Serial.println(
            "ERROR: Invalid sensor slot."
        );


        beepError();


        return false;
    }


    // ======================================================
    // CHECK SENSOR
    // ======================================================

    if (
        !fingerprintOK
    ) {

        Serial.println(
            "ERROR: Fingerprint sensor is not ready."
        );


        beepError();


        return false;
    }


    // ======================================================
    // CHECK SLOT
    // ======================================================

    uint8_t result =
        finger.loadModel(
            sensorSlot
        );


    if (
        result ==
        FINGERPRINT_OK
    ) {

        Serial.println();

        Serial.println(
            "WARNING: Sensor slot already contains"
        );


        Serial.println(
            "a fingerprint."
        );


        Serial.print(
            "Slot: "
        );


        Serial.println(
            sensorSlot
        );


        Serial.println(
            "Enrollment cancelled."
        );


        showOLED(
            "Enrollment",
            "Slot occupied",
            "Choose another"
        );


        beepError();


        delay(2000);


        return false;
    }


    // ======================================================
    // FIRST SCAN
    // ======================================================

    showOLED(
        "ENROLLMENT",
        "Place Finger"
    );


    Serial.println();

    Serial.println(
        "Place your finger on the sensor..."
    );


    result =
        FINGERPRINT_NOFINGER;


    while (
        result !=
        FINGERPRINT_OK
    ) {

        result =
            finger.getImage();


        if (
            result ==
            FINGERPRINT_OK
        ) {

            Serial.println(
                "First fingerprint captured."
            );

        }

        else if (
            result ==
            FINGERPRINT_NOFINGER
        ) {

            delay(100);

        }

        else {

            Serial.print(
                "Fingerprint capture error: "
            );


            Serial.println(
                result
            );


            beepError();


            return false;
        }
    }


    // ======================================================
    // CONVERT FIRST IMAGE
    // ======================================================

    result =
        finger.image2Tz(1);


    if (
        result !=
        FINGERPRINT_OK
    ) {

        Serial.print(
            "First fingerprint conversion failed. Code: "
        );


        Serial.println(
            result
        );


        showOLED(
            "Enrollment",
            "First scan",
            "Failed"
        );


        beepError();


        return false;
    }


    Serial.println(
        "First fingerprint processed."
    );


    // ======================================================
    // REMOVE FINGER
    // ======================================================

    showOLED(
        "ENROLLMENT",
        "Remove Finger"
    );


    Serial.println();

    Serial.println(
        "Remove your finger..."
    );


    delay(1500);


    if (
        !waitForFingerRemoval()
    ) {

        Serial.println(
            "Finger removal timeout."
        );


        beepError();


        return false;
    }


    Serial.println(
        "Finger removed."
    );


    // ======================================================
    // SECOND SCAN
    // ======================================================

    showOLED(
        "ENROLLMENT",
        "Place SAME Finger"
    );


    Serial.println();

    Serial.println(
        "Place the SAME finger again..."
    );


    result =
        FINGERPRINT_NOFINGER;


    while (
        result !=
        FINGERPRINT_OK
    ) {

        result =
            finger.getImage();


        if (
            result ==
            FINGERPRINT_OK
        ) {

            Serial.println(
                "Second fingerprint captured."
            );

        }

        else if (
            result ==
            FINGERPRINT_NOFINGER
        ) {

            delay(100);

        }

        else {

            Serial.print(
                "Fingerprint capture error: "
            );


            Serial.println(
                result
            );


            beepError();


            return false;
        }
    }


    // ======================================================
    // CONVERT SECOND IMAGE
    // ======================================================

    result =
        finger.image2Tz(2);


    if (
        result !=
        FINGERPRINT_OK
    ) {

        Serial.print(
            "Second fingerprint conversion failed. Code: "
        );


        Serial.println(
            result
        );


        showOLED(
            "Enrollment",
            "Second scan",
            "Failed"
        );


        beepError();


        return false;
    }


    Serial.println(
        "Second fingerprint processed."
    );


    // ======================================================
    // CREATE MODEL
    // ======================================================

    showOLED(
        "ENROLLMENT",
        "Creating model..."
    );


    Serial.println();

    Serial.println(
        "Creating fingerprint model..."
    );


    result =
        finger.createModel();


    if (
        result !=
        FINGERPRINT_OK
    ) {

        Serial.println();

        Serial.println(
            "ERROR: Fingerprints did not match."
        );


        Serial.println(
            "Enrollment failed."
        );


        showOLED(
            "Enrollment",
            "Fingerprints",
            "did not match"
        );


        beepError();


        delay(2000);


        return false;
    }


    Serial.println(
        "Fingerprint model created successfully."
    );


    // ======================================================
    // STORE MODEL IN SENSOR
    // ======================================================

    showOLED(
        "ENROLLMENT",
        "Saving fingerprint..."
    );


    Serial.print(
        "Storing fingerprint in sensor slot "
    );


    Serial.println(
        sensorSlot
    );


    result =
        finger.storeModel(
            sensorSlot
        );


    if (
        result !=
        FINGERPRINT_OK
    ) {

        Serial.print(
            "ERROR: Failed to store fingerprint. Code: "
        );


        Serial.println(
            result
        );


        showOLED(
            "Enrollment",
            "Storage failed"
        );


        beepError();


        return false;
    }


    Serial.println(
        "Fingerprint stored in sensor."
    );


    // ======================================================
    // REGISTER FINGERPRINT IN BACKEND
    // ======================================================

    showOLED(
        "ENROLLMENT",
        "Registering",
        "with ERP..."
    );


    Serial.println();

    Serial.println(
        "Fingerprint stored successfully."
    );


    Serial.println(
        "Registering fingerprint with ERP backend..."
    );


    bool backendEnrollmentSuccess =
        sendFingerprintEnrollment(
            employeeId,
            sensorSlot,
            fingerName
        );


    // ======================================================
    // BACKEND REGISTRATION FAILED
    // ======================================================

    if (
        !backendEnrollmentSuccess
    ) {

        Serial.println();

        Serial.println(
            "ERP fingerprint registration FAILED."
        );


        Serial.println(
            "Removing fingerprint from sensor slot..."
        );


        uint8_t deleteResult =
            finger.deleteModel(
                sensorSlot
            );


        if (
            deleteResult ==
            FINGERPRINT_OK
        ) {

            Serial.println(
                "Fingerprint removed from sensor."
            );

        } else {

            Serial.println(
                "WARNING: Could not remove fingerprint."
            );

            Serial.println(
                "Check sensor slot manually."
            );
        }


        showOLED(
            "ENROLLMENT FAILED",
            "ERP registration",
            "failed"
        );


        beepError();


        delay(2000);


        return false;
    }


    // ======================================================
    // COMPLETE SUCCESS
    // ======================================================

    Serial.println();

    Serial.println(
        "========================================"
    );


    Serial.println(
        "   FINGERPRINT ENROLLMENT SUCCESSFUL"
    );


    Serial.println(
        "========================================"
    );


    Serial.print(
        "Employee ID : "
    );


    Serial.println(
        employeeId
    );


    Serial.print(
        "Sensor Slot : "
    );


    Serial.println(
        sensorSlot
    );


    Serial.print(
        "Finger Name : "
    );


    Serial.println(
        fingerName
    );


    Serial.println(
        "Sensor + ERP database are synchronized."
    );


    Serial.println(
        "========================================"
    );


    showOLED(
        "ENROLLMENT",
        "SUCCESS",
        "Employee: " + String(employeeId),
        "Slot: " + String(sensorSlot)
    );


    beepSuccess();


    digitalWrite(
        GREEN_LED,
        HIGH
    );


    delay(1500);


    digitalWrite(
        GREEN_LED,
        LOW
    );


    return true;
}


// ==========================================================
// SEND FINGERPRINT ENROLLMENT TO ERP
// ==========================================================

bool sendFingerprintEnrollment(
    int employeeId,
    int sensorSlot,
    String fingerName
) {

    if (
        WiFi.status()
        != WL_CONNECTED
    ) {

        Serial.println(
            "WiFi disconnected."
        );


        return false;
    }


    Serial.println();

    Serial.println(
        "Connecting to fingerprint enrollment API..."
    );


    String url =
        String(BACKEND_URL)
        +
        String(ENROLLMENT_ENDPOINT);


    Serial.println(
        url
    );


    HTTPClient http;


    http.begin(
        url
    );


    http.setTimeout(
        10000
    );


    // ======================================================
    // HEADERS
    // ======================================================

    http.addHeader(
        "Content-Type",
        "application/json"
    );


    http.addHeader(
        "X-Device-Code",
        DEVICE_CODE
    );


    http.addHeader(
        "X-Device-Secret",
        DEVICE_SECRET
    );


    // ======================================================
    // JSON BODY
    // ======================================================

    JsonDocument requestDocument;


    requestDocument["employeeId"] =
        employeeId;


    requestDocument["sensorSlot"] =
        sensorSlot;


    requestDocument["fingerName"] =
        fingerName;


    String requestBody;


    serializeJson(
        requestDocument,
        requestBody
    );


    Serial.println();

    Serial.println(
        "Enrollment request:"
    );


    Serial.println(
        requestBody
    );


    // ======================================================
    // POST
    // ======================================================

    int httpCode =
        http.POST(
            requestBody
        );


    Serial.print(
        "Enrollment HTTP Response Code: "
    );


    Serial.println(
        httpCode
    );


    // ======================================================
    // RESPONSE
    // ======================================================

    if (
        httpCode > 0
    ) {

        String response =
            http.getString();


        Serial.println();

        Serial.println(
            "ERP ENROLLMENT RESPONSE:"
        );


        Serial.println(
            response
        );


        // ==================================================
        // SUCCESS
        // ==================================================

        if (
            httpCode >= 200 &&
            httpCode < 300
        ) {

            JsonDocument responseDocument;


            DeserializationError error =
                deserializeJson(
                    responseDocument,
                    response
                );


            if (
                error
            ) {

                Serial.println(
                    "Warning: Could not parse ERP response."
                );


                http.end();


                return true;
            }


            bool success =
                responseDocument["success"]
                    | false;


            if (
                success
            ) {

                Serial.println();

                Serial.println(
                    "ERP fingerprint registration: SUCCESS"
                );


                http.end();


                return true;
            }


            Serial.println();

            Serial.println(
                "ERP returned success=false."
            );


            http.end();


            return false;
        }


        // ==================================================
        // ERROR RESPONSE
        // ==================================================

        Serial.print(
            "ERP enrollment rejected. HTTP status: "
        );


        Serial.println(
            httpCode
        );


        http.end();


        return false;
    }


    // ======================================================
    // CONNECTION ERROR
    // ======================================================

    Serial.print(
        "Enrollment HTTP request failed: "
    );


    Serial.println(
        http.errorToString(
            httpCode
        )
    );


    http.end();


    return false;
}


// ==========================================================
// WAIT FOR FINGER REMOVAL
// ==========================================================

bool waitForFingerRemoval() {

    unsigned long startTime =
        millis();


    while (
        millis() - startTime < 15000
    ) {

        uint8_t result =
            finger.getImage();


        if (
            result ==
            FINGERPRINT_NOFINGER
        ) {

            return true;
        }


        delay(100);
    }


    return false;
}


// ==========================================================
// OLED
// ==========================================================

void showOLED(
    String line1,
    String line2,
    String line3,
    String line4
) {

    display.clearDisplay();


    display.setTextColor(
        SSD1306_WHITE
    );


    display.setTextSize(
        1
    );


    display.setCursor(
        0,
        0
    );


    display.println(
        line1
    );


    display.setCursor(
        0,
        16
    );


    display.println(
        line2
    );


    display.setCursor(
        0,
        32
    );


    display.println(
        line3
    );


    display.setCursor(
        0,
        48
    );


    display.println(
        line4
    );


    display.display();
}


// ==========================================================
// SUCCESS BEEP
// ==========================================================

void beepSuccess() {

    tone(
        BUZZER,
        2000,
        150
    );


    delay(200);


    tone(
        BUZZER,
        2500,
        150
    );


    delay(200);


    noTone(
        BUZZER
    );
}


// ==========================================================
// ERROR BEEP
// ==========================================================

void beepError() {

    tone(
        BUZZER,
        500,
        500
    );


    delay(600);


    noTone(
        BUZZER
    );
}


// ==========================================================
// ATTENDANCE SUCCESS
// ==========================================================

void attendanceSuccess() {

    Serial.println();

    Serial.println(
        "Attendance accepted."
    );


    showOLED(
        "Attendance",
        "SUCCESS"
    );


    digitalWrite(
        GREEN_LED,
        HIGH
    );


    beepSuccess();


    delay(1000);


    digitalWrite(
        GREEN_LED,
        LOW
    );
}


// ==========================================================
// ATTENDANCE FAILED
// ==========================================================

void attendanceFailed() {

    Serial.println();

    Serial.println(
        "ERP rejected the attendance."
    );


    showOLED(
        "Attendance",
        "FAILED"
    );


    digitalWrite(
        RED_LED,
        HIGH
    );


    beepError();


    delay(1000);


    digitalWrite(
        RED_LED,
        LOW
    );
}
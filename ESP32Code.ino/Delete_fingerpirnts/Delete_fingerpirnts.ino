#include <Adafruit_Fingerprint.h>

// ============================================================
// UART CONFIGURATION
// ============================================================

#define RX_PIN 16
#define TX_PIN 17

HardwareSerial fingerSerial(2);
Adafruit_Fingerprint finger = Adafruit_Fingerprint(&fingerSerial);

// ============================================================
// SETUP
// ============================================================

void setup() {

  Serial.begin(115200);
  delay(1000);

  Serial.println();
  Serial.println("==============================================");
  Serial.println("   FINGERPRINT SENSOR - CLEAR ALL TEMPLATES");
  Serial.println("==============================================");

  fingerSerial.begin(
    57600,
    SERIAL_8N1,
    RX_PIN,
    TX_PIN
  );

  finger.begin(57600);

  delay(1000);

  // ----------------------------------------------------------
  // Check sensor connection
  // ----------------------------------------------------------

  Serial.println();
  Serial.println("Checking fingerprint sensor...");

  if (finger.verifyPassword()) {

    Serial.println("Fingerprint sensor detected successfully.");

  } else {

    Serial.println("ERROR: Fingerprint sensor not detected.");
    Serial.println("Check:");
    Serial.println("- RX/TX wiring");
    Serial.println("- Sensor power");
    Serial.println("- GND connection");
    Serial.println("- UART pins");

    while (true) {
      delay(1000);
    }
  }

  // ----------------------------------------------------------
  // Get sensor information
  // ----------------------------------------------------------

  Serial.println();
  Serial.println("Reading sensor information...");

  finger.getParameters();

  Serial.print("Capacity: ");
  Serial.println(finger.capacity);

  Serial.print("Security level: ");
  Serial.println(finger.security_level);

  Serial.print("Packet length: ");
  Serial.println(finger.packet_len);

  Serial.print("Baud rate: ");
  Serial.println(finger.baud_rate);

  // ----------------------------------------------------------
  // Warning
  // ----------------------------------------------------------

  Serial.println();
  Serial.println("WARNING!");
  Serial.println("This operation will DELETE ALL fingerprints");
  Serial.println("stored inside the fingerprint sensor.");
  Serial.println();

  Serial.println("Type YES in Serial Monitor to continue.");
  Serial.println("Anything else will cancel.");

  // ----------------------------------------------------------
  // Wait for confirmation
  // ----------------------------------------------------------

  String confirmation = "";

  while (true) {

    if (Serial.available()) {

      confirmation = Serial.readStringUntil('\n');

      confirmation.trim();

      break;
    }

    delay(100);
  }

  if (confirmation != "YES") {

    Serial.println();
    Serial.println("Operation cancelled.");
    Serial.println("No fingerprints were deleted.");

    return;
  }

  // ----------------------------------------------------------
  // Delete all templates
  // ----------------------------------------------------------

  Serial.println();
  Serial.println("==============================================");
  Serial.println("Deleting ALL fingerprint templates...");
  Serial.println("==============================================");

  uint8_t result = finger.emptyDatabase();

  // ----------------------------------------------------------
  // Check result
  // ----------------------------------------------------------

  if (result == FINGERPRINT_OK) {

    Serial.println();
    Serial.println("SUCCESS!");
    Serial.println("All fingerprints have been deleted");
    Serial.println("from the sensor.");

  } else {

    Serial.println();
    Serial.println("ERROR!");
    Serial.print("Sensor returned error code: ");
    Serial.println(result);

    printError(result);
  }

  // ----------------------------------------------------------
  // Final verification
  // ----------------------------------------------------------

  Serial.println();
  Serial.println("Verifying sensor database...");

  uint8_t templateResult = finger.getTemplateCount();

  if (templateResult == FINGERPRINT_OK) {

    Serial.print("Templates remaining: ");
    Serial.println(finger.templateCount);

    if (finger.templateCount == 0) {

      Serial.println();
      Serial.println("==============================================");
      Serial.println("CONFIRMED: SENSOR IS EMPTY");
      Serial.println("==============================================");

    } else {

      Serial.println();
      Serial.println("WARNING: Some templates still remain.");

    }

  } else {

    Serial.println("Unable to verify template count.");
  }
}

// ============================================================
// LOOP
// ============================================================

void loop() {

  // Nothing required.
  delay(1000);
}

// ============================================================
// ERROR HANDLER
// ============================================================

void printError(uint8_t code) {

  switch (code) {

    case FINGERPRINT_PACKETRECIEVEERR:
      Serial.println("Communication error.");
      break;

    case FINGERPRINT_NOFINGER:
      Serial.println("No finger detected.");
      break;

    case FINGERPRINT_IMAGEFAIL:
      Serial.println("Image capture failed.");
      break;

    case FINGERPRINT_IMAGEMESS:
      Serial.println("Image too messy.");
      break;

    case FINGERPRINT_FEATUREFAIL:
      Serial.println("Fingerprint features could not be detected.");
      break;

    case FINGERPRINT_INVALIDIMAGE:
      Serial.println("Invalid fingerprint image.");
      break;

    case FINGERPRINT_ENROLLMISMATCH:
      Serial.println("Fingerprints did not match.");
      break;

    case FINGERPRINT_BADLOCATION:
      Serial.println("Invalid fingerprint storage location.");
      break;

    case FINGERPRINT_FLASHERR:
      Serial.println("Sensor flash memory error.");
      break;

    case FINGERPRINT_NOTFOUND:
      Serial.println("Fingerprint not found.");
      break;

    case FINGERPRINT_DELETEFAIL:
      Serial.println("Fingerprint deletion failed.");
      break;

    case FINGERPRINT_DBCLEARFAIL:
      Serial.println("Sensor database clear operation failed.");
      break;

    case FINGERPRINT_INVALIDREG:
      Serial.println("Invalid sensor register.");
      break;

    default:
      Serial.println("Unknown fingerprint sensor error.");
      break;
  }
}
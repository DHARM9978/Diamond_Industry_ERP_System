/*
  ================================================================
  ESP32 FINGERPRINT SENSOR - SAFE DIAGNOSTIC UTILITY
  ================================================================

  Purpose:
    Diagnose fingerprint-template locations without accidentally
    deleting a valid fingerprint.

  Hardware:
    ESP32
      GPIO16 = RX  <- Sensor TX
      GPIO17 = TX  -> Sensor RX

  Sensor:
    UART = 57600

  Serial Monitor:
    115200 baud

  Commands:
    INFO
        Show sensor information and template count.

    MATCH
        Put a fingerprint on the sensor.
        The sensor will search its database and show:
          - matched sensor slot
          - confidence

    CHECK 5
        Check a specific slot.
        Replace 5 with another slot number.

    DELETE 5
        Attempt deletion of a specific slot.
        Deletion is allowed ONLY when loadModel() returns OK.

    HELP
        Show commands.

  IMPORTANT:
    Code 12 = FINGERPRINT_DBRANGEFAIL.
    This is NOT treated as proof that a slot is occupied or empty.

    We will NOT delete a slot when the sensor cannot positively
    confirm that the slot is loadable.
  ================================================================
*/

#include <Adafruit_Fingerprint.h>

// ---------------------------------------------------------------
// Hardware configuration
// ---------------------------------------------------------------

#define FINGERPRINT_RX   16
#define FINGERPRINT_TX   17
#define FINGERPRINT_BAUD 57600

#define SERIAL_BAUD 115200

// ---------------------------------------------------------------
// Fingerprint sensor object
// ---------------------------------------------------------------

HardwareSerial FingerSerial(2);
Adafruit_Fingerprint finger(&FingerSerial);

// ---------------------------------------------------------------
// Function declarations
// ---------------------------------------------------------------

void printBanner();
void printHelp();
void printSensorInfo();
void matchFingerprint();
void checkSlot(uint16_t slot);
void deleteSlot(uint16_t slot);

String readCommand();

const char* fingerprintErrorName(uint8_t code);

// ---------------------------------------------------------------
// SETUP
// ---------------------------------------------------------------

void setup() {

  Serial.begin(SERIAL_BAUD);
  delay(1000);

  printBanner();

  // Initialize UART2
  FingerSerial.begin(
    FINGERPRINT_BAUD,
    SERIAL_8N1,
    FINGERPRINT_RX,
    FINGERPRINT_TX
  );

  delay(500);

  finger.begin(FINGERPRINT_BAUD);

  delay(1000);

  Serial.println();
  Serial.println("Checking fingerprint sensor...");

  if (!finger.verifyPassword()) {

    Serial.println();
    Serial.println("ERROR: Fingerprint sensor NOT detected.");
    Serial.println();
    Serial.println("Check:");
    Serial.println("  1. Sensor power");
    Serial.println("  2. Sensor TX -> ESP32 GPIO16");
    Serial.println("  3. Sensor RX -> ESP32 GPIO17");
    Serial.println("  4. Sensor baud rate = 57600");
    Serial.println();

    while (true) {
      delay(1000);
    }
  }

  Serial.println("Fingerprint sensor detected successfully.");

  printSensorInfo();
  printHelp();
}

// ---------------------------------------------------------------
// LOOP
// ---------------------------------------------------------------

void loop() {

  if (Serial.available()) {

    String command = readCommand();

    command.trim();

    if (command.length() == 0) {
      return;
    }

    command.toUpperCase();

    // -----------------------------------------------------------
    // HELP
    // -----------------------------------------------------------

    if (command == "HELP") {

      printHelp();
      return;
    }

    // -----------------------------------------------------------
    // INFO
    // -----------------------------------------------------------

    if (command == "INFO") {

      printSensorInfo();
      return;
    }

    // -----------------------------------------------------------
    // MATCH
    // -----------------------------------------------------------

    if (command == "MATCH") {

      matchFingerprint();
      return;
    }

    // -----------------------------------------------------------
    // CHECK
    // Example:
    // CHECK 5
    // -----------------------------------------------------------

    if (command.startsWith("CHECK ")) {

      String slotText = command.substring(6);
      slotText.trim();

      int slot = slotText.toInt();

      if (slot <= 0) {

        Serial.println();
        Serial.println("Invalid slot number.");
        Serial.println("Example: CHECK 5");
        Serial.println();

        return;
      }

      checkSlot((uint16_t)slot);
      return;
    }

    // -----------------------------------------------------------
    // DELETE
    // Example:
    // DELETE 5
    // -----------------------------------------------------------

    if (command.startsWith("DELETE ")) {

      String slotText = command.substring(7);
      slotText.trim();

      int slot = slotText.toInt();

      if (slot <= 0) {

        Serial.println();
        Serial.println("Invalid slot number.");
        Serial.println("Example: DELETE 5");
        Serial.println();

        return;
      }

      deleteSlot((uint16_t)slot);
      return;
    }

    // -----------------------------------------------------------
    // Unknown command
    // -----------------------------------------------------------

    Serial.println();
    Serial.println("Unknown command.");
    Serial.println("Type HELP for available commands.");
    Serial.println();
  }
}

// ---------------------------------------------------------------
// SERIAL COMMAND READER
// ---------------------------------------------------------------

String readCommand() {

  String command = "";

  while (Serial.available()) {

    char c = Serial.read();

    if (c == '\n' || c == '\r') {

      if (command.length() > 0) {
        break;
      }

    } else {

      command += c;
    }

    delay(2);
  }

  return command;
}

// ---------------------------------------------------------------
// BANNER
// ---------------------------------------------------------------

void printBanner() {

  Serial.println();
  Serial.println("================================================");
  Serial.println("     ESP32 FINGERPRINT DIAGNOSTIC UTILITY");
  Serial.println("================================================");
  Serial.println();
  Serial.println("ESP32 RX : GPIO16");
  Serial.println("ESP32 TX : GPIO17");
  Serial.println("Sensor Baud: 57600");
  Serial.println("Serial Monitor: 115200");
  Serial.println();
}

// ---------------------------------------------------------------
// HELP
// ---------------------------------------------------------------

void printHelp() {

  Serial.println();
  Serial.println("------------------------------------------------");
  Serial.println("AVAILABLE COMMANDS");
  Serial.println("------------------------------------------------");

  Serial.println("INFO");
  Serial.println("  Show sensor information.");

  Serial.println();

  Serial.println("MATCH");
  Serial.println("  Scan a fingerprint and find its sensor slot.");

  Serial.println();

  Serial.println("CHECK <slot>");
  Serial.println("  Example: CHECK 5");
  Serial.println("  Safely test a specific slot.");

  Serial.println();

  Serial.println("DELETE <slot>");
  Serial.println("  Example: DELETE 5");
  Serial.println("  Delete ONLY after positive confirmation.");

  Serial.println();

  Serial.println("HELP");
  Serial.println("  Show this help.");

  Serial.println("------------------------------------------------");
  Serial.println();
}

// ---------------------------------------------------------------
// SENSOR INFORMATION
// ---------------------------------------------------------------

void printSensorInfo() {

  Serial.println();
  Serial.println("================================================");
  Serial.println("                 SENSOR INFORMATION");
  Serial.println("================================================");

  uint8_t result = finger.getParameters();

  Serial.print("getParameters() result: ");
  Serial.println(result);

  if (result == FINGERPRINT_OK) {

    Serial.print("Status register: ");
    Serial.println(finger.status_reg);

    Serial.print("System identifier code: ");
    Serial.println(finger.system_id);

    Serial.print("Capacity: ");
    Serial.println(finger.capacity);

    Serial.print("Security level: ");
    Serial.println(finger.security_level);

    Serial.print("Device address: 0x");
    Serial.println(finger.device_addr, HEX);

    Serial.print("Packet length code: ");
    Serial.println(finger.packet_len);

    Serial.print("Baud rate: ");
    Serial.println(finger.baud_rate);

  } else {

    Serial.println("Could not read sensor parameters.");
    Serial.print("Error: ");
    Serial.println(fingerprintErrorName(result));
  }

  Serial.println();

  uint8_t countResult = finger.getTemplateCount();

  Serial.print("getTemplateCount() result: ");
  Serial.println(countResult);

  if (countResult == FINGERPRINT_OK) {

    Serial.print("Stored template count: ");
    Serial.println(finger.templateCount);

  } else {

    Serial.println("Could not read template count.");
    Serial.print("Error: ");
    Serial.println(fingerprintErrorName(countResult));
  }

  Serial.println();
  Serial.println("NOTE:");
  Serial.println("Template count tells us how many templates");
  Serial.println("the sensor reports, but it does NOT identify");
  Serial.println("which slot belongs to which employee.");

  Serial.println();
  Serial.println("================================================");
  Serial.println();
}

// ---------------------------------------------------------------
// MATCH FINGERPRINT
// ---------------------------------------------------------------

void matchFingerprint() {

  Serial.println();
  Serial.println("================================================");
  Serial.println("             FINGERPRINT MATCH TEST");
  Serial.println("================================================");
  Serial.println();
  Serial.println("Place finger on sensor...");
  Serial.println();

  // Wait for finger
  uint8_t result;

  while (true) {

    result = finger.getImage();

    if (result == FINGERPRINT_OK) {
      break;
    }

    if (result == FINGERPRINT_NOFINGER) {
      delay(100);
      continue;
    }

    Serial.println("Could not capture fingerprint image.");
    Serial.print("Sensor code: ");
    Serial.println(result);
    Serial.print("Meaning: ");
    Serial.println(fingerprintErrorName(result));
    Serial.println();

    return;
  }

  Serial.println("Fingerprint captured.");

  result = finger.image2Tz();

  if (result != FINGERPRINT_OK) {

    Serial.println();
    Serial.println("Could not convert fingerprint image.");
    Serial.print("Sensor code: ");
    Serial.println(result);
    Serial.print("Meaning: ");
    Serial.println(fingerprintErrorName(result));
    Serial.println();

    return;
  }

  Serial.println("Fingerprint converted.");
  Serial.println("Searching sensor database...");
  Serial.println();

  result = finger.fingerFastSearch();

  if (result == FINGERPRINT_OK) {

    Serial.println("==============================================");
    Serial.println("       FINGERPRINT MATCH FOUND");
    Serial.println("==============================================");

    Serial.print("Matched Sensor Slot: ");
    Serial.println(finger.fingerID);

    Serial.print("Confidence: ");
    Serial.println(finger.confidence);

    Serial.println();

    Serial.println("IMPORTANT:");
    Serial.println("This means the scanned fingerprint matches");
    Serial.println("the template currently stored at this sensor");
    Serial.println("slot.");

    Serial.println("==============================================");
    Serial.println();

    return;
  }

  if (result == FINGERPRINT_NOTFOUND) {

    Serial.println("==============================================");
    Serial.println("       NO FINGERPRINT MATCH");
    Serial.println("==============================================");
    Serial.println();

    return;
  }

  Serial.println("Fingerprint search failed.");

  Serial.print("Sensor code: ");
  Serial.println(result);

  Serial.print("Meaning: ");
  Serial.println(fingerprintErrorName(result));

  Serial.println();
}

// ---------------------------------------------------------------
// CHECK SPECIFIC SLOT
// ---------------------------------------------------------------

void checkSlot(uint16_t slot) {

  Serial.println();
  Serial.println("================================================");
  Serial.print("             CHECKING SENSOR SLOT: ");
  Serial.println(slot);
  Serial.println("================================================");
  Serial.println();

  Serial.println("Calling loadModel()...");
  Serial.println();

  uint8_t result = finger.loadModel(slot);

  Serial.print("loadModel() result: ");
  Serial.println(result);

  Serial.print("Meaning: ");
  Serial.println(fingerprintErrorName(result));

  Serial.println();

  // -------------------------------------------------------------
  // Positive confirmation
  // -------------------------------------------------------------

  if (result == FINGERPRINT_OK) {

    Serial.println("***********************************************");
    Serial.println("SLOT CONFIRMED AS LOADABLE");
    Serial.println("***********************************************");
    Serial.println();

    Serial.print("Sensor slot ");
    Serial.print(slot);
    Serial.println(" contains a model that the sensor successfully loaded.");

    Serial.println();
    Serial.println("DO NOT delete it unless you know which employee");
    Serial.println("owns this fingerprint.");

    Serial.println();

    return;
  }

  // -------------------------------------------------------------
  // Empty / not found
  // -------------------------------------------------------------

  if (result == FINGERPRINT_NOTFOUND) {

    Serial.println("***********************************************");
    Serial.println("SLOT NOT FOUND");
    Serial.println("***********************************************");
    Serial.println();

    Serial.println("The sensor reported that the model could not");
    Serial.println("be found at this location.");

    Serial.println();

    return;
  }

  // -------------------------------------------------------------
  // Bad location
  // -------------------------------------------------------------

  if (result == FINGERPRINT_BADLOCATION) {

    Serial.println("***********************************************");
    Serial.println("INVALID SENSOR SLOT");
    Serial.println("***********************************************");
    Serial.println();

    Serial.println("The requested slot is outside the valid");
    Serial.println("sensor database range.");

    Serial.println();

    return;
  }

  // -------------------------------------------------------------
  // Database range failure
  // -------------------------------------------------------------

  if (result == 0x0C) {

    Serial.println("***********************************************");
    Serial.println("DATABASE RANGE FAILURE");
    Serial.println("***********************************************");
    Serial.println();

    Serial.println("The sensor returned code 12 (0x0C).");
    Serial.println();
    Serial.println("This is NOT treated as:");
    Serial.println("  - confirmed occupied");
    Serial.println("  - confirmed empty");

    Serial.println();
    Serial.println("NO deletion will be attempted.");

    Serial.println();

    return;
  }

  // -------------------------------------------------------------
  // Other error
  // -------------------------------------------------------------

  Serial.println("***********************************************");
  Serial.println("UNEXPECTED SENSOR RESULT");
  Serial.println("***********************************************");

  Serial.println();
  Serial.println("The slot could not be safely classified.");
  Serial.println("NO deletion will be attempted.");
  Serial.println();
}

// ---------------------------------------------------------------
// DELETE SPECIFIC SLOT
// ---------------------------------------------------------------

void deleteSlot(uint16_t slot) {

  Serial.println();
  Serial.println("================================================");
  Serial.print("             DELETE REQUEST FOR SLOT: ");
  Serial.println(slot);
  Serial.println("================================================");
  Serial.println();

  Serial.println("Step 1: Checking slot before deletion...");

  uint8_t loadResult = finger.loadModel(slot);

  Serial.print("loadModel() result: ");
  Serial.println(loadResult);

  Serial.print("Meaning: ");
  Serial.println(fingerprintErrorName(loadResult));

  Serial.println();

  // -------------------------------------------------------------
  // NEVER delete unless loadModel returned OK
  // -------------------------------------------------------------

  if (loadResult != FINGERPRINT_OK) {

    Serial.println("Deletion was NOT attempted.");
    Serial.println();

    Serial.println("Reason:");
    Serial.println("The sensor did not positively confirm that");
    Serial.println("this slot contains a loadable fingerprint model.");

    Serial.println();

    return;
  }

  Serial.println("Slot successfully loaded.");
  Serial.println();

  Serial.println("WARNING:");
  Serial.print("This will permanently delete fingerprint slot ");
  Serial.println(slot);

  Serial.println();

  Serial.println("Type YES to continue.");
  Serial.println("Anything else cancels.");

  Serial.println();

  while (!Serial.available()) {
    delay(50);
  }

  String confirmation = readCommand();
  confirmation.trim();
  confirmation.toUpperCase();

  if (confirmation != "YES") {

    Serial.println();
    Serial.println("Deletion cancelled.");
    Serial.println();

    return;
  }

  Serial.println();
  Serial.println("Deleting fingerprint...");

  uint8_t deleteResult = finger.deleteModel(slot);

  Serial.print("deleteModel() result: ");
  Serial.println(deleteResult);

  Serial.print("Meaning: ");
  Serial.println(fingerprintErrorName(deleteResult));

  Serial.println();

  if (deleteResult == FINGERPRINT_OK) {

    Serial.println("***********************************************");
    Serial.println("DELETION SUCCESSFUL");
    Serial.println("***********************************************");
    Serial.println();

    Serial.print("Fingerprint slot ");
    Serial.print(slot);
    Serial.println(" was deleted.");

    Serial.println();

    // -----------------------------------------------------------
    // Verify deletion
    // -----------------------------------------------------------

    Serial.println("Verifying deletion...");

    uint8_t verifyResult = finger.loadModel(slot);

    Serial.print("Verification loadModel() result: ");
    Serial.println(verifyResult);

    if (verifyResult == FINGERPRINT_NOTFOUND) {

      Serial.println();
      Serial.println("CONFIRMED:");
      Serial.println("The fingerprint is no longer loadable from this slot.");

    } else if (verifyResult == FINGERPRINT_OK) {

      Serial.println();
      Serial.println("WARNING:");
      Serial.println("The sensor still reports the model as loadable.");

    } else {

      Serial.println();
      Serial.println("The sensor returned another code while verifying.");
    }

    Serial.println();

    return;
  }

  Serial.println("***********************************************");
  Serial.println("DELETION FAILED");
  Serial.println("***********************************************");
  Serial.println();
}

// ---------------------------------------------------------------
// ERROR CODE DESCRIPTION
// ---------------------------------------------------------------
const char* fingerprintErrorName(uint8_t code) {

  switch (code) {

    case 0x00:
      return "FINGERPRINT_OK";

    case 0x01:
      return "FINGERPRINT_PACKETRECIEVEERR";

    case 0x02:
      return "FINGERPRINT_NOFINGER";

    case 0x03:
      return "FINGERPRINT_IMAGEFAIL";

    case 0x06:
      return "FINGERPRINT_IMAGEMESS";

    case 0x07:
      return "FINGERPRINT_FEATUREFAIL";

    case 0x08:
      return "FINGERPRINT_NOMATCH";

    case 0x09:
      return "FINGERPRINT_NOTFOUND";

    case 0x0A:
      return "FINGERPRINT_ENROLLMISMATCH";

    case 0x0B:
      return "FINGERPRINT_BADLOCATION";

    case 0x0C:
      return "FINGERPRINT_DBRANGEFAIL";

    case 0x0D:
      return "FINGERPRINT_UPLOADFEATUREFAIL";

    case 0x0E:
      return "FINGERPRINT_PACKETRESPONSEFAIL";

    case 0x0F:
      return "FINGERPRINT_UPLOADFAIL";

    case 0x10:
      return "FINGERPRINT_DELETEFAIL";

    case 0x11:
      return "FINGERPRINT_DBCLEARFAIL";

    case 0x13:
      return "FINGERPRINT_PASSFAIL";

    case 0x15:
      return "FINGERPRINT_INVALIDIMAGE";

    case 0x18:
      return "FINGERPRINT_FLASHERR";

    case 0x1A:
      return "FINGERPRINT_INVALIDREG";

    case 0x20:
      return "FINGERPRINT_ADDRCODE";

    case 0x21:
      return "FINGERPRINT_PASSVERIFY";

    case 0xFF:
      return "FINGERPRINT_TIMEOUT";

    case 0xFE:
      return "FINGERPRINT_BADPACKET";

    default:
      return "UNKNOWN_SENSOR_ERROR";
  }
}
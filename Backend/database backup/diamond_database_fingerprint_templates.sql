-- MySQL dump 10.13  Distrib 8.0.46, for Win64 (x86_64)
--
-- Host: 127.0.0.1    Database: diamond_database
-- ------------------------------------------------------
-- Server version	8.0.46

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `fingerprint_templates`
--

DROP TABLE IF EXISTS `fingerprint_templates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `fingerprint_templates` (
  `template_id` int NOT NULL AUTO_INCREMENT,
  `employeeId` int NOT NULL,
  `sensor_slot` int NOT NULL,
  `finger_name` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `enrolled_at` datetime(3) NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`template_id`),
  UNIQUE KEY `fingerprint_templates_sensor_slot_key` (`sensor_slot`),
  KEY `fingerprint_templates_employeeId_idx` (`employeeId`),
  CONSTRAINT `fingerprint_templates_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees` (`employee_id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `fingerprint_templates`
--

LOCK TABLES `fingerprint_templates` WRITE;
/*!40000 ALTER TABLE `fingerprint_templates` DISABLE KEYS */;
INSERT INTO `fingerprint_templates` VALUES (2,1,1,'Left Thumb','ACTIVE','2026-08-21 19:44:28.716','2026-08-21 19:44:28.724','2026-08-21 19:44:28.724'),(3,1,4,'Right Thumb','ACTIVE','2026-08-23 14:54:39.786','2026-08-23 14:54:39.803','2026-08-23 14:54:39.803'),(4,1,5,'right','ACTIVE','2026-08-23 15:17:38.180','2026-08-23 15:17:38.181','2026-08-23 15:17:38.181'),(5,1,7,'Pinky','ACTIVE','2026-08-23 15:18:44.587','2026-08-23 15:18:44.588','2026-08-23 15:18:44.588'),(6,4,8,'Right Index','ACTIVE','2026-09-03 21:21:59.447','2026-09-03 21:21:59.450','2026-09-03 21:21:59.450'),(7,3,9,'Right Index','ACTIVE','2026-09-04 06:35:47.194','2026-09-04 06:35:47.195','2026-09-04 06:35:47.195'),(8,5,10,'Right Pinky','ACTIVE','2026-09-05 09:23:33.976','2026-09-05 09:23:33.977','2026-09-05 09:23:33.977');
/*!40000 ALTER TABLE `fingerprint_templates` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-09-05 17:08:06

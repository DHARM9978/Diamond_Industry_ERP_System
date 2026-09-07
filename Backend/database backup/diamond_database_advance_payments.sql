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
-- Table structure for table `advance_payments`
--

DROP TABLE IF EXISTS `advance_payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `advance_payments` (
  `advance_id` int NOT NULL AUTO_INCREMENT,
  `employeeId` int NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `reason` text COLLATE utf8mb4_unicode_ci,
  `payment_date` date NOT NULL,
  `approvedBy` int DEFAULT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  `deducted_at` datetime(3) DEFAULT NULL,
  `deducted_in_payroll_id` int DEFAULT NULL,
  PRIMARY KEY (`advance_id`),
  UNIQUE KEY `advance_payments_deducted_in_payroll_id_key` (`deducted_in_payroll_id`),
  KEY `advance_payments_employeeId_idx` (`employeeId`),
  KEY `advance_payments_approvedBy_idx` (`approvedBy`),
  CONSTRAINT `advance_payments_approvedBy_fkey` FOREIGN KEY (`approvedBy`) REFERENCES `admin` (`admin_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `advance_payments_deducted_in_payroll_id_fkey` FOREIGN KEY (`deducted_in_payroll_id`) REFERENCES `payroll` (`payroll_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `advance_payments_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees` (`employee_id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `advance_payments`
--

LOCK TABLES `advance_payments` WRITE;
/*!40000 ALTER TABLE `advance_payments` DISABLE KEYS */;
INSERT INTO `advance_payments` VALUES (1,1,5000.00,'Personal emergency','2026-08-24',3,'APPROVED','2026-08-24 04:49:07.631','2026-08-31 18:46:59.994','2026-08-31 18:46:59.992',2),(2,1,5000.00,'Personal requirement','2026-08-31',3,'APPROVED','2026-08-31 18:11:58.197','2026-08-31 20:46:37.504','2026-08-31 20:46:37.500',3);
/*!40000 ALTER TABLE `advance_payments` ENABLE KEYS */;
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

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
-- Table structure for table `leave_requests`
--

DROP TABLE IF EXISTS `leave_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `leave_requests` (
  `leave_request_id` int NOT NULL AUTO_INCREMENT,
  `employee_id` int NOT NULL,
  `leave_type_id` int NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `total_days` decimal(6,2) NOT NULL,
  `reason` text COLLATE utf8mb4_unicode_ci,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `approved_by` int DEFAULT NULL,
  `approved_at` datetime(3) DEFAULT NULL,
  `rejection_reason` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`leave_request_id`),
  KEY `leave_requests_employee_id_idx` (`employee_id`),
  KEY `leave_requests_leave_type_id_idx` (`leave_type_id`),
  KEY `leave_requests_status_idx` (`status`),
  KEY `leave_requests_start_date_end_date_idx` (`start_date`,`end_date`),
  CONSTRAINT `leave_requests_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`employee_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `leave_requests_leave_type_id_fkey` FOREIGN KEY (`leave_type_id`) REFERENCES `leave_types` (`leave_type_id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `leave_requests`
--

LOCK TABLES `leave_requests` WRITE;
/*!40000 ALTER TABLE `leave_requests` DISABLE KEYS */;
INSERT INTO `leave_requests` VALUES (1,4,1,'2026-09-09','2026-09-11',3.00,'Personal work','APPROVED',3,'2026-09-02 08:21:17.389',NULL,'2026-09-02 07:59:12.249','2026-09-02 08:21:17.392'),(2,4,2,'2026-09-19','2026-09-21',3.00,'Medical rest','REJECTED',3,'2026-09-02 08:07:20.450',NULL,'2026-09-02 08:06:59.350','2026-09-02 08:07:20.454'),(3,4,2,'2026-09-19','2026-09-21',3.00,'Medical rest','REJECTED',3,'2026-09-02 08:18:25.040',NULL,'2026-09-02 08:16:49.376','2026-09-02 08:18:25.045'),(4,4,1,'2026-09-04','2026-09-08',5.00,'For roaming','APPROVED',3,'2026-09-04 05:39:10.571',NULL,'2026-09-04 05:38:49.966','2026-09-04 05:39:10.583'),(5,4,2,'2027-02-28','2027-03-01',2.00,'i will be sick','CANCELLED',NULL,NULL,NULL,'2026-09-04 13:13:20.642','2026-09-04 13:13:25.225'),(6,4,2,'2026-09-30','2026-10-05',6.00,'i will sick','CANCELLED',NULL,NULL,NULL,'2026-09-04 13:14:02.834','2026-09-04 13:30:25.832'),(7,4,1,'2026-11-30','2026-12-05',6.00,'i want leave','APPROVED',3,'2026-09-04 13:16:08.324',NULL,'2026-09-04 13:16:04.386','2026-09-04 13:16:08.327');
/*!40000 ALTER TABLE `leave_requests` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-09-05 17:08:07

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
-- Table structure for table `employees`
--

DROP TABLE IF EXISTS `employees`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `employees` (
  `employee_id` int NOT NULL AUTO_INCREMENT,
  `first_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `last_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `gender` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hire_date` date DEFAULT NULL,
  `role` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `salary_rate_per_hour` decimal(10,2) DEFAULT NULL,
  `companyId` int NOT NULL,
  `branchId` int NOT NULL,
  `departmentId` int DEFAULT NULL,
  `managerId` int DEFAULT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`employee_id`),
  UNIQUE KEY `employees_email_key` (`email`),
  KEY `employees_companyId_idx` (`companyId`),
  KEY `employees_branchId_idx` (`branchId`),
  KEY `employees_departmentId_idx` (`departmentId`),
  KEY `employees_managerId_idx` (`managerId`),
  CONSTRAINT `employees_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches` (`branch_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `employees_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies` (`company_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `employees_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `departments` (`department_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `employees_managerId_fkey` FOREIGN KEY (`managerId`) REFERENCES `employees` (`employee_id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `employees`
--

LOCK TABLES `employees` WRITE;
/*!40000 ALTER TABLE `employees` DISABLE KEYS */;
INSERT INTO `employees` VALUES (1,'Rahul','Sharma','Male','rahul@diamond.com','9876543210','2026-08-22','EMPLOYEE',250.00,1,1,1,NULL,'ACTIVE','$2b$12$4410Tt7PcH1ODBB5LbKpy.0wtM3BaQJBYcnbQfSivQTao8p1TuTJC','2026-08-21 19:01:28.326','2026-08-23 21:11:57.626'),(3,'Demo','Employee',NULL,'demo.employee@diamond.com','9876543210',NULL,'EMPLOYEE',100.00,1,1,1,NULL,'ACTIVE','$2b$12$Cu1foZBvO8hcAcKz.KGYQOPe8QQHv.E0hxunHKhTfffryP5k.4vfW','2026-09-01 16:06:32.979','2026-09-01 16:06:32.979'),(4,'Demo','Employee',NULL,'demo.employees@diamond.com','9876543210',NULL,'MANAGER',100.00,1,1,1,NULL,'ACTIVE','$2b$12$cEFfArJstaB.y.0z4B2iPurrQ1bLyGrxbwoERqtUtJubyT.i8WyCW','2026-09-01 18:52:14.654','2026-09-04 05:23:40.527'),(5,'Demo','Employee','Male','demo@gmail.com','12345643234','2000-01-01','EMPLOYEE',150.00,1,1,1,NULL,'ACTIVE','$2b$12$ZDFfSEF2sKxcjZT99SiHouG86wmYuhEnzggvKjtEB10gjwtrZ70Na','2026-09-03 20:59:52.067','2026-09-03 20:59:52.067');
/*!40000 ALTER TABLE `employees` ENABLE KEYS */;
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

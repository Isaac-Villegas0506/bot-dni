-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 04-06-2026 a las 04:38:16
-- Versión del servidor: 10.4.32-MariaDB
-- Versión de PHP: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de datos: `sigae`
--

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `profesores`
--

CREATE TABLE `profesores` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `tipo_documento` varchar(10) NOT NULL DEFAULT 'DNI',
  `dni` varchar(8) DEFAULT NULL,
  `nombre` varchar(255) NOT NULL,
  `sexo` enum('M','F') NOT NULL DEFAULT 'M',
  `foto` varchar(255) DEFAULT NULL,
  `materia_id` bigint(20) UNSIGNED DEFAULT NULL,
  `celular` varchar(20) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `password` varchar(255) DEFAULT NULL,
  `telegram_id` bigint(20) DEFAULT NULL,
  `direccion` varchar(255) DEFAULT NULL,
  `horario` varchar(255) DEFAULT NULL,
  `turno` enum('Mañana','Tarde') NOT NULL DEFAULT 'Mañana',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `profesores`
--

INSERT INTO `profesores` (`id`, `tipo_documento`, `dni`, `nombre`, `sexo`, `foto`, `materia_id`, `celular`, `email`, `password`, `telegram_id`, `direccion`, `horario`, `turno`, `created_at`, `updated_at`) VALUES
(5, 'DNI', '47114110', 'MAXIMO CANGO ALVAREZ', 'M', NULL, 3, NULL, 'd47114110n@perueduca.edu.pe', '$2y$12$aI0HN/zEZn7qQedFvt9LiOmWv.O.wFsSmxvwHOYPe5GvopPvOf.zG', NULL, NULL, NULL, 'Mañana', '2026-03-23 16:29:03', '2026-03-23 16:29:22'),
(6, 'DNI', '27240613', 'ESTHER LLATAS VALDIVIA', 'F', NULL, 3, NULL, 'd27240613n@perueduca.edu.pe', '$2y$12$nVrszMkV.kxBm/DmEqn1veJCWvHDY0jiI8X2rPLyNyjoDHwmsOXNK', NULL, NULL, NULL, 'Mañana', '2026-03-23 16:30:07', '2026-03-23 16:30:07'),
(7, 'DNI', '16760536', 'ERIKA AROMEZ LLACZA', 'F', NULL, 3, NULL, 'd16760536n@perueduca.edu.pe', '$2y$12$L17QHauiRXxRF2wj1Ru9te2Bc6J31mW.LaNDL2MPDkTW1O9cGmDyS', NULL, NULL, NULL, 'Mañana', '2026-03-23 16:39:37', '2026-03-23 16:49:34'),
(8, 'DNI', '16693289', 'MARIBEL CLEMENCIA LOZADA SILVA', 'F', NULL, 3, NULL, 'd16693289n@perueduca.edu.pe', '$2y$12$6/5BRzKsoIagQO0cF1T.QeTVTI9SWpfXHUWJFLjEX4UmkbNVo8psq', NULL, NULL, NULL, 'Mañana', '2026-03-23 16:49:05', '2026-03-23 16:49:47'),
(9, 'DNI', '26612498', 'ANIBAL RODAS RODAS', 'M', NULL, 3, NULL, 'd26612498n@perueduca.edu.pe', '$2y$12$t7Glkj6wx.4wLtsWwurOY.FtQ583hANojmVHcWKgQpFqfxNO0DZd.', 6944419433, NULL, NULL, 'Mañana', '2026-03-23 16:50:56', '2026-03-27 14:59:43'),
(10, 'DNI', '16579560', 'ARTEMISA VIOLETA CORDOVA CHIRINOS', 'F', NULL, 4, NULL, 'd16579560n@perueduca.edu.pe', '$2y$12$LJ.Sgax0YaDDrbrWyRxKeOBFtMTeJ6fxyoYMiLvt49JMxu.QZ0kTO', NULL, NULL, NULL, 'Mañana', '2026-03-23 16:52:40', '2026-03-23 16:52:40'),
(11, 'DNI', '16646487', 'LILIA ROSANA BOCANEGRA PAREDES', 'F', NULL, 4, NULL, 'd16646487n@perueduca.edu.pe', '$2y$12$yj.V6WeAiACF2SQCyPgNouN8YrQqUCYgiE41UaqZn5QXuIZ9YIxy.', NULL, NULL, NULL, 'Mañana', '2026-03-23 16:54:31', '2026-03-23 16:54:31'),
(12, 'DNI', '16428227', 'MARIA LUZMILA CHAMBERGO SANDOVAL', 'F', NULL, 5, NULL, 'd16428227n@perueduca.edu.pe', '$2y$12$TpgEZp4w7nUYo8H9xQGU6eVtMQTnfB16f/VIHo7dIVq37Lsx5IFIe', NULL, NULL, NULL, 'Mañana', '2026-03-23 16:57:59', '2026-03-23 16:57:59'),
(13, 'DNI', '27437116', 'JORGE BENAVIDES CARRANZA', 'M', NULL, 5, NULL, 'd27437116n@perueduca.edu.pe', '$2y$12$NPxLEtTduqnomhxkeSGN1.rNnphruFCMLjdS65Ne4i/sNFPFht4Xm', 0, NULL, NULL, 'Mañana', '2026-03-23 16:58:48', '2026-03-26 00:20:45'),
(14, 'DNI', '16688036', 'ROCIO DEL PILAR GAMARRA MENDOZA', 'F', NULL, 5, NULL, 'd16688036n@perueduca.edu.pe', '$2y$12$DHS7mghauyFjg4/dE7F2Zunli567a9aRAAmps8P9G9Q0EPyBMYa36', NULL, NULL, NULL, 'Mañana', '2026-03-23 16:59:27', '2026-03-23 16:59:27'),
(15, 'DNI', '42250175', 'LUIS ALBERTO CHAVEZ SANGAY', 'M', NULL, 5, NULL, 'd42250175n@perueduca.edu.pe', '$2y$12$z7vEN5YOcvOstwpfFkrh0O4ys9Xoj9tt6GP0Ovqf8Y/vPVocOEVrK', NULL, NULL, NULL, 'Mañana', '2026-03-23 17:00:10', '2026-03-23 17:00:10'),
(16, 'DNI', '41231089', 'DEYSIN ESMERALDA MEGO SAAVEDRA', 'F', NULL, 5, NULL, 'd41231089n@perueduca.edu.pe', '$2y$12$b8uI.0af.mcIDJkp3DrRZuNQSFV4wZV8yERDXvcsSwoJDQIDIK3k6', NULL, NULL, NULL, 'Mañana', '2026-03-23 17:00:59', '2026-03-23 17:01:16'),
(17, 'DNI', '03701354', 'ROSA AMALIA MORI BUSTAMANTE', 'F', NULL, 5, NULL, 'd03701354n@perueduca.edu.pe', '$2y$12$L9NxR6CKjAdlqb01Je.Uk.UaH/r4RWFHQUEhjSeudu2P3pSweFlwi', NULL, NULL, NULL, 'Mañana', '2026-03-23 17:01:50', '2026-03-23 17:02:06'),
(18, 'DNI', '16468264', 'GRACIELA TARRILLO DAVILA', 'F', NULL, 4, NULL, 'd16468264n@perueduca.edu.pe', '$2y$12$7jc1/R7Wfc.2mT4AGKhy4O7XCLTGEWvC.nh42QuCbmu3O1QlCIY1W', NULL, NULL, NULL, 'Mañana', '2026-03-23 17:04:28', '2026-03-23 17:04:28'),
(19, 'DNI', '26955353', 'REYNA ELIZABETH QUIROZ SÁNCHEZ', 'F', NULL, 6, NULL, 'd26955353n@perueduca.edu.pe', '$2y$12$3VstXDKwbuOvfsWwg1UoG.QZENH5G6mRB.PxM/ckh9ZoerdIBx1fW', NULL, NULL, NULL, 'Mañana', '2026-03-23 17:08:44', '2026-03-23 17:08:44'),
(20, 'DNI', '16766874', 'SEGUNDO ALFONSO MORENO NUÑEZ', 'M', NULL, 6, NULL, 'd16766874n@perueduca.edu.pe', '$2y$12$3..AKN1sqFiz2uCx6gIuMem4R6kitewC3dZ/eyF6g1Bvb0QBVq2wW', NULL, NULL, NULL, 'Mañana', '2026-03-23 17:23:57', '2026-03-23 17:23:57'),
(21, 'DNI', '42501350', 'DELI DUEÑAS DAVILA', 'F', NULL, 6, NULL, 'd42501350n@perueduca.edu.pe', '$2y$12$P6M86ETOdqFux0IR0C780u1AhBPHqt2VmP.aPm.ohUx9sm0ssUlOO', NULL, NULL, NULL, 'Mañana', '2026-03-23 17:27:17', '2026-03-23 17:27:17'),
(22, 'DNI', '16752117', 'MARÍA CECILIA GÓMEZ CABRERA', 'F', NULL, 7, NULL, 'd16752117n@perueduca.edu.pe', '$2y$12$YxLwXOC0CxeYb7Su/1iTd.ccf/sQRUdqxIQRkm07wPIOE7TDcW7SW', NULL, NULL, NULL, 'Mañana', '2026-03-23 17:37:35', '2026-03-23 17:37:35'),
(23, 'DNI', '16699680', 'EDWIN RUBEN BUSTAMANTE CONTRERAS', 'M', NULL, 7, NULL, 'd16699680n@perueduca.edu.pe', '$2y$12$sT3O66nmmt/FcYkemwnaiuNzAqtTL.GwhvdukYEgkVYlTErfs8T8i', NULL, NULL, NULL, 'Mañana', '2026-03-23 17:40:28', '2026-03-23 17:40:28'),
(24, 'DNI', '16478028', 'CARMEN AIDA BALLENA ESCURRA', 'F', NULL, 3, NULL, 'd16478028n@perueduca.edu.pe', '$2y$12$i7R0fxI.PQOK9hPgnw5WC.IIIIkqsa8waSbb5/bClahewHxX63WCO', NULL, NULL, NULL, 'Mañana', '2026-03-23 23:35:20', '2026-03-23 23:35:20'),
(25, 'DNI', '16671467', 'GIOVANNA BETZABETH PERALTA INGA', 'F', NULL, 6, NULL, 'd16671467n@perueduca.edu.pe', '$2y$12$Pa51eNbUXN.KRsqlbtOH1uyU7m66Vw5YEpuqsk0ZE/dRf/GznBfnm', NULL, NULL, NULL, 'Mañana', '2026-03-23 23:36:27', '2026-03-23 23:36:27'),
(26, 'DNI', '16731750', 'CARMEN DEL PILAR BUSTAMANTE MARTINEZ', 'M', NULL, 6, NULL, 'd16731750n@perueduca.edu.pe', '$2y$12$M/iXTM1m5.HO0zLuyU7t/.EIXwFLXu3MCmpnLIopj3uNKn1V6GFpe', NULL, NULL, NULL, 'Mañana', '2026-03-23 23:37:06', '2026-03-23 23:37:06'),
(27, 'DNI', '42192303', 'JUDITH GISSELA TORRES ZUMAETA', 'F', NULL, 7, NULL, 'd42192303n@perueduca.edu.pe', '$2y$12$yG3rM9IoyquZjqcEEey4KuxJ9v5ayTOahEIzg9grVn/dWk/dHFbqq', NULL, NULL, NULL, 'Mañana', '2026-03-23 23:38:26', '2026-03-23 23:38:26'),
(28, 'DNI', '72928277', 'YERFESON ISAAC VILLEGAS DIAZ', 'M', NULL, 5, NULL, 'admin@sigae.edu.pe', '$2y$12$bAeGiE2XIi4rc/uHtIV2Ye85woYai3Y6rwDNrP8AKlryEbxPyp7Uu', NULL, NULL, NULL, 'Tarde', '2026-03-26 00:32:12', '2026-03-26 00:32:12'),
(29, 'DNI', '72928274', 'KARINA LIZBETH RAMIREZ OLIVERA', 'M', NULL, 5, NULL, '72928274@sigae.edu.pe', '$2y$12$U7CIcYRicW7MR4w1fUH3S.8PhpOSGMamumuzE.OKcagTMIpK6kZ92', NULL, NULL, NULL, 'Tarde', '2026-03-26 00:32:36', '2026-03-26 00:32:36'),
(30, 'DNI', '41838852', 'MARISOL YOVANA LOZADA CHERO', 'F', NULL, 12, NULL, 'd41838852n@perueduca.edu.pe', '$2y$12$5RiSRrs1QYC35lpL0bshUOTyl1olD9AiKfzY5tohiPBBnoHcaykjO', NULL, 'P.JOVEN TUPAC AMARU MZ.A LT.28', NULL, 'Mañana', '2026-04-08 16:36:17', '2026-04-08 16:36:17'),
(31, 'DNI', '26633263', 'NANCY CECILIA ORTEGA MESTANZA', 'F', NULL, 12, NULL, 'd26633263n@perueduca.edu.pe', '$2y$12$Fg8n9hGQJspb06Y7FrAQ6erbuH78EDbpigv6nQtKi5IOIOyM1Zv/a', NULL, 'CALLE JAEN 237 2DO PISO URB. QUIÑONES', NULL, 'Mañana', '2026-04-08 16:38:14', '2026-04-08 16:38:14'),
(32, 'DNI', '16556391', 'CESAR AUGUSTO REYES SALAZAR', 'M', NULL, 12, NULL, 'd16556391n@perueduca.edu.pe', '$2y$12$xPWaQJFNAqwT4DjdXYAprOfMSr5qXyHJL8tiklmWWTqUgAKNteNCu', NULL, 'CARLOS CASTAÑEDA 502 P.J JOSE SANTOS CHOCANO', NULL, 'Mañana', '2026-04-08 16:39:53', '2026-04-08 16:39:53'),
(33, 'DNI', '16476985', 'ROSA ELIZABETH FERNANDEZ CHEVEZ', 'M', NULL, 11, NULL, 'd16476985n@perueduca.edu.pe', '$2y$12$jRoofS2h.YrRoH8hTxETKeZTxp8VQ1n61G7W4tlxJGu8SOW7S2BvG', NULL, 'PSJ.ALVA COLLANTES 155 URB.VILLARREAL', NULL, 'Mañana', '2026-04-08 16:42:56', '2026-04-08 16:42:56'),
(34, 'DNI', '16782039', 'ALICIA MARIBEL QUIROZ GROSSO', 'F', NULL, 11, NULL, 'd16782039n@perueduca.edu.pe', '$2y$12$y1Ebv5FJ5I7bMM8WXvVN/u6t.0MfQL8mp5eP3JexieHxLXicuS3fW', NULL, 'CALLE INCANATO 580', NULL, 'Mañana', '2026-04-08 16:44:29', '2026-04-08 16:44:29'),
(35, 'DNI', '16662943', 'MARITZA RODRIGUEZ CUZMA', 'F', NULL, 10, NULL, 'd16662943n@perueduca.edu.pe', '$2y$12$6Ytupqc.4iPhgJifTrvDu./lczoWjp5/CNi4XrRccZRQWTXAhz/B.', NULL, 'CALLE CUBA MZ. O LT. 06 C.P.M. LA UNION II SECTOR', NULL, 'Mañana', '2026-04-08 16:46:11', '2026-04-08 16:46:11'),
(36, 'DNI', '16672023', 'PETRONILA LILIANA NOBLECILLA CALDERON', 'F', NULL, 10, NULL, 'd16672023n@perueduca.edu.pe', '$2y$12$2kYZAWXkz.qkvU4jCQa1nucaMsPOPin5RC436D4pTlZAIWUEwo9pq', NULL, 'CHICLAYO 225 LOPEZ ALBUJAR SECTOR II', NULL, 'Mañana', '2026-04-08 16:48:14', '2026-04-08 16:48:14'),
(37, 'DNI', '16621014', 'EULER ESTEBAN ASENJO ALARCON', 'M', NULL, 8, NULL, 'd16621014n@perueduca.edu.pe', '$2y$12$rDjPXUVZeMSXr2G3BOaz6.33d7pLWXZMsT2/mA7/0b3KliCWFE4Be', NULL, 'CALLE LOS ROSALES 179', NULL, 'Mañana', '2026-04-08 16:50:45', '2026-04-08 17:14:19'),
(38, 'DNI', '16665404', 'NORMA MERCEDES GONZALES TORRES', 'F', NULL, 9, NULL, 'd16665404n@perueduca.edu.pe', '$2y$12$PL6e9wVjRGPLjsL8I6X1GeFJiOC92AL8bCQBaOLoXiIiq767XZdFG', NULL, 'CALLE PEDRO RUIZ GALLO 27', NULL, 'Mañana', '2026-04-08 16:53:03', '2026-04-08 16:53:03'),
(39, 'DNI', '16644619', 'RICARDO ROSENDO GUERRERO PASAPERA', 'M', NULL, 8, NULL, 'd16644619n@perueduca.edu.pe', '$2y$12$qyZNR9ZsgoIuT7AmpdjV5OznM3RC5sPdybcQvUlEkcV9zbYVHxdTy', NULL, 'CALLE ELIAS AGUIRRE 1124', NULL, 'Mañana', '2026-04-08 16:54:48', '2026-04-08 16:54:48'),
(40, 'DNI', '42649044', 'MARCO ARMANDO RAMIREZ TENORIO', 'M', NULL, 7, NULL, 'd42649044n@perueduca.edu.pe', '$2y$12$f.ShDscIF.v2Bk328uYGyux2MkbzdJkhVb1hRWDngo/J/0ifXYBhq', NULL, 'CALLE PROCERES 874 URB.LA TINA', NULL, 'Mañana', '2026-04-08 17:00:17', '2026-04-08 17:00:17'),
(41, 'DNI', '16502975', 'ELIA ROSA MORALES GUEVARA', 'F', NULL, 9, NULL, 'd16502975n@perueduca.edu.pe', '$2y$12$Ja4alsi7dPh4RKNj/8Y7huOL9AWjqmRTq0ea56Lmnx7tbLFDnibRC', NULL, 'AV.SAENZ PEÑA 1696', NULL, 'Mañana', '2026-04-08 17:02:12', '2026-04-08 17:02:12'),
(42, 'DNI', '72182818', 'ANTHONY JESUS LASTRA VELARDE', 'M', NULL, 11, NULL, 'q@perueduca.edu.pe', '$2y$12$dDqPAItM8.N2aMfzerAWL.jJGEUHQV6bPHEkNjK21FS0BB/MlstT2', NULL, NULL, NULL, 'Mañana', '2026-05-07 18:49:19', '2026-05-07 19:36:12');

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `profesores`
--
ALTER TABLE `profesores`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `profesores_email_unique` (`email`),
  ADD UNIQUE KEY `profesores_telegram_id_unique` (`telegram_id`),
  ADD KEY `profesores_materia_id_foreign` (`materia_id`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `profesores`
--
ALTER TABLE `profesores`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=43;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `profesores`
--
ALTER TABLE `profesores`
  ADD CONSTRAINT `profesores_materia_id_foreign` FOREIGN KEY (`materia_id`) REFERENCES `materias` (`id`) ON DELETE SET NULL;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;

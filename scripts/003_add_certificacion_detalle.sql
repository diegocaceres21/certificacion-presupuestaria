START TRANSACTION;

CREATE TABLE IF NOT EXISTS `certificacion_cuenta_detalle` (
  `id` CHAR(36) NOT NULL,
  `id_certificacion` CHAR(36) NOT NULL,
  `id_cuenta_contable` CHAR(36) NOT NULL,
  `monto` DECIMAL(15,2) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_certificacion_cuenta` (`id_certificacion`, `id_cuenta_contable`),
  KEY `idx_det_certificacion` (`id_certificacion`),
  KEY `idx_det_cuenta` (`id_cuenta_contable`),
  CONSTRAINT `fk_det_certificacion` FOREIGN KEY (`id_certificacion`) REFERENCES `certificacion` (`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_det_cuenta` FOREIGN KEY (`id_cuenta_contable`) REFERENCES `cuenta_contable` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO certificacion_cuenta_detalle (id, id_certificacion, id_cuenta_contable, monto, created_at, updated_at)
SELECT UUID(), c.id, c.id_cuenta_contable, c.monto_total, c.created_at, c.updated_at
FROM certificacion c
LEFT JOIN certificacion_cuenta_detalle d
  ON d.id_certificacion = c.id AND d.id_cuenta_contable = c.id_cuenta_contable
WHERE d.id IS NULL;

COMMIT;

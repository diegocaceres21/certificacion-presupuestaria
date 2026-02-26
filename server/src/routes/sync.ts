import { Router, Request, Response } from 'express';
import { getPool, RowDataPacket } from '../db';
import { authMiddleware } from '../middleware';

const router = Router();
router.use(authMiddleware);

/**
 * POST /api/sync/pull
 * Client sends { last_sync?: ISO timestamp } and receives catalog data
 * (always full) plus transactional data (incremental if last_sync provided).
 *
 * Response:
 * {
 *   server_time: string,
 *   catalogs: {
 *     dependencias, tipo_cuentas, unidades, cuentas_contables,
 *     proyectos, usuarios, perfiles
 *   },
 *   certificaciones: [...],
 *   modificaciones: [...],
 *   observaciones: [...]
 * }
 */
router.post('/pull', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const lastSync = req.body.last_sync as string | undefined;

    const [[{ now: serverTime }]] = await pool.query<RowDataPacket[]>('SELECT NOW() as now');

    // Catalogs — always return full, raw table data
    const [dependencias] = await pool.query<RowDataPacket[]>(
      'SELECT id, codigo, dependencia, activo FROM dependencia ORDER BY codigo'
    );
    const [tipoCuentas] = await pool.query<RowDataPacket[]>(
      'SELECT id, tipo, activo FROM tipo_cuenta ORDER BY tipo'
    );
    const [unidades] = await pool.query<RowDataPacket[]>(
      'SELECT id, id_dependencia, codigo, unidad, activo FROM unidad_organizacional ORDER BY codigo'
    );
    const [cuentasContables] = await pool.query<RowDataPacket[]>(
      'SELECT id, id_tipo_cuenta, id_cuenta_padre, codigo, cuenta, nivel, activo FROM cuenta_contable ORDER BY codigo'
    );
    const [proyectos] = await pool.query<RowDataPacket[]>(
      'SELECT id, nombre, descripcion, pei, activo FROM proyecto ORDER BY nombre'
    );
    // Include password hash for offline login support
    const [usuarios] = await pool.query<RowDataPacket[]>(
      'SELECT id, usuario, password, activo FROM usuario'
    );
    const [perfiles] = await pool.query<RowDataPacket[]>(
      'SELECT id, id_usuario, nombre_completo, cargo, rol FROM perfil'
    );

    // Certificaciones — incremental if last_sync provided
    let certQuery = 'SELECT id, id_unidad, id_cuenta_contable, id_proyecto, generado_por, concepto, nro_certificacion, anio_certificacion, fecha_certificacion, monto_total, comentario, created_at, updated_at, deleted_at FROM certificacion';
    const certParams: string[] = [];
    if (lastSync) {
      certQuery += ' WHERE updated_at > ?';
      certParams.push(lastSync);
    }
    certQuery += ' ORDER BY anio_certificacion DESC, nro_certificacion DESC';
    const [certificaciones] = await pool.query<RowDataPacket[]>(certQuery, certParams);

    // Modificaciones — incremental
    let modQuery = 'SELECT id, id_certificacion, modificado_por, monto_antiguo, monto_nuevo, concepto_antiguo, concepto_nuevo, fecha_hora, comentario, created_at, updated_at, deleted_at FROM modificacion';
    const modParams: string[] = [];
    if (lastSync) {
      modQuery += ' WHERE created_at > ?';
      modParams.push(lastSync);
    }
    modQuery += ' ORDER BY fecha_hora DESC';
    const [modificaciones] = await pool.query<RowDataPacket[]>(modQuery, modParams);

    // Observaciones — incremental
    let obsQuery = 'SELECT id, id_certificacion, creado_por, comentario, created_at FROM observacion_certificacion';
    const obsParams: string[] = [];
    if (lastSync) {
      obsQuery += ' WHERE created_at > ?';
      obsParams.push(lastSync);
    }
    obsQuery += ' ORDER BY created_at DESC';
    const [observaciones] = await pool.query<RowDataPacket[]>(obsQuery, obsParams);

    res.json({
      server_time: serverTime,
      catalogs: {
        dependencias,
        tipo_cuentas: tipoCuentas,
        unidades,
        cuentas_contables: cuentasContables,
        proyectos,
        usuarios,
        perfiles,
      },
      certificaciones,
      modificaciones,
      observaciones,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/sync/push
 * Client sends raw rows of pending local changes.
 * Server upserts them and returns accepted IDs and conflicts.
 *
 * Body:
 * {
 *   certificaciones: [{ id, id_unidad, ..., deleted_at? }],
 *   modificaciones: [{ id, id_certificacion, ... }],
 *   observaciones: [{ id, id_certificacion, creado_por, comentario, created_at }]
 * }
 *
 * Response:
 * {
 *   accepted: string[],          // IDs that were accepted
 *   conflicts: [{ id, table_name, server_version, message }]
 * }
 */
router.post('/push', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const accepted: string[] = [];
    const conflicts: Array<{ id: string; table_name: string; server_version: any; message: string }> = [];

    // Process certificaciones
    const certs = req.body.certificaciones || [];
    for (const row of certs) {
      try {
        // Check if it exists on server
        const [existing] = await pool.query<RowDataPacket[]>(
          'SELECT id, updated_at FROM certificacion WHERE id = ?',
          [row.id]
        );

        if (existing.length === 0) {
          // INSERT new certificacion
          await pool.query(
            `INSERT INTO certificacion (id, id_unidad, id_cuenta_contable, id_proyecto, generado_por, concepto, nro_certificacion, anio_certificacion, fecha_certificacion, monto_total, comentario, created_at, deleted_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [row.id, row.id_unidad, row.id_cuenta_contable, row.id_proyecto || null, row.generado_por, row.concepto, row.nro_certificacion, row.anio_certificacion, row.fecha_certificacion, row.monto_total, row.comentario || null, row.created_at, row.deleted_at || null]
          );
          accepted.push(row.id);
        } else {
          // Check for conflict: if server was updated after client's version
          const serverUpdatedAt = new Date(existing[0].updated_at).getTime();
          const clientUpdatedAt = new Date(row.updated_at).getTime();

          if (serverUpdatedAt > clientUpdatedAt) {
            // Conflict — server has newer version
            const [serverRow] = await pool.query<RowDataPacket[]>(
              'SELECT * FROM certificacion WHERE id = ?',
              [row.id]
            );
            conflicts.push({
              id: row.id,
              table_name: 'certificacion',
              server_version: serverRow[0],
              message: 'Server has a newer version',
            });
          } else {
            // Safe to update
            if (row.deleted_at) {
              await pool.query(
                'UPDATE certificacion SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL',
                [row.id]
              );
            } else {
              await pool.query(
                'UPDATE certificacion SET id_unidad = ?, id_cuenta_contable = ?, id_proyecto = ?, concepto = ?, monto_total = ?, comentario = ? WHERE id = ?',
                [row.id_unidad, row.id_cuenta_contable, row.id_proyecto || null, row.concepto, row.monto_total, row.comentario || null, row.id]
              );
            }
            accepted.push(row.id);
          }
        }
      } catch (err: any) {
        conflicts.push({ id: row.id, table_name: 'certificacion', server_version: {}, message: err.message });
      }
    }

    // Process modificaciones
    const mods = req.body.modificaciones || [];
    for (const row of mods) {
      try {
        await pool.query(
          `INSERT INTO modificacion (id, id_certificacion, modificado_por, monto_antiguo, monto_nuevo, concepto_antiguo, concepto_nuevo, fecha_hora, comentario, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             monto_antiguo = VALUES(monto_antiguo), monto_nuevo = VALUES(monto_nuevo),
             concepto_antiguo = VALUES(concepto_antiguo), concepto_nuevo = VALUES(concepto_nuevo),
             comentario = VALUES(comentario)`,
          [row.id, row.id_certificacion, row.modificado_por, row.monto_antiguo || null, row.monto_nuevo || null, row.concepto_antiguo || null, row.concepto_nuevo || null, row.fecha_hora, row.comentario || null, row.created_at]
        );
        accepted.push(row.id);
      } catch (err: any) {
        conflicts.push({ id: row.id, table_name: 'modificacion', server_version: {}, message: err.message });
      }
    }

    // Process observaciones
    const obs = req.body.observaciones || [];
    for (const row of obs) {
      try {
        await pool.query(
          `INSERT INTO observacion_certificacion (id, id_certificacion, creado_por, comentario, created_at)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE comentario = VALUES(comentario)`,
          [row.id, row.id_certificacion, row.creado_por, row.comentario, row.created_at]
        );
        accepted.push(row.id);
      } catch (err: any) {
        conflicts.push({ id: row.id, table_name: 'observacion_certificacion', server_version: {}, message: err.message });
      }
    }

    res.json({ accepted, conflicts });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

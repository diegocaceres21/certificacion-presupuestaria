import { Router, Request, Response } from 'express';
import { getPool, RowDataPacket } from '../db';
import { authMiddleware } from '../middleware';

const router = Router();
router.use(authMiddleware);

function buildDateFilter(query: Request['query']): { conditions: string; params: string[] } {
  const conditions: string[] = [];
  const params: string[] = [];

  if (query.fecha_desde) {
    conditions.push("AND c.fecha_certificacion >= ?");
    params.push(query.fecha_desde as string);
  }
  if (query.fecha_hasta) {
    conditions.push("AND c.fecha_certificacion <= ?");
    params.push(query.fecha_hasta as string);
  }
  if (query.mes) {
    conditions.push(`AND MONTH(c.fecha_certificacion) = ?`);
    params.push(query.mes as string);
  }
  if (query.anio) {
    conditions.push(`AND YEAR(c.fecha_certificacion) = ?`);
    params.push(query.anio as string);
  }

  return { conditions: conditions.join(' '), params };
}

// GET /api/reportes
router.get('/', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const { conditions, params } = buildDateFilter(req.query);

    // Summary
    const [resumenRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total_certificaciones, SUM(monto_total) as monto_total
       FROM certificacion c WHERE deleted_at IS NULL ${conditions}`,
      params
    );

    // By unit
    const [porUnidadRows] = await pool.query<RowDataPacket[]>(
      `SELECT uo.codigo as unidad_codigo, uo.unidad as unidad_nombre,
              COUNT(*) as total_certificaciones, SUM(c.monto_total) as monto_total
       FROM certificacion c
       INNER JOIN unidad_organizacional uo ON c.id_unidad = uo.id
       WHERE c.deleted_at IS NULL ${conditions}
       GROUP BY uo.id, uo.codigo, uo.unidad
       ORDER BY monto_total DESC`,
      params
    );

    // By account
    const [porCuentaRows] = await pool.query<RowDataPacket[]>(
      `SELECT cc.codigo as cuenta_codigo, cc.cuenta as cuenta_nombre, cc.nivel,
              COUNT(*) as total_certificaciones, SUM(c.monto_total) as monto_total
       FROM certificacion c
       INNER JOIN cuenta_contable cc ON c.id_cuenta_contable = cc.id
       WHERE c.deleted_at IS NULL ${conditions}
       GROUP BY cc.id, cc.codigo, cc.cuenta, cc.nivel
       ORDER BY cc.codigo`,
      params
    );

    // By project
    const [porProyectoRows] = await pool.query<RowDataPacket[]>(
      `SELECT p.nombre as proyecto_nombre,
              COUNT(*) as total_certificaciones, SUM(c.monto_total) as monto_total
       FROM certificacion c
       INNER JOIN proyecto p ON c.id_proyecto = p.id
       WHERE c.deleted_at IS NULL AND c.id_proyecto IS NOT NULL ${conditions}
       GROUP BY p.id, p.nombre
       ORDER BY monto_total DESC`,
      params
    );

    // Hierarchical account report
    const [porCuentaJerarquicoRows] = await pool.query<RowDataPacket[]>(
      `SELECT cc.id as cuenta_id, cc.codigo as cuenta_codigo, cc.cuenta as cuenta_nombre,
              cc.nivel, cc.id_cuenta_padre,
              COALESCE(agg.total_certificaciones, 0) as total_certificaciones,
              agg.monto_total
       FROM cuenta_contable cc
       LEFT JOIN (
         SELECT c.id_cuenta_contable,
                COUNT(*) as total_certificaciones,
                SUM(c.monto_total) as monto_total
         FROM certificacion c
         WHERE c.deleted_at IS NULL ${conditions}
         GROUP BY c.id_cuenta_contable
       ) agg ON agg.id_cuenta_contable = cc.id
       WHERE cc.activo = 1
       ORDER BY cc.codigo`,
      params
    );

    res.json({
      resumen: resumenRows[0],
      por_unidad: porUnidadRows,
      por_cuenta: porCuentaRows,
      por_proyecto: porProyectoRows,
      por_cuenta_jerarquico: porCuentaJerarquicoRows,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

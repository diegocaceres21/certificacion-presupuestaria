import { Router, Request, Response } from 'express';
import { getPool, RowDataPacket } from '../db';
import { authMiddleware } from '../middleware';

const router = Router();
router.use(authMiddleware);

// GET /api/modificaciones/:idCertificacion
router.get('/:idCertificacion', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
        m.id, m.id_certificacion,
        pf.nombre_completo as modificado_por_nombre,
        m.monto_antiguo, m.monto_nuevo,
        m.concepto_antiguo, m.concepto_nuevo,
        m.fecha_hora, m.comentario
      FROM modificacion m
      INNER JOIN usuario u ON m.modificado_por = u.id
      INNER JOIN perfil pf ON pf.id_usuario = u.id
      WHERE m.id_certificacion = ? AND m.deleted_at IS NULL
      ORDER BY m.fecha_hora DESC`,
      [req.params.idCertificacion]
    );
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

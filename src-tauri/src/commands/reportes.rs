use sqlx::SqlitePool;
use tauri::State;

use crate::auth;
use crate::models::*;

#[tauri::command]
pub async fn obtener_reporte(
    pool: State<'_, SqlitePool>,
    token: String,
    filtros: Option<FiltrosReporte>,
) -> Result<ReporteCompleto, String> {
    let _claims = auth::validate_token(&token)
        .map_err(|e| format!("Token inválido: {}", e))?;

    let filtros = filtros.unwrap_or_default();
    let where_clause = build_date_filter(&filtros);

    // Summary
    let resumen_query = format!(
        "SELECT COUNT(*) as total_certificaciones, CAST(SUM(monto_total) AS TEXT) as monto_total
         FROM certificacion WHERE deleted_at IS NULL {}",
        where_clause
    );
    let resumen = sqlx::query_as::<_, ReporteResumen>(&resumen_query)
        .fetch_one(pool.inner())
        .await
        .map_err(|e| format!("Error obteniendo resumen: {}", e))?;

    // By unit
    let por_unidad_query = format!(
        "SELECT uo.codigo as unidad_codigo, uo.unidad as unidad_nombre,
                COUNT(*) as total_certificaciones, CAST(SUM(c.monto_total) AS TEXT) as monto_total
         FROM certificacion c
         INNER JOIN unidad_organizacional uo ON c.id_unidad = uo.id
         WHERE c.deleted_at IS NULL {}
         GROUP BY uo.id, uo.codigo, uo.unidad
         ORDER BY CAST(SUM(c.monto_total) AS REAL) DESC",
        where_clause
    );
    let por_unidad = sqlx::query_as::<_, ReportePorUnidad>(&por_unidad_query)
        .fetch_all(pool.inner())
        .await
        .map_err(|e| format!("Error obteniendo reporte por unidad: {}", e))?;

    // By account
    let por_cuenta_query = format!(
        "SELECT cc.codigo as cuenta_codigo, cc.cuenta as cuenta_nombre, cc.nivel,
                COUNT(*) as total_certificaciones, CAST(SUM(c.monto_total) AS TEXT) as monto_total
         FROM certificacion c
         INNER JOIN cuenta_contable cc ON c.id_cuenta_contable = cc.id
         WHERE c.deleted_at IS NULL {}
         GROUP BY cc.id, cc.codigo, cc.cuenta, cc.nivel
         ORDER BY cc.codigo",
        where_clause
    );
    let por_cuenta = sqlx::query_as::<_, ReportePorCuenta>(&por_cuenta_query)
        .fetch_all(pool.inner())
        .await
        .map_err(|e| format!("Error obteniendo reporte por cuenta: {}", e))?;

    // By project
    let por_proyecto_query = format!(
        "SELECT p.nombre as proyecto_nombre,
                COUNT(*) as total_certificaciones, CAST(SUM(c.monto_total) AS TEXT) as monto_total
         FROM certificacion c
         INNER JOIN proyecto p ON c.id_proyecto = p.id
         WHERE c.deleted_at IS NULL AND c.id_proyecto IS NOT NULL {}
         GROUP BY p.id, p.nombre
         ORDER BY CAST(SUM(c.monto_total) AS REAL) DESC",
        where_clause
    );
    let por_proyecto = sqlx::query_as::<_, ReportePorProyecto>(&por_proyecto_query)
        .fetch_all(pool.inner())
        .await
        .map_err(|e| format!("Error obteniendo reporte por proyecto: {}", e))?;

    // Hierarchical account report: all accounts + cert counts for leaves (nivel 5)
    let por_cuenta_jerarquico_query = format!(
        "SELECT cc.id as cuenta_id, cc.codigo as cuenta_codigo, cc.cuenta as cuenta_nombre,
                cc.nivel, cc.id_cuenta_padre,
                COALESCE(agg.total_certificaciones, 0) as total_certificaciones,
                agg.monto_total
         FROM cuenta_contable cc
         LEFT JOIN (
           SELECT c.id_cuenta_contable,
                  COUNT(*) as total_certificaciones,
                  CAST(SUM(c.monto_total) AS TEXT) as monto_total
           FROM certificacion c
           WHERE c.deleted_at IS NULL {}
           GROUP BY c.id_cuenta_contable
         ) agg ON agg.id_cuenta_contable = cc.id
         WHERE cc.activo = 1
         ORDER BY cc.codigo",
        where_clause
    );
    let por_cuenta_jerarquico = sqlx::query_as::<_, ReporteCuentaJerarquico>(&por_cuenta_jerarquico_query)
        .fetch_all(pool.inner())
        .await
        .map_err(|e| format!("Error obteniendo reporte jerárquico: {}", e))?;

    Ok(ReporteCompleto {
        resumen,
        por_unidad,
        por_cuenta,
        por_proyecto,
        por_cuenta_jerarquico,
    })
}

fn build_date_filter(filtros: &FiltrosReporte) -> String {
    let mut conditions = Vec::new();

    if let Some(ref fecha_desde) = filtros.fecha_desde {
        conditions.push(format!("AND c.fecha_certificacion >= '{}'", fecha_desde));
    }
    if let Some(ref fecha_hasta) = filtros.fecha_hasta {
        conditions.push(format!("AND c.fecha_certificacion <= '{}'", fecha_hasta));
    }
    if let Some(mes) = filtros.mes {
        conditions.push(format!("AND CAST(strftime('%m', c.fecha_certificacion) AS INTEGER) = {}", mes));
    }
    if let Some(anio) = filtros.anio {
        conditions.push(format!("AND CAST(strftime('%Y', c.fecha_certificacion) AS INTEGER) = {}", anio));
    }

    conditions.join(" ")
}

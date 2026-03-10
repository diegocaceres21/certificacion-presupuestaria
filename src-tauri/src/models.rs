use chrono::{NaiveDate, NaiveDateTime};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

// ============================================
// Serde helpers — accept string OR number from MySQL
// ============================================
/// MySQL with `decimalNumbers: true` can return DECIMAL columns as JS numbers
/// even when wrapped in CAST(... AS CHAR). These helpers accept both forms.
pub mod serde_helpers {
    use serde::de::{self, Visitor};
    use serde::Deserializer;
    use std::fmt;

    struct StringOrNumberVisitor;
    impl<'de> Visitor<'de> for StringOrNumberVisitor {
        type Value = String;
        fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
            write!(f, "a string or number")
        }
        fn visit_str<E: de::Error>(self, v: &str) -> Result<String, E> { Ok(v.to_string()) }
        fn visit_string<E: de::Error>(self, v: String) -> Result<String, E> { Ok(v) }
        fn visit_i64<E: de::Error>(self, v: i64) -> Result<String, E> { Ok(v.to_string()) }
        fn visit_u64<E: de::Error>(self, v: u64) -> Result<String, E> { Ok(v.to_string()) }
        fn visit_f64<E: de::Error>(self, v: f64) -> Result<String, E> {
            // Format without unnecessary trailing zeros (e.g. 1000.50 not 1000.5000000001)
            Ok(format!("{:.2}", v))
        }
    }

    pub fn de_string_or_number<'de, D: Deserializer<'de>>(d: D) -> Result<String, D::Error> {
        d.deserialize_any(StringOrNumberVisitor)
    }

    struct OptStringOrNumberVisitor;
    impl<'de> Visitor<'de> for OptStringOrNumberVisitor {
        type Value = Option<String>;
        fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
            write!(f, "null, a string, or a number")
        }
        fn visit_none<E: de::Error>(self) -> Result<Option<String>, E> { Ok(None) }
        fn visit_unit<E: de::Error>(self) -> Result<Option<String>, E> { Ok(None) }
        fn visit_str<E: de::Error>(self, v: &str) -> Result<Option<String>, E> { Ok(Some(v.to_string())) }
        fn visit_string<E: de::Error>(self, v: String) -> Result<Option<String>, E> { Ok(Some(v)) }
        fn visit_i64<E: de::Error>(self, v: i64) -> Result<Option<String>, E> { Ok(Some(v.to_string())) }
        fn visit_u64<E: de::Error>(self, v: u64) -> Result<Option<String>, E> { Ok(Some(v.to_string())) }
        fn visit_f64<E: de::Error>(self, v: f64) -> Result<Option<String>, E> { Ok(Some(format!("{:.2}", v))) }
    }

    pub fn de_opt_string_or_number<'de, D: Deserializer<'de>>(d: D) -> Result<Option<String>, D::Error> {
        d.deserialize_any(OptStringOrNumberVisitor)
    }

    /// MySQL BOOLEAN is TINYINT(1) — arrives as 0 or 1, not true/false.
    pub fn de_bool_from_int<'de, D: Deserializer<'de>>(d: D) -> Result<bool, D::Error> {
        struct BoolVisitor;
        impl<'de> Visitor<'de> for BoolVisitor {
            type Value = bool;
            fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
                write!(f, "a boolean or 0/1 integer")
            }
            fn visit_bool<E: de::Error>(self, v: bool) -> Result<bool, E> { Ok(v) }
            fn visit_i64<E: de::Error>(self, v: i64) -> Result<bool, E> { Ok(v != 0) }
            fn visit_u64<E: de::Error>(self, v: u64) -> Result<bool, E> { Ok(v != 0) }
        }
        d.deserialize_any(BoolVisitor)
    }
}

// ============================================
// App Config (managed state)
// ============================================
#[derive(Debug, Clone)]
pub struct ApiConfig {
    pub base_url: Option<String>,
}

/// Shared auth token for sync requests.
/// Updated on login/logout from the frontend.
pub struct AuthToken {
    pub token: std::sync::Mutex<Option<String>>,
}

// ============================================
// Dependencia
// ============================================
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Dependencia {
    pub id: String,
    pub codigo: String,
    pub dependencia: String,
    pub activo: bool,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Deserialize)]
pub struct CrearDependencia {
    pub codigo: String,
    pub dependencia: String,
}

#[derive(Debug, Deserialize)]
pub struct EditarDependencia {
    pub codigo: Option<String>,
    pub dependencia: Option<String>,
    pub activo: Option<bool>,
}

// ============================================
// Unidad Organizacional
// ============================================
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct UnidadOrganizacional {
    pub id: String,
    pub id_dependencia: String,
    pub codigo: i32,
    pub unidad: String,
    pub activo: bool,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct UnidadConDependencia {
    pub id: String,
    pub id_dependencia: String,
    pub codigo: i32,
    pub unidad: String,
    pub activo: bool,
    pub dependencia_codigo: String,
    pub dependencia_nombre: String,
}

#[derive(Debug, Deserialize)]
pub struct CrearUnidad {
    pub id_dependencia: String,
    pub codigo: i32,
    pub unidad: String,
}

#[derive(Debug, Deserialize)]
pub struct EditarUnidad {
    pub id_dependencia: Option<String>,
    pub codigo: Option<i32>,
    pub unidad: Option<String>,
    pub activo: Option<bool>,
}

// ============================================
// Tipo Cuenta
// ============================================
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct TipoCuenta {
    pub id: String,
    pub tipo: String,
    pub activo: bool,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Deserialize)]
pub struct CrearTipoCuenta {
    pub tipo: String,
}

#[derive(Debug, Deserialize)]
pub struct EditarTipoCuenta {
    pub tipo: Option<String>,
    pub activo: Option<bool>,
}

// ============================================
// Cuenta Contable
// ============================================
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CuentaContable {
    pub id: String,
    pub id_tipo_cuenta: String,
    pub id_cuenta_padre: Option<String>,
    pub codigo: String,
    pub cuenta: String,
    pub nivel: i32,
    pub activo: bool,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CuentaContableDetalle {
    pub id: String,
    pub id_tipo_cuenta: String,
    pub id_cuenta_padre: Option<String>,
    pub codigo: String,
    pub cuenta: String,
    pub nivel: i32,
    pub activo: bool,
    pub tipo_cuenta_nombre: String,
    pub cuenta_padre_codigo: Option<String>,
    pub cuenta_padre_nombre: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CrearCuenta {
    pub id_tipo_cuenta: String,
    pub id_cuenta_padre: Option<String>,
    pub codigo: String,
    pub cuenta: String,
}

#[derive(Debug, Deserialize)]
pub struct EditarCuenta {
    pub id_tipo_cuenta: Option<String>,
    pub id_cuenta_padre: Option<Option<String>>,
    pub codigo: Option<String>,
    pub cuenta: Option<String>,
    pub activo: Option<bool>,
}

// ============================================
// Proyecto
// ============================================
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Proyecto {
    pub id: String,
    pub nombre: String,
    pub descripcion: Option<String>,
    pub pei: Option<String>,
    pub activo: bool,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Deserialize)]
pub struct CrearProyecto {
    pub nombre: String,
    pub descripcion: Option<String>,
    pub pei: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct EditarProyecto {
    pub nombre: Option<String>,
    pub descripcion: Option<String>,
    pub pei: Option<String>,
    pub activo: Option<bool>,
}

// ============================================
// Usuario
// ============================================
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Usuario {
    pub id: String,
    pub usuario: String,
    #[serde(skip_serializing)]
    pub password: String,
    pub activo: bool,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Perfil {
    pub id: String,
    pub id_usuario: String,
    pub nombre_completo: String,
    pub cargo: String,
    pub rol: String,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct UsuarioConPerfil {
    pub id: String,
    pub usuario: String,
    pub activo: bool,
    pub nombre_completo: String,
    pub cargo: String,
    pub rol: String,
}

#[derive(Debug, Deserialize)]
pub struct CrearUsuario {
    pub usuario: String,
    pub password: String,
    pub nombre_completo: String,
    pub cargo: String,
    pub rol: String,
}

#[derive(Debug, Deserialize)]
pub struct EditarUsuario {
    pub nombre_completo: Option<String>,
    pub cargo: Option<String>,
    pub rol: Option<String>,
    pub activo: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CambiarPassword {
    pub password_actual: Option<String>,
    pub password_nueva: String,
}

// ============================================
// Auth
// ============================================
#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub usuario: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct LoginResponse {
    pub token: String,
    pub user: UserInfo,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserInfo {
    pub id: String,
    pub usuario: String,
    pub nombre_completo: String,
    pub cargo: String,
    pub rol: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub rol: String,
    pub nombre: String,
    pub exp: usize,
}

// ============================================
// Certificacion
// ============================================
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Certificacion {
    pub id: String,
    pub id_unidad: String,
    pub id_cuenta_contable: String,
    pub id_proyecto: Option<String>,
    pub generado_por: String,
    pub concepto: String,
    pub nro_certificacion: i32,
    pub anio_certificacion: i32,
    pub fecha_certificacion: NaiveDate,
    pub monto_total: String,
    pub comentario: Option<String>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
    pub deleted_at: Option<NaiveDateTime>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CertificacionDetalle {
    pub id: String,
    pub nro_certificacion: i32,
    pub anio_certificacion: i32,
    pub fecha_certificacion: NaiveDate,
    pub concepto: String,
    pub monto_total: String,
    pub comentario: Option<String>,
    // Unidad
    pub unidad_codigo: i32,
    pub unidad_nombre: String,
    // Cuenta
    pub cuenta_codigo: String,
    pub cuenta_nombre: String,
    // Proyecto
    pub proyecto_nombre: Option<String>,
    pub proyecto_descripcion: Option<String>,
    pub proyecto_pei: Option<String>,
    // Usuario
    pub generado_por_id: String,
    pub generado_por_nombre: String,
    pub generado_por_cargo: String,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
    #[sqlx(default)]
    pub deleted_at: Option<NaiveDateTime>,
}

#[derive(Debug, Deserialize)]
pub struct CrearCertificacion {
    pub id_unidad: String,
    pub id_cuenta_contable: String,
    pub id_proyecto: Option<String>,
    pub concepto: String,
    pub monto_total: String,
    pub comentario: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct EditarCertificacion {
    pub id_unidad: Option<String>,
    pub id_cuenta_contable: Option<String>,
    pub id_proyecto: Option<String>,
    pub concepto: Option<String>,
    pub monto_total: Option<String>,
    pub comentario: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
pub struct FiltrosCertificacion {
    pub id_unidad: Option<Vec<String>>,
    pub id_cuenta_contable: Option<Vec<String>>,
    pub id_proyecto: Option<Vec<String>>,
    pub generado_por: Option<Vec<String>>,
    pub fecha_desde: Option<String>,
    pub fecha_hasta: Option<String>,
    pub busqueda: Option<String>,
    pub mostrar_anuladas: Option<bool>,
}

// ============================================
// Modificacion
// ============================================
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Modificacion {
    pub id: String,
    pub id_certificacion: String,
    pub modificado_por: String,
    pub monto_antiguo: Option<String>,
    pub monto_nuevo: Option<String>,
    pub concepto_antiguo: Option<String>,
    pub concepto_nuevo: Option<String>,
    pub fecha_hora: NaiveDateTime,
    pub comentario: Option<String>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
    pub deleted_at: Option<NaiveDateTime>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ModificacionDetalle {
    pub id: String,
    pub id_certificacion: String,
    pub modificado_por_nombre: String,
    pub monto_antiguo: Option<String>,
    pub monto_nuevo: Option<String>,
    pub concepto_antiguo: Option<String>,
    pub concepto_nuevo: Option<String>,
    pub fecha_hora: NaiveDateTime,
    pub comentario: Option<String>,
}

// ============================================
// Observacion
// ============================================
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Observacion {
    pub id: String,
    pub id_certificacion: String,
    pub creado_por: String,
    pub comentario: String,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ObservacionDetalle {
    pub id: String,
    pub id_certificacion: String,
    pub creado_por_nombre: String,
    pub comentario: String,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Deserialize)]
pub struct CrearObservacion {
    pub id_certificacion: String,
    pub comentario: String,
}

#[derive(Debug, Deserialize)]
pub struct NuevoModificacion {
    pub id_certificacion: String,
    pub monto_antiguo: Option<String>,
    pub monto_nuevo: Option<String>,
    pub concepto_antiguo: Option<String>,
    pub concepto_nuevo: Option<String>,
    pub comentario: Option<String>,
}

// ============================================
// Reportes
// ============================================
#[derive(Debug, Serialize, FromRow)]
pub struct ReporteResumen {
    pub total_certificaciones: i64,
    pub monto_total: Option<String>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct ReportePorUnidad {
    pub unidad_id: String,
    pub unidad_codigo: i32,
    pub unidad_nombre: String,
    pub total_certificaciones: i64,
    pub monto_total: Option<String>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct ReportePorCuenta {
    pub cuenta_id: String,
    pub cuenta_codigo: String,
    pub cuenta_nombre: String,
    pub nivel: i32,
    pub total_certificaciones: i64,
    pub monto_total: Option<String>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct ReportePorProyecto {
    pub proyecto_nombre: String,
    pub total_certificaciones: i64,
    pub monto_total: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
pub struct FiltrosReporte {
    pub fecha_desde: Option<String>,
    pub fecha_hasta: Option<String>,
    pub mes: Option<i32>,
    pub anio: Option<i32>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct ReporteCuentaJerarquico {
    pub cuenta_id: String,
    pub cuenta_codigo: String,
    pub cuenta_nombre: String,
    pub nivel: i32,
    pub id_cuenta_padre: Option<String>,
    pub total_certificaciones: i64,
    pub monto_total: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ReporteCompleto {
    pub resumen: ReporteResumen,
    pub por_unidad: Vec<ReportePorUnidad>,
    pub por_cuenta: Vec<ReportePorCuenta>,
    pub por_proyecto: Vec<ReportePorProyecto>,
    pub por_cuenta_jerarquico: Vec<ReporteCuentaJerarquico>,
}

/// Breakdown of a single unidad: monto per cuenta contable
#[derive(Debug, Serialize, FromRow)]
pub struct DetalleUnidadPorCuenta {
    pub cuenta_codigo: String,
    pub cuenta_nombre: String,
    pub nivel: i32,
    pub total_certificaciones: i64,
    pub monto_total: Option<String>,
}

/// Breakdown of a single cuenta: monto per unidad organizacional
#[derive(Debug, Serialize, FromRow)]
pub struct DetalleCuentaPorUnidad {
    pub unidad_codigo: i32,
    pub unidad_nombre: String,
    pub total_certificaciones: i64,
    pub monto_total: Option<String>,
}

// ============================================
// Sync
// ============================================
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncStatus {
    pub last_sync: Option<String>,
    pub pending_count: i64,
    pub is_online: bool,
}

/// Row returned by the server pull endpoint for certificaciones
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncCertificacionRow {
    pub id: String,
    pub id_unidad: String,
    pub id_cuenta_contable: String,
    pub id_proyecto: Option<String>,
    pub generado_por: String,
    pub concepto: String,
    pub nro_certificacion: i32,
    pub anio_certificacion: i32,
    pub fecha_certificacion: String,
    /// MySQL DECIMAL returned as string OR number depending on driver config.
    #[serde(deserialize_with = "serde_helpers::de_string_or_number")]
    pub monto_total: String,
    pub comentario: Option<String>,
    pub created_at: String,
    #[serde(default)]
    pub updated_at: Option<String>,
    pub deleted_at: Option<String>,
    /// The server's `updated_at` as last seen by the client during pull.
    /// Used by the server push handler to detect genuine conflicts
    /// (another device changed the record since the client last pulled).
    #[serde(default)]
    pub server_updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncModificacionRow {
    pub id: String,
    pub id_certificacion: String,
    pub modificado_por: String,
    /// MySQL DECIMAL nullable — returned as null, string, or number.
    #[serde(default, deserialize_with = "serde_helpers::de_opt_string_or_number")]
    pub monto_antiguo: Option<String>,
    #[serde(default, deserialize_with = "serde_helpers::de_opt_string_or_number")]
    pub monto_nuevo: Option<String>,
    pub concepto_antiguo: Option<String>,
    pub concepto_nuevo: Option<String>,
    pub fecha_hora: String,
    pub comentario: Option<String>,
    pub created_at: String,
    #[serde(default)]
    pub updated_at: Option<String>,
    pub deleted_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncObservacionRow {
    pub id: String,
    pub id_certificacion: String,
    pub creado_por: String,
    pub comentario: String,
    pub created_at: String,
}

/// Catalog rows from server pull
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncDependenciaRow {
    pub id: String,
    pub codigo: String,
    pub dependencia: String,
    #[serde(deserialize_with = "serde_helpers::de_bool_from_int")]
    pub activo: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncTipoCuentaRow {
    pub id: String,
    pub tipo: String,
    #[serde(deserialize_with = "serde_helpers::de_bool_from_int")]
    pub activo: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncUnidadRow {
    pub id: String,
    pub id_dependencia: String,
    pub codigo: i32,
    pub unidad: String,
    #[serde(deserialize_with = "serde_helpers::de_bool_from_int")]
    pub activo: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncCuentaContableRow {
    pub id: String,
    pub id_tipo_cuenta: String,
    pub id_cuenta_padre: Option<String>,
    pub codigo: String,
    pub cuenta: String,
    pub nivel: i32,
    #[serde(deserialize_with = "serde_helpers::de_bool_from_int")]
    pub activo: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncProyectoRow {
    pub id: String,
    pub nombre: String,
    pub descripcion: Option<String>,
    pub pei: Option<String>,
    #[serde(deserialize_with = "serde_helpers::de_bool_from_int")]
    pub activo: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncUsuarioRow {
    pub id: String,
    pub usuario: String,
    pub password: String,
    #[serde(deserialize_with = "serde_helpers::de_bool_from_int")]
    pub activo: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncPerfilRow {
    pub id: String,
    pub id_usuario: String,
    pub nombre_completo: String,
    pub cargo: String,
    pub rol: String,
}

/// Server pull response structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncPullResponse {
    pub server_time: String,
    pub catalogs: SyncCatalogs,
    pub certificaciones: Vec<SyncCertificacionRow>,
    pub modificaciones: Vec<SyncModificacionRow>,
    pub observaciones: Vec<SyncObservacionRow>,
    /// Full list of ALL certificacion IDs currently on the server.
    /// `Some([])` means the table is empty (prune all local synced rows).
    /// `None` means the server is an older version that doesn't send this field (skip pruning).
    #[serde(default)]
    pub all_certificacion_ids: Option<Vec<String>>,
    /// Full list of ALL modificacion IDs currently on the server.
    #[serde(default)]
    pub all_modificacion_ids: Option<Vec<String>>,
    /// Full list of ALL observacion_certificacion IDs currently on the server.
    #[serde(default)]
    pub all_observacion_ids: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncCatalogs {
    pub dependencias: Vec<SyncDependenciaRow>,
    pub tipo_cuentas: Vec<SyncTipoCuentaRow>,
    pub unidades: Vec<SyncUnidadRow>,
    pub cuentas_contables: Vec<SyncCuentaContableRow>,
    pub proyectos: Vec<SyncProyectoRow>,
    pub usuarios: Vec<SyncUsuarioRow>,
    pub perfiles: Vec<SyncPerfilRow>,
}

/// Payload sent to server push endpoint
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncPushPayload {
    pub certificaciones: Vec<SyncCertificacionRow>,
    pub modificaciones: Vec<SyncModificacionRow>,
    pub observaciones: Vec<SyncObservacionRow>,
}

/// Server push response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncPushResponse {
    pub accepted: Vec<String>,
    pub conflicts: Vec<SyncConflict>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncConflict {
    pub id: String,
    pub table_name: String,
    pub server_version: serde_json::Value,
    pub message: String,
}

use chrono::{NaiveDate, NaiveDateTime};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

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
    pub monto_total: Decimal,
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
    pub monto_total: Decimal,
    pub comentario: Option<String>,
    // Unidad
    pub unidad_codigo: i32,
    pub unidad_nombre: String,
    // Cuenta
    pub cuenta_codigo: i32,
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
}

#[derive(Debug, Deserialize)]
pub struct CrearCertificacion {
    pub id_unidad: String,
    pub id_cuenta_contable: String,
    pub id_proyecto: Option<String>,
    pub concepto: String,
    pub monto_total: Decimal,
    pub comentario: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct EditarCertificacion {
    pub id_unidad: Option<String>,
    pub id_cuenta_contable: Option<String>,
    pub id_proyecto: Option<String>,
    pub concepto: Option<String>,
    pub monto_total: Option<Decimal>,
    pub comentario: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
pub struct FiltrosCertificacion {
    pub id_unidad: Option<String>,
    pub id_cuenta_contable: Option<String>,
    pub id_proyecto: Option<String>,
    pub generado_por: Option<String>,
    pub fecha_desde: Option<String>,
    pub fecha_hasta: Option<String>,
    pub busqueda: Option<String>,
}

// ============================================
// Modificacion
// ============================================
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Modificacion {
    pub id: String,
    pub id_certificacion: String,
    pub modificado_por: String,
    pub monto_antiguo: Option<Decimal>,
    pub monto_nuevo: Option<Decimal>,
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
    pub monto_antiguo: Option<Decimal>,
    pub monto_nuevo: Option<Decimal>,
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

// ============================================
// Reportes
// ============================================
#[derive(Debug, Serialize, FromRow)]
pub struct ReporteResumen {
    pub total_certificaciones: i64,
    pub monto_total: Option<Decimal>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct ReportePorUnidad {
    pub unidad_codigo: i32,
    pub unidad_nombre: String,
    pub total_certificaciones: i64,
    pub monto_total: Option<Decimal>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct ReportePorCuenta {
    pub cuenta_codigo: i32,
    pub cuenta_nombre: String,
    pub total_certificaciones: i64,
    pub monto_total: Option<Decimal>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct ReportePorProyecto {
    pub proyecto_nombre: String,
    pub total_certificaciones: i64,
    pub monto_total: Option<Decimal>,
}

#[derive(Debug, Deserialize, Default)]
pub struct FiltrosReporte {
    pub fecha_desde: Option<String>,
    pub fecha_hasta: Option<String>,
    pub mes: Option<i32>,
    pub anio: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct ReporteCompleto {
    pub resumen: ReporteResumen,
    pub por_unidad: Vec<ReportePorUnidad>,
    pub por_cuenta: Vec<ReportePorCuenta>,
    pub por_proyecto: Vec<ReportePorProyecto>,
}
